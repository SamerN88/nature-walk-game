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
│   ├── images.js       Embedded base64 image assets (PNG data URLs as JS constants)
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
│   ├── skeleton.js     Skull and full skeleton mesh construction (used in haunted house)
│   ├── demons.js       Demon AI, demon apocalypse, health bar, death/reset screen
│   ├── shadowman.js    Shadow man entity, spawn logic, multi-phase cutscene
│   ├── hellrun.js      Shrine and demon-rounds (Hell Run) system
│   ├── daynight.js     Day/night cycle, sky color, sun position
│   ├── hud.js          HUD/UI update functions, menu panels, god-mode controls
│   ├── input.js        Keyboard and mouse event handlers
│   ├── inventory.js    Notes and inventory overlay system (press I), paper/image rendering
│   ├── hauntedhouse.js Haunted house and cemetery: buildings, dark forests, HH angel sequence
│   ├── creatures.js    Night creature system: zombie, crawler, weeping angel, cemetery zombies
│   ├── noose.js        Special noose portal landmark, rope/body construction, debug spawn
│   ├── altar.js        Sacrificial altar: ritual mechanics, pillar symbols, corpse ascent, holy gem
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
- `DEBUG_*` flags (toggle to true to enable testing shortcuts); includes `DEBUG_CREATURES`, `DEBUG_CREATURES_2`, `DEBUG_CREATURES_FREEZE`, `DEBUG_TALISMAN`, `DEBUG_ALTAR`, `DEBUG_CEMETERY`, `DEBUG_INVINCIBLE`, `DEBUG_SWORD_THUNDER`, `DEBUG_NPC`, etc.
- `USE_GAP_CHECK` — when `true`, melee hit detection uses the camera-player gap filter (`rayHitProfileBeyondCameraPlayerGap`); when `false`, uses a simple crosshair-on-hitbox ray test (`rayHitProfile`) — more robust for close-range hits
- `WALK_SPEED = 20`, `RUN_SPEED = WALK_SPEED * 2` — base movement speeds (moved here from `main.js` so `creatures.js` can reference them at parse time)
- `DAY_DURATION`, `NIGHT_DURATION`, `FULL_CYCLE`
- Demon teleport constants: `DEMON_TELEPORT_INTERVAL_SEC`, `DEMON_TELEPORT_CHANCE`, `DEMON_TELEPORT_DISABLE_DIST`, `DEMON_TELEPORT_UNLOCK_DELAY_SEC`

**To change a debug mode or timing constant:** edit here.
**To change walk/run speed:** edit `WALK_SPEED` here (both player and creatures reference it).

---

### `js/images.js`
All game image assets embedded as base64 data URL constants. Loaded early (right after `state.js`) so image data is available before any system that needs it initializes.

**To add a new image asset:** embed it as a base64 data URL constant here.

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
- Enclosure regions: `creatureHouseRegions`, `creatureCaveRegions`, `creatureCemeteryRegions`, `playerEnclosureRegions`
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
- Region-based enclosure checks prevent the player from tunneling through house, cave, cemetery fence/gate, and cemetery-room walls; legal transitions must pass through the door/gate/open side
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
**To change the special noose portal:** edit `noose.js`; `createClimbableStructures()` only calls into it.

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
- `makeNPCHitProfile(type)` — returns a hit profile (capsule or sphere) for the given NPC type; covers `'deer'`, `'rabbit'`, `'bird'`, `'human'`; stored on each NPC object at creation time
- `createNPCs()` — spawns the initial population of all NPC types; when `DEBUG_NPC` is true, skips bulk spawning and places one of each type 20 units from player spawn instead
- `updateNPCs(delta)` — runs AI, movement, water interaction for all living NPCs
- `explodeNPC(npcData, index)` — death animation (ragdoll explosion of body parts)
- `spawnRandomNPC()` — spawns one random NPC type (used for respawn system)
- `recordKill(type)` — increments kill counter and breakdown, triggers respawn if rate > 0
- `getNPCHitRadius(npc)` — returns collision radius for punch/bullet detection

**To add a new NPC type:** create a `createFoo()` function following the deer/rabbit pattern, add a case to `makeNPCHitProfile`, and call it in `createNPCs`.
**To change NPC hit profile geometry:** edit `makeNPCHitProfile`.

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

