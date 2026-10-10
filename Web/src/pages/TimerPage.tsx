import { useEffect, useRef, useState } from 'react';
import { timer, useTimer, CROSS_COLORS } from '../timer/timer';
import { STAGES, fmt, fmtSolve, stageTimes } from '../timer/stats';
import { Net } from '../components/Net';

const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']);

// The cube timer: hold Space (or touch the pad) until the clock turns green, let go
// to start, any key to stop
export function TimerPage() {
  const t = useTimer();
  const digits = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLElement>(null);

  // Clock: written straight to the element each frame
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      timer.tick();
      const el = digits.current, text = timer.digits();
      if (el && el.textContent !== text) el.textContent = text;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keys and touch
  useEffect(() => {
    const typing = (e: Event) => {
      const tag = (e.target as HTMLElement).tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    };
    const down = (e: KeyboardEvent) => {
      if (timer.modalOpen || typing(e)) return;
      // Held Space Would Otherwise Scroll the Page
      if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
      if (timer.phase === 'running') {
        if (MODIFIERS.has(e.key)) return;
        e.preventDefault();
        if (e.key === 'Escape') return timer.cancel();
        return timer.down(e.code);
      }
      if (e.key === 'Escape') return timer.cancel();
      if (e.code === 'KeyF' && timer.phase === 'idle' && !e.ctrlKey && !e.metaKey && !e.altKey)
        return timer.setSetting('bare', !timer.settings.bare);
      if (e.code !== 'Space') return;
      e.preventDefault();
      timer.down('Space');
    };
    const up = (e: KeyboardEvent) => { if (!timer.modalOpen) timer.up(e.code); };
    // A clicked button must not keep focus, or Space would press it instead of the timer
    const click = (e: MouseEvent) => { const b = (e.target as HTMLElement).closest('button'); if (b) b.blur(); };
    // Touch starts from the pad, and while running a touch anywhere stops
    const pdown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || timer.modalOpen) return;
      if (timer.phase === 'running' || pad.current?.contains(e.target as Node)) {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        timer.down('Pointer');
      }
    };
    const pup = (e: PointerEvent) => { if (e.pointerType !== 'mouse') timer.up('Pointer'); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    document.addEventListener('click', click);
    window.addEventListener('pointerdown', pdown);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.removeEventListener('click', click);
      window.removeEventListener('pointerdown', pdown);
      window.removeEventListener('pointerup', pup);
      window.removeEventListener('pointercancel', pup);
    };
  }, []);

  const last = t.last();
  const hint = {
    idle: !t.scramble ? 'Scrambling...' : t.settings.inspection ? (TOUCH ? 'Tap to inspect' : 'Space to inspect')
        : TOUCH ? 'Hold the clock' : 'Hold space',
    inspect: 'Inspecting',
    holding: 'Hold...',
    ready: 'Release',
    running: t.settings.splits ? 'Tap per stage' : 'Solving',
  }[t.phase];
  return <>
    <div id="scrambleBar" className="tscramble">
      <span id="scrambleTokens">
        {t.scramble ? t.scramble.split(' ').map((m, i) => <span key={i} className="tok">{m}</span>) : <span className="tok done">generating...</span>}
      </span>
      <span className="sbtns">
        <button onClick={() => timer.newScramble()} disabled={!t.scramble || t.phase !== 'idle'}>New</button>
        <button onClick={() => navigator.clipboard?.writeText(t.scramble)} disabled={!t.scramble}>Copy</button>
        <button className={t.settings.bare ? 'on' : ''} aria-pressed={t.settings.bare}
                onClick={() => timer.setSetting('bare', !t.settings.bare)} title="Hide stats and solves (F)">Focus</button>
      </span>
    </div>
    <main id="main" className={'timer' + (t.settings.bare ? ' bare' : '')}>
      <section id="pad" ref={pad} className={'ph-' + t.phase}>
        <div className="clock">
          <div className="hint">{hint}</div>
          <div className="digits" ref={digits} aria-live="off">0.00</div>
          {t.settings.splits && (
            <div className="stages">
              {STAGES.map((st, i) => {
                const running = t.phase === 'running';
                const done = running && i < t.liveSplits.length;
                const cur = running && i === t.liveSplits.length;
                const lastTimes = !running && t.phase === 'idle' && last && !t.settings.bare ? stageTimes(last) : null;
                const split = running
                  ? (t.liveSplits[i] != null ? t.liveSplits[i] - (t.liveSplits[i - 1] ?? 0) : null)
                  : lastTimes ? lastTimes[i] : null;
                return <span key={st} className={'stage' + (done ? ' done' : '') + (cur ? ' cur' : '')}>
                  {st}{split != null && <em>{fmt(split)}</em>}
                </span>;
              })}
            </div>
          )}
          {last && t.phase === 'idle' && (
            <div className="quick">
              <button className={last.penalty === 'ok' ? 'on' : ''} onClick={() => timer.setPenalty(last.id, 'ok')}>OK</button>
              <button className={last.penalty === '+2' ? 'on' : ''} onClick={() => timer.setPenalty(last.id, '+2')}>+2</button>
              <button className={last.penalty === 'dnf' ? 'on' : ''} onClick={() => timer.setPenalty(last.id, 'dnf')}>DNF</button>
              <button onClick={() => { if (confirm('Delete the last solve?')) timer.deleteSolve(last.id); }} aria-label="Delete">&times;</button>
            </div>
          )}
        </div>
        {t.preview && (
          <div className="netbox" aria-label="Scramble preview">
            <Net s={t.preview} />
          </div>
        )}
      </section>
      {!t.settings.bare && <SolveList />}
    </main>
  </>;
}

