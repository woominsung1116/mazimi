"""
Scrapling-based sidecar scraper for regional youth-policy portals.

Targets (from crates/worker/src/sources/local_scraper.rs):
  - 부산청년센터  https://www.busanyouth.or.kr/
  - 대구청년센터  https://youth.daegu.go.kr/

Pipeline:
  fetch page (Scrapling anti-bot) -> extract items -> upsert programs table

Environment:
  DATABASE_URL  — postgres connection string (required)
  SCRAPER_TIMEOUT — per-site timeout in seconds (default 30)
"""

import hashlib
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Scrapling import with graceful fallback
# ---------------------------------------------------------------------------
try:
    from scrapling.fetchers import Camoufox as ScraplingFetcher
    FETCHER_MODE = "camoufox"
except ImportError:
    try:
        from scrapling.fetchers import PlayWright as ScraplingFetcher
        FETCHER_MODE = "playwright"
    except ImportError:
        try:
            from scrapling import Fetcher as ScraplingFetcher
            FETCHER_MODE = "basic"
        except ImportError:
            ScraplingFetcher = None
            FETCHER_MODE = "none"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("scraper")

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

PROGRAM_TYPE_KEYWORDS = {
    "scholarship": ["장학", "학자금", "등록금", "장학금"],
    "employment": ["취업", "채용", "일자리", "인턴", "취창업"],
    "startup": ["창업", "스타트업", "벤처"],
    "housing": ["주거", "임대", "전세", "월세", "주택"],
    "welfare": ["복지", "지원금", "수당", "바우처", "혜택"],
    "education": ["교육", "훈련", "연수", "강좌", "강의", "학습"],
    "culture": ["문화", "예술", "체험", "여행", "스포츠"],
}


def detect_program_type(title: str, description: str) -> str:
    text = (title + " " + (description or "")).lower()
    for ptype, keywords in PROGRAM_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return ptype
    return "welfare"  # default


@dataclass
class ScrapedProgram:
    source_name: str        # human-readable portal name
    region: str             # slug: busan | daegu
    title: str
    description: Optional[str]
    deadline_text: Optional[str]
    link: Optional[str]
    provider: str
    raw_html_snippet: str = ""

    # Derived
    program_type: str = field(default="welfare", init=False)
    content_hash: str = field(default="", init=False)

    def __post_init__(self):
        self.program_type = detect_program_type(self.title, self.description or "")
        payload = json.dumps({
            "source": self.source_name,
            "title": self.title,
            "description": self.description,
            "deadline_text": self.deadline_text,
            "link": self.link,
        }, ensure_ascii=False, sort_keys=True)
        self.content_hash = hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Source definitions (mirrors SOURCES in local_scraper.rs)
# ---------------------------------------------------------------------------

@dataclass
class SourceConfig:
    name: str
    url: str
    region: str
    item_selector: str
    title_selector: str
    desc_selector: str
    deadline_selector: str
    link_selector: str
    provider: str


SOURCES: list[SourceConfig] = [
    SourceConfig(
        name="부산청년센터",
        url="https://www.busanyouth.or.kr/board/list?boardId=program",
        region="busan",
        # eGovFrame board — verify selectors in DevTools before deploying
        item_selector=".board_list li",
        title_selector=".title a",
        desc_selector=".summary",
        deadline_selector=".date",
        link_selector=".title a",
        provider="부산청년센터",
    ),
    SourceConfig(
        name="대구청년센터",
        url="https://youth.daegu.go.kr/program/list",
        region="daegu",
        # Card-grid layout — verify in DevTools
        item_selector=".program-list .item",
        title_selector=".item-title",
        desc_selector=".item-desc",
        deadline_selector=".item-period",
        link_selector="a",
        provider="대구청년센터",
    ),
]

# ---------------------------------------------------------------------------
# Scrapling fetcher helpers
# ---------------------------------------------------------------------------

def fetch_page(url: str, timeout: int):
    """Fetch a URL with Scrapling and return a page object (or None on failure)."""
    if ScraplingFetcher is None:
        raise RuntimeError("Scrapling is not installed or could not be imported")

    log.info("fetch url=%s mode=%s", url, FETCHER_MODE)

    if FETCHER_MODE in ("camoufox", "playwright"):
        fetcher = ScraplingFetcher(headless=True)
        page = fetcher.fetch(url, timeout=timeout * 1000)  # ms
    else:
        fetcher = ScraplingFetcher()
        page = fetcher.get(url, timeout=timeout)

    return page


def safe_text(element) -> str:
    """Extract clean whitespace-normalised text from a Scrapling element."""
    try:
        raw = element.text or ""
    except Exception:
        raw = str(element) if element else ""
    return re.sub(r"\s+", " ", raw).strip()


def safe_attr(element, attr: str, fallback: str = "") -> str:
    try:
        return element.attrib.get(attr, fallback) or fallback
    except Exception:
        return fallback


def resolve_url(href: str, base_url: str) -> str:
    if not href:
        return base_url
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        # absolute path — prepend origin
        m = re.match(r"(https?://[^/]+)", base_url)
        origin = m.group(1) if m else ""
        return origin + href
    return href


# ---------------------------------------------------------------------------
# Per-source scraping
# ---------------------------------------------------------------------------

