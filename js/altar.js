// ===== Sacrificial Altar =====

const ALTAR_TRIANGLE_RADIUS = 8;
const ALTAR_TORCH_ANGLES = [
    Math.PI / 2,
    Math.PI / 2 + (2 * Math.PI / 3),
    Math.PI / 2 + (4 * Math.PI / 3),
];

// Altar vertical layout (all in altarGrp local space, origin = groundY):
const ALTAR_PLATFORM_TOP   = 3.0;   // top of 3-step raised dark stone platform
const ALTAR_PILLAR_H       = 2.0;   // height of light stone pillar
const ALTAR_SLAB_THICK     = 0.4;   // thickness of light stone altar slab
const ALTAR_SLAB_H         = ALTAR_PLATFORM_TOP + ALTAR_PILLAR_H + ALTAR_SLAB_THICK; // 5.4
const ALTAR_BODY_Y         = ALTAR_SLAB_H + 0.18;  // corpse surface (5.58)
const ALTAR_TORCH_FLAME_Y  = 5.5;   // torch-local Y of flame tip (updated for bigger torch)

const ALTAR_PULSE_DURATION      = 0.7;
const ALTAR_PULSE_MAX_INTENSITY = 1.5;
const ALTAR_NUM_PULSES          = 6;

// Shared material colors
const ALTAR_DARK_STONE_COLOR  = 0x2a2a30;  // matches HH / cemetery dark rocks
const ALTAR_LIGHT_STONE_COLOR = 0x777777;  // matches normal game rocks
const ALTAR_CORPSE_COLOR      = 0x802f26;

// Internal state (not shared across files, no need to put in state.js)
let _altarPrePlaced  = null;  // set by prepareAltarPlacement(); consumed by createSacrificialAltar()
let _altarPulseTimer = 0;
let _altarAscendTimer = 0;
let _altarSkyFlashTimer = 0;
const _ALTAR_SKY_FLASH_DUR = 0.65;
const _altarNightSkyColor  = new THREE.Color(0x0a0a20);

function makeAltarCorpseHitProfile() {
    return {
        shape: 'capsule',
        start: { x: 0, y: ALTAR_BODY_Y, z: -1.1 },
        end:   { x: 0, y: ALTAR_BODY_Y, z:  1.60 },
        radius: 1.0
    };
}

// Returns true when the current game time is in the night phase.
function _altarIsNight() {
    return (gameTime / FULL_CYCLE) >= NIGHT_START;
}

// Starts a brief sky-color flash to the night color as feedback for a blocked
// daytime corpse-strike attempt.  The actual blend is applied in updateAltar,
// which runs after updateDayNightCycle, so it overrides the sky color that frame.
function _triggerNightRequiredFlash() {
    _altarSkyFlashTimer = _ALTAR_SKY_FLASH_DUR;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

// Creates a cylinder whose axis points from (x1,z1) to (x2,z2) at the given y.
function _makeHorizCylinder(x1, z1, x2, z2, y, rTop, rBot, mat) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 7), mat);
    mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.castShadow = true;
    return mesh;
}

// Torus cuff whose hole encircles the limb.
// THREE.TorusGeometry has its axis along Z by default, so we rotate Z → limb direction.
function _makeCuff(x2, z2, dx, dz, y, mat) {
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.065, 6, 10), mat);
    mesh.position.set(x2, y, z2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    return mesh;
}

// ── Pillar symbol textures and placement ──────────────────────────────────────

// 2-D shape for a classic zigzag lightning bolt, in local XY space.
// Coordinates are derived from the canvas polygon (64×96) mapped to ±0.425 wide, ±0.46 tall.
function _makeThunderboltShape() {
    const s = new THREE.Shape();
    s.moveTo( 0.133,  0.458);   // top
    s.lineTo(-0.159, -0.042);   // mid-left
    s.lineTo( 0.013, -0.042);   // notch right
    s.lineTo(-0.239, -0.458);   // bottom
    s.lineTo( 0.186,  0.042);   // mid-right
    s.lineTo(-0.013,  0.042);   // notch left
    s.closePath();
    return s;
}

// 2-D shape for a crescent moon (outer circle minus offset inner circle).
function _makeCrescentShape() {
    const R1 = 0.38;  // outer circle radius
    const R2 = 0.30;  // inner circle radius
    const CX = 0.15;  // inner circle x-offset (crescent opens to the right)
    const N  = 40;

    // Circle-circle intersection points (the crescent "horns")
    const xi = (R1 * R1 - R2 * R2 + CX * CX) / (2 * CX);
    const yi = Math.sqrt(Math.max(0, R1 * R1 - xi * xi));

    const ao_top = Math.atan2( yi, xi);
    const ao_bot = Math.atan2(-yi, xi);
    const ai_top = Math.atan2( yi, xi - CX);
    const ai_bot = Math.atan2(-yi, xi - CX);

    const TILT = 40 * Math.PI / 180;
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    function r(x, y) { return [x * cosT - y * sinT, x * sinT + y * cosT]; }

    const shape = new THREE.Shape();

    // Outer arc: upper horn → long CCW path around the left side of outer circle → lower horn
    const outerSpan = (ao_bot + Math.PI * 2) - ao_top;
    let p = r(Math.cos(ao_top) * R1, Math.sin(ao_top) * R1);
    shape.moveTo(p[0], p[1]);
    for (let i = 1; i <= N; i++) {
        const a = ao_top + (i / N) * outerSpan;
        p = r(Math.cos(a) * R1, Math.sin(a) * R1);
        shape.lineTo(p[0], p[1]);
    }

    // Inner arc: lower horn → long CW path around the left side of inner circle → upper horn.
    // Must go CW (negative span) so the arc stays inside the outer circle boundary
    // instead of cutting through the external right side of the inner circle.
    const innerSpan = -(2 * Math.PI - (ai_top - ai_bot));
    for (let i = 1; i <= N; i++) {
        const a = ai_bot + (i / N) * innerSpan;
        p = r(CX + Math.cos(a) * R2, Math.sin(a) * R2);
        shape.lineTo(p[0], p[1]);
    }

    return shape;
}

