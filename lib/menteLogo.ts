// The MENTE logo, taken apart Futura-style: each letter built from straight bars and pointed
// triangles on a 10 × 14 grid (geometric, Bauhaus-like), drawn as paths — no font file is used,
// so nothing of the Futura typeface itself is copied. A small round dot closes the word.
export const MENTE_LETTERS: string[] = [
  'M0 14L2 0H3.4L5 8.5L6.6 0H8L10 14H7.8L6.9 5.2L5.7 12H4.3L3.1 5.2L2.2 14Z',  // M: splayed legs, pointed apexes
  'M13 0H23V2.4H15.5V5.8H21V8.2H15.5V11.6H23V14H13Z',                        // E
  'M26 14V0H28.6L33.5 9.2V0H36V14H33.4L28.5 4.8V14Z',                           // N
  'M39 0H49V2.4H45.25V14H42.75V2.4H39Z',                                         // T
  'M52 0H62V2.4H54.5V5.8H60V8.2H54.5V11.6H62V14H52Z',                            // E
];
export const MENTE_VIEWBOX = '-1 -1 69 16';
export const menteLogoSvg = (ink = '#7a0f22', dot = '#c8001a') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MENTE_VIEWBOX}" role="img" aria-label="MENTE">${MENTE_LETTERS.map((d) => `<path d="${d}" fill="${ink}"/>`).join('')}<circle cx="65.5" cy="12.2" r="1.8" fill="${dot}"/></svg>`;
