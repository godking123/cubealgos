import { useEffect, useState } from 'react';
import { timer, useTimer } from '../timer/timer';
import type { Analysis, Penalty } from '../timer/db';
import { STAGES, fmt, fmtSolve, stageTimes } from '../timer/stats';
import { crossLook, solveInsights, stageSummary, type Insight } from '../timer/insights';
import { sim } from '../sim';
import { CrossBars, SplitBars } from './Charts';
import { Net } from './Net';

export function InsightList({ items }: { items: Insight[] }) {
  if (!items.length) return <div className="empty">Nothing stands out yet</div>;
  return (
    <ul className="insights">
      {items.map((x, i) => (
        <li key={i} className={x.tone}>
          <span className="tag">{x.tone === 'focus' ? 'Fix' : x.tone === 'good' ? 'Good' : 'Note'}</span>
          <b>{x.title[0].toUpperCase() + x.title.slice(1)}</b>
          <p>{x.detail}</p>
        </li>
      ))}
    </ul>
  );
}

// One solve in full: result and penalty, the scramble, its stage splits against the
// session, and the engine's look at the scramble with a replay in the simulator
export function SolveDetail() {
  const t = useTimer();
  const idx = t.solves.findIndex(s => s.id === t.openSolve);
  const s = idx >= 0 ? t.solves[idx] : null;
  const [a, setA] = useState<Analysis | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setA(null); setFailed(false);
    if (!s) return;
    let live = true;
    timer.analysis(s.id).then(r => { if (live) { setA(r); setFailed(!r); } });
    return () => { live = false; };
  }, [s?.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') timer.open(null);
      else if (e.key === 'ArrowLeft' && idx > 0) timer.open(t.solves[idx - 1].id);
      else if (e.key === 'ArrowRight' && idx < t.solves.length - 1) timer.open(t.solves[idx + 1].id);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [idx, t.solves]);
  if (!s) return null;

  const times = stageTimes(s);
  const avg = stageSummary(t.solves);
  const color = t.settings.cross;
  const look = a ? crossLook(a, color) : null;
  const lengths = a ? Object.fromEntries(a.crosses.map(c => [c.color, c.moves.length])) : null;
  const ref = a ? a.cfop.steps : [];
  const refTotal = ref.reduce((n, x) => n + x.moves.length, 0);
  const watch = () => {
    timer.open(null);
    location.hash = '#/sim';
    sim.watch(s.scramble.split(' '));
  };
  const pen = (p: Penalty) => timer.setPenalty(s.id, p);
  return (
    <div className="modal" onMouseDown={e => { if (e.target === e.currentTarget) timer.open(null); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Solve ${idx + 1}`}>
        <div className="sheet-head">
          <div>
            <div className="lbl">Solve {idx + 1} · {new Date(s.date).toLocaleDateString()}</div>
            <div className="big-time">{fmtSolve(s)}</div>
          </div>
          <div className="row">
            {(['ok', '+2', 'dnf'] as Penalty[]).map(p => (
              <button key={p} className={s.penalty === p ? 'on' : ''} onClick={() => pen(p)}>{p === 'ok' ? 'OK' : p.toUpperCase()}</button>
            ))}
            <button onClick={() => { if (confirm('Delete this solve?')) timer.deleteSolve(s.id); }}>Delete</button>
            <button disabled={idx <= 0} onClick={() => timer.open(t.solves[idx - 1].id)} aria-label="Previous solve">&larr;</button>
            <button disabled={idx >= t.solves.length - 1} onClick={() => timer.open(t.solves[idx + 1].id)} aria-label="Next solve">&rarr;</button>
            <button onClick={() => timer.open(null)} aria-label="Close">&times;</button>
          </div>
        </div>

        <div className="sheet-grid">
          <section className="pane">
            <div className="lbl">Scramble</div>
            <div className="scr">{s.scramble}</div>
            {a && <div style={{ marginTop: 12 }}><Net s={a.state} size={13} /></div>}
          </section>

          <section className="pane">
            <div className="lbl">Takeaways</div>
            {a || failed ? <InsightList items={solveInsights(s, t.solves, a, color)} /> : <div className="empty">Analysing scramble...</div>}
          </section>

          <section className="pane wide">
            <div className="lbl">Stage splits</div>
            {times ? <>
              <SplitBars rows={[{ label: 'This solve', times }, ...(avg && avg.n > 1 ? [{ label: `Average of ${avg.n}`, times: avg.avg }] : [])]} />
              <table className="data">
                <thead><tr><th>Stage</th><th>This solve</th><th>Session avg</th><th>Diff</th></tr></thead>
                <tbody>{STAGES.map((st, i) => {
                  const d = avg ? times[i] - avg.avg[i] : null;
                  return <tr key={st}><td>{st}</td><td>{fmt(times[i])}</td><td>{avg ? fmt(avg.avg[i]) : '-'}</td>
                    <td className={d == null ? '' : d > 0 ? 'worse' : 'better'}>{d == null ? '-' : (d > 0 ? '+' : '-') + fmt(Math.abs(d))}</td></tr>;
                })}</tbody>
              </table>
            </> : <div className="empty">No splits. Turn on stage splits in the timer.</div>}
          </section>

          <section className="pane">
            <div className="lbl">Optimal cross</div>
            {lengths && look ? <>
              <CrossBars lengths={lengths} mark={color === 'neutral' ? look.bestColor : color} />
            </> : <div className="empty">{failed ? 'Could not analyse this scramble' : 'Analysing...'}</div>}
          </section>

          <section className="pane">
            <div className="lbl">CFOP reference · {refTotal} moves</div>
            {a ? <>
              <table className="data ref">
                <tbody>{ref.map((st, i) => (
                  <tr key={i}><td>{st.label}{st.case && <em> {st.case}</em>}</td><td>{st.moves.length}</td>
                    <td className="alg">{(i === 0 && a.cfop.rotation ? a.cfop.rotation + ' ' : '') + (st.moves.join(' ') || 'skip')}</td></tr>
                ))}</tbody>
              </table>
              <p className="note">The engine's solve. Its OLL/PLL may differ from yours.</p>
              <button className="wide-btn" onClick={watch}>Replay in simulator</button>
            </> : <div className="empty">Analysing...</div>}
          </section>
        </div>
        {s.penalty !== 'ok' && <div className="sheet-foot">Raw {fmt(s.time)}</div>}
      </div>
    </div>
  );
}
