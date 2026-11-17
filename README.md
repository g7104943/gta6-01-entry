# Solmar City — an open-world crime game

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/g7104943/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/g7104943/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar City** is an open-world crime game in the spirit of GTA 6, built as plain
static files that run in a desktop browser with no network request. You are a new
driver for Vic, a small-time fixer in the sun-soaked city of Solmar. Steal a car,
run his jobs, lose the cops, and take the Marlin Casino.

## What is in the game

- **A city to explore** — a road grid with traffic, sidewalks full of pedestrians,
  a park, a beach and a bay, all drawn from a seed so the same city always loads.
- **On foot and by car** — walk or run with WASD, steal any car on the street
  with E, and drive with arcade handling (accelerate, brake, reverse, drift).
- **Traffic and pedestrians** — cars cruise the grid and turn at intersections;
  pedestrians stroll the sidewalks and run when shots are fired or a car bears
  down on them.
- **Wanted level and police** — stealing cars, hitting pedestrians and shooting
  raise your heat from 0 to 5 stars. Police cars chase and ram you; officers on
  foot close in and punch. Get busted or wasted and you wake up at the garage,
  poorer and clean.
- **Missions and a story** — five missions for Vic: steal your first wheels,
  deliver a package, drive the bank getaway, settle the Docks crew, and pull
  the big score at the casino. Each pays cash and unlocks the next.
- **Combat** — a pistol aimed with the mouse (F or click to shoot), rival gang
  members who shoot back, and cars that take damage and can be wrecked.
- **HUD and minimap** — cash, health, car health and speed, wanted stars, the
  clock, the current objective with its timer, and a live minimap with the
  mission marker, police blips and an off-screen direction arrow.
- **Start screen and save** — a title screen with the story and controls, and
  progress (cash, mission, position, stats) that autosaves to localStorage.
- **Sound** — engine hum, two-tone sirens, gunshots, pickups and mission
  jingles, all synthesized with the Web Audio API. N mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| Shift | Run |
| E | Enter / steal a car, exit a car, pick up a package |
| F or mouse click | Shoot (aim with the mouse) |
| M | Start the next mission |
| P / Esc | Pause |
| N | Mute |
| Space / Enter | Start, resume, continue after busted/wasted |

## Play it locally

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. No build step, no
network request: `game/index.html` and its ES modules are the whole game.

## Entry

This repository is an entry for the make.fun bounty
[Make GTA 6](https://make.fun/bounty/gta6-01). `main.ts` (Node 22, standard
library only) copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored `vendor/makefun-game.ts` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of the game in Chrome, staged
with `?shot=start|drive|chase|mission&seed=1` (see `shots.json`).
