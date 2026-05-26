export function getSeededRandom(seed) {
  let state = seed ? Number(seed) : 12345;
  // Fallback for 0 or NaN
  if (!state || isNaN(state)) {
    state = 12345;
  }
  const m = 0x80000000;
  const a = 1103515245;
  const c = 12345;
  return function() {
    state = (a * state + c) % m;
    return state / (m - 1);
  };
}

export function seededShuffleArray(items, randomFunc) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFunc() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