**Bond system:** killing `DRAGON_BOND_KILLS_REQUIRED` enemies (currently 150) with the beam sets `dragonBondFormed = true`, triggers the aura pulse flash (`playDragonBondFlash`), and unlocks the T-tether key. It does **not** change the dragon's color.
**Tether system:** press T to toggle (unlocked after bond forms); dragon hovers above player and auto-shoots nearby demons.
**Post-apocalypse dragon transformation:** when the player defeats all demons (`demonVictory`), the dragon's appearance is overhauled — body/neck/legs/tail become dark blue-grey (`0x444455`) and all accents (eyes, spikes, claws, horns, wing membranes) become electric cyan (`0x00DDFF`). The beam also turns cyan. This sets `dragonAscended = true`.

**To change dragon flight behavior:** edit `updateDragon`.
**To change beam damage/range:** edit `dragonBeamAttack`.

---

### `js/weapons.js`
All player weapons and interactive items:

**AK47:**
- `createAK47Mesh(scale)` — builds gun geometry
- `updateAK47VisualState()` — syncs gun/shovel visibility with equipped state
- `fireAK47()` — raycast hit detection, damage application, NPC/demon kill handling
- AK47 hits regular creatures and cemetery zombies through `getCreatureGunHits()` / `damageCreatureFromGun()`, merged into the same sorted hit list as NPCs/demons/structures
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
- `punch()` — melee attack; hits NPCs, demons, creatures, and special melee targets within range; also handles AK chest interaction, shrine activation, pickups, and door/gate toggles
- `_meleeRayHit(...)` — internal wrapper that routes all melee hit detection through either `rayHitProfileBeyondCameraPlayerGap` or plain `rayHitProfile` depending on `USE_GAP_CHECK`; AK47 and dragon beam always use the gap filter regardless
- `getDragonMountHit` always uses plain `rayHitProfile` (gap filter permanently bypassed) to avoid false rejection when the dragon is directly overhead
- Default melee `punchRange = 7.5` units; demons use a separate `demonPunchRange = 9` units inside `getMeleeKillableCandidates`
- `flashEquipHint(label)` — shows "EQUIPPED: ..." flash message at bottom of screen

**Chest:**
- `tryInteractWithAkChest(aimDir, range)` — opens/collects AK47 from chest when looking at it and punching

**To change punch range or damage:** edit `punchRange` in `punch()`.
**To change demon-specific punch range:** edit `demonPunchRange` in `getMeleeKillableCandidates`.
**To toggle melee hit detection mode:** set `USE_GAP_CHECK` in `constants.js`.
**To change AK47 fire rate:** edit `AK47_SHOT_INTERVAL_MS` in `state.js`.

---

### `js/skeleton.js`
Mesh construction for skeletal props used inside the haunted house:
- `createSkullMesh(scale)` — builds a skull (cranium, jaw, eye sockets, nasal cavity, teeth)
- `createSkeletonMesh(scale)` — builds a complete human skeleton in a seated-against-wall/slumped pose (pelvis, spine, rib cage, clavicles, arms with fingers, legs with toes, skull)

Both functions call `enableMeshShadows` and return a `THREE.Group`. Loaded between `weapons.js` and `demons.js` since `hauntedhouse.js` uses these and is loaded later.

**To change skeleton appearance/pose:** edit the coordinate arrays in `createSkeletonMesh`.

---

### `js/demons.js`
The demon apocalypse system:
- `createDemon(biasedSpeed)` — builds a demon mesh (humanoid with glowing red eyes, horns), sets AI state
- `triggerDemonApocalypse()` — called after cutscene ends; spawns `DEMON_SPAWN_COUNT` demons, switches world to hell color palette
- Apocalypse start kills any currently alive night creatures before demon combat begins
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

**To change demon count/damage:** edit constants at top of `demons.js` (`DEMON_SPAWN_COUNT`, `DEMON_HIT_DAMAGE`).
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
- Phase 1 (base): 15% chance every 30s after the initial full-cycle peace buffer; at night this uses 30%
- Phase 2 (post-gem): 40% chance every 30s
- Phase 3 (after 10 total shadow-man spawns): 70% chance every 10s within 500 units of player

**To change stalker behavior:** edit `updateShadowMan`.
**To change cutscene sequence:** edit `updateShadowManCutscene`.

---

