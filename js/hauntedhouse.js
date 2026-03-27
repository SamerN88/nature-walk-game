// ===== Haunted House & Cemetery =====

// ── Dimension constants (local building space) ──────────────────────────────
const HH_W = 48, HH_D = 50;
const HH_HALF_W = HH_W / 2;   // 24
const HH_HALF_D = HH_D / 2;   // 25
const HH_WALL_T = 0.6;
const HH_F1_H = 13.5;          // floor 1 ceiling height (9 × 1.5)
const HH_F2_H = 12;            // floor 2 wall height above floor 1 (8 × 1.5)
const HH_GABLE_RISE = 18;      // gable peak rise above floor-2 walls (12 × 1.5)
const HH_ENT_W = 4.2;          // entrance opening width
const HH_ENT_H = 5.5;          // entrance opening height (~2.75× player height)
const HH_HALL_X = 17;          // east corridor at x=17 (HH_HALF_W − 7, keeps corridor width = 7)
// L-shaped partition: horizontal arm at z=HH_HALL_Z, vertical arm at x=HH_HALL_X
const HH_HALL_Z = -19;         // partition z — keeps north corridor width = 6 (HH_HALF_D − |HH_HALL_Z|)
const HH_HALL_DOOR_W = 4.5;    // width of the doorway opening in the horizontal partition
const HH_HALL_DOOR_CX = -10;   // x-center of the doorway (≈ 1/3 from west wall, forces right-turn)
const HH_STAIR_S_Z = 8;        // south boundary of staircase zone (4 × 2)
// Staircase: x=[17..24], z=[HH_HALL_Z..HH_STAIR_S_Z], ascending southward
const HH_STAIR_STEPS = 9;

// Foundation / entry-stair constants
const HH_ELEV = 5;             // house raised this many units above terrain
const HH_N_ENT_STEPS = 5;     // entry stairs outside south face
const HH_ENT_STEP_H = HH_ELEV / HH_N_ENT_STEPS;   // 1.0
const HH_ENT_STEP_D = 1.6;    // tread depth per step
const HH_ENT_STAIR_W = 7.0;   // width of entry stair (wider than entrance)

// SM combat constants
const HH_SM_V0 = 10;
const HH_SM_ACCEL = 1.07;
const HH_SM_MAX_APPROACHES = 11;
const HH_DESPAWN_DIST = 900;
// Maximum angle (degrees) between camera aim direction and the direction to the SM
// for a sword hit to register. Tune this to make the hit window wider or narrower.
const HH_SWORD_HIT_MAX_ANGLE = 10;