// Extrudes the 2-D shapes into 3-D prisms and mounts them on the four pillar faces.
function _addPillarSymbols(altarGrp) {
    const PILLAR_Y  = ALTAR_PLATFORM_TOP + ALTAR_PILLAR_H / 2;  // 4.0
    // Back of each prism sits at the pillar's circumscribed vertex radius (1.55 at
    // mid-height) so the symbol grows outward from the pillar surface with no gap.
    const FACE_DIST = 1;
    const DEPTH     = 0.5;

    const extCfg = { depth: DEPTH, bevelEnabled: false };
    const mat    = new THREE.MeshLambertMaterial({ color: ALTAR_DARK_STONE_COLOR });

    const boltGeo  = new THREE.ExtrudeGeometry(_makeThunderboltShape(), extCfg);
    const crescGeo = new THREE.ExtrudeGeometry(_makeCrescentShape(),    extCfg);

    // ExtrudeGeometry extrudes in local +Z.  Placing the mesh at FACE_DIST puts the
    // back face (local z=0) at the pillar surface; the front (local z=DEPTH) protrudes
    // outward.  rotation.y θ maps local +Z to world (sinθ, 0, cosθ):
    //   0 → +Z,  π → -Z,  π/2 → +X,  -π/2 → -X
    function place(geo, x, z, rotY) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, PILLAR_Y, z);
        mesh.rotation.y = rotY;
        mesh.userData.ignoreCameraOcclusion = true;
        altarGrp.add(mesh);
    }

    place(boltGeo,  0,          FACE_DIST,  0);            // head  (+Z)
    place(boltGeo,  0,         -FACE_DIST,  Math.PI);      // feet  (-Z)
    place(crescGeo, FACE_DIST,  0,           Math.PI / 2); // right (+X)
    place(crescGeo, -FACE_DIST, 0,          -Math.PI / 2); // left  (-X)
}

// ── Corpse mesh ───────────────────────────────────────────────────────────────

// Returns { bodyGrp, locksGrp, eyeL, eyeR } so locks stay on the slab when the body levitates.
function _buildCorpseMesh() {
    const S = 0.87;  // XZ scale applied to all limb coordinates
    const Y = ALTAR_BODY_Y;

    const bodyMat = new THREE.MeshLambertMaterial({
        color: ALTAR_CORPSE_COLOR,
        emissive: 0x1a0000,
        emissiveIntensity: 0.15,
    });
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });

    const bodyGrp = new THREE.Group();
    bodyGrp.userData.bodyMat = bodyMat;
    bodyGrp.userData.ignoreCameraOcclusion = true;

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * S, 0.35, 2.0 * S), bodyMat);
    torso.position.set(0, Y, 0.2 * S);
    torso.castShadow = true;
    bodyGrp.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38 * S, 10, 8), bodyMat);
    head.position.set(0, Y + 0.06, 1.6 * S);
    head.castShadow = true;
    bodyGrp.add(head);

    // Neck (short horizontal cylinder connecting torso top to head base)
    const neck = _makeHorizCylinder(0, 1.05 * S, 0, 1.35 * S, Y + 0.04, 0.10, 0.13, bodyMat);
    if (neck) bodyGrp.add(neck);

    // Limb definitions (all XZ coords scaled by S)
    const limbs = [
        { x1: -0.4*S, z1:  1.0*S, x2: -1.9*S, z2:  2.7*S, r: 0.14 },  // NW arm
        { x1:  0.4*S, z1:  1.0*S, x2:  1.9*S, z2:  2.7*S, r: 0.14 },  // NE arm
        { x1: -0.3*S, z1: -0.5*S, x2: -1.9*S, z2: -2.1*S, r: 0.16 },  // SW leg
        { x1:  0.3*S, z1: -0.5*S, x2:  1.9*S, z2: -2.1*S, r: 0.16 },  // SE leg
    ];

    for (const l of limbs) {
        const mesh = _makeHorizCylinder(l.x1, l.z1, l.x2, l.z2, Y, l.r*0.8, l.r, bodyMat);
        if (mesh) bodyGrp.add(mesh);
    }

    // Locks in a separate group — stays on the slab when the body ascends.
    // Cuffs sit at 82% along each limb (wrist/ankle), not at the very tip.
    const locksGrp = new THREE.Group();
    locksGrp.userData.ignoreCameraOcclusion = true;
    const CUFF_T = 0.82;
    for (const l of limbs) {
        const cx = l.x1 + (l.x2 - l.x1) * CUFF_T;
        const cz = l.z1 + (l.z2 - l.z1) * CUFF_T;
        const cuff = _makeCuff(cx, cz, l.x2 - l.x1, l.z2 - l.z1, Y, ironMat);
        if (cuff) locksGrp.add(cuff);

        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.55, 6), ironMat);
        stake.position.set(cx, Y - 0.1, cz);
        locksGrp.add(stake);
    }

    // Eyes: pre-created, hidden by default.
    // They glow red at night when all torches are lit; turn white when struck by lightning.
    const eyeGeo = new THREE.SphereGeometry(0.07, 6, 5);
    const eyeY   = Y + 0.06 + 0.25;
    const headZ  = 1.6 * S;
    const eyeL   = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xFF0000 }));
    const eyeR   = new THREE.Mesh(eyeGeo.clone(), new THREE.MeshBasicMaterial({ color: 0xFF0000 }));
    eyeL.position.set(-0.10, eyeY, headZ);
    eyeR.position.set( 0.10, eyeY, headZ);
    eyeL.userData.isEye = true;
    eyeR.userData.isEye = true;
    eyeL.visible = false;
    eyeR.visible = false;
    bodyGrp.add(eyeL);
    bodyGrp.add(eyeR);

    return { bodyGrp, locksGrp, eyeL, eyeR };
}