### `js/hellrun.js`
The optional "Hell Run" demon-rounds challenge (shrine-activated):
- `createShrine()` — places a glowing shrine structure near origin
- `updateShrine(delta, time)` — animates shrine, shows prompt when player is near
- `startDemonRound(roundNumber)` — begins a round: sets demon count, enters `demonApocalypse`/`roundMode`, kills existing night creatures, spawns first batch
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

**Time intervals** (`FULL_CYCLE` starts at 5:00 AM):
- Dawn: 5:00–6:42, Day: 6:42–17:30, Sunset: 17:30–18:42, Dusk: 18:42–19:54, Night: 19:54–5:00

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

### `js/inventory.js`
Notes and inventory overlay system:
- Press **I** to open/close the inventory overlay
- Two collectible paper notes rendered with a torn-parchment canvas effect, each displaying a PNG image (key hint and volcano hint)
- `makeTornEdgePath(W, H, step, jag)` — generates a stable torn-edge polygon path for the note border
- `drawNotePaper(ctx, W, H, applyTornPath, wrinkles, img)` — renders parchment texture + image to a canvas
- Notes are found in-world and added to the inventory when picked up
- The handheld bar shows equipped item icons (fist, shovel, AK47, etc.)

**To add a new note:** add its image asset to `images.js`, register the note in `inventory.js`.

---

### `js/hauntedhouse.js`
The haunted house and cemetery, plus their surrounding dark forests:

**Haunted house** (`createHauntedHouse()`):
- Randomly placed in a ring region (radius 1650–2200) at least 800 units from the volcano
- Two-floor Victorian-style house (48×50 footprint, raised 5 units on a foundation, gable roof)
- Full collision geometry: walls, stairs, floor-2, doorways, interior partition with L-shaped corridor
- Ground-floor hall door uses a smaller regular-house-height panel plus matching lintel/collider above the opening
- Skeletons placed inside as props (using `createSkeletonMesh`)
- `HH_REMOVE_STAIRS_DURING_SEQUENCE` gates whether the stairs disappear during the haunted-house sequence; currently disabled for easy re-enable
- Haunted-house sequence uses weeping angels instead of the old shadow-man encounter: first angel spawns frozen in a corner, then waves spawn from random corners with a tighter house-scale freeze distance and late-stage oscillation
- First HH angel has special combat state: multi-hit kill when the player has the talisman, and a no-talisman anti-stall enrage after repeated futile sword hits
- HH angels use the same creature stop/contact distances as normal creatures, die with the cemetery-zombie-style white fade, and honor `DEBUG_HH_INVINCIBLE`
- If the player enters the HH with talisman and torch already collected, a black eyeless crawler waits at the end of the ground-floor hallway and releases only when the player is inside the hallway and close enough
- During the HH sequence, open-world night creatures are despawned and blocked from spawning so they cannot attack through the house walls

**Cemetery** (`createCemetery()`):
- Randomly placed at least 500 units from the haunted house
- Fenced enclosure with openable/lockable gate, gravestones, talisman collectible, dig mechanic, and a small stone room
- Talisman pickup locks the cemetery gates, starts the cemetery zombie countdown, and creates the sacrificial altar
- Cemetery fence and room now use thin visual-matching wall colliders; anti-tunneling is handled by the player region-based enclosure system

**Dark forests:**
- `_createHHForestTree(x, z)` — tall, near-black tree (scale 1.8–3.2, 4 foliage cones) with shadow casting
- `createHHForest(hhX, hhZ)` — 270 dark trees in 4 density rings (inner-60 to outer-285) + 200 rocks around the haunted house
- `createCemeteryForest(cemX, cemZ)` — 80 dark trees in a ring (inner-60 to outer-165) around the cemetery

**Key constants** (at top of file): `HH_W/D`, `HH_F1_H/F2_H`, `HH_ELEV`, `HH_HALL_DOOR_*`, `HH_ANGEL_*`, `HH_FIRST_ANGEL_*`, `HH_REMOVE_STAIRS_DURING_SEQUENCE`, `CEM_*`

**To change the haunted house layout:** edit the wall/floor box builders in `createHauntedHouse`.
**To change the HH angel sequence:** edit `HH_ANGEL_WAVE_SCHEDULE`, `_spawnHHAngel`, `_updateHHAngels`, and `tryHitHHWhiteSM`.
**To change the special HH hallway crawler:** edit `_spawnHHHallCrawler`, `_updateHHHallCrawlerEncounter`, and the crawler constants near the top of the file.
**To change the dark forest density:** edit `TOTAL_TREES` / ring counts in `createHHForest` or `createCemeteryForest`.

