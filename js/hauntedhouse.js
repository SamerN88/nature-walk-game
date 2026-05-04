// ===== Haunted House & Cemetery =====

// ── Dimension constants (local building space) ──────────────────────────────
const HH_W = 48, HH_D = 50;
const HH_HALF_W = HH_W / 2;   // 24
const HH_HALF_D = HH_D / 2;   // 25
const HH_WALL_T = 0.6;
const HH_F1_H = 13.5;          // floor 1 ceiling height (9 × 1.5)
const HH_F2_H = 12;            // floor 2 wall height above floor 1 (8 × 1.5)
const HH_GABLE_RISE = 18;      // gable peak rise above floor-2 walls (12 × 1.5)
const HH_F2_FLOOR_T = HH_GABLE_RISE / 8; // 2.25; matches each stepped gable roof slab thickness
const HH_F2_SURFACE_Y = HH_F1_H + HH_F2_FLOOR_T;
const HH_ROOF_EAVE_OVERHANG = 6.6;
const HH_ROOF_END_OVERHANG = 6.6;
const HH_ENT_W = 4.2;          // entrance opening width
const HH_ENT_H = 5.5;          // entrance opening height (~2.75× player height)
const HH_HALL_X = 17;          // east corridor at x=17 (HH_HALF_W − 7, keeps corridor width = 7)
// L-shaped partition: horizontal arm at z=HH_HALL_Z, vertical arm at x=HH_HALL_X
const HH_HALL_Z = -19;         // partition z — keeps north corridor width = 6 (HH_HALF_D − |HH_HALL_Z|)
const HH_HALL_DOOR_W = 3.5;    // width of the doorway opening in the horizontal partition
const HH_HALL_DOOR_H = 5.9;    // matches the regular small-house door height
const HH_HALL_DOOR_CX = -10;   // x-center of the doorway (≈ 1/3 from west wall, forces right-turn)
const HH_HALL_CRAWLER_TRIGGER_DIST = 15;
const HH_STAIR_S_Z = 8;        // south boundary of staircase zone (4 × 2)
// Staircase: x=[17..24], z=[HH_HALL_Z..HH_STAIR_S_Z], ascending southward
const HH_STAIR_STEPS = 9;

// Foundation / entry-stair constants
const HH_ELEV = 5;             // house raised this many units above terrain
const HH_N_ENT_STEPS = 5;     // entry stairs outside south face
const HH_ENT_STEP_H = HH_ELEV / HH_N_ENT_STEPS;   // 1.0
const HH_ENT_STEP_D = 1.6;    // tread depth per step
const HH_ENT_STAIR_W = 7.0;   // width of entry stair (wider than entrance)
const HH_REMOVE_STAIRS_DURING_SEQUENCE = false;

// HH angel combat constants
const HH_ANGEL_SPEED = 0.9 * WALK_SPEED;
const HH_ANGEL_FREEZE_LOCK_DIST = 10;
const HH_FIRST_ANGEL_FREEZE_LOCK_DIST = HH_ANGEL_FREEZE_LOCK_DIST;//5;
const HH_FIRST_ANGEL_KILL_HITS = 3;
const HH_FIRST_ANGEL_NO_TALISMAN_ENRAGE_HITS = 5;
const HH_FIRST_ANGEL_ENRAGED_SPEED = 1.1 * RUN_SPEED;
const HH_ANGEL_HIT_CENTER_Y = 1.8;
const HH_ANGEL_CONTACT_DIST = 2.0;
const HH_ANGEL_WAVE_SCHEDULE = [
    { interval: 3, count: 4, oscillate: false },
    { interval: 2, count: 5, oscillate: false },
    { interval: 1, count: 8, oscillate: false },
    { interval: 1, count: 7, oscillate: true },
    // { interval: 1, count: 8, oscillate: false },
    // { interval: 0.5, count: 10, oscillate: true },
];
const HH_DESPAWN_DIST = 900;

// Cemetery constants
const CEM_HALF = 25;
const CEM_ENT_HALF_W = 3.5;
const CEM_FENCE_H = 5;
const CEM_POST_H = 7;
const CEM_POST_R = 0.55;
const CEM_GRAVE_DIGS = 10;
const CEM_MIN_DIST_FROM_HH = 500;
const CEM_Y_OFFSET = 0.5;
const CEM_TERRAIN_FLAT_MARGIN = 20;
const CEM_TERRAIN_FLAT_BLEND = 30;
const TALISMAN_ICON_SRC = 'img/talisman.png';

// ── Floor-1 corner positions (local x,z) for SM spawning ────────────────────
const HH_CORNERS = [
    { x: -HH_HALF_W + 1.5, z: HH_HALL_Z + 1.5 },  // NW (main-room north, just south of partition)
    { x:  HH_HALL_X - 1.5, z: HH_HALL_Z + 1.5 },  // NE (main-room north, just south of partition)
    { x: -HH_HALF_W + 1.5, z:  HH_HALF_D - 1.5 },  // SW (near entrance)
    { x:  HH_HALL_X - 1.5, z:  HH_HALF_D - 1.5 },  // SE (near entrance)
];

