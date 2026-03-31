# Nature Walk Game — Codebase Guide

A browser-based 3D open-world exploration game built with Three.js. No build step required — open `index.html` in a browser (served via a local HTTP server, since multiple `<script>` files are used).

## File Structure

```
nature-walk-game/
├── index.html          Entry point: HTML structure, all CSS, script loading order
├── vendor/
│   └── three.min.js    Three.js r134 (local copy, not CDN)
├── js/
│   ├── constants.js    Debug flags and immutable game constants
│   ├── state.js        All mutable global state variables
│   ├── utils.js        Pure math/geometry helpers and placement utilities
│   ├── terrain.js      Ground mesh generation and terrain height queries
│   ├── water.js        Water body planning, mesh creation, traversal state
│   ├── collision.js    Wall/ceiling/roof collision registration and resolution
│   ├── environment.js  Vegetation, mountains, volcano, NPC spawn position finder
│   ├── structures.js   Climbable towers/boulders and enterable buildings/caves
│   ├── player.js       Player mesh creation
│   ├── camera.js       Third-person camera and occlusion resolution
│   ├── npcs.js         Peaceful NPC creation/AI: deer, rabbit, bird, human
│   ├── gems.js         Secret speed gem and dragon gem (collect, animate, effects)
│   ├── dragon.js       Dragon creation, mounting, beam weapon, tether, bond system
│   ├── weapons.js      AK47, shovel, golden key, punch system, lake digging
│   ├── demons.js       Demon AI, demon apocalypse, health bar, death/reset screen
│   ├── shadowman.js    Shadow man entity, spawn logic, multi-phase cutscene
│   ├── hellrun.js      Shrine and demon-rounds (Hell Run) system
│   ├── daynight.js     Day/night cycle, sky color, sun position
│   ├── hud.js          HUD/UI update functions, menu panels, god-mode controls
│   ├── input.js        Keyboard and mouse event handlers
│   └── main.js         `init()`, `animate()`, `update()` — the game loop
└── CODEBASE.md         This file
```

---

## File-by-File Reference

### `index.html`
All HTML markup and CSS. Contains:
- Start screen, crosshair, HUD divs, demon counter, health bar, death screen, shrine prompt, round UI
- The in-game menu (`#game-menu`) with time-of-day buttons, NPC controls, kill breakdown
- `<script>` tags at bottom of `<body>` loading all JS files in dependency order

**To change UI layout or styles:** edit here.

---

### `js/constants.js`
All `const` declarations that never change at runtime:
- `DEBUG_*` flags (toggle to true to enable testing shortcuts)
- `DAY_DURATION`, `NIGHT_DURATION`, `FULL_CYCLE`
- `FALL_TO_CUTSCENE` — controls cutscene transition behavior

**To change a debug mode or timing constant:** edit here.

---

### `js/state.js`
All mutable `let` global variables — the single source of truth for runtime game state:
- Three.js core: `scene`, `camera`, `renderer`
- Player: `player`, `playerBody`, `velocity`, `isJumping`, `isGrounded`, `mountedOnDragon`
- Controls: `moveForward/Backward/Left/Right`, `isRunning`, `isLocked`
- Camera: `cameraDistance`, `cameraHeight`, `cameraPitch`, `cameraYaw`
- World: `structures[]`, `solidWalls[]`, `ceilings[]`, `roofColliders[]`, `waterBodies[]`, `npcs[]`, `demons[]`
- Progression: `killCount`, `killBreakdown`, `gemCollected`, `dragonGemCollected`, `hasGoldenKey`, `ak47Collected`
- Systems: `demonApocalypse`, `playerHealth`, `dragonHealth`, `roundMode`, `currentRound`
- Dragon: `dragon`, `mountedOnDragon`, `dragonBondFormed`, `dragonTethered`
- Shadow man: `shadowMan`, `shadowManCutscene`, `shadowManPhase3Ready`
- Hell run: `shrine`, `shrineActive`, `roundKillCount`, `bestDemonRoundsReached`
- Also contains constants that were mixed with state in the original: `DRAGON_BOND_KILLS_REQUIRED`, `AK47_*`, `SHADOW_MAN_*`, etc.

**To add new global state:** add it here.

---

