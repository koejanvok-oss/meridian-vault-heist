// Vision: raycasts and cones. A guard or a camera sees the thief only when
// the thief is inside its cone, in range, and a ray from its eye to the
// thief crosses no sight-blocking solid and no smoke cloud. The same
// raycasts draw the cone as a polygon, so what the player sees is exactly
// what the rules see.

/** Turn a sight-blocking rectangle into its four edge segments. */
function solidSegments(solids) {
  const segments = [];
  for (const solid of solids) {
    if (!solid.sight) continue;
    const { x, y, w, h } = solid;
    segments.push({ x1: x, y1: y, x2: x + w, y2: y });
    segments.push({ x1: x + w, y1: y, x2: x + w, y2: y + h });
    segments.push({ x1: x + w, y1: y + h, x2: x, y2: y + h });
    segments.push({ x1: x, y1: y + h, x2: x, y2: y });
  }
  return segments;
}

/**
 * Distance from (ox, oy) along the unit direction (dx, dy) to the nearest
 * segment hit, or Infinity when nothing is hit within maxDist. Standard
 * ray-versus-segment intersection: solve for the ray parameter t and the
 * segment parameter u and keep the smallest t with 0 <= u <= 1.
 */
function castRay(ox, oy, dx, dy, maxDist, segments) {
  let best = maxDist;
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    const ex = s.x2 - s.x1;
    const ey = s.y2 - s.y1;
    const denom = dx * ey - dy * ex;
    if (denom === 0) continue;
    const t = ((s.x1 - ox) * ey - (s.y1 - oy) * ex) / denom;
    const u = ((s.x1 - ox) * dy - (s.y1 - oy) * dx) / denom;
    if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

/** Is the point inside any smoke cloud? */
function inSmoke(x, y, smokes) {
  for (let i = 0; i < smokes.length; i += 1) {
    const s = smokes[i];
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < s.radius * s.radius) return true;
  }
  return false;
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Can an eye at (ex, ey) looking along `angle` see the point (tx, ty)?
 * Checks range, cone half-angle, a clear ray, and smoke at either end.
 */
export function canSee(ex, ey, angle, halfAngle, range, tx, ty, segments, smokes) {
  const dx = tx - ex;
  const dy = ty - ey;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1 && angleDifference(Math.atan2(dy, dx), angle) > halfAngle) return false;
  if (inSmoke(ex, ey, smokes) || inSmoke(tx, ty, smokes)) return false;
  const hit = castRay(ex, ey, dx / (dist || 1), dy / (dist || 1), dist, segments);
  return hit >= dist - 0.5;
}

/**
 * The visible cone as a polygon: the eye plus one raycast point per sample
 * across the cone. Smoke shortens a cone that starts inside a cloud.
 */
export function conePolygon(ex, ey, angle, halfAngle, range, segments, samples = 26) {
  const points = [{ x: ex, y: ey }];
  for (let i = 0; i <= samples; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / samples;
    const dist = castRay(ex, ey, Math.cos(a), Math.sin(a), range, segments);
    points.push({ x: ex + Math.cos(a) * dist, y: ey + Math.sin(a) * dist });
  }
  return points;
}

/** Build the segment list once per level from its solids. */
export function buildSegments(solids) {
  return solidSegments(solids);
}