// ── createHauntedHouse ───────────────────────────────────────────────────────
function createHauntedHouse() {
    const region = { type: 'ring', minRadius: 1650, maxRadius: 2200 };

    const placement = findPlacementInRegion(region, (pt, rotation) => {
        // Reject if terrain under the building footprint is too steep or too elevated.
        // Sampling radius 70 covers the building's half-diagonal and a small buffer.
        const stats = sampleTerrainStats(pt.x, pt.z, 70, 3, 12);
        if (stats.range > 28) return null;   // too much height variation → slope / inside mountain
        // Must be at least 800 units from the volcano
        if (dragonVolcano) {
            const dvDx = pt.x - dragonVolcano.x;
            const dvDz = pt.z - dragonVolcano.z;
            if (dvDx * dvDx + dvDz * dvDz < 800 * 800) return null;
        }
        const rot = rotation ?? randomRotationY();
        return {
            x: pt.x, z: pt.z, rotation: rot,
            footprint: { ...makePlacementFootprint(pt.x, pt.z, 100), noTree: true, isHHOwn: true }
        };
    }, 500, { rotationCount: 12, pointDensity: 1.3 });

    if (!placement) { console.warn('HauntedHouse: no placement found'); return; }

    const { x: ox, z: oz, rotation: rot } = placement;
    const groundY = getGroundHeight(ox, oz);
    const baseY = groundY + HH_ELEV;   // floor-1 world height

    const hhGrp = new THREE.Group();
    const collMarkers = [];

    const wallMat  = new THREE.MeshLambertMaterial({ color: 0x343242 });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x16141c });
    const roofMat  = new THREE.MeshLambertMaterial({ color: 0x000000 });
    // Gable end-walls share the wall material color, but need DoubleSide for consistent shading.
    const gableMat = wallMat.clone();
    gableMat.side = THREE.DoubleSide;

    // ── Helper: add visual box to group ──────────────────────────────────────
    const B = (w, h, d, lx, ly, lz, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(lx, ly + h / 2, lz);
        m.castShadow = true;
        m.receiveShadow = true;
        hhGrp.add(m);
        return m;
    };

    // ── Foundation slab: elevates house above terrain, same color as walls ──
    // Top is flush with floor-1. Extended 51 units downward to stay grounded on uneven terrain.
    const foundDepth = HH_ELEV + 1 + 50;   // 56: original 6 + 50 extra underground
    const foundBottomY = -foundDepth + 0.1;
    const foundCenterY = foundBottomY + foundDepth / 2;
    B(HH_W + 4, foundDepth, HH_D + 4, 0, foundBottomY, 0, wallMat);
    // The foundation itself should be a primitive support volume so the outer lip
    // collides at the slab height instead of via tall perimeter wall proxies.
    collMarkers.push(createColliderMarker(hhGrp, 'structureBox', {
        localX: 0, localY: foundCenterY, localZ: 0,
        width: HH_W + 4, height: foundDepth, depth: HH_D + 4
    }));

    // ── Entry stairs on south face (outside, ground → floor-1) ──────────────
    // Step 0 is the bottommost/farthest step; step N-1 is at the entrance.
    const entryStepStructures = [];
    for (let i = 0; i < HH_N_ENT_STEPS; i++) {
        const stepLocalY  = -HH_ELEV + i * HH_ENT_STEP_H;
        const stepLocalZ  = HH_HALF_D + (HH_N_ENT_STEPS - i - 0.5) * HH_ENT_STEP_D;
        B(HH_ENT_STAIR_W, HH_ENT_STEP_H, HH_ENT_STEP_D, 0, stepLocalY, stepLocalZ, wallMat);
        // Register collision for this step (world-space, so player can walk up)
        const wStep = localToWorldXZ(ox, oz, 0, stepLocalZ, rot);
        const se = addStructureBox(wStep.x, wStep.z, groundY + i * HH_ENT_STEP_H,
            HH_ENT_STAIR_W, HH_ENT_STEP_H, HH_ENT_STEP_D, rot);
        entryStepStructures.push(se);
    }

    // 7 extra steps below the bottom step, partially embedded in terrain to close
    // gaps caused by uneven ground (steps keep the same position pattern, just extending lower)
    for (let j = 1; j <= 7; j++) {
        const stepLocalY = -HH_ELEV - j * HH_ENT_STEP_H;
        const stepLocalZ = HH_HALF_D + (HH_N_ENT_STEPS + j - 0.5) * HH_ENT_STEP_D;
        B(HH_ENT_STAIR_W, HH_ENT_STEP_H, HH_ENT_STEP_D, 0, stepLocalY, stepLocalZ, wallMat);
        const wExtraStep = localToWorldXZ(ox, oz, 0, stepLocalZ, rot);
        const ee = addStructureBox(wExtraStep.x, wExtraStep.z, groundY - j * HH_ENT_STEP_H,
            HH_ENT_STAIR_W, HH_ENT_STEP_H, HH_ENT_STEP_D, rot);
        entryStepStructures.push(ee);
    }

    // ── Floor 1 plate ────────────────────────────────────────────────────────
    B(HH_W, 0.4, HH_D, 0, -0.4, 0, floorMat);
    collMarkers.push(createColliderMarker(hhGrp, 'structureBox', {
        localX: 0, localY: 0, localZ: 0, width: HH_W, height: 0.4, depth: HH_D
    }));

    // ── Floor 1 outer walls ──────────────────────────────────────────────────
    const hhOuterWallTopY = HH_F2_SURFACE_Y + HH_F2_H;
    const hhOuterWallH = hhOuterWallTopY;
    const hhOuterWallCollisionCenterY = (hhOuterWallTopY - HH_ELEV) / 2;
    const hhOuterWallCollisionH = hhOuterWallTopY + HH_ELEV;
    // North wall
    // Collision extends downward by HH_ELEV to seal the foundation ledge (prevents ledge phase-through)
    B(HH_W + HH_WALL_T * 2, hhOuterWallH, HH_WALL_T, 0, 0, -(HH_HALF_D + HH_WALL_T / 2), wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: 0, localY: hhOuterWallCollisionCenterY, localZ: -(HH_HALF_D + HH_WALL_T / 2),
        halfW: HH_HALF_W + HH_WALL_T, halfD: HH_WALL_T / 2, height: hhOuterWallCollisionH,
        extra: { isEnclosed: true }
    }));

    // South wall: left piece, right piece, above-entrance piece
    const swWidth = HH_HALF_W - HH_ENT_W / 2;
    const swLX = -(HH_ENT_W / 2 + swWidth / 2);
    const swRX =  (HH_ENT_W / 2 + swWidth / 2);
    B(swWidth, hhOuterWallH, HH_WALL_T, swLX, 0, HH_HALF_D + HH_WALL_T / 2, wallMat);
    B(swWidth, hhOuterWallH, HH_WALL_T, swRX, 0, HH_HALF_D + HH_WALL_T / 2, wallMat);
    B(HH_ENT_W, hhOuterWallTopY - HH_ENT_H, HH_WALL_T, 0, HH_ENT_H, HH_HALF_D + HH_WALL_T / 2, wallMat);
    // South left/right also extended downward (entrance gap stays open at ground level)
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: swLX, localY: hhOuterWallCollisionCenterY, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: swWidth / 2, halfD: HH_WALL_T / 2, height: hhOuterWallCollisionH, extra: { isEnclosed: true }
    }));
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: swRX, localY: hhOuterWallCollisionCenterY, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: swWidth / 2, halfD: HH_WALL_T / 2, height: hhOuterWallCollisionH, extra: { isEnclosed: true }
    }));
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: 0, localY: HH_ENT_H + (hhOuterWallTopY - HH_ENT_H) / 2, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: HH_ENT_W / 2, halfD: HH_WALL_T / 2, height: hhOuterWallTopY - HH_ENT_H, extra: { isEnclosed: true }
    }));

    // West wall (collision extended downward to seal foundation ledge)
    B(HH_WALL_T, hhOuterWallH, HH_D + HH_WALL_T * 2, -(HH_HALF_W + HH_WALL_T / 2), 0, 0, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: -(HH_HALF_W + HH_WALL_T / 2), localY: hhOuterWallCollisionCenterY, localZ: 0,
        halfW: HH_WALL_T / 2, halfD: HH_HALF_D + HH_WALL_T, height: hhOuterWallCollisionH, extra: { isEnclosed: true }
    }));

    // East wall (collision extended downward to seal foundation ledge)
    B(HH_WALL_T, hhOuterWallH, HH_D + HH_WALL_T * 2, HH_HALF_W + HH_WALL_T / 2, 0, 0, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: HH_HALF_W + HH_WALL_T / 2, localY: hhOuterWallCollisionCenterY, localZ: 0,
        halfW: HH_WALL_T / 2, halfD: HH_HALF_D + HH_WALL_T, height: hhOuterWallCollisionH, extra: { isEnclosed: true }
    }));

    // ── L-shaped partition ────────────────────────────────────────────────────
    // Leg 1 (horizontal arm): full width from x=-HH_HALF_W to x=HH_HALL_X, with a doorway gap.
    // Doorway at x=[hallDoorL, hallDoorR]; NW corner is filled solid (inaccessible).
    // Once through the doorway the player can only turn right (east) toward the stairs.
    const hallDoorL = HH_HALL_DOOR_CX - HH_HALL_DOOR_W / 2;  // left edge of doorway
    const hallDoorR = HH_HALL_DOOR_CX + HH_HALL_DOOR_W / 2;  // right edge of doorway
    const stairwellWallTopY = HH_F2_SURFACE_Y - 0.1;
    // NW fill dimensions (the solid corner west of the doorway, north of partition)
    const nwFillW   = hallDoorL - (-HH_HALF_W);               // x width of NW fill
    const nwFillD   = HH_HALL_Z - (-HH_HALF_D);               // z depth of north corridor
    const nwFillCX  = (-HH_HALF_W + hallDoorL) / 2;           // center x of NW fill
    const nwFillCZ  = (-HH_HALF_D + HH_HALL_Z) / 2;           // center z of north corridor

    // Left wall piece: west wall → left edge of doorway
    const hPartLW  = nwFillW;
    const hPartLCX = nwFillCX;
    B(hPartLW, HH_F1_H, HH_WALL_T, hPartLCX, 0, HH_HALL_Z - HH_WALL_T / 2, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: hPartLCX, localY: HH_F1_H / 2, localZ: HH_HALL_Z - HH_WALL_T / 2,
        halfW: hPartLW / 2, halfD: HH_WALL_T / 2, height: HH_F1_H, extra: { isEnclosed: true }
    }));

    // Right wall piece: right edge of doorway → east corridor wall
    const hPartRW  = HH_HALL_X - hallDoorR;
    const hPartRCX = (hallDoorR + HH_HALL_X) / 2;
    B(hPartRW, stairwellWallTopY, HH_WALL_T, hPartRCX, 0, HH_HALL_Z - HH_WALL_T / 2, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: hPartRCX, localY: stairwellWallTopY / 2, localZ: HH_HALL_Z - HH_WALL_T / 2,
        halfW: hPartRW / 2, halfD: HH_WALL_T / 2, height: stairwellWallTopY, extra: { isEnclosed: true }
    }));

    // Lintel above the hall doorway so the opening matches the smaller door.
    const hDoorLintelH = HH_F1_H - HH_HALL_DOOR_H;
    B(HH_HALL_DOOR_W, hDoorLintelH, HH_WALL_T, HH_HALL_DOOR_CX, HH_HALL_DOOR_H, HH_HALL_Z - HH_WALL_T / 2, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: HH_HALL_DOOR_CX, localY: HH_HALL_DOOR_H + hDoorLintelH / 2, localZ: HH_HALL_Z - HH_WALL_T / 2,
        halfW: HH_HALL_DOOR_W / 2, halfD: HH_WALL_T / 2, height: hDoorLintelH, extra: { isEnclosed: true }
    }));

    // NW fill: solid block filling the inaccessible northwest corner
    B(nwFillW, HH_F1_H, nwFillD, nwFillCX, 0, nwFillCZ, wallMat);
    // Close-off solidWall on the east face of the NW fill — blocks left turn inside the corridor
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: hallDoorL, localY: HH_F1_H / 2, localZ: nwFillCZ,
        halfW: HH_WALL_T / 2, halfD: nwFillD / 2, height: HH_F1_H, extra: { isEnclosed: true }
    }));

    // ── Hallway animated door ────────────────────────────────────────────────
    // Hinge at the left (west) edge of the doorway. When open the door swings
    // into the main room (south side of partition); when closed it fills the
    // opening.  Managed by closeHHHallDoor / restoreHHHallDoor.
    //   Open  : hhHallDoorPivot.rotation.y = -PI/2
    //   Closed: hhHallDoorPivot.rotation.y =  0
    const hhHallDoorPivot = new THREE.Group();
    hhHallDoorPivot.position.set(hallDoorL, 0, HH_HALL_Z - HH_WALL_T / 2);
    const doorWoodMat = new THREE.MeshLambertMaterial({ color: 0x1e1208 });
    const hallDoorPanel = new THREE.Mesh(
        new THREE.BoxGeometry(HH_HALL_DOOR_W, HH_HALL_DOOR_H, 0.3), doorWoodMat
    );
    hallDoorPanel.position.set(HH_HALL_DOOR_W / 2, HH_HALL_DOOR_H / 2, 0);
    hallDoorPanel.castShadow = true;
    hallDoorPanel.receiveShadow = true;
    hhHallDoorPivot.add(hallDoorPanel);
    // Raised panels for visual depth
    const dpMat = new THREE.MeshLambertMaterial({ color: 0x130c04 });
    const dpUpper = new THREE.Mesh(new THREE.BoxGeometry(HH_HALL_DOOR_W - 0.8, HH_HALL_DOOR_H * 0.40, 0.08), dpMat);
    dpUpper.position.set(HH_HALL_DOOR_W / 2, HH_HALL_DOOR_H * 0.68, 0.14);
    hhHallDoorPivot.add(dpUpper);
    const dpLower = new THREE.Mesh(new THREE.BoxGeometry(HH_HALL_DOOR_W - 0.8, HH_HALL_DOOR_H * 0.32, 0.08), dpMat);
    dpLower.position.set(HH_HALL_DOOR_W / 2, HH_HALL_DOOR_H * 0.22, 0.14);
    hhHallDoorPivot.add(dpLower);
    // Door hardware (iron ring handle)
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const handleRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 10), handleMat);
    handleRing.position.set(HH_HALL_DOOR_W - 0.55, HH_HALL_DOOR_H * 0.45, 0.22);
    handleRing.rotation.x = Math.PI / 2;
    handleRing.castShadow = true;
    handleRing.receiveShadow = true;
    hhHallDoorPivot.add(handleRing);
    // Start open (door out of the way, in main room side)
    hhHallDoorPivot.rotation.y = -Math.PI / 2;
    hhGrp.add(hhHallDoorPivot);

    // Leg 2 (vertical arm): at x=HH_HALL_X, spans from z=HH_HALL_Z south to z=+HH_HALF_D (south outer wall)
    // Creates the west boundary of the entire east corridor (containing the staircase)
    const vPartLen = HH_HALF_D - HH_HALL_Z;           // 25 - (-19) = 44
    const vPartCZ  = (HH_HALL_Z + HH_HALF_D) / 2;    // (-19 + 25) / 2 = 3
    B(HH_WALL_T, stairwellWallTopY, vPartLen, HH_HALL_X + HH_WALL_T / 2, 0, vPartCZ, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: HH_HALL_X + HH_WALL_T / 2, localY: stairwellWallTopY / 2, localZ: vPartCZ,
        halfW: HH_WALL_T / 2, halfD: vPartLen / 2, height: stairwellWallTopY, extra: { isEnclosed: true }
    }));

    // ── Entrance block mesh (initially hidden; activates when SS is picked up) ──
    const entBlockMesh = B(HH_ENT_W, HH_ENT_H, HH_WALL_T, 0, 0, HH_HALF_D + HH_WALL_T / 2, wallMat);
    entBlockMesh.visible = false;
    // THREE.js raycaster hits invisible meshes; override raycast so the empty doorway
    // doesn't trigger camera occlusion when the block is hidden.
    entBlockMesh.raycast = (raycaster, intersects) => {
        if (entBlockMesh.visible) THREE.Mesh.prototype.raycast.call(entBlockMesh, raycaster, intersects);
    };

    // ── Staircase group ──────────────────────────────────────────────────────
    const stairsGrp = new THREE.Group();
    hhGrp.add(stairsGrp);

    const stepW = HH_HALF_W - HH_HALL_X;                     // 7 (x=[17..24])
    const stairZLen = HH_STAIR_S_Z - HH_HALL_Z;              // 22 (z=[-14..8])
    const stepDepth = stairZLen / HH_STAIR_STEPS;
    const stepH     = HH_F1_H / HH_STAIR_STEPS;              // 1.5
    const stairCX   = (HH_HALL_X + HH_HALF_W) / 2;           // 20.5
    const stairShift = 2 * stepDepth;                         // shift staircase south by 2 step-depths

    for (let i = 0; i < HH_STAIR_STEPS; i++) {
        // Step 0 is lowest, step 8 is highest; ascending southward.
        // stairShift offsets the whole staircase south without altering hallway or step count.
        const lzC = HH_HALL_Z + stairShift + (i + 0.5) * stepDepth;
        const lyBase = i * stepH;
        const step = new THREE.Mesh(new THREE.BoxGeometry(stepW-0.2, stepH, stepDepth), floorMat);
        step.position.set(stairCX+0.2, lyBase + stepH / 2, lzC);
        step.castShadow = true;
        step.receiveShadow = true;
        stairsGrp.add(step);
    }
    const topStepLZC = HH_HALL_Z + stairShift + (HH_STAIR_STEPS + 0.5) * stepDepth;
    const topStep = new THREE.Mesh(new THREE.BoxGeometry(stepW - 0.2, HH_F2_FLOOR_T, stepDepth), floorMat);
    topStep.position.set(stairCX + 0.2, HH_F1_H + HH_F2_FLOOR_T / 2, topStepLZC);
    topStep.castShadow = true;
    topStep.receiveShadow = true;
    stairsGrp.add(topStep);

    // ── Floor 2 plate (three sections; skip staircase zone x=[5,12], z=[-4,4]) ──
    // NOTE: floor-2 standing is handled by roofColliders from above. The separate
    // underside ceiling strips below act as the floor-1 ceiling and block upward
    // jumps before the player ever reaches the slab.

    // Section A: main room x=[-24,+17], full depth z=[-20,+20]
    const f2AW = HH_HALF_W + HH_HALL_X;           // 41
    const f2ACX = (-HH_HALF_W + HH_HALL_X) / 2;   // -3.5
    const f2UndersideCeilingY = HH_F1_H - 0.01;
    const addFloor1CeilingStrips = (localCX, localCZ, width, depth) => {
        // Dedicated floor-1 ceiling immediately under the floor-2 slab.
        // Strip sections avoid edge tunneling and match the working underside-only
        // ceilingRect usage elsewhere in the haunted house.
        const targetStripW = HH_HALF_W / 8;
        const stripCount = Math.max(1, Math.ceil(width / targetStripW));
        const stripW = width / stripCount;
        const startX = localCX - width / 2 + stripW / 2;
        for (let i = 0; i < stripCount; i++) {
            collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
                localX: startX + i * stripW,
                localY: f2UndersideCeilingY,
                localZ: localCZ,
                halfW: stripW / 2,
                halfD: depth / 2
            }));
        }
    };
    B(f2AW, HH_F2_FLOOR_T, HH_D, f2ACX, HH_F1_H, 0, floorMat);
    addFloor1CeilingStrips(f2ACX, 0, f2AW, HH_D);
    // roofCollider blocks jumping through the slab from floor-1 (more robust than ceilingRect alone)
    collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
        localX: f2ACX, localY: HH_F1_H + HH_F2_FLOOR_T / 2, localZ: 0,
        halfW: f2AW / 2, halfD: HH_HALF_D, thickness: HH_F2_FLOOR_T
    }));

    // Section B: northeast nook x=[17,24], z=[-20, HH_HALL_Z]
    const f2BW = HH_HALF_W - HH_HALL_X;           // 7
    const f2BD = HH_HALF_D + HH_HALL_Z;            // 25 + (-19) = 6
    const f2BCX = (HH_HALL_X + HH_HALF_W) / 2;    // 20.5
    const f2BCZ = (-HH_HALF_D + HH_HALL_Z) / 2;   // (-25 + -19)/2 = -22
    B(f2BW, HH_F2_FLOOR_T, f2BD, f2BCX, HH_F1_H, f2BCZ, floorMat);
    addFloor1CeilingStrips(f2BCX, f2BCZ, f2BW, f2BD);
    collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
        localX: f2BCX, localY: HH_F1_H + HH_F2_FLOOR_T / 2, localZ: f2BCZ,
        halfW: f2BW / 2, halfD: f2BD / 2, thickness: HH_F2_FLOOR_T
    }));

    // Section C: southeast area x=[17,24], z=[HH_STAIR_S_Z+stairShift, +20]
    // Shortened by stairShift at the north end to leave room for the shifted staircase.
    const f2CW = HH_HALF_W - HH_HALL_X;                           // 7
    const f2CD = HH_HALF_D - HH_STAIR_S_Z - stairShift;
    const f2CCX = (HH_HALL_X + HH_HALF_W) / 2;                    // 20.5
    const f2CCZ = (HH_STAIR_S_Z + stairShift + HH_HALF_D) / 2;
    B(f2CW, HH_F2_FLOOR_T, f2CD, f2CCX, HH_F1_H, f2CCZ, floorMat);
    addFloor1CeilingStrips(f2CCX, f2CCZ, f2CW, f2CD);
    collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
        localX: f2CCX, localY: HH_F1_H + HH_F2_FLOOR_T / 2, localZ: f2CCZ,
        halfW: f2CW / 2, halfD: f2CD / 2, thickness: HH_F2_FLOOR_T
    }));

    // ── Floor 2 outer walls ──────────────────────────────────────────────────
    // Outer shell is already continuous via the two-story wall meshes above.
    // Keep f2Y as the second-floor wall base for roof/gable placement.
    const f2Y = HH_F2_SURFACE_Y;

    // ── Gable triangular end walls (east + west) ─────────────────────────────
    // The gable ridge runs N-S (z axis). East/west ends are triangular above f2Y+HH_F2_H.
    // Approximate triangle with a prism mesh using custom geometry.
    const makeGableTriangle = (side) => {
        // Triangle in YZ… wait, gable spans X: from x=±HH_HALF_W (eave) to x=0 (ridge peak).
        // The east gable is the XY plane at z=+HH_HALF_D (south face) — but our ridge runs N-S...
        // Actually: ridge along Z direction means gable ENDS at x=±HH_HALF_W are the triangular faces.
        // No — let me reconsider: ridge runs E-W (x direction) for simplicity.
        // Let ridge be along X, gable ends at z=±HH_HALF_D.
        // Peak at (x=0..any, z=center, y=f2Y+HH_F2_H+HH_GABLE_RISE).
        // The two triangular end walls face +z and -z.
        const gY = f2Y + HH_F2_H;   // base of gable = top of floor-2 walls
        const peakY = gY + HH_GABLE_RISE;
        const hw = HH_HALF_W;
        const zSign = side === 'north' ? -1 : 1;
        const gz = zSign * (HH_HALF_D + HH_WALL_T / 2);

        const pts = new Float32Array([
            -hw, gY, gz,   hw, gY, gz,   0, peakY, gz,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        // Make it thick by extruding along z
        // Simpler: use BoxGeometry approximation — triangle prism
        // Points: 3 vertices front, 3 vertices back (depth = HH_WALL_T)
        const thick = HH_WALL_T;
        const verts = new Float32Array([
            // front face (z = gz)
            -hw, gY, gz,  hw, gY, gz,  0, peakY, gz,
            // back face (z = gz - sign*thick)
            -hw, gY, gz - zSign * thick,  hw, gY, gz - zSign * thick,  0, peakY, gz - zSign * thick,
        ]);
        const idx = new Uint16Array([
            // Front tri
            0, 2, 1,
            // Back tri
            3, 4, 5,
            // Bottom quad
            0, 1, 4,  0, 4, 3,
            // Left quad
            0, 3, 5,  0, 5, 2,
            // Right quad
            1, 2, 5,  1, 5, 4,
        ]);
        const g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        g2.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
        g2.computeVertexNormals();
        const m = new THREE.Mesh(g2, gableMat);
        m.castShadow = true;
        m.receiveShadow = true;
        hhGrp.add(m);
    };
    makeGableTriangle('north');
    makeGableTriangle('south');

    // ── Roof panels (two sloping slabs) ──────────────────────────────────────
    {
        const gBase = f2Y + HH_F2_H;
        const halfRun = HH_HALF_W;
        const rise = HH_GABLE_RISE;
        const roofOverhang = HH_ROOF_EAVE_OVERHANG;
        const roofEndOverhang = HH_ROOF_END_OVERHANG;
        const slabLen = Math.sqrt(halfRun * halfRun + rise * rise) + roofOverhang;
        const slabAngle = Math.atan2(rise, halfRun);
        const slabDepth = HH_D + HH_WALL_T * 2 + roofEndOverhang * 2;
        const overhangShiftX = Math.cos(slabAngle) * roofOverhang * 0.5;
        const overhangShiftY = Math.sin(slabAngle) * roofOverhang * 0.5;
        const slabCY = gBase + rise / 2 - overhangShiftY;
        const slabCX = halfRun / 2 + overhangShiftX;
        const slabThick = 0.8;

        const westSlab = new THREE.Mesh(new THREE.BoxGeometry(slabLen, slabThick, slabDepth), roofMat);
        westSlab.position.set(-slabCX, slabCY, 0);
        westSlab.rotation.z = slabAngle;
        westSlab.castShadow = true;
        westSlab.receiveShadow = true;
        hhGrp.add(westSlab); //DEBUG

        const eastSlab = new THREE.Mesh(new THREE.BoxGeometry(slabLen, slabThick, slabDepth), roofMat);
        eastSlab.position.set(slabCX, slabCY, 0);
        eastSlab.rotation.z = -slabAngle;
        eastSlab.castShadow = true;
        eastSlab.receiveShadow = true;
        hhGrp.add(eastSlab); //DEBUG

        // Ridge cap
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(slabThick * 1.2, slabThick * 0.9, slabDepth), roofMat);
        ridge.position.set(0, gBase + rise, 0);
        ridge.castShadow = true;
        ridge.receiveShadow = true;
        hhGrp.add(ridge); //DEBUG

        // Gable roof: 8 stepped roofColliders (horizontal slabs) + 7 riser pairs (vertical walls).
        // Each step approximates one horizontal band of the visual slope.
        // Step 0 = innermost (ridge, tallest), Step 7 = outermost (eave, shortest).
        //
        // STEP_T = STEP_H = 2.25.  This must exceed 2.0 (the resolveRoofCollision outer-face
        // tolerance) so that after the inner-face pushes the player to bottomY−0.01, their
        // previousY on the next frame is more than 2 units below topY — preventing the outer
        // face from falsely snapping them up through the ceiling.
        {
            const N      = 8;
            const STEP_W = HH_HALF_W / N;           // 3 units wide
            const STEP_H = HH_GABLE_RISE / N;       // 2.25 units tall
            const STEP_T = STEP_H;                  // slab thickness (must be > 2.0)
            const gB     = HH_F2_SURFACE_Y + HH_F2_H; // local-Y base of gable zone
            const roofHalfD = HH_HALF_D + HH_WALL_T + HH_ROOF_END_OVERHANG;
            const extraEaveSteps = 2;

            for (let i = 0; i < N; i++) {
                const topY_l = gB + HH_GABLE_RISE * (1.0 - i / N);
                const slabCY = topY_l - STEP_T / 2;
                const stepCX = (i + 0.5) * STEP_W;

                // Left-half slab
                collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
                    localX: -stepCX, localY: slabCY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD, thickness: STEP_T
                }));
                // Right-half slab
                collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
                    localX:  stepCX, localY: slabCY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD, thickness: STEP_T
                }));

                // Riser wall between step i and step i+1.
                // The outermost boundary (i = N−1) is sealed by the E/W gable solidWalls above.
                if (i < N - 1) {
                    const riserX  = (i + 1) * STEP_W;
                    const botY_l  = gB + HH_GABLE_RISE * (1.0 - (i + 1) / N);
                    const riserCY = (topY_l + botY_l) / 2 - 0.2;

                    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                        localX: -riserX, localY: riserCY, localZ: 0,
                        halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                    }));
                    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                        localX:  riserX, localY: riserCY, localZ: 0,
                        halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                    }));
                }

                // Stepped strips on the north/south gable faces fill the missing
                // triangle collision area from each roof step down to the gable base.
                const gableStripH = topY_l - gB;
                const gableStripCY = gB + gableStripH / 2;
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX: -stepCX, localY: gableStripCY, localZ: -(HH_HALF_D + HH_WALL_T / 2),
                    halfW: STEP_W / 2, halfD: HH_WALL_T / 2, height: gableStripH
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX:  stepCX, localY: gableStripCY, localZ: -(HH_HALF_D + HH_WALL_T / 2),
                    halfW: STEP_W / 2, halfD: HH_WALL_T / 2, height: gableStripH
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX: -stepCX, localY: gableStripCY, localZ: HH_HALF_D + HH_WALL_T / 2,
                    halfW: STEP_W / 2, halfD: HH_WALL_T / 2, height: gableStripH
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX:  stepCX, localY: gableStripCY, localZ: HH_HALF_D + HH_WALL_T / 2,
                    halfW: STEP_W / 2, halfD: HH_WALL_T / 2, height: gableStripH
                }));
            }

            for (let e = 0; e < extraEaveSteps; e++) {
                const eaveStepCX = HH_HALF_W + STEP_W * (e + 0.5);
                const eaveTopY = gB - e * STEP_H;
                const eaveSlabCY = eaveTopY - STEP_T / 2;
                collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
                    localX: -eaveStepCX, localY: eaveSlabCY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD, thickness: STEP_T
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
                    localX: eaveStepCX, localY: eaveSlabCY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD, thickness: STEP_T
                }));
                const eaveRiserX = HH_HALF_W + e * STEP_W;
                const eaveRiserCY = eaveTopY + STEP_H / 2 - 0.2;
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX: -eaveRiserX, localY: eaveRiserCY, localZ: 0,
                    halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX: eaveRiserX, localY: eaveRiserCY, localZ: 0,
                    halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                }));
            }

            // Inner slabs + risers: underside mirror of the outer steps. Each inner
            // horizontal collider is a ceilingRect placed at the underside of the
            // matching outer slab, so the collision surface is on the bottom face
            // rather than on top.
            for (let j = 0; j < N; j++) {
                const outer_topY_l = gB + HH_GABLE_RISE * (1.0 - j / N);
                const inner_ceilingY = outer_topY_l - STEP_T;
                const stepCX = (j + 0.5) * STEP_W;

                // Left-half inner slab (underside only)
                collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
                    localX: -stepCX, localY: inner_ceilingY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD
                }));
                // Right-half inner slab (underside only)
                collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
                    localX:  stepCX, localY: inner_ceilingY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD
                }));

                // Inner riser at the underside step face between inner step j and j+1.
                if (j < N - 1) {
                    const inner_riserX  = (j + 1) * STEP_W;
                    const next_outer_topY_l = gB + HH_GABLE_RISE * (1.0 - (j + 1) / N);
                    const next_inner_ceilingY = next_outer_topY_l - STEP_T;
                    const inner_riserCY = (inner_ceilingY + next_inner_ceilingY) / 2;

                    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                        localX: -inner_riserX, localY: inner_riserCY, localZ: 0,
                        halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                    }));
                    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                        localX:  inner_riserX, localY: inner_riserCY, localZ: 0,
                        halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                    }));
                }
            }

            for (let e = 0; e < extraEaveSteps; e++) {
                const eaveStepCX = HH_HALF_W + STEP_W * (e + 0.5);
                const innerEaveCeilingY = gB - STEP_T - e * STEP_H;
                collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
                    localX: -eaveStepCX, localY: innerEaveCeilingY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
                    localX: eaveStepCX, localY: innerEaveCeilingY, localZ: 0,
                    halfW: STEP_W / 2, halfD: roofHalfD
                }));
                const innerEaveRiserX = HH_HALF_W + e * STEP_W;
                const innerEaveRiserCY = innerEaveCeilingY + STEP_H / 2;
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX: -innerEaveRiserX, localY: innerEaveRiserCY, localZ: 0,
                    halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                }));
                collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
                    localX: innerEaveRiserX, localY: innerEaveRiserCY, localZ: 0,
                    halfW: HH_WALL_T / 2, halfD: roofHalfD, height: STEP_H
                }));
            }
        }
    }

    // ── Enclosed bound for the whole building ────────────────────────────────
    collMarkers.push(createColliderMarker(hhGrp, 'enclosedBound', {
        localX: 0, localY: 0, localZ: 0, halfW: HH_HALF_W + 2, halfD: HH_HALF_D + 2
    }));

    // ── Haunted house writing on north wall (floor 2) ─────────────────────────────
    const writingImg = new Image();
    writingImg.onload = () => {
        const tex = new THREE.Texture(writingImg);
        tex.needsUpdate = true;
        const wMat = new THREE.MeshLambertMaterial({
            map: tex, transparent: true, alphaTest: 0.05,
            color: 0xbd1919, side: THREE.DoubleSide, depthWrite: false  // OG color: 0xccb89a
        });
        const aspectRatio = 8.5/13;
        const width = 25;
        const wMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width*aspectRatio), wMat);
        wMesh.position.set(-1.5, HH_F2_SURFACE_Y + 7.1, -HH_HALF_D + 0.01);
        wMesh.renderOrder = 2;
        hhGrp.add(wMesh);
        // Store mesh and apply current torch state immediately
        if (hauntedHouseData) {
            hauntedHouseData.writingMesh = wMesh;
            wMat.opacity = (currentHandItem === 'torch') ? 1.0 : 0.2;
        }
    };
    writingImg.src = IMAGE_HAUNTED_HOUSE_WRITING;

    // ── Talisman insignia drawing — small image centered below the writing ────
    const drawingImg = new Image();
    drawingImg.onload = () => {
        const tex = new THREE.Texture(drawingImg);
        tex.needsUpdate = true;
        const dMat = new THREE.MeshLambertMaterial({
            map: tex, transparent: true, alphaTest: 0.05,
            color: 0xbd1919, side: THREE.DoubleSide, depthWrite: false
        });
        const dWidth = 3;
        const dHeight = dWidth * (863 / 1120); // image aspect ratio 1120×863
        const dMesh = new THREE.Mesh(new THREE.PlaneGeometry(dWidth, dHeight), dMat);
        dMesh.position.set(-1.5, HH_F2_SURFACE_Y + 3.5, -HH_HALF_D + 0.01);
        dMesh.renderOrder = 2;
        hhGrp.add(dMesh);
        if (hauntedHouseData) {
            hauntedHouseData.insigniaDrawingMesh = dMesh;
            dMat.opacity = (currentHandItem === 'torch') ? 1.0 : 0.05;
        }
    };
    drawingImg.src = IMAGE_TALISMAN_INSIGNIA_DRAWING;

    // ── World display items: sword, shield, skull (floor 2 near north wall) ──
    const worldSword = createSwordMesh(0.75);
    worldSword.position.set(-2.9, HH_F2_SURFACE_Y + 3.0, -HH_HALF_D + 0.3);
    worldSword.rotation.set(-0.3, 0.45, Math.PI - 0.1); // leaning slightly
    worldSword.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    setObjectHitProfile(worldSword, {
        shape: 'capsule',
        start: { x: 0, y: -0.45, z: 0 },
        end:   { x: 0, y:  4.30, z: 0 },
        radius: 0.38
    }, { debugKey: 'swordPickupHitboxDebug' });
    hhGrp.add(worldSword);

    const worldShield = createShieldMesh(0.95);
    worldShield.position.set(-0.2, HH_F2_SURFACE_Y + 0.8, -HH_HALF_D + 0.3);
    worldShield.rotation.set(-0.3, 0, 0);
    worldShield.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    setObjectHitProfile(worldShield, {
        shape: 'sphere',
        center: { x: 0, y: 0, z: 0 },
        radius: 0.95
    }, { debugKey: 'shieldPickupHitboxDebug' });
    hhGrp.add(worldShield);

    const worldSkeleton = createSkeletonMesh(1.2);
    // Sitting against the north wall on floor 2; skeleton faces south (+z).
    worldSkeleton.position.set(-2, HH_F2_SURFACE_Y, -HH_HALF_D + 0.8);
    worldSkeleton.rotation.y = 0;
    worldSkeleton.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    hhGrp.add(worldSkeleton);

    // Merge sword+shield into a single pickup group
    const ssItemGrp = new THREE.Group();
    ssItemGrp.add(worldSword);
    ssItemGrp.add(worldShield);
    hhGrp.add(ssItemGrp);
    // (worldSkeleton stays separate — it survives when HH despawns)

    // ── Position and register ─────────────────────────────────────────────────
    // Group origin = floor-1 surface level; torch required to see interior.
    hhGrp.position.set(ox, baseY, oz);
    hhGrp.rotation.y = rot;
    scene.add(hhGrp);
    hhGrp.updateMatrixWorld(true);

    // Register stair structure boxes in world space (so player can walk up them)
    const stairStructures = [];
    for (let i = 0; i < HH_STAIR_STEPS; i++) {
        // Must match visual loop exactly (same stairShift offset)
        const lxC = stairCX;
        const lzC = HH_HALL_Z + stairShift + (i + 0.5) * stepDepth;
        const wPos = localToWorldXZ(ox, oz, lxC, lzC, rot);
        const entry = addStructureBox(
            wPos.x, wPos.z, baseY + i * stepH,
            stepW, stepH, stepDepth, rot
        );
        stairStructures.push(entry);
    }
    const topStepWorld = localToWorldXZ(ox, oz, stairCX, topStepLZC, rot);
    const topStepEntry = addStructureBox(
        topStepWorld.x, topStepWorld.z, baseY + HH_F1_H,
        stepW, HH_F2_FLOOR_T, stepDepth, rot
    );
    stairStructures.push(topStepEntry);

    // Register floor-2 slab AABBs for blocking/debug use, but keep them out of the
    // generic land-support height path. Legitimate standing on floor 2 comes from the
    // roofCollider top faces above, never from support snapping while below the slab.

    const f2PlateA_world = localToWorldXZ(ox, oz, f2ACX, 0, rot);
    const f2PlateAEntry = addStructureBox(
        f2PlateA_world.x, f2PlateA_world.z, baseY + HH_F1_H,
        f2AW, HH_F2_FLOOR_T, HH_D, rot, { skipSupportHeight: true }
    );
    const f2PlateB_world = localToWorldXZ(ox, oz, f2BCX, f2BCZ, rot);
    const f2PlateBEntry = addStructureBox(
        f2PlateB_world.x, f2PlateB_world.z, baseY + HH_F1_H,
        f2BW, HH_F2_FLOOR_T, f2BD, rot, { skipSupportHeight: true }
    );
    const f2PlateC_world = localToWorldXZ(ox, oz, f2CCX, f2CCZ, rot);
    const f2PlateCEntry = addStructureBox(
        f2PlateC_world.x, f2PlateC_world.z, baseY + HH_F1_H,
        f2CW, HH_F2_FLOOR_T, f2CD, rot, { skipSupportHeight: true }
    );

    // Create entrance block wall entry (inactive initially)
    const entWorld = localToWorldXZ(ox, oz, 0, HH_HALF_D + HH_WALL_T / 2, rot);
    const entranceBlockWall = addSolidWallRect(
        entWorld.x, entWorld.z,
        HH_ENT_W / 2, HH_WALL_T / 2,
        baseY, baseY + HH_ENT_H,
        rot, { isEnclosed: true, active: false }
    );

    // Create hallway door block wall entry (inactive initially)
    const hallDoorWorld = localToWorldXZ(ox, oz, HH_HALL_DOOR_CX, HH_HALL_Z - HH_WALL_T / 2, rot);
    const hallDoorBlockWall = addSolidWallRect(
        hallDoorWorld.x, hallDoorWorld.z,
        HH_HALL_DOOR_W / 2, HH_WALL_T / 2,
        baseY, baseY + HH_HALL_DOOR_H,
        rot, { isEnclosed: true, active: false }
    );

    // Capture all collider refs for clean removal when the HH despawns
    const hhColliderRefs = registerColliderMarkers(collMarkers);
    // Also add the individually tracked walls/entries
    hhColliderRefs.walls.push(entranceBlockWall);
    hhColliderRefs.walls.push(hallDoorBlockWall);

    hauntedHouseData = {
        group: hhGrp,
        worldX: ox, worldZ: oz, worldGroundY: baseY, rotation: rot,
        stairsGroup: stairsGrp,
        stairStructures,
        entryStepStructures,
        f2PlateAEntry, f2PlateBEntry, f2PlateCEntry,
        entranceBlockMesh: entBlockMesh,
        entranceBlockWall,
        hallDoorBlockWall,
        hhHallDoorPivot,
        hhHallDoorAngle: -Math.PI / 2,
        hhHallDoorTargetAngle: -Math.PI / 2,
        ssItemGrp,
        worldSword,          // used as position reference for SS pickup detection
        worldShield,
        worldSkeleton,
        writingMesh: null,          // set async in writingImg.onload
        insigniaDrawingMesh: null,  // set async in drawingImg.onload
        hhHallCrawlerEligible: false,
        hhHallCrawlerEncounterStarted: false,
        hhHallCrawler: null,
        allColliderRefs: hhColliderRefs,
    };

    if (DEBUG_HAUNTED_HOUSE) {
        // Place player 75 units south of the entrance (in front of the HH)
        const entPos = localToWorldXZ(ox, oz, 0, HH_HALF_D + 75, rot);
        player.position.set(entPos.x, baseY + 1, entPos.z);
    }

    if (DEBUG_DESPAWN_HH) {
        // Capture skeleton world position before despawn clears hauntedHouseData
        const skelPos = new THREE.Vector3();
        hauntedHouseData.worldSkeleton.getWorldPosition(skelPos);
        // Mark sequence as complete so state is consistent
        hhSeqPhase = 'complete';
        hasSwordShield = true;
        // Remove the HH and place skeleton + boulder on the world floor
        _despawnHauntedHouse();
        // Place player 10 units in front of the skeleton (facing it head-on)
        const px = skelPos.x + Math.sin(rot) * 10;
        const pz = skelPos.z + Math.cos(rot) * 10;
        player.position.set(px, getGroundHeight(px, pz) + 1, pz);
    }

    // Spawn the dense dark forest that surrounds the haunted house
    createHHForest(ox, oz, groundY);
}