### `js/utils.js`
Stateless utility functions shared across the codebase:
- `enableMeshShadows(root)` — enables cast/receive shadows on all meshes in a group
- `smoothstep01(t)` — smooth interpolation
- `randRange(min, max)`, `randomRotationY()`
- `rotateXZ`, `localToWorldXZ`, `worldToLocalXZ` — coordinate transforms
- `getRotatedHalfExtents`, `isPointInRotatedRect` — rotated rectangle math
- `makePlacementFootprint`, `canPlaceFootprint`, `reserveFootprint`, `findPlacement` — structure placement system that prevents overlaps
- `sampleTerrainStats`, `sampleCircleBoundaryMinGroundHeight`, `sampleRectBoundaryMinGroundHeight` — sample terrain under structure footprints to determine sink depth
- `moveScalarToward(current, target, maxStep)` — clamped scalar interpolation

**To add a new math helper:** add it here.

---

### `js/terrain.js`
Ground mesh generation and height queries:
- `createGround()` — creates the PlaneGeometry terrain mesh with procedural height, builds the `terrainHeights` lookup grid, adds a dirt path
- `getBaseTerrainHeight(worldX, worldZ)` — the noise function that defines terrain shape (mountains, valleys)
- `carveTerrainHeightForWater(x, z, baseHeight)` — deforms terrain down to create lake/pond craters
- `getGroundHeight(worldX, worldZ)` — primary height query: reads from the baked `terrainHeights` grid (fast), falls back to raycasting
- `sampleTerrainRingStats`, `waterPolyRadiusAt` — helpers for water carving

**To change terrain shape/noise:** edit `getBaseTerrainHeight`.
**To change lake/pond crater geometry:** edit `carveTerrainHeightForWater`.

---

### `js/water.js`
Water body system:
- `planWaterBodies()` — decides positions/sizes of the lake and ponds (called before terrain is created, so terrain can carve around them)
- `createWater()` — creates water mesh cylinders (top disc + side cylinder), visual tints, caustic shimmer
- `updateWaterLighting()` — called each frame, adjusts water color for day/night
- `setWaterCombatColor(enable)` — turns water red during demon apocalypse
- `getWaterBodyAt(x, z)`, `isPointInWater(x, z)` — world-position queries
- `getWaterTraversalState(x, z, y, entityHeight)` — returns `{ inWater, fullySubmerged, surfaceY, ... }` used by player and NPC movement

**To add a new water body:** edit `planWaterBodies`.
**To change swimming physics:** edit `getWaterTraversalState` and the player update in `main.js`.

---

### `js/collision.js`
All collision geometry registration and resolution:

**Registration helpers** (called from `structures.js`, `environment.js`, etc.):
- `addStructureBox` / `addLocalStructureBox` — registers a box as a climbable step surface
- `addSolidWallRect` / `addLocalSolidWall` — registers an invisible wall rectangle
- `addCeilingRect` / `addLocalCeiling` — blocks player from floating through roofs
- `addRoofColliderRect/Circle` — keeps player inside enclosed structures (caves, buildings)
- `addEnclosedBoundRect` — marks a footprint as enclosed (dragon avoids landing here)
- `addRigidBoxStructureParts`, `registerRigidBoxStructureParts` — batch register meshes

**Resolution** (called from `main.js` update):
- `resolvePlayerWallOverlaps(radius)` — pushes player out of wall rectangles
- `resolveCircularEntityWallOverlaps(position, y, radius)` — same for NPCs/demons
- `resolveCircularBodyRoofCollision` — handles vertical collision with arched roofs
- `movePlayerHorizontallyWithCollisions` — sub-stepped horizontal movement with wall avoidance
- `clampPlayerToWorldBounds` — keeps player inside the world edge

**Debug visualization:**
- `createCollisionDebugVisuals()` — draws translucent red meshes over collision geometry (enabled by `DEBUG_COLLISIONS`)

**To add a new wall/ceiling to a structure:** use the `addSolidWallRect` / `addCeilingRect` family.

---

### `js/environment.js`
Passive world geometry:
- `createTree(x, z, scale)` — builds a tree mesh (trunk + layered cones)
- `createTrees()`, `createRocks()`, `createFlowers()`, `createGrass()` — scatter vegetation
- `createMountains()` — places ring of mountains at world edge
- `createDragonVolcano()` — the volcanic mountain with lava lake, landing platform, and cave entrance; builds collision geometry
- `getDragonVolcanoShellHeight`, `getDragonVolcanoTerrainFloorHeight`, `getDragonSupportHeight` — volcano height queries used by player and dragon
- `isInsideDragonVolcanoCore(x, z)` — lava zone check
- `respawnPlayerAtOrigin()`, `respawnPlayerFromDragonVolcanoLava()` — safe respawn helpers
- `findNPCSpawnPosition(region)` — finds a valid spawn point on land, outside water/structures

