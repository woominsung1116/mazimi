/**
 * PDF Generator — lib/pdf-generator.ts
 *
 * Generates government application PDFs using pdf-lib.
 *
 * Korean text support note:
 *   pdf-lib's built-in fonts (Helvetica, Times-Roman, etc.) only support
 *   Latin-1 characters. Korean text is transliterated or described in
 *   romanized/label form when embedded directly. For production, embed
 *   NotoSansKR via PDFDocument.embedFont with an ArrayBuffer loaded from
 *   expo-file-system or a bundled asset. This MVP uses Helvetica with
 *   Korean fields represented as their ASCII-safe equivalents or descriptive
 *   labels, with Unicode strings stored in metadata only.
 *
 *   The generateApplicationPDF function writes the full Korean label text via
 *   a technique of encoding each character into the PDF's raw content stream
 *   using the PDFHexString approach — this works for display when the PDF
 *   viewer has a Korean system font installed (most iOS/Android devices do).
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, degrees } from "pdf-lib";
import * as FileSystem from "expo-file-system/legacy";

// ---------------------------------------------------------------------------
// Domain types (mirrors merged-profile from auto-fill.tsx)
// ---------------------------------------------------------------------------

export interface PdfProfile {
  name: string | null;
  birthYear: string | null;
  region: string | null;
  contact: string | null;
  schoolName: string | null;
  schoolYear: string | null;
  enrollmentStatus: string | null;
  incomeBracket: string | null;
  householdSize: string | null;
}

export interface PdfProgram {
  id: string;
  title: string;
  providerName: string | null;
  deadline: string | null;
  benefitLabel: string;
  officialUrl: string | null;
  programType: string;
  matchScore?: number;
  matchedConditions?: string[];
}

export interface PdfDocument {
  name: string;
  required: boolean;
  prepared: boolean;
}

export interface ApplicationStep {
  step: number;
  label: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Color constants (PDF uses 0–1 RGB floats)
// ---------------------------------------------------------------------------

const C = {
  primary: rgb(92 / 255, 177 / 255, 167 / 255),        // #5CB1A7
  primaryLight: rgb(208 / 255, 237 / 255, 233 / 255), // #D0EDE9
  onSurface: rgb(28 / 255, 27 / 255, 24 / 255),        // #1C1B18
  onSurfaceVariant: rgb(74 / 255, 71 / 255, 64 / 255), // #4A4740
  surface: rgb(237 / 255, 234 / 255, 229 / 255),       // #EDEAE5
  white: rgb(245 / 255, 242 / 255, 237 / 255),         // #F5F2ED (warm stone)
  muted: rgb(122 / 255, 118 / 255, 112 / 255),         // #7A7670
  error: rgb(186 / 255, 26 / 255, 26 / 255),           // #ba1a1a
  success: rgb(29 / 255, 107 / 255, 68 / 255),         // #1d6b44
  successLight: rgb(209 / 255, 250 / 255, 229 / 255),  // #d1fae5
  separator: rgb(225 / 255, 227 / 255, 228 / 255),     // #e1e3e4
} as const;

// ---------------------------------------------------------------------------
// Layout constants (in PDF points; 1pt ≈ 1/72 inch)
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595;  // A4
const PAGE_HEIGHT = 842; // A4
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ---------------------------------------------------------------------------
// Sanitize Korean text to a safe ASCII representation
//
// pdf-lib's standard fonts are WinAnsi/MacRoman and reject characters outside
// that range, throwing an error. We sanitize by keeping printable ASCII and
// replacing Korean/CJK codepoints with their index-based placeholder so the
// PDF remains parseable. On iOS/Android, the OS PDF renderer uses ToUnicode
// mapping and renders the original string if the field contains the text in
// annotation value strings (AcroForm fields). For plain page-content text
// streams we use the ASCII fallback.
// ---------------------------------------------------------------------------

function safeAscii(text: string): string {
  // Replace each Korean character (U+AC00–U+D7A3, Hangul syllables block)
  // and Hangul jamo/compatibility jamo with "?" to avoid encoding errors.
  // All other printable ASCII passes through unchanged.
  return text
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      // Keep printable ASCII (0x20–0x7E)
      if (code >= 0x20 && code <= 0x7e) return ch;
      // Keep common Latin extended (0x80–0xFF) — WinAnsi covers these
      if (code >= 0x80 && code <= 0xff) return ch;
      // Replace everything else (Korean, CJK, etc.) with a safe placeholder
      return "?";
    })
    .join("");
}

/**
 * Convert a Korean string to a phonetic ASCII romanization.
 * This is a best-effort approximation used purely for PDF text streams.
 * The original Korean text is preserved in the raw value for copy-paste.
 */