// Cemetery constants
const CEM_HALF = 25;
const CEM_ENT_HALF_W = 3.5;
const CEM_FENCE_H = 5;
const CEM_POST_H = 7;
const CEM_POST_R = 0.55;
const CEM_GRAVE_DIGS = 10;
const CEM_MIN_DIST_FROM_HH = 500;

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

    const placement = findPlacement(() => {
        const pt = samplePointInRegion(region);
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
        const rot = randomRotationY();
        return {
            x: pt.x, z: pt.z, rotation: rot,
            footprint: { ...makePlacementFootprint(pt.x, pt.z, 100), noTree: true, isHHOwn: true }
        };
    }, 500);

    if (!placement) { console.warn('HauntedHouse: no placement found'); return; }

    const { x: ox, z: oz, rotation: rot } = placement;
    const groundY = getGroundHeight(ox, oz);
    const baseY = groundY + HH_ELEV;   // floor-1 world height

    const hhGrp = new THREE.Group();
    const collMarkers = [];

    const wallMat  = new THREE.MeshLambertMaterial({ color: 0x343242 });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x16141c });
    const roofMat  = new THREE.MeshLambertMaterial({ color: 0x000000 });
    // Gable end-walls need DoubleSide so both faces shade consistently
    const gableMat = new THREE.MeshLambertMaterial({ color: 0x343242, side: THREE.DoubleSide });

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
    B(HH_W + 4, foundDepth, HH_D + 4, 0, -foundDepth + 0.1, 0, wallMat);

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
    // North wall
    // Collision extends downward by HH_ELEV to seal the foundation ledge (prevents ledge phase-through)
    B(HH_W + HH_WALL_T * 2, HH_F1_H, HH_WALL_T, 0, 0, -(HH_HALF_D + HH_WALL_T / 2), wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: 0, localY: (HH_F1_H - HH_ELEV) / 2, localZ: -(HH_HALF_D + HH_WALL_T / 2),
        halfW: HH_HALF_W + HH_WALL_T, halfD: HH_WALL_T / 2, height: HH_F1_H + HH_ELEV,
        extra: { isEnclosed: true }
    }));

    // South wall: left piece, right piece, above-entrance piece
    const swWidth = HH_HALF_W - HH_ENT_W / 2;
    const swLX = -(HH_ENT_W / 2 + swWidth / 2);
    const swRX =  (HH_ENT_W / 2 + swWidth / 2);
    B(swWidth, HH_F1_H, HH_WALL_T, swLX, 0, HH_HALF_D + HH_WALL_T / 2, wallMat);
    B(swWidth, HH_F1_H, HH_WALL_T, swRX, 0, HH_HALF_D + HH_WALL_T / 2, wallMat);
    B(HH_ENT_W, HH_F1_H - HH_ENT_H, HH_WALL_T, 0, HH_ENT_H, HH_HALF_D + HH_WALL_T / 2, wallMat);
    // South left/right also extended downward (entrance gap stays open at ground level)
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: swLX, localY: (HH_F1_H - HH_ELEV) / 2, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: swWidth / 2, halfD: HH_WALL_T / 2, height: HH_F1_H + HH_ELEV, extra: { isEnclosed: true }
    }));
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: swRX, localY: (HH_F1_H - HH_ELEV) / 2, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: swWidth / 2, halfD: HH_WALL_T / 2, height: HH_F1_H + HH_ELEV, extra: { isEnclosed: true }
    }));
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: 0, localY: HH_ENT_H + (HH_F1_H - HH_ENT_H) / 2, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: HH_ENT_W / 2, halfD: HH_WALL_T / 2, height: HH_F1_H - HH_ENT_H, extra: { isEnclosed: true }
    }));

    // West wall (collision extended downward to seal foundation ledge)
    B(HH_WALL_T, HH_F1_H, HH_D + HH_WALL_T * 2, -(HH_HALF_W + HH_WALL_T / 2), 0, 0, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: -(HH_HALF_W + HH_WALL_T / 2), localY: (HH_F1_H - HH_ELEV) / 2, localZ: 0,
        halfW: HH_WALL_T / 2, halfD: HH_HALF_D + HH_WALL_T, height: HH_F1_H + HH_ELEV, extra: { isEnclosed: true }
    }));

    // East wall (collision extended downward to seal foundation ledge)
    B(HH_WALL_T, HH_F1_H, HH_D + HH_WALL_T * 2, HH_HALF_W + HH_WALL_T / 2, 0, 0, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: HH_HALF_W + HH_WALL_T / 2, localY: (HH_F1_H - HH_ELEV) / 2, localZ: 0,
        halfW: HH_WALL_T / 2, halfD: HH_HALF_D + HH_WALL_T, height: HH_F1_H + HH_ELEV, extra: { isEnclosed: true }
    }));

    // ── Slab face solid walls — placed at the actual slab outer edges ─────────
    // These cover the full height from 3 units below ground to the top of floor-1,
    // making the slab's exterior faces truly solid so players can't phase through
    // the ledge or any part of the visible slab geometry.
    // Height band: localY ∈ [−(HH_ELEV+3), +HH_F1_H]
    {
        const slabH  = HH_F1_H + HH_ELEV + 3;          // 21.5 — full coverage
        const slabCY = (HH_F1_H - HH_ELEV - 3) / 2;    //  2.75 — band center
        const slabHW = HH_HALF_W + 2;                   // 26 — slab half-width
        const slabHD = HH_HALF_D + 2;                   // 22 — slab half-depth

        // N slab face
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: 0, localY: slabCY, localZ: -slabHD,
            halfW: slabHW, halfD: HH_WALL_T / 2, height: slabH
        }));
        // E slab face
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: slabHW, localY: slabCY, localZ: 0,
            halfW: HH_WALL_T / 2, halfD: slabHD, height: slabH
        }));
        // W slab face
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: -slabHW, localY: slabCY, localZ: 0,
            halfW: HH_WALL_T / 2, halfD: slabHD, height: slabH
        }));
        // S slab face: two pieces flanking the entrance gap.
        // Slab is 2 units wider than inner walls on each side, so pieces span
        // from x=±slabHW to ±(HH_ENT_W/2) (wider than the inner wall pieces).
        const slabSwW  = slabHW - HH_ENT_W / 2;                 // 26 − 4.2 = 21.8
        const slabSwLX = -(HH_ENT_W / 2 + slabSwW / 2);         // −15.1
        const slabSwRX =  (HH_ENT_W / 2 + slabSwW / 2);         // +15.1
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: slabSwLX, localY: slabCY, localZ: slabHD,
            halfW: slabSwW / 2, halfD: HH_WALL_T / 2, height: slabH
        }));
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: slabSwRX, localY: slabCY, localZ: slabHD,
            halfW: slabSwW / 2, halfD: HH_WALL_T / 2, height: slabH
        }));
    }

    // ── L-shaped partition ────────────────────────────────────────────────────
    // Leg 1 (horizontal arm): full width from x=-HH_HALF_W to x=HH_HALL_X, with a doorway gap.
    // Doorway at x=[hallDoorL, hallDoorR]; NW corner is filled solid (inaccessible).
    // Once through the doorway the player can only turn right (east) toward the stairs.
    const hallDoorL = HH_HALL_DOOR_CX - HH_HALL_DOOR_W / 2;  // left edge of doorway
    const hallDoorR = HH_HALL_DOOR_CX + HH_HALL_DOOR_W / 2;  // right edge of doorway
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
    B(hPartRW, HH_F1_H, HH_WALL_T, hPartRCX, 0, HH_HALL_Z - HH_WALL_T / 2, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: hPartRCX, localY: HH_F1_H / 2, localZ: HH_HALL_Z - HH_WALL_T / 2,
        halfW: hPartRW / 2, halfD: HH_WALL_T / 2, height: HH_F1_H, extra: { isEnclosed: true }
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
        new THREE.BoxGeometry(HH_HALL_DOOR_W, HH_F1_H, 0.3), doorWoodMat
    );
    hallDoorPanel.position.set(HH_HALL_DOOR_W / 2, HH_F1_H / 2, 0);
    hallDoorPanel.castShadow = true;
    hallDoorPanel.receiveShadow = true;
    hhHallDoorPivot.add(hallDoorPanel);
    // Raised panels for visual depth
    const dpMat = new THREE.MeshLambertMaterial({ color: 0x130c04 });
    const dpUpper = new THREE.Mesh(new THREE.BoxGeometry(HH_HALL_DOOR_W - 0.8, HH_F1_H * 0.40, 0.08), dpMat);
    dpUpper.position.set(HH_HALL_DOOR_W / 2, HH_F1_H * 0.68, 0.14);
    hhHallDoorPivot.add(dpUpper);
    const dpLower = new THREE.Mesh(new THREE.BoxGeometry(HH_HALL_DOOR_W - 0.8, HH_F1_H * 0.32, 0.08), dpMat);
    dpLower.position.set(HH_HALL_DOOR_W / 2, HH_F1_H * 0.22, 0.14);
    hhHallDoorPivot.add(dpLower);
    // Door hardware (iron ring handle)
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const handleRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 10), handleMat);
    handleRing.position.set(HH_HALL_DOOR_W - 0.55, HH_F1_H * 0.45, 0.22);
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
    B(HH_WALL_T, HH_F1_H, vPartLen, HH_HALL_X + HH_WALL_T / 2, 0, vPartCZ, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: HH_HALL_X + HH_WALL_T / 2, localY: HH_F1_H / 2, localZ: vPartCZ,
        halfW: HH_WALL_T / 2, halfD: vPartLen / 2, height: HH_F1_H, extra: { isEnclosed: true }
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

    // ── Floor 2 plate (three sections; skip staircase zone x=[5,12], z=[-4,4]) ──
    // NOTE: structureBoxes for floor-2 are NOT registered here — registered later
    // via addStructureBox() with minPlayerY so they only activate once the player
    // has climbed the stairs, preventing teleport-to-floor-2 on ground-floor entry.

    // Section A: main room x=[-24,+17], full depth z=[-20,+20]
    const f2AW = HH_HALF_W + HH_HALL_X;           // 41
    const f2ACX = (-HH_HALF_W + HH_HALL_X) / 2;   // -3.5
    B(f2AW, 0.4, HH_D, f2ACX, HH_F1_H, 0, floorMat);
    collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
        localX: f2ACX, localY: HH_F1_H, localZ: 0,
        halfW: f2AW / 2, halfD: HH_HALF_D
    }));
    // roofCollider blocks jumping through the slab from floor-1 (more robust than ceilingRect alone)
    collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
        localX: f2ACX, localY: HH_F1_H + 0.2, localZ: 0,
        halfW: f2AW / 2, halfD: HH_HALF_D, thickness: 0.4
    }));

    // Section B: northeast nook x=[17,24], z=[-20, HH_HALL_Z]
    const f2BW = HH_HALF_W - HH_HALL_X;           // 7
    const f2BD = HH_HALF_D + HH_HALL_Z;            // 25 + (-19) = 6
    const f2BCX = (HH_HALL_X + HH_HALF_W) / 2;    // 20.5
    const f2BCZ = (-HH_HALF_D + HH_HALL_Z) / 2;   // (-25 + -19)/2 = -22
    B(f2BW, 0.4, f2BD, f2BCX, HH_F1_H, f2BCZ, floorMat);
    collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
        localX: f2BCX, localY: HH_F1_H, localZ: f2BCZ, halfW: f2BW / 2, halfD: f2BD / 2
    }));
    collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
        localX: f2BCX, localY: HH_F1_H + 0.2, localZ: f2BCZ,
        halfW: f2BW / 2, halfD: f2BD / 2, thickness: 0.4
    }));

    // Section C: southeast area x=[17,24], z=[HH_STAIR_S_Z+stairShift, +20]
    // Shortened by stairShift at the north end to leave room for the shifted staircase.
    const f2CW = HH_HALF_W - HH_HALL_X;                           // 7
    const f2CD = HH_HALF_D - HH_STAIR_S_Z - stairShift;
    const f2CCX = (HH_HALL_X + HH_HALF_W) / 2;                    // 20.5
    const f2CCZ = (HH_STAIR_S_Z + stairShift + HH_HALF_D) / 2;
    B(f2CW, 0.4, f2CD, f2CCX, HH_F1_H, f2CCZ, floorMat);
    collMarkers.push(createColliderMarker(hhGrp, 'ceilingRect', {
        localX: f2CCX, localY: HH_F1_H, localZ: f2CCZ, halfW: f2CW / 2, halfD: f2CD / 2
    }));
    collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
        localX: f2CCX, localY: HH_F1_H + 0.2, localZ: f2CCZ,
        halfW: f2CW / 2, halfD: f2CD / 2, thickness: 0.4
    }));

    // ── Floor 2 outer walls ──────────────────────────────────────────────────
    const f2Y = HH_F1_H;
    // North wall
    B(HH_W + HH_WALL_T * 2, HH_F2_H, HH_WALL_T, 0, f2Y, -(HH_HALF_D + HH_WALL_T / 2), wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: 0, localY: f2Y + HH_F2_H / 2, localZ: -(HH_HALF_D + HH_WALL_T / 2),
        halfW: HH_HALF_W + HH_WALL_T, halfD: HH_WALL_T / 2, height: HH_F2_H, extra: { isEnclosed: true }
    }));
    // South wall
    B(HH_W + HH_WALL_T * 2, HH_F2_H, HH_WALL_T, 0, f2Y, HH_HALF_D + HH_WALL_T / 2, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: 0, localY: f2Y + HH_F2_H / 2, localZ: HH_HALF_D + HH_WALL_T / 2,
        halfW: HH_HALF_W + HH_WALL_T, halfD: HH_WALL_T / 2, height: HH_F2_H, extra: { isEnclosed: true }
    }));
    // West wall
    B(HH_WALL_T, HH_F2_H, HH_D + HH_WALL_T * 2, -(HH_HALF_W + HH_WALL_T / 2), f2Y, 0, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: -(HH_HALF_W + HH_WALL_T / 2), localY: f2Y + HH_F2_H / 2, localZ: 0,
        halfW: HH_WALL_T / 2, halfD: HH_HALF_D + HH_WALL_T, height: HH_F2_H, extra: { isEnclosed: true }
    }));
    // East wall
    B(HH_WALL_T, HH_F2_H, HH_D + HH_WALL_T * 2, HH_HALF_W + HH_WALL_T / 2, f2Y, 0, wallMat);
    collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
        localX: HH_HALF_W + HH_WALL_T / 2, localY: f2Y + HH_F2_H / 2, localZ: 0,
        halfW: HH_WALL_T / 2, halfD: HH_HALF_D + HH_WALL_T, height: HH_F2_H, extra: { isEnclosed: true }
    }));

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

    // ── Gable end-wall collision (blocks player from phasing through gable triangles) ──
    // The triangular prism meshes have no inherent collision; add rectangular solidWall
    // approximations covering the full gable height above the floor-2 walls.
    {
        const gableBase = f2Y + HH_F2_H;                   // local Y where gable triangle begins
        const gableCY   = gableBase + HH_GABLE_RISE / 2;   // center of gable height range
        // North gable end
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: 0, localY: gableCY, localZ: -(HH_HALF_D + HH_WALL_T / 2),
            halfW: HH_HALF_W, halfD: HH_WALL_T / 2, height: HH_GABLE_RISE
        }));
        // South gable end
        collMarkers.push(createColliderMarker(hhGrp, 'solidWall', {
            localX: 0, localY: gableCY, localZ: HH_HALF_D + HH_WALL_T / 2,
            halfW: HH_HALF_W, halfD: HH_WALL_T / 2, height: HH_GABLE_RISE
        }));
    }

    // ── Roof panels (two sloping slabs) ──────────────────────────────────────
    {
        const gBase = f2Y + HH_F2_H;
        const halfRun = HH_HALF_W;
        const rise = HH_GABLE_RISE;
        const slabLen = Math.sqrt(halfRun * halfRun + rise * rise);
        const slabAngle = Math.atan2(rise, halfRun);
        const slabDepth = HH_D + HH_WALL_T * 2;
        const slabCY = gBase + rise / 2;
        const slabCX = halfRun / 2;
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

        // Roof slope collision: approximate each slope panel with N flat horizontal segments.
        // Each segment's bottomY matches the slope surface at the low (eave) end of its x-strip,
        // and topY matches the slope at the high (ridge) end. This prevents jumping through the
        // slope from inside and allows landing on it from outside.
        const slopeN = 6;
        const stripW = halfRun / slopeN;
        const slabHalfD = slabDepth / 2;
        for (let k = 0; k < slopeN; k++) {
            const yLo = gBase + rise * k / slopeN;
            const yHi = gBase + rise * (k + 1) / slopeN;
            const midY = (yLo + yHi) / 2;
            const thick = yHi - yLo;
            // distFromCenter: distance from ridge (x=0) to the center of strip k
            // k=0 is eave-most (largest distance), k=slopeN-1 is ridge-most (smallest)
            const distFromCenter = (slopeN - k - 0.5) * stripW;
            collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
                localX: -distFromCenter, localY: midY, localZ: 0,
                halfW: stripW / 2, halfD: slabHalfD, thickness: thick
            }));
            collMarkers.push(createColliderMarker(hhGrp, 'roofCollider', {
                localX:  distFromCenter, localY: midY, localZ: 0,
                halfW: stripW / 2, halfD: slabHalfD, thickness: thick
            }));
        }
    }

    // ── Enclosed bound for the whole building ────────────────────────────────
    collMarkers.push(createColliderMarker(hhGrp, 'enclosedBound', {
        localX: 0, localY: 0, localZ: 0, halfW: HH_HALF_W + 2, halfD: HH_HALF_D + 2
    }));

    // ── Alt-cave writing on north wall (floor 2) ─────────────────────────────
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
        wMesh.position.set(-1.5, HH_F1_H + 7.5, -HH_HALF_D + 0.35);
        wMesh.renderOrder = 2;
        hhGrp.add(wMesh);
        // Store mesh and apply current torch state immediately
        if (hauntedHouseData) {
            hauntedHouseData.writingMesh = wMesh;
            wMat.opacity = (currentHandItem === 'torch') ? 1.0 : 0.2;
        }
    };
    writingImg.src = IMAGE_HAUNTED_HOUSE_WRITING;

    // ── World display items: sword, shield, skull (floor 2 near north wall) ──
    const worldSword = createSwordMesh(0.75);
    worldSword.position.set(-2.9, HH_F1_H + 3.4, -HH_HALF_D + 0.3);
    worldSword.rotation.set(-0.3, 0.45, Math.PI - 0.1); // leaning slightly
    worldSword.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    hhGrp.add(worldSword);

    const worldShield = createShieldMesh(0.95);
    worldShield.position.set(-0.2, HH_F1_H + 1.2, -HH_HALF_D + 0.3);
    worldShield.rotation.set(-0.3, 0, 0);
    worldShield.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    hhGrp.add(worldShield);

    const worldSkeleton = createSkeletonMesh(1.2);
    // Sitting against the north wall on floor 2; skeleton faces south (+z).
    worldSkeleton.position.set(-2, HH_F1_H + 0.4, -HH_HALF_D + 0.8);
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

    // Register floor-2 plate structure boxes.
    // minPlayerY prevents the floor-2 platform from snapping the player upward
    // on ground-floor entry — it only activates once the player has climbed the
    // internal stairs to near floor-2 height.
    const f2MinY = baseY + HH_F1_H - 1;

    const f2PlateA_world = localToWorldXZ(ox, oz, f2ACX, 0, rot);
    const f2PlateAEntry = addStructureBox(
        f2PlateA_world.x, f2PlateA_world.z, baseY + HH_F1_H,
        f2AW, 0.4, HH_D, rot, { minPlayerY: f2MinY }
    );
    const f2PlateB_world = localToWorldXZ(ox, oz, f2BCX, f2BCZ, rot);
    const f2PlateBEntry = addStructureBox(
        f2PlateB_world.x, f2PlateB_world.z, baseY + HH_F1_H,
        f2BW, 0.4, f2BD, rot, { minPlayerY: f2MinY }
    );
    const f2PlateC_world = localToWorldXZ(ox, oz, f2CCX, f2CCZ, rot);
    const f2PlateCEntry = addStructureBox(
        f2PlateC_world.x, f2PlateC_world.z, baseY + HH_F1_H,
        f2CW, 0.4, f2CD, rot, { minPlayerY: f2MinY }
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
        baseY, baseY + HH_F1_H,
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
        worldSkeleton,
        writingMesh: null,   // set async in writingImg.onload
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

    const trunkMat  = new THREE.MeshLambertMaterial({ color: 0x160c06 });  // near-black dark wood
    const trunkH = 5 * scale;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, trunkH, 8),
        trunkMat
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Foliage — deep blackish-green, 4 layered cones
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x0b1f0b });
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
        cone.castShadow = true;
        cone.receiveShadow = true;
        tree.add(cone);
    }

    // Raycast downward against terrain and mountain meshes only.
    // isGround/isMountain tags are set in terrain.js / environment.js.
    // Restricting to these prevents trees from landing on structures or other trees.
    const _hhRaycaster = new THREE.Raycaster(
        new THREE.Vector3(x, 5000, z),
        new THREE.Vector3(0, -1, 0)
    );
    scene.updateMatrixWorld();
    const _hhHits = _hhRaycaster.intersectObjects(scene.children, true).filter(h =>
        h.object.userData.isGround === true || h.object.userData.isMountain === true
    );
    const surfaceY = _hhHits.length > 0 ? _hhHits[0].point.y : getGroundHeight(x, z);
    tree.position.set(x, surfaceY, z);
    scene.add(tree);
}

