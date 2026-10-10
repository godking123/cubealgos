import { useEffect, useState } from 'react';
import { sim, useSim } from './sim';
import { timer, useTimer } from './timer/timer';
import { SimPage } from './pages/SimPage';
import { TimerPage } from './pages/TimerPage';
import { StatsPage } from './pages/StatsPage';
import { SolveDetail } from './components/SolveDetail';

const ROUTES = [
  { path: '', name: 'Timer', title: 'CubeAlgos — Rubik\'s Cube Timer' },
  { path: 'stats', name: 'Stats', title: 'Stats & Coaching — CubeAlgos' },
  { path: 'sim', name: 'Simulator', title: 'Cube Simulator — CubeAlgos' },
];

type Theme = 'light' | 'dark';

// Theme starts from what index.html set before first paint; an explicit choice is
// saved, otherwise it keeps following the system
function useTheme(): [Theme, () => void] {
  const root = document.documentElement;
  const [theme, setTheme] = useState<Theme>(root.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    root.dataset.theme = theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#111111' : '#ffffff');
  }, [theme]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => { try { if (localStorage.getItem('theme')) return; } catch { /* Private Window */ } setTheme(mq.matches ? 'dark' : 'light'); };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const toggle = () => setTheme(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch { /* Private Window */ }
    return next;
  });
  return [theme, toggle];
}

// Hash routes, so any static host serves every page from one index.html
function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return ROUTES.find(r => r.path === route) ?? ROUTES[0];
}

export function App() {
  const route = useRoute();
  const s = useSim();
  const t = useTimer();
  const [theme, toggleTheme] = useTheme();
  useEffect(() => { sim.boot(); timer.boot(); }, []);
  useEffect(() => { document.title = route.title; }, [route]);
  const solving = route.path === '' && t.settings.focus && t.phase !== 'idle';
  const cls = [s.opts.rgb && 'rgb', s.opts.modern && 'modern', s.opts.grey && 'greydim', solving && 'focus']
    .filter(Boolean).join(' ');
  return (
    <div id="app" className={cls}>
      <header id="top">
        <a className="brand" href="#/">CUBEALGOS</a>
        <nav className="tabs">
          {ROUTES.map(r => (
            <a key={r.path} href={'#/' + r.path} className={r === route ? 'on' : ''} aria-current={r === route ? 'page' : undefined}>{r.name}</a>
          ))}
        </nav>
        <span className="r">
          <span className="status">{s.online ? '' : s.statusText === 'Offline' ? 'Offline' : 'Loading...'}</span>
          <button className="theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </span>
      </header>
      {route.path === 'sim' ? <SimPage /> : route.path === 'stats' ? <StatsPage /> : <TimerPage />}
      {t.openSolve && <SolveDetail />}
    </div>
  );
}