**To change the volcano:** edit `createDragonVolcano`.
**To add more terrain decoration:** add calls in `createTrees/Rocks/Flowers/Grass` or make new scatter functions.

---

### `js/structures.js`
Interactive buildings and terrain features:

`createClimbableStructures()` — all structures the player can physically stand on and climb:
- Stone towers, wooden watchtowers, spiral staircases, ancient portal frames, boulders, cliff platforms

`createEnterableStructures()` — buildings the player can walk inside:
- Log cabins (with tent shovel pickup inside one), caves (one with eerie cave writing), stone ruins, lean-tos

Also contains:
- `getStructureHeight(x, z)` — returns the top surface Y of any structure at a position
- `rayIntersectAABB`, `getStructureAABB`, `getBulletStructureBlockDistance` — ray-vs-structure intersection for bullet travel

**To add a new building:** call the `addRigidBoxStructureParts` / `addSolidWallRect` helpers in `createEnterableStructures`.
**To add a new climbable platform:** add to `createClimbableStructures`.

---

### `js/player.js`
`createPlayer()` — builds the player's visual mesh (capsule body + head sphere), attaches the shovel and AK47 meshes to hand bones, sets initial position.

**To change player appearance:** edit here.
**To adjust player size:** edit `playerBody` geometry and `PLAYER_RADIUS` in `main.js`.

---

### `js/camera.js`
Third-person camera:
- `resolveThirdPersonCameraPosition(targetPoint, desiredPosition)` — raycasts between player and desired camera position; pulls camera closer if terrain/structures are in the way
- `shouldIgnoreCameraOcclusion(object)` — returns true for objects that shouldn't block the camera (water, particles, beams)
- `updateSunShadowFocus()` — re-centers the shadow map on the player each frame

**To change camera distance/angle:** edit `cameraDistance`, `cameraHeight` in `state.js` and the update logic in `main.js`.

---

### `js/npcs.js`
Peaceful NPCs that wander and react to the player:
- `createDeer()` — deer with flocking wander, flee-on-approach behavior
- `createRabbit()` — small fast rabbit that hops
- `createBird(scale)` — flying bird that swoops; lands occasionally
- `createHuman()` — humanoid NPC with walk cycle; flees or wanders
- `createNPCs()` — spawns the initial population of all NPC types
- `updateNPCs(delta)` — runs AI, movement, water interaction for all living NPCs
- `explodeNPC(npcData, index)` — death animation (ragdoll explosion of body parts)
- `spawnRandomNPC()` — spawns one random NPC type (used for respawn system)
- `recordKill(type)` — increments kill counter and breakdown, triggers respawn if rate > 0
- `getNPCHitRadius(npc)` — returns collision radius for punch/bullet detection

**To add a new NPC type:** create a `createFoo()` function following the deer/rabbit pattern and add it to `createNPCs`.

---

### `js/gems.js`
Collectible gems that grant powers:

**Secret gem** (speed/jump boost, unlocked post-apocalypse):
- `createSecretGem()` — spawns the glowing gem; position is near origin in debug mode
- `updateGem(delta, time)` — rotation/glow animation, proximity collection check
- `collectGem()` — grants `speedMultiplier = 10`, `jumpMultiplier = 3`, `infiniteJump = true`

**Dragon gem** (triggers dragon descent from volcano):
- `createDragonGem()` — spawns gem at volcano summit
- `updateDragonGem(delta, time)` — animated gem, proximity collection check
- `collectDragonGem()` — triggers dragon descent sequence

**To adjust gem power values:** edit the `collectGem()` function.

---

### `js/dragon.js`
The dragon companion system:
- `createDragon()` — builds dragon mesh (body, wings, neck, head, tail, claws) with glow effects
- `mountDragon()` / `unmountDragon()` — player mounts/dismounts; switches movement mode
- `updateDragon(delta)` — dragon AI: descends to player, hovers, follows while mounted, auto-lands, avoids lava
- `dragonBeamAttack()` — fires a death beam at targeted NPC/demon; tracks bond kill progress
- `makeBondAuraMesh`, `playDragonBondFlash`, `updateDragonBondFlashes` — visual flash when bond is formed
- `dragonTetherShoot(targetDemon, targetIndex)` — auto-fires beam at nearby demon when tethered
- `findClearDescendPoint(prefX, prefZ)` — finds ground to land on that isn't inside a structure
- `updateMountedPlayerPose()` — keeps player mesh aligned with dragon saddle

