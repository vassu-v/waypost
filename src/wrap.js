// wrap.js — all the looping-world math lives here.
// The map is a MAP×MAP torus on XZ. Gameplay math stays flat 2D; rendering
// draws the world root plus 8 offset copies so every horizon is continuous.

export const MAP = 400;
export const HALF = MAP / 2;

// canonical position in [0, MAP)
export const wrap = v => ((v % MAP) + MAP) % MAP;

// shortest signed delta from a to b on the loop, in [-HALF, HALF)
export function wrapDelta(a, b) {
  let d = b - a;
  if (d >= HALF) d -= MAP;
  if (d < -HALF) d += MAP;
  return d;
}

// nearest-wrapped-copy distance — the ONLY distance the game is allowed to use
export function wrapDist(x1, z1, x2, z2) {
  return Math.hypot(wrapDelta(x1, x2), wrapDelta(z1, z2));
}

// squared version for cheap comparisons
export function wrapDist2(x1, z1, x2, z2) {
  const dx = wrapDelta(x1, x2), dz = wrapDelta(z1, z2);
  return dx * dx + dz * dz;
}

// the 3×3 copy grid offsets, center copy first (handy for LOD-ing the rest)
export const OFFSETS = [
  [0, 0],
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

// world-space position of the copy of (x,z) nearest to the viewer at (vx,vz)
export function nearestCopy(x, z, vx, vz) {
  return { x: vx + wrapDelta(vx, x), z: vz + wrapDelta(vz, z) };
}