// ── Create HH forest — dense dark trees + boulders within a certain radius ─────
function createHHForest(hhX, hhZ, hhGroundY) {
    const INNER_CLEAR = 60;   // no-tree buffer around the house footprint
    const OUTER_EDGE  = 400;
    const subW = (OUTER_EDGE - INNER_CLEAR) / 4;  // width of each sub-ring

    const rockMatDark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });

    // Four equal-width sub-rings with deterministic tree counts.
    // Distribution from outer to inner: 10 / 20 / 50 / 20 %
    const TOTAL_TREES = 500;
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

        // Size varies widely: small pebbles (0.2) to large boulders (2.2)
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

// ── createCemetery ───────────────────────────────────────────────────────────
function createCemetery() {
    if (!hauntedHouseData) { console.warn('Cemetery: HH not placed yet'); return; }

    const hhX = hauntedHouseData.worldX;
    const hhZ = hauntedHouseData.worldZ;
    const region = { type: 'ring', minRadius: 1650, maxRadius: 2200 };

    const placement = findPlacement(() => {
        const pt = samplePointInRegion(region);
        // Enforce minimum distance from HH
        if (Math.hypot(pt.x - hhX, pt.z - hhZ) < CEM_MIN_DIST_FROM_HH) return null;
        // Reject steep / elevated terrain (same guard as HH)
        const stats = sampleTerrainStats(pt.x, pt.z, 50, 3, 12);
        if (stats.range > 28) return null;
        const rot2 = randomRotationY();
        return {
            x: pt.x, z: pt.z, rotation: rot2,
            footprint: { ...makePlacementFootprint(pt.x, pt.z, 48), noTree: true }
        };
    }, 600);

    if (!placement) { console.warn('Cemetery: no placement found'); return; }

    const { x: ox, z: oz, rotation: rot } = placement;
    const groundY = getGroundHeight(ox, oz);

    const cemGrp = new THREE.Group();
    const cColliders = [];

    const ironMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5a5a62 });
    const dirtMat  = new THREE.MeshLambertMaterial({ color: 0x3a2e22 });
    const darkStone = new THREE.MeshLambertMaterial({ color: 0x383840 });

    // Helper
    const CB = (w, h, d, lx, ly, lz, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(lx, ly + h / 2, lz);
        m.castShadow = true;
        m.receiveShadow = true;
        cemGrp.add(m);
        return m;
    };

    // ── Ground slab ─────────────────────────────────────────────────────────
    CB(CEM_HALF * 2, 0.25, CEM_HALF * 2, 0, -0.25, 0, dirtMat);

    // ── Fence posts: 4 corners + 2 per side (at 1/3 and 2/3 of each side) ───
    const postPositions = [];
    const sideLen = CEM_HALF * 2;
    const third = sideLen / 3;

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
        post.position.set(pp.x, CEM_POST_H / 2, pp.z);
        post.castShadow = true;
        cemGrp.add(post);
        // Post cap
        const cap = new THREE.Mesh(new THREE.BoxGeometry(CEM_POST_R * 2.2, CEM_POST_R, CEM_POST_R * 2.2), stoneMat);
        cap.position.set(pp.x, CEM_POST_H + CEM_POST_R / 2, pp.z);
        cemGrp.add(cap);
    }

    // ── Fence panels (iron rails between posts) ───────────────────────────────
    const fenceRailH = 0.12;
    const railMat = ironMat;

    const addFencePanel = (x1, z1, x2, z2) => {
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
        // Top rail
        const rTop = new THREE.Mesh(new THREE.BoxGeometry(len, fenceRailH, fenceRailH), railMat);
        rTop.position.set(cx, CEM_FENCE_H - 0.3, cz);
        rTop.rotation.y = angle;
        cemGrp.add(rTop);
        // Bottom rail
        const rBot = new THREE.Mesh(new THREE.BoxGeometry(len, fenceRailH, fenceRailH), railMat);
        rBot.position.set(cx, 0.8, cz);
        rBot.rotation.y = angle;
        cemGrp.add(rBot);
        // Vertical pickets (thin rods every ~1 unit)
        const numPickets = Math.max(1, Math.floor(len - 1));
        for (let p = 0; p < numPickets; p++) {
            const t = (p + 0.5) / numPickets;
            const px = x1 + t * dx;
            const pz = z1 + t * dz;
            const picket = new THREE.Mesh(new THREE.BoxGeometry(0.08, CEM_FENCE_H, 0.08), railMat);
            picket.position.set(px, CEM_FENCE_H / 2, pz);
            cemGrp.add(picket);
        }
        // Wall collider for this panel
        const wallX = cx, wallZ = cz;
        cColliders.push(createColliderMarker(cemGrp, 'solidWall', {
            localX: cx, localY: CEM_FENCE_H / 2, localZ: cz,
            halfW: len / 2 + 0.1, halfD: 0.2, height: CEM_FENCE_H,
            localRotation: angle
        }));
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

    // ── Entrance sign ─────────────────────────────────────────────────────────
    const signW = CEM_ENT_HALF_W * 2 + 1.5;
    const signH = 2.2;
    const signBoard = CB(signW, signH, 0.35, 0, CEM_POST_H - 0.5, CEM_HALF + 0.05, ironMat);

    // Draw text onto canvas for the sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 128;
    const sctx = signCanvas.getContext('2d');
    sctx.fillStyle = '#1a1a1a';
    sctx.fillRect(0, 0, 512, 128);
    sctx.fillStyle = '#c8c8b0';
    sctx.font = 'bold 18px serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('QUOD TU ES, EGO FUI;', 256, 44);
    sctx.fillText('QUOD EGO SUM, TU ERIS.', 256, 84);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signFaceMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(signW - 0.1, signH - 0.2), signFaceMat);
    signFace.position.set(0, CEM_POST_H - 0.5 + signH / 2, CEM_HALF + 0.24);
    cemGrp.add(signFace);

    // ── Tombstones (3x3 grid inside cemetery) ────────────────────────────────
    const graveMat = new THREE.MeshLambertMaterial({ color: 0x555568 });
    const gravePositions = [
        [-14, -16], [-7, -16], [0, -16], [8, -16],
        [-14,  -8], [-7,  -8], [0,  -8], [8,  -8],
        [-14,   0],
    ];
    for (const [gx, gz] of gravePositions) {
        // Base slab
        const tslab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.8), graveMat);
        tslab.position.set(gx, 0.1, gz);
        cemGrp.add(tslab);
        // Stone
        const tstone = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), graveMat);
        tstone.position.set(gx, 1.2, gz + 0.1);
        tstone.castShadow = true;
        cemGrp.add(tstone);
        // Rounded top
        const tcap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 8, 1, false, 0, Math.PI), graveMat);
        tcap.position.set(gx, 2.45, gz + 0.1);
        tcap.rotation.x = Math.PI / 2;
        cemGrp.add(tcap);
    }

    // ── Talisman grave (far left = northwest corner, local: x≈-18, z≈-18) ───
    const tgX = -17, tgZ = -17;
    // Base slab (larger, slightly disturbed)
    const tgSlab = CB(2.2, 0.2, 1.2, tgX, 0, tgZ, dirtMat);
    // Tombstone for the talisman grave
    const tgStone = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 0.35), darkStone);
    tgStone.position.set(tgX, 1.35, tgZ + 0.15);
    tgStone.castShadow = true;
    cemGrp.add(tgStone);
    const tgCap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.35, 8, 1, false, 0, Math.PI), darkStone);
    tgCap.position.set(tgX, 2.77, tgZ + 0.15);
    tgCap.rotation.x = Math.PI / 2;
    cemGrp.add(tgCap);

    // ── Small stone room (northeast corner: x≈+16, z≈-16) ────────────────────
    const srX = 16, srZ = -16, srS = 8, srH = 6;
    const srMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
    // Walls: 4 sides, no door on east/south/north but open on south (-z side)
    CB(srS + 0.6, srH, 0.6, srX, 0, srZ - srS / 2, srMat);            // North wall
    CB(srS + 0.6, srH, 0.6, srX, 0, srZ + srS / 2, srMat);            // South wall
    CB(0.6, srH, srS, srX - srS / 2, 0, srZ, srMat);                  // West wall
    CB(0.6, srH, srS, srX + srS / 2, 0, srZ, srMat);                  // East wall
    // Roof
    CB(srS + 1.2, 0.5, srS + 1.2, srX, srH, srZ, srMat);
    // Floor
    CB(srS, 0.2, srS, srX, -0.2, srZ, srMat);
    // Collision walls for stone room
    cColliders.push(createColliderMarker(cemGrp, 'solidWall', {
        localX: srX, localY: srH / 2, localZ: srZ - srS / 2,
        halfW: srS / 2 + 0.3, halfD: 0.3, height: srH, extra: { isEnclosed: false }
    }));
    cColliders.push(createColliderMarker(cemGrp, 'solidWall', {
        localX: srX, localY: srH / 2, localZ: srZ + srS / 2,
        halfW: srS / 2 + 0.3, halfD: 0.3, height: srH, extra: { isEnclosed: false }
    }));
    cColliders.push(createColliderMarker(cemGrp, 'solidWall', {
        localX: srX - srS / 2, localY: srH / 2, localZ: srZ,
        halfW: 0.3, halfD: srS / 2, height: srH, extra: { isEnclosed: false }
    }));
    cColliders.push(createColliderMarker(cemGrp, 'solidWall', {
        localX: srX + srS / 2, localY: srH / 2, localZ: srZ,
        halfW: 0.3, halfD: srS / 2, height: srH, extra: { isEnclosed: false }
    }));

    cemGrp.position.set(ox, groundY, oz);
    cemGrp.rotation.y = rot;
    scene.add(cemGrp);
    cemGrp.updateMatrixWorld(true);
    registerColliderMarkers(cColliders);

    // Compute talisman grave world position for dig detection
    const tgWorld = localToWorldXZ(ox, oz, tgX, tgZ, rot);
    cemeteryData = {
        group: cemGrp,
        worldX: ox, worldZ: oz, worldGroundY: groundY, rotation: rot,
        talismanGraveWorldX: tgWorld.x,
        talismanGraveWorldZ: tgWorld.z,
        talismanGraveLocalX: tgX,
        talismanGraveLocalZ: tgZ,
    };

    if (DEBUG_CEMETERY) {
        // Place player 75 units south of the cemetery entrance
        const entPos = localToWorldXZ(ox, oz, 0, CEM_HALF + 75, rot);
        player.position.set(entPos.x, groundY + 1, entPos.z);
    }

    if (DEBUG_TALISMAN) {
        hasTalisman = true;
        addInventoryItem('talisman', 'Talisman', null, { type: 'object', itemKey: 'talisman' });
    }
}

