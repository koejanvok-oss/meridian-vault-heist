# The Meridian Vault

A top-down 2D casino heist game, built for the make.fun
**best-heist-game-20261122-0559** bounty. One thief, three rooms, the
Meridian Casino's vault.

## The heist

Vesper, a thief in a burgundy suit, has to cross the casino floor, lift the
prize and reach the exit — unseen. Three rooms:

1. **The Casino Floor** — slot machines and roulette tables, the
   High-Roller's Case.
2. **The Cashier's Corridor** — the cashier's cage, the Strongbox.
3. **The Vault** — marble, pillars and the Golden Chip.

## How it plays

- **Move** with WASD or arrow keys. Hold Shift to creep slowly.
- **Guards** patrol waypoints with raycast vision cones (blocked by tall
  cover). **Cameras** sweep the floor with their own cones.
- **Alarm meter**: being seen raises it — faster up close. At 100 the
  casino locks down and the guards hunt you. Hide and it falls.
- **Tools**, each with limited uses per room:
  - `1` / `Q` — smoke bomb: a cloud that blocks all vision for 5 s.
  - `2` / `E` — EMP pulse: kills every camera for 7 s.
  - Click — throw a decoy chip: the nearest guard goes to investigate
    the clink.
- **Loot**: chip stacks worth $250–$500, plus the room's main prize
  ($2,500–$10,000), which unlocks the exit. Reach the exit to clear the
  room. Get caught three times and the house wins.
- **Sound** is fully synthesized with WebAudio — footsteps, pickup
  chimes, the alarm siren, smoke, EMP and decoy clinks. `M` mutes.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files.

## Layout

- `game/index.html` — the page and canvas.
- `game/src/main.js` — boot, the fixed-step loop, screens.
- `game/src/world.js` — rules: guards, alarm, tools, loot, win/lose.
- `game/src/vision.js` — raycasts, vision cones, line of sight.
- `game/src/levels.js` — the three rooms, as data.
- `game/src/render.js` — all canvas drawing, HUD and panels.
- `game/src/audio.js` — synthesized WebAudio sounds.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — staged screenshot scenes (autopilot).
- `game/src/config.js` — tuning numbers and palette.
- `game/src/random.js` — seeded random.
- `main.ts` — the make.fun hand-in program.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.