**Bond system:** killing `DRAGON_BOND_KILLS_REQUIRED` enemies with the beam makes the dragon white and permanent.
**Tether system:** press T to toggle; dragon hovers above player and auto-shoots nearby demons.

**To change dragon flight behavior:** edit `updateDragon`.
**To change beam damage/range:** edit `dragonBeamAttack`.

---

### `js/weapons.js`
All player weapons and interactive items:

**AK47:**
- `createAK47Mesh(scale)` — builds gun geometry
- `updateAK47VisualState()` — syncs gun/shovel visibility with equipped state
- `fireAK47()` — raycast hit detection, damage application, NPC/demon kill handling
- `triggerAk47ShotFX(aimDir, hits)` — spawns bullet beam, muzzle flash, light flash
- `updateAK47Effects(delta)` — ages and removes beam/flash effects

**Shovel & Digging:**
- `createShovelMesh(scale)` — shovel geometry
- `tryDig()` — checks if player is in the lake dig zone, increments `digCount`, spawns particles
- `spawnDigParticles`, `updateDigParticles` — dirt particle effects

**Golden Key:**
- `createGoldenKeyMesh()` — key geometry
- `spawnGoldenKey(x, y, z)` — places key in world after enough digging
- `updateGoldenKey(delta)` — bobbing animation, proximity collection
- `updateKeyHUD()` — shows/hides golden key icon in HUD

**Punch:**
- `punch()` — melee attack; hits NPCs and demons within range; also handles AK chest interaction, shrine activation
- `flashEquipHint(label)` — shows "EQUIPPED: ..." flash message at bottom of screen

**Chest:**
- `tryInteractWithAkChest(aimDir, range)` — opens/collects AK47 from chest when looking at it and punching

**To change punch range or damage:** edit the `punch()` function.
**To change AK47 fire rate:** edit `AK47_SHOT_INTERVAL_MS` in `state.js`.

---

### `js/demons.js`
The demon apocalypse system:
- `createDemon(biasedSpeed)` — builds a demon mesh (humanoid with glowing red eyes, horns), sets AI state
- `triggerDemonApocalypse()` — called after cutscene ends; spawns initial 50 demons, switches world to hell color palette
- `updateDemons(delta)` — demon AI per-frame: pathfinding toward player, water avoidance, wall phasing, attack when in range
- `explodeDemon(zData, index)` — death animation, removes from `demons[]`
- `updateDemonCounter()` — updates the skull counter in the HUD
- `isCampfireShieldActive()` — returns true if player is near a campfire or within linger timer
- `updateCampfireLingerUI` / `updateHealthBar` — HUD updates
- `demonVictory()` — player killed all demons; spawns secret gem, dragon, turns world green
- `showDeathScreen()` — shows YOU DIED overlay
- `hardReset()` — reloads the page (full world restart)
- `respawnWithMoreDemons()` — respawn in place with 50 extra demons added
- `positionDemonsAroundPlayer` — teleports a list of demons around the player (used by hell run)

**To change demon speed/damage:** edit constants at top of `demons.js` (`DEMON_WALK_SPEED`, `DEMON_HIT_DAMAGE`).
**To change apocalypse spawn count:** edit `triggerDemonApocalypse`.

---

### `js/shadowman.js`
The shadow man — a horror stalker entity that appears before the apocalypse:
- `createShadowManMesh()` — tall featureless silhouette with glowing eyes
- `trySpawnShadowMan()` — periodic spawn check; respects minimum game time, distance range, spawn chance
- `updateShadowMan(currentTimeMs)` — rotates to face player, despawns if too close/far, checks cutscene trigger distance
- `removeShadowMan()` — cleans up mesh
- `updateShadowManColor()` — black during day, white at night
- `startShadowManCutscene()` — triggered when player walks within `SHADOW_MAN_CUTSCENE_TRIGGER_DIST` of a final-phase shadow man; begins the multi-phase cutscene
- `updateShadowManCutscene(delta)` — runs all cutscene phases: camera zoom-in, face reveal, fade to black, player fall, apocalypse trigger
- `showShadowManFaceFlash()` — full-screen face flash mid-cutscene
- `endShadowManCutscene()` — cleans up cutscene state, calls `triggerDemonApocalypse`