// ── HH Forest tree — taller, bigger, darker than world trees ─────────────────
function _createHHForestTree(x, z) {
    const scale = 1.8 + Math.random() * 1.4;  // noticeably larger than world trees (0.7–1.3)
    const tree = new THREE.Group();
    tree.userData.ignoreCameraOcclusion = true;
    tree.userData.treeHitCount = 0;
    tree.userData.treeScale = scale;
    tree.userData.treeHitCenterY = 8.7 * scale;
    tree.userData.treeHitRadius = 4.2 * scale;
    setObjectHitProfile(tree, {
        shape: 'compound',
        profiles: [
            {
                shape: 'cylinder',
                start: { x: 0, y: 0.00 * scale, z: 0 },
                end:   { x: 0, y: 5.00 * scale, z: 0 },
                radius: 0.50 * scale
            },
            {
                shape: 'cone',
                start: { x: 0, y: 4.75 * scale, z: 0 },
                end:   { x: 0, y: 12.65 * scale, z: 0 },
                radiusStart: 2.80 * scale,
                radiusEnd: 0.00
            }
        ]
    }, { debugKey: 'treeHitboxDebug' });

    const trunkMat  = new THREE.MeshLambertMaterial({ color: 0x26170e });  // near-black dark wood (OG color: #160c06)
    const trunkH = 5 * scale;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, trunkH, 8),
        trunkMat
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    tree.userData.trunkMesh = trunk;

    // Foliage — deep blackish-green, 4 layered cones
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x0d260d }); // OG color: #0b1f0b
    const foliageLayers = [
        { radiusMult: 0.95, height: 4.5 * scale, yOff: trunkH + 2.0 * scale },
        { radiusMult: 0.75, height: 4.0 * scale, yOff: trunkH + 3.8 * scale },
        { radiusMult: 0.55, height: 3.5 * scale, yOff: trunkH + 5.2 * scale },
        { radiusMult: 0.35, height: 2.5 * scale, yOff: trunkH + 6.4 * scale },
    ];
    for (const fl of foliageLayers) {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(2.8 * scale * fl.radiusMult, fl.height, 8),
            foliageMat
        );
        cone.position.y = fl.yOff;
        cone.castShadow = false;
        cone.receiveShadow = true;
        tree.add(cone);
    }

    // Invisible shadow-proxy cone: spans the full foliage envelope so the shadow
    // pass renders one mesh instead of four. colorWrite/depthWrite = false keeps it
    // invisible to the player; the shadow pass ignores those flags (it uses its own
    // depth material) so the cone still casts a shadow.
    const shadowProxy = new THREE.Mesh(
        new THREE.ConeGeometry(2.8 * scale, 7.9 * scale, 8),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    );
    shadowProxy.position.y = 8.7 * scale;
    shadowProxy.castShadow = true;
    tree.add(shadowProxy);

    // Raycast downward against the terrain mesh only (isGround tag set in terrain.js).
    // Trees land on the world ground surface; if that happens to be inside a mountain, that's fine.
    const _hhRaycaster = new THREE.Raycaster(
        new THREE.Vector3(x, 5000, z),
        new THREE.Vector3(0, -1, 0)
    );
    scene.updateMatrixWorld();
    const _hhHits = _hhRaycaster.intersectObjects(scene.children, true).filter(h =>
        h.object.userData.isGround === true
    );
    const surfaceY = _hhHits.length > 0 ? _hhHits[0].point.y : getGroundHeight(x, z);
    tree.position.set(x, surfaceY, z);
    scene.add(tree);
    trees.push(tree);
}