// ── Torch mesh ────────────────────────────────────────────────────────────────

function _buildAltarTorchMesh() {
    const grp = new THREE.Group();
    grp.userData.ignoreCameraOcclusion = true;

    const poleMat = new THREE.MeshLambertMaterial({ color: 0x5c3a18 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x3d2612 });
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Pole (1.4× original size)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.2, 7), poleMat);
    pole.position.y = 2.1;
    pole.castShadow = true;
    grp.add(pole);

    for (const by of [0.84, 2.1, 3.36]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.042, 5, 10), ironMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = by;
        grp.add(band);
    }

    // Bowl sits at top of pole (pole top = 2.1 + 2.1 = 4.2, bowl center = 4.2 + 0.28 = 4.48)
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.24, 0.56, 8), headMat);
    bowl.position.y = 4.48;
    bowl.castShadow = true;
    grp.add(bowl);

    // Flame group (hidden until lit)
    const flameGrp = new THREE.Group();
    flameGrp.visible = false;

    const outerFlameMat = new THREE.MeshBasicMaterial({ color: 0xFF5500, transparent: true, opacity: 0.9 });
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xFFCC00, transparent: true, opacity: 0.85 });

    // Bowl top = 4.48 + 0.28 = 4.76; flame cones sit above bowl
    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.91, 7), outerFlameMat);
    outerFlame.position.y = 5.22;
    flameGrp.add(outerFlame);

    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.59, 7), innerFlameMat);
    innerFlame.position.y = 5.26;
    flameGrp.add(innerFlame);

    const torchLight = new THREE.PointLight(0xFF5500, 0, 30);
    torchLight.position.y = ALTAR_TORCH_FLAME_Y;  // 5.5
    flameGrp.add(torchLight);

    grp.add(flameGrp);
    grp.userData.flameGrp = flameGrp;
    grp.userData.torchLight = torchLight;

    return grp;
}

// ── Create altar ──────────────────────────────────────────────────────────────

// Called at world init (before trees/rocks) — finds a valid position in the outer band,
// flattens terrain, and reserves the footprint so vegetation respects the altar site.
// Mesh creation is deferred to createSacrificialAltar(), called at talisman pickup.
function prepareAltarPlacement() {
    const region = { type: 'ring', minRadius: 2100, maxRadius: 2700 };

    const placement = findPlacementInRegion(region, (pt) => {
        if (hauntedHouseData) {
            if (Math.hypot(pt.x - hauntedHouseData.worldX, pt.z - hauntedHouseData.worldZ) < 1000) return null;
        }
        if (cemeteryData) {
            if (Math.hypot(pt.x - cemeteryData.worldX, pt.z - cemeteryData.worldZ) < 1000) return null;
        }
        if (isPointInWater(pt.x, pt.z)) return null;
        const stats = sampleTerrainStats(pt.x, pt.z, 25, 2, 8);
        if (stats.range > 35) return null;
        return { x: pt.x, z: pt.z, footprint: makePlacementFootprint(pt.x, pt.z, 22) };
    }, 300, { pointDensity: 1.5 });

    if (!placement) {
        console.warn('Sacrificial altar: no valid placement found');
        return;
    }

    // Flatten terrain before trees/rocks sample ground heights.
    // Vertex spacing = 30 units; halfW=35 fully flattens the ±30 radius; blend=30 fades to ±65.
    const groundY = flattenTerrainRotatedRect(placement.x, placement.z, 35, 35, 0, null, 30);
    _altarPrePlaced = { x: placement.x, z: placement.z, groundY };

    if (DEBUG_ALTAR_PRELOCATION) {
        player.position.set(placement.x, groundY + 2, placement.z + 40);
    } else if (DEBUG_ALTAR) {
        createSacrificialAltar();
    }
}