---

### `js/noose.js`
Special noose portal landmark:
- `createSpecialHangingPortalFrame(stoneMaterial)` — places one tall portal frame in the inner world, registers its climbable stone parts, and handles `DEBUG_NOOSE` / `DEBUG_NOOSE_BODY` player placement
- `createSpecialPortalNoose(parent, archHeight)` — builds the beige rope tied around the portal lintel and hanging noose loop
- `createSpecialPortalHangingBodyMesh()` — builds the hanging body from the zombie mesh and color in `creatures.js`
- `spawnSpecialPortalHangingBody()` — adds the body after talisman pickup or immediately with `DEBUG_NOOSE_BODY`

Loaded after `creatures.js` so its zombie mesh/color dependencies are explicit. Called from `structures.js` during `createClimbableStructures()`, and from `hauntedhouse.js` when the talisman is picked up.

**To change the noose portal, rope, hanging body, or noose debug spawn:** edit here.

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

**Constants** (declared here):
- `ACCEL = 14`, `DECEL = 20`
- `PLAYER_RADIUS = 0.5`, `DRAGON_COLLISION_RADIUS = 4.5`
- `WALK_SPEED` and `RUN_SPEED` are in `constants.js` (referenced here but defined there)

**`init()`** — creates scene, camera, renderer, lights; calls all `create*()` functions in order; registers event listeners; sets start time to noon. It creates haunted house/cemetery landmarks early and calls `prepareAltarPlacement()` so altar terrain is reserved before vegetation; the altar mesh is normally created after talisman pickup.

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
11. Altar + holy gem updates
12. Creature updates
13. Underwater tint
14. Final render call

**`animate()`** — `requestAnimationFrame` loop; computes `delta`, caps it at 100ms, calls `update(delta)`.

**To change movement feel:** edit `WALK_SPEED`, `RUN_SPEED` in `constants.js`; edit `ACCEL`, `DECEL` at the top of this file.
**To add a new per-frame system:** add its update call inside `update(delta)`.
**To change world initialization order:** edit `init()`.

---

### `js/creatures.js`
Night creature system — three enemy types that spawn during the night outside the demon apocalypse:

**Types:**
- `zombie` — standing undead with outstretched arms; matches altar corpse proportions
- `crawler` — low-to-ground horror with elbows-high pose and beady red eyes; fast
- `angel` (weeping angel) — only moves when fully off-screen; freezes when in player's FOV; stone-grey

**Key constants** (at top of file):
- `CREATURE_SPEED = 1.15 * WALK_SPEED`, `CEMETERY_ZOMBIE_SPEED = 0.3 * WALK_SPEED`
- `CREATURE_STOP_DIST` / `CRAWLER_STOP_DIST` — how close creatures move before stopping near the player
- `CREATURE_HIT_DIST` / `CRAWLER_HIT_DIST` — contact damage distance; crawlers use larger values because of their long horizontal body
- `CREATURE_MAX_HP = 5`, `CREATURE_HIT_DAMAGE`, `CREATURE_SPAWN_INTERVAL = 10` (seconds)
- `SPOTLIGHT` — if true, attaches a dim white PointLight above each creature

**Spawn logic** (in `updateCreatures`): every 10s during night, not during demon apocalypse/hell-run rounds:
- Regular night spawns unlock after the cemetery zombie sequence is cleared (`_ncSpawnUnlocked`), or if the talisman is picked up and the player moves more than `CEMETERY_ESCAPE_CREATURE_UNLOCK_DIST` units from the cemetery center; `DEBUG_CREATURES` bypasses this
- Active haunted-house sequence phases despawn and block open-world night creatures, while preserving cemetery zombies and the special HH crawler
- Outer band (beyond mountains): 60% chance, 2 creatures
- Torch equipped: 40% chance, 1–2 creatures
- Default: 20% chance, 1 creature
- First two open-world spawns are forced crawlers; later types are random from `['zombie', 'crawler', 'angel']`
- `DEBUG_CREATURES_2` spawns 10 creatures 150 units from the player at startup and prevents daytime despawn

**Cemetery zombie sequence** (separate from regular spawns):
- Triggered by `startCemeteryZombieSequence()` 30s after talisman pickup
- 10 zombies emerge from graves (excluding talisman grave), rise from underground over 3s, face player while emerging
- The sequence forces a delayed night transition; after all killed, `_unlockCemeteryGates()` opens/unlocks the gates and unlocks regular night creature spawns

