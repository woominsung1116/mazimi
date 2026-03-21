FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required by Scrapling (playwright/camoufox)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Scrapling browser drivers (Camoufox for anti-bot)
RUN python -c "from scrapling.fetchers import Camoufox" 2>/dev/null || true
RUN scrapling install camoufox 2>/dev/null || \
    python -m camoufox fetch 2>/dev/null || true

COPY scraper.py .

CMD ["python", "scraper.py"]