// ── Talisman grave interaction ────────────────────────────────────────────────
function tryDigTalismanGrave() {
    if (!cemeteryData || hasTalisman || talismanItemMesh) return false;
    if (currentHandItem !== 'shovel') return false;

    const dx = player.position.x - cemeteryData.talismanGraveWorldX;
    const dz = player.position.z - cemeteryData.talismanGraveWorldZ;
    if (Math.sqrt(dx * dx + dz * dz) > 4) return false;

    talismanGraveDigCount++;
    spawnDigParticles(
        cemeteryData.talismanGraveWorldX + (Math.random() - 0.5) * 1.5,
        cemeteryData.worldGroundY,
        cemeteryData.talismanGraveWorldZ + (Math.random() - 0.5) * 1.5
    );

    if (talismanGraveDigCount >= CEM_GRAVE_DIGS) {
        // Create depression mesh
        const depMat = new THREE.MeshLambertMaterial({ color: 0x241c14 });
        talismanGraveMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.4), depMat);
        talismanGraveMesh.position.set(
            cemeteryData.talismanGraveWorldX,
            cemeteryData.worldGroundY - 0.25,
            cemeteryData.talismanGraveWorldZ
        );
        talismanGraveMesh.receiveShadow = true;
        scene.add(talismanGraveMesh);

        // Spawn talisman item
        talismanItemMesh = createTalismanMesh(0.55);
        talismanBaseY = cemeteryData.worldGroundY + 0.8;
        talismanItemMesh.position.set(
            cemeteryData.talismanGraveWorldX,
            talismanBaseY,
            cemeteryData.talismanGraveWorldZ
        );
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

    if (talismanLockTimer > 0) {
        talismanLockTimer = Math.max(0, talismanLockTimer - delta);
        const phase = (performance.now() - talismanSpawnTime) / 1000 * 2 * Math.PI;
        const pulse = 2 - 2 * Math.cos(phase);
        talismanItemMesh.traverse(obj => {
            if (obj.isMesh && obj.material) obj.material.emissiveIntensity = 0.6 + pulse * 0.8;
            if (obj.isLight && obj.userData.isTalismanGlow) obj.intensity = pulse * 2;
        });
    } else {
        talismanItemMesh.traverse(obj => {
            if (obj.isMesh && obj.material) obj.material.emissiveIntensity = 0.6;
            if (obj.isLight && obj.userData.isTalismanGlow) obj.intensity = 0;
        });
    }
}

