export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const lerp = (a, b, t) => a + (b - a) * t;

export const rand = (a, b) => a + Math.random() * (b - a);

export const randInt = (a, bInclusive) => Math.floor(rand(a, bInclusive + 1));

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

