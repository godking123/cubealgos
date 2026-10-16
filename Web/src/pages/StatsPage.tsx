import { useEffect, useMemo, useRef, useState } from 'react';
import { timer, useTimer } from '../timer/timer';
import type { Solve } from '../timer/db';
import { fmt, sessionStats } from '../timer/stats';
import { OPPOSITE, crossLook, stageSummary } from '../timer/insights';
import { HAS_CROSS, METHOD_STAGES } from '../timer/profile';
import { CrossBars, Histogram, SplitBars, TrendChart, type TrendLines } from '../components/Charts';

const RANGES = [{ n: 50, name: 'Last 50' }, { n: 100, name: 'Last 100' }, { n: 0, name: 'All' }];
const ALL = '*';  // Scope Value for Every Session at Once
const NONE: Solve[] = [];

// Which Trend Lines Are Drawn, Remembered per Browser
function useLines(): [TrendLines, (k: keyof TrendLines) => void] {
  const [lines, setLines] = useState<TrendLines>(() => {
    try { return { single: true, ao5: true, ao12: true, ...JSON.parse(localStorage.getItem('stats.lines') || '{}') }; }
    catch { return { single: true, ao5: true, ao12: true }; }
  });
  const toggle = (k: keyof TrendLines) => setLines(l => {
    const next = { ...l, [k]: !l[k] };
    try { localStorage.setItem('stats.lines', JSON.stringify(next)); } catch { /* Private Window */ }
    return next;
  });
  return [lines, toggle];
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Session statistics: times over one session or all of them, each session's bests side
// by side, and on request the spread, stage splits and optimal cross lengths
export function StatsPage() {
  const t = useTimer();
  const [range, setRange] = useState(100);
  const [msg, setMsg] = useState('');
  const [more, setMore] = useState(false);
  const [scope, setScope] = useState(t.sessionId);
  const [lines, toggleLine] = useLines();
  const file = useRef<HTMLInputElement>(null);
  const all = scope === ALL;

  // Every session's solves back the sessions table and the all sessions view. They are
  // reread when the current session gains, loses or re-penalises a solve; analyses
  // land in place, so they need no reread
  const changed = t.solves.map(s => s.penalty[0]).join('');
  useEffect(() => { if (t.loaded) timer.loadEverything(); }, [t.loaded, t.sessionId, t.sessions.length, changed]);
  const solves = all ? t.everything ?? NONE : t.solves;

  // Cross analysis needs every scramble through the engine once; it runs in the
  // background and each result is stored with its solve
  useEffect(() => { if (t.loaded) timer.analyzeAll(solves); }, [t.loaded, scope, t.sessionId, solves.length]);

  const st = useMemo(() => all ? sessionStats(solves) : t.stats, [all, solves, t.stats]);
  const n = st.count;
  const from = range && n > range ? n - range : 0;
  const color = t.crossColor(), hasCross = HAS_CROSS[t.profile.method];
  const stages = METHOD_STAGES[t.profile.method];
  const splits = stageSummary(solves, t.profile.method);
  const analysed = solves.filter(s => s.analysis);
  const looks = analysed.map(s => crossLook(s.analysis!, color));
  const avgLen = Object.fromEntries(['white', 'yellow', 'green', 'blue', 'red', 'orange'].map(c => [c,
    analysed.length ? analysed.reduce((a, s) => a + s.analysis!.crosses.find(x => x.color === c)!.moves.length, 0) / analysed.length : 0]));
  const avg = (f: (l: ReturnType<typeof crossLook>) => number) => looks.length ? looks.reduce((a, l) => a + f(l), 0) / looks.length : 0;
  const busy = t.analyzing.total > 0 && t.analyzing.done < t.analyzing.total;
  const tile = (label: string, v: number | null, sub?: string) => (
    <div className="tile"><div className="lbl">{label}</div><div className="tv">{fmt(v)}</div>{sub && <div className="ts">{sub}</div>}</div>
  );

  const onImport = async (f: File) => {
    try { setMsg(`Imported ${await timer.importJson(await f.text())} solves`); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Import failed'); }
  };
  return <>
    <div id="scrambleBar" className="toolbar">
      <select value={all ? ALL : t.sessionId} aria-label="Session"
              onChange={e => { setScope(e.target.value); if (e.target.value !== ALL) timer.selectSession(e.target.value); }}>
        {t.sessions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        {t.sessions.length > 1 && <option value={ALL}>All sessions</option>}
      </select>
      <span className="tb-info">{n} solves{busy ? ` · analysing ${t.analyzing.done}/${t.analyzing.total}` : ''}{msg && ` · ${msg}`}</span>
      <span className="sbtns">
        <button onClick={async () => download('cubealgos-solves.json', await timer.exportAll())}>Export</button>
        <button onClick={() => file.current?.click()}>Import</button>
        <input ref={file} type="file" accept="application/json,.json" hidden
               onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
      </span>
    </div>
    <main id="main" className="stats">
      <section className="board">
        {!n ? <div className="empty big">No solves yet. <a href="#/">Start timing &rarr;</a></div> : <>
          <div className="tiles">
            {tile('Best single', st.bestSingle)}
            {tile('Best ao5', st.bestAo5, `current ${fmt(st.current.ao5)}`)}
            {tile('Best ao12', st.bestAo12, `current ${fmt(st.current.ao12)}`)}
            {tile('Mean', st.mean, `σ ${fmt(st.sd)}`)}
          </div>

          <div className="panel wide">
            <div className="ph">
              <div><div className="lbl">Times</div><div className="legend">
                {([['single', 'dot'], ['ao5', 's1'], ['ao12', 's2']] as const).map(([k, c]) => (
                  <button key={k} className={'lg' + (lines[k] ? '' : ' off')} aria-pressed={lines[k]}
                          title={(lines[k] ? 'Hide ' : 'Show ') + k} onClick={() => toggleLine(k)}><i className={'k ' + c} />{k}</button>
                ))}{st.dnfs > 0 && <span><b className="k-dnf">×</b>DNF</span>}
              </div></div>
              <div className="seg-ctl" role="group" aria-label="Range">
                {RANGES.map(r => <button key={r.n} className={range === r.n ? 'on' : ''} onClick={() => setRange(r.n)}>{r.name}</button>)}
              </div>
            </div>
            <TrendChart results={st.results.slice(from)} ao5={st.ao5.slice(from)} ao12={st.ao12.slice(from)} offset={from} show={lines} />
          </div>

          {t.sessions.length > 1 && t.everything && <Sessions solves={t.everything} scope={scope}
            pick={id => { setScope(id); if (id !== ALL) timer.selectSession(id); }} />}

          <button className="wide-btn more" onClick={() => setMore(!more)} aria-expanded={more}>
            {more ? 'Fewer stats' : `More stats: distribution, stage splits${hasCross ? ', cross' : ''}`}
          </button>

          {more && <>
            <div className="panel">
              <div className="lbl">Distribution</div>
              <Histogram results={st.results.slice(from)} />
            </div>

            <div className="panel">
              <div className="lbl">Stage splits</div>
              {splits ? <>
                <SplitBars stages={stages} rows={[{ label: 'Your average', times: splits.avg }]} />
                <table className="data">
                  <thead><tr><th>Stage</th><th>Avg</th><th>Best</th><th>Share</th></tr></thead>
                  <tbody>{stages.map((s, i) => (
                    <tr key={s}><td>{s}</td><td>{fmt(splits.avg[i])}</td><td>{fmt(splits.best[i])}</td>
                      <td>{Math.round(splits.share[i] * 100)}%</td></tr>
                  ))}</tbody>
                </table>
                <p className="note">From your taps while solving, over {splits.n} solves with splits</p>
              </> : <div className="empty">Turn on stage splits in the timer settings, then tap once as you finish
                {' '}{stages.slice(0, 3).join(', ')}. Splits count toward the method set in your <a href="#/profile">profile</a>.</div>}
            </div>

            {hasCross && <div className="panel">
              <div className="lbl">Optimal cross, avg moves</div>
              {analysed.length ? <>
                <CrossBars lengths={avgLen} mark={color === 'neutral' ? undefined : color} />
                <div className="kv">
                  {color !== 'neutral' && <span>{color} <b>{avg(l => l.pref).toFixed(2)}</b></span>}
                  {color !== 'neutral' && <span>+{OPPOSITE[color]} <b>{avg(l => l.dual).toFixed(2)}</b></span>}
                  <span>any colour <b>{avg(l => l.best).toFixed(2)}</b></span>
                </div>
                {!t.profile.cross && <p className="note">Set your cross colour in your <a href="#/profile">profile</a> to compare against it</p>}
              </> : <div className="empty">Analysing...</div>}
            </div>}
          </>}
        </>}
      </section>
    </main>
  </>;
}

// One line per session and one for every solve together, so sessions compare at a
// glance; a line opens that scope above
function Sessions({ solves, scope, pick }: { solves: Solve[]; scope: string; pick: (id: string) => void }) {
  const t = useTimer();
  const rows = useMemo(() => [
    ...t.sessions.map(x => ({ id: x.id, name: x.name, st: sessionStats(solves.filter(s => s.session === x.id)) })),
    { id: ALL, name: 'All sessions', st: sessionStats(solves) },
  ], [t.sessions, solves]);
  return (
    <div className="panel wide">
      <div className="lbl">Sessions</div>
      <div className="scroll-x">
        <table className="data sessions">
          <thead><tr><th>Session</th><th>Solves</th><th>Best</th><th>ao5</th><th>ao12</th><th>ao100</th><th>Mean</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className={(r.id === scope ? 'on' : '') + (r.id === ALL ? ' total' : '')}
                onClick={() => pick(r.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') pick(r.id); }}>
              <td>{r.name}</td><td>{r.st.count}</td><td>{fmt(r.st.bestSingle)}</td><td>{fmt(r.st.bestAo5)}</td>
              <td>{fmt(r.st.bestAo12)}</td><td>{fmt(r.st.bestAo100)}</td><td>{fmt(r.st.mean)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
