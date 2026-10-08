import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { COLOR_NAMES, COLOR_VARS, PATTERN_VARS } from '../cube';
import { DNF, STAGES, fmt } from '../timer/stats';

// Charts
//
// Plain SVG and HTML, drawn to the container's measured width. Stage colours are the
// four leading categorical slots, validated for colour-blind separation in that order;
// two of them are light on paper, so every split chart also prints its values

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  for (const s of [100, 200, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000]) if (s >= raw) return s;
  return 600000;
}
const secs = (ms: number) => ms >= 60000 ? fmt(ms).replace(/\.\d+$/, '') : String(+(ms / 1000).toFixed(2));

function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(8, x + 12), w - 150);
  return <div className="tip" style={{ left, top: Math.max(0, y - 10) }}>{children}</div>;
}

// Times Over the Session: Singles as Dots, ao5 and ao12 as Lines
export function TrendChart({ results, ao5, ao12, offset = 0 }:
  { results: number[]; ao5: (number | null)[]; ao12: (number | null)[]; offset?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240, L = 46, R = 14, T = 12, B = 26;
  const fin = results.filter(x => x !== DNF);
  if (!fin.length) return <div ref={ref} className="empty">No timed solves yet</div>;
  const sorted = [...fin].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  // A Single Freak Time Would Flatten the Rest, So the Top Is Capped
  const cap = Math.max(median * 2.2, sorted[0] + 1000);
  const hi0 = Math.min(sorted[sorted.length - 1], cap), lo0 = sorted[0];
  const step = niceStep(Math.max(500, hi0 - lo0), 4);
  const lo = Math.max(0, Math.floor(lo0 / step) * step), hi = Math.ceil(hi0 / step) * step + (hi0 === lo ? step : 0);
  const n = results.length, iw = Math.max(1, w - L - R), ih = H - T - B;
  const x = (i: number) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => T + ih - ((Math.min(v, hi) - lo) / (hi - lo)) * ih;
  const line = (arr: (number | null)[]) => {
    let d = '', pen = false;
    arr.forEach((v, i) => {
      if (v == null || v === DNF) { pen = false; return; }
      d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
      pen = true;
    });
    return d;
  };
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 1; v += step) yTicks.push(v);
  const xEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
  const xTicks = results.map((_, i) => i).filter(i => i % xEvery === 0 || i === n - 1)
    .filter((i, k, a) => k === a.length - 1 || a[a.length - 1] - i >= xEvery * 0.6);
  const r = n > 150 ? 2.5 : 4;
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const bx = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - bx.left) / bx.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div ref={ref} className="chart">
      {w > 0 && <svg width={w} height={H} role="img" aria-label="Solve times over the session with ao5 and ao12">
        {yTicks.map(v => <g key={v}>
          <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="axis">{secs(v)}</text>
        </g>)}
        {xTicks.map(i => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="axis">{i + 1 + offset}</text>)}
        {results.map((v, i) => v !== DNF && (
          <circle key={i} cx={x(i)} cy={y(v)} r={r} className={'dot' + (v > hi ? ' capped' : '')} />
        ))}
        <path d={line(ao12)} className="ln s2" />
        <path d={line(ao5)} className="ln s1" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} className="cross" />}
        {hover != null && ([[ao5[hover], 's1'], [ao12[hover], 's2']] as const).map(([v, c]) =>
          v != null && v !== DNF && <circle key={c} cx={x(hover)} cy={y(v)} r={4.5} className={'end ' + c} />)}
        <rect x={L} y={T} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>}
      {hover != null && <Tip x={x(hover)} y={y(Math.min(results[hover], hi))} w={w}>
        <b>Solve {hover + 1 + offset}</b>
        <div><i className="k dot" />single <span>{fmt(results[hover])}</span></div>
        <div><i className="k s1" />ao5 <span>{fmt(ao5[hover])}</span></div>
        <div><i className="k s2" />ao12 <span>{fmt(ao12[hover])}</span></div>
      </Tip>}
    </div>
  );
}

