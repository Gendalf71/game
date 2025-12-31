export function normalizeSeed(seed) {
  const num = Number(seed);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return num >>> 0;
}

export function createRng(seed) {
  let state = normalizeSeed(seed);
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextUint32() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
    intBetween(min, max) {
      if (max < min) {
        return min;
      }
      const range = max - min + 1;
      return min + (this.nextUint32() % range);
    },
    choice(arr) {
      if (arr.length === 0) {
        return undefined;
      }
      return arr[this.intBetween(0, arr.length - 1)];
    },
  };
}

export function randomSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return Date.now() >>> 0;
}
