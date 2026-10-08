import { useSyncExternalStore } from 'react';
import { api } from './engine';
import {
  AXIS_OF_FACE, CORNER_NAMES, COLOR_NAMES, CUBIES, EDGE_NAMES, FACE_LETTER, GAP,
  HOME_ORBIT, MOVE_RE, PEEK_OF_FACE, ROT_FACE, SCRAMBLE_TEMPO, clampX, ease,
  faceVisible, tempoOf, wrap, type Kind, type Snap,
} from './cube';

export interface Group { label: string; tokens: string[]; caseName?: string; startSnap?: Snap }
export interface Plan { groups: Group[]; pos: number; total: number }
export type Stage = 'cross' | 'f2l' | 'oll' | 'pll' | 'done';
export type Method = 'cfop' | 'kociemba';
interface Opts {
  turn: number; gap: number;
  dim: boolean; grey: boolean; card: boolean; cam: boolean; idle: boolean; rgb: boolean; modern: boolean;
}
export type OptKey = 'dim' | 'grey' | 'card' | 'cam' | 'idle' | 'rgb' | 'modern';
interface Piece { kind: Kind; idx: number }
interface Err { error?: string }

export const STAGE_NAMES: Record<Stage, string> = { cross: 'Cross', f2l: 'F2L', oll: 'OLL', pll: 'PLL', done: 'Solved' };
const LOG_LIMIT = 400;  // Oldest Lines Drop Past This
const ZOOM_MIN = 0.4, ZOOM_MAX = 2.2;  // User Zoom Over the Fitted Size
const QS = new URLSearchParams(location.search);
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* Private Window */ } },
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const HELP = [
  'moves: R U R\' U\' x y2 ...',
  'scramble | reset | undo | back | plan | step | play | solve | apply | clear',
  'bestcross | pair [DFR|DLF|DBL|DRB] | f2l | oll | pll | kociemba',
  'method cfop|kociemba | tempo 0-100 | view reset | modern | colour | grey | card | help',
];

// The simulator's state and every action on it, outside React
//
// Moves are animated by writing transforms straight onto the cubie elements, sixty
// times a second, which React re-rendering could not keep up with. Everything the
// panels show lives here too, and render() bumps a version that useSim subscribes
// to, so the components re-read it whenever the cube or the plan changes
class Sim {
  version = 0;
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private notify() { this.version++; this.listeners.forEach(f => f()); }

  snap: Snap | null = null;
  online = false;
  statusText = 'Booting';
  opId = 'CUBE_0X' + Math.floor(Math.random() * 4096).toString(16).toUpperCase().padStart(3, '0');
  method: Method = 'cfop';
  tempo = 50;
  opts: Opts = { turn: 220, gap: 160, dim: true, grey: false, card: true, cam: true, idle: true, rgb: true, modern: true };
  plan: Plan | null = null;
  playing = false;
  busy = false;
  solves = 0;
  scrambleMoves: string[] = [];
  scramblePos = 0;
  logLines: { id: number; text: string; cls?: string }[] = [];
  private logId = 0;
  picked: Piece | null = null;
  hover: Piece | null = null;
  frontAway = false;