// ── tryPickupTalisman (called from punch) ────────────────────────────────────
function tryPickupTalisman(aimDir, punchRange) {
    if (!talismanItemMesh || talismanLockTimer > 0) return false;
    const toItem = talismanItemMesh.position.clone().sub(camera.position);
    const proj = toItem.dot(aimDir);
    if (proj <= 0 || proj > punchRange) return false;
    const perp = toItem.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
    if (perp > 2.5) return false;

    hasTalisman = true;
    scene.remove(talismanItemMesh);
    talismanItemMesh = null;
    addInventoryItem('talisman', 'Talisman', null, { type: 'object', itemKey: 'talisman' });
    flashEquipHint('TALISMAN FOUND');
    return true;
}

// ── tryPickupSSItem (called from punch) ──────────────────────────────────────
function tryPickupSSItem(aimDir, punchRange) {
    if (!hauntedHouseData || hhSeqPhase !== 'active') return false;
    if (!hauntedHouseData.ssItemGrp || !hauntedHouseData.worldSword) return false;

    // Use worldSword's actual world position — ssItemGrp sits at the group origin (0,0,0)
    // so getWorldPosition on the group returns the building centre, not the item location.
    const itemPos = new THREE.Vector3();
    hauntedHouseData.worldSword.getWorldPosition(itemPos);
    const toItem = itemPos.clone().sub(camera.position);
    const proj = toItem.dot(aimDir);
    if (proj <= 0 || proj > punchRange) return false;
    const perp = toItem.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
    if (perp > 5) return false;

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
    _blacken(hd.ssItemGrp, !lit);
    _blacken(hd.worldSkeleton, !lit);
}