function createSacrificialAltar() {
    if (altarData) return altarData;
    if (!_altarPrePlaced) {
        console.warn('Sacrificial altar: placement not prepared');
        return;
    }
    const { x: ox, z: oz, groundY } = _altarPrePlaced;

    const altarGrp = new THREE.Group();
    const darkStoneMat = new THREE.MeshLambertMaterial({ color: ALTAR_DARK_STONE_COLOR });
    const lightStoneMat = new THREE.MeshLambertMaterial({ color: ALTAR_LIGHT_STONE_COLOR });

    // ── Raised stepped platform (dark stone, 3 square slabs) ─────────────────
    // The bottom step extends 3 m below ground to fill any terrain gap.
    // Upper two steps are 1 m tall each.
    const stepDefs = [
        { w: 30, h: 4.0, y: -1.0 },  // bottom step: extends groundY-3 to groundY+1
        { w: 24, h: 1.0, y:  1.5 },  // middle step: groundY+1 to groundY+2
        { w: 18, h: 1.0, y:  2.5 },  // top step:    groundY+2 to groundY+3 (=ALTAR_PLATFORM_TOP)
    ];
    for (const s of stepDefs) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.w), darkStoneMat);
        mesh.position.set(0, s.y, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        altarGrp.add(mesh);
        addStructureBox(ox, oz, groundY + s.y - s.h / 2, s.w, s.h, s.w);
    }

    // ── Light stone pillar ────────────────────────────────────────────────────
    // Sits on top of the raised platform; slight taper for aesthetics.
    const pillarCenterY = ALTAR_PLATFORM_TOP + ALTAR_PILLAR_H / 2;  // = 4.0
    const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.5, ALTAR_PILLAR_H, 8),
        lightStoneMat
    );
    pillar.position.set(0, pillarCenterY, 0);
    pillar.castShadow = true;
    altarGrp.add(pillar);
    _addPillarSymbols(altarGrp);

    // ── Altar slab (light stone, fits the corpse) ─────────────────────────────
    // Dimensions chosen to snugly frame the scaled corpse (X ≈ 3.3, Z ≈ 4.2).
    const SLAB_W = 4.4;
    const SLAB_D = 5.0;
    const slabCenterZ = 0.2;   // match corpse center offset
    const slabBottomY = ALTAR_PLATFORM_TOP + ALTAR_PILLAR_H;          // = 5.0
    const slabCenterY = slabBottomY + ALTAR_SLAB_THICK / 2;           // = 5.2
    const altarSlab = new THREE.Mesh(new THREE.BoxGeometry(SLAB_W, ALTAR_SLAB_THICK, SLAB_D), lightStoneMat);
    altarSlab.position.set(0, slabCenterY, slabCenterZ);
    altarSlab.castShadow = true;
    altarSlab.receiveShadow = true;
    altarGrp.add(altarSlab);
    // True primitive: no minPlayerY guard — player on the platform snaps to slab top immediately.
    addStructureBox(ox, oz + slabCenterZ, groundY + slabBottomY, SLAB_W, ALTAR_SLAB_THICK, SLAB_D);

    // ── Dead body ─────────────────────────────────────────────────────────────
    const { bodyGrp, locksGrp, eyeL, eyeR } = _buildCorpseMesh();
    altarGrp.add(bodyGrp);   // levitates during the ritual
    altarGrp.add(locksGrp);  // stays on slab
    setObjectHitProfile(bodyGrp, makeAltarCorpseHitProfile(), {
        debugKey: 'altarCorpseHitboxDebug'
    });

    // ── Three torches in equilateral triangle ─────────────────────────────────
    // Torches sit on top of the raised platform.
    const torches = [];
    for (let i = 0; i < 3; i++) {
        const angle = ALTAR_TORCH_ANGLES[i];
        const tx = Math.cos(angle) * ALTAR_TRIANGLE_RADIUS;
        const tz = Math.sin(angle) * ALTAR_TRIANGLE_RADIUS;
        const torchMesh = _buildAltarTorchMesh();
        torchMesh.position.set(tx, ALTAR_PLATFORM_TOP, tz);
        altarGrp.add(torchMesh);
        torches.push({
            mesh: torchMesh, lit: false, localX: tx, localZ: tz,
            // Flicker state — mirrors updateTorchLight; frequencies randomised so torches aren't in sync
            flickerTimer:     0,
            baseIntensity:    65,
            currentIntensity: 65,
            targetIntensity:  65,
            baseDistance:     30,
            currentDistance:  30,
            targetDistance:   30,
            breathFreq1:  10 + Math.random() * 6,          // 10–16
            breathFreq2:  18 + Math.random() * 7,          // 18–25
            breathPhase2: Math.random() * Math.PI * 2,
        });
    }

    // ── Five ceremonial pillars in a ring around the altar ────────────────────
    // First pillar at Math.PI/2 (local +Z, aligned with corpse head); rest at 72° steps.
    // const NUM_PILLARS = 8;
    // const CP_RADIUS = 24;
    // const CP_H      = 18;
    // const CP_RAD_T  = 1;
    // const CP_RAD_B  = 1;
    // const cpMat = new THREE.MeshLambertMaterial({ color: ALTAR_LIGHT_STONE_COLOR });
    // for (let i = 0; i < NUM_PILLARS; i++) {
    //     const angle = Math.PI / 2 + i * (2 * Math.PI / NUM_PILLARS);
    //     const lx = Math.cos(angle) * CP_RADIUS;
    //     const lz = Math.sin(angle) * CP_RADIUS;

    //     const pillar = new THREE.Mesh(
    //         new THREE.CylinderGeometry(CP_RAD_T, CP_RAD_B, CP_H, 8),
    //         cpMat
    //     );
    //     pillar.position.set(lx, CP_H / 2, lz);
    //     pillar.castShadow = true;
    //     altarGrp.add(pillar);

    //     const pillarCap = new THREE.Mesh(
    //         new THREE.CylinderGeometry(1.3*CP_RAD_T, 1.3*CP_RAD_B, 0.5, 8),
    //         new THREE.MeshLambertMaterial({ color: ALTAR_DARK_STONE_COLOR })
    //     );
    //     pillarCap.position.set(lx, CP_H, lz);
    //     pillarCap.castShadow = true;
    //     altarGrp.add(pillarCap);

    //     // addStructureBox(ox + lx, oz + lz, groundY + CP_H / 2, CP_RAD_B * 2, CP_H, CP_RAD_B * 2);
    // }

    altarGrp.position.set(ox, groundY, oz);
    scene.add(altarGrp);

    // Torch flame tips in world space (used for purple beam vertices)
    const flameTipWorldY = groundY + ALTAR_PLATFORM_TOP + ALTAR_TORCH_FLAME_Y;
    const torchWorldTips = torches.map(t => new THREE.Vector3(
        ox + t.localX, flameTipWorldY, oz + t.localZ
    ));

    altarData = {
        group: altarGrp,
        worldX: ox, worldZ: oz, worldGroundY: groundY,
        torches,
        corpse: bodyGrp,
        bodyMat: bodyGrp.userData.bodyMat,
        eyeL, eyeR,
        beams: [],
        beamParticles: [],
        smokeParticles: [],
        torchWorldTips,
        holyGemPlatform: null,   // populated in _createHolyGemPlatform
        corpseHitPos: new THREE.Vector3(ox, groundY + ALTAR_SLAB_H + 0.4, oz),
    };
    altarData.torchHitRoots = altarData.torchWorldTips.map((tip, i) => {
        return makeWorldHitProfileRoot(tip, {
            shape: 'sphere',
            center: { x: 0, y: -0.5, z: 0 },
            radius: 0.9
        }, {
            debugKey: `altarTorchHitboxDebug-${i}`
        });
    });
    if (DEBUG_ALTAR) {
        player.position.set(ox, groundY + 2, oz + 40);
        if (dragon) {
            applyAscendedDragonMaterials(dragon);
            dragonAscended = true;
            dragonGemCollected = true;
            dragonDescending = true;
            dragon.visible = true;
            dragon.position.set(ox, groundY + 20, oz + 40);
        }
    }

    return altarData;
}

