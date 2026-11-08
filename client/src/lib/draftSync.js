// The composer saves on its way out; other pages wait for that save before
// loading drafts so they never show stale text.
let pending = Promise.resolve();

export const trackSave = (promise) => {
  pending = promise.catch(() => {});
  return promise;
};

export const waitForSaves = () => pending;