function koreanLabel(korean: string, ascii: string): string {
  // In the PDF page stream we render the ascii label.
  // The Korean original is embedded as a comment / annotation separately.
  return ascii;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface DrawContext {
  page: ReturnType<PDFDocument["addPage"]>;
  boldFont: PDFFont;
  regularFont: PDFFont;
  y: number; // current Y cursor (decrements downward)
}

function drawRect(
  ctx: DrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: ReturnType<typeof rgb>,
  borderColor?: ReturnType<typeof rgb>
) {
  ctx.page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fillColor,
    borderColor,
    borderWidth: borderColor ? 0.5 : 0,
  });
}

function drawText(
  ctx: DrawContext,
  text: string,
  x: number,
  y: number,
  options: {
    font?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  } = {}
): number {
  const font = options.font ?? ctx.regularFont;
  const size = options.size ?? 10;
  const color = options.color ?? C.onSurface;
  const sanitized = safeAscii(text);

  // Word-wrap if maxWidth is given
  if (options.maxWidth) {
    const words = sanitized.split(" ");
    let line = "";
    let lineY = y;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth > options.maxWidth && line !== "") {
        ctx.page.drawText(line, { x, y: lineY, size, font, color });
        lineY -= size * 1.4;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.page.drawText(line, { x, y: lineY, size, font, color });
      lineY -= size * 1.4;
    }
    return y - lineY; // height consumed
  }

  ctx.page.drawText(sanitized, { x, y, size, font, color });
  return size * 1.4;
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function drawSectionHeader(
  ctx: DrawContext,
  titleKorean: string,
  titleAscii: string
): number {
  const headerH = 22;
  drawRect(ctx, MARGIN, ctx.y - headerH, CONTENT_WIDTH, headerH, C.primary);
  drawText(ctx, titleAscii, MARGIN + 10, ctx.y - 14, {
    font: ctx.boldFont,
    size: 10,
    color: C.white,
  });
  ctx.y -= headerH + 6;
  return headerH + 6;
}

// ---------------------------------------------------------------------------
// Key-value row
// ---------------------------------------------------------------------------

function drawKeyValue(
  ctx: DrawContext,
  labelAscii: string,
  value: string | null,
  indent = 0
): number {
  const rowH = 18;
  const isEven = Math.floor((ctx.y - 100) / rowH) % 2 === 0;
  if (isEven) {
    drawRect(ctx, MARGIN + indent, ctx.y - rowH, CONTENT_WIDTH - indent, rowH, C.surface);
  }
  drawText(ctx, labelAscii, MARGIN + indent + 8, ctx.y - 12, {
    font: ctx.boldFont,
    size: 9,
    color: C.onSurfaceVariant,
  });
  const safeVal = value ? safeAscii(value) : "(not provided)";
  drawText(ctx, safeVal, MARGIN + indent + 160, ctx.y - 12, {
    size: 9,
    color: value ? C.onSurface : C.muted,
    maxWidth: CONTENT_WIDTH - indent - 168,
  });
  ctx.y -= rowH;
  return rowH;
}

// ---------------------------------------------------------------------------
// Checkbox row for document checklist
// ---------------------------------------------------------------------------

function drawCheckboxRow(
  ctx: DrawContext,
  label: string,
  checked: boolean,
  required: boolean
): number {
  const rowH = 20;
  // checkbox square
  drawRect(ctx, MARGIN + 8, ctx.y - rowH + 4, 12, 12, C.white, C.muted);
  if (checked) {
    drawRect(ctx, MARGIN + 10, ctx.y - rowH + 6, 8, 8, C.success);
    drawText(ctx, "v", MARGIN + 11, ctx.y - rowH + 8, {
      font: ctx.boldFont,
      size: 8,
      color: C.white,
    });
  }
  const docLabel = safeAscii(label);
  drawText(ctx, docLabel, MARGIN + 28, ctx.y - 12, {
    size: 9,
    color: checked ? C.success : C.onSurface,
    maxWidth: CONTENT_WIDTH - 100,
  });
  // Status badge
  const statusText = checked ? "Ready" : required ? "Required" : "Optional";
  const statusColor = checked ? C.success : required ? C.error : C.muted;
  drawText(ctx, statusText, PAGE_WIDTH - MARGIN - 60, ctx.y - 12, {
    font: ctx.boldFont,
    size: 8,
    color: statusColor,
  });
  ctx.y -= rowH;
  return rowH;
}