// How the Singles Fall, One Bar per Time Band
export function Histogram({ results }: { results: number[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fin = results.filter(x => x !== DNF).sort((a, b) => a - b);
  if (fin.length < 2) return <div ref={ref} className="empty">Needs a few solves</div>;
  const H = 200, L = 30, R = 8, T = 18, B = 26;
  const lo0 = fin[Math.floor(fin.length * 0.02)], hi0 = fin[Math.ceil(fin.length * 0.98) - 1];
  const step = niceStep(Math.max(500, hi0 - lo0), 10);
  const lo = Math.floor(lo0 / step) * step, bins = Math.max(1, Math.ceil((hi0 - lo + 1) / step));
  const counts = new Array(bins).fill(0);
  for (const v of fin) counts[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / step)))]++;
  const max = Math.max(...counts), iw = Math.max(1, w - L - R), ih = H - T - B;
  const slot = iw / bins, bw = Math.min(24, slot - 2);
  const top = counts.indexOf(max);
  const every = Math.ceil(bins / Math.max(2, Math.floor(iw / 56)));
  return (
    <div ref={ref} className="chart">
      {w > 0 && <svg width={w} height={H} role="img" aria-label="Distribution of single times">
        <line x1={L} x2={w - R} y1={T + ih} y2={T + ih} className="base" />
        {counts.map((c, i) => {
          const h = (c / max) * ih, bx = L + i * slot + (slot - bw) / 2, by = T + ih - h;
          const rr = Math.min(4, h, bw / 2);
          return <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={L + i * slot} y={T} width={slot} height={ih} fill="transparent" />
            {c > 0 && <path className={'bar' + (hover === i ? ' on' : '')}
              d={`M${bx} ${T + ih}V${by + rr}Q${bx} ${by} ${bx + rr} ${by}H${bx + bw - rr}Q${bx + bw} ${by} ${bx + bw} ${by + rr}V${T + ih}Z`} />}
            {i === top && <text x={bx + bw / 2} y={by - 5} textAnchor="middle" className="val">{c}</text>}
            {i % every === 0 && <text x={L + i * slot} y={H - 6} textAnchor="start" className="axis">{secs(lo + i * step)}</text>}
          </g>;
        })}
      </svg>}
      {hover != null && <Tip x={L + hover * slot + slot / 2} y={T + ih - (counts[hover] / max) * ih} w={w}>
        <b>{secs(lo + hover * step)} to {secs(lo + (hover + 1) * step)} s</b>
        <div>{counts[hover]} solve{counts[hover] === 1 ? '' : 's'}</div>
      </Tip>}
    </div>
  );
}

// Cross, F2L, OLL, PLL as One Stacked Bar per Row, Rows on a Shared Scale
export function SplitBars({ rows }: { rows: { label: string; times: number[] }[] }) {
  const [tip, setTip] = useState<{ r: number; i: number } | null>(null);
  const max = Math.max(...rows.map(r => r.times.reduce((a, b) => a + b, 0)));
  return (
    <div className="splits">
      {rows.map((row, r) => {
        const total = row.times.reduce((a, b) => a + b, 0);
        return (
          <div key={row.label} className="srow">
            <div className="slabel"><span>{row.label}</span><b>{fmt(total)}</b></div>
            <div className="strack">
              <div className="sfill" style={{ width: `${(total / max) * 100}%` }}>
                {row.times.map((t, i) => (
                  <div key={i} className={'seg s' + (i + 1)} style={{ flexGrow: t }}
                       onMouseEnter={() => setTip({ r, i })} onMouseLeave={() => setTip(null)}>
                    {tip && tip.r === r && tip.i === i &&
                      <div className="tip seg-tip"><b>{STAGES[i]}</b><div>{fmt(t)} · {Math.round((t / total) * 100)}%</div></div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <div className="legend">
        {STAGES.map((s, i) => (
          <span key={s}><i className={'k s' + (i + 1)} />{s}
            {rows.length === 1 && <em>{fmt(rows[0].times[i])}</em>}</span>
        ))}
      </div>
    </div>
  );
}

// Optimal Cross Length per Colour
export function CrossBars({ lengths, mark, max = 8 }: { lengths: Record<string, number>; mark?: string; max?: number }) {
  const order = ['white', 'yellow', 'green', 'blue', 'red', 'orange'];
  const bestV = Math.min(...order.map(c => lengths[c]));
  return (
    <div className="xbars">
      {order.map(c => {
        const v = lengths[c], ci = COLOR_NAMES.indexOf(c);
        return (
          <div key={c} className={'xrow' + (c === mark ? ' mine' : '')}>
            <span className="xname">
              <i className="sw" style={{ '--c': COLOR_VARS[ci], '--p': PATTERN_VARS[ci] } as CSSProperties} />{c}
            </span>
            <span className="xtrack"><span className={'xfill' + (v === bestV ? ' best' : '')} style={{ width: `${(v / max) * 100}%` }} /></span>
            <span className="xval">{Number.isInteger(v) ? v : v.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}