// ── updateHauntedHouseSequence (called per-frame) ────────────────────────────
function updateHauntedHouseSequence(delta) {
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

    // ── Phase: none — check if player enters with torch ──────────────────────
    if (hhSeqPhase === 'none') {
        if (!hasTorch) return;
        const inside = (Math.abs(localPos.x) < HH_HALF_W + 1 &&
                        Math.abs(localPos.z) < HH_HALF_D + 1 &&
                        localY < HH_F1_H + HH_F2_H + 2);
        if (inside) hhSeqPhase = 'active';
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
            removeHHStairs();
            hhSeqPhase = 'hallway_exit';
        }
        return;
    }

    // ── Phase: hallway_exit — stairs gone; wait for player to clear doorway, then seal it ──
    if (hhSeqPhase === 'hallway_exit') {
        // Close the hallway door only when the player is guaranteed inside the main room:
        // 5+ units south of the partition (z > HH_HALL_Z + 5) AND west of the east corridor
        // (x < HH_HALL_X), so they cannot be in the hallway or east corridor.
        if (localPos.z > HH_HALL_Z + 5 && localPos.x < HH_HALL_X) {
            closeHHHallDoor();
            hhSeqPhase = 'timer';
            hhSeqTimer = 0;
            hhTorchExtinguished = false;
            hhSMSpawned = false;
            hhSMApproaching = false;
        }
        return;
    }

    // ── Phase: timer — countdown sequence ────────────────────────────────────
    const T_EXTINGUISH_TORCH = 10;
    const T_SPAWN_SM = T_EXTINGUISH_TORCH + 7.5;
    const T_SM_APPROACH = T_SPAWN_SM + 7.5;
    if (hhSeqPhase === 'timer') {
        hhSeqTimer += delta;

        // t=15: extinguish torch
        if (!hhTorchExtinguished && hhSeqTimer >= T_EXTINGUISH_TORCH) {
            hhTorchExtinguished = true;
            if (hasTorch) {
                hasTorch = false;
                hasStake = true;
                addHandSlot('stake', 'torch');
                syncHandItemVisuals();
            }
        }

        // t=25: spawn white SM in farthest corner
        if (!hhSMSpawned && hhSeqTimer >= T_SPAWN_SM) {
            hhSMSpawned = true;
            hhSMApproachCount = 0;
            _spawnHHWhiteSM(true);  // true = use farthest corner
        }

        // t=35: SM starts approaching
        if (hhSMSpawned && !hhSMApproaching && hhSeqTimer >= T_SM_APPROACH) {
            hhSMApproaching = true;
        }

        // Update SM behavior
        if (hhSMSpawned) _updateHHWhiteSM(delta);

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

// ── Spawn white SM ───────────────────────────────────────────────────────────
function _spawnHHWhiteSM(useFarthest) {
    // Never spawn while a touch-reset is already pending — avoids a ghost SM appearing
    // in a corner during the 400 ms delay before the world restarts.
    if (hhWhiteSMData && hhWhiteSMData.touchTriggered) return;

    if (hhWhiteSMData && hhWhiteSMData.mesh) {
        scene.remove(hhWhiteSMData.mesh);
    }

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

    const corner = HH_CORNERS[cornerIdx];
    const wPos = localToWorldXZ(hd.worldX, hd.worldZ, corner.x, corner.z, hd.rotation);

    // Use canonical shadow man build; switch all parts to the white night material
    const smGrp = createShadowManMesh();
    const nightMat = smGrp.userData.nightMaterial;
    smGrp.userData.partMeshes.forEach(m => { m.material = nightMat; });
    smGrp.userData.usingNightMaterial = true;

    smGrp.position.set(wPos.x, hd.worldGroundY, wPos.z);
    scene.add(smGrp);

    const partMeshes = smGrp.userData.partMeshes;
    const partBaseX  = partMeshes ? partMeshes.map(m => m.position.x) : [];

    hhWhiteSMData = { mesh: smGrp, approachCount: hhSMApproachCount, partMeshes, partBaseX };
    hhSMApproaching = (hhSeqTimer >= 50) && !hhWhiteSMData.justSpawned;
    hhWhiteSMData.justSpawned = true;

    if (hhSMApproachCount > 0) {
        // Respawn: approach immediately (no freeze)
        hhSMApproaching = true;
        hhWhiteSMData.justSpawned = false;
    }
}

// ── Update white SM each frame ────────────────────────────────────────────────
function _updateHHWhiteSM(delta) {
    if (!hhWhiteSMData || !hhWhiteSMData.mesh) return;
    const sm = hhWhiteSMData.mesh;

    // Face player
    const dx = player.position.x - sm.position.x;
    const dz = player.position.z - sm.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) sm.rotation.y = Math.atan2(dx, dz);

    // Body oscillation for the last 5 approaches (approachCount 6-10 → approaches 7-11)
    const OSCILLATE_THRESHOLD = HH_SM_MAX_APPROACHES - 5; // = 6
    if (hhSMApproachCount >= OSCILLATE_THRESHOLD &&
            hhWhiteSMData.partMeshes && hhWhiteSMData.partBaseX.length) {
        const osc = Math.sin(performance.now() * 0.09) * 0.25;
        hhWhiteSMData.partMeshes.forEach((part, i) => {
            part.position.x = hhWhiteSMData.partBaseX[i] + osc;
        });
    }

    if (!hhSMApproaching) return;  // frozen phase

    const speed = HH_SM_V0 * Math.pow(HH_SM_ACCEL, hhSMApproachCount);
    if (dist > 0.5) {
        sm.position.x += (dx / dist) * speed * delta;
        sm.position.z += (dz / dist) * speed * delta;
    }

    // Hover slightly above ground
    sm.position.y = hauntedHouseData.worldGroundY + Math.sin(performance.now() / 400) * 0.15;

    // Touch detection — SM touched player; trigger world reset.
    // Do NOT remove the SM so it keeps following until the reset fires.
    if (dist < 2.0 && !hhWhiteSMData.touchTriggered) {
        hhWhiteSMData.touchTriggered = true;
        setTimeout(() => hardReset(), 400);
    }
}