// ── Torch lighting ────────────────────────────────────────────────────────────

function _lightAltarTorch(index) {
    const torch = altarData.torches[index];
    torch.lit = true;
    torch.mesh.userData.flameGrp.visible = true;
    torch.mesh.userData.torchLight.intensity = 45;
    altarTorchesLit++;

    if (altarTorchesLit >= 3) {
        altarState = 'torches_lit';
        _activateAltarPurpleBeam();
    }
}

function _activateAltarPurpleBeam() {
    const tips = altarData.torchWorldTips;

    // Three beam cylinders forming the triangle
    for (let i = 0; i < 3; i++) {
        const a = tips[i];
        const b = tips[(i + 1) % 3];
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const dir = b.clone().sub(a).normalize();
        const len = a.distanceTo(b);

        const mat = new THREE.MeshBasicMaterial({
            color: 0xAA00FF,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, len, 8, 1, true),
            mat
        );
        beam.position.copy(mid);
        beam.position.y -= 0.4;
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        beam.frustumCulled = false;
        beam.userData.ignoreCameraOcclusion = true;
        scene.add(beam);
        altarData.beams.push(beam);
    }

    // Spiral particles
    const pMat = new THREE.MeshBasicMaterial({ color: 0xCC44FF, transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 45; i++) {
        const pm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 4, 3), pMat.clone());
        pm.frustumCulled = false;
        pm.userData.ignoreCameraOcclusion = true;
        scene.add(pm);
        altarData.beamParticles.push({
            mesh: pm,
            t: Math.random() * 3,          // 0..3 across 3 edges
            speed: 0.28 + Math.random() * 0.38,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: 2.5 + Math.random() * 3.5,
        });
    }

    // Turn all torch flames and lights purple
    for (const torch of altarData.torches) {
        const fg = torch.mesh.userData.flameGrp;
        if (fg) {
            fg.children.forEach(child => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xAA00FF);
                }
            });
        }
        if (torch.mesh.userData.torchLight) {
            torch.mesh.userData.torchLight.color.setHex(0xAA00FF);
        }
    }

    altarBeamActive = true;
}

// ── Public interaction helpers (called from weapons.js punch()) ───────────────

function tryLightAltarTorch(aimDir, range) {
    if (!altarData || altarTorchesLit >= 3) return false;

    for (let i = 0; i < altarData.torches.length; i++) {
        const torch = altarData.torches[i];
        if (torch.lit) continue;

        const rayRange = getMeleeRayRange(range);
        const hit = rayHitObjectProfileFromCamera(aimDir, altarData.torchHitRoots[i], rayRange);
        if (hit && isHitWithinPlayerReach(hit, range)) {
            _lightAltarTorch(i);
            return true;
        }
    }
    return false;
}

function tryHitAltarCorpseWithLightning(aimDir, range) {
    if (!altarData || altarCorpseStruck || altarState !== 'torches_lit') return false;

    const rayRange = getMeleeRayRange(range);
    const hit = rayHitProfile(
        camera.position,
        aimDir,
        altarData.corpse,
        altarData.corpse.userData.hitProfile,
        rayRange
    );
    if (!hit || !isHitWithinPlayerReach(hit, range)) return false;

    // Lightning only works at night; flash the night-sky color as feedback otherwise.
    if (!_altarIsNight()) {
        _triggerNightRequiredFlash();
        return false;
    }
    return true;
}

function _triggerAltarCorpseStrike() {
    if (!altarData || altarCorpseStruck || altarState !== 'torches_lit') return;

    altarCorpseStruck = true;
    altarState = 'struck';
    _altarPulseTimer = 0;
    recordKill('zombie');
    updateStats();

    // Turn the pre-created eyes white and ensure they're visible.
    if (altarData.eyeL) { altarData.eyeL.material.color.setHex(0xFFFFFF); altarData.eyeL.visible = true; }
    if (altarData.eyeR) { altarData.eyeR.material.color.setHex(0xFFFFFF); altarData.eyeR.visible = true; }
}

// ── Per-frame update ──────────────────────────────────────────────────────────

