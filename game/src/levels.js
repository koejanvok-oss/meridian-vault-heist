// The three rooms of the heist. Each level is plain data: solids the thief
// and the guards walk around (sight=true blocks a vision cone, sight=false
// is low cover that hides nobody but still blocks movement), guard patrol
// waypoints, wall cameras, loot, the main prize and the exit. The exit stays
// locked until the main prize is taken, so every level is a route in, a
// grab, and a route out. shotPath is the route the screenshot autopilot
// follows: start, a chip stack, the prize, the exit.

function edgeWalls() {
  return [
    { x: 0, y: 56, w: 1280, h: 18, sight: true, kind: 'wall' },
    { x: 0, y: 700, w: 1280, h: 20, sight: true, kind: 'wall' },
    { x: 0, y: 56, w: 18, h: 664, sight: true, kind: 'wall' },
    { x: 1262, y: 56, w: 18, h: 664, sight: true, kind: 'wall' },
  ];
}

export const LEVELS = [
  {
    name: 'The Casino Floor',
    subtitle: 'Heist 1 of 3 — lift the High-Roller’s Case',
    floor: 'carpet',
    start: { x: 640, y: 655 },
    exit: { x: 34, y: 96, w: 74, h: 56, label: 'SERVICE LIFT' },
    mainLoot: { x: 1150, y: 122, name: 'High-Roller’s Case', value: 2500 },
    loot: [
      { x: 250, y: 250, value: 250 },
      { x: 905, y: 255, value: 250 },
      { x: 470, y: 560, value: 250 },
      { x: 1105, y: 480, value: 250 },
      { x: 130, y: 470, value: 250 },
    ],
    solids: [
      ...edgeWalls(),
      // Two rows of slot machines: tall cover that blocks sight.
      { x: 180, y: 180, w: 96, h: 56, sight: true, kind: 'slot' },
      { x: 306, y: 180, w: 96, h: 56, sight: true, kind: 'slot' },
      { x: 432, y: 180, w: 96, h: 56, sight: true, kind: 'slot' },
      { x: 760, y: 180, w: 96, h: 56, sight: true, kind: 'slot' },
      { x: 886, y: 180, w: 96, h: 56, sight: true, kind: 'slot' },
      { x: 1012, y: 180, w: 96, h: 56, sight: true, kind: 'slot' },
      // Roulette tables: low cover, movement only.
      { x: 560, y: 420, w: 160, h: 92, sight: false, kind: 'table' },
      { x: 300, y: 480, w: 130, h: 84, sight: false, kind: 'table' },
      { x: 900, y: 480, w: 130, h: 84, sight: false, kind: 'table' },
    ],
    guards: [
      { name: 'Marco', path: [[640, 120], [640, 660]], speed: 78 },
      { name: 'Dana', path: [[300, 120], [1000, 120]], speed: 78 },
      { name: 'Reyes', path: [[200, 620], [1080, 620]], speed: 78 },
    ],
    cameras: [
      { x: 210, y: 76, angle: Math.PI / 2 },
      { x: 1070, y: 76, angle: Math.PI / 2 },
    ],
    shotPath: [[640, 560], [470, 560], [470, 300], [905, 255], [1000, 140], [1150, 122], [700, 120], [300, 120], [80, 124]],
  },
  {
    name: 'The Cashier’s Corridor',
    subtitle: 'Heist 2 of 3 — crack the Cashier’s Strongbox',
    floor: 'carpet',
    start: { x: 90, y: 655 },
    exit: { x: 1172, y: 620, w: 74, h: 56, label: 'BACK DOOR' },
    mainLoot: { x: 640, y: 128, name: 'Cashier’s Strongbox', value: 5000 },
    loot: [
      { x: 220, y: 200, value: 250 },
      { x: 1060, y: 200, value: 250 },
      { x: 220, y: 540, value: 250 },
      { x: 1060, y: 540, value: 250 },
      { x: 640, y: 480, value: 250 },
    ],
    solids: [
      ...edgeWalls(),
      // The cashier's cage: a tall glass-and-brass block in the middle.
      { x: 480, y: 260, w: 320, h: 170, sight: true, kind: 'cage' },
      // Counters: low cover flanking the cage.
      { x: 240, y: 300, w: 140, h: 70, sight: false, kind: 'counter' },
      { x: 900, y: 300, w: 140, h: 70, sight: false, kind: 'counter' },
      { x: 240, y: 480, w: 140, h: 70, sight: false, kind: 'counter' },
      { x: 900, y: 480, w: 140, h: 70, sight: false, kind: 'counter' },
      // Pillars holding the corridor's roof.
      { x: 620, y: 120, w: 40, h: 40, sight: true, kind: 'pillar' },
      { x: 620, y: 560, w: 40, h: 40, sight: true, kind: 'pillar' },
    ],
    guards: [
      { name: 'Marco', path: [[440, 470], [440, 140], [840, 140], [840, 470]], speed: 84 },
      { name: 'Dana', path: [[220, 130], [220, 610]], speed: 84 },
      { name: 'Reyes', path: [[220, 610], [1060, 610]], speed: 84 },
    ],
    cameras: [
      { x: 180, y: 76, angle: Math.PI / 2 },
      { x: 640, y: 76, angle: Math.PI / 2 },
      { x: 1100, y: 76, angle: Math.PI / 2 },
    ],
    shotPath: [[220, 540], [220, 200], [420, 140], [640, 128], [900, 140], [1060, 200], [1060, 540], [1172, 648]],
  },
  {
    name: 'The Vault',
    subtitle: 'Heist 3 of 3 — take the Golden Chip and vanish',
    floor: 'marble',
    start: { x: 90, y: 655 },
    exit: { x: 1172, y: 620, w: 74, h: 56, label: 'SERVICE TUNNEL' },
    mainLoot: { x: 640, y: 330, name: 'The Golden Chip', value: 10000 },
    loot: [
      { x: 250, y: 200, value: 500 },
      { x: 1030, y: 200, value: 500 },
      { x: 250, y: 540, value: 500 },
      { x: 1030, y: 540, value: 500 },
      { x: 640, y: 560, value: 500 },
    ],
    solids: [
      ...edgeWalls(),
      // The vault itself: a steel wall with its round door, top centre.
      { x: 440, y: 96, w: 400, h: 150, sight: true, kind: 'vault' },
      // Marble pillars guarding the approach.
      { x: 380, y: 320, w: 44, h: 44, sight: true, kind: 'pillar' },
      { x: 856, y: 320, w: 44, h: 44, sight: true, kind: 'pillar' },
      { x: 380, y: 520, w: 44, h: 44, sight: true, kind: 'pillar' },
      { x: 856, y: 520, w: 44, h: 44, sight: true, kind: 'pillar' },
      // Gold carts: low cover on the vault floor.
      { x: 200, y: 380, w: 120, h: 70, sight: false, kind: 'counter' },
      { x: 960, y: 380, w: 120, h: 70, sight: false, kind: 'counter' },
    ],
    guards: [
      { name: 'Marco', path: [[300, 300], [980, 300]], speed: 96 },
      { name: 'Dana', path: [[980, 470], [300, 470]], speed: 96 },
      { name: 'Reyes', path: [[640, 470], [640, 640], [1060, 640], [1060, 470]], speed: 96 },
    ],
    cameras: [
      { x: 300, y: 76, angle: Math.PI / 2 },
      { x: 980, y: 76, angle: Math.PI / 2 },
      { x: 640, y: 250, angle: Math.PI / 2 },
    ],
    shotPath: [[250, 540], [250, 200], [460, 300], [640, 330], [820, 300], [1030, 200], [1030, 540], [1172, 648]],
  },
];