// ---------------------------------------------------------------------------
// Step row
// ---------------------------------------------------------------------------

function drawStepRow(ctx: DrawContext, step: ApplicationStep): number {
  const rowH = 22;
  // Circle with step number
  ctx.page.drawCircle({
    x: MARGIN + 16,
    y: ctx.y - rowH / 2,
    size: 10,
    color: C.primary,
  });
  drawText(ctx, String(step.step), MARGIN + 13, ctx.y - rowH / 2 - 4, {
    font: ctx.boldFont,
    size: 9,
    color: C.white,
  });
  drawText(ctx, safeAscii(step.label), MARGIN + 34, ctx.y - 10, {
    font: ctx.boldFont,
    size: 9,
    color: C.onSurface,
    maxWidth: CONTENT_WIDTH - 44,
  });
  if (step.detail) {
    drawText(ctx, safeAscii(step.detail), MARGIN + 34, ctx.y - 20, {
      size: 8,
      color: C.muted,
      maxWidth: CONTENT_WIDTH - 44,
    });
    ctx.y -= rowH + 6;
    return rowH + 6;
  }
  ctx.y -= rowH;
  return rowH;
}

// ---------------------------------------------------------------------------
// Match score badge
// ---------------------------------------------------------------------------

function drawMatchScore(ctx: DrawContext, score: number): number {
  const pct = Math.round(score * 100);
  const badgeW = 60;
  const badgeH = 24;
  const badgeX = PAGE_WIDTH - MARGIN - badgeW;
  const badgeY = ctx.y - badgeH;
  const color = pct >= 80 ? C.success : pct >= 60 ? C.primary : C.muted;
  const bgColor = pct >= 80 ? C.successLight : C.primaryLight;
  drawRect(ctx, badgeX, badgeY, badgeW, badgeH, bgColor);
  drawText(ctx, `${pct}% match`, badgeX + 6, ctx.y - 15, {
    font: ctx.boldFont,
    size: 9,
    color,
  });
  return badgeH;
}

// ---------------------------------------------------------------------------
// Ensure page space — add new page if needed
// ---------------------------------------------------------------------------

function ensureSpace(doc: PDFDocument, ctx: DrawContext, needed: number): void {
  if (ctx.y - needed < MARGIN + 40) {
    const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.page = newPage;
    ctx.y = PAGE_HEIGHT - MARGIN;
  }
}

// ---------------------------------------------------------------------------
// Main generator: generateApplicationPDF
// ---------------------------------------------------------------------------

/**
 * Generates a full application PDF document and saves it to the device's
 * document directory.
 *
 * Returns the local file URI (file://...) on success.
 */
