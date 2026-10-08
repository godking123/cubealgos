import type { Solve } from './db';

export const DNF = Infinity;
export const STAGES = ['Cross', 'F2L', 'OLL', 'PLL'] as const;

// A solve's result in ms, the +2 added, Infinity for a DNF
export function result(s: Solve) {
  if (s.penalty === 'dnf') return DNF;
  return s.time + (s.penalty === '+2' ? 2000 : 0);
}

// Times truncate to the hundredth, as a stackmat and the WCA show them
export function fmt(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return '-';
  if (ms === DNF) return 'DNF';
  const cs = Math.floor(ms / 10);
  const m = Math.floor(cs / 6000), sec = Math.floor(cs / 100) % 60, frac = cs % 100;
  const tail = String(frac).padStart(2, '0');
  return m ? `${m}:${String(sec).padStart(2, '0')}.${tail}` : `${sec}.${tail}`;
}
export function fmtSolve(s: Solve) {
  if (s.penalty === 'dnf') return 'DNF';
  return fmt(result(s)) + (s.penalty === '+2' ? '+' : '');
}

// WCA average of n: the fastest and slowest 5% each (at least one) are dropped and
// the rest are meaned. More DNFs than the dropped slow end makes the average a DNF.
// Mean of 3 drops nothing. Null when fewer than n results exist
export function averageOf(results: number[], n: number) {
  if (results.length < n) return null;
  const xs = results.slice(-n).sort((a, b) => a - b);
  const trim = n <= 3 ? 0 : Math.ceil(n * 0.05);
  const kept = xs.slice(trim, n - trim);
  if (kept.some(x => x === DNF)) return DNF;
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}

// aoN ending at every solve, null until n solves exist
export function rolling(results: number[], n: number) {
  return results.map((_, i) => averageOf(results.slice(0, i + 1), n));
}

export function best(xs: (number | null)[]) {
  let b: number | null = null;
  for (const x of xs) if (x != null && x !== DNF && (b == null || x < b)) b = x;
  return b;
}

export function mean(xs: number[]) {
  const ok = xs.filter(x => x !== DNF);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

export function stdev(xs: number[]) {
  const ok = xs.filter(x => x !== DNF);
  if (ok.length < 2) return null;
  const m = ok.reduce((a, b) => a + b, 0) / ok.length;
  return Math.sqrt(ok.reduce((a, b) => a + (b - m) ** 2, 0) / (ok.length - 1));
}

// Stage durations from the cumulative split marks, null when the solve has none
export function stageTimes(s: Solve) {
  if (!s.splits || s.splits.length !== 3) return null;
  const marks = [0, ...s.splits, s.time];
  return marks.slice(1).map((m, i) => m - marks[i]);
}

export interface SessionStats {
  count: number; dnfs: number; plus2: number;
  results: number[]; ao5: (number | null)[]; ao12: (number | null)[];
  bestSingle: number | null; bestAo5: number | null; bestAo12: number | null;
  bestAo50: number | null; bestAo100: number | null;
  current: { single: number | null; ao5: number | null; ao12: number | null; ao50: number | null; ao100: number | null };
  mean: number | null; sd: number | null;
}

// Every figure the timer panels show, for a session's solves oldest first
export function sessionStats(solves: Solve[]): SessionStats {
  const results = solves.map(result);
  const ao5 = rolling(results, 5), ao12 = rolling(results, 12);
  const ao50 = rolling(results, 50), ao100 = rolling(results, 100);
  return {
    count: solves.length,
    dnfs: solves.filter(s => s.penalty === 'dnf').length,
    plus2: solves.filter(s => s.penalty === '+2').length,
    results, ao5, ao12,
    bestSingle: best(results), bestAo5: best(ao5), bestAo12: best(ao12),
    bestAo50: best(ao50), bestAo100: best(ao100),
    current: {
      single: results.length ? results[results.length - 1] : null,
      ao5: ao5.length ? ao5[ao5.length - 1] : null,
      ao12: ao12.length ? ao12[ao12.length - 1] : null,
      ao50: ao50.length ? ao50[ao50.length - 1] : null,
      ao100: ao100.length ? ao100[ao100.length - 1] : null,
    },
    mean: mean(results), sd: stdev(results),
  };
}