// ── Create HH forest — dense dark trees + boulders within a certain radius ─────
function createHHForest(hhX, hhZ, hhGroundY) {
    const INNER_CLEAR = 60;   // no-tree buffer around the house footprint
    const OUTER_EDGE  = 285;
    const subW = (OUTER_EDGE - INNER_CLEAR) / 4;  // width of each sub-ring

    const rockMatDark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });

    // Four equal-width sub-rings with deterministic tree counts.
    // Distribution from outer to inner: 10 / 20 / 50 / 20 %
    const TOTAL_TREES = 270;
    const rings = [
        { inner: INNER_CLEAR + 3*subW, outer: OUTER_EDGE,           count: Math.round(TOTAL_TREES * 0.05) },
        { inner: INNER_CLEAR + 2*subW, outer: INNER_CLEAR + 3*subW, count: Math.round(TOTAL_TREES * 0.10) },
        { inner: INNER_CLEAR +   subW, outer: INNER_CLEAR + 2*subW, count: Math.round(TOTAL_TREES * 0.45) },
        { inner: INNER_CLEAR,          outer: INNER_CLEAR +   subW, count: Math.round(TOTAL_TREES * 0.40) },
    ];

    const worldLimit = WORLD_SIZE - 10;
    // Track placed tree XZ positions to enforce minimum spacing between trees.
    const placedTreeXZ = [];
    const TREE_MIN_SPACING = 6; // world units between any two tree centres
    for (const ring of rings) {
        let placed = 0;
        let attempts = 0;
        const maxAttempts = ring.count * 15; // generous retry budget
        while (placed < ring.count && attempts < maxAttempts) {
            attempts++;
            const angle = Math.random() * Math.PI * 2;
            const r = ring.inner + Math.random() * (ring.outer - ring.inner);
            const wx = hhX + Math.cos(angle) * r;
            const wz = hhZ + Math.sin(angle) * r;

            if (isPointInWater(wx, wz)) continue;
            if (Math.abs(wx) > worldLimit || Math.abs(wz) > worldLimit) continue;
            // Skip other structures' noTree zones; ignore the HH's own footprint so
            // INNER_CLEAR alone controls the clearance around the house.
            if (placementFootprints.some(fp => fp.noTree && !fp.isHHOwn &&
                    footprintsOverlap({ x: wx, z: wz, radius: 4 }, fp, 0))) continue;
            // Reject if too close to any already-placed HH forest tree
            if (placedTreeXZ.some(p => {
                const dx = p.x - wx, dz = p.z - wz;
                return dx*dx + dz*dz < TREE_MIN_SPACING * TREE_MIN_SPACING;
            })) continue;

            _createHHForestTree(wx, wz);
            placedTreeXZ.push({ x: wx, z: wz });
            placed++;
        }
    }

    // Rocks: scattered throughout the forest — mix of small pebbles and boulders
    // HH building half-diagonal ≈ sqrt(24²+25²) ≈ 34.5; add 5-unit buffer → 39.5
    const ROCK_HH_MIN_DIST_SQ = (Math.sqrt(HH_HALF_W*HH_HALF_W + HH_HALF_D*HH_HALF_D) + 5) ** 2;
    const ROCK_COUNT = 200;
    for (let i = 0; i < ROCK_COUNT; i++) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = INNER_CLEAR + Math.random() * (OUTER_EDGE - INNER_CLEAR);
        const wx = hhX + Math.cos(angle) * radius;
        const wz = hhZ + Math.sin(angle) * radius;

        // Skip rocks within 5 units of the HH perimeter
        const rdx = wx - hhX, rdz = wz - hhZ;
        if (rdx*rdx + rdz*rdz < ROCK_HH_MIN_DIST_SQ) continue;

        if (isPointInWater(wx, wz)) continue;

        // Size varies widely: small pebbles (0.2) to large boulders (4.2)
        const sizePow = Math.pow(Math.random(), 2);   // skew toward small
        const rockRadius = 0.2 + sizePow * 4.0;

        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(rockRadius, 0),
            rockMatDark
        );
        rock.position.set(wx, getGroundHeight(wx, wz) + rockRadius * 0.4, wz);
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.scale.y = 0.5 + Math.random() * 0.6;
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

// ── Create Cemetery forest — same dark trees as HH forest, tight ring ──────────
function createCemeteryForest(cemX, cemZ) {
    const INNER_CLEAR = 60;   // no-tree buffer around the cemetery footprint
    const OUTER_EDGE  = 165;
    const TOTAL_TREES = 80;

    const worldLimit = WORLD_SIZE - 10;
    const placedTreeXZ = [];
    const TREE_MIN_SPACING = 6;

    let placed = 0;
    let attempts = 0;
    const maxAttempts = TOTAL_TREES * 20;
    while (placed < TOTAL_TREES && attempts < maxAttempts) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const r = INNER_CLEAR + Math.random() * (OUTER_EDGE - INNER_CLEAR);
        const wx = cemX + Math.cos(angle) * r;
        const wz = cemZ + Math.sin(angle) * r;

        if (isPointInWater(wx, wz)) continue;
        if (Math.abs(wx) > worldLimit || Math.abs(wz) > worldLimit) continue;
        if (placementFootprints.some(fp => fp.noTree && !fp.isCemOwn &&
                footprintsOverlap({ x: wx, z: wz, radius: 4 }, fp, 0))) continue;
        if (placedTreeXZ.some(p => {
            const dx = p.x - wx, dz = p.z - wz;
            return dx*dx + dz*dz < TREE_MIN_SPACING * TREE_MIN_SPACING;
        })) continue;

        _createHHForestTree(wx, wz);
        placedTreeXZ.push({ x: wx, z: wz });
        placed++;
    }

    // Rocks: scattered throughout the cemetery forest ring
    // Cemetery half-diagonal ≈ sqrt(25²+25²) ≈ 35.4; add 5-unit buffer → 40.4
    const ROCK_CEM_MIN_DIST_SQ = (Math.sqrt(CEM_HALF * CEM_HALF + CEM_HALF * CEM_HALF) + 5) ** 2; //KEEP THIS FOR REFERENCE LATER
    const rockMatDark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const ROCK_INNER_CLEAR = INNER_CLEAR - 20;
    const ROCK_COUNT = 80;
    for (let i = 0; i < ROCK_COUNT; i++) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = ROCK_INNER_CLEAR + Math.random() * (OUTER_EDGE - ROCK_INNER_CLEAR);
        const wx = cemX + Math.cos(angle) * radius;
        const wz = cemZ + Math.sin(angle) * radius;

        // Skip rocks within the cemetery footprint diagonal + buffer
        // const rdx = wx - cemX, rdz = wz - cemZ;
        // if (rdx * rdx + rdz * rdz < ROCK_CEM_MIN_DIST_SQ) continue;

        if (isPointInWater(wx, wz)) continue;
        if (Math.abs(wx) > worldLimit || Math.abs(wz) > worldLimit) continue;

        // Size varies widely: small pebbles (0.2) to large boulders (4.2)
        const sizePow = Math.pow(Math.random(), 2);   // skew toward small
        const rockRadius = 0.2 + sizePow * 3.0;

        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(rockRadius, 0),
            rockMatDark
        );
        rock.position.set(wx, getGroundHeight(wx, wz) + rockRadius * 0.4, wz);
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.scale.y = 0.5 + Math.random() * 0.6;
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
    }
}

// ── removeHHStairs / restoreHHStairs ─────────────────────────────────────────
function removeHHStairs() {
    if (!hauntedHouseData) return;
    hauntedHouseData.stairsGroup.visible = false;
    for (const s of hauntedHouseData.stairStructures) {
        const idx = structures.indexOf(s);
        if (idx !== -1) structures.splice(idx, 1);
    }
}

function restoreHHStairs() {
    if (!hauntedHouseData) return;
    hauntedHouseData.stairsGroup.visible = true;
    for (const s of hauntedHouseData.stairStructures) {
        if (!structures.includes(s)) structures.push(s);
    }
}

function removeHHEntrance() {
    if (!hauntedHouseData) return;
    hauntedHouseData.entranceBlockMesh.visible = true;
    hauntedHouseData.entranceBlockWall.active = true;
}

function restoreHHEntrance() {
    if (!hauntedHouseData) return;
    hauntedHouseData.entranceBlockMesh.visible = false;
    hauntedHouseData.entranceBlockWall.active = false;
}

function closeHHHallDoor() {
    if (!hauntedHouseData) return;
    hauntedHouseData.hhHallDoorTargetAngle = 0;
    // Activate wall collider immediately — player is in the main room at this point
    hauntedHouseData.hallDoorBlockWall.active = true;
}

function restoreHHHallDoor() {
    if (!hauntedHouseData) return;
    hauntedHouseData.hhHallDoorTargetAngle = -Math.PI / 2;
    // Deactivate wall collider immediately so player can pass
    hauntedHouseData.hallDoorBlockWall.active = false;
}

// ── Animate HH hallway door each frame ────────────────────────────────────────
function updateHHHallDoor(delta) {
    if (!hauntedHouseData || !hauntedHouseData.hhHallDoorPivot) return;
    const hd = hauntedHouseData;
    if (hd.hhHallDoorAngle === hd.hhHallDoorTargetAngle) return;
    hd.hhHallDoorAngle = moveScalarToward(hd.hhHallDoorAngle, hd.hhHallDoorTargetAngle, delta * 3.5);
    hd.hhHallDoorPivot.rotation.y = hd.hhHallDoorAngle;
}

function _isInsideHHFloor1(localPos, localY) {
    return (
        Math.abs(localPos.x) < HH_HALF_W + 1 &&
        Math.abs(localPos.z) < HH_HALF_D + 1 &&
        localY > -0.5 &&
        localY < HH_F1_H - 1
    );
}

function _isInsideHHGroundHallway(localPos, localY) {
    const hallDoorL = HH_HALL_DOOR_CX - HH_HALL_DOOR_W / 2;
    return (
        localY > -0.5 &&
        localY < HH_F1_H - 1 &&
        localPos.x > hallDoorL + 0.35 &&
        localPos.x < HH_HALL_X - 0.75 &&
        localPos.z > -HH_HALF_D + 0.75 &&
        localPos.z < HH_HALL_Z - 0.35
    );
}

function _makeHHHallCrawlerBlack(mesh) {
    const eyeMeshes = [];
    mesh.traverse(obj => {
        if (!obj.isMesh || !obj.material) return;
        obj.castShadow = true;
        if (obj.material.color && obj.material.color.getHex() === 0xcc3300) {
            eyeMeshes.push(obj);
            return;
        }
        if (obj.material.color) obj.material.color.setHex(0x000000);
        if (obj.material.emissive) obj.material.emissive.setHex(0x000000);
    });
    for (const eye of eyeMeshes) {
        if (eye.parent) eye.parent.remove(eye);
    }
}

function _spawnHHHallCrawler() {
    const hd = hauntedHouseData;
    if (!hd || hd.hhHallCrawlerEncounterStarted || typeof _buildCrawlerMesh !== 'function') return null;

    const crawlerLocalX = HH_HALL_X - 2.2;
    const crawlerLocalZ = (-HH_HALF_D + HH_HALL_Z) / 2;
    const worldPos = localToWorldXZ(hd.worldX, hd.worldZ, crawlerLocalX, crawlerLocalZ, hd.rotation);
    const mesh = _buildCrawlerMesh();
    _makeHHHallCrawlerBlack(mesh);
    mesh.userData.ignoreCameraOcclusion = true;
    mesh.userData.hhHallCrawler = true;
    mesh.position.set(worldPos.x, hd.worldGroundY, worldPos.z);
    mesh.rotation.y = hd.rotation - Math.PI / 2;
    scene.add(mesh);

    hd.hhHallCrawlerEncounterStarted = true;
    hd.hhHallCrawler = {
        mesh,
        released: false,
    };
    return hd.hhHallCrawler;
}

function _releaseHHHallCrawler(crawler) {
    if (!crawler || crawler.released || !crawler.mesh ||
        typeof nightCreatures === 'undefined' || !Array.isArray(nightCreatures)) return;
    crawler.released = true;
    const hitProfile = typeof makeCreatureHitProfile === 'function'
        ? makeCreatureHitProfile('crawler')
        : { shape: 'capsule', start: { x: 0, y: 0.58, z: -0.45 }, end: { x: 0, y: 0.72, z: 2.15 }, radius: 0.50 };
    attachHitProfileDebugVisual(crawler.mesh, hitProfile);
    nightCreatures.push({
        type: 'crawler',
        mesh: crawler.mesh,
        hp: typeof CREATURE_MAX_HP === 'number' ? CREATURE_MAX_HP : 5,
        hitCooldown: 0,
        gunHitCenterY: 0.30,
        gunHitRadius: 0.75,
        hitProfile,
        isCemZombie: false,
        isHHSpecialCrawler: true,
        speed: 0.75 * (typeof CREATURE_SPEED === 'number' ? CREATURE_SPEED : WALK_SPEED * 0.9),
        emergeTimer: 0,
        emergeStartY: crawler.mesh.position.y,
        emergeTargetY: crawler.mesh.position.y,
    });
}

function _updateHHHallCrawlerEncounter(localPos, localY) {
    const hd = hauntedHouseData;
    if (!hd) return;

    if (!hd.hhHallCrawlerEligible && hasTalisman && hasTorch && _isInsideHHFloor1(localPos, localY)) {
        hd.hhHallCrawlerEligible = true;
    }

    const inHallway = _isInsideHHGroundHallway(localPos, localY);
    if (hd.hhHallCrawlerEligible && !hd.hhHallCrawlerEncounterStarted && inHallway) {
        _spawnHHHallCrawler();
    }

    const crawler = hd.hhHallCrawler;
    if (!crawler || crawler.released || !crawler.mesh || !inHallway) return;

    const dist = Math.hypot(
        player.position.x - crawler.mesh.position.x,
        player.position.z - crawler.mesh.position.z
    );
    if (dist <= HH_HALL_CRAWLER_TRIGGER_DIST) {
        _releaseHHHallCrawler(crawler);
    }
}

function _clearHHHallCrawler() {
    if (!hauntedHouseData || !hauntedHouseData.hhHallCrawler) return;
    const crawler = hauntedHouseData.hhHallCrawler;
    if (crawler.mesh) {
        const idx = (typeof nightCreatures !== 'undefined' && Array.isArray(nightCreatures))
            ? nightCreatures.findIndex(c => c.mesh === crawler.mesh)
            : -1;
        if (idx !== -1) nightCreatures.splice(idx, 1);
        scene.remove(crawler.mesh);
    }
    hauntedHouseData.hhHallCrawler = null;
}