function updateAltar(delta, time) {
    if (!altarData) return;

    // Flicker lit torches — light intensity varies, flames are stable
    const flameTipWorldY = altarData.worldGroundY + ALTAR_PLATFORM_TOP + ALTAR_TORCH_FLAME_Y;
    for (const torch of altarData.torches) {
        if (!torch.lit) continue;
        const light = torch.mesh.userData.torchLight;
        if (light) {
            torch.flickerTimer -= delta;
            if (torch.flickerTimer <= 0) {
                torch.flickerTimer    = 0.03 + Math.random() * 0.12;
                torch.targetIntensity = torch.baseIntensity * (0.7 + Math.random() * 0.6);
                torch.targetDistance  = torch.baseDistance  * (0.7 + Math.random() * 0.6);
            }
            torch.currentIntensity += (torch.targetIntensity - torch.currentIntensity) * Math.min(1, delta * 9);
            torch.currentDistance  += (torch.targetDistance  - torch.currentDistance)  * Math.min(1, delta * 6);

            const t = performance.now() * 0.0005;
            const breath = Math.sin(t * torch.breathFreq1) * 0.17
                         + Math.sin(t * torch.breathFreq2 + torch.breathPhase2) * 0.09;
            light.intensity = Math.max(1,  torch.currentIntensity + breath * torch.baseIntensity);
            light.distance  = Math.max(10, torch.currentDistance  + breath * torch.baseDistance * 0.10);
        }

        // Smoke particles rising from flame tip
        if (Math.random() < delta * 9) {
            const wx = altarData.worldX + torch.localX + (Math.random() - 0.5) * 0.3;
            const wz = altarData.worldZ + torch.localZ + (Math.random() - 0.5) * 0.3;
            const pm = new THREE.Mesh(
                new THREE.SphereGeometry(0.11, 4, 3),
                new THREE.MeshBasicMaterial({ color: 0x886688, transparent: true, opacity: 0.38, depthWrite: false })
            );
            pm.position.set(wx, flameTipWorldY, wz);
            pm.frustumCulled = false;
            pm.userData.ignoreCameraOcclusion = true;
            pm.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.25,
                0.9 + Math.random() * 0.6,
                (Math.random() - 0.5) * 0.25
            );
            pm.userData.maxLife = 1.8 + Math.random() * 1.2;
            pm.userData.life = 0;
            scene.add(pm);
            altarData.smokeParticles.push(pm);
        }
    }

    // Update smoke particles
    for (let i = altarData.smokeParticles.length - 1; i >= 0; i--) {
        const p = altarData.smokeParticles[i];
        p.userData.life += delta;
        const t = p.userData.life / p.userData.maxLife;
        if (t >= 1) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            altarData.smokeParticles.splice(i, 1);
            continue;
        }
        p.position.addScaledVector(p.userData.vel, delta);
        p.material.opacity = 0.38 * (1 - t * t);
        const s = 0.9 + t * 1.4;
        p.scale.setScalar(s);
    }

    // Purple beams + spiral particles
    if (altarBeamActive) {
        const beamPulse = 0.38 + Math.sin(time * 2.8) * 0.22;
        for (const b of altarData.beams) b.material.opacity = beamPulse;

        const tips = altarData.torchWorldTips;
        for (const p of altarData.beamParticles) {
            p.t = (p.t + p.speed * delta) % 3;
            p.angle += p.angleSpeed * delta;

            const ei = Math.floor(p.t);
            const et = p.t - ei;
            const a = tips[ei];
            const b2 = tips[(ei + 1) % 3];

            const along = a.clone().lerp(b2, et);

            const beamDir = b2.clone().sub(a).normalize();
            // Build an orthonormal frame perpendicular to the beam
            const up = Math.abs(beamDir.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
            const right = new THREE.Vector3().crossVectors(beamDir, up).normalize();
            const upOrtho = new THREE.Vector3().crossVectors(right, beamDir).normalize();

            const sr = 0.65;
            p.mesh.position.copy(along)
                .addScaledVector(right, Math.cos(p.angle) * sr)
                .addScaledVector(upOrtho, Math.sin(p.angle) * sr);
            p.mesh.material.opacity = 0.55 + Math.sin(p.angle * 2 + time * 3) * 0.3;
        }
    }

    // Red eyes at night with all torches lit; hidden otherwise (until struck).
    if (!altarCorpseStruck && altarData.eyeL && altarData.eyeR) {
        const showRed = _altarIsNight() && altarTorchesLit >= 3;
        altarData.eyeL.visible = showRed;
        altarData.eyeR.visible = showRed;
    }

    // Sky flash — lerp the sky toward night color and back (runs after updateDayNightCycle).
    // scene.background IS _skyColorBuf in daynight.js, so lerping it affects both sky and fog.
    if (_altarSkyFlashTimer > 0) {
        _altarSkyFlashTimer = Math.max(0, _altarSkyFlashTimer - delta);
        const elapsed   = _ALTAR_SKY_FLASH_DUR - _altarSkyFlashTimer;
        const progress  = elapsed / _ALTAR_SKY_FLASH_DUR;   // 0 → 1 over full duration
        // Quick ramp-in (first 23%), slow ramp-out (remaining 77%)
        const strength  = progress < 0.23
            ? progress / 0.23
            : 1.0 - (progress - 0.23) / 0.77;
        scene.background.lerp(_altarNightSkyColor, strength);
        // Also dim the sun and ambient so the whole scene darkens with the sky.
        sun.intensity        *= (1 - strength);
        ambientLight.intensity *= (1 - strength);
    }

    // Corpse pulse animation — symmetric: equal time white and original-color
    if (altarState === 'struck') {
        _altarPulseTimer += delta;
        const pulseIdx = Math.floor(_altarPulseTimer / ALTAR_PULSE_DURATION);
        const pulseT   = (_altarPulseTimer % ALTAR_PULSE_DURATION) / ALTAR_PULSE_DURATION;

        if (pulseIdx < ALTAR_NUM_PULSES) {
            // Full cosine wave: 0 → peak → 0 → peak → 0 per period, ensuring equal bright/dark time
            const intensity = ALTAR_PULSE_MAX_INTENSITY * 0.5 * (1 - Math.cos(pulseT * Math.PI * 2));
            altarData.bodyMat.emissive.setHex(0xFFFFFF);
            altarData.bodyMat.emissiveIntensity = intensity;
        } else {
            // After pulses: ramp up permanently then transition to BasicMaterial for ascent
            const rampT = Math.min(1, (_altarPulseTimer - ALTAR_NUM_PULSES * ALTAR_PULSE_DURATION) / ALTAR_PULSE_DURATION);
            altarData.bodyMat.emissive.setHex(0xFFFFFF);
            altarData.bodyMat.emissiveIntensity = rampT * ALTAR_PULSE_MAX_INTENSITY;

            if (rampT >= 1) {
                // Switch to BasicMaterial for a brighter, self-illuminated translucent white
                const ascendMat = new THREE.MeshBasicMaterial({
                    color: 0xDBFCFF,
                    transparent: true,
                    opacity: 0.82,
                });
                altarData.corpse.traverse(obj => {
                    if (obj.isMesh && obj.material !== undefined) {
                        if (obj.userData.isEye) { obj.visible = false; return; }
                        obj.material = ascendMat;
                    }
                });
                altarState = 'ascending';
                _altarAscendTimer = 0;
            }
        }
    }

    // Ascent — straight up, no rotation
    if (altarState === 'ascending') {
        _altarAscendTimer += delta;
        const t = _altarAscendTimer;

        let dy;
        if (t < 3) {
            dy = t * 2.5;                       // slow levitation
        } else {
            dy = 7.5 + (t - 3) * 450;           // faster rapid rise
        }
        altarData.corpse.position.y = dy;

        // Fade out during rapid rise
        if (t >= 3) {
            const fade = Math.max(0, 1 - (t - 3) / 0.5);
            altarData.corpse.traverse(obj => {
                if (obj.isMesh && obj.material) obj.material.opacity = fade * 0.82;
            });
        }

        if (t >= 3.5) {
            altarData.corpse.visible = false;
            altarState = 'complete';
            _doAltarComplete();
        }
    }
}

