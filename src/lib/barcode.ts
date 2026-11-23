/**
 * Helpers for turning raw scanner output (1D or 2D) into values we can match against the catalog.
 *
 * A 2D scanner in keyboard-wedge mode just "types" whatever the code contains. For a retail or
 * pharmacy product that is usually one of:
 *   - a plain EAN/UPC/Code128 value                       -> match as-is
 *   - a GS1 DataMatrix / GS1 QR  e.g. 01089999999999911725123110BATCH1
 *     (GTIN + expiry + batch, and the batch/serial differ pack to pack) -> match on the GTIN
 *   - the same GS1 string in human-readable form "(01)0899...(17)251231(10)BATCH1"
 *   - any of the above prefixed with an AIM symbology identifier such as "]d2" or "]Q3"
 */

export const GS = '\x1d'; // ASCII Group Separator, the GS1 "FNC1" delimiter after variable-length fields

// "]" + code character + modifier, e.g. ]d2 (DataMatrix), ]Q3 (QR), ]C1 (Code 128), ]E0 (EAN-13)
const AIM_ID = /^\][A-Za-z][0-9A-Za-z]/;

// GS1 Application Identifiers with a fixed data length (length excludes the AI itself).
const FIXED_AI: Record<string, number> = {
  '00': 18, '01': 14, '02': 14,
  '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6,
  '20': 2,
};

// Variable-length AIs we know about, with their max data length.
const VARIABLE_AI: Record<string, number> = {
  '10': 20, '21': 20, '22': 20, '30': 8, '37': 8,
  '240': 30, '241': 30, '242': 6, '243': 20, '250': 30, '251': 30, '253': 30, '254': 20,
  '400': 30, '401': 30, '420': 20, '421': 12,
  '90': 30, '91': 90, '92': 90, '93': 90, '94': 90, '95': 90, '96': 90, '97': 90, '98': 90, '99': 90,
};

export interface ParsedScan {
  /** The scan with symbology identifier and control characters (other than GS) removed. */
  raw: string;
  /** GS1 element string as AI -> value, or null when the scan is not GS1 formatted. */
  gs1: Record<string, string> | null;
  /** Values to try, best first, when looking a product up by SKU or barcode. */
  candidates: string[];
}

function stripControl(value: string): string {
  // Keep GS (\x1d) because it still carries meaning for GS1 parsing; drop everything else.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1c\x1e-\x1f\x7f]/g, '');
}

function parseBracketedGs1(value: string): Record<string, string> | null {
  if (!/^\(\d{2,4}\)/.test(value)) return null;
  const out: Record<string, string> = {};
  const re = /\((\d{2,4})\)([^(]*)/g;
  let m: RegExpExecArray | null;
  let matched = 0;
  while ((m = re.exec(value)) !== null) {
    const data = m[2].split(GS).join('').trim();
    if (!data) return null;
    out[m[1]] = data;
    matched++;
  }
  return matched > 0 ? out : null;
}

function parseRawGs1(value: string): Record<string, string> | null {
  // Every GS1 element string we care about starts with a numeric AI; require the GTIN (01) up front
  // or at least a recognisable AI so ordinary numeric/alphanumeric codes are not misread.
  if (!/^\d{2}/.test(value)) return null;

  const out: Record<string, string> = {};
  let pos = 0;
  while (pos < value.length) {
    if (value[pos] === GS) { pos++; continue; }

    const ai2 = value.slice(pos, pos + 2);
    const ai3 = value.slice(pos, pos + 3);
    let ai: string;
    let fixedLen: number | undefined;
    let varMax: number | undefined;

    if (FIXED_AI[ai2] !== undefined) {
      ai = ai2; fixedLen = FIXED_AI[ai2];
    } else if (VARIABLE_AI[ai2] !== undefined) {
      ai = ai2; varMax = VARIABLE_AI[ai2];
    } else if (VARIABLE_AI[ai3] !== undefined) {
      ai = ai3; varMax = VARIABLE_AI[ai3];
    } else {
      return null; // unknown AI: cannot tell where this element ends
    }

    const start = pos + ai.length;
    if (fixedLen !== undefined) {
      const data = value.slice(start, start + fixedLen);
      if (data.length !== fixedLen) return null;
      out[ai] = data;
      pos = start + fixedLen;
    } else {
      const gsAt = value.indexOf(GS, start);
      const end = Math.min(gsAt === -1 ? value.length : gsAt, start + (varMax as number));
      const data = value.slice(start, end);
      if (!data) return null;
      out[ai] = data;
      pos = end;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** All plausible spellings of a numeric GTIN/EAN/UPC (GTIN-14 <-> EAN-13 <-> UPC-A <-> EAN-8). */
function numericVariants(digits: string): string[] {
  const out = [digits];
  if (digits.length === 14 && digits.startsWith('0')) out.push(digits.slice(1));
  if (digits.length >= 13 && digits.startsWith('00')) out.push(digits.slice(digits.length - 12));
  if (digits.length === 14 && digits.startsWith('000000')) out.push(digits.slice(6));
  if (digits.length === 13 && digits.startsWith('0')) out.push(digits.slice(1));
  if (digits.length === 12) out.push('0' + digits);
  return out;
}

export function parseScan(input: string): ParsedScan {
  const withGs = stripControl(input.trim().replace(AIM_ID, '')).trim();
  const raw = withGs.split(GS).join('');

  const gs1 = parseBracketedGs1(withGs) ?? parseRawGs1(withGs);

  const candidates: string[] = [];
  const push = (v: string | undefined) => {
    const t = v?.trim();
    if (t && !candidates.includes(t)) candidates.push(t);
  };

  // The code exactly as scanned always goes first so an item registered with that exact value wins.
  push(raw);
  if (/^\d{12,14}$/.test(raw)) numericVariants(raw).forEach(push);
  if (gs1?.['01'] && /^\d{14}$/.test(gs1['01'])) numericVariants(gs1['01']).forEach(push);

  return { raw, gs1, candidates };
}

/**
 * The value to store as an item's barcode when a code is scanned during registration.
 * GS1 codes carry per-pack data (batch, serial, expiry), so only the GTIN identifies the product.
 */
export function toRegistrationCode(input: string): string {
  const parsed = parseScan(input);
  const gtin = parsed.gs1?.['01'];
  if (gtin && /^\d{14}$/.test(gtin)) {
    // Retail packs are normally printed as EAN-13: drop the GTIN-14 indicator digit when it is 0.
    return gtin.startsWith('0') ? gtin.slice(1) : gtin;
  }
  return parsed.raw;
}

/** True when `code` equals the item's SKU or barcode (case-insensitive: scanners suffer from Caps Lock). */
export function itemMatchesCandidates(
  item: { sku?: string | null; barcode?: string | null },
  candidates: string[],
): boolean {
  const sku = item.sku?.trim().toLowerCase();
  const barcode = item.barcode?.trim().toLowerCase();
  return candidates.some((c) => {
    const lc = c.toLowerCase();
    return lc === sku || lc === barcode;
  });
}