// ── createCemetery ───────────────────────────────────────────────────────────
function createCemetery() {
    if (!hauntedHouseData) { console.warn('Cemetery: HH not placed yet'); return; }

    const hhX = hauntedHouseData.worldX;
    const hhZ = hauntedHouseData.worldZ;
    const region = { type: 'ring', minRadius: 1650, maxRadius: 2200 };

    const placement = findPlacementInRegion(region, (pt, rotation) => {
        // Enforce minimum distance from HH
        if (Math.hypot(pt.x - hhX, pt.z - hhZ) < CEM_MIN_DIST_FROM_HH) return null;
        // Reject steep / elevated terrain (same guard as HH)
        const stats = sampleTerrainStats(pt.x, pt.z, 50, 3, 12);
        if (stats.range > 28) return null;
        const rot2 = rotation ?? randomRotationY();
        return {
            x: pt.x, z: pt.z, rotation: rot2,
            footprint: { ...makePlacementFootprint(pt.x, pt.z, 48), noTree: true }
        };
    }, 600, { rotationCount: 12, pointDensity: 1.3 });

    if (!placement) { console.warn('Cemetery: no placement found'); return; }

    const { x: ox, z: oz, rotation: rot } = placement;
    // Flatten a slightly larger area than the cemetery footprint so the visible
    // terrain stays level despite the coarse 30-unit terrain grid spacing.
    const cemeteryTerrainY = flattenTerrainRotatedRect(
        ox,
        oz,
        CEM_HALF + CEM_TERRAIN_FLAT_MARGIN,
        CEM_HALF + CEM_TERRAIN_FLAT_MARGIN,
        rot,
        getGroundHeight(ox, oz),
        CEM_TERRAIN_FLAT_BLEND
    );
    const groundY = cemeteryTerrainY;
    const cemeteryFloorYShift = -0.2; // tune to shift entire cemetery up/down (stone posts are exempt)
    const cemeteryFloorY = groundY + CEM_Y_OFFSET + cemeteryFloorYShift;
    const cemGrp = new THREE.Group();
    // cemGrp.userData.ignoreCameraOcclusion = true;

    const ironMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5a5a62 });
    const dirtMat  = new THREE.MeshLambertMaterial({ color: 0x3a2e22 });
    const graveMat = new THREE.MeshLambertMaterial({ color: 0x555568 });
    const graveDirtMat = new THREE.MeshLambertMaterial({ color: 0x2a180f });
    const walkwayMat = new THREE.MeshLambertMaterial({ color: 0x66666f });

    // Helper
    const CB = (w, h, d, lx, ly, lz, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(lx, ly + h / 2, lz);
        m.castShadow = true;
        m.receiveShadow = true;
        cemGrp.add(m);
        return m;
    };
    const addCemeteryWall = (localX, localZ, halfW, halfD, minY, maxY, localRotation = 0, extra = {}) => {
        const world = localToWorldXZ(ox, oz, localX, localZ, rot);
        return addSolidWallRect(world.x, world.z, halfW, halfD, cemeteryFloorY + minY, cemeteryFloorY + maxY, rot + localRotation, extra);
    };
    const addCemeteryCeiling = (localX, localZ, halfW, halfD, localY, localRotation = 0) => {
        const world = localToWorldXZ(ox, oz, localX, localZ, rot);
        return addCeilingRect(world.x, world.z, halfW, halfD, cemeteryFloorY + localY, rot + localRotation);
    };
    const addCemeteryRoofCollider = (localX, localZ, halfW, halfD, topLocalY, bottomLocalY, localRotation = 0) => {
        const world = localToWorldXZ(ox, oz, localX, localZ, rot);
        return addRoofColliderRect(world.x, world.z, halfW, halfD, cemeteryFloorY + topLocalY, cemeteryFloorY + bottomLocalY, rot + localRotation);
    };
    const makeGraveDirtSpotMesh = () => {
        const dirtShape = new THREE.Shape();
        // Irregular rectangle: 4 corners anchored at the rectangle boundary, with
        // slightly bumpy edges so it reads as hand-dug rather than perfectly rectangular.
        const pts = [
            // Bottom edge (left → right)
            new THREE.Vector2(-1.40, -0.48),  // BL corner
            new THREE.Vector2(-0.50, -0.54),  // bottom, near-left — slight outward bump
            new THREE.Vector2( 0.48, -0.53),  // bottom, near-right — slight bump
            new THREE.Vector2( 1.42, -0.47),  // BR corner
            // Right edge (bottom → top)
            new THREE.Vector2( 1.50, -0.12),  // right, lower
            new THREE.Vector2( 1.47,  0.18),  // right, upper
            // Top edge (right → left)
            new THREE.Vector2( 1.38,  0.50),  // TR corner
            new THREE.Vector2( 0.44,  0.55),  // top, near-right — slight bump
            new THREE.Vector2(-0.40,  0.52),  // top, near-left
            new THREE.Vector2(-1.36,  0.49),  // TL corner
            // Left edge (top → bottom)
            new THREE.Vector2(-1.46,  0.16),  // left, upper
            new THREE.Vector2(-1.48, -0.16),  // left, lower
        ];
        dirtShape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) dirtShape.lineTo(pts[i].x, pts[i].y);
        dirtShape.closePath();
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(dirtShape), graveDirtMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -Math.PI / 2;
        mesh.receiveShadow = true;
        return mesh;
    };
    const makeTombCapMesh = () => {
        const capShape = new THREE.Shape();
        capShape.absarc(0, 0, 0.6, Math.PI, 0, false);
        capShape.lineTo(0.6, 0);
        capShape.lineTo(-0.6, 0);
        capShape.closePath();
        const geom = new THREE.ExtrudeGeometry(capShape, {
            depth: 0.3,
            bevelEnabled: false
        });
        geom.translate(0, 0, -0.15);
        const mesh = new THREE.Mesh(geom, graveMat);
        mesh.scale.y = 0.5;
        mesh.rotation.z = Math.PI;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        return mesh;
    };

    // ── Ground slab and walkways (5-unit thickness avoids terrain gaps) ──────
    CB(CEM_HALF * 2, 5, CEM_HALF * 2, 0, -5, 0, dirtMat);
    CB(4.4, 5, CEM_HALF * 2 - 2.4, 0, 0.08 - 5, 0, walkwayMat);
    CB(CEM_HALF * 2 - 2.4, 5, 4.4, 0, 0.08 - 5, 0, walkwayMat);
    // Register as climbable surfaces so the player walks on their top faces
    addLocalStructureBox(ox, oz, 0, 0, cemeteryFloorY - 5,        CEM_HALF * 2,        5, CEM_HALF * 2,        rot);
    addLocalStructureBox(ox, oz, 0, 0, cemeteryFloorY + 0.08 - 5, 4.4,                 5, CEM_HALF * 2 - 2.4,  rot);
    addLocalStructureBox(ox, oz, 0, 0, cemeteryFloorY + 0.08 - 5, CEM_HALF * 2 - 2.4, 5, 4.4,                  rot);

    // ── Fence posts: 4 corners + 2 per side (at 1/3 and 2/3 of each side) ───
    const postPositions = [];
    const third = CEM_HALF * 2 / 3;

    // 4 corners
    for (const [px, pz] of [[-CEM_HALF, -CEM_HALF], [CEM_HALF, -CEM_HALF],
                             [-CEM_HALF,  CEM_HALF], [CEM_HALF,  CEM_HALF]]) {
        postPositions.push({ x: px, z: pz });
    }
    // Interval posts along each side
    for (let t = 1; t <= 2; t++) {
        postPositions.push({ x: -CEM_HALF + t * third, z: -CEM_HALF }); // North side
        postPositions.push({ x: -CEM_HALF + t * third, z:  CEM_HALF }); // South side
        postPositions.push({ x: -CEM_HALF, z: -CEM_HALF + t * third }); // West side
        postPositions.push({ x:  CEM_HALF, z: -CEM_HALF + t * third }); // East side
    }

    for (const pp of postPositions) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(CEM_POST_R, CEM_POST_R, CEM_POST_H, 8), stoneMat);
        post.position.set(pp.x, CEM_POST_H / 2 - 1 - cemeteryFloorYShift, pp.z);
        post.castShadow = true;
        cemGrp.add(post);
        // Post cap
        const cap = new THREE.Mesh(new THREE.BoxGeometry(CEM_POST_R * 2.2, CEM_POST_R, CEM_POST_R * 2.2), stoneMat);
        cap.position.set(pp.x, CEM_POST_H + CEM_POST_R / 2 - 1 - cemeteryFloorYShift, pp.z);
        cemGrp.add(cap);
    }

    // ── Fence panels (iron rails between posts) ───────────────────────────────
    const fenceRailH = 0.12;

    const addFencePanel = (x1, z1, x2, z2) => {
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
        // Top rail
        const rTop = new THREE.Mesh(new THREE.BoxGeometry(len, fenceRailH, fenceRailH), ironMat);
        rTop.position.set(cx, CEM_FENCE_H - 0.3, cz);
        rTop.rotation.y = angle;
        cemGrp.add(rTop);
        // Bottom rail
        const rBot = new THREE.Mesh(new THREE.BoxGeometry(len, fenceRailH, fenceRailH), ironMat);
        rBot.position.set(cx, 0.8, cz);
        rBot.rotation.y = angle;
        cemGrp.add(rBot);
        // Vertical pickets (thin rods every ~1 unit)
        const numPickets = Math.max(1, Math.floor(len - 1));
        for (let p = 0; p < numPickets; p++) {
            const t = (p + 0.5) / numPickets;
            const px = x1 + t * dx;
            const pz = z1 + t * dz;
            const picket = new THREE.Mesh(new THREE.BoxGeometry(0.08, CEM_FENCE_H, 0.08), ironMat);
            picket.position.set(px, CEM_FENCE_H / 2, pz);
            cemGrp.add(picket);
        }
    };

    // ── Fence panels around the 4 sides (gap on south side for entrance) ──────
    // South side: two pieces with gap at center
    addFencePanel(-CEM_HALF, CEM_HALF, -CEM_ENT_HALF_W, CEM_HALF);
    addFencePanel( CEM_ENT_HALF_W, CEM_HALF, CEM_HALF, CEM_HALF);
    // North side: full
    addFencePanel(-CEM_HALF, -CEM_HALF, CEM_HALF, -CEM_HALF);
    // West side: full
    addFencePanel(-CEM_HALF, -CEM_HALF, -CEM_HALF, CEM_HALF);
    // East side: full
    addFencePanel( CEM_HALF, -CEM_HALF, CEM_HALF, CEM_HALF);

    // ── Stone step perimeter at base of fence ─────────────────────────────────
    const cemStepW   = 0.4;   // thinner than posts (diam 1.1), thicker than rails (0.08)
    const cemStepH   = 0.1;   // top surface height above floor
    const cemStepExt = 5;     // extends this far downward to avoid terrain gaps
    const cemStepLY  = cemStepH - cemStepExt; // bottom at cemStepH - cemStepExt, top at cemStepH
    const southPieceW  = CEM_HALF - CEM_ENT_HALF_W;
    const southPieceCX = (CEM_HALF + CEM_ENT_HALF_W) / 2;
    CB(CEM_HALF * 2, cemStepExt, cemStepW,  0,            cemStepLY, -CEM_HALF, stoneMat); // North
    CB(southPieceW,  cemStepExt, cemStepW, -southPieceCX, cemStepLY,  CEM_HALF, stoneMat); // South left
    CB(southPieceW,  cemStepExt, cemStepW,  southPieceCX, cemStepLY,  CEM_HALF, stoneMat); // South right
    CB(cemStepW, cemStepExt, CEM_HALF * 2, -CEM_HALF, cemStepLY, 0, stoneMat);            // West
    CB(cemStepW, cemStepExt, CEM_HALF * 2,  CEM_HALF, cemStepLY, 0, stoneMat);            // East

    // ── Entrance sign ─────────────────────────────────────────────────────────
    const signW = CEM_ENT_HALF_W * 2;
    const signH = 2.2;
    CB(signW, signH, 0.35, 0, CEM_POST_H - 0.5, CEM_HALF + 0.05, graveMat); // stone-gray backing
    // Cemetery maxim sign face: base64 PNG with transparent background + dark text
    const signTex = new THREE.TextureLoader().load(IMAGE_CEMETERY_MAXIM);
    const signFaceMat = new THREE.MeshBasicMaterial({
        map: signTex,
        color: 0xffd7a0,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide
    });
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(signW - 1.4, signH - 1.2), signFaceMat);
    signFace.position.set(0, CEM_POST_H - 0.5 + signH / 2, CEM_HALF + 0.24);
    cemGrp.add(signFace);

    // ── Narrow stone supports flanking the entrance, holding the sign ─────────
    const signPostR = 0.3;  // thinner than regular posts (CEM_POST_R=0.55)
    const signPostH = CEM_POST_H - 0.5 + signH + 1; // spans from -1 below floor to sign top
    const signPostCY = signPostH / 2 - 1 - cemeteryFloorYShift; // exempt from floor shift
    for (const sx of [-CEM_ENT_HALF_W, CEM_ENT_HALF_W]) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(signPostR, signPostR, signPostH, 8), stoneMat);
        sp.position.set(sx, signPostCY, CEM_HALF);
        sp.castShadow = true;
        cemGrp.add(sp);
    }

    // ── Small stone room (northeast corner: x≈+16, z≈-16) ────────────────────
    const srX = 16, srZ = -16, srS = 8, srH = 6;
    const srDoorW = 2.2, srDoorH = 3.6;
    const srWallT = 0.6;
    const srWallSink = 5;
    const srMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
    const srSouthZ = srZ + srS / 2;
    const srSouthSideW = (srS + srWallT - srDoorW) / 2;
    const srSouthLeftX = srX - (srDoorW / 2 + srSouthSideW / 2);
    const srSouthRightX = srX + (srDoorW / 2 + srSouthSideW / 2);

    // ── Graves ───────────────────────────────────────────────────────────────
    const gravePitch = 4.5;
    const tgX = -18, tgZ = -18;

    const addGrave = (gx, gz, isTalisman = false) => {
        const dirtSpot = makeGraveDirtSpotMesh();
        dirtSpot.position.set(gx, 0.02, gz + 0.8);
        cemGrp.add(dirtSpot);

        const tstone = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), graveMat);
        tstone.position.set(gx, 0.9, gz - 1.0);
        tstone.castShadow = true;
        tstone.receiveShadow = false;
        cemGrp.add(tstone);

        const tcap = makeTombCapMesh();
        tcap.position.set(gx, 2.0, gz - 1.0);
        cemGrp.add(tcap);

        if (isTalisman) {
            // Insignia decal on the back face of the talisman tombstone
            // Image is 1602x1306 (aspect ~1.226); tombstone back face is 1.2w × 2.2h
            const insigniaTex = new THREE.TextureLoader().load(IMAGE_TALISMAN_INSIGNIA);
            const insigniaMat = new THREE.MeshBasicMaterial({
                map: insigniaTex,
                color: 0x666666,   // tint
                transparent: true,
                alphaTest: 0.05,
                side: THREE.FrontSide,
                depthWrite: false
            });
            // PlaneGeometry sized to fit the back face with a small margin
            const insigW = 1.0;
            const insigH = insigW / (1602 / 1306);  // ≈ 0.815
            const insig = new THREE.Mesh(new THREE.PlaneGeometry(insigW, insigH), insigniaMat);
            // Back face center: same x/y as tombstone, z offset by -half-depth - tiny epsilon
            insig.position.set(gx, 1.2, gz - 1.0 - 0.152);
            insig.rotation.y = Math.PI;  // face toward -Z (away from grave)
            cemGrp.add(insig);
        }
    };

    let cemeteryGraveCount = 0;
    const gravePositions = []; // {localX, localZ} for each non-talisman grave
    for (let gz = -18; gz <= 18.001; gz += gravePitch) {
        for (let gx = -18; gx <= 18.001; gx += gravePitch) {
            const isOnWalkway = Math.abs(gx) < 0.1 || Math.abs(gz) < 0.1;
            if (isOnWalkway) continue;

            const overlapsRoom = gx > srX - srS / 2 - 1.6 &&
                gx < srX + srS / 2 + 1.6 &&
                gz > srZ - srS / 2 - 1.8 &&
                gz < srZ + srS / 2 + 1.8;
            if (overlapsRoom) continue;

            const roundedX = Math.round(gx * 10) / 10;
            const roundedZ = Math.round(gz * 10) / 10;
            const isTalisman = roundedX === tgX && roundedZ === tgZ;
            addGrave(roundedX, roundedZ, isTalisman);
            cemeteryGraveCount++;
            if (!isTalisman) gravePositions.push({ localX: roundedX, localZ: roundedZ });
        }
    }

    const talismanGraveHitRoot = new THREE.Object3D();
    talismanGraveHitRoot.position.set(tgX, 0.02, tgZ + 0.8);
    talismanGraveHitRoot.userData.ignoreCameraOcclusion = true;
    setObjectHitProfile(talismanGraveHitRoot, {
        shape: 'box',
        center: { x: 0, y: 0, z: 0 },
        halfSize: { x: 1.65, y: 0.35, z: 0.75 }
    }, { debugKey: 'talismanGraveDigHitboxDebug' });
    cemGrp.add(talismanGraveHitRoot);

    // Walls with a south-facing doorway toward the cemetery interior
    CB(srS + srWallT, srH + srWallSink, srWallT, srX, -srWallSink, srZ - srS / 2, srMat);            // North wall
    CB(srSouthSideW, srH + srWallSink, srWallT, srSouthLeftX, -srWallSink, srSouthZ, srMat);     // South wall left
    CB(srSouthSideW, srH + srWallSink, srWallT, srSouthRightX, -srWallSink, srSouthZ, srMat);    // South wall right
    CB(srDoorW, srH - srDoorH, srWallT, srX, srDoorH, srSouthZ, srMat);   // Door lintel
    CB(srWallT, srH + srWallSink, srS, srX - srS / 2, -srWallSink, srZ, srMat);                  // West wall
    CB(srWallT, srH + srWallSink, srS, srX + srS / 2, -srWallSink, srZ, srMat);                  // East wall
    // Roof
    CB(srS + 1.2, 0.5, srS + 1.2, srX, srH, srZ, srMat);
    // Floor (raised 0.1 above cemetery slab to eliminate Z-fighting)
    CB(srS, 0.2, srS, srX, -0.1, srZ, srMat);
    // ── Stone room oil lamp ───────────────────────────────────────────────────
    const hhMetalMat = new THREE.MeshLambertMaterial({ color: 0x1c1208 }); // very dark rustic metal
    const hhGlassMat = new THREE.MeshLambertMaterial({
        color: 0xffaa44, emissive: 0xff9500, emissiveIntensity: 0.85,
        transparent: true, opacity: 0.75
    });
    const lamp = new THREE.Group();
    // Wide flared base foot
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.25, 0.06, 12), hhMetalMat);
    foot.position.y = 0.03;
    lamp.add(foot);
    // Fuel reservoir (squat cylinder sitting on base)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.18, 10), hhMetalMat);
    tank.position.y = 0.12;
    tank.castShadow = true;
    lamp.add(tank);
    // Burner collar (narrows from tank to chimney)
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.06, 10), hhMetalMat);
    burner.position.y = 0.24;
    lamp.add(burner);
    // Glass chimney (emissive, slightly tapered)
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.52, 12), hhGlassMat);
    chimney.position.y = 0.53;
    lamp.add(chimney);
    // Cross braces visible through the glass (X pattern)
    for (const rz of [Math.PI / 5, -Math.PI / 5]) {
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 4), hhMetalMat);
        brace.rotation.z = rz;
        brace.position.y = 0.50;
        lamp.add(brace);
    }
    // Chimney top ring
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.04, 6, 12), hhMetalMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 0.84;
    lamp.add(topRing);
    // Vent cap
    const ventCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 0.05, 8), hhMetalMat);
    ventCap.position.y = 0.89;
    lamp.add(ventCap);

    // Top cap body
    const topCapBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8), hhMetalMat);
    topCapBody.position.y = 0.77;
    lamp.add(topCapBody);

    // Side support arms (wire frame brackets flanking the chimney, base to top ring)
    for (const sx of [-0.17, 0.17]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.59, 6), hhMetalMat);
        arm.position.set(sx, 0.505, 0);
        lamp.add(arm);
        // Small bracket connecting arm to tank collar
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(sx) * 2, 0.025, 0.025), hhMetalMat);
        bracket.position.set(0, 0.22, 0);
        lamp.add(bracket);
    }

    // Bail handle — thin wire loop arching upward
    const bailRadius = 0.13;
    const bailTube = 0.013;
    const bailY = 0.95;

    const bail = new THREE.Mesh(
    new THREE.TorusGeometry(bailRadius, bailTube, 6, 20, Math.PI),
    hhMetalMat
    );
    bail.position.set(0, bailY, 0);
    lamp.add(bail);

    // Vertical extensions from bail ends down to lamp
    const bailDropTop = bailY;
    const bailDropBottom = 0.83; // where they meet the lamp
    const bailDropLen = bailDropTop - bailDropBottom;
    const bailDropY = bailDropBottom + bailDropLen / 2;

    for (const sx of [-bailRadius, bailRadius]) {
    const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(bailTube, bailTube, bailDropLen, 6),
        hhMetalMat
    );
    drop.position.set(sx, bailDropY, 0);
    lamp.add(drop);
    }

    // Point light inside chimney
    const lampLight = new THREE.PointLight(0xFF6600, 4.0, 40, 1.65);
    lampLight.position.y = 0.53;
    // lampLight.castShadow = true; // DEBUG SHADOW - decided to disable for performance reasons
    lampLight.shadow.mapSize.set(512, 512);
    lampLight.shadow.bias = -0.0008;
    lampLight.shadow.normalBias = 0.08;
    lampLight.shadow.radius = 2;
    lampLight.userData.baseIntensity = 4.0;
    lampLight.userData.currentIntensity = 4.0;
    lampLight.userData.targetIntensity = 4.0;
    lampLight.userData.baseDistance = 40;
    lampLight.userData.currentDistance = 40;
    lampLight.userData.targetDistance = 40;
    lampLight.userData.flickerTimer = 0;
    lamp.add(lampLight);
    // NW corner of the room (floor raised by 0.1)
    lamp.position.set(srX - srS / 2 + 0.75, 0.1, srZ - srS / 2 + 0.75);
    cemGrp.add(lamp);
    // Robust collision for the room and fence, registered directly in world space.
    const bonusCollisionHeight = 1.75;
    const cemeteryFenceHalfT = cemStepW / 2;
    addCemeteryWall(0.5 * (-CEM_HALF - CEM_ENT_HALF_W), CEM_HALF, (CEM_HALF - CEM_ENT_HALF_W) / 2 + 0.2, cemeteryFenceHalfT, -4.4, CEM_FENCE_H + bonusCollisionHeight);
    addCemeteryWall(0.5 * (CEM_ENT_HALF_W + CEM_HALF), CEM_HALF, (CEM_HALF - CEM_ENT_HALF_W) / 2 + 0.2, cemeteryFenceHalfT, -4.4, CEM_FENCE_H + bonusCollisionHeight);
    addCemeteryWall(0, -CEM_HALF, CEM_HALF + 0.2, cemeteryFenceHalfT, -4.4, CEM_FENCE_H + bonusCollisionHeight);
    addCemeteryWall(-CEM_HALF, 0, CEM_HALF + 0.2, cemeteryFenceHalfT, -4.4, CEM_FENCE_H + bonusCollisionHeight, Math.PI / 2);
    addCemeteryWall(CEM_HALF, 0, CEM_HALF + 0.2, cemeteryFenceHalfT, -4.4, CEM_FENCE_H + bonusCollisionHeight, Math.PI / 2);
    const srWallHalfT = srWallT / 2;
    addCemeteryWall(srX, srZ - srS / 2, srS / 2 + srWallHalfT, srWallHalfT, -srWallSink, srH);         // North wall
    addCemeteryWall(srSouthLeftX, srSouthZ, srSouthSideW / 2, srWallHalfT, -srWallSink, srH);  // South left
    addCemeteryWall(srSouthRightX, srSouthZ, srSouthSideW / 2, srWallHalfT, -srWallSink, srH); // South right
    addCemeteryWall(srX, srSouthZ, srDoorW / 2, srWallHalfT, srDoorH, srH);          // Lintel above door
    addCemeteryWall(srX - srS / 2, srZ, srS / 2, srWallHalfT, -srWallSink, srH, Math.PI / 2); // West wall
    addCemeteryWall(srX + srS / 2, srZ, srS / 2, srWallHalfT, -srWallSink, srH, Math.PI / 2); // East wall
    addCemeteryCeiling(srX, srZ, srS / 2 + 0.5, srS / 2 + 0.5, srH);              // Roof (inside — blocks jump-through)
    addCemeteryRoofCollider(srX, srZ, srS / 2 + 0.6, srS / 2 + 0.6, srH + 0.5, srH); // Roof (outside — supports standing on top)
    const cemeteryRoomWorld = localToWorldXZ(ox, oz, srX, srZ, rot);
    const cemeteryRoomEntryWorld = localToWorldXZ(ox, oz, srX, srSouthZ, rot);
    playerEnclosureRegions.push({
        x: cemeteryRoomWorld.x,
        z: cemeteryRoomWorld.z,
        halfW: srS / 2 - srWallHalfT,
        halfD: srS / 2 - srWallHalfT,
        outerHalfW: srS / 2 + srWallHalfT,
        outerHalfD: srS / 2 + srWallHalfT,
        rotation: rot,
        barrierTopY: cemeteryFloorY + srH,
        entryX: cemeteryRoomEntryWorld.x,
        entryZ: cemeteryRoomEntryWorld.z,
        entryHalfW: srDoorW / 2 + srWallHalfT,
        entryHalfD: srWallT + 0.4,
    });

    // ── Iron gates (pivot at each entrance post, initially open outward) ───────
    // Gate open angles: left gate rotation.y = -π/2, right = +π/2 (panels swing south outside cemetery).
    // Closed angle = 0 for both (panels span across entrance gap).
    const rad15deg = Math.PI/12;
    const GATE_OPEN_L  = -Math.PI / 2 - rad15deg;
    const GATE_OPEN_R  =  Math.PI / 2 + rad15deg;
    const GATE_SPEED   = 2.5; // rad/s

    const _makeGatePanel = (pivotGrp, panelDir) => {
        const panelLen  = CEM_ENT_HALF_W; // 3.5
        const panelCX   = panelDir * panelLen / 2;
        const fenceRailH = 0.12;

        const rTop = new THREE.Mesh(new THREE.BoxGeometry(panelLen, fenceRailH, fenceRailH), ironMat);
        rTop.position.set(panelCX, CEM_FENCE_H - 0.3, 0);
        pivotGrp.add(rTop);

        const rBot = new THREE.Mesh(new THREE.BoxGeometry(panelLen, fenceRailH, fenceRailH), ironMat);
        rBot.position.set(panelCX, 0.8, 0);
        pivotGrp.add(rBot);

        const numPickets = 3; //Math.max(1, Math.floor(panelLen - 1));
        for (let p = 0; p < numPickets; p++) {
            const t  = (p + 0.5) / numPickets;
            const px = panelDir * t * panelLen;
            const picket = new THREE.Mesh(new THREE.BoxGeometry(0.08, CEM_FENCE_H, 0.08), ironMat);
            picket.position.set(px, CEM_FENCE_H / 2, 0);
            pivotGrp.add(picket);
        }
    };

    const leftGatePivot = new THREE.Group();
    leftGatePivot.position.set(-CEM_ENT_HALF_W, 0, CEM_HALF);
    leftGatePivot.rotation.y = GATE_OPEN_L;
    _makeGatePanel(leftGatePivot, +1);
    setObjectHitProfile(leftGatePivot, {
        shape: 'box',
        center: { x: CEM_ENT_HALF_W / 2, y: CEM_FENCE_H / 2, z: 0 },
        halfSize: { x: CEM_ENT_HALF_W / 2, y: CEM_FENCE_H / 2, z: 0.28 }
    }, { debugKey: 'leftGateHitboxDebug' });
    cemGrp.add(leftGatePivot);

    const rightGatePivot = new THREE.Group();
    rightGatePivot.position.set(CEM_ENT_HALF_W, 0, CEM_HALF);
    rightGatePivot.rotation.y = GATE_OPEN_R;
    _makeGatePanel(rightGatePivot, -1);
    setObjectHitProfile(rightGatePivot, {
        shape: 'box',
        center: { x: -CEM_ENT_HALF_W / 2, y: CEM_FENCE_H / 2, z: 0 },
        halfSize: { x: CEM_ENT_HALF_W / 2, y: CEM_FENCE_H / 2, z: 0.28 }
    }, { debugKey: 'rightGateHitboxDebug' });
    cemGrp.add(rightGatePivot);

    // Invisible collision wall for the closed gates — disabled when gates are open
    const gateWall = addCemeteryWall(0, CEM_HALF, CEM_ENT_HALF_W, cemeteryFenceHalfT, -4.4, CEM_FENCE_H + bonusCollisionHeight);
    gateWall.active = false; // gates start open

    cemGrp.position.set(ox, cemeteryFloorY, oz);
    cemGrp.rotation.y = rot;
    scene.add(cemGrp);
    cemGrp.updateMatrixWorld(true);

    // Compute talisman grave world position for dig detection
    const tgWorld = localToWorldXZ(ox, oz, tgX, tgZ, rot);
    const entranceWorld = localToWorldXZ(ox, oz, 0, CEM_HALF, rot);
    cemeteryData = {
        group: cemGrp,
        worldX: ox, worldZ: oz, worldGroundY: cemeteryFloorY, rotation: rot,
        talismanGraveWorldX: tgWorld.x,
        talismanGraveWorldZ: tgWorld.z,
        talismanGraveLocalX: tgX,
        talismanGraveLocalZ: tgZ,
        talismanGraveHitRoot,
        graveCount: cemeteryGraveCount,
        gravePositions,
        roomLampLight: lampLight,
        roomLampGlassMat: hhGlassMat,
        // Gate system
        gatePivotL:     leftGatePivot,
        gatePivotR:     rightGatePivot,
        gateTargetL:    GATE_OPEN_L,
        gateTargetR:    GATE_OPEN_R,
        gateOpenL:      GATE_OPEN_L,
        gateOpenR:      GATE_OPEN_R,
        gateSpeed:      GATE_SPEED,
        gatesLocked:    false,
        gateWall,
        entranceWorldX: entranceWorld.x,
        entranceWorldZ: entranceWorld.z,
    };
    creatureCemeteryRegions.push({
        x: ox,
        z: oz,
        halfW: CEM_HALF,
        halfD: CEM_HALF,
        rotation: rot,
        barrierTopY: cemeteryFloorY + CEM_FENCE_H,
        gateWall,
        entryX: entranceWorld.x,
        entryZ: entranceWorld.z,
        entryHalfW: CEM_ENT_HALF_W + 0.65,
        entryHalfD: 1.8,
    });

    createCemeteryForest(ox, oz);

    if (DEBUG_CEMETERY) {
        // Place player 75 units south of the cemetery entrance
        const entPos = localToWorldXZ(ox, oz, 0, CEM_HALF + 75, rot);
        player.position.set(entPos.x, cemeteryFloorY + 1, entPos.z);
    }

    if (DEBUG_TALISMAN) {
        hasTalisman = true;
        addInventoryItem('talisman', 'Talisman', TALISMAN_ICON_SRC, { type: 'object', itemKey: 'talisman' });
    }
}

