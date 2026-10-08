import type { CSSProperties } from 'react';
import { COLOR_VARS, FACE_LETTER, PATTERN_VARS, stickersOf, type Snap } from '../cube';

// Where each face sits in the unfolded cube, in face units: U above, L F R B across, D below
const AT: Record<string, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };

// Row and column of a sticker within its face, each face seen from outside the cube
// and the side faces upright, as a scramble net is drawn
function cell(face: string, [x, y, z]: number[]): [number, number] {
  switch (face) {
    case 'U': return [z + 1, x + 1];
    case 'D': return [1 - z, x + 1];
    case 'F': return [1 - y, x + 1];
    case 'B': return [1 - y, 1 - x];
    case 'R': return [1 - y, 1 - z];
    default:  return [1 - y, z + 1];
  }
}

// The scrambled cube unfolded, white on top and green in front
export function Net({ s, size = 11 }: { s: Snap; size?: number }) {
  const tiles: { key: string; col: number; row: number; c: number }[] = [];
  for (const st of stickersOf(s)) {
    const F = FACE_LETTER[st.face], [r, c] = cell(F, st.pos), [fx, fy] = AT[F];
    tiles.push({ key: `${F}${r}${c}`, col: fx * 3 + c, row: fy * 3 + r, c: st.color });
  }
  for (let f = 0; f < 6; f++) {
    const [fx, fy] = AT[FACE_LETTER[f]];
    tiles.push({ key: FACE_LETTER[f] + 'c', col: fx * 3 + 1, row: fy * 3 + 1, c: s.faces[f] });
  }
  return (
    <div className="net" style={{ '--t': size + 'px' } as CSSProperties} role="img" aria-label="Scrambled cube, unfolded">
      {tiles.map(t => (
        <i key={t.key} style={{ gridColumn: t.col + 1, gridRow: t.row + 1, '--c': COLOR_VARS[t.c], '--p': PATTERN_VARS[t.c] } as CSSProperties} />
      ))}
    </div>
  );
}
