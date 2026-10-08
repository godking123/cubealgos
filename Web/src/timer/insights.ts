import type { Analysis, Solve } from './db';
import type { CrossColor } from './timer';
import { DNF, STAGES, fmt, mean, result, stageTimes, stdev } from './stats';

// Rough shares of a CFOP solve per stage, a common rule of thumb rather than a
// standard; the coaching compares against it only to rank where time goes
export const TYPICAL_SHARE = [0.12, 0.52, 0.16, 0.20];
export const OPPOSITE: Record<string, string> =
  { white: 'yellow', yellow: 'white', red: 'orange', orange: 'red', green: 'blue', blue: 'green' };

export interface CrossLook { pref: number; dual: number; best: number; bestColor: string; prefColor: string }

// Optimal cross lengths for a scramble: on the chosen colour, the better of it and its
// opposite, and the best of all six. Neutral solvers measure against the best
export function crossLook(a: Analysis, color: CrossColor): CrossLook {
  const len = (c: string) => a.crosses.find(x => x.color === c)!.moves.length;
  const bestOf = [...a.crosses].sort((x, y) => x.moves.length - y.moves.length)[0];
  if (color === 'neutral')
    return { pref: bestOf.moves.length, dual: bestOf.moves.length, best: bestOf.moves.length, bestColor: bestOf.color, prefColor: bestOf.color };
  return { pref: len(color), dual: Math.min(len(color), len(OPPOSITE[color])), best: bestOf.moves.length,
           bestColor: bestOf.color, prefColor: color };
}

export interface Insight { tone: 'focus' | 'good' | 'info'; title: string; detail: string; save?: number }

export interface StageSummary { avg: number[]; share: number[]; sd: (number | null)[]; best: number[]; n: number }

// Stage averages over the solves that carry splits, DNFs left out
export function stageSummary(solves: Solve[]): StageSummary | null {
  const rows = solves.filter(s => s.penalty !== 'dnf').map(stageTimes).filter((x): x is number[] => !!x);
  if (!rows.length) return null;
  const col = (i: number) => rows.map(r => r[i]);
  const avg = STAGES.map((_, i) => mean(col(i))!);
  const total = avg.reduce((a, b) => a + b, 0);
  return { avg, share: avg.map(x => x / total), sd: STAGES.map((_, i) => stdev(col(i))),
           best: STAGES.map((_, i) => Math.min(...col(i))), n: rows.length };
}

const s1 = (ms: number) => (ms / 1000).toFixed(2) + ' s';
const pct = (x: number) => Math.round(x * 100) + '%';

