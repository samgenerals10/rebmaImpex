// Like setInterval, but skips runs while the app is in the background, and
// catches up once when the person comes back if a run was missed. Saves
// the database from timers ticking on phones in someone's pocket.
// Returns a function that stops it.
import { AppState } from 'react-native';

export function setActiveInterval(fn: () => void, ms: number): () => void {
  let lastRun = Date.now();
  const run = () => {
    lastRun = Date.now();
    fn();
  };
  const iv = setInterval(() => {
    if (AppState.currentState !== 'active') return;
    run();
  }, ms);
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active' && Date.now() - lastRun >= ms) run();
  });
  return () => {
    clearInterval(iv);
    sub.remove();
  };
}
