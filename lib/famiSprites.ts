// Famicom-style shared parts: small pixel sprites on a limited palette.
// One character per pixel; '.' is transparent. Rows shorter than the sprite width are
// padded, so the art stays readable in source.

export const FAMI_PALETTE: Record<string, string> = {
  k: '#000000', w: '#ffffff', r: '#d6001c', d: '#7a0f22', p: '#ff4fa3', b: '#2b8cf0', i: '#2b8cf0', j: '#1a4f9c', c: '#7fc4ff',
  y: '#ffd400', o: '#ff8c1a', g: '#2fbf4a', s: '#f2b48a', h: '#d9946b', n: '#e3a179', q: '#c07a55', u: '#f7caa8',
  l: '#cfcfcf', m: '#e040fb', e: '#5a3a22',
};

export type Sprite = { name: string; label: string; rows: string[] };

const sprite = (name: string, label: string, rows: string[]): Sprite => {
  const width = Math.max(...rows.map((r) => r.length));
  return { name, label, rows: rows.map((r) => r.padEnd(width, '.')) };
};

export const SPRITES = {
  dancer: sprite('dancer', 'ダンサー', [
    '....rrrr....', '...rrrrrr...', '...ssssss...', '...skssks...', '...ssssss...', '....ssss....',
    '..pppppppp..', '.s.pppppp.s.', '...pppppp...', '...bbbbbb...', '...bb..bb...', '..kkk..kkk..',
  ]),
  vet: sprite('vet', '獣医師', [
    '....kkkk....', '...kkkkkk...', '...ssssss...', '...skssks...', '...ssssss...', '....ssss....',
    '..wwwwwwww..', '.s.wwgwww.s.', '...wwgwww...', '...bbbbbb...', '...bb..bb...', '..kkk..kkk..',
  ]),
  yoga: sprite('yoga', 'ヨガ', [
    '.....ss.....', '....ssss....', '.s..ssss..s.', '..s.mmmm.s..', '...smmmms...', '....mmmm....',
    '....mmmm....', '....kkkk....', '....kk.kk...', '....kk..kk..', '....kk.kk...', '...kkk......',
  ]),
  cat: sprite('cat', 'ハチワレ', [
    '.r........r.', '.rr......rr.', '.rrrrrrrrrr.', 'rrrrrwwrrrrr', 'rrkrwwwwrkrr', 'rrrwwwwwwrrr',
    'rrwwwppwwwrr', '.rwwwwwwwwr.', '..rrrrrrrr..', '..rr....rr..', '..rr....rr..',
  ]),
  flower: sprite('flower', '花', [
    '....pp......', '...pyyp.....', '....pp..pp..', '.....g.pyyp.', '..pp.g..pp..', '.pyypg..g...',
    '..pp.g.g....', '.....gg.....', '....ggg.....', '...ooooo....', '...ooooo....', '....ooo.....',
  ]),
  sneaker: sprite('sneaker', 'スニーカー', [
    '............', '......kkk...', '.....kwwk...', '....kwrwk...', '...kwrrwkk..', '..kwwwwwwwk.',
    '.kwrwrwrwwwk', '.kwwwwwwwwwk', '.kkkkkkkkkkk', '.llllllllll.',
  ]),
  eye: sprite('eye', '眼球', [
    '...kkkkkk...', '..kwwwwwwk..', '.kwwcbbbwwk.', 'kwwcbjjbbwwk', 'kwwbjkkjbwwk', 'kwwbjkkjbwwk', '.kwwbbbbwwk.', '..kwwwwwwk..', '...kkkkkk...',
  ]),
  nose: sprite('nose', '鼻', [
    '.....uu.....', '.....nn.....', '....unnn....', '....nnnn....', '...unnnnq...', '..unnnnnnq..', '..nqknnkqn..', '...nnnnnn...',
  ]),
  skull: sprite('skull', '骸骨', [
    '...wwwwww...', '..wwwwwwww..', '.wwwwwwwwww.', '.wwkkwwkkww.', '.wwkkwwkkww.', '.wwwwkkwwww.', '..wwwwwwww..', '...wkwkwk...', '...wwwwww...',
  ]),
  obaa: sprite('obaa', '老婆', [
    '....llll....', '...llllll...', '...lsssslk..', '...skssks...', '...ssssss...', '....ssss....', '..kkkkkkkk..', '.s.kkkkkk.s.', '...kkkkkk...', '...kkkkkk...', '...ll..ll...',
  ]),
  heart: sprite('heart', 'LIFE', ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...']),
} satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof SPRITES;

/** 16 × 16 face for the eye → nose colour transplant. i/j/c = iris, n/q/u = nose. */
export const FACE = sprite('face', '顔', [
  '....eeeeeeee....', '...eeeeeeeeee...', '..eessssssssee..', '..esssssssssse..', '..sssssssssssss.',
  '.sskkkkssskkkkss', '.skwcijwskwcijws', '.skwjikwskwjikws', '.sskkkkssskkkkss', '.ssssssussssssss',
  '.sssssunnsssssss', '.ssssunnnqssssss', '..sssqnknqsssss.', '..ssssssssssss..', '...ssssrrrssss..', '....ssssssss....',
]);

export const IRIS = new Set(['i', 'j', 'c']);
export const NOSE = new Set(['n', 'q', 'u']);
