import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { COLOR_NAMES, COLOR_VARS, CUBIES, FACE_CLASS, PATTERN_VARS, cubieColors } from '../cube';
import { sim, useSim } from '../sim';
import { CaseCard } from './CaseCard';

export function Viewport() {
  const s = useSim();
  const vp = useRef<HTMLElement>(null), scene = useRef<HTMLDivElement>(null), cube = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => sim.mountView(vp.current!, scene.current!, cube.current!), []);

  const { snap, plan, busy, playing } = s;
  const pieces = snap && s.opts.dim ? s.stagePieces() : new Set<string>();
  const marked = (p: { kind: string; idx: number } | null, kind: string, idx: number) => !!p && p.kind === kind && p.idx === idx;
  const pickMsg = s.pickMessage();
  const sw = (c: number) => <i className="sw" style={{ '--c': COLOR_VARS[c], '--p': PATTERN_VARS[c] } as CSSProperties} />;
  return (
    <section id="viewport" ref={vp}>
      <div className="scene" ref={scene}>
        <div className="cube" ref={cube}>
          {CUBIES.map(({ kind, idx }, i) => {
            // Transforms are written by the sim, never by React, so a re-render mid-turn
            // cannot snap a layer back
            let on = true;
            if (snap && pieces.size) {
              if (kind === 'c') on = pieces.has('c' + snap.cp[idx]);
              else if (kind === 'e') on = pieces.has('e' + snap.ep[idx]);
            }
            const colors = snap ? cubieColors(snap, kind, idx) : [null, null, null, null, null, null];
            const cls = 'cubie' + (on ? '' : ' dim') + (marked(s.picked, kind, idx) || marked(s.hover, kind, idx) ? ' picked' : '');
            return (
              <div key={i} className={cls} ref={el => sim.setCubieEl(i, el)}
                   onClick={e => { e.stopPropagation(); sim.pick(kind, idx); }}>
                {FACE_CLASS.map((f, fi) => {
                  const c = colors[fi];
                  return <div key={f} className={'face ' + f + (c != null ? ' sticker' : '')}
                              style={{ '--c': c == null ? 'var(--ink)' : COLOR_VARS[c],
                                       '--p': c == null ? 'none' : PATTERN_VARS[c] } as CSSProperties} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
      {snap && (
        <div id="viewTag">
          <span><span className="lbl">Front</span>{sw(snap.faces[2])}{COLOR_NAMES[snap.faces[2]]}</span>
          <span><span className="lbl">Up</span>{sw(snap.faces[0])}{COLOR_NAMES[snap.faces[0]]}</span>
          {s.frontAway && <span className="away">turned away</span>}
        </div>
      )}
      {snap && !(busy || playing || (plan && plan.pos > 0)) && (
        <div id="prompt">{plan ? 'Space to play' : snap.solved ? 'Space to scramble' : 'Space to solve'}</div>
      )}
      {!snap && <div id="prompt">{s.statusText === 'Offline' ? 'Engine failed to load' : 'Loading...'}</div>}
      {pickMsg && <div id="pickMsg">{pickMsg}</div>}
      <CaseCard />
      <div className="zoomctl">
        <button onClick={() => sim.setZoom(s.zoom / 1.2)} aria-label="Zoom out">&minus;</button>
        <span>{Math.round(s.zoom * 100)}%</span>
        <button onClick={() => sim.setZoom(s.zoom * 1.2)} aria-label="Zoom in">+</button>
        <button onClick={() => { sim.setZoom(1); sim.viewReset(); }} aria-label="Reset view">Reset</button>
      </div>
    </section>
  );
}
