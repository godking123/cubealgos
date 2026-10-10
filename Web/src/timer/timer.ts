import { useSyncExternalStore } from 'react';
import { api } from '../engine';
import type { Snap } from '../cube';
import * as db from './db';
import type { Analysis, Penalty, Session, Solve } from './db';
import { fmt, fmtSolve, sessionStats, type SessionStats } from './stats';

export type Phase = 'idle' | 'inspect' | 'holding' | 'ready' | 'running';
export const CROSS_COLORS = ['white', 'yellow', 'green', 'blue', 'red', 'orange', 'neutral'] as const;
export type CrossColor = typeof CROSS_COLORS[number];

export interface Settings {
  inspection: boolean;   // WCA 15 s, +2 Past 15, DNF Past 17
  holdMs: number;        // Hold Before Ready, as csTimer's Start Delay
  splits: boolean;       // Mark Cross, F2L, OLL While Running
  hide: boolean;         // No Running Clock
  focus: boolean;        // Panels Fade While Solving
  bare: boolean;         // Focus Mode: Clock and Scramble Only
  cross: CrossColor;     // Colour the Analysis Measures Against
}
const DEFAULTS: Settings = { inspection: false, holdMs: 300, splits: false, hide: false, focus: true, bare: false, cross: 'white' };
const INSPECTION = 15000, INSPECTION_DNF = 17000;

const local = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* Private Window */ } },
};

// The timer, its sessions and the solve history, outside React like the simulator
//
// The running clock is drawn by writing the digits element directly each frame;
// React re-renders only when the phase, a split or the history changes
class Timer {
  version = 0;
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  notify() { this.version++; this.listeners.forEach(f => f()); }

  settings: Settings = { ...DEFAULTS, ...JSON.parse(local.get('timer.settings') || '{}') };
  sessions: Session[] = [];
  sessionId = '';
  solves: Solve[] = [];
  stats: SessionStats = sessionStats([]);
  loaded = false;
  saved = true;

  phase: Phase = 'idle';
  scramble = '';
  preview: Snap | null = null;
  liveSplits: number[] = [];
  openSolve: string | null = null;
  private nextScramble: Promise<string> | null = null;
  private holdFrom: 'idle' | 'inspect' = 'idle';
  private armInspect = false;
  needKeyup = false;
  private holdStart = 0;
  private inspectStart = 0;
  private inspectPenalty: Penalty = 'ok';
  private runStart = 0;

  setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    this.settings = { ...this.settings, [k]: v };
    local.set('timer.settings', JSON.stringify(this.settings));
    this.notify();
  }

  // Sessions
  private booted = false;
  async boot() {
    if (this.booted) return;
    this.booted = true;
    this.saved = await db.persistent();
    this.sessions = (await db.allSessions()).sort((a, b) => a.created - b.created);
    if (!this.sessions.length) {
      const s = { id: db.newId(), name: 'Session 1', created: Date.now() };
      this.sessions = [s];
      await db.put('sessions', s);
    }
    const want = local.get('timer.session');
    await this.selectSession(this.sessions.some(s => s.id === want) ? want! : this.sessions[0].id);
    this.loaded = true;
    this.newScramble();
  }
  async selectSession(id: string) {
    this.sessionId = id;
    local.set('timer.session', id);
    this.setSolves(await db.sessionSolves(id));
  }
  async addSession() {
    const s = { id: db.newId(), name: `Session ${this.sessions.length + 1}`, created: Date.now() };
    this.sessions = [...this.sessions, s];
    await db.put('sessions', s);
    await this.selectSession(s.id);
  }
  async renameSession(name: string) {
    const s = this.sessions.find(x => x.id === this.sessionId);
    if (!s || !name.trim()) return;
    const r = { ...s, name: name.trim() };
    this.sessions = this.sessions.map(x => x.id === r.id ? r : x);
    await db.put('sessions', r);
    this.notify();
  }
  // The last session is emptied rather than removed, so there is always one to time into
  async deleteSession() {
    await db.remove('solves', ...this.solves.map(s => s.id));
    if (this.sessions.length > 1) {
      await db.remove('sessions', this.sessionId);
      this.sessions = this.sessions.filter(s => s.id !== this.sessionId);
      await this.selectSession(this.sessions[0].id);
    } else this.setSolves([]);
  }
  sessionName() { return this.sessions.find(s => s.id === this.sessionId)?.name ?? ''; }

  private setSolves(solves: Solve[]) {
    this.solves = solves;
    this.stats = sessionStats(solves);
    this.notify();
  }

  // Solves
  async setPenalty(id: string, penalty: Penalty) {
    const s = this.solves.find(x => x.id === id);
    if (!s) return;
    const r = { ...s, penalty };
    this.setSolves(this.solves.map(x => x.id === id ? r : x));
    await db.put('solves', r);
  }
  async deleteSolve(id: string) {
    this.setSolves(this.solves.filter(x => x.id !== id));
    if (this.openSolve === id) this.openSolve = null;
    await db.remove('solves', id);
  }
  open(id: string | null) { this.openSolve = id; this.notify(); }

  // Each analysis is one engine call, kept with the solve so it runs once
  async analysis(id: string): Promise<Analysis | null> {
    const s = this.solves.find(x => x.id === id);
    if (!s) return null;
    if (s.analysis) return s.analysis;
    const a = await api<Analysis & { error?: string }>('analyze', { scramble: s.scramble });
    if (a.error) return null;
    const r = { ...s, analysis: a };
    // The session may have changed while the engine ran
    if (this.solves.some(x => x.id === id)) this.setSolves(this.solves.map(x => x.id === id ? r : x));
    await db.put('solves', r);
    return a;
  }
  analyzing = { done: 0, total: 0 };
  private analyzeRun = 0;
  async analyzeAll() {
    const run = ++this.analyzeRun;
    const todo = this.solves.filter(s => !s.analysis).map(s => s.id);
    this.analyzing = { done: 0, total: todo.length };
    this.notify();
    for (const id of todo) {
      if (run !== this.analyzeRun) return;
      await this.analysis(id);
      this.analyzing = { ...this.analyzing, done: this.analyzing.done + 1 };
      this.notify();
    }
  }

  async exportAll() {
    const solves = await db.allSolves();
    return JSON.stringify({ format: 'cubealgos-timer', version: 1, sessions: this.sessions,
      solves: solves.map(({ analysis: _, ...s }) => s) }, null, 1);
  }
  // Imported solves keep their ids, so importing the same file twice adds nothing
  async importJson(text: string) {
    const data = JSON.parse(text);
    if (data?.format !== 'cubealgos-timer' || !Array.isArray(data.solves) || !Array.isArray(data.sessions))
      throw new Error('Not a CubeAlgos timer export');
    const sessions: Session[] = data.sessions.filter((s: Session) => s && s.id && s.name);
    const known = new Set(sessions.map(s => s.id));
    const solves: Solve[] = data.solves.filter((s: Solve) =>
      s && s.id && known.has(s.session) && typeof s.time === 'number' && typeof s.scramble === 'string'
      && ['ok', '+2', 'dnf'].includes(s.penalty));
    await db.put('sessions', ...sessions);
    await db.put('solves', ...solves);
    const have = new Set(this.sessions.map(s => s.id));
    this.sessions = [...this.sessions, ...sessions.filter(s => !have.has(s.id))].sort((a, b) => a.created - b.created);
    await this.selectSession(this.sessionId);
    return solves.length;
  }

  // Scrambles
  //
  // A random state scramble costs a Kociemba search, so the next one is fetched while
  // the current one is being solved
  private fetchScramble() {
    return api<{ moves: string[] }>('wca').then(r => r.moves.join(' '));
  }
  async newScramble() {
    const next = this.nextScramble ?? this.fetchScramble();
    this.nextScramble = null;
    this.scramble = '';
    this.preview = null;
    this.notify();
    this.scramble = await next;
    this.notify();
    this.nextScramble = this.fetchScramble();
    const p = await api<Snap>('preview', { scramble: this.scramble });
    this.preview = p;
    this.notify();
  }

  // Phases
  //
  // Space down holds, held past holdMs the clock arms, and release starts it. With
  // inspection on, the first press and release starts the 15 seconds and the hold
  // comes after. While running any key stops the clock, or with splits on marks the
  // end of the cross, F2L and OLL first. A key that stopped the clock has to come up
  // before it can arm the next solve
  get modalOpen() { return this.openSolve != null; }
  private stopCode = '';
  // A key or touch went down. Space and touch arm and start; while running any key
  // marks a split or stops
  down(code: string) {
    if (!this.loaded || !this.scramble || this.needKeyup) return;
    if (this.phase === 'running') {
      if (this.lap()) { this.needKeyup = true; this.stopCode = code; }
      return;
    }
    if (code !== 'Space' && code !== 'Pointer') return;
    if (this.phase === 'idle' && this.settings.inspection) { this.armInspect = true; return; }
    if (this.phase === 'idle' || this.phase === 'inspect') {
      this.holdFrom = this.phase;
      this.holdStart = performance.now();
      this.phase = this.settings.holdMs ? 'holding' : 'ready';
      this.notify();
    }
  }
  up(code: string) {
    if (code === this.stopCode) { this.needKeyup = false; this.stopCode = ''; return; }
    if (code !== 'Space' && code !== 'Pointer') return;
    if (this.armInspect) {
      this.armInspect = false;
      this.inspectStart = performance.now();
      this.phase = 'inspect';
      this.notify();
      return;
    }
    if (this.phase === 'holding') { this.phase = this.holdFrom; this.notify(); }
    else if (this.phase === 'ready') this.start();
  }
  cancel() {
    if (this.phase === 'idle') return;
    this.phase = 'idle'; this.armInspect = false; this.liveSplits = [];
    this.notify();
  }
  private start() {
    const now = performance.now();
    this.inspectPenalty = 'ok';
    if (this.holdFrom === 'inspect') {
      const used = now - this.inspectStart;
      this.inspectPenalty = used > INSPECTION_DNF ? 'dnf' : used > INSPECTION ? '+2' : 'ok';
    }
    this.runStart = now;
    this.liveSplits = [];
    this.phase = 'running';
    this.notify();
  }
  // True when the press stopped the clock rather than marking a split
  private lap() {
    const t = performance.now() - this.runStart;
    if (this.settings.splits && this.liveSplits.length < 3) {
      this.liveSplits = [...this.liveSplits, t];
      this.notify();
      return false;
    }
    this.stop(t);
    return true;
  }
  private async stop(t: number) {
    this.phase = 'idle';
    const s: Solve = {
      id: db.newId(), session: this.sessionId, time: Math.round(t), penalty: this.inspectPenalty,
      scramble: this.scramble, date: Date.now(),
      ...(this.liveSplits.length === 3 ? { splits: this.liveSplits.map(Math.round) } : {}),
    };
    this.liveSplits = [];
    this.setSolves([...this.solves, s]);
    this.newScramble();
    await db.put('solves', s);
  }

  // Readouts
  tick() {
    if (this.phase === 'holding' && performance.now() - this.holdStart >= this.settings.holdMs) {
      this.phase = 'ready';
      this.notify();
    }
  }
  inspectLeft() { return INSPECTION - (performance.now() - this.inspectStart); }
  digits() {
    const fromInspect = this.holdFrom === 'inspect' && (this.phase === 'holding' || this.phase === 'ready');
    if (this.phase === 'inspect' || fromInspect) {
      const left = this.inspectLeft();
      return left > 0 ? String(Math.ceil(left / 1000)) : left > INSPECTION - INSPECTION_DNF ? '+2' : 'DNF';
    }
    if (this.phase === 'running') {
      if (this.settings.hide) return 'SOLVE';
      const cs = Math.floor((performance.now() - this.runStart) / 10) * 10;
      return fmt(cs);
    }
    if (this.phase === 'holding' || this.phase === 'ready') return '0.00';
    const last = this.solves[this.solves.length - 1];
    return last ? fmtSolve(last) : '0.00';
  }
  last() { return this.solves[this.solves.length - 1] ?? null; }
}

export const timer = new Timer();

export function useTimer() {
  useSyncExternalStore(timer.subscribe, timer.getVersion);
  return timer;
}