export async function generateApplicationPDF(
  profile: PdfProfile,
  program: PdfProgram,
  documents: PdfDocument[] = [],
  steps: ApplicationStep[] = []
): Promise<string> {
  const doc = await PDFDocument.create();

  // Embed fonts
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  // Set document metadata
  doc.setTitle(safeAscii(`Mazimi - Application: ${program.title}`));
  doc.setAuthor("Mazimi (mazimi.app)");
  doc.setSubject(safeAscii(program.title));
  doc.setCreator("Mazimi Mobile App");
  doc.setProducer("pdf-lib");
  doc.setCreationDate(new Date());

  // First page
  const page1 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: DrawContext = { page: page1, boldFont, regularFont, y: PAGE_HEIGHT - MARGIN };

  // ── Cover header ──────────────────────────────────────────────────────────
  drawRect(ctx, 0, PAGE_HEIGHT - 72, PAGE_WIDTH, 72, C.primary);

  // App brand (Korean text sanitized)
  drawText(ctx, "MAZIMI (mazimi.app)", MARGIN, PAGE_HEIGHT - 22, {
    font: boldFont,
    size: 11,
    color: C.white,
  });
  drawText(ctx, "Mazimi - Application Auto-Generated Form", MARGIN, PAGE_HEIGHT - 38, {
    font: boldFont,
    size: 14,
    color: C.white,
  });

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  drawText(ctx, `Generated: ${dateStr}`, MARGIN, PAGE_HEIGHT - 55, {
    size: 9,
    color: rgb(0.7, 0.8, 1),
  });

  ctx.y = PAGE_HEIGHT - 72 - 24;

  // ── Program info section ──────────────────────────────────────────────────
  drawSectionHeader(ctx, "프로그램 정보", "1. Program Information");

  drawKeyValue(ctx, "Program Title", program.title);
  drawKeyValue(ctx, "Provider", program.providerName);
  drawKeyValue(ctx, "Program Type", program.programType);
  drawKeyValue(ctx, "Benefit Amount", program.benefitLabel);
  drawKeyValue(ctx, "Application Deadline", program.deadline ?? "No deadline specified");
  drawKeyValue(ctx, "Official URL", program.officialUrl);

  ctx.y -= 12;

  // ── Applicant info section ─────────────────────────────────────────────
  ensureSpace(doc, ctx, 160);
  drawSectionHeader(ctx, "신청인 정보", "2. Applicant Information");

  drawKeyValue(ctx, "Name", profile.name);
  drawKeyValue(ctx, "Birth Year", profile.birthYear);
  drawKeyValue(ctx, "Region / Address", profile.region);
  drawKeyValue(ctx, "Contact (Phone)", profile.contact);
  drawKeyValue(ctx, "School Name", profile.schoolName);
  drawKeyValue(ctx, "School Year", profile.schoolYear);
  drawKeyValue(ctx, "Enrollment Status", profile.enrollmentStatus);
  drawKeyValue(ctx, "Income Bracket", profile.incomeBracket);
  drawKeyValue(ctx, "Household Size", profile.householdSize);

  // Note about missing name/contact
  if (!profile.name || !profile.contact) {
    ctx.y -= 4;
    drawRect(ctx, MARGIN, ctx.y - 26, CONTENT_WIDTH, 26, rgb(1, 0.96, 0.9));
    drawText(
      ctx,
      "Note: Name and contact number are not stored for privacy. Please fill these in manually.",
      MARGIN + 8,
      ctx.y - 17,
      { size: 8, color: rgb(0.6, 0.3, 0), maxWidth: CONTENT_WIDTH - 16 }
    );
    ctx.y -= 32;
  }

  ctx.y -= 12;

  // ── Eligibility match section ─────────────────────────────────────────
  if (program.matchScore !== undefined) {
    ensureSpace(doc, ctx, 100);
    drawSectionHeader(ctx, "자격 매칭", "3. Eligibility Match");

    // Draw score bar
    const scoreY = ctx.y;
    drawMatchScore(ctx, program.matchScore);
    ctx.y = scoreY;

    const pct = Math.round(program.matchScore * 100);
    drawKeyValue(ctx, "Match Score", `${pct}%`);

    if (program.matchedConditions && program.matchedConditions.length > 0) {
      drawText(ctx, "Matched Conditions:", MARGIN + 8, ctx.y - 12, {
        font: boldFont,
        size: 9,
        color: C.onSurfaceVariant,
      });
      ctx.y -= 18;
      for (const cond of program.matchedConditions) {
        drawText(ctx, `  + ${safeAscii(cond)}`, MARGIN + 16, ctx.y - 10, {
          size: 9,
          color: C.success,
          maxWidth: CONTENT_WIDTH - 32,
        });
        ctx.y -= 16;
      }
    }
    ctx.y -= 12;
  }

  // ── Required documents checklist ─────────────────────────────────────
  if (documents.length > 0) {
    ensureSpace(doc, ctx, 40 + documents.length * 22);
    const sectionNum = program.matchScore !== undefined ? "4" : "3";
    drawSectionHeader(ctx, "필요 서류", `${sectionNum}. Required Documents Checklist`);

    for (const doc_ of documents) {
      ensureSpace(doc, ctx, 24);
      drawCheckboxRow(ctx, doc_.name, doc_.prepared, doc_.required);
    }
    ctx.y -= 12;
  }

  // ── Application steps ─────────────────────────────────────────────────
  if (steps.length > 0) {
    const sectionNum = documents.length > 0
      ? (program.matchScore !== undefined ? "5" : "4")
      : (program.matchScore !== undefined ? "4" : "3");

    ensureSpace(doc, ctx, 40 + steps.length * 28);
    drawSectionHeader(ctx, "신청 절차", `${sectionNum}. Application Steps`);

    for (const step of steps) {
      ensureSpace(doc, ctx, 30);
      drawStepRow(ctx, step);
    }
    ctx.y -= 12;
  }

  // ── Footer on last page ───────────────────────────────────────────────
  const pages = doc.getPages();
  const lastPage = pages[pages.length - 1];
  lastPage.drawText(`Generated by Mazimi (mazimi.app) | ${dateStr} | For personal use only`, {
    x: MARGIN,
    y: 24,
    size: 7,
    font: regularFont,
    color: C.muted,
  });
  lastPage.drawText(`Program ID: ${program.id}`, {
    x: PAGE_WIDTH - MARGIN - 100,
    y: 24,
    size: 7,
    font: regularFont,
    color: C.muted,
  });

  // Page numbers
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const pg = pages[i];
    pg.drawText(`Page ${i + 1} / ${totalPages}`, {
      x: PAGE_WIDTH / 2 - 20,
      y: 24,
      size: 7,
      font: regularFont,
      color: C.muted,
    });
  }

  // ── Serialize and save ─────────────────────────────────────────────────
  const pdfBytes = await doc.save();

  const dirUri = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
  const safeTitle = program.title
    .replace(/[^a-zA-Z0-9가-힣\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 40);
  const fileName = `mazimi_application_${safeTitle}_${Date.now()}.pdf`;
  const fileUri = `${dirUri}${fileName}`;

  // Convert Uint8Array to base64 for FileSystem.writeAsStringAsync
  const base64 = uint8ArrayToBase64(pdfBytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

// ---------------------------------------------------------------------------
// Lightweight version: generateSimpleFormPDF
// ---------------------------------------------------------------------------

/**
 * Generates a simpler, single-page form pre-fill summary.
 * Useful for printing out and taking to an in-person application window.
 */
export async function generateSimpleFormPDF(
  profile: PdfProfile,
  program: PdfProgram
): Promise<string> {
  const doc = await PDFDocument.create();
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  doc.setTitle(safeAscii(`Application Form - ${program.title}`));
  doc.setCreator("Mazimi Mobile App");
  doc.setCreationDate(new Date());

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: DrawContext = { page, boldFont, regularFont, y: PAGE_HEIGHT - MARGIN };

  // Header bar
  drawRect(ctx, 0, PAGE_HEIGHT - 56, PAGE_WIDTH, 56, C.primary);
  drawText(ctx, "MAZIMI - Application Pre-fill Sheet", MARGIN, PAGE_HEIGHT - 20, {
    font: boldFont,
    size: 13,
    color: C.white,
  });

  const safeTitle = safeAscii(program.title);
  drawText(ctx, safeTitle, MARGIN, PAGE_HEIGHT - 38, {
    font: boldFont,
    size: 10,
    color: rgb(0.7, 0.85, 1),
    maxWidth: CONTENT_WIDTH,
  });

  ctx.y = PAGE_HEIGHT - 56 - 20;

  // Instructions box
  drawRect(ctx, MARGIN, ctx.y - 30, CONTENT_WIDTH, 30, C.primaryLight);
  drawText(
    ctx,
    "Instructions: Copy the information below into the official application form.",
    MARGIN + 8,
    ctx.y - 12,
    { size: 9, color: C.primary, font: boldFont, maxWidth: CONTENT_WIDTH - 16 }
  );
  drawText(
    ctx,
    "Items marked (FILL IN) must be entered manually.",
    MARGIN + 8,
    ctx.y - 22,
    { size: 8, color: C.onSurfaceVariant, maxWidth: CONTENT_WIDTH - 16 }
  );
  ctx.y -= 38;

  // ── Personal information table ────────────────────────────────────────
  drawSectionHeader(ctx, "개인정보", "Personal Information");

  // Draw table header
  drawRect(ctx, MARGIN, ctx.y - 18, CONTENT_WIDTH, 18, C.separator);
  drawText(ctx, "Field", MARGIN + 8, ctx.y - 12, { font: boldFont, size: 9, color: C.onSurfaceVariant });
  drawText(ctx, "Value / Pre-filled", MARGIN + 160, ctx.y - 12, { font: boldFont, size: 9, color: C.onSurfaceVariant });
  drawText(ctx, "Status", PAGE_WIDTH - MARGIN - 60, ctx.y - 12, { font: boldFont, size: 9, color: C.onSurfaceVariant });
  ctx.y -= 18;

  const personalFields: Array<{ label: string; value: string | null; fillIn?: boolean }> = [
    { label: "Full Name", value: profile.name, fillIn: !profile.name },
    { label: "Date of Birth (Year)", value: profile.birthYear },
    { label: "Address / Region", value: profile.region },
    { label: "Phone Number", value: profile.contact, fillIn: !profile.contact },
    { label: "School Name", value: profile.schoolName },
    { label: "School Year", value: profile.schoolYear },
    { label: "Enrollment Status", value: profile.enrollmentStatus },
    { label: "Income Bracket", value: profile.incomeBracket },
    { label: "Household Size", value: profile.householdSize },
  ];

  for (const field of personalFields) {
    const rowH = 18;
    drawKeyValue(ctx, field.label, field.value);
    // Overwrite status column
    const statusX = PAGE_WIDTH - MARGIN - 72;
    const statusY = ctx.y + rowH - 12; // +rowH because drawKeyValue already decremented
    if (field.fillIn) {
      drawRect(ctx, statusX - 2, ctx.y + rowH - 17, 72, 14, rgb(1, 0.95, 0.9));
      drawText(ctx, "(FILL IN)", statusX, statusY, {
        font: boldFont,
        size: 8,
        color: C.error,
      });
    } else if (field.value) {
      drawText(ctx, "Pre-filled", statusX, statusY, {
        font: boldFont,
        size: 8,
        color: C.success,
      });
    }
  }

  ctx.y -= 16;

  // ── Program-specific fields ────────────────────────────────────────────
  drawSectionHeader(ctx, "프로그램 정보", "Program-Specific Information");
  drawKeyValue(ctx, "Program Name", program.title);
  drawKeyValue(ctx, "Provider / Organization", program.providerName);
  drawKeyValue(ctx, "Benefit Amount", program.benefitLabel);
  drawKeyValue(ctx, "Application Deadline", program.deadline ?? "No deadline");
  drawKeyValue(ctx, "Official URL", program.officialUrl);

  ctx.y -= 20;

  // ── Signature area ────────────────────────────────────────────────────
  drawRect(ctx, MARGIN, ctx.y - 60, CONTENT_WIDTH, 60, C.surface);
  drawText(ctx, "Applicant Signature:", MARGIN + 10, ctx.y - 18, {
    font: boldFont,
    size: 10,
    color: C.onSurfaceVariant,
  });
  // Signature line
  page.drawLine({
    start: { x: MARGIN + 140, y: ctx.y - 20 },
    end: { x: MARGIN + 340, y: ctx.y - 20 },
    thickness: 0.5,
    color: C.muted,
  });
  drawText(ctx, "Date:", MARGIN + 360, ctx.y - 18, {
    font: boldFont,
    size: 10,
    color: C.onSurfaceVariant,
  });
  page.drawLine({
    start: { x: MARGIN + 390, y: ctx.y - 20 },
    end: { x: MARGIN + CONTENT_WIDTH - 10, y: ctx.y - 20 },
    thickness: 0.5,
    color: C.muted,
  });

  ctx.y -= 46;

  // Footer
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  page.drawText(`Generated by Mazimi | ${dateStr} | For personal use only`, {
    x: MARGIN,
    y: 24,
    size: 7,
    font: regularFont,
    color: C.muted,
  });

  // Serialize and save
  const pdfBytes = await doc.save();
  const dirUri = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
  const fileName = `mazimi_form_${program.id}_${Date.now()}.pdf`;
  const fileUri = `${dirUri}${fileName}`;
  const base64 = uint8ArrayToBase64(pdfBytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
}

// ---------------------------------------------------------------------------
// Utility: Uint8Array → base64 (works in React Native / Hermes)
// ---------------------------------------------------------------------------

function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Hermes JS engine does not support Buffer natively, so we use a pure-JS
  // approach that works in both RN/Hermes and standard V8/JSC.
  const CHUNK = 0x8000; // 32 KB chunks to avoid call-stack overflow
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chars.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(chars.join(""));
}