function _doAltarComplete() {
    // White screen flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#ffffff;opacity:0.92;pointer-events:none;z-index:999;transition:opacity 1.8s';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 800);
    setTimeout(() => { flash.remove(); }, 2700);

    _createHolyGemPlatform();
}

// ── Holy Gem Platform (spawns at Y=500 above the altar) ───────────────────────

function _createHolyGemPlatform() {
    const PLATFORM_Y = 700;
    const px = altarData.worldX;
    const pz = altarData.worldZ;

    const mat = () => new THREE.MeshLambertMaterial({
        color: 0x690096, //0x9b17d4,
        emissive: 0x41005e, //0x9900DD,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.7,
        // opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const platGrp = new THREE.Group();

    // ── Large base disc (the walkable floor) ──────────────────────────────────
    const BASE_R = 45;
    const BASE_H = 2.0;
    const BASE_TOP_WORLD  = PLATFORM_Y + BASE_H / 2;    // 501.0
    const BASE_BOT_WORLD  = PLATFORM_Y - BASE_H / 2;    // 499.0
    platGrp.add(_makePlatDisc(BASE_R, BASE_H, 0, mat()));

    // bottomY = BASE_BOT_WORLD makes the base disc solid (ceiling effect from below)
    // without blocking flight from ground because the ceiling check only fires when
    // previousY <= bottomY + 0.05 — impossible while approaching from Y = 0..400.
    addRoofColliderCircle(px, pz, BASE_R, BASE_TOP_WORLD, BASE_BOT_WORLD);

    // ── Central concentric staircase ──────────────────────────────────────────
    const stepDefs = [
        { r: 18, h: 1.5 },
        { r: 13, h: 1.5 },
        { r:  8, h: 1.5 },
        { r:  5, h: 1.5 },
        { r:  2.5, h: 1.0 },
    ];

    // Disc data also stored for the dragon's getDragonSupportHeight calculation.
    const discData = [{ rSq: BASE_R * BASE_R, topY: BASE_TOP_WORLD }];

    let prevTop = BASE_H / 2;   // platGrp-local top of previous disc
    for (const s of stepDefs) {
        const cy = prevTop + s.h / 2;
        platGrp.add(_makePlatDisc(s.r, s.h, cy, mat()));
        const stepTopWorld = PLATFORM_Y + cy + s.h / 2;
        // Use BASE_BOT_WORLD as bottomY for all steps: prevents phasing from below
        // without creating false ceiling collisions when standing on a lower step
        // (ceiling check requires previousY <= BASE_BOT_WORLD + 0.05 = 499.05,
        //  which is never true when standing at 501+).
        addRoofColliderCircle(px, pz, s.r, stepTopWorld, BASE_BOT_WORLD);
        discData.push({ rSq: s.r * s.r, topY: stepTopWorld });
        prevTop = cy + s.h / 2;
    }

    platGrp.position.set(px, PLATFORM_Y, pz);
    scene.add(platGrp);

    // Store for getHolyGemPlatformHeight (dragon landing support)
    altarData.holyGemPlatform = { x: px, z: pz, discs: discData };

    _createHolyGem(px, PLATFORM_Y + prevTop + 1.8, pz);
}

function _makePlatDisc(radius, height, y, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40), mat);
    m.position.y = y;
    m.frustumCulled = false;
    return m;
}