// ── Talisman grave interaction ────────────────────────────────────────────────
function tryDigTalismanGrave(aimDir = null, punchRange = 7.5, punchRayRange = null) {
    if (!cemeteryData || hasTalisman || talismanItemMesh) return false;
    if (currentHandItem !== 'shovel') return false;

    if (!aimDir || !cemeteryData.talismanGraveHitRoot) return false;
    const rayRange = punchRayRange ?? getMeleeRayRange(punchRange);
    const hit = rayHitObjectProfileFromCamera(aimDir, cemeteryData.talismanGraveHitRoot, rayRange);
    if (!hit || !isHitWithinPlayerReach(hit, punchRange)) return false;

    talismanGraveDigCount++;
    spawnDigParticles(
        cemeteryData.talismanGraveWorldX + (Math.random() - 0.5) * 1.5,
        cemeteryData.worldGroundY,
        cemeteryData.talismanGraveWorldZ + (Math.random() - 0.5) * 1.5,
        0x2a180f  // match the dark grave dirt patch color
    );

    if (talismanGraveDigCount >= CEM_GRAVE_DIGS) {
        // Spawn talisman item
        talismanItemMesh = createTalismanMesh(0.8);
        const talismanSpawn = new THREE.Vector3(
            cemeteryData.talismanGraveLocalX,
            1.05,
            cemeteryData.talismanGraveLocalZ
        );
        cemeteryData.group.localToWorld(talismanSpawn);
        talismanBaseY = talismanSpawn.y;
        talismanItemMesh.position.copy(talismanSpawn);
        setObjectHitProfile(talismanItemMesh, { shape: 'sphere', center: { x: 0, y: 0, z: 0 }, radius: 1.0 }, { debugKey: 'talismanPickupHitboxDebug' });
        scene.add(talismanItemMesh);
        talismanSpawnTime = performance.now();
        talismanLockTimer = 3;
    }
    return true;
}

// ── updateTalisman (called per-frame from animate) ───────────────────────────
function updateTalisman(delta) {
    if (!talismanItemMesh) return;

    talismanItemMesh.rotation.y += delta * 1.5;
    talismanItemMesh.position.y = talismanBaseY + 0.25 + Math.sin(performance.now() / 700) * 0.25;

    const elapsed = (performance.now() - talismanSpawnTime) / 1000;
    talismanLockTimer = Math.max(0, 3 - elapsed);

    if (elapsed < 3) {
        // Phase-locked pulse: exactly 3 oscillations over the 3-second lockout.
        const phase = elapsed * 2 * Math.PI;
        const pulse = 2 - 2 * Math.cos(phase);
        talismanItemMesh.traverse(obj => {
            if (obj.userData.isHitboxDebug) return;
            if (obj.isMesh && obj.material) obj.material.emissiveIntensity = 0.6 + pulse * 0.8;
            if (obj.isLight && obj.userData.isTalismanGlow) obj.intensity = pulse * 2;
        });
    } else {
        talismanItemMesh.traverse(obj => {
            if (obj.userData.isHitboxDebug) return;
            if (obj.isMesh && obj.material) obj.material.emissiveIntensity = 0.6;
            if (obj.isLight && obj.userData.isTalismanGlow) obj.intensity = 0;
        });
    }
}

function updateCemeteryRoomLamp(delta) {
    if (!cemeteryData || !cemeteryData.roomLampLight) return;

    const light = cemeteryData.roomLampLight;
    const glassMat = cemeteryData.roomLampGlassMat;
    const ud = light.userData;
    ud.flickerTimer -= delta;

    if (ud.flickerTimer <= 0) {
        ud.flickerTimer = 0.045 + Math.random() * 0.09;
        ud.targetIntensity = ud.baseIntensity * (0.85 + Math.random() * 0.30);
        ud.targetDistance = ud.baseDistance * (0.92 + Math.random() * 0.16);
    }

    const intensityBlend = Math.min(1, delta * 10);
    const distanceBlend = Math.min(1, delta * 7);
    ud.currentIntensity += (ud.targetIntensity - ud.currentIntensity) * intensityBlend;
    ud.currentDistance += (ud.targetDistance - ud.currentDistance) * distanceBlend;

    const t = performance.now() * 0.001;
    const breath = Math.sin(t * 8.7) * 0.1 + Math.sin(t * 15.1 + 1.4) * 0.05;
    light.intensity = Math.max(0.2, ud.currentIntensity + breath);
    light.distance = Math.max(8, ud.currentDistance + breath * 1.5);

    if (glassMat) {
        glassMat.emissiveIntensity = 0.75 + (light.intensity - ud.baseIntensity) * 0.12;
    }
}

// ── tryPickupTalisman (called from punch) ────────────────────────────────────
function tryPickupTalisman(aimDir, punchRange) {
    if (!talismanItemMesh || talismanLockTimer > 0) return false;
    const rayRange = getMeleeRayRange(punchRange);
    const hit = rayHitObjectProfileFromCamera(aimDir, talismanItemMesh, rayRange);
    if (!hit || !isHitWithinPlayerReach(hit, punchRange)) return false;

    hasTalisman = true;
    scene.remove(talismanItemMesh);
    talismanItemMesh = null;
    addInventoryItem('talisman', 'Talisman', TALISMAN_ICON_SRC, { type: 'object', itemKey: 'talisman' });
    if (typeof spawnSpecialPortalHangingBody === 'function') {
        spawnSpecialPortalHangingBody();
    }
    flashEquipHint('TALISMAN FOUND');

    // Lock gates and start zombie emergence countdown
    if (cemeteryData) {
        cemeteryData.gatesLocked  = true;
        cemeteryData.gateTargetL  = 0;
        cemeteryData.gateTargetR  = 0;
        cemeteryData.gateWall.active = true;
    }
    if (typeof startCemeteryZombieSequence === 'function') {
        startCemeteryZombieSequence();
    }
    if (typeof createSacrificialAltar === 'function') {
        createSacrificialAltar();
    }

    return true;
}

// ── Cemetery gate toggle (called from punch) ─────────────────────────────────
function tryToggleCemeteryGate(aimDir, punchRange) {
    if (!cemeteryData || !cemeteryData.gatePivotL) return false;
    if (cemeteryData.gatesLocked) return false;

    // Check if player is aiming toward the entrance area
    const rayRange = getMeleeRayRange(punchRange);
    const leftHit = rayHitObjectProfileFromCamera(aimDir, cemeteryData.gatePivotL, rayRange);
    const rightHit = rayHitObjectProfileFromCamera(aimDir, cemeteryData.gatePivotR, rayRange);
    const hit = [leftHit, rightHit]
        .filter(h => h && isHitWithinPlayerReach(h, punchRange))
        .sort((a, b) => a.distance - b.distance)[0];
    if (!hit) return false;

    const isOpen = Math.abs(cemeteryData.gatePivotL.rotation.y - cemeteryData.gateOpenL) < 0.1;
    if (isOpen) {
        cemeteryData.gateTargetL = 0;
        cemeteryData.gateTargetR = 0;
        cemeteryData.gateWall.active = true;
    } else {
        cemeteryData.gateTargetL = cemeteryData.gateOpenL;
        cemeteryData.gateTargetR = cemeteryData.gateOpenR;
        cemeteryData.gateWall.active = false;
    }
    return true;
}

// ── Cemetery gate animation (called from animate()) ───────────────────────────
function updateCemeteryGates(delta) {
    if (!cemeteryData || !cemeteryData.gatePivotL) return;
    const speed = cemeteryData.gateSpeed;
    cemeteryData.gatePivotL.rotation.y = moveScalarToward(
        cemeteryData.gatePivotL.rotation.y, cemeteryData.gateTargetL, speed * delta
    );
    cemeteryData.gatePivotR.rotation.y = moveScalarToward(
        cemeteryData.gatePivotR.rotation.y, cemeteryData.gateTargetR, speed * delta
    );
}