// ── Sword hit against HH white SM ────────────────────────────────────────────
function tryHitHHWhiteSM(aimDir, punchRange) {
    if (!hhWhiteSMData || !hhWhiteSMData.mesh) return false;
    if (!hhSMApproaching) return false;             // can't hit during frozen phase
    if (!hasTalisman) return false;                 // talisman required — without it hits do nothing
    if (hhWhiteSMData.touchTriggered) return false; // reset already triggered; ignore input

    // Vector from camera to SM center (offset up to torso/head height)
    const smPos = hhWhiteSMData.mesh.position.clone();
    smPos.y += 4;
    const toSM = new THREE.Vector3().subVectors(smPos, camera.position);
    const dist = toSM.length();
    if (dist > punchRange) return false;

    // Horizontal angle check only — flatten both vectors to XZ so that looking up at the
    // SM's head or down at its feet doesn't widen the effective angle and cause a miss.
    const cosThreshold = Math.cos(HH_SWORD_HIT_MAX_ANGLE * Math.PI / 180);
    const toSMFlat = new THREE.Vector3(toSM.x, 0, toSM.z).normalize();
    const aimFlat  = new THREE.Vector3(aimDir.x, 0, aimDir.z).normalize();
    if (toSMFlat.dot(aimFlat) < cosThreshold) return false;

    // Hit!
    hhSMApproachCount++;

    if (hhSMApproachCount >= HH_SM_MAX_APPROACHES) {
        // Final hit: sequence complete
        scene.remove(hhWhiteSMData.mesh);
        hhWhiteSMData = null;
        _doFlashbang();
    } else {
        // Respawn at random corner
        _spawnHHWhiteSM(false);
    }
    return true;
}

