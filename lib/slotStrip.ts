// The 22-slot strip: why a 0 is needed once the separators go.
//
//   ◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|
//   ◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|◻︎|
//
// Two rows of 11 = 22 slots, one per camera angle of the glass box (cameraAngles in glassKnot).
// Each slot holds one coefficient. While the "|" separators are there, a slot can stay blank and
// everyone still knows which slot is which. Remove the separators and a blank slot simply vanishes:
// "1||3" collapses to "13", and nobody can tell it from "1|3". A placeholder — 0 — is what keeps
// the positions (the same reason positional numerals needed a zero).
//
// But a placeholder 0 must not be confused with a measured 0. So the strip keeps three states:
//   ◻︎  unknown   (not measured yet)
//   0   known zero
//   n   a value
// and packing without separators writes every slot explicitly, returning a mask of which slots
// were unknown, so the 0 that holds a place is never read back as a measurement.

export const SLOTS = 22; export const PER_ROW = 11;
export const UNKNOWN = '◻︎';
export type Cell = number | null; // null = unknown

const isBlank = (s: string) => /^\s*$/.test(s) || /^\s*◻︎?\s*$/.test(s);

/** Read the strip text (rows split by newlines, slots by "|"; a trailing "|" is allowed). */
export function parseStrip(text: string): Cell[] {
  const cells: Cell[] = [];
  for (const row of text.split('\n').filter((r) => r.trim())) {
    const parts = row.split('|'); if (parts.length > 1 && parts[parts.length - 1].trim() === '') parts.pop();
    for (const p of parts) { if (isBlank(p)) cells.push(null); else { const v = Number(p.trim()); if (!Number.isFinite(v)) throw new Error(`not a number: "${p}"`); cells.push(v); } }
  }
  return cells;
}

/** Write the strip back with separators, PER_ROW slots per row. */
export function formatStrip(cells: Cell[], perRow = PER_ROW): string {
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += perRow) rows.push(`${cells.slice(i, i + perRow).map((c) => (c === null ? UNKNOWN : String(c))).join('|')}|`);
  return rows.join('\n');
}

/** What happens if you just delete the separators: blanks vanish and positions are lost. */
export function collapse(cells: Cell[]): string { return cells.filter((c) => c !== null).join(''); }

/** True when deleting the separators would lose positions (some slot is blank). */
export const losesPositions = (cells: Cell[]) => cells.some((c) => c === null);

/**
 * Pack without separators but without losing anything: every slot is written (unknown as 0, the
 * place holder) and a mask says which zeros were placeholders. Values are fixed-width digits.
 */
export function pack(cells: Cell[], width = 1): { digits: string; unknownMask: boolean[] } {
  const digits = cells.map((c) => {
    const v = c === null ? 0 : c; if (!Number.isInteger(v) || v < 0 || String(v).length > width) throw new Error(`slot value ${v} does not fit ${width} digit(s)`);
    return String(v).padStart(width, '0');
  }).join('');
  return { digits, unknownMask: cells.map((c) => c === null) };
}
export function unpack(p: { digits: string; unknownMask: boolean[] }, width = 1): Cell[] {
  return p.unknownMask.map((u, i) => (u ? null : Number(p.digits.slice(i * width, (i + 1) * width))));
}

/** The camera angle a slot belongs to: azimuth in degrees and one of four elevations (as in glassKnot). */
export function slotAngle(slot: number, n = SLOTS) {
  return { azimuthDeg: ((slot / n) * 360 + 22.5) % 360, elevation: (['front', 'above', 'low', 'overhead'] as const)[slot % 4] };
}