  // Viewport Elements, Set While It Is Mounted
  private cubieEls: (HTMLDivElement | null)[] = [];
  private sceneEl: HTMLDivElement | null = null;
  private cubeEl: HTMLDivElement | null = null;
  private fitZoom = 1;
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(store.get('zoom') || 1) || 1));

  log(text: string, cls?: string) {
    this.logLines = [...this.logLines.slice(-(LOG_LIMIT - 1)), { id: this.logId++, text, cls }];
    this.notify();
  }
  status(text: string) { this.statusText = text; this.notify(); }

  // Camera
  //
  // One loop owns the orbit: a drag sets it directly and leaves a velocity behind,
  // which decays into a stop; a target, set when the next move's face is hidden,
  // eases the view round the short way; and after a while untouched the cube drifts
  // and bobs on its own until something happens
  //
  // The ease runs on elapsed time, not frames, and its time constant follows the turn
  // time, so at fast tempos the camera keeps up instead of holding the solve back
  orbit = { ...HOME_ORBIT };
  cam = { vx: 0, vy: 0, target: null as { x: number; y: number } | null,
          drag: null as { x: number; y: number; t: number } | null,
          moved: false, lastInput: 0, bob: 0, last: 0 };
  private camTau() { return Math.max(70, Math.min(360, this.opts.turn * 1.6 + 40)); }  // Ease Time Constant, ms
  private lastOrbit = '';

  private applyOrbit() {
    const key = this.orbit.x.toFixed(2) + ',' + this.orbit.y.toFixed(2);
    if (key === this.lastOrbit) return;
    this.lastOrbit = key;
    if (this.cubeEl) this.cubeEl.style.transform = `rotateX(${this.orbit.x}deg) rotateY(${this.orbit.y}deg)`;
    const away = !this.visible('F');
    if (away !== this.frontAway) { this.frontAway = away; this.notify(); }
  }
  private camLoop = (now: number) => {
    const { cam, orbit } = this;
    const dt = Math.min(100, now - (cam.last || now));
    cam.last = now;
    if (!cam.drag) {
      if (cam.target) {
        const dx = cam.target.x - orbit.x, dy = wrap(cam.target.y - orbit.y);
        const k = 1 - Math.exp(-dt / this.camTau());
        orbit.x += dx * k; orbit.y += dy * k;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) cam.target = null;
      } else {
        orbit.y += cam.vy; orbit.x = clampX(orbit.x + cam.vx);
        cam.vx *= .94; cam.vy *= .94;
        if (Math.abs(cam.vx) < .03) cam.vx = 0;
        if (Math.abs(cam.vy) < .03) cam.vy = 0;
        const idle = this.opts.idle && !this.playing && !this.busy && now - cam.lastInput > 2500;
        if (idle) {
          orbit.y += .05;
          orbit.x += (Math.sin(now / 3100) * 8 - 24 - orbit.x) * .004;
          cam.bob += (Math.sin(now / 1500) * 7 - cam.bob) * .05;
        } else cam.bob *= .95;
        this.applyScale();
      }
      orbit.y = wrap(orbit.y);
      this.applyOrbit();
    }
    this.raf = requestAnimationFrame(this.camLoop);
  };
  private raf = 0;
  private applyScale() {
    if (this.sceneEl) this.sceneEl.style.transform = `scale(${this.fitZoom * this.zoom}) translateY(${this.cam.bob.toFixed(2)}px)`;
  }
  setZoom(z: number) {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    store.set('zoom', this.zoom.toFixed(3));
    this.applyScale();
    this.notify();
  }
  visible(letter: string) { return faceVisible(this.orbit, letter); }
  private nearOrbit(t: { x: number; y: number }) {
    return Math.abs(t.x - this.orbit.x) < 4 && Math.abs(wrap(t.y - this.orbit.y)) < 4;
  }
  // Done once the face has come into view, the camera settles the rest of the way
  // while the move plays
  private waitCam(ms: number, face: string) {
    return new Promise<void>(res => {
      const t0 = performance.now();
      const tick = () => (!this.cam.target || this.visible(face) || performance.now() - t0 > ms)
        ? res() : requestAnimationFrame(tick);
      tick();
    });
  }
  viewReset() { this.cam.target = { ...HOME_ORBIT }; this.cam.vx = this.cam.vy = 0; }

  // Viewport Mount: Elements, Camera Loop, Drag and Resize
  setCubieEl(i: number, el: HTMLDivElement | null) { this.cubieEls[i] = el; }
  mountView(viewport: HTMLElement, scene: HTMLDivElement, cube: HTMLDivElement) {
    this.sceneEl = scene; this.cubeEl = cube; this.lastOrbit = '';
    this.placeAll();
    const fit = () => {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      this.fitZoom = Math.max(.5, Math.min(1.6, Math.min(w, h * .82) / 480));
      this.applyScale();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(viewport);
    this.raf = requestAnimationFrame(this.camLoop);

    // Drag orbits directly; the velocity of the last frames carries on after release
    const { cam, orbit } = this;
    const start = (x: number, y: number) => {
      cam.drag = { x, y, t: performance.now() }; cam.moved = false; cam.vx = cam.vy = 0;
      cam.target = null; cam.lastInput = performance.now();
    };
    const move = (x: number, y: number) => {
      if (!cam.drag) return;
      const now = performance.now(), dt = Math.max(1, now - cam.drag.t);
      const dy = (x - cam.drag.x) * .4, dx = -(y - cam.drag.y) * .4;
      orbit.y = wrap(orbit.y + dy); orbit.x = clampX(orbit.x + dx);
      cam.vy = cam.vy * .5 + (dy / dt) * 16 * .5; cam.vx = cam.vx * .5 + (dx / dt) * 16 * .5;
      if (Math.abs(x - cam.drag.x) + Math.abs(y - cam.drag.y) > 2) cam.moved = true;
      cam.drag.x = x; cam.drag.y = y; cam.drag.t = now; cam.lastInput = now;
      this.applyOrbit();
    };
    const end = () => {
      if (!cam.drag) return;
      if (performance.now() - cam.drag.t > 80) cam.vx = cam.vy = 0;
      cam.drag = null; cam.lastInput = performance.now();
    };
    // Presses on the viewport's own buttons are clicks, not drags
    const onButton = (e: Event) => !!(e.target as Element).closest('button');
    const md = (e: MouseEvent) => { if (!onButton(e)) start(e.clientX, e.clientY); };
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    // Two fingers pinch to zoom instead of orbiting
    let pinch: { d: number; z: number } | null = null;
    const span = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const ts = (e: TouchEvent) => {
      if (onButton(e)) return;
      if (e.touches.length === 2) { pinch = { d: span(e), z: this.zoom }; cam.drag = null; return; }
      start(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tm = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) { this.setZoom(pinch.z * span(e) / pinch.d); return; }
      move(e.touches[0].clientX, e.touches[0].clientY);
    };
    const te = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; end(); };
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015)); };
    viewport.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', end);
    viewport.addEventListener('touchstart', ts, { passive: true });
    viewport.addEventListener('touchmove', tm, { passive: true });
    viewport.addEventListener('touchend', te);
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cancelAnimationFrame(this.raf);
      ro.disconnect();
      viewport.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', end);
      viewport.removeEventListener('touchstart', ts);
      viewport.removeEventListener('touchmove', tm);
      viewport.removeEventListener('touchend', te);
      viewport.removeEventListener('wheel', wheel);
      this.sceneEl = this.cubeEl = null;
    };
  }

  private baseTransform(pos: number[]) { return `translate3d(${pos[0]*GAP}px, ${-pos[1]*GAP}px, ${pos[2]*GAP}px)`; }
  private placeAll() {
    CUBIES.forEach((c, i) => { const el = this.cubieEls[i]; if (el) el.style.transform = this.baseTransform(c.pos); });
  }

  // Readouts and step tracking re-derive from snap and plan, so every change to either
  // goes through here
  render() {
    if (!this.snap) return;
    this.captureStart();
    if (!this.busy && !this.playing)
      this.statusText = this.plan ? (this.plan.pos ? 'Paused' : 'Solution ready')
                      : this.snap.solved ? 'Solved' : 'Scrambled';
    this.notify();
  }

  stageOf(s: Snap): Stage {
    if (s.solved) return 'done';
    if (!s.cross) return 'cross';
    if (!s.f2l) return 'f2l';
    if (!s.oll) return 'oll';
    return 'pll';
  }
  // While a sequence is loaded the stage is the group being followed, since a pair
  // algorithm can break the cross for a few moves and the live state would flip back
  currentStage(): Stage {
    if (this.plan) {
      const l = this.groupAt(this.plan.pos).g.label.toLowerCase();
      const st = l.includes('cross') ? 'cross' : l.includes('pair') ? 'f2l' : l.includes('oll') ? 'oll' : l.includes('pll') ? 'pll' : null;
      if (st) return st;
    }
    return this.stageOf(this.snap!);
  }

  // The cube as each step found it, taken on a render at the step's first move while
  // nothing is in flight; applyTokens renders mid-step with the position not yet
  // advanced, and a capture there would record the state one move late
  private captureStart() {
    if (!this.plan || this.busy) return;
    const { g } = this.groupAt(this.plan.pos);
    if (this.plan.pos === this.groupStart(g)) g.startSnap = this.snap!;
  }

  // Only while a solution is being followed, and only the pieces its current step moves
  // A pair counts as done if it was home when the step began: algs lift finished pairs
  // out and put them back, and the live flags would grey them out on the way
  stagePieces() {
    const set = new Set<string>();
    if (this.method !== 'cfop' || !this.following() || !this.plan) return set;
    const cur = this.currentStage();
    const add = (kind: Kind, piece: number) => set.add(kind + piece);
    if (cur === 'cross') [4,5,6,7].forEach(p => add('e', p));
    if (cur === 'f2l') {
      [4,5,6,7].forEach(p => add('e', p));
      const { g } = this.groupAt(this.plan.pos);
      const m = g.label.match(/\b(DFR|DLF|DBL|DRB)\b/);
      const done = (g.startSnap || this.snap!).pairs;
      const slots = m ? [CORNER_NAMES.indexOf(m[1]) - 4] : [0,1,2,3].filter(k => !done[k]);
      for (const k of slots) { add('c', 4 + k); add('e', 8 + k); }
      for (const k of [0,1,2,3]) if (done[k]) { add('c', 4 + k); add('e', 8 + k); }
    }
    if (cur === 'oll' || cur === 'pll') [0,1,2,3].forEach(k => { add('c', k); add('e', k); });
    return set;
  }

  groupStart(g: Group) {
    let n = 0;
    for (const h of this.plan!.groups) { if (h === g) return n; n += h.tokens.length; }
    return n;
  }
  groupAt(pos: number) {
    const gs = this.plan!.groups;
    let n = 0;
    for (const g of gs) { if (pos < n + g.tokens.length) return { g, i: pos - n }; n += g.tokens.length; }
    return { g: gs[gs.length - 1], i: 0 };
  }
  // The OLL or PLL step under way, for the case card
  caseStep() {
    if (!this.plan || !this.opts.card) return null;
    const { g } = this.groupAt(this.plan.pos);
    const kind = g.label === 'OLL' ? 'oll' as const : g.label === 'PLL' ? 'pll' as const : null;
    if (!kind || !g.startSnap) return null;
    return { g, kind, i: this.plan.pos - this.groupStart(g) };
  }
  planTokens() { return this.plan ? this.plan.groups.flatMap(g => g.tokens) : []; }
  nextToken() { return this.plan && this.plan.pos < this.plan.total ? this.planTokens()[this.plan.pos] : null; }
  following() { return !!this.plan && (this.playing || this.plan.pos > 0); }

  pick(kind: Kind, idx: number) {
    if (this.cam.moved) return;
    this.picked = (this.picked && this.picked.kind === kind && this.picked.idx === idx) ? null : { kind, idx };
    this.notify();
  }
  pickMessage() {
    const p = this.picked, s = this.snap;
    if (!p || !s) return null;
    if (p.kind === 'c') return `cp[${p.idx}] ${CORNER_NAMES[p.idx]} <- ${CORNER_NAMES[s.cp[p.idx]]} twist ${s.co[p.idx]}`;
    if (p.kind === 'e') return `ep[${p.idx}] ${EDGE_NAMES[p.idx]} <- ${EDGE_NAMES[s.ep[p.idx]]} flip ${s.eo[p.idx]}`;
    return `centre ${FACE_LETTER[p.idx]} ${COLOR_NAMES[s.faces[p.idx]]}`;
  }
  setHover(p: Piece | null) { this.hover = p; this.notify(); }

  private animateTurn(tok: string) {
    if (this.opts.turn <= 0) return Promise.resolve();
    const isRot = 'xyz'.includes(tok[0]);
    const face = isRot ? ROT_FACE[tok[0]] : tok[0];
    const [axis, css, sign] = AXIS_OF_FACE[face];
    const turns = tok.endsWith('2') ? 2 : 1, dir = tok.endsWith("'") ? -1 : 1;
    const side = 'URF'.includes(face) ? 1 : -1;
    const angle = 90 * turns * dir * sign;
    const layer = CUBIES.map((c, i) => ({ c, el: this.cubieEls[i] }))
      .filter(({ c, el }) => el && (isRot || c.pos[axis] === side));
    const dur = this.opts.turn * (turns === 2 ? 1.5 : 1);
    return new Promise<void>(res => {
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / dur), a = angle * ease(t);
        for (const { c, el } of layer) el!.style.transform = `rotate${css}(${a}deg) ` + this.baseTransform(c.pos);
        if (t < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
  }

  // Actions run one after another, so a burst of key presses or clicks lands every
  // move in order instead of dropping the ones that arrive mid-animation
  private queue: { fn: () => Promise<unknown> | unknown; res: () => void }[] = [];
  pumping = false;
  run(fn: () => Promise<unknown> | unknown) {
    if (this.queue.length > 16) return Promise.resolve();
    return new Promise<void>(res => { this.queue.push({ fn, res }); if (!this.pumping) this.pump(); });
  }
  private async pump() {
    this.pumping = true;
    while (this.queue.length) {
      const { fn, res } = this.queue.shift()!;
      try { await fn(); } catch (e) { this.log('error: ' + (e instanceof Error ? e.message : e), 'err'); }
      res();
    }
    this.pumping = false;
  }

  // Moves made by hand invalidate a plan, since it was computed for the state before them
  async applyTokens(tokens: string[], { quiet = false, keepPlan = false, onEach = null as null | (() => void) } = {}) {
    if (this.busy || !tokens.length) return false;
    const bad = tokens.find(t => !MOVE_RE.test(t));
    if (bad) { this.log('unknown move: ' + bad, 'err'); return false; }
    this.busy = true;
    try {
      if (!keepPlan && this.plan) { this.plan = null; this.log('plan dropped: manual move'); }
      if (this.opts.turn > 0) {
        for (const t of tokens) {
          const [res] = await Promise.all([api<Snap & Err>('apply', { seq: t }), this.animateTurn(t)]);
          if (res.error) { this.log(res.error, 'err'); this.placeAll(); return false; }
          this.snap = res; this.placeAll(); this.render();
          if (onEach) onEach();
        }
      } else {
        const res = await api<Snap & Err>('apply', { seq: tokens.join(' ') });
        if (res.error) { this.log(res.error, 'err'); return false; }
        this.snap = res; this.render();
      }
      if (!quiet) this.log(tokens.join(' '));
      return true;
    } finally { this.busy = false; }
  }

  private setPlan(groups: Group[]) {
    const gs = groups.filter(g => g.tokens.length);
    this.plan = gs.length ? { groups: gs, pos: 0, total: gs.reduce((n, g) => n + g.tokens.length, 0) } : null;
    this.render();
  }
  step = async () => {
    const t = this.nextToken(); if (!t) return false;
    if (this.opts.cam && !this.cam.drag) {
      const face = 'xyz'.includes(t[0]) ? null : t[0];
      const want = face && (PEEK_OF_FACE[face] || HOME_ORBIT);
      if (face && want && !this.visible(face) && !this.nearOrbit(want)) {
        this.cam.target = { ...want };
        await this.waitCam(Math.min(1200, this.opts.turn * 3), face);
      }
    }
    if (!await this.applyTokens([t], { quiet: true, keepPlan: true })) return false;
    if (!this.plan) return false;  // Cleared While the Move Was in Flight
    this.plan.pos++;
    if (this.plan.pos >= this.plan.total) {
      this.plan = null;
      if (this.snap!.solved) { this.solves++; this.log('solved', 'ok'); }
    }
    this.render();
    return true;
  };
  back = async () => {
    if (this.busy || this.playing) return;
    if (!this.plan) return this.undo();
    if (this.plan.pos === 0) return;
    const res = await api<Snap>('undo');
    if (!this.plan) return;
    this.snap = res; this.plan.pos--; this.render();
  };
  play = async () => {
    if (this.playing) { this.playing = false; return; }
    this.playing = true; this.status('Solving'); this.render();
    while (this.playing && this.nextToken()) {
      if (!await this.step()) break;
      if (this.opts.gap && this.nextToken()) await sleep(this.opts.gap);
    }
    this.playing = false; this.render();
  };
  applyAll = async () => {
    if (!this.plan) return;
    const rest = this.planTokens().slice(this.plan.pos), saveTurn = this.opts.turn;
    this.opts.turn = 0;
    const ok = await this.applyTokens(rest, { quiet: true, keepPlan: true });
    this.opts.turn = saveTurn;
    if (ok) {
      this.plan = null;
      if (this.snap!.solved) this.solves++;
      this.log('applied: ' + rest.join(' ')); this.render();
    }
  };

  private fail(res: Err) { if (res.error) { this.log(res.error, 'err'); return true; } return false; }
  private found(label: string, moves: string[], caseName = '') {
    this.setPlan([{ label, tokens: moves, caseName }]);
    this.log(`${label}: ${moves.length ? moves.join(' ') : '(nothing)'}`, 'ok');
  }
  bestCross = async () => {
    const r = await api<Err & { color: string; rotation: string; moves: string[] }>('bestcross'); if (this.fail(r)) return;
    const rot = r.rotation ? r.rotation.split(' ') : [];
    this.found(`${r.color} cross`, [...rot, ...r.moves]);
  };
  insertPair = async (slot: number) => {
    const r = await api<Err & { moves: string[] }>('pair', { slot }); if (this.fail(r)) return;
    this.found(`${CORNER_NAMES[4 + slot]} pair`, r.moves);
  };
  finishF2L = async () => {
    const r = await api<Err & { pairs: { slot: number; moves: string[] }[] }>('f2l'); if (this.fail(r)) return;
    this.setPlan(r.pairs.map(p => ({ label: `${CORNER_NAMES[4 + p.slot]} pair`, tokens: p.moves })));
    for (const p of r.pairs) this.log(`${CORNER_NAMES[4 + p.slot]} pair: ${p.moves.join(' ')}`, 'ok');
  };
  oll = async () => { const r = await api<Err & { case: string; moves: string[] }>('oll'); if (this.fail(r)) return; this.found('OLL', r.moves, r.case); };
  pll = async () => { const r = await api<Err & { case: string; moves: string[] }>('pll'); if (this.fail(r)) return; this.found('PLL', r.moves, r.case); };
  kociemba = async () => {
    this.status('Searching');
    const r = await api<Err & { moves: string[] }>('kociemba'); if (this.fail(r)) return;
    this.found('Kociemba', r.moves);
    return r.moves.length;
  };

  // Whole solve with the chosen method; CFOP folds the rotation into its first step
  planSolution = async () => {
    if (this.busy || this.playing) return false;
    if (this.snap!.solved) return false;
    if (this.opts.cam && !this.visible('F')) this.cam.target = { ...HOME_ORBIT };
    if (this.method === 'kociemba') return (await this.kociemba()) != null;
    this.status('Searching');
    const r = await api<Err & { rotation: string; steps: { label: string; case: string; moves: string[] }[] }>('cfop');
    if (this.fail(r)) return false;
    const rot = r.rotation ? r.rotation.split(' ') : [];
    this.setPlan(r.steps.map((s, i) => ({ label: s.label, tokens: i === 0 ? [...rot, ...s.moves] : s.moves, caseName: s.case })));
    this.log(`cfop: ${this.plan ? this.plan.total : 0} moves`, 'ok');
    for (const s of r.steps) this.log(`  ${s.label}: ${s.moves.length ? s.moves.join(' ') : '(done)'}`);
    return true;
  };
  playSolution = async () => {
    if (this.busy || this.playing) return;
    if (!await this.planSolution()) return;
    await this.play();
  };

  // A scramble is fetched and then played out as real moves on a reset cube
  scramble = async () => {
    if (this.busy || this.playing) return;
    this.status('Scrambling');
    const r = await api<Err & { moves: string[] }>('wca'); if (this.fail(r)) return;
    this.snap = await api<Snap>('reset'); this.plan = null;
    this.scrambleMoves = r.moves; this.scramblePos = 0; this.render();
    this.log('scramble: ' + r.moves.join(' '), 'ok'); this.status('Scrambling');
    const save = { turn: this.opts.turn, gap: this.opts.gap };
    Object.assign(this.opts, this.opts.turn ? SCRAMBLE_TEMPO : { turn: 0, gap: 0 });
    await this.applyTokens(r.moves, { quiet: true, onEach: () => { this.scramblePos++; this.notify(); } });
    Object.assign(this.opts, save);
    this.scramblePos = this.scrambleMoves.length; this.render();
  };
  // A timer solve's scramble on the cube, applied at once, with its CFOP solution loaded
  watch(moves: string[]) {
    this.playing = false;
    this.queue.splice(0).forEach(q => q.res());
    this.run(async () => {
      const r = await api<Snap & Err>('reset');
      if (this.fail(r)) return;
      this.snap = r; this.plan = null;
      this.scrambleMoves = moves; this.scramblePos = moves.length;
      const save = this.opts.turn;
      this.opts.turn = 0;
      await this.applyTokens(moves, { quiet: true });
      this.opts.turn = save;
      if (this.method !== 'cfop') this.setMethod('cfop');
      this.log('timer solve: ' + moves.join(' '), 'ok');
      await this.planSolution();
    });
  }
  reset = async () => {
    if (this.busy || this.playing) return;
    this.snap = await api<Snap>('reset'); this.plan = null; this.scrambleMoves = [];
    this.render(); this.log('reset');
  };
  undo = async () => {
    if (this.busy || this.playing) return;
    this.plan = null; this.snap = await api<Snap>('undo'); this.render();
  };
  clearPlan() { this.plan = null; this.render(); }

  // Space: scramble a solved cube, load the sequence for a scrambled one, then play
  // or pause it; the arrows step through it one move at a time
  impulse = () => {
    if (!this.snap) return;
    if (this.playing) { this.play(); return; }
    if (this.pumping) return;
    this.run(() => this.plan ? this.play() : this.snap!.solved ? this.scramble() : this.planSolution());
  };
  manual = (tokens: string[]) => { if (!this.playing && this.snap) this.run(() => this.applyTokens(tokens)); };
  escape() {
    this.plan = null; this.playing = false;
    this.queue.splice(0).forEach(q => q.res());
    this.render();
  }

  async setState(arrays: Record<'cp' | 'co' | 'ep' | 'eo', string>) {
    const r = await api<Snap & Err>('set', arrays);
    if (r.error) return r.error;
    this.snap = r; this.plan = null; this.render(); this.log('state edited');
    return null;
  }

  setMethod(m: Method) { this.method = m; this.plan = null; this.render(); this.log('method: ' + m); }
  setOpt(key: OptKey, on: boolean) { this.opts[key] = on; store.set(key, on ? '1' : '0'); this.notify(); }
  setTempo(v: number) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    const t = tempoOf(v); this.opts.turn = t.turn; this.opts.gap = t.gap; this.tempo = v;
    store.set('tempo', String(v)); this.notify();
  }

  runCommand = async (line: string) => {
    const text = line.trim();
    if (!text) return;
    const words = text.split(/\s+/);
    const cmd = words[0].toLowerCase(), arg = (words[1] || '').toLowerCase();
    if (words.every(w => MOVE_RE.test(w))) { this.manual(words); return; }
    this.log(text);
    if (!this.snap) { this.log('engine still loading', 'err'); return; }
    switch (cmd) {
      case 'scramble': return this.run(this.scramble);
      case 'reset': return this.run(this.reset);
      case 'undo': return this.run(this.undo);
      case 'back': return this.run(this.back);
      case 'solve': return this.run(this.playSolution);
      case 'plan': return this.run(this.planSolution);
      case 'step': case 'next': return this.run(this.step);
      case 'play': return this.impulse();
      case 'apply': case 'finish': return this.run(this.applyAll);
      case 'clear': return this.clearPlan();
      case 'bestcross': return this.bestCross();
      case 'pair': {
        const k = CORNER_NAMES.indexOf(arg.toUpperCase()) - 4;
        return this.insertPair(k >= 0 && k < 4 ? k : [0,1,2,3].find(s => !this.snap!.pairs[s]) ?? 0);
      }
      case 'f2l': return this.finishF2L();
      case 'oll': return this.oll();
      case 'pll': return this.pll();
      case 'kociemba': return this.kociemba();
      case 'method':
        if (arg === 'cfop' || arg === 'kociemba') return this.setMethod(arg);
        this.log('method cfop | kociemba', 'err'); return;
      case 'tempo': {
        const v = +arg;
        if (arg !== '' && v >= 0 && v <= 100) this.setTempo(v); else this.log('tempo 0 (learn) to 100 (instant)', 'err');
        return;
      }
      case 'view': return this.viewReset();
      case 'modern': return this.setOpt('modern', !this.opts.modern);
      case 'colour': case 'color': return this.setOpt('rgb', !this.opts.rgb);
      case 'grey': case 'gray': return this.setOpt('grey', !this.opts.grey);
      case 'card': return this.setOpt('card', !this.opts.card);
      case 'help': HELP.forEach(l => this.log(l)); return;
      default: this.log(`unknown command: ${cmd}. type help`, 'err');
    }
  };

  // Keyboard: face letters turn (Shift for prime), x y z rotate, Space drives the solve,
  // arrows step, Escape drops the plan
  bindKeys() {
    // A clicked button must not keep focus, or the next Space would click it again
    const click = (e: MouseEvent) => { const b = (e.target as HTMLElement).closest('button'); if (b) b.blur(); };
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'SUMMARY' || e.metaKey || e.ctrlKey || e.altKey) return;
      this.cam.lastInput = performance.now();
      const k = e.key.toLowerCase();
      if (k.length === 1 && 'urfdlb'.includes(k)) { this.manual([k.toUpperCase() + (e.shiftKey ? "'" : '')]); e.preventDefault(); }
      else if (k.length === 1 && 'xyz'.includes(k)) { this.manual([k + (e.shiftKey ? "'" : '')]); e.preventDefault(); }
      else if (e.key === ' ') { this.impulse(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { if (this.plan && !this.playing) this.run(this.step); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { if (!this.playing) this.run(this.back); e.preventDefault(); }
      else if (e.key === 'Escape') this.escape();
    };
    document.addEventListener('click', click);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); window.removeEventListener('keydown', key); };
  }

  private booted = false;
  async boot() {
    if (this.booted) return;
    this.booted = true;
    const tempo = store.get('tempo');
    this.setTempo(tempo != null && tempo !== '' && !isNaN(+tempo) && +tempo <= 100 ? +tempo : 50);
    for (const k of ['dim', 'card', 'cam', 'idle', 'rgb', 'modern'] as const) if (store.get(k) === '0') this.opts[k] = false;
    this.opts.grey = store.get('grey') === '1';
    if (QS.get('method') === 'kociemba') this.method = 'kociemba';
    if (QS.get('orbit')) { const [x, y] = QS.get('orbit')!.split(',').map(Number); this.orbit = { x, y }; }
        this.status('Loading engine');
    const s = await api<Snap & Err>('state');
    if (s.error) { this.status('Offline'); this.log(s.error, 'err'); return; }
    this.snap = s; this.online = true; this.render();
    this.log('ready. type help for commands');
    for (const c of (QS.get('run') || '').split(';')) if (c.trim()) await this.runCommand(c);
  }
}

export const sim = new Sim();

// Re-renders the calling component on every sim change and hands back the sim to read
export function useSim() {
  useSyncExternalStore(sim.subscribe, sim.getVersion);
  return sim;
}
