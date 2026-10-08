import { useEffect, useState } from 'react';
import { sim, useSim } from './sim';
import { timer, useTimer } from './timer/timer';
import { SimPage } from './pages/SimPage';
import { TimerPage } from './pages/TimerPage';
import { StatsPage } from './pages/StatsPage';
import { SolveDetail } from './components/SolveDetail';

const REPO = 'https://github.com/godking123/cubealgos';
const ROUTES = [
  { path: '', name: 'Timer', title: 'CubeAlgos — Rubik\'s Cube Timer' },
  { path: 'stats', name: 'Stats', title: 'Stats & Coaching — CubeAlgos' },
  { path: 'sim', name: 'Simulator', title: 'Cube Simulator — CubeAlgos' },
];

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
        <span className="r">{s.online ? '' : s.statusText === 'Offline' ? 'Offline' : 'Loading...'}</span>
      </header>
      {route.path === 'sim' ? <SimPage /> : route.path === 'stats' ? <StatsPage /> : <TimerPage />}
      <footer id="foot">
        <span>Runs in your browser</span>
        <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
      </footer>
      {t.openSolve && <SolveDetail />}
    </div>
  );
}
