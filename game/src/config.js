// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size. The Meridian Casino is all deep green
// felt, brass and burgundy: safe cover reads as dark green, danger as amber
// cones and red alarm, loot as gold.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 235,
  /** Seconds a thrown decoy chip stays audible after landing. */
  decoyRange: 340,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  huntSpeed: 168,
  investigateSpeed: 120,
  /** How long a guard waits at each patrol waypoint, in seconds. */
  waypointPause: 1.6,
  /** Seconds a guard keeps investigating a noise before giving up. */
  investigateTime: 4.5,
  /** Seconds a hunt lasts after the thief is lost from sight. */
  huntMemory: 3.5,
  coneRange: 250,
  coneHalfAngle: 0.61,
};

export const CAMERA = {
  coneRange: 270,
  coneHalfAngle: 0.5,
  /** Seconds for one full sweep out and back. */
  sweepPeriod: 5.0,
  /** Half of the sweep arc, in radians around the camera's base angle. */
  sweepHalfArc: 0.85,
};

export const ALARM = {
  /** Per second while a guard's cone holds the thief, scaled by closeness. */
  guardRate: 34,
  /** Per second while a camera's cone holds the thief. */
  cameraRate: 22,
  /** Per second the meter falls while nobody can see the thief. */
  decayRate: 14,
  /** Per second the meter falls during a hunt once the thief is hidden. */
  huntDecayRate: 6,
  /** At this level the casino locks down and the guards hunt. */
  lockdown: 100,
  /** Below this the lockdown lifts and guards go back to patrol. */
  calmBelow: 45,
};

export const TOOLS = {
  smoke: { start: 3, radius: 95, seconds: 5 },
  emp: { start: 2, seconds: 7 },
  decoy: { start: 3 },
};

export const ATTEMPTS = 3;

export const LOOT = {
  chipValue: 250,
  pickupRadius: 26,
  mainValue: 2500,
};

export const PALETTE = {
  backdrop: '#0a0d0a',
  carpet: '#123626',
  carpetDark: '#0e2c1f',
  carpetLine: '#1d4d33',
  marble: '#2b2b30',
  marbleLine: '#3d3d44',
  brass: '#c9a227',
  brassDim: '#8a6d1f',
  felt: '#1c5c38',
  feltDark: '#134227',
  slotBody: '#3b2a5e',
  slotLight: '#e8b64c',
  machineScreen: '#7fe0c3',
  wall: '#241d16',
  wallTop: '#3a2f22',
  player: '#a62639',
  playerTrim: '#e8c15a',
  guard: '#2e4a7a',
  guardTrim: '#9fb6dd',
  cameraBody: '#20242c',
  cameraLens: '#ff5a4e',
  coneGuard: 'rgba(232, 182, 76, 0.20)',
  coneGuardEdge: 'rgba(232, 182, 76, 0.55)',
  coneCamera: 'rgba(126, 196, 255, 0.16)',
  coneCameraEdge: 'rgba(126, 196, 255, 0.45)',
  coneAlert: 'rgba(255, 70, 50, 0.30)',
  loot: '#ffd94d',
  lootGlow: 'rgba(255, 217, 77, 0.35)',
  exit: '#39d98a',
  exitLocked: '#5a6b62',
  smoke: 'rgba(190, 195, 200, 0.55)',
  hudPanel: '#10160f',
  text: '#f2ead8',
  muted: '#a99f83',
  danger: '#ff5140',
  alarmBar: '#ffb02e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best take is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-vault.best';