// ── Upgrade sword blade to MeshBasicMaterial after HH sequence victory ────────
function _upgradeSwordBlade() {
    if (!playerSwordMesh) return;
    const basicMat = new THREE.MeshBasicMaterial({ color: 0xe3ecff });
    playerSwordMesh.traverse(obj => {
        if (obj.isMesh && obj.userData.isBlade) obj.material = basicMat;
    });
    _startSwordBladeParticles();
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

// ── Flashbang effect ──────────────────────────────────────────────────────────
function _doFlashbang() {
    const fb = document.getElementById('hh-flashbang');
    if (!fb) return;
    fb.style.opacity = '1';
    fb.style.transition = 'opacity 0s';

    // After 0.8s, restore stairs and entrance, upgrade blade, then fade out
    setTimeout(() => {
        restoreHHStairs();
        restoreHHEntrance();
        restoreHHHallDoor();
        _upgradeSwordBlade();
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
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;  // lay ring flat (horizontal)
    mesh.position.z = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 80;
    swordSwipeGroup.add(mesh);
    swordSwipeGroup.position.copy(player.position);
    swordSwipeGroup.position.y += 1.4;
    // Sweep ±70° relative to where the crosshair/camera is pointing
    const swipeArc = 90 * Math.PI / 180;
    swordSwipeGroup.rotation.y = cameraYaw - Math.PI/2 - swipeArc;
    swordSwipeGroup.userData.startYaw = cameraYaw - Math.PI/2 - swipeArc;
    swordSwipeGroup.userData.endYaw   = cameraYaw - swipeArc/2;
    // swordSwipeGroup.userData.startYaw = cameraYaw - Math.PI/2 - swipeArc;
    // swordSwipeGroup.userData.endYaw   = cameraYaw - Math.PI/2;
    swordSwipeGroup.userData.swipeMesh = mesh;
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
    const startY = swordSwipeGroup.userData.startYaw;
    const endY   = swordSwipeGroup.userData.endYaw;
    swordSwipeGroup.rotation.y = startY + (endY - startY) * t;
    swordSwipeGroup.position.copy(player.position);
    swordSwipeGroup.position.y += 1.4;
    const mesh = swordSwipeGroup.userData.swipeMesh;
    if (mesh) mesh.material.opacity = 0.55 * (1 - t);
}

// ── Sword cooldown bar HUD ────────────────────────────────────────────────────
function _updateSwordCooldownBar() {
    const bar = document.getElementById('sword-cooldown-bar');
    const wrap = document.getElementById('sword-cooldown-wrap');
    if (!wrap || !bar) return;
    if (hhSwordCooldown > 0 && currentHandItem === 'sword-shield') {
        wrap.style.display = 'block';
        bar.style.width = (hhSwordCooldown * 100) + '%';
    } else {
        wrap.style.display = 'none';
    }
}

// ── Despawn HH (after 900 units post-sequence) ───────────────────────────────
function _despawnHauntedHouse() {
    if (!hauntedHouseData) return;
    const hd = hauntedHouseData;

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
