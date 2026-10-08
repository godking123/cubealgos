import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { pad3, tempoOf } from '../cube';
import { STAGE_NAMES, sim, useSim, type Method, type OptKey } from '../sim';
import { Viewport } from '../components/Viewport';
import { StateArrays } from '../components/StateArrays';

// The 3D simulator: scramble, plan a CFOP or Kociemba solve, and play it move by move
export function SimPage() {
  useEffect(() => sim.bindKeys(), []);
  return <>
    <ScrambleBar />
    <main id="main">
      <LeftPanel />
      <Viewport />
      <RightPanel />
    </main>
  </>;
}

function ScrambleBar() {
  const s = useSim();
  const playing = s.scramblePos < s.scrambleMoves.length;
  return (
    <div id="scrambleBar">
      <span className="lbl">Scramble</span>
      <span id="scrambleTokens">
        {!s.scrambleMoves.length ? '---' : <>
          {s.scrambleMoves.map((t, i) => <span key={i} className={'tok' + (playing && i < s.scramblePos ? ' done' : '')}>{t}</span>)}
          <span className="n">{s.scrambleMoves.length} moves</span>
        </>}
      </span>
    </div>
  );
}

function LeftPanel() {
  const s = useSim();
  const t = tempoOf(s.tempo);
  return (
    <aside id="left">
      <div className="blk">
        <div className="lbl">Status</div>
        <div className="val big">{s.statusText}</div>
      </div>
      <div className="blk">
        <div className="lbl">Method</div>
        <select value={s.method} onChange={e => sim.setMethod(e.target.value as Method)} aria-label="Method">
          <option value="cfop">CFOP</option>
          <option value="kociemba">Kociemba</option>
        </select>
      </div>
      <div className="blk">
        <div className="lbl">Tempo</div>
        <div className="tempo-read"><b>{t.name}</b><span>{t.turn ? `${t.turn} ms / move` : 'no animation'}</span></div>
        <div className="slider">
          <input type="range" min={0} max={100} step={1} value={s.tempo} aria-label="Tempo"
                 onChange={e => sim.setTempo(+e.target.value)} />
          <div className="ticks"><span>Learn</span><span>Slow</span><span>Normal</span><span>Fast</span><span>Instant</span></div>
        </div>
      </div>
      <div className="blk">
        <div className="lbl">Turn</div>
        <div className="keys">
          {[...'URFDLB'].flatMap(f => ['', "'", '2'].map(suf => (
            <button key={f + suf} onClick={() => sim.manual([f + suf])}>{f + suf}</button>
          )))}
        </div>
        <div className="keys rot">
          {[...'xyz'].flatMap(r => ['', "'", '2'].map(suf => (
            <button key={r + suf} onClick={() => sim.manual([r + suf])}>{r + suf}</button>
          )))}
        </div>
        <CommandInput />
      </div>
      <div className="blk grow"><Log /></div>
    </aside>
  );
}

function CommandInput() {
  const [value, setValue] = useState('');
  const hist = useRef<{ lines: string[]; pos: number }>({ lines: [], pos: 0 });
  return (
    <input type="text" spellCheck={false} autoComplete="off" placeholder="R U R' U' or help"
           aria-label="Moves or command" style={{ marginTop: 6 }} value={value}
           onChange={e => setValue(e.target.value)}
           onKeyDown={e => {
             const h = hist.current;
             if (e.key === 'Enter') {
               if (value.trim()) { h.lines.push(value); h.pos = h.lines.length; }
               setValue(''); sim.runCommand(value);
             } else if (e.key === 'ArrowUp') {
               if (h.pos > 0) { h.pos--; setValue(h.lines[h.pos]); }
               e.preventDefault();
             } else if (e.key === 'ArrowDown') {
               if (h.pos < h.lines.length) { h.pos++; setValue(h.lines[h.pos] || ''); }
               e.preventDefault();
             }
           }} />
  );
}

function Log() {
  const s = useSim();
  const ref = useRef<HTMLDivElement>(null);
  const last = s.logLines.length ? s.logLines[s.logLines.length - 1].id : -1;
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [last]);
  return (
    <div id="log" ref={ref}>
      {s.logLines.map(l => <div key={l.id} className={l.cls}>{l.text}</div>)}
    </div>
  );
}