// ── tryPickupSSItem (called from punch) ──────────────────────────────────────
function tryPickupSSItem(aimDir, punchRange) {
    if (!hauntedHouseData || hhSeqPhase !== 'active') return false;
    if (!hauntedHouseData.ssItemGrp || !hauntedHouseData.worldSword || !hauntedHouseData.worldShield) return false;

    const rayRange = getMeleeRayRange(punchRange);
    const swordHit = rayHitObjectProfileFromCamera(aimDir, hauntedHouseData.worldSword, rayRange);
    const shieldHit = rayHitObjectProfileFromCamera(aimDir, hauntedHouseData.worldShield, rayRange);
    const hit = [swordHit, shieldHit]
        .filter(h => h && isHitWithinPlayerReach(h, punchRange))
        .sort((a, b) => a.distance - b.distance)[0];
    if (!hit) return false;

    // Collect SS
    hasSwordShield = true;
    hauntedHouseData.ssItemGrp.visible = false;
    addHandSlot('sword-shield');
    syncHandItemVisuals();
    flashEquipHint('Sword & Shield');

    // Block entrance
    removeHHEntrance();
    hhSeqPhase = 'ss_taken';
    return true;
}

// ── _blacken: swap all mesh materials to black (or restore originals) ─────────
const _hhBlackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
function _blacken(obj, darken) {
    if (!obj) return;
    obj.traverse(function(m) {
        if (!m.isMesh) return;
        if (m.userData.isHitboxDebug) return;
        if (darken) {
            if (!m.userData._origMat) m.userData._origMat = m.material;
            m.material = _hhBlackMat;
        } else {
            if (m.userData._origMat) {
                m.material = m.userData._origMat;
                m.userData._origMat = null;
            }
        }
    });
}

// ── _setHHItemsLit: show/hide writing on north wall based on torch ────────────
function _setHHItemsLit(lit) {
    if (!hauntedHouseData) return;
    const hd = hauntedHouseData;
    if (hd.writingMesh && hd.writingMesh.material) {
        hd.writingMesh.material.opacity = lit ? 1.0 : 0.05;
    }
    if (hd.insigniaDrawingMesh && hd.insigniaDrawingMesh.material) {
        hd.insigniaDrawingMesh.material.opacity = lit ? 1.0 : 0.05;
    }
    _blacken(hd.ssItemGrp, !lit);
    _blacken(hd.worldSkeleton, !lit);
}

function _saveHHSequenceTime() {
    if (hhSavedSequenceGameTime < 0) {
        hhSavedSequenceGameTime = ((gameTime % FULL_CYCLE) + FULL_CYCLE) % FULL_CYCLE;
    }
}

function _setHHSequenceNight() {
    setDayNightCycleProgress(NIGHT_START + 0.05);
}

function _restoreHHSequenceTime() {
    if (hhSavedSequenceGameTime < 0) return;
    setDayNightCycleProgress(hhSavedSequenceGameTime / FULL_CYCLE);
    hhSavedSequenceGameTime = -1;
}

// ── updateHauntedHouseSequence (called per-frame) ────────────────────────────
function updateHauntedHouseSequence(delta) {
    updateCemeteryRoomLamp(delta);

    if (!hauntedHouseData) return;

    // Keep writing and world items synced to whether the torch is actively held
    const torchHeld = (currentHandItem === 'torch');
    if (torchHeld !== hhLastTorchState) {
        hhLastTorchState = torchHeld;
        _setHHItemsLit(torchHeld);
    }

    const hd = hauntedHouseData;
    const px = player.position.x, pz = player.position.z;
    const py = player.position.y;
    const localPos = worldToLocalXZ(px, pz, hd.worldX, hd.worldZ, hd.rotation);
    const localY = py - hd.worldGroundY;
    _updateHHHallCrawlerEncounter(localPos, localY);

    // ── Phase: none — check if player enters with torch ──────────────────────
    if (hhSeqPhase === 'none') {
        if (!hasTorch) return;
        const inside = (Math.abs(localPos.x) < HH_HALF_W + 1 &&
                        Math.abs(localPos.z) < HH_HALF_D + 1 &&
                        localY < HH_F2_SURFACE_Y + HH_F2_H + 2);
        if (inside) {
            _saveHHSequenceTime();
            hhSeqPhase = 'active';
        }
        return;
    }

    // ── Phase: active — waiting for SS pickup (handled in punch()) ───────────
    if (hhSeqPhase === 'active') return;

    // ── Phase: ss_taken — waiting for player to descend and commit to hallway ──
    if (hhSeqPhase === 'ss_taken') {
        // Remove stairs once the player is 6 units west into the north corridor.
        // Requires z < HH_HALL_Z (confirmed in north corridor, not main room or east corridor)
        // and x < HH_HALL_X - 6 (6 units west of the east corridor entry wall).
        const inNorthCorridor = (localPos.z < HH_HALL_Z && localY < HH_F1_H - 1);
        const committedToHallway = (localPos.x < HH_HALL_X - 9);
        if (inNorthCorridor && committedToHallway) {
            if (HH_REMOVE_STAIRS_DURING_SEQUENCE) removeHHStairs();
            hhSeqPhase = 'hallway_exit';
        }
        return;
    }

    // ── Phase: hallway_exit — stairs gone; wait for player to clear doorway, then seal it ──
    if (hhSeqPhase === 'hallway_exit') {
        // Close the hallway door only when the player is guaranteed to be inside
        // the floor-1 main room volume, not merely above it on floor 2.
        const inFloor1MainRoom = (
            localPos.x > -HH_HALF_W + 1 &&
            localPos.x < HH_HALL_X - 1 &&
            localPos.z > HH_HALL_Z + 5 &&
            localPos.z < HH_HALF_D - 1 &&
            localY > -0.5 &&
            localY < HH_F1_H - 1
        );
        if (inFloor1MainRoom) {
            closeHHHallDoor();
            hhSeqPhase = 'timer';
            hhSeqTimer = 0;
            hhTorchExtinguished = false;
            hhFirstAngelSpawned = false;
            hhFirstAngelApproaching = false;
            hhAngelWaveStage = 0;
            hhAngelWaveTimer = 0;
            hhAngelStageSpawnCount = 0;
            _clearHHAngels();
        }
        return;
    }

    // ── Phase: timer — countdown sequence ────────────────────────────────────
    const T_EXTINGUISH_TORCH = 10;
    const T_SPAWN_FIRST_ANGEL = T_EXTINGUISH_TORCH + 7.5;
    const T_FIRST_ANGEL_APPROACH = T_SPAWN_FIRST_ANGEL + 7.5;
    if (hhSeqPhase === 'timer') {
        hhSeqTimer += delta;

        // t=10: extinguish torch
        if (!hhTorchExtinguished && hhSeqTimer >= T_EXTINGUISH_TORCH) {
            hhTorchExtinguished = true;
            _setHHSequenceNight();
            if (hasTorch) {
                const previousHandItem = currentHandItem;
                hasTorch = false;
                hasStick = true;
                addHandSlot('stick', 'torch');
                if (previousHandItem !== 'torch') currentHandItem = previousHandItem;
                syncHandItemVisuals();
            }
        }

        // t=17.5: spawn the first HH angel in the farthest corner
        if (!hhFirstAngelSpawned && hhSeqTimer >= T_SPAWN_FIRST_ANGEL) {
            hhFirstAngelSpawned = true;
            _spawnHHAngel({
                specialFirst: true,
                replaceExisting: true,
                useFarthest: true,
                freezeLockDist: HH_FIRST_ANGEL_FREEZE_LOCK_DIST,
            });
            if (hasTalisman) _triggerPlayerTalismanPulse();
        }

        // t=25: the first HH angel starts approaching
        if (hhFirstAngelSpawned && !hhFirstAngelApproaching && hhSeqTimer >= T_FIRST_ANGEL_APPROACH) {
            hhFirstAngelApproaching = true;
        }

        if (hhFirstAngelSpawned) _updateHHAngels(delta);

        return;
    }

    if (hhSeqPhase === 'angel_waves') {
        _updateHHAngelWaves(delta);
        _updateHHAngels(delta);

        return;
    }

    // ── Phase: complete — check 900-unit despawn ──────────────────────────────
    if (hhSeqPhase === 'complete') {
        const distToHH = Math.hypot(px - hd.worldX, pz - hd.worldZ);
        if (distToHH > HH_DESPAWN_DIST) {
            _despawnHauntedHouse();
        }
        return;
    }
}

// ── HH angel helpers ─────────────────────────────────────────────────────────
function _pickHHCornerIndex(useFarthest) {
    const hd = hauntedHouseData;
    const localPos = worldToLocalXZ(player.position.x, player.position.z,
                                    hd.worldX, hd.worldZ, hd.rotation);

    let cornerIdx = 0;
    if (useFarthest) {
        let maxDist = -1;
        for (let i = 0; i < HH_CORNERS.length; i++) {
            const c = HH_CORNERS[i];
            const d = Math.hypot(c.x - localPos.x, c.z - localPos.z);
            if (d > maxDist) { maxDist = d; cornerIdx = i; }
        }
    } else {
        // Random corner (not the same as player's nearest)
        const options = [];
        for (let i = 0; i < HH_CORNERS.length; i++) {
            const c = HH_CORNERS[i];
            if (Math.hypot(c.x - localPos.x, c.z - localPos.z) > 4) options.push(i);
        }
        cornerIdx = options.length > 0
            ? options[Math.floor(Math.random() * options.length)]
            : Math.floor(Math.random() * HH_CORNERS.length);
    }

    return cornerIdx;
}

function _clearHHAngels() {
    for (const angel of hhAngels) {
        if (angel.mesh) scene.remove(angel.mesh);
    }
    hhAngels = [];
}

// ── Spawn HH weeping angel ───────────────────────────────────────────────────
function _spawnHHAngel(options = {}) {
    if (hhAngels.some(a => a.touchTriggered)) return null;
    if (options.replaceExisting) _clearHHAngels();

    const hd = hauntedHouseData;
    const cornerIdx = options.useFarthest
        ? _pickHHCornerIndex(true)
        : Math.floor(Math.random() * HH_CORNERS.length);
    const corner = HH_CORNERS[cornerIdx];
    const wPos = localToWorldXZ(hd.worldX, hd.worldZ, corner.x, corner.z, hd.rotation);

    const angelMesh = _buildWeepingAngelMesh();
    angelMesh.userData.ignoreCameraOcclusion = true;
    angelMesh.position.set(wPos.x, hd.worldGroundY, wPos.z);
    scene.add(angelMesh);

    const partMeshes = [];
    angelMesh.traverse(obj => {
        if (obj.isMesh) partMeshes.push(obj);
    });

    const hitProfile = typeof makeCreatureHitProfile === 'function'
        ? makeCreatureHitProfile('angel')
        : { shape: 'capsule', start: { x: 0, y: 0.35, z: -0.08 }, end: { x: 0, y: 3.25, z: -0.05 }, radius: 0.62 };
    attachHitProfileDebugVisual(angelMesh, hitProfile);

    const angel = {
        mesh: angelMesh,
        specialFirst: !!options.specialFirst,
        freezeLockDist: options.freezeLockDist ?? HH_ANGEL_FREEZE_LOCK_DIST,
        speed: options.speed ?? HH_ANGEL_SPEED,
        oscillate: !!options.oscillate,
        ignoreLookFreeze: !!options.ignoreLookFreeze,
        hitsTaken: 0,
        noTalismanHits: 0,
        hitCooldown: 0,
        hitProfile,
        touchTriggered: false,
        partMeshes,
        partBaseX: partMeshes.map(m => m.position.x),
    };

    hhAngels.push(angel);
    return angel;
}

function _isHHAngelFrozenByLook(angel, dist) {
    if (angel.ignoreLookFreeze) return false;
    if (dist <= angel.freezeLockDist) return false;

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() > 0.001) camDir.normalize();

    const toAngel = new THREE.Vector3(
        angel.mesh.position.x - camera.position.x,
        0,
        angel.mesh.position.z - camera.position.z
    );
    if (toAngel.lengthSq() > 0.001) toAngel.normalize();

    const halfHFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
    const freezeCos = Math.cos(halfHFov + WEEPING_ANGEL_BODY_MARGIN);
    return camDir.dot(toAngel) >= freezeCos;
}

function _damagePlayerFromHHAngel(angel) {
    if (DEBUG_INVINCIBLE) return;

    if (angel.hitCooldown > 0 || playerDead) return;
    angel.hitCooldown = CREATURE_HIT_COOLDOWN;
    playerHealth = Math.max(0, playerHealth - CREATURE_HIT_DAMAGE);
    _damageFlashEl.classList.remove('active');
    void _damageFlashEl.offsetWidth;
    _damageFlashEl.classList.add('active');
    if (playerHealth <= 0) hardReset();
}

function _getHHAngelStopDist() {
    return typeof CREATURE_STOP_DIST === 'number' ? CREATURE_STOP_DIST : 1.5;
}

function _getHHAngelContactDist() {
    return typeof CREATURE_HIT_DIST === 'number' ? CREATURE_HIT_DIST : HH_ANGEL_CONTACT_DIST;
}

// ── Update HH weeping angels each frame ──────────────────────────────────────
function _updateHHAngels(delta) {
    for (const angel of hhAngels) {
        if (!angel.mesh) continue;
        const mesh = angel.mesh;

        const dx = player.position.x - mesh.position.x;
        const dz = player.position.z - mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01) mesh.rotation.y = Math.atan2(dx, dz);

        if (angel.oscillate && angel.partMeshes && angel.partBaseX.length) {
            const osc = Math.sin(performance.now() * 0.09) * 0.25;
            angel.partMeshes.forEach((part, i) => {
                part.position.x = angel.partBaseX[i] + osc;
            });
        }

        if (angel.specialFirst && !hhFirstAngelApproaching) continue;
        if (_isHHAngelFrozenByLook(angel, dist)) continue;

        if (dist > _getHHAngelStopDist()) {
            if (typeof _moveCreatureWithWallCollisions === 'function') {
                _moveCreatureWithWallCollisions(angel, dx, dz, dist, delta);
            } else {
                mesh.position.x += (dx / dist) * angel.speed * delta;
                mesh.position.z += (dz / dist) * angel.speed * delta;
            }

            const targetY = hauntedHouseData.worldGroundY;
            mesh.position.y = moveScalarToward(mesh.position.y, targetY, 20 * delta);
        }

        if (angel.hitCooldown > 0) angel.hitCooldown -= delta;
        const dy = player.position.y - mesh.position.y;
        const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist3d < _getHHAngelContactDist()) _damagePlayerFromHHAngel(angel);
    }
}

function _startHHAngelWaves() {
    hhSeqPhase = 'angel_waves';
    hhAngelWaveStage = 0;
    hhAngelStageSpawnCount = 0;
    hhAngelWaveTimer = HH_ANGEL_WAVE_SCHEDULE[0].interval;
}

function _updateHHAngelWaves(delta) {
    if (hhAngelWaveStage >= HH_ANGEL_WAVE_SCHEDULE.length) {
        if (hhAngels.length === 0) _doFlashbang();
        return;
    }

    const stage = HH_ANGEL_WAVE_SCHEDULE[hhAngelWaveStage];
    hhAngelWaveTimer -= delta;
    if (hhAngelWaveTimer > 0) return;

    _spawnHHAngel({
        freezeLockDist: HH_ANGEL_FREEZE_LOCK_DIST,
        speed: HH_ANGEL_SPEED,
        oscillate: stage.oscillate,
    });

    hhAngelStageSpawnCount++;
    if (hhAngelStageSpawnCount >= stage.count) {
        hhAngelWaveStage++;
        hhAngelStageSpawnCount = 0;
        if (hhAngelWaveStage < HH_ANGEL_WAVE_SCHEDULE.length) {
            hhAngelWaveTimer = HH_ANGEL_WAVE_SCHEDULE[hhAngelWaveStage].interval;
        }
    } else {
        hhAngelWaveTimer = stage.interval;
    }
}

function _removeHHAngel(angel, animateDeath) {
    const idx = hhAngels.indexOf(angel);
    const wasTracked = idx !== -1;
    if (wasTracked) hhAngels.splice(idx, 1);

    if (animateDeath && wasTracked && !angel.killRecorded) {
        angel.killRecorded = true;
        recordKill('angel');
        updateStats();
    }

    if (animateDeath && typeof _fadeCemZombieOut === 'function') {
        _fadeCemZombieOut(angel.mesh);
    } else if (angel.mesh) {
        scene.remove(angel.mesh);
    }
}

// ── Sword hit against HH weeping angels ──────────────────────────────────────
function tryHitHHWhiteSM(aimDir, punchRange) {
    if (hhAngels.length === 0) return false;

    const candidates = [];
    const rayRange = getMeleeRayRange(punchRange);
    for (const angel of hhAngels) {
        if (!angel.mesh || angel.touchTriggered) continue;
        if (angel.specialFirst && !hhFirstAngelApproaching) continue; // can't hit during frozen phase

        const profile = angel.hitProfile || {
            shape: 'capsule',
            start: { x: 0, y: 0.35, z: -0.08 },
            end: { x: 0, y: 3.25, z: -0.05 },
            radius: 0.62
        };
        const hit = rayHitProfile(camera.position, aimDir, angel.mesh, profile, rayRange);
        if (!hit || !isHitWithinPlayerReach(hit, punchRange)) continue;
        candidates.push({ angel, dist: hit.distance });
    }

    if (candidates.length === 0) return false;

    candidates.sort((a, b) => a.dist - b.dist);
    const hitAngel = candidates[0].angel;

    if (!hasTalisman) {
        if (hitAngel.specialFirst) {
            hitAngel.noTalismanHits = (hitAngel.noTalismanHits || 0) + 1;
            if (hitAngel.noTalismanHits >= HH_FIRST_ANGEL_NO_TALISMAN_ENRAGE_HITS) {
                hitAngel.oscillate = true;
                hitAngel.ignoreLookFreeze = true;
                hitAngel.speed = HH_FIRST_ANGEL_ENRAGED_SPEED;
            }
        }
        return true; // hit connected, but talisman is required to damage angels
    }

    _triggerPlayerTalismanPulse();

    if (hitAngel.specialFirst) {
        hitAngel.hitsTaken = (hitAngel.hitsTaken || 0) + 1;
        if (hitAngel.hitsTaken < HH_FIRST_ANGEL_KILL_HITS) return true;
    }

    _removeHHAngel(hitAngel, true);

    if (hitAngel.specialFirst) {
        _startHHAngelWaves();
    }

    return true;
}

