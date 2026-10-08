import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COLOR_VARS, CORNER_POS, EDGE_POS, FACE_LETTER, PATTERN_VARS, stickersOf, type Snap } from '../cube';
import { sim, useSim, type Group } from '../sim';

// Case Card
//
// An OLL or PLL step shows the case it solves in the corner of the viewport: the U
// layer as it stood when the step began, drawn top down the way the alg is learnt. It
// fades in as the step starts and out as it ends, so it never describes a state gone
//
// A new step fades the old card out before the next one fades in
export function CaseCard() {
  const s = useSim();
  const cs = s.caseStep();
  const g = cs ? cs.g : null;
  const [shown, setShown] = useState<{ g: Group; kind: 'oll' | 'pll' } | null>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  // The alg keeps the last position it showed while it fades out
  const at = useRef({ i: 0, live: false });
  if (cs && shown && cs.g === shown.g) at.current = { i: cs.i, live: s.following() };

  useEffect(() => {
    let timer = 0, raf = 0;
    const show = () => {
      const now = sim.caseStep();
      if (!now) return;
      at.current = { i: now.i, live: sim.following() };
      setShown({ g: now.g, kind: now.kind });
      setVisible(true);
    };
    if (visibleRef.current) { setVisible(false); timer = window.setTimeout(show, 380); }
    else if (g) raf = requestAnimationFrame(show);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [g]);

  return (
    <div id="caseCard" className={visible ? 'show' : ''}>
      {shown && shown.g.startSnap && <>
        <div className="cc-top">{shown.g.label}</div>
        <div className="cc-name">{shown.g.caseName || (shown.kind === 'pll' ? 'AUF only' : '')}</div>
        <div className="cc-fig"><LastLayer s={shown.g.startSnap} kind={shown.kind} /></div>
        <div className="cc-alg">
          {shown.g.tokens.map((t, j) => (
            <span key={j} className={'tok' + (j < at.current.i ? ' done' : j === at.current.i && at.current.live ? ' next' : '')}>{t}</span>
          ))}
        </div>
      </>}
    </div>
  );
}

// Top view of the U layer on a 5 by 5 grid, side stickers as the border strips
// OLL shows only where the U colour is, PLL shows every colour and where pieces go
function LastLayer({ s, kind }: { s: Snap; kind: 'oll' | 'pll' }) {
  const up = s.faces[0];
  const cells: Record<string, { c: number; top: boolean }> = { '2,2': { c: up, top: true } };
  for (const st of stickersOf(s)) {
    const [x, y, z] = st.pos, F = FACE_LETTER[st.face];
    if (y !== 1) continue;
    const at = ({ U: [z + 2, x + 2], B: [0, x + 2], F: [4, x + 2], L: [z + 2, 0], R: [z + 2, 4] } as Record<string, number[]>)[F];
    if (at) cells[at.join()] = { c: st.color, top: F === 'U' };
  }
  const tiles = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const cell = cells[r + ',' + c];
    const show = cell && (kind === 'pll' || cell.c === up);
    if (show) tiles.push(<i key={r * 5 + c} className="st" style={{ '--c': COLOR_VARS[cell.c], '--p': PATTERN_VARS[cell.c] } as CSSProperties} />);
    else tiles.push(<i key={r * 5 + c} className={cell && cell.top ? 'st grey' : undefined} />);
  }
  return <div className="ll">{tiles}{kind === 'pll' && <PllArrows s={s} />}</div>;
}

// One arrow per piece out of place, from its slot to its home; a swap is one line
// headed at both ends
function PllArrows({ s }: { s: Snap }) {
  const at = (p: number[]) => [15 + (p[0] + 1) * 32, 15 + (p[2] + 1) * 32];
  const lines: [number[], number[], boolean][] = [];
  const add = (POS: number[][], perm: number[]) => {
    for (let i = 0; i < 4; i++) {
      const j = perm[i];
      if (j === i || j > 3) continue;
      const both = perm[j] === i;
      if (both && j < i) continue;
      lines.push([at(POS[i]), at(POS[j]), both]);
    }
  };
  add(CORNER_POS, s.cp); add(EDGE_POS, s.ep);
  return (
    <svg viewBox="0 0 94 94" fill="none">
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#000" />
        </marker>
      </defs>
      {lines.map(([a, b, both], k) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len * 7, uy = dy / len * 7;
        const d = `M${a[0] + ux} ${a[1] + uy}L${b[0] - ux} ${b[1] - uy}`;
        return <g key={k}>
          <path d={d} stroke="#fff" strokeWidth={5} />
          <path d={d} stroke="#000" strokeWidth={2.2} markerEnd="url(#ah)" markerStart={both ? 'url(#ah)' : undefined} />
        </g>;
      })}
    </svg>
  );
}
