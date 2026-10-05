// Like setInterval, but skips runs while the browser tab is hidden, and
// catches up once when the person comes back if a run was missed. Saves
// the database from timers ticking in background tabs nobody is looking at.
// Returns a function that stops it.
export function setVisibleInterval(fn: () => void, ms: number): () => void {
  let lastRun = Date.now();
  const run = () => {
    lastRun = Date.now();
    fn();
  };
  const iv = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    run();
  }, ms);
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun >= ms) run();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(iv);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
