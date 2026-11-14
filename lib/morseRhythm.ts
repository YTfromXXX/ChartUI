// The left-brain symbols as a rhythm: each symbol becomes a tone (1) or a silence (0) of some units.
// Morse timing (unit = 1.2 / WPM seconds): '.' 1 on, '-' 3 on, a 1-unit gap between tones, '/' 3 off.
// Our own marks (agreed in the TEXTBOX notation): '{}' an empty frame (7 off), '||' or '‖' a frame end
// (7 off), '*' one beat from outside (a kick, 1 on, accented), '=' a held tone (2 on, tied to the next '=').
// Braces on their own, spaces and newlines are markers only (0 time).
export type Seg = { on: boolean; units: number; sym: string; accent?: boolean };

export function parseSymbols(src: string): Seg[] {
  const segs: Seg[] = []; const s = src.normalize('NFKC').replace(/‖/g, '||');
  const tone = (units: number, sym: string, accent = false) => {
    const last = segs[segs.length - 1];
    if (sym === '=' && last?.on && last.sym.endsWith('=')) { last.units += units; last.sym += '='; return; } // a tie
    if (last?.on) segs.push({ on: false, units: 1, sym: '' }); // gap inside a letter
    segs.push({ on: true, units, sym, accent });
  };
  const rest = (units: number, sym: string) => { const last = segs[segs.length - 1]; if (last && !last.on) { last.units = Math.max(last.units, units); last.sym += sym; } else segs.push({ on: false, units, sym }); };
  for (let k = 0; k < s.length; k += 1) {
    const c = s[k]; const two = s.slice(k, k + 2);
    if (two === '{}') { rest(7, '{}'); k += 1; continue; }
    if (two === '||') { rest(7, '||'); k += 1; continue; }
    if (c === '.') tone(1, '.');
    else if (c === '-') tone(3, '-');
    else if (c === '=') tone(2, '=');
    else if (c === '*') tone(1, '*', true);
    else if (c === '/') rest(3, '/');
  }
  return segs;
}

const MORSE: Record<string, string> = { '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9' };
/** A plain reading of the dots and dashes between '/' marks (unknown groups shown as ?). */
export const readMorse = (src: string) => src.normalize('NFKC').replace(/‖/g, '||').split(/\/|\{\}|\|\||\s+/).map((g) => g.replace(/[^.-]/g, '')).filter(Boolean).map((g) => MORSE[g] ?? `?(${g})`).join(' ');

export const unitSec = (wpm: number) => 1.2 / wpm;
export const totalUnits = (segs: Seg[]) => segs.reduce((a, g) => a + g.units, 0);
