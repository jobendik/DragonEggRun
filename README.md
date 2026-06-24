# 🐉 Dragon Egg Run

A real-time, single-player-vs-AI **fantasy treasure-hunt** game prototype built with **Phaser 3**, **TypeScript** and **Vite**.

Adventurers race across an ancient island hunting for the last living **Dragon Egg**. Most sites you search hold coins, traps, buffs or hints — but exactly one hides the egg. The moment it is found the match flips from a relaxed _Exploration_ phase into a tense _Escape_ chase: the carrier is marked for everyone, the extraction gates roar to life, and every rival turns to hunt them down.

> This is a **local prototype**. There is no real networking yet — the rival adventurers are AI bots. The architecture, however, is built so those bots can later be swapped for networked players with minimal change. See [Future multiplayer plan](#future-multiplayer-plan).

---

## ✨ Highlights

- **Phaser only for the world** — map, characters, movement, collisions, particles, camera and world effects.
- **HTML/CSS for all UI** — title screen, HUD, timers, radar, status effects, notifications, pause & end screens — layered over the canvas as a polished web app, not Phaser text.
- **Clean event bridge** — the game world and the UI communicate exclusively through a small typed event bus (`game:phase-changed`, `egg:found`, `notification:show`, …). Neither side reaches into the other.
- **Deterministic matches** — a seeded RNG drives map generation, loot and AI rolls. Pin a match with `?seed=12345` for debugging.
- **No external assets** — every sprite is drawn procedurally with Graphics; every sound is synthesised with the Web Audio API.
- **Restartable** — full match teardown/rebuild with no page refresh.
- **Mobile-friendly** — responsive UI plus an on-screen joystick and action button on touch devices.

---

## 🚀 Getting started

Requires **Node.js 20+**.

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server (opens http://localhost:5173)
npm run dev
```

### Other scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR            |
| `npm run build`     | Type-check, then build the production bundle  |
| `npm run preview`   | Preview the production build locally          |
| `npm run typecheck` | Run the TypeScript compiler in `--noEmit` mode |
| `npm run lint`      | Lint the project with ESLint                  |
| `npm run lint:fix`  | Lint and auto-fix                             |
| `npm run format`    | Format the codebase with Prettier             |

---

## 🎮 Controls

| Action            | Desktop                              | Touch                          |
| ----------------- | ------------------------------------ | ------------------------------ |
| Move              | `W A S D` or arrow keys              | Left on-screen joystick        |
| Search a site     | `E` / `Space`, or click a glowing site | Tap the 🔎 action button / site |
| Pause             | HUD pause button (`⏸`)               | HUD pause button               |

A **search prompt** appears whenever you stand next to an unopened site. Searching takes about a second — keep still until the bar fills.

---

## 🔁 Game loop

1. **Countdown** — adventurers spawn around the island; a 3-2-1-GO! settles everyone.
2. **Exploration** — everyone roams freely and searches sites. Possible results:
   coins · speed boost · shield · trap · stun trap · slow curse · fake egg · map hint · teleport scroll · empty · **the Dragon Egg**.
3. **The egg is found** — a dramatic banner, screen shake, glow and a music shift. The carrier gets a glowing trail, a radar ping, and a small speed penalty. Extraction gates activate.
4. **Escape** — the carrier sprints for a glowing gate while rivals chase, intercept and tackle.
   - Touch the carrier with enough proximity and the **egg drops** to the ground.
   - After a short settle, anyone nearby can scoop it up (with brief pickup invulnerability to stop instant ping-pong).
5. **Resolution**
   - Carrier reaches a gate → that adventurer **wins** (you → _Victory_, a bot → _Defeat_).
   - The escape timer runs out → the dragon swoops in and reclaims its egg → _Defeat_.

### AI personalities

Bots come in four flavours that bias their decisions: **aggressive**, **greedy**, **cautious** and **wanderer**. During the chase some intercept the carrier, some bee-line for it, and the cautious ones camp the nearest gate.

---

## 🗺️ The island

A compact, hand-laid-out-in-code island with procedural detail: forest zones (which slow you), stone ruins, villages, caves, a river crossed by two **bridges** (choke points), lakes to route around, two diagonal **portal** shortcuts, **5 extraction gates**, and **40+ search sites**. Water, rocks, walls and huts are solid; bridges and forests shape the chase.

---

## 🧱 Project structure

```text
dragon-egg-run/
├─ .github/workflows/ci.yml      # typecheck + lint + build CI
├─ index.html                    # UI overlay markup + #game-container
├─ src/
│  ├─ main.ts                    # entry: boots UI, audio and the Phaser game
│  ├─ core/
│  │  └─ EventBus.ts             # tiny typed event emitter (the game↔UI bridge)
│  ├─ game/
│  │  ├─ config.ts               # Phaser game configuration
│  │  ├─ DragonEggGame.ts        # Phaser.Game subclass
│  │  ├─ scenes/                 # Boot, Preload, Game
│  │  ├─ entities/               # Player, AIPlayer, SearchLocation, DragonEgg, ExtractionGate
│  │  ├─ systems/                # Input, AI, Search, Egg, Collision, Particle, Audio, Camera, GameState
│  │  ├─ world/                  # IslandMap, MapGenerator, WorldConstants
│  │  ├─ utils/                  # seeded RNG, math helpers
│  │  └─ types/                  # GameTypes, Events (the event contract)
│  ├─ ui/                        # UIController + HUD/Menu/Notification/Minimap controllers
│  └─ styles/                    # global / menus / hud / notifications CSS
├─ vite.config.ts
├─ tsconfig.json
└─ package.json
```

### Architecture notes

- **One scene, many systems.** `GameScene` builds the world and owns the update loop; the gameplay rules live in small single-responsibility **systems** that receive a shared `GameRefs` bundle.
- **`GameStateSystem` is the only place phases change.** Everything else (and the whole UI) reacts to `game:phase-changed`.
- **The human and the bots are the same entity.** `AIPlayer extends Player`; the only difference is who sets the movement vector each frame (the `InputSystem` vs the `AISystem`). That symmetry is what makes networked players a drop-in later.
- **UI never touches the engine and vice-versa.** They only ever meet at the typed event bus.

---

## ⚠️ Current prototype limitations

- **No real multiplayer** — opponents are local AI; there is no networking, lobby, matchmaking or server.
- **No persistence** — no accounts, saves or leaderboards.
- AI uses lightweight steering with obstacle avoidance and an unstuck timer rather than full pathfinding.
- Audio is synthesised (no music tracks/voice); it is intentionally minimal.
- Art is procedural placeholder graphics, designed to be readable rather than final.

---

## 🌐 Future multiplayer plan

The prototype is structured so real-time multiplayer can be added without rewriting gameplay:

1. **Transport layer** — introduce a `NetworkPlayer extends Player` fed by remote input, mirroring how `AIPlayer` is fed by the `AISystem`.
2. **Authoritative state** — promote `GameStateSystem`, `EggSystem` and `SearchSystem` to run on a server (they already hold the rules and emit events rather than mutate the DOM).
3. **Input/state sync** — send the existing input vectors + search intents upstream and broadcast world snapshots; the event bus becomes the seam where networking plugs in.
4. **Lobby & matchmaking** — added as new UI controllers reacting to new events; the HUD/menu layer needs no engine changes.

---

## 🛠️ Tech stack

Phaser 3 · TypeScript (strict) · Vite · ESLint + Prettier · GitHub Actions CI.

## 📄 License

MIT — see field in `package.json`. Built as an original work: no copyrighted names, board layouts, artwork, characters or rules text from any existing game are used.