function RightPanel() {
  const s = useSim();
  const { plan, snap, playing } = s;
  const cur = snap ? s.currentStage() : null;
  const nt = s.nextToken();
  const step = !snap ? '---' : s.method === 'cfop'
    ? (cur === 'f2l' ? `F2L ${snap.pairs.filter(Boolean).length}/4` : STAGE_NAMES[cur!])
    : (snap.solved ? 'Solved' : '---');
  const mode = !snap ? 'Loading' : playing ? 'Pause' : plan ? (plan.pos ? 'Resume' : 'Play') : snap.solved ? 'Scramble' : 'Solve';
  return (
    <aside id="right">
      <div className="blk">
        <div className="lbl">Moves</div>
        <div className="val huge">{plan ? <>{pad3(plan.pos)}<small>/{pad3(plan.total)}</small></> : pad3(0)}</div>
      </div>
      <div className="blk">
        <div className="lbl">Next</div>
        <div className={'val huge' + (nt && 'xyz'.includes(nt[0]) ? ' rot' : '')} id="stNext">{nt || '---'}</div>
      </div>
      <div className="blk pair">
        <div><div className="lbl">Step</div><div className="val">{step}</div></div>
        <div><div className="lbl">Solves</div><div className="val">{pad3(s.solves)}</div></div>
      </div>
      <div className="blk grow">
        <div className="lbl">Sequence</div>
        <Sequence />
      </div>
      <div className="blk">
        <details>
          <summary>Options</summary>
          <div className="opts">
            <Toggle k="dim">Highlight step</Toggle>
            <Toggle k="grey">Grey, not fade</Toggle>
            <Toggle k="card">Case card</Toggle>
            <Toggle k="cam">Auto camera</Toggle>
            <Toggle k="idle">Idle drift</Toggle>
            <Toggle k="rgb">Colours</Toggle>
            <Toggle k="modern">Modern look</Toggle>
          </div>
        </details>
      </div>
      <div className="blk"><StateArrays /></div>
      <div className="blk">
        <button id="inputCtl" disabled={!snap} onClick={() => sim.impulse()}>{mode}</button>
        <div className="row ctl" style={{ marginTop: 8 }}>
          <button title="Left arrow" disabled={!plan || playing || plan.pos === 0} onClick={() => { if (!sim.playing) sim.run(sim.back); }}>&larr;</button>
          <button title="Right arrow" disabled={!plan || playing} onClick={() => { if (sim.plan && !sim.playing) sim.run(sim.step); }}>&rarr;</button>
          <button disabled={!plan} onClick={() => { if (sim.plan) sim.impulse(); }}>{playing ? 'Pause' : 'Play'}</button>
          <button title="Apply the rest at once" disabled={!plan || playing} onClick={() => { if (!sim.playing) sim.run(sim.applyAll); }}>All</button>
        </div>
      </div>
    </aside>
  );
}

function Toggle({ k, children }: { k: OptKey; children: string }) {
  const s = useSim();
  return <button className={'tg' + (s.opts[k] ? ' on' : '')} aria-pressed={s.opts[k]} onClick={() => sim.setOpt(k, !s.opts[k])}>{children}</button>;
}

// The sequence is bare notation: group labels and tokens, the next one inverted
function Sequence() {
  const s = useSim();
  const ref = useRef<HTMLDivElement>(null);
  const plan = s.plan;
  useLayoutEffect(() => { ref.current?.querySelector('.tok.next')?.scrollIntoView({ block: 'nearest' }); });
  if (!plan) return <div id="seq"><span id="seqEmpty">---</span></div>;
  let n = 0;
  return (
    <div id="seq" ref={ref}>
      {plan.groups.map((g, gi) => {
        const start = n;
        n += g.tokens.length;
        const state = plan.pos >= start + g.tokens.length ? 'done' : plan.pos >= start ? 'cur' : 'todo';
        return (
          <div key={gi} className={'g ' + state}>
            <div className="gl">{pad3(gi + 1).slice(1)} {g.label}</div>
            {g.tokens.map((t, j) => (
              <span key={j} className={'tok' + (start + j < plan.pos ? ' done' : start + j === plan.pos ? ' next' : '')}>{t}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
