// Free hosting sleeps when idle, so the first request can take up to a minute.
// Requests that run longer than WAKE_HINT_MS make a "waking up" notice appear.
const WAKE_HINT_MS = 2500;
const listeners = new Set();
let pending = 0;
let waking = false;

const emit = () => listeners.forEach(fn => fn(waking));

export function trackWake(promise) {
  pending += 1;
  const timer = setTimeout(() => { if (!waking) { waking = true; emit(); } }, WAKE_HINT_MS);
  const done = () => {
    clearTimeout(timer);
    pending -= 1;
    if (pending === 0 && waking) { waking = false; emit(); }
  };
  promise.then(done, done);
  return promise;
}

export function onWakeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
