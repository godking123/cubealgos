import { useEffect, useRef, useState } from 'react';
import { timer, useTimer } from '../timer/timer';
import { STAGES, fmt } from '../timer/stats';
import { OPPOSITE, TYPICAL_SHARE, crossLook, sessionInsights, stageSummary } from '../timer/insights';
import { CrossBars, Histogram, SplitBars, TrendChart } from '../components/Charts';
import { InsightList } from '../components/SolveDetail';

const RANGES = [{ n: 50, name: 'Last 50' }, { n: 100, name: 'Last 100' }, { n: 0, name: 'All' }];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Session statistics and coaching: where the time goes and what to practise next
export function StatsPage() {
  const t = useTimer();
  const [range, setRange] = useState(100);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  // Cross analysis needs every scramble through the engine once; it runs in the
  // background and each result is stored with its solve
  useEffect(() => { if (t.loaded) timer.analyzeAll(); }, [t.loaded, t.sessionId, t.solves.length]);

  const st = t.stats, n = st.count;
  const from = range && n > range ? n - range : 0;
  const color = t.settings.cross;
  const splits = stageSummary(t.solves);
  const analysed = t.solves.filter(s => s.analysis);
  const looks = analysed.map(s => crossLook(s.analysis!, color));
  const avgLen = Object.fromEntries(['white', 'yellow', 'green', 'blue', 'red', 'orange'].map(c => [c,
    analysed.length ? analysed.reduce((a, s) => a + s.analysis!.crosses.find(x => x.color === c)!.moves.length, 0) / analysed.length : 0]));
  const avg = (f: (l: ReturnType<typeof crossLook>) => number) => looks.length ? looks.reduce((a, l) => a + f(l), 0) / looks.length : 0;
  const insights = sessionInsights(t.solves, color);
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
      <select value={t.sessionId} onChange={e => timer.selectSession(e.target.value)} aria-label="Session">
        {t.sessions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
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
            {tile('Mean', st.mean)}
            {tile('Std dev', st.sd)}
          </div>

          <div className="panel span2">
            <div className="ph">
              <div><div className="lbl">Times</div><div className="legend">
                <span><i className="k dot" />single</span><span><i className="k s1" />ao5</span><span><i className="k s2" />ao12</span>
              </div></div>
              <div className="seg-ctl" role="group" aria-label="Range">
                {RANGES.map(r => <button key={r.n} className={range === r.n ? 'on' : ''} onClick={() => setRange(r.n)}>{r.name}</button>)}
              </div>
            </div>
            <TrendChart results={st.results.slice(from)} ao5={st.ao5.slice(from)} ao12={st.ao12.slice(from)} offset={from} />
          </div>

          <div className="panel">
            <div className="lbl">Distribution</div>
            <Histogram results={st.results.slice(from)} />
          </div>

          <div className="panel span2 coach">
            <div className="lbl">What to work on</div>
            <InsightList items={insights} />
          </div>

          <div className="panel">
            <div className="lbl">Stage splits</div>
            {splits ? <>
              <SplitBars rows={[{ label: 'Your average', times: splits.avg }]} />
              <table className="data">
                <thead><tr><th>Stage</th><th>Avg</th><th>Best</th><th>Share</th><th>Typical</th></tr></thead>
                <tbody>{STAGES.map((s, i) => (
                  <tr key={s}><td>{s}</td><td>{fmt(splits.avg[i])}</td><td>{fmt(splits.best[i])}</td>
                    <td className={splits.share[i] - TYPICAL_SHARE[i] > 0.04 ? 'worse' : ''}>{Math.round(splits.share[i] * 100)}%</td>
                    <td>{Math.round(TYPICAL_SHARE[i] * 100)}%</td></tr>
                ))}</tbody>
              </table>
            </> : <div className="empty">Turn on stage splits in the timer.</div>}
          </div>

          <div className="panel">
            <div className="lbl">Optimal cross, avg moves</div>
            {analysed.length ? <>
              <CrossBars lengths={avgLen} mark={color === 'neutral' ? undefined : color} />
              <div className="kv">
                {color !== 'neutral' && <span>{color} <b>{avg(l => l.pref).toFixed(2)}</b></span>}
                {color !== 'neutral' && <span>+{OPPOSITE[color]} <b>{avg(l => l.dual).toFixed(2)}</b></span>}
                <span>any colour <b>{avg(l => l.best).toFixed(2)}</b></span>
              </div>
            </> : <div className="empty">Analysing...</div>}
          </div>
        </>}
      </section>
    </main>
  </>;
}
