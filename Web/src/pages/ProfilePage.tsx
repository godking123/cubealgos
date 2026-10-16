import type { CSSProperties } from 'react';
import { timer, useTimer, CROSS_COLORS, type CrossColor } from '../timer/timer';
import { COLOR_NAMES, COLOR_VARS, PATTERN_VARS } from '../cube';
import { HAS_CROSS, LEVELS, METHOD_STAGES, levelOf, type Profile } from '../timer/profile';

const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

// Roux Sits Beside the CFOP Ladder
const ROUX = { name: 'Roux', detail: 'Blocks, CMLL, last six edges', profile: { method: 'roux' } as Partial<Profile> };

// The solver's profile, how they solve and on which colour, with a short guide to the
// app below it. Split names and the cross analysis read from it, so it is asked
// rather than assumed
export function ProfilePage() {
  const t = useTimer();
  const p = t.profile;
  const level = levelOf(p);
  const stages = METHOD_STAGES[p.method];
  const rows = [...LEVELS.map(l => ({ ...l, on: level?.n === l.n })), { ...ROUX, n: 0, on: p.method === 'roux' }];
  return (
    <main id="main" className="stats solo">
      <section className="profile">
        <h2 className="lbl">How do you solve?</h2>
        <div className="choices" role="radiogroup" aria-label="Method">
          {rows.map(r => (
            <button key={r.name} role="radio" aria-checked={r.on} className={'choice' + (r.on ? ' on' : '')}
                    onClick={() => timer.setProfile(r.profile)}>
              <b>{r.name}</b><span>{r.detail}</span>
            </button>
          ))}
        </div>

        {HAS_CROSS[p.method] && <>
          <h2 className="lbl">Cross colour</h2>
          <div className="swatches" role="radiogroup" aria-label="Cross colour">
            {CROSS_COLORS.map(c => <Swatch key={c} c={c} on={p.cross === c} />)}
          </div>
          {p.cross == null && <p className="note">Not set yet: cross stats use your best colour on each scramble</p>}
        </>}

        <h2 className="lbl">Quick guide</h2>
        <ol className="guide">
          <li><b>Time a solve.</b> {TOUCH ? 'Hold the clock' : 'Hold Space'} until it turns green, let go to
            start, press any key to stop</li>
          <li><b>Stage splits.</b> Turn them on in the timer's Settings, then tap once as you
            finish {stages.slice(0, 3).join(', ')}</li>
          <li><b>Look back.</b> Click any solve for its scramble, optimal cross and splits</li>
          <li><b>Stats.</b> Your times per session or across all of them. Export keeps a backup</li>
          <li><b>Focus.</b> Press F on the timer to hide everything but the clock</li>
        </ol>
        <a className="wide-btn" href="#/">Start timing &rarr;</a>
      </section>
    </main>
  );
}

function Swatch({ c, on }: { c: CrossColor; on: boolean }) {
  const ci = COLOR_NAMES.indexOf(c);
  const style = ci >= 0 ? { '--c': COLOR_VARS[ci], '--p': PATTERN_VARS[ci] } as CSSProperties : undefined;
  return (
    <button role="radio" aria-checked={on} className={'swatch' + (on ? ' on' : '')} onClick={() => timer.setProfile({ cross: c })}>
      <i className={'sw' + (ci < 0 ? ' any' : '')} style={style} />{c}
    </button>
  );
}