**Public functions:**
- `updateCreatures(delta)` — main per-frame update; also runs separation loop every 2 frames
- `getCreatureGunHits(aimDir, maxRange)` — exact mesh raycast first, sphere fallback for near misses; consumed by AK47 hit sorting
- `damageCreatureFromGun(creature)` — applies AK47 damage
- `getMeleeCreatureCandidates(aimDir, punchRange)` — returns hittable creatures for melee
- `meleeHitCreature(creature)` — decrements HP; kills at 0, shows hit particles otherwise
- `lightningAoeKillCreatures(centerPos, radius)` — kills all creatures within radius (sword lightning)
- `startCemeteryZombieSequence()` — begins the 30s countdown to cemetery zombie emergence
- `killAllNightCreatures()` — kills all current night creatures when demon apocalypse or hell-run rounds begin

**Player damage/death:** creature hits deal `CREATURE_HIT_DAMAGE`; if player health reaches 0, `hardReset()` reloads the page. `DEBUG_INVINCIBLE` suppresses all player damage including from the special HH crawler and HH angels.

**Collision and terrain following:** regular creatures use region-based rules for houses, caves, and the cemetery fence/gate, with boundary sliding. They can enter only through legal openings (open house doors, cave open side, open cemetery gate). Cemetery zombies are exempt from the cemetery-region rule and are clamped to the cemetery sequence area. All creatures sync their Y position to `getMoverSurfaceHeight`, so they climb primitive structures/mountains the same way demons and NPC-like movers do.

**To change spawn rate/chance:** edit the spawn timer block in `updateCreatures`.
**To change creature speed:** edit `CREATURE_SPEED` / `CEMETERY_ZOMBIE_SPEED` constants.
**To change creature stop/contact distances:** edit `CREATURE_STOP_DIST`, `CRAWLER_STOP_DIST`, `CREATURE_HIT_DIST`, and `CRAWLER_HIT_DIST`.
**To add a new creature type:** add a `_buildFooMesh()`, handle in `_spawnNightCreature`, add to `types[]` array.

---

### `js/altar.js`
The sacrificial altar — a ritual structure that triggers a corpse-ascent cutscene when fully activated:

Placement is reserved and terrain is flattened during `main.js:init()` via `prepareAltarPlacement()`. The actual altar meshes are normally created idempotently by `createSacrificialAltar()` when the talisman is picked up (`DEBUG_ALTAR` creates it immediately).

**Structure:** triangular arrangement of 3 torches on a 3-step dark stone platform; each pillar has engraved symbols (thunderbolt, crescent, cross); a light stone altar slab holds a corpse.

**Ritual sequence:**
1. Player shoots all 3 altar torches with the sword lightning (`tryLightAltarTorch`)  — must be done at night
2. Purple beams activate between torches; corpse eyes glow white
3. Player shoots the corpse with lightning (`tryHitAltarCorpseWithLightning`) — triggers corpse ascent
4. Corpse levitates 7.5 units over 3s, then rapidly rises and fades out
5. `_doAltarComplete()` — spawns the holy gem on its platform

**Holy gem** (`_createHolyGem`, `updateHolyGem`, `collectHolyGem`):
- Glowing animated gem that spawns after altar ritual completes
- Collection triggers a power/unlock (edit `collectHolyGem` for effect)
- Platform height queryable via `getHolyGemPlatformHeight(x, z)`

**Key state variables** (global, read by other files):
- `altarData` — all altar mesh refs, torch state, beam refs
- `altarTorchesLit` — 0–3
- `altarCorpseStruck` — bool, true after corpse is hit
- `altarState` — `'idle'` | `'torches_lit'` | `'ascending'` | `'complete'`

**Public functions:**
- `prepareAltarPlacement()` — preselects/flattens the altar site during world initialization
- `createSacrificialAltar()` — creates altar meshes idempotently after placement is prepared
- `tryLightAltarTorch(aimDir, range)` — called from sword lightning hit handler
- `tryHitAltarCorpseWithLightning(aimDir, range)` — called from sword lightning hit handler
- `updateAltar(delta, time)` — per-frame: torch flicker, beam pulse, corpse ascent animation
- `updateHolyGem(delta, time)` — per-frame gem animation and collection check
- `collectHolyGem()` — called when player walks into gem
- `getHolyGemPlatformHeight(x, z)` — height query for player standing on platform