function _clearPlayerTalismanPulse() {
    if (!player || !player.userData.talismanPulse) return;
    const pulse = player.userData.talismanPulse;
    scene.remove(pulse.light);
    player.userData.talismanPulse = null;
}

function _triggerPlayerTalismanPulse() {
    if (!player) return;
    _clearPlayerTalismanPulse();

    const light = new THREE.PointLight(0xaa33ff, 0, 20, 2);
    scene.add(light);

    player.userData.talismanPulse = {
        light,
        elapsed: 0,
        duration: 0.7,
        peakLightIntensity: 5
    };
}


// ── Upgrade sword blade to MeshBasicMaterial after HH sequence victory ────────
function _upgradeSwordBlade() {
    if (!playerSwordMesh) return;
    // Save original blade material on first upgrade so we can restore it later
    if (!playerSwordMesh.userData.originalBladeMaterial) {
        playerSwordMesh.traverse(obj => {
            if (obj.isMesh && obj.userData.isBlade && !playerSwordMesh.userData.originalBladeMaterial) {
                playerSwordMesh.userData.originalBladeMaterial = obj.material;
            }
        });
    }
    const basicMat = new THREE.MeshBasicMaterial({ color: 0xe3ecff });
    playerSwordMesh.traverse(obj => {
        if (obj.isMesh && obj.userData.isBlade) obj.material = basicMat;
    });
    _startSwordBladeParticles();
    swordAuraActive = true;
    swordPostAuraKills = 0;
}

// ── Deactivate sword aura (called when lightning fires) ───────────────────────
function _deactivateSwordAura() {
    swordAuraActive = false;
    if (!playerSwordMesh) return;
    // Restore original blade material
    const origMat = playerSwordMesh.userData.originalBladeMaterial;
    if (origMat) {
        playerSwordMesh.traverse(obj => {
            if (obj.isMesh && obj.userData.isBlade) obj.material = origMat;
        });
    }
    // Remove blade particles
    if (playerSwordMesh.userData.bladeParticleGroup) {
        playerSwordMesh.remove(playerSwordMesh.userData.bladeParticleGroup);
        playerSwordMesh.userData.bladeParticleGroup = null;
    }
}

// ── Reactivate sword aura after 100 kills ─────────────────────────────────────
function _reactivateSwordAura() {
    if (!playerSwordMesh) return;
    const basicMat = new THREE.MeshBasicMaterial({ color: 0xe3ecff });
    playerSwordMesh.traverse(obj => {
        if (obj.isMesh && obj.userData.isBlade) obj.material = basicMat;
    });
    _startSwordBladeParticles();
    _triggerSwordAuraOrbPulse();
    swordAuraActive = true;
    swordPostAuraKills = 0;
}

function _clearSwordAuraOrbPulse() {
    if (!playerSwordMesh) return;
    const pulse = playerSwordMesh.userData.auraOrbPulse;
    if (!pulse) return;
    playerSwordMesh.remove(pulse.mesh);
    pulse.mesh.geometry.dispose();
    pulse.mesh.material.dispose();
    if (pulse.light) {
        playerSwordMesh.remove(pulse.light);
    }
    playerSwordMesh.userData.auraOrbPulse = null;
}

function _triggerSwordAuraOrbPulse() {
    if (!playerSwordMesh) return;
    _clearSwordAuraOrbPulse();

    const orbMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.55, 24, 20),
        new THREE.MeshBasicMaterial({
            color: 0xd9f7ff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false
        })
    );
    orbMesh.position.set(0, 1.75, 0);
    orbMesh.scale.setScalar(0.55);
    orbMesh.frustumCulled = false;
    orbMesh.renderOrder = 75;

    const orbLight = new THREE.PointLight(0xd9f7ff, 0, 15, 2);
    orbLight.position.copy(orbMesh.position);

    playerSwordMesh.add(orbMesh);
    playerSwordMesh.add(orbLight);
    playerSwordMesh.userData.auraOrbPulse = {
        mesh: orbMesh,
        light: orbLight,
        elapsed: 0,
        duration: 0.9,
        fadeInDuration: 0.28,
        startScale: 0.55,
        endScale: 1.08,
        peakOpacity: 0.3,
        peakLightIntensity: 3
    };
}

// ── Start light-blue particles orbiting the blade and drifting upward ─────────
// Particles are parented to playerSwordMesh so they follow it automatically.
// Coordinates are in sword-local space:
//   Y = 0 is group origin; blade bottom ≈ 0.33, blade top ≈ 2.49 (at scale 0.6)
function _startSwordBladeParticles() {
    if (!playerSwordMesh) return;

    // Remove any existing particle group
    if (playerSwordMesh.userData.bladeParticleGroup) {
        playerSwordMesh.remove(playerSwordMesh.userData.bladeParticleGroup);
    }

    const pGrp = new THREE.Group();
    pGrp.userData.particles = [];

    const scale = 0.6;                // matches playerSwordMesh scale
    const bladeBottom = 0.55 * scale; // guard top ≈ blade start
    const bladeLen    = 3.6 * scale;  // blade height geometry
    const NUM = 24;

    for (let i = 0; i < NUM; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: 0x88d8ff,
            transparent: true,
            opacity: 0.65 + Math.random() * 0.35,
            depthWrite: false
        });
        const radius = 0.018 + Math.random() * 0.018;
        const p = new THREE.Mesh(new THREE.SphereGeometry(radius, 4, 4), mat);
        p.frustumCulled = false;

        const pData = {
            mesh:        p,
            orbitRadius: 0.09 + Math.random() * 0.07,
            phase:       (i / NUM) * Math.PI * 2 + Math.random() * 0.4,
            angSpeed:    2.5 + Math.random() * 2.0,
            height:      bladeBottom + Math.random() * bladeLen,
            upSpeed:     0.35 + Math.random() * 0.25,
            bladeBottom, bladeLen
        };
        pGrp.userData.particles.push(pData);
        pGrp.add(p);
    }

    playerSwordMesh.userData.bladeParticleGroup = pGrp;
    playerSwordMesh.add(pGrp);
}

// ── Per-frame particle update (called from main.js update loop) ───────────────
function updateSwordBladeParticles(delta) {
    if (!playerSwordMesh) return;
    const pGrp = playerSwordMesh.userData.bladeParticleGroup;
    if (!pGrp) return;

    // Only animate when sword is visible
    pGrp.visible = playerSwordMesh.visible;
    if (!pGrp.visible) return;

    for (const pd of pGrp.userData.particles) {
        pd.phase  += delta * pd.angSpeed;
        pd.height += delta * pd.upSpeed;
        if (pd.height > pd.bladeBottom + pd.bladeLen) {
            pd.height = pd.bladeBottom;  // wrap to bottom of blade
        }
        pd.mesh.position.set(
            Math.cos(pd.phase) * pd.orbitRadius,
            pd.height,
            Math.sin(pd.phase) * pd.orbitRadius
        );
    }
}

function updateSwordAuraOrbPulse(delta) {
    if (!playerSwordMesh) return;
    const pulse = playerSwordMesh.userData.auraOrbPulse;
    if (!pulse) return;

    pulse.elapsed += delta;
    const t = Math.min(pulse.elapsed / pulse.duration, 1);
    const fadeInT = Math.min(pulse.elapsed / pulse.fadeInDuration, 1);
    const fadeOutT = pulse.elapsed <= pulse.fadeInDuration
        ? 1
        : 1 - (pulse.elapsed - pulse.fadeInDuration) / Math.max(0.001, pulse.duration - pulse.fadeInDuration);
    const opacity = pulse.peakOpacity * Math.min(fadeInT, fadeOutT);
    const scale = THREE.MathUtils.lerp(pulse.startScale, pulse.endScale, t);

    pulse.mesh.material.opacity = opacity;
    pulse.mesh.scale.setScalar(scale);
    if (pulse.light) pulse.light.intensity = pulse.peakLightIntensity * Math.min(fadeInT, fadeOutT);

    if (pulse.elapsed >= pulse.duration) {
        _clearSwordAuraOrbPulse();
    }
}

function updatePlayerTalismanPulse(delta) {
    if (!player || !player.userData.talismanPulse) return;
    const pulse = player.userData.talismanPulse;
    pulse.elapsed += delta;

    const t = Math.min(pulse.elapsed / pulse.duration, 1);
    const phase = Math.sin(t * Math.PI);
    pulse.light.position.copy(player.position);
    pulse.light.intensity = pulse.peakLightIntensity * phase;

    if (pulse.elapsed >= pulse.duration) {
        _clearPlayerTalismanPulse();
    }
}

// ── Flashbang effect ──────────────────────────────────────────────────────────
function _doFlashbang() {
    if (hhSeqPhase === 'flashbang' || hhSeqPhase === 'complete') return;
    hhSeqPhase = 'flashbang';
    _clearHHAngels();

    const fb = document.getElementById('hh-flashbang');
    if (!fb) {
        restoreHHStairs();
        restoreHHEntrance();
        restoreHHHallDoor();
        _upgradeSwordBlade();
        _restoreHHSequenceTime();
        hhSeqPhase = 'complete';
        return;
    }
    fb.style.opacity = '1';
    fb.style.transition = 'opacity 0s';

    // After 0.8s, restore stairs and entrance, upgrade blade, then fade out
    setTimeout(() => {
        restoreHHStairs();
        restoreHHEntrance();
        restoreHHHallDoor();
        _upgradeSwordBlade();
        _restoreHHSequenceTime();
        hhSeqPhase = 'complete';
        fb.style.transition = 'opacity 3s';
        fb.style.opacity = '0';
    }, 800);
}

// ── Sword sweep animation ─────────────────────────────────────────────────────
const HH_SWIPE_DURATION = 0.2;
const HH_SWIPE_INNER_R = 1.8;
const HH_SWIPE_OUTER_R = 5.0;

function triggerSwordSwipe() {
    if (swordSwipeGroup) {
        scene.remove(swordSwipeGroup);
        swordSwipeGroup = null;
    }
    swordSwipeGroup = new THREE.Group();
    const swipeSector = Math.PI/3;
    const geo = new THREE.RingGeometry(HH_SWIPE_INNER_R, HH_SWIPE_OUTER_R, 18, 1, 0, swipeSector);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.55,
        side: THREE.DoubleSide, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending, fog: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;  // ring sector lies flat in XZ relative to group
    mesh.position.z = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 80;
    swordSwipeGroup.add(mesh);
    swordSwipeGroup.userData.ignoreCameraOcclusion = true;  // camera raycaster ignores this group
    swordSwipeGroup.position.copy(player.position);
    swordSwipeGroup.position.y += 1.4;

    // Quaternion approach: Q_total = Q_cam * Q_sweep
    // Q_cam is fixed at trigger time (yaw+pitch, no roll). Q_sweep rotates around world Y.
    // This keeps pitch tilt strictly forward/backward — never side-to-side during the sweep.
    // Pitch is clamped to a maximum of 0 so the swipe never tilts below horizontal:
    //   cameraPitch < 0 = looking up  → swipe tilts up   (allowed)
    //   cameraPitch > 0 = looking down → swipe stays flat (clamped to 0)
    const swipeArc = 90 * Math.PI / 180;
    const startSweep = cameraYaw - Math.PI/2 - swipeArc;
    const endSweep   = cameraYaw - swipeArc/2;
    const swipePitch = Math.max(-Math.PI/2, 1.25 * Math.min(0, cameraPitch));   // clamp: no downward tilt, no tilting past 90 deg (the 1.25 just makes it look better)
    const Q_cam = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(swipePitch, cameraYaw, 0, 'YXZ')
    );
    const Q_init = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), startSweep - cameraYaw);
    swordSwipeGroup.quaternion.multiplyQuaternions(Q_cam, Q_init);

    swordSwipeGroup.userData.Q_cam      = Q_cam;
    swordSwipeGroup.userData.startSweep = startSweep;
    swordSwipeGroup.userData.endSweep   = endSweep;
    swordSwipeGroup.userData.baseYaw    = cameraYaw;
    swordSwipeGroup.userData.swipeMesh  = mesh;
    scene.add(swordSwipeGroup);
    swordSwipeTimer = HH_SWIPE_DURATION;
}

function updateSwordSwipe(delta) {
    if (!swordSwipeGroup) return;
    swordSwipeTimer -= delta;
    if (swordSwipeTimer <= 0) {
        scene.remove(swordSwipeGroup);
        swordSwipeGroup = null;
        return;
    }
    const t = 1 - swordSwipeTimer / HH_SWIPE_DURATION;
    const startSweep = swordSwipeGroup.userData.startSweep;
    const endSweep   = swordSwipeGroup.userData.endSweep;
    const baseYaw    = swordSwipeGroup.userData.baseYaw;
    const Q_cam      = swordSwipeGroup.userData.Q_cam;

    // Animate sweep around world Y, then apply camera orientation on top
    const sweepAngle = startSweep + (endSweep - startSweep) * t;
    const Q_sweep = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), sweepAngle - baseYaw);
    swordSwipeGroup.quaternion.multiplyQuaternions(Q_cam, Q_sweep);

    swordSwipeGroup.position.copy(player.position);
    swordSwipeGroup.position.y += 1.4;
    const mesh = swordSwipeGroup.userData.swipeMesh;
    if (mesh) mesh.material.opacity = 0.55 * (1 - t);
}

// ── Despawn HH (after 900 units post-sequence) ───────────────────────────────
function _despawnHauntedHouse() {
    if (!hauntedHouseData) return;
    const hd = hauntedHouseData;
    _clearHHAngels();
    _clearHHHallCrawler();

    // Get skeleton world position before removing group
    const skullWorld = new THREE.Vector3();
    hd.worldSkeleton.getWorldPosition(skullWorld);
    const skullGroundY = getGroundHeight(skullWorld.x, skullWorld.z);

    // Remove the whole building
    scene.remove(hd.group);

    // ── Remove / deactivate all collision geometry ───────────────────────────
    const refs = hd.allColliderRefs;
    if (refs) {
        // Solid walls: deactivate (keeps array stable, just skips collision checks)
        for (const w of refs.walls) { if (w) w.active = false; }

        // Ceilings, roof colliders, enclosed bounds: splice from global arrays
        for (const c of refs.ceilings) {
            const idx = ceilings.indexOf(c);
            if (idx !== -1) ceilings.splice(idx, 1);
        }
        for (const r of refs.roofColliders) {
            const idx = roofColliders.indexOf(r);
            if (idx !== -1) roofColliders.splice(idx, 1);
        }
        for (const e of refs.enclosedBounds) {
            const idx = enclosedStructureBounds.indexOf(e);
            if (idx !== -1) enclosedStructureBounds.splice(idx, 1);
        }
        // Structure boxes registered via collMarkers
        for (const s of refs.structures) {
            const idx = structures.indexOf(s);
            if (idx !== -1) structures.splice(idx, 1);
        }
    }

    // Floor-2 plates
    for (const s of [hd.f2PlateAEntry, hd.f2PlateBEntry, hd.f2PlateCEntry]) {
        if (!s) continue;
        const idx = structures.indexOf(s);
        if (idx !== -1) structures.splice(idx, 1);
    }
    // Internal stair structures
    for (const s of (hd.stairStructures || [])) {
        const idx = structures.indexOf(s);
        if (idx !== -1) structures.splice(idx, 1);
    }
    // Entry step structures (outside south stairs)
    for (const s of (hd.entryStepStructures || [])) {
        const idx = structures.indexOf(s);
        if (idx !== -1) structures.splice(idx, 1);
    }

    // Place skeleton on ground (sitting against where the wall was)
    hhSkullOnGround = createSkeletonMesh(1.2);
    hhSkullOnGround.position.set(skullWorld.x, skullGroundY, skullWorld.z);
    // Inherit the HH rotation so the skeleton still faces the same direction
    hhSkullOnGround.rotation.y = hd.rotation;
    scene.add(hhSkullOnGround);

    // Spawn a boulder directly behind the skeleton for it to rest against.
    // The skeleton faces its local +z; world +z after rotation.y = hd.rotation is
    // (sin(rot), 0, cos(rot)), so the back direction is (-sin(rot), 0, -cos(rot)).
    // Rock radius 1.8; center placed 2.2 units back so its surface meets the
    // skeleton's spine lean (~0.4 units behind root): 0.4 + 1.8 ≈ 2.2.
    // Style matches the HH forest boulders: dark dodecahedron, detail 0.
    const rot = hd.rotation;
    const rockRadius = 1.8;
    const rockBackDist = 2.0;
    const rockX = skullWorld.x - Math.sin(rot) * rockBackDist;
    const rockZ = skullWorld.z - Math.cos(rot) * rockBackDist;
    const rockGroundY = getGroundHeight(rockX, rockZ);
    const boulderMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(rockRadius, 0), boulderMat);
    boulder.position.set(rockX, rockGroundY + rockRadius * 0.4, rockZ);
    boulder.rotation.set(0.6, rot + 0.9, 0.3);   // fixed but natural-looking orientation
    boulder.scale.y = 0.75;
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    scene.add(boulder);

    hauntedHouseData = null;
    hhLastTorchState = null;  // force re-evaluation of torch state on next HH spawn
}