// What to work on across a session, most time to gain first
export function sessionInsights(solves: Solve[], color: CrossColor): Insight[] {
  const out: Insight[] = [];
  const results = solves.map(result);
  const m = mean(results);
  if (!solves.length || m == null) return out;

  // Stage Balance
  const st = stageSummary(solves);
  if (st && st.n >= 5) {
    const over = STAGES.map((name, i) => ({ name, i, extra: (st.share[i] - TYPICAL_SHARE[i]) * m }))
      .sort((a, b) => b.extra - a.extra)[0];
    if (over.extra > 150)
      out.push({ tone: 'focus', save: over.extra,
        title: `Focus on ${over.name}`,
        detail: `${pct(st.share[over.i])} of your solve vs ~${pct(TYPICAL_SHARE[over.i])} typical, about ${s1(over.extra)} to gain. `
          + ({ Cross: 'Plan it fully in inspection.', F2L: 'Turn slower, look ahead.',
               OLL: 'Drill the cases you hesitate on.', PLL: 'Learn the algs you are missing.' } as Record<string, string>)[over.name] });
    const cv = STAGES.map((name, i) => ({ name, i, cv: st.sd[i] != null ? st.sd[i]! / st.avg[i] : 0 }))
      .sort((a, b) => b.cv - a.cv)[0];
    if (cv.cv > 0.35 && st.n >= 8)
      out.push({ tone: 'focus', save: (st.sd[cv.i] ?? 0) / 2,
        title: `${cv.name} is inconsistent`,
        detail: `±${s1(st.sd[cv.i]!)} around ${s1(st.avg[cv.i])}. Usually cases you don't know yet.` });
  } else {
    out.push({ tone: 'info', title: 'Turn on stage splits', detail: 'See which CFOP stage costs you most.' });
  }

  // Cross Colour
  const looks = solves.filter(s => s.analysis).map(s => crossLook(s.analysis!, color));
  if (looks.length >= 5 && color !== 'neutral') {
    const avg = (f: (l: CrossLook) => number) => looks.reduce((a, l) => a + f(l), 0) / looks.length;
    const pref = avg(l => l.pref), dual = avg(l => l.dual), best = avg(l => l.best);
    if (pref - best >= 0.6)
      out.push({ tone: 'focus', save: (pref - best) * 300,
        title: 'Try colour neutral',
        detail: `Avg cross: ${pref.toFixed(1)} moves on ${color}, ${dual.toFixed(1)} adding ${OPPOSITE[color]}, ${best.toFixed(1)} on any colour.` });
    const crossTime = st && st.n >= 5 ? st.avg[0] : null;
    if (crossTime && crossTime / pref > 450)
      out.push({ tone: 'focus', save: crossTime - pref * 300,
        title: 'Slow cross',
        detail: `${(crossTime / pref / 1000).toFixed(2)} s per move. A planned cross runs 3–4 moves/s.` });
  }

  // Consistency
  const sd = stdev(results.slice(-50));
  const recentMean = mean(results.slice(-50));
  if (sd != null && recentMean != null && results.length >= 12) {
    const cv = sd / recentMean;
    if (cv > 0.12)
      out.push({ tone: 'focus', save: sd / 3, title: 'Inconsistent times',
        detail: `σ ${s1(sd)} (${pct(cv)} of mean). Cut the slow outliers first.` });
    else
      out.push({ tone: 'good', title: 'Consistent times', detail: `σ ${s1(sd)} (${pct(cv)} of mean).` });
  }

  // Penalties
  const dnfs = solves.filter(s => s.penalty === 'dnf').length, plus2 = solves.filter(s => s.penalty === '+2').length;
  if (solves.length >= 10 && (dnfs + plus2) / solves.length > 0.05)
    out.push({ tone: 'focus', save: (plus2 * 2000) / solves.length,
      title: 'Too many penalties', detail: `${dnfs} DNF, ${plus2} +2 in ${solves.length} solves.` });

  // Progress
  if (results.length >= 24) {
    const first = mean(results.slice(0, 12)), last = mean(results.slice(-12));
    if (first != null && last != null && first - last > 100)
      out.push({ tone: 'good', title: 'Getting faster',
        detail: `Last 12: ${fmt(last)}, ${s1(first - last)} faster than your first 12.` });
  }

  return out.sort((a, b) => (a.tone === 'focus' ? 0 : a.tone === 'info' ? 1 : 2) - (b.tone === 'focus' ? 0 : b.tone === 'info' ? 1 : 2)
    || (b.save ?? 0) - (a.save ?? 0));
}

// What one solve says, next to the rest of its session
export function solveInsights(s: Solve, session: Solve[], a: Analysis | null, color: CrossColor): Insight[] {
  const out: Insight[] = [];
  if (a) {
    const l = crossLook(a, color);
    if (l.best < l.pref)
      out.push({ tone: 'focus', title: `${l.bestColor} cross: ${l.best} moves`,
        detail: `${l.pref - l.best} shorter than ${color} (${l.pref}).` });
    else
      out.push({ tone: 'good', title: `${l.prefColor} cross: ${l.pref} moves`, detail: 'As short as any colour.' });
    if (l.pref >= 7) out.push({ tone: 'info', title: 'Hard cross', detail: `${l.pref} moves, near the 8-move max.` });
  }
  const times = stageTimes(s);
  const others = stageSummary(session.filter(x => x.id !== s.id));
  if (times && others && others.n >= 3 && s.penalty !== 'dnf') {
    const deltas = times.map((t, i) => t - others.avg[i]);
    const worst = deltas.indexOf(Math.max(...deltas)), bestI = deltas.indexOf(Math.min(...deltas));
    if (deltas[worst] > 150)
      out.push({ tone: 'focus', title: `${STAGES[worst]} +${s1(deltas[worst])}`,
        detail: `${s1(times[worst])} vs your ${s1(others.avg[worst])} average.` });
    if (deltas[bestI] < -150)
      out.push({ tone: 'good', title: `${STAGES[bestI]} −${s1(-deltas[bestI])}`,
        detail: `${s1(times[bestI])} vs your ${s1(others.avg[bestI])} average.` });
  }
  const rest = session.filter(x => x.id !== s.id).map(result).filter(x => x !== DNF);
  const m = mean(rest);
  if (m != null && rest.length >= 5 && s.penalty !== 'dnf') {
    const d = result(s) - m;
    if (Math.abs(d) > 0.08 * m)
      out.push({ tone: d < 0 ? 'good' : 'info', title: d < 0 ? `${s1(-d)} under your mean` : `${s1(d)} over your mean`,
        detail: `Mean ${fmt(m)}.` });
  }
  return out;
}