**To change altar appearance:** edit `createSacrificialAltar` and the `_build*` helpers.
**To change what the holy gem does:** edit `collectHolyGem`.

---

## How Things Connect

```
index.html
    └─ loads scripts in order ──► constants → state → images → utils → terrain → water → collision
                                  → environment → structures → player → camera → npcs
                                  → gems → dragon → weapons → skeleton → demons → shadowman
                                  → hellrun → daynight → hud → input → inventory → hauntedhouse
                                  → creatures → altar → main

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
    ├─ createShrine()        [hellrun.js]  ← called inside triggerDemonApocalypse → demonVictory
    ├─ createHauntedHouse()  [hauntedhouse.js]
    ├─ createCemetery()      [hauntedhouse.js]
    └─ prepareAltarPlacement() [altar.js]

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
    ├─ updateShrine()        [hellrun.js]
    ├─ updateAltar()         [altar.js]
    ├─ updateHolyGem()       [altar.js]
    └─ updateCreatures()     [creatures.js]

Progression flow: There are multiple ways the game could play out, but here is one standard order:
    Explore world during the initial peace period  [shadowman.js, creatures.js]
    → find cemetery, collect talisman → cemetery zombies emerge  [hauntedhouse.js, creatures.js]
    → kill cemetery zombies, or leave the cemetery with talisman to unlock regular night creatures [creatures.js]
    → find haunted house, get sword, survive haunted-house angel sequence [hauntedhouse.js]
    → find sacrificial altar → light 3 torches + strike corpse with sword lightning → holy gem  [altar.js]
    → collect dragonGem at volcano  [gems.js → dragon.js]
    → dragon descends, bond with dragon via 150 beam kills (unlocks tether)  [dragon.js]
    → shadow man phase 3 triggers cutscene  [shadowman.js]
    → demon apocalypse begins  [demons.js]
    → kill all demons → demonVictory()  [demons.js]
    → dragon transforms to dark blue-grey + cyan, secret speed gem spawns  [demons.js, gems.js]
    OR activate shrine → hell run rounds  [hellrun.js]
```

---

## Quick-Change Reference

| What to change | File | Key function/variable |
|---|---|---|
| Debug shortcuts | `constants.js` | `DEBUG_*` flags |
| Player walk/run speed | `constants.js` | `WALK_SPEED`, `RUN_SPEED` |
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
| Creature spawn rate/chance | `creatures.js` | spawn timer block in `updateCreatures` |
| Creature speed | `creatures.js` | `CREATURE_SPEED`, `CEMETERY_ZOMBIE_SPEED` |
| Creature stop/contact distance | `creatures.js` | `CREATURE_STOP_DIST`, `CRAWLER_STOP_DIST`, `CREATURE_HIT_DIST`, `CRAWLER_HIT_DIST` |
| Creature HP / hit damage | `creatures.js` | `CREATURE_MAX_HP`, `CREATURE_HIT_DAMAGE` |
| HH angel sequence | `hauntedhouse.js` | `HH_ANGEL_WAVE_SCHEDULE`, `_updateHHAngels`, `tryHitHHWhiteSM` |
| HH hallway crawler | `hauntedhouse.js` | `_spawnHHHallCrawler`, `_updateHHHallCrawlerEncounter` |
| HH stairs disappearance | `hauntedhouse.js` | `HH_REMOVE_STAIRS_DURING_SEQUENCE` |
| HH interior hall door size/opening | `hauntedhouse.js` | `HH_HALL_DOOR_*`, `createHauntedHouse()` |
| Holy gem effect | `altar.js` | `collectHolyGem()` |
| New structure | `structures.js` | `createEnterableStructures` or `createClimbableStructures` |
| New NPC type | `npcs.js` | add `createFoo()`, add case to `makeNPCHitProfile`, call in `createNPCs` |
| NPC hit profiles | `npcs.js` | `makeNPCHitProfile` |
| Punch range (general) | `weapons.js` | `punchRange` in `punch()` |
| Punch range (demons) | `weapons.js` | `demonPunchRange` in `getMeleeKillableCandidates` |
| Melee hit detection mode | `constants.js` | `USE_GAP_CHECK` |
| Keybindings | `input.js` | `onKeyDown` / `onKeyUp` |
| Menu controls list | `hud.js` | `updateMenuPanels` |
| HTML/CSS | `index.html` | directly |