function Tg({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: string }) {
  return <button className={'tg' + (on ? ' on' : '')} aria-pressed={on} onClick={() => set(!on)}>{children}</button>;
}

export function SessionPicker() {
  const t = useTimer();
  return (
    <div className="row">
      <select value={t.sessionId} onChange={e => timer.selectSession(e.target.value)} aria-label="Session" style={{ flex: 1 }}>
        {t.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button onClick={() => timer.addSession()} title="New session" aria-label="New session">+</button>
    </div>
  );
}

// Settings and session management are set once and rarely touched, so they stay
// folded away below the solve list instead of competing with it
function Settings() {
  const t = useTimer();
  const s = t.settings;
  return (
    <details className="blk settings">
      <summary>Settings</summary>
      <div className="opts">
        <Tg on={s.inspection} set={v => timer.setSetting('inspection', v)}>Inspection</Tg>
        <Tg on={s.splits} set={v => timer.setSetting('splits', v)}>Stage splits</Tg>
        <Tg on={s.hide} set={v => timer.setSetting('hide', v)}>Hide time</Tg>
        <Tg on={s.focus} set={v => timer.setSetting('focus', v)}>Fade while solving</Tg>
      </div>
      <label className="field">Hold
        <select value={s.holdMs} onChange={e => timer.setSetting('holdMs', +e.target.value)}>
          <option value={0}>Instant</option><option value={300}>0.3 s</option><option value={550}>0.55 s</option><option value={1000}>1 s</option>
        </select>
      </label>
      <label className="field">Cross
        <select value={s.cross} onChange={e => timer.setSetting('cross', e.target.value as typeof s.cross)}>
          {CROSS_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="row session-ops">
        <button onClick={() => { const n = prompt('Session name', t.sessionName()); if (n) timer.renameSession(n); }}>Rename session</button>
        <button onClick={() => { if (confirm(`Delete "${t.sessionName()}" and its ${t.solves.length} solves?`)) timer.deleteSession(); }}>Delete session</button>
      </div>
    </details>
  );
}

const PAGE = 100;  // Rows Drawn Before "Show More"

function SolveList() {
  const t = useTimer();
  const [shown, setShown] = useState(PAGE);
  const n = t.solves.length;
  const rows = [];
  for (let i = n - 1; i >= Math.max(0, n - shown); i--) {
    const s = t.solves[i];
    rows.push(
      <tr key={s.id} onClick={() => timer.open(s.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') timer.open(s.id); }}>
        <td className="n">{i + 1}</td>
        <td className={'t' + (s.penalty === 'dnf' ? ' dnf' : '')}>{fmtSolve(s)}{s.splits && <i className="sp" title="Has stage splits" />}</td>
        <td>{fmt(t.stats.ao5[i])}</td>
        <td>{fmt(t.stats.ao12[i])}</td>
      </tr>,
    );
  }
  const st = t.stats;
  const row = (name: string, cur: number | null, best: number | null) => (
    <tr key={name}><th>{name}</th><td>{fmt(cur)}</td><td>{fmt(best)}</td></tr>
  );
  return (
    <aside id="right">
      <div className="blk">
        <SessionPicker />
        <table className="data stats">
          <thead><tr><th /><th>Current</th><th>Best</th></tr></thead>
          <tbody>
            {row('single', st.current.single, st.bestSingle)}
            {row('ao5', st.current.ao5, st.bestAo5)}
            {row('ao12', st.current.ao12, st.bestAo12)}
            {st.count >= 100 && row('ao100', st.current.ao100, st.bestAo100)}
          </tbody>
        </table>
        <div className="kv"><span>Mean <b>{fmt(st.mean)}</b></span></div>
      </div>
      <div className="blk grow list">
        <div className="lbl">Solves · {n}</div>
        {n ? (
          <div className="scroll">
            <table className="data solves">
              <thead><tr><th>#</th><th>Time</th><th>ao5</th><th>ao12</th></tr></thead>
              <tbody>{rows}</tbody>
            </table>
            {n > shown && <button className="wide-btn" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, n - shown)} more</button>}
          </div>
        ) : <div className="empty">No solves yet.</div>}
      </div>
      <Settings />
      {!t.saved && <p className="warn">Storage blocked: solves won't be saved.</p>}
    </aside>
  );
}
