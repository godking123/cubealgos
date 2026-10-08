// Slot geometry mirrors CubeState: corners URF UFL ULB UBR DFR DLF DBL DRB,
// edges UR UF UL UB DR DF DL DB FR FL BL BR
export const CORNER_POS = [[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1],[1,-1,1],[-1,-1,1],[-1,-1,-1],[1,-1,-1]];
export const EDGE_POS   = [[1,1,0],[0,1,1],[-1,1,0],[0,1,-1],[1,-1,0],[0,-1,1],[-1,-1,0],[0,-1,-1],[1,0,1],[-1,0,1],[-1,0,-1],[1,0,-1]];
export const CENTRE_POS = [[0,1,0],[1,0,0],[0,0,1],[0,-1,0],[-1,0,0],[0,0,-1]];
export const CORNER_FACES = [[0,1,2],[0,2,4],[0,4,5],[0,5,1],[3,2,1],[3,4,2],[3,5,4],[3,1,5]];
export const EDGE_FACES   = [[0,1],[0,2],[0,4],[0,5],[3,1],[3,2],[3,4],[3,5],[2,1],[2,4],[5,4],[5,1]];
export const CORNER_NAMES = ['URF','UFL','ULB','UBR','DFR','DLF','DBL','DRB'];
export const EDGE_NAMES   = ['UR','UF','UL','UB','DR','DF','DL','DB','FR','FL','BL','BR'];
export const FACE_CLASS   = ['u','r','f','d','l','b'];
export const FACE_LETTER  = 'URFDLB';
export const COLOR_NAMES  = ['white','red','green','yellow','orange','blue'];
export const COLOR_VARS   = COLOR_NAMES.map(c => `var(--${c})`);
export const PATTERN_VARS = COLOR_NAMES.map(c => `var(--p-${c})`);
export const AXIS_OF_FACE: Record<string, [number, string, number]> =
  { U: [1,'Y',-1], D: [1,'Y',1], R: [0,'X',1], L: [0,'X',-1], F: [2,'Z',1], B: [2,'Z',-1] };
export const ROT_FACE: Record<string, string> = { x: 'R', y: 'U', z: 'F' };
export const GAP = 60;  // Cubies Touch, Tile Borders Draw the Lines
export const HOME_ORBIT = { x: -28, y: -38 };
// The camera stays front-centric: F, R and U are in view from home, and a hidden
// face only gets a lean that keeps the front in front while its layer shows
export const PEEK_OF_FACE: Record<string, { x: number; y: number }> =
  { L: { x: -28, y: 24 }, B: { x: -56, y: -38 }, D: { x: 14, y: -38 } };
export const MOVE_RE = /^([URFDLB](2|')?|[xyz](2|')?)$/;

// Tempo 0 to 100: turn time falls from 900ms to nothing, the pause between moves
// with it; the names are the bands the slider's ticks mark
export const TEMPO_NAMES = ['Learn', 'Slow', 'Normal', 'Fast', 'Instant'];
export function tempoOf(v: number) {
  const k = Math.pow(1 - v / 100, 1.7);
  return { turn: Math.round(900 * k), gap: Math.round(1100 * k),
           name: v >= 100 ? 'Instant' : TEMPO_NAMES[Math.min(3, Math.floor(v / 25))] };
}
export const SCRAMBLE_TEMPO = { turn: 110, gap: 20 };

export type Kind = 'c' | 'e' | 'm';

// Every Cubie the Viewport Draws, Corners Then Edges Then Centres
export const CUBIES: { kind: Kind; idx: number; pos: number[] }[] = [
  ...CORNER_POS.map((pos, idx) => ({ kind: 'c' as Kind, idx, pos })),
  ...EDGE_POS.map((pos, idx) => ({ kind: 'e' as Kind, idx, pos })),
  ...CENTRE_POS.map((pos, idx) => ({ kind: 'm' as Kind, idx, pos })),
];

// One Engine Snapshot, as Engine.cc's snapshot() Writes It
export interface Snap {
  cp: number[]; co: number[]; ep: number[]; eo: number[];
  hold: string; faces: number[]; corners: number[][]; edges: number[][];
  solved: boolean; cross: boolean; pairs: boolean[]; f2l: boolean; oll: boolean;
  history: number;
}

export const pad3 = (n: number) => String(n).padStart(3, '0');
export const ease = (t: number) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
export const wrap = (a: number) => ((a + 540) % 360) - 180;
export const clampX = (x: number) => Math.max(-88, Math.min(88, x));

// A face's normal in the cubie's frame, through the orbit, tells whether that face
// is turned toward the camera
const NORMALS = [[0,-1,0],[1,0,0],[0,0,1],[0,1,0],[-1,0,0],[0,0,-1]];
const RAD = Math.PI / 180;
const rotX = (v: number[], a: number) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c]; };
const rotY = (v: number[], a: number) => { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c + v[2]*s, v[1], -v[0]*s + v[2]*c]; };
export function faceVisible(orbit: { x: number; y: number }, letter: string) {
  const n = NORMALS[FACE_LETTER.indexOf(letter)];
  return rotX(rotY(n, orbit.y * RAD), orbit.x * RAD)[2] > 0.3;
}

// Every Corner and Edge Sticker With Its Cubie Position and Face
export function stickersOf(s: Snap) {
  const out: { pos: number[]; face: number; color: number }[] = [];
  CORNER_POS.forEach((p, i) => CORNER_FACES[i].forEach((f, k) => out.push({ pos: p, face: f, color: s.corners[i][k] })));
  EDGE_POS.forEach((p, i) => EDGE_FACES[i].forEach((f, k) => out.push({ pos: p, face: f, color: s.edges[i][k] })));
  return out;
}

// Colour per face slot of one cubie, null where the face is inside the cube
export function cubieColors(s: Snap, kind: Kind, idx: number) {
  const by: (number | null)[] = [null, null, null, null, null, null];
  if (kind === 'c') CORNER_FACES[idx].forEach((f, k) => by[f] = s.corners[idx][k]);
  else if (kind === 'e') EDGE_FACES[idx].forEach((f, k) => by[f] = s.edges[idx][k]);
  else by[idx] = s.faces[idx];
  return by;
}
