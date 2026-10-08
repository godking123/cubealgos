import { useEffect, useState } from 'react';
import { CORNER_NAMES, EDGE_NAMES } from '../cube';
import { sim, useSim } from '../sim';

type Key = 'cp' | 'co' | 'ep' | 'eo';
const ROWS: [Key, number, string[]][] = [['cp', 8, CORNER_NAMES], ['co', 8, CORNER_NAMES], ['ep', 12, EDGE_NAMES], ['eo', 12, EDGE_NAMES]];
const fromSnap = (snap: NonNullable<typeof sim.snap>) =>
  Object.fromEntries(ROWS.map(([k]) => [k, snap[k].map(String)])) as Record<Key, string[]>;

// The raw cp co ep eo arrays, editable; Apply hands them to the engine, which rejects
// an unreachable state, and a new snapshot replaces any edit not applied
export function StateArrays() {
  const s = useSim();
  const snap = s.snap;
  const [draft, setDraft] = useState<Record<Key, string[]> | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (snap) setDraft(fromSnap(snap)); }, [snap]);
  if (!snap || !draft) return null;

  const mark = (k: Key, i: number) => {
    const kind = k[0] as 'c' | 'e';
    return (s.picked && s.picked.kind === kind && s.picked.idx === i) || (s.hover && s.hover.kind === kind && s.hover.idx === i);
  };
  const apply = async () => {
    const err = await sim.setState(Object.fromEntries(ROWS.map(([k]) => [k, draft[k].map(v => v.trim()).join(',')])) as Record<Key, string>);
    setMsg(err ?? 'ok');
  };
  return (
    <details>
      <summary>Edit state</summary>
      <table className="state">
        <tbody>
          {ROWS.flatMap(([key, n, names]) => {
            const rows = [];
            if (key === 'cp' || key === 'ep')
              rows.push(<tr key={key + 's'} className="slots"><th />{names.map(nm => <td key={nm}>{nm}</td>)}</tr>);
            rows.push(
              <tr key={key}><th>{key}</th>{Array.from({ length: n }, (_, i) => {
                const kind = key[0] as 'c' | 'e';
                const home = kind === 'c' ? (snap.cp[i] === i && snap.co[i] === 0) : (snap.ep[i] === i && snap.eo[i] === 0);
                return (
                  <td key={i}>
                    <input maxLength={2} value={draft[key][i]} aria-label={`${key}[${i}]`}
                           className={[home && 'home', mark(key, i) && 'hover'].filter(Boolean).join(' ')}
                           onChange={e => setDraft({ ...draft, [key]: draft[key].map((v, j) => j === i ? e.target.value : v) })}
                           onMouseEnter={() => sim.setHover({ kind, idx: i })}
                           onMouseLeave={() => sim.setHover(null)} />
                  </td>
                );
              })}</tr>,
            );
            return rows;
          })}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 6 }}>
        <button onClick={apply}>Apply</button>
        <button onClick={() => { setDraft(fromSnap(snap)); setMsg(''); }}>Revert</button>
        <span className="msg">{msg}</span>
      </div>
    </details>
  );
}