**Spawn phases:**
- Phase 1 (base): 15% chance every 30s, after 10 min of play
- Phase 2 (post-gem): 40% chance every 30s
- Phase 3 (post-dragon-bond): 70% chance every 10s within 500 units of player

**To change stalker behavior:** edit `updateShadowMan`.
**To change cutscene sequence:** edit `updateShadowManCutscene`.

---

### `js/hellrun.js`
The optional "Hell Run" demon-rounds challenge (shrine-activated):
- `createShrine()` — places a glowing shrine structure near origin
- `updateShrine(delta, time)` — animates shrine, shows prompt when player is near
- `startDemonRound(roundNumber)` — begins a round: sets demon count, sets night time, spawns first batch
- `updateRoundSpawning(delta)` — trickle-spawns demons over the round duration
- `getRoundDemonCount`, `getRoundMaxDist`, `getRoundMinDist`, `getRoundNumBatches` — round scaling formulas
- `endRound()` — called when all demons killed; starts between-round countdown
- `updateBetweenRound(delta)` — countdown timer between rounds
- `showBetweenRoundUI`, `hideBetweenRoundUI`, `updateBetweenRoundCountdownUI` — HUD for between-round state
- `showRoundBanner(title, subtitle)` — big centered text flash (e.g. "ROUND 3 BEGIN")
- `restartCurrentRound()` — resets demons and restarts round 1 from death screen
- `exitRoundMode()` — abandons hell run, restores world to normal

**To change round scaling:** edit `getRoundDemonCount` and the `startDemonRound` setup logic.

---

### `js/daynight.js`
Sky, lighting, and time-of-day:
- `updateDayNightCycle(delta)` — advances `gameTime`, interpolates sky background color, fog color, sun position, sun intensity, ambient light intensity across dawn/day/sunset/dusk/night phases
- `setTimeOfDay(time)` — jump to a named time ('dawn', 'day', 'sunset', 'dusk', 'night'); called by in-game menu buttons

**Time intervals** (in fractions of `FULL_CYCLE`):
- Dawn: 0–0.10, Day: 0.10–0.42, Sunset: 0.42–0.52, Dusk: 0.52–0.60, Night: 0.60–1.0

**To change sky colors:** edit the interpolation targets in `updateDayNightCycle`.
**To change how long day/night last:** edit `DAY_DURATION` and `NIGHT_DURATION` in `constants.js`.

---

### `js/hud.js`
All UI update functions:
- `updateStats()` — refreshes alive count and kill count in top-right corner
- `updateMenuPanels()` — populates controls list and kill breakdown in the pause menu
- `updateBestDemonRoundsRun()` — updates best hell-run stats in menu
- `updateTopCornerHudVisibility()` — shows/hides top-right stats based on game phase
- `openTimeMenu()` / `toggleTimeMenu()` — show/hide the pause menu
- `godSpawnNPCs()` / `godKillNPCs()` / `setRespawnRate()` — god-mode NPC controls from menu
- `resolveRoofCollision(previousY)` — resolves player Y against ceiling colliders (placed here for historical reasons; affects HUD updates via player position)

**To change what's shown in the menu:** edit `updateMenuPanels`.

---

### `js/input.js`
Raw input event handlers:
- `onKeyDown(event)` — WASD/arrow movement, Shift (run), Space (jump), E (interact), F (equip switch), T (tether toggle), M (menu), R (dragon dismount/mount), Q (dragon beam)
- `onKeyUp(event)` — clears movement flags
- `onMouseDown(event)` — left click: punch or fire AK47; right click: unused
- `onMouseUp(event)` — releases AK47 trigger
- `onMouseMove(event)` — updates `cameraYaw` and `cameraPitch` while pointer is locked
- `onWindowResize()` — updates camera aspect and renderer size

**To rebind a key:** edit `onKeyDown` / `onKeyUp`.

---

### `js/main.js`
The game loop orchestrator:

**Constants** (movement physics, declared here since only used in `update()`):
- `WALK_SPEED = 20`, `RUN_SPEED = 40`, `ACCEL = 14`, `DECEL = 20`
- `PLAYER_RADIUS = 0.5`, `DRAGON_COLLISION_RADIUS = 4.5`

**`init()`** — creates scene, camera, renderer, lights; calls all `create*()` functions in order; registers event listeners; sets start time to noon.