// ── Holy Gem ──────────────────────────────────────────────────────────────────

function _createHolyGem(x, baseY, z) {
    const gemGrp = new THREE.Group();
    gemGrp.userData.ignoreCameraOcclusion = true;

    // Main gem — golden yellow
    const gemMat = new THREE.MeshPhongMaterial({
        color: 0xFFCC00,
        specular: 0xc,
        shininess: 130,
        emissive: 0x664400,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.92,
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), gemMat);
    gem.scale.y = 1.5;
    gemGrp.add(gem);

    // Inner bright core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xFFEE55, transparent: true, opacity: 0.55 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), coreMat);
    core.scale.y = 1.5;
    gemGrp.add(core);

    // Outer glow — white (as specified)
    const outerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(1.65, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 })
    );
    gemGrp.add(outerGlow);
    gemGrp.userData.outerGlow = outerGlow;

    // Point light
    const gemLight = new THREE.PointLight(0xFFDD44, 0, 35);
    gemGrp.add(gemLight);
    gemGrp.userData.pointLight = gemLight;

    // White top light following gem oscillation
    const initIntensity = 40;
    const topLight = new THREE.PointLight(0xFFFFFF, initIntensity, 75);
    topLight.position.y = 2;
    gemGrp.add(topLight);
    gemGrp.userData.topLight = topLight;
    gemGrp.userData.topLightInitIntensity = initIntensity;

    ///////////////////////////////////////////////////////////////////////////
    // [DISABLED] White bottom light following gem oscillation
    const bottomLight = new THREE.PointLight(0xFFFFFF, 15, 30);
    bottomLight.position.y = -1.35;
    // gemGrp.add(bottomLight);
    gemGrp.userData.bottomLight = bottomLight;
    ///////////////////////////////////////////////////////////////////////////

    gemGrp.position.set(x, baseY, z);
    scene.add(gemGrp);

    // Tag so camera occlusion and other systems can identify it
    gemGrp.traverse(obj => { obj.userData.isHolyGem = true; });

    holyGem = { mesh: gemGrp, x, z, baseY, rotationSpeed: 1.2, bobSpeed: 2.0, bobAmount: 0.35 };
}

function updateHolyGem(delta, time) {
    if (!holyGem || holyGemCollected) return;

    holyGem.mesh.rotation.y += holyGem.rotationSpeed * delta;
    holyGem.mesh.position.y = holyGem.baseY + Math.sin(time * holyGem.bobSpeed) * holyGem.bobAmount;

    const pulse = 0.22 + Math.sin(time * 2.6) * 0.16;
    holyGem.mesh.userData.outerGlow.material.opacity = pulse;
    holyGem.mesh.userData.pointLight.intensity = 14 + 5 * Math.sin(time * 2.6);
    holyGem.mesh.userData.topLight.intensity = holyGem.mesh.userData.topLightInitIntensity + 5 * Math.sin(time * 2.6 + 1.0);
    // holyGem.mesh.userData.bottomLight.intensity = 12 + 5 * Math.sin(time * 2.6 + 1.0);  // DISABLED

    const dx = player.position.x - holyGem.x;
    const dz = player.position.z - holyGem.z;
    const dy = player.position.y - holyGem.mesh.position.y;
    if (Math.sqrt(dx * dx + dz * dz + dy * dy) < GEM_COLLECTION_RADIUS) {
        collectHolyGem();
    }
}

function collectHolyGem() {
    holyGemCollected = true;

    const gemWorldPos = holyGem.mesh.position.clone();
    scene.remove(holyGem.mesh);
    updateMenuPanels();

    // Particle burst
    const particles = new THREE.Group();
    particles.userData.ignoreCameraOcclusion = true;
    for (let i = 0; i < 35; i++) {
        const pm = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.24, 0),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.45 ? 0xfff700 : 0xFFFFFF, transparent: true, opacity: 1 })
        );
        pm.position.copy(gemWorldPos);
        pm.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 18,
            Math.random() * 14,
            (Math.random() - 0.5) * 18
        );
        particles.add(pm);
    }
    scene.add(particles);

    let life = 0;
    const animate = () => {
        life += 0.016;
        particles.children.forEach(p => {
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
            p.userData.velocity.y -= 12 * 0.016;
            p.material.opacity = Math.max(0, 1 - life);
        });
        if (life < 2) requestAnimationFrame(animate);
        else scene.remove(particles);
    };
    animate();

    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg,#FFD700,#FFFFFF);opacity:0.78;pointer-events:none;z-index:1000;transition:opacity 1s';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 100);
    setTimeout(() => { flash.remove(); }, 1100);
}

// ── Dragon support height for the holy gem platform ───────────────────────────
// Called at runtime by getDragonSupportHeight / getDragonSupportHeightBelow in
// environment.js. Returns the highest disc top at (x, z), or -Infinity if the
// platform hasn't spawned yet or (x, z) is outside all disc radii.
function getHolyGemPlatformHeight(x, z) {
    if (!altarData || !altarData.holyGemPlatform) return -Infinity;
    const p = altarData.holyGemPlatform;
    const dx = x - p.x, dz = z - p.z;
    const distSq = dx * dx + dz * dz;
    let best = -Infinity;
    for (const disc of p.discs) {
        if (distSq <= disc.rSq) best = Math.max(best, disc.topY);
    }
    return best;
}