def scrape_source(src: SourceConfig, timeout: int) -> list[ScrapedProgram]:
    log.info("scraping source=%s url=%s", src.name, src.url)
    programs: list[ScrapedProgram] = []

    try:
        page = fetch_page(src.url, timeout)
    except Exception as exc:
        log.warning("fetch failed source=%s error=%s — skipping", src.name, exc)
        return []

    try:
        items = page.css(src.item_selector)
    except Exception as exc:
        log.warning(
            "item_selector failed source=%s selector=%s error=%s",
            src.name, src.item_selector, exc,
        )
        return []

    if not items:
        log.warning(
            "0 items matched source=%s selector=%s "
            "— site may have changed layout; manual selector update needed",
            src.name, src.item_selector,
        )
        return []

    log.info("found %d item elements source=%s", len(items), src.name)

    for item in items:
        # Title — required
        try:
            title_el = item.css_first(src.title_selector)
            title = safe_text(title_el) if title_el else None
        except Exception:
            title = None

        if not title:
            log.debug("title not found — skipping item source=%s", src.name)
            continue

        # Description — optional
        description: Optional[str] = None
        if src.desc_selector:
            try:
                desc_el = item.css_first(src.desc_selector)
                description = safe_text(desc_el) if desc_el else None
            except Exception:
                pass

        # Deadline — optional
        deadline_text: Optional[str] = None
        if src.deadline_selector:
            try:
                dl_el = item.css_first(src.deadline_selector)
                deadline_text = safe_text(dl_el) if dl_el else None
            except Exception:
                pass

        # Link — optional, falls back to base URL
        link: Optional[str] = src.url
        if src.link_selector:
            try:
                link_el = item.css_first(src.link_selector)
                if link_el:
                    href = safe_attr(link_el, "href", "")
                    link = resolve_url(href, src.url) if href else src.url
            except Exception:
                pass

        # Raw HTML snippet for debugging (truncated to 4 KB)
        try:
            raw_html = item.html or ""
            raw_html = raw_html[:4096]
        except Exception:
            raw_html = ""

        programs.append(ScrapedProgram(
            source_name=src.name,
            region=src.region,
            title=title,
            description=description,
            deadline_text=deadline_text,
            link=link,
            provider=src.provider,
            raw_html_snippet=raw_html,
        ))

    log.info("parsed %d programs source=%s", len(programs), src.name)
    return programs


# ---------------------------------------------------------------------------
# Database upsert
# ---------------------------------------------------------------------------

UPSERT_SQL = """
INSERT INTO programs (
    title,
    description,
    source_type,
    program_type,
    provider,
    application_url,
    regions,
    is_active,
    content_hash,
    search_tsv,
    created_at,
    updated_at
) VALUES (
    %(title)s,
    %(description)s,
    'scraper',
    %(program_type)s,
    %(provider)s,
    %(application_url)s,
    %(regions)s,
    true,
    %(content_hash)s,
    to_tsvector('korean', %(title)s || ' ' || coalesce(%(description)s, '')),
    now(),
    now()
)
ON CONFLICT (content_hash) DO UPDATE SET
    title          = EXCLUDED.title,
    description    = EXCLUDED.description,
    program_type   = EXCLUDED.program_type,
    provider       = EXCLUDED.provider,
    application_url = EXCLUDED.application_url,
    regions        = EXCLUDED.regions,
    is_active      = true,
    search_tsv     = EXCLUDED.search_tsv,
    updated_at     = now()
RETURNING id, (xmax = 0) AS inserted
"""


def upsert_programs(conn, programs: list[ScrapedProgram]) -> tuple[int, int]:
    """Upsert all programs. Returns (inserted_count, updated_count)."""
    inserted = 0
    updated = 0

    with conn.cursor() as cur:
        for p in programs:
            try:
                cur.execute(UPSERT_SQL, {
                    "title": p.title,
                    "description": p.description,
                    "program_type": p.program_type,
                    "provider": p.provider,
                    "application_url": p.link,
                    "regions": [p.region],
                    "content_hash": p.content_hash,
                })
                row = cur.fetchone()
                if row and row[1]:
                    inserted += 1
                else:
                    updated += 1
            except Exception as exc:
                log.warning(
                    "upsert failed title=%r error=%s — skipping row",
                    p.title, exc,
                )
                conn.rollback()
                continue
        conn.commit()

    return inserted, updated


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    load_dotenv()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.error("DATABASE_URL is not set — aborting")
        sys.exit(1)

    timeout = int(os.environ.get("SCRAPER_TIMEOUT", "30"))

    log.info(
        "scraper starting sources=%d fetcher_mode=%s",
        len(SOURCES), FETCHER_MODE,
    )

    # Collect all programs across all sources; skip failed sources
    all_programs: list[ScrapedProgram] = []
    for src in SOURCES:
        try:
            programs = scrape_source(src, timeout)
            all_programs.extend(programs)
        except Exception as exc:
            log.error("unexpected error source=%s error=%s — skipping", src.name, exc)

    log.info("total programs scraped=%d", len(all_programs))

    if not all_programs:
        log.warning("no programs collected — nothing to write to DB")
        sys.exit(0)

    # Write to database
    try:
        conn = psycopg2.connect(db_url)
    except Exception as exc:
        log.error("db connection failed error=%s", exc)
        sys.exit(1)

    try:
        ins, upd = upsert_programs(conn, all_programs)
        log.info("db upsert complete inserted=%d updated=%d", ins, upd)
    finally:
        conn.close()

    log.info("scraper finished")


if __name__ == "__main__":
    main()