**`update(delta)`** — the per-frame update called from `animate()`:
1. Player movement (gravity, jump, water buoyancy, horizontal movement with collision)
2. Dragon mounting movement
3. Camera positioning
4. NPC/demon/shadow man updates
5. Gem animations
6. Day/night cycle
7. AK47 effects
8. Campfire shield
9. Dragon updates
10. Hell run round system
11. Underwater tint
12. Final render call

**`animate()`** — `requestAnimationFrame` loop; computes `delta`, caps it at 100ms, calls `update(delta)`.

**To change movement feel:** edit `WALK_SPEED`, `RUN_SPEED`, `ACCEL`, `DECEL` at the top of this file.
**To add a new per-frame system:** add its update call inside `update(delta)`.
**To change world initialization order:** edit `init()`.

---

## How Things Connect

```
index.html
    └─ loads scripts in order ──► constants → state → utils → terrain → water → collision
                                  → environment → structures → player → camera → npcs
                                  → gems → dragon → weapons → demons → shadowman
                                  → hellrun → daynight → hud → input → main

main.js:init()
    ├─ planWaterBodies()     [water.js]
    ├─ createGround()        [terrain.js]
    ├─ createWater()         [water.js]
    ├─ createPlayer()        [player.js]
    ├─ createTrees/Rocks/..  [environment.js]
    ├─ createMountains()     [environment.js]
    ├─ createDragonVolcano() [environment.js]
    ├─ createClimbable/
    │  EnterableStructures() [structures.js]
    ├─ createNPCs()          [npcs.js]
    ├─ createDragonGem()     [gems.js]
    ├─ createDragon()        [dragon.js]
    └─ createShrine()        [hellrun.js]  ← called inside triggerDemonApocalypse → demonVictory

main.js:update(delta) calls per-frame:
    ├─ updateNPCs()          [npcs.js]
    ├─ updateDemons()        [demons.js]
    ├─ updateShadowMan()     [shadowman.js]
    ├─ updateDragon()        [dragon.js]
    ├─ updateGem()           [gems.js]
    ├─ updateDragonGem()     [gems.js]
    ├─ updateDayNightCycle() [daynight.js]
    ├─ updateAK47Effects()   [weapons.js]
    ├─ updateGoldenKey()     [weapons.js]
    ├─ updateDigParticles()  [weapons.js]
    ├─ updateRoundSpawning() [hellrun.js]
    ├─ updateBetweenRound()  [hellrun.js]
    └─ updateShrine()        [hellrun.js]

Progression flow:
    Explore world
    → collect dragonGem at volcano  [gems.js → dragon.js]
    → dragon descends, bond with dragon via 300 beam kills  [dragon.js]
    → shadow man phase 3 triggers cutscene  [shadowman.js]
    → demon apocalypse begins  [demons.js]
    → kill all demons → demonVictory()  [demons.js]
    → secret speed gem spawns  [gems.js]
    OR activate shrine → hell run rounds  [hellrun.js]
```

---

## Quick-Change Reference

| What to change | File | Key function/variable |
|---|---|---|
| Debug shortcuts | `constants.js` | `DEBUG_*` flags |
| Player walk/run speed | `main.js` | `WALK_SPEED`, `RUN_SPEED` |
| Jump height | `main.js` → `update()` | jump velocity line |
| Day/night duration | `constants.js` | `DAY_DURATION`, `NIGHT_DURATION` |
| Sky colors | `daynight.js` | `updateDayNightCycle` color lerp targets |
| Demon count on apocalypse | `demons.js` | `triggerDemonApocalypse` |
| Demon speed/damage | `demons.js` | constants at top of file |
| Shadow man spawn timing | `state.js` | `SHADOW_MAN_*` constants |
| Dragon bond kill threshold | `state.js` | `DRAGON_BOND_KILLS_REQUIRED` |
| AK47 fire rate | `state.js` | `AK47_SHOT_INTERVAL_MS` |
| Gem power values | `gems.js` | `collectGem()` |
| Round scaling | `hellrun.js` | `getRoundDemonCount` |
| New structure | `structures.js` | `createEnterableStructures` or `createClimbableStructures` |
| New NPC type | `npcs.js` | add `createFoo()`, call in `createNPCs` |
| Keybindings | `input.js` | `onKeyDown` / `onKeyUp` |
| Menu controls list | `hud.js` | `updateMenuPanels` |
| HTML/CSS | `index.html` | directly |
