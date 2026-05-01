// ── Night Creature & Cemetery Zombie System ──────────────────────────────────

const CREATURE_SPEED          = 0.9 * WALK_SPEED;//0.3 * RUN_SPEED;//0.6 * RUN_SPEED;
const CEMETERY_ZOMBIE_SPEED   = 0.3 * WALK_SPEED;  // each zombie gets ±20% noise on top
const OUTER_BAND_MIN_RADIUS   = 2100;  // beyond outer mountain ring
const WEEPING_ANGEL_LOCK_DIST = 30;    // within this dist, angel never freezes
const WEEPING_ANGEL_BODY_MARGIN = 0.08; // radians (~4.6°) added beyond screen edge to account for angel wing span
const CREATURE_SPAWN_INTERVAL  = 10;   // seconds
const CREATURE_SPAWN_DIST      = 500; // units from player
const CREATURE_HIT_DAMAGE      = DEBUG_CREATURES || DEBUG_CREATURES_2 || DEBUG_CREATURES_FREEZE ? 0 : 30;
const CREATURE_HIT_COOLDOWN    = 0.9;
const CREATURE_MAX_HP          = 5;    // AK47 shots to kill
const CREATURE_HEALTH_REGEN    = 5;    // %/sec outside demon apocalypse
const CEMETERY_ZOMBIE_DELAY    = 30;   // sec after talisman pickup
const CEMETERY_ZOMBIE_COUNT    = 10;
const CEMETERY_ZOMBIE_EMERGE_SEC = 3.0;
const CEMETERY_ZOMBIE_HEIGHT   = 5.0;  // how far below ground they start

const SPOTLIGHT              = false;  // attach a dim white point light above each creature

const CREATURE_BODY_COLOR    = 0x802f26;
const CRAWLER_COLOR          = 0x290d0d;//0x331111; //0x080808;
const WEEPING_ANGEL_COLOR    = 0x6c918e; //0x89b0ac;

let nightCreatures        = [];
let _ncSpawnUnlocked      = false;
let _ncWasNight           = false;
let _ncSpawnTimer         = CREATURE_SPAWN_INTERVAL;
let _cemZombieCountdown   = -1;    // -1 = not started; ≥0 = seconds until emergence
let _cemZombiesSpawned    = false;
let _ncFreezeSpawned      = false;
let _ncDebugCircleSpawned = false;
let _ncSepFrame           = 0;
let _preSequenceGameTime  = -1;   // gameTime saved just before zombie sequence transitions to night
let _nightTransitionTimer = -1;   // counts down to delayed night transition; -1 = inactive
let _ncOpenWorldSpawned   = 0;    // total open-world creatures spawned; first two are forced crawlers

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPlayerInOuterBand() {
    return Math.hypot(player.position.x, player.position.z) >= OUTER_BAND_MIN_RADIUS;
}

// ── Mesh builders ─────────────────────────────────────────────────────────────

function _buildZombieMesh() {
    const g = new THREE.Group();
    const S = 0.87;  // same scale as altar corpse
    const mat    = new THREE.MeshLambertMaterial({ color: CREATURE_BODY_COLOR });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Vertical tapered cylinder — mirrors altar's _makeHorizCylinder but upright
    // rBot = radius at lower end (foot/wrist), rTop = radius at upper end (hip/shoulder)
    const vCyl = (x, yBot, yTop, z, rBot, rTop) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, yTop - yBot, 7), mat);
        m.position.set(x, (yBot + yTop) / 2, z);
        m.castShadow = true;
        return m;
    };

    // Forward-pointing tapered cylinder along +Z
    // rBack = radius at body end (shoulder), rFront = radius at far end (wrist)
    const fwdCyl = (x, y, zStart, zEnd, rBack, rFront) => {
        const len = zEnd - zStart;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rFront, rBack, len, 7), mat);
        m.position.set(x, y, (zStart + zEnd) / 2);
        m.rotation.x = Math.PI / 2;
        m.castShadow = true;
        return m;
    };

    // Coordinate mapping: altar_z → zombie_y via zombie_y = altar_z + 2.1*S (1.827)
    // Legs — altar: hip z1=-0.5*S→y=1.39, foot z2=-2.1*S→y=0; r=0.16 hip, r*0.8=0.128 ankle
    for (const side of [-1, 1]) {
        g.add(vCyl(side * 0.3 * S, 0, 1.39, 0, 0.128, 0.16));
    }

    // Torso — altar: BoxGeometry(0.9*S, 0.35, 2.0*S) at z=0.2*S
    //          standing: BoxGeometry(0.9*S, 2.0*S, 0.35) at y=0.2*S+1.827=2.00
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * S, 2.0 * S, 0.35), mat);
    torso.position.set(0, 2.00, 0);
    torso.castShadow = true;
    g.add(torso);

    // Neck — altar: z1=1.05*S→y=2.74, z2=1.35*S→y=3.00; wider at torso end (0.13), narrower at head (0.10)
    g.add(vCyl(0, 2.74, 3.00, 0, 0.13, 0.10));

    // Head — altar: SphereGeometry(0.38*S) at z=1.6*S → y=1.392+1.827=3.22
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38 * S, 10, 8), mat);
    head.position.set(0, 3.22, 0);
    head.scale.x = 0.85;
    head.scale.y = 1.07;
    head.castShadow = true;
    g.add(head);

    // Eyes — altar: radius 0.07 (hidden by default); slightly smaller here since white is always visible
    //         altar eyeY offset of 0.25 (altar's Y = perpendicular to slab) → forward Z on standing zombie
    const eyeZ = 0.38 * S * 0.88;
    for (const ex of [-0.10, 0.10]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), eyeMat);
        eye.position.set(ex, 3.25, eyeZ);
        eye.userData.isEye = true;
        g.add(eye);
    }

    // Arms — altar: shoulder z1=1.0*S→y=2.70; r=0.14 body / r*0.8=0.112 wrist; re-pointed forward (+Z)
    for (const side of [-1, 1]) {
        g.add(fwdCyl(side * 0.4 * S, 2.70, 0.18, 1.95, 0.14, 0.14 * 0.8));
    }

    return g;
}

function _buildCrawlerMesh() {
    const g = new THREE.Group();
    const mat    = new THREE.MeshLambertMaterial({ color: CRAWLER_COLOR });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xcc3300 });

    // Helper: aligned box segment between two local points
    const seg = (p1, p2, thick) => {
        const [x1, y1, z1] = p1, [x2, y2, z2] = p2;
        const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), mat);
        m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
        m.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(dx, dy, dz).normalize()
        );
        m.castShadow = true;
        return m;
    };

    // ── Claw builder (arms and legs) ─────────────────────────────────────────────
    // anchor: [x,y,z] in targetGrp local space (hand or foot tip position)
    // forward: THREE.Vector3 base direction claws extend from (normalized)
    // side: -1|+1 determines which side the thumb is on (always the inside)
    const addFingers = (targetGrp, anchor, forward, side) => {
        const up = new THREE.Vector3(0, 1, 0);
        // Rotating forward around rightAxis by a positive angle curls the claw downward
        const rightAxis = new THREE.Vector3().crossVectors(up, forward).normalize();

        const buildFinger = (baseDir, segLens, radii, bendPerSeg) => {
            let cur = new THREE.Vector3(...anchor);
            let d   = baseDir.clone().normalize();
            for (let si = 0; si < segLens.length; si++) {
                const cyl = new THREE.Mesh(
                    new THREE.CylinderGeometry(radii[si + 1], radii[si], segLens[si], 5),
                    mat
                );
                cyl.position.copy(cur.clone().addScaledVector(d, segLens[si] * 0.5));
                cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
                cyl.castShadow = true;
                targetGrp.add(cyl);
                cur.addScaledVector(d, segLens[si]);
                d.applyAxisAngle(rightAxis, bendPerSeg).normalize();
            }
        };

        // 4 fingers fanned to the outside; thumb on the inside
        const fLens  = [0.38, 0.28, 0.20];
        const fRadii = [0.055, 0.033, 0.015, 0.003];
        for (const fa of [side * 0.07, side * 0.25, side * 0.45, side * 0.65]) {
            const dir = forward.clone().applyAxisAngle(up, fa);
            dir.y -= 0.05;
            buildFinger(dir, fLens, fRadii, 0.18);
        }
        // Thumb: inside, shorter, angled slightly upward, less curled
        const thumbDir = forward.clone().applyAxisAngle(up, -side * 0.52);
        thumbDir.y += 0.20;
        buildFinger(thumbDir, [0.20, 0.14, 0.09], [0.065, 0.042, 0.022, 0.004], 0.10);
    };

    // ── Torso (horizontal slab, low, chest facing down) ───────────────────────
    // Spans from hip-end (z≈-0.55) to shoulder-end (z≈1.05)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.42, 2.10), mat);
    torso.position.set(0, 0.66, 0.25);
    torso.castShadow = true;
    g.add(torso);

    // Neck connecting torso to head
    g.add(seg([0, 0.68, 1.05], [0, 0.82, 1.68], 0.24));

    // ── Head (tall oval) ──────────────────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), mat);
    head.scale.set(0.75, 1.35, 0.85);
    head.position.set(0, 0.86, 1.95);
    head.castShadow = true;
    g.add(head);

    // Red eyes (beady)
    for (const ex of [-0.16, 0.16]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), eyeMat);
        eye.position.set(ex, 0.94, 2.2);
        g.add(eye);
    }

    // ── Arms (pivot at shoulder, elbow sticks high) ───────────────────────────
    // Shoulder → elbow goes UP and slightly out; elbow → hand goes DOWN and forward.
    // Keypoints (creature local space, y=0 is ground):
    //   Shoulder: (±0.28, 0.68, 0.88)
    //   Elbow:    (±0.85, 2.05, 0.50)   ← high
    //   Hand:     (±0.70, 0.05, 1.90)   ← on ground, forward

    const limbs = [];
    for (const side of [-1, 1]) {
        const shldr = [side * 0.28, 0.68, 0.88];
        const elbow = [side * 0.85, 2.05, 0.50];
        const hand  = [side * 0.70, 0.05, 1.90];

        const grp = new THREE.Group();
        grp.position.set(...shldr);

        grp.add(seg([0,0,0],
            [elbow[0]-shldr[0], elbow[1]-shldr[1], elbow[2]-shldr[2]], 0.22));
        grp.add(seg(
            [elbow[0]-shldr[0], elbow[1]-shldr[1], elbow[2]-shldr[2]],
            [hand[0]-shldr[0],  hand[1]-shldr[1],  hand[2]-shldr[2]],  0.18));

        const knob = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), mat);
        knob.position.set(hand[0]-shldr[0], hand[1]-shldr[1], hand[2]-shldr[2]);
        grp.add(knob);
        addFingers(grp, [hand[0]-shldr[0], hand[1]-shldr[1], hand[2]-shldr[2]], new THREE.Vector3(0, 0, 1), side);

        g.add(grp);
        limbs.push(grp); // indices 0 (left), 1 (right)
    }

    // ── Legs (pivot at hip, knee bends backward/upward, foot lands forward) ───
    // Hip → knee goes BACKWARD and UP; knee → foot goes FORWARD and DOWN.
    // Keypoints:
    //   Hip:  (±0.22, 0.62, -0.55)
    //   Knee: (±0.42, 1.90, -1.75)   ← high and backward
    //   Foot: (±0.46, 0.05, -0.22)   ← on ground, forward of hip

    for (const side of [-1, 1]) {
        const hip  = [side * 0.22, 0.62, -0.55];
        const knee = [side * 0.42, 1.90, -1.75];
        const foot = [side * 0.46, 0.05, -0.22];

        const grp = new THREE.Group();
        grp.position.set(...hip);

        grp.add(seg([0,0,0],
            [knee[0]-hip[0], knee[1]-hip[1], knee[2]-hip[2]], 0.24));
        grp.add(seg(
            [knee[0]-hip[0], knee[1]-hip[1], knee[2]-hip[2]],
            [foot[0]-hip[0], foot[1]-hip[1], foot[2]-hip[2]], 0.20));

        const footPad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.36), mat);
        footPad.position.set(foot[0]-hip[0], foot[1]-hip[1], foot[2]-hip[2]);
        grp.add(footPad);
        addFingers(grp, [foot[0]-hip[0], foot[1]-hip[1], foot[2]-hip[2]], new THREE.Vector3(0, 0, 1), side);

        g.add(grp);
        limbs.push(grp); // indices 2 (left), 3 (right)
    }

    // limbs order: [leftArm, rightArm, leftLeg, rightLeg]
    g.userData.crawlerLimbs    = limbs;
    g.userData.crawlerLegPhase = Math.random() * Math.PI * 2;
    return g;
}

function _buildWeepingAngelMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: WEEPING_ANGEL_COLOR });
    // const mat = new THREE.MeshLambertMaterial({ color: 0x89b0ac });

    // Dress (tapered skirt)
    const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.72, 2.0, 10), mat);
    dress.position.set(0, 1.0, 0);
    g.add(dress);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), mat);
    torso.position.set(0, 2.30, 0);
    g.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 10, 9), mat);
    head.position.set(0, 3.06, 0);
    g.add(head);

    // Wavy side hair (2 segments per side)
    for (const side of [-1, 1]) {
        // Upper strand — hangs from temple, leans slightly outward
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.17), mat);
        upper.position.set(side * 0.31, 2.82, 0.02);
        upper.rotation.z = side * 0.18;
        g.add(upper);

        // Lower curl — continues down and curves slightly inward and forward
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.40, 0.16), mat);
        lower.position.set(side * 0.35, 2.46, 0.07);
        lower.rotation.z = side * -0.22;
        lower.rotation.x = 0.20;
        g.add(lower);
    }

    // Shoulder bar — spans upper back connecting both wing roots
    const shoulderBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.17, 0.16), mat);
    shoulderBar.position.set(0, 2.45, -0.19);
    g.add(shoulderBar);

    // Shoulder blades — angled plates bridging torso sides to shoulder bar
    for (const side of [-1, 1]) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.44, 0.22), mat);
        blade.position.set(side * 0.48, 2.30, -0.21);
        blade.rotation.z = side * 0.28;
        g.add(blade);
    }

    // Wings
    for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.70, 0.40), mat);
        wing.position.set(side * 0.68, 1.60, -0.12);
        wing.rotation.z = side * 0.32;
        g.add(wing);

        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.88, 0.30), mat);
        tip.position.set(side * 1.06, 0.90, -0.12);
        tip.rotation.z = side * 0.58;
        g.add(tip);
    }

    return g;
}

// ── Spawn ─────────────────────────────────────────────────────────────────────

function _spawnNightCreature(type, x, z) {
    const groundY = getMoverSurfaceHeight(x, z, false);

    let mesh, gunHitCenterY, gunHitRadius;
    if (type === 'zombie') {
        mesh = _buildZombieMesh();
        gunHitCenterY = 1.4;
        gunHitRadius  = 0.80;
    } else if (type === 'crawler') {
        mesh = _buildCrawlerMesh();
        gunHitCenterY = 0.30;
        gunHitRadius  = 0.75;
    } else { // 'angel'
        mesh = _buildWeepingAngelMesh();
        gunHitCenterY = 1.80;
        gunHitRadius  = 0.85;
    }

    mesh.userData.ignoreCameraOcclusion = true;

    if (SPOTLIGHT) {
        const light = new THREE.PointLight(0xffffff, 1.2, 20);
        light.position.set(0, 5, 0);
        mesh.add(light);
    }

    mesh.position.set(x, groundY, z);
    scene.add(mesh);

    nightCreatures.push({
        type,
        mesh,
        hp:           CREATURE_MAX_HP,
        hitCooldown:  0,
        gunHitCenterY,
        gunHitRadius,
        isCemZombie:  false,
        speed:        CREATURE_SPEED,
        emergeTimer:  0,
        emergeStartY: groundY,
        emergeTargetY: groundY,
    });
}

function _spawnDebugCreatureCircle() {
    if (_ncDebugCircleSpawned) return;
    _ncDebugCircleSpawned = true;

    const types = ['zombie', 'crawler', 'angel'];
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        let sx = player.position.x + Math.cos(angle) * 150;
        let sz = player.position.z + Math.sin(angle) * 150;
        sx = Math.max(-(WORLD_SIZE - 150), Math.min(WORLD_SIZE - 150, sx));
        sz = Math.max(-(WORLD_SIZE - 150), Math.min(WORLD_SIZE - 150, sz));
        _spawnNightCreature(types[Math.floor(Math.random() * types.length)], sx, sz);
    }
}

// ── Effects ───────────────────────────────────────────────────────────────────

function _explodeCreature(creature) {
    const pos = creature.mesh.position.clone();
    scene.remove(creature.mesh);

    const colorMap = {
        zombie: [CREATURE_BODY_COLOR, 0x5a1f18, 0xffffff],
        crawler: [CRAWLER_COLOR, 0x333333, 0x550000],
        angel: [WEEPING_ANGEL_COLOR, 0xadd8d2, 0xffffff],
    };
    const colors = colorMap[creature.type] || [CREATURE_BODY_COLOR, 0x5a1f18, 0xffffff];

    const particles = new THREE.Group();
    for (let i = 0; i < 25; i++) {
        const size = 0.1 + Math.random() * 0.3;
        const geo = Math.random() > 0.5
            ? new THREE.BoxGeometry(size, size, size)
            : new THREE.SphereGeometry(size * 0.5, 4, 4);
        const p = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
            color: colors[Math.floor(Math.random() * colors.length)]
        }));
        p.position.copy(pos);
        p.position.y += 1;
        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 12 + 5,
            (Math.random() - 0.5) * 15
        );
        p.userData.rotSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        particles.add(p);
    }
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.5, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide })
    );
    ring.position.copy(pos);
    ring.position.y += 1;
    ring.rotation.x = -Math.PI / 2;
    ring.userData.ignoreCameraOcclusion = true;
    particles.userData.ignoreCameraOcclusion = true;
    scene.add(ring);
    scene.add(particles);

    let t = 0;
    const anim = () => {
        t += 0.016;
        particles.children.forEach(p => {
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
            p.userData.velocity.y -= 20 * 0.016;
            p.rotation.x += p.userData.rotSpeed.x * 0.016;
            p.rotation.y += p.userData.rotSpeed.y * 0.016;
            p.rotation.z += p.userData.rotSpeed.z * 0.016;
            p.material.transparent = true;
            p.material.opacity = Math.max(0, 1 - t * 0.8);
            const sc = Math.max(0.1, 1 - t * 0.5);
            p.scale.set(sc, sc, sc);
        });
        const rs = 1 + t * 8;
        ring.scale.set(rs, rs, 1);
        ring.material.opacity = Math.max(0, 1 - t * 2);
        if (t < 2) requestAnimationFrame(anim);
        else { scene.remove(particles); scene.remove(ring); }
    };
    requestAnimationFrame(anim);
}

function _fadeCemZombieOut(mesh) {
    const fadeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85
    });
    mesh.traverse(m => {
        if (m.isMesh) {
            if (m.userData.isEye) { m.visible = false; return; }
            m.material = fadeMat;
        }
    });

    const startY = mesh.position.y;
    let elapsed = 0;
    const anim = () => {
        elapsed += 0.035;
        const t = Math.min(elapsed / 2.0, 1);
        fadeMat.opacity = 0.85 * (1 - t);
        mesh.position.y = startY + 5 * t;
        if (t < 1) requestAnimationFrame(anim);
        else scene.remove(mesh);
    };
    requestAnimationFrame(anim);
}

function _spawnHitParticles(pos) {
    const colors = [0x802f26, 0xff2200, 0x000000];
    const particles = new THREE.Group();
    for (let i = 0; i < 12; i++) {
        const size = 0.12 + Math.random() * 0.18;
        const p = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
        );
        p.position.copy(pos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 1.0, Math.random() * 0.8, (Math.random() - 0.5) * 1.0
        ));
        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10, Math.random() * 6 + 2, (Math.random() - 0.5) * 10
        );
        particles.add(p);
    }
    particles.userData.ignoreCameraOcclusion = true;
    scene.add(particles);
    let t = 0;
    const anim = () => {
        t += 0.016;
        particles.children.forEach(p => {
            p.position.addScaledVector(p.userData.velocity, 0.016);
            p.userData.velocity.y -= 20 * 0.016;
            p.material.transparent = true;
            p.material.opacity = Math.max(0, 1 - t * 2.5);
        });
        if (t < 0.7) requestAnimationFrame(anim);
        else scene.remove(particles);
    };
    requestAnimationFrame(anim);
}

// ── Kill ──────────────────────────────────────────────────────────────────────

function _unlockCemeteryGates() {
    if (!cemeteryData) return;
    cemeteryData.gatesLocked  = false;
    cemeteryData.gateTargetL  = cemeteryData.gateOpenL;
    cemeteryData.gateTargetR  = cemeteryData.gateOpenR;
    cemeteryData.gateWall.active = false;
    _ncSpawnUnlocked = true;
    if (_preSequenceGameTime >= 0) {
        startDayNightTransition(_preSequenceGameTime / FULL_CYCLE, 3);
        _preSequenceGameTime = -1;
    }
}

function _killCreature(creature) {
    const idx = nightCreatures.indexOf(creature);
    if (idx === -1) return;
    nightCreatures.splice(idx, 1);
    recordKill(creature.isCemZombie ? 'cemetery_zombie' : creature.type);
    updateStats();
    if (creature.isCemZombie) {
        _fadeCemZombieOut(creature.mesh);
        // Unlock gates once the last cemetery zombie is dead
        if (_cemZombiesSpawned && !nightCreatures.some(c => c.isCemZombie)) {
            _unlockCemeteryGates();
        }
    } else {
        _explodeCreature(creature);
    }
}

function killAllNightCreatures() {
    const creaturesToKill = nightCreatures.slice();
    for (const creature of creaturesToKill) {
        if (nightCreatures.includes(creature)) _killCreature(creature);
    }
}

// ── Public API: weapon integration ───────────────────────────────────────────

const _creatureGunRaycaster = new THREE.Raycaster();

function getCreatureGunHits(aimDir, maxRange = AK47_BEAM_MAX_VISUAL_RANGE) {
    const activeCreatures = nightCreatures.filter(c => c.emergeTimer <= 0);
    if (activeCreatures.length === 0) return [];

    const creatureByRoot = new Map();
    const roots = [];
    for (const c of activeCreatures) {
        creatureByRoot.set(c.mesh.uuid, c);
        roots.push(c.mesh);
    }

    _creatureGunRaycaster.set(camera.position, aimDir);
    _creatureGunRaycaster.near = 0;
    _creatureGunRaycaster.far = maxRange;

    const hits = [];
    const seen = new Set();
    const rayHits = _creatureGunRaycaster.intersectObjects(roots, true);
    for (const hit of rayHits) {
        let node = hit.object;
        let creature = null;
        while (node) {
            creature = creatureByRoot.get(node.uuid);
            if (creature) break;
            node = node.parent;
        }
        if (!creature || seen.has(creature)) continue;
        seen.add(creature);
        hits.push({ kind: 'creature', target: creature, projected: hit.distance });
    }

    if (hits.length > 0) return hits;

    // Fallback to the old hit-sphere approximation for near misses.
    const hitPoint = new THREE.Vector3();
    for (const c of nightCreatures) {
        if (c.emergeTimer > 0 || seen.has(c)) continue;
        hitPoint.set(
            c.mesh.position.x,
            c.mesh.position.y + c.gunHitCenterY,
            c.mesh.position.z
        );
        const toC      = hitPoint.clone().sub(camera.position);
        const proj     = toC.dot(aimDir);
        if (proj <= 0 || proj > maxRange) continue;
        const perp = toC.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
        if (perp <= c.gunHitRadius) {
            hits.push({ kind: 'creature', target: c, projected: proj + 0.001 });
        }
    }
    return hits;
}

function damageCreatureFromGun(creature) {
    if (!creature || !nightCreatures.includes(creature)) return false;

    creature.hp--;
    if (creature.hp <= 0) {
        _killCreature(creature);
    } else {
        const hitPoint = creature.mesh.position.clone();
        hitPoint.y += creature.gunHitCenterY;
        _spawnHitParticles(hitPoint);
    }
    return true;
}

function getMeleeCreatureCandidates(aimDir, punchRange) {
    const candidates = [];
    const hitPoint = new THREE.Vector3();
    for (const c of nightCreatures) {
        if (c.emergeTimer > 0) continue;
        hitPoint.set(
            c.mesh.position.x,
            c.mesh.position.y + c.gunHitCenterY,
            c.mesh.position.z
        );
        const toC  = hitPoint.clone().sub(camera.position);
        const proj = toC.dot(aimDir);
        if (proj <= 0 || proj > punchRange) continue;
        const perp = toC.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
        if (perp <= c.gunHitRadius + 1.5) {
            candidates.push({ creature: c, dist: proj });
        }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates;
}

function meleeHitCreature(creature) {
    creature.hp--;
    const hitPos = creature.mesh.position.clone();
    hitPos.y += creature.gunHitCenterY;
    if (creature.hp <= 0) {
        _killCreature(creature);
    } else {
        _spawnHitParticles(hitPos);
    }
}

function lightningAoeKillCreatures(centerPos, radius) {
    for (let i = nightCreatures.length - 1; i >= 0; i--) {
        if (nightCreatures[i].mesh.position.distanceTo(centerPos) <= radius) {
            _killCreature(nightCreatures[i]);
        }
    }
}

// ── Cemetery zombie sequence ──────────────────────────────────────────────────

function startCemeteryZombieSequence() {
    if (_cemZombiesSpawned || _cemZombieCountdown >= 0) return;
    _cemZombieCountdown = CEMETERY_ZOMBIE_DELAY;
}

function _spawnCemeteryZombies() {
    if (!cemeteryData || !cemeteryData.gravePositions || cemeteryData.gravePositions.length === 0) return;

    _preSequenceGameTime  = gameTime;
    _nightTransitionTimer = 1.0; // start transition 1 second after zombies begin emerging

    const shuffled = cemeteryData.gravePositions.slice().sort(() => Math.random() - 0.5);
    const chosen   = shuffled.slice(0, Math.min(CEMETERY_ZOMBIE_COUNT, shuffled.length));

    for (const gp of chosen) {
        const worldPos = localToWorldXZ(
            cemeteryData.worldX, cemeteryData.worldZ,
            gp.localX, gp.localZ,
            cemeteryData.rotation
        );
        const groundY  = cemeteryData.worldGroundY;
        const startY   = groundY - CEMETERY_ZOMBIE_HEIGHT;

        const mesh = _buildZombieMesh();
        mesh.userData.ignoreCameraOcclusion = true;
        mesh.position.set(worldPos.x, startY, worldPos.z);
        scene.add(mesh);

        nightCreatures.push({
            type:         'zombie',
            mesh,
            hp:           CREATURE_MAX_HP,
            hitCooldown:  0,
            gunHitCenterY: 1.4,
            gunHitRadius:  0.80,
            isCemZombie:  true,
            speed:        CEMETERY_ZOMBIE_SPEED * (1 + (Math.random() * 0.4 - 0.2)), // ±20% noise
            emergeTimer:  CEMETERY_ZOMBIE_EMERGE_SEC,
            emergeStartY: startY,
            emergeTargetY: groundY,
        });
    }
}

// ── Cemetery bounds clamp ─────────────────────────────────────────────────────

// Hard containment: ensures cemetery zombies can never escape the perimeter
// regardless of what the wall-collision system does. Runs as a secondary safety
// net after every move and every separation step.
function _clampToCemeteryBounds(c) {
    if (!c.isCemZombie || !cemeteryData) return;
    const MARGIN = 0.6; // creature radius (0.5) + small buffer
    const local = worldToLocalXZ(
        c.mesh.position.x, c.mesh.position.z,
        cemeteryData.worldX, cemeteryData.worldZ,
        cemeteryData.rotation
    );
    const cx = Math.max(-(CEM_HALF - MARGIN), Math.min(CEM_HALF - MARGIN, local.x));
    const cz = Math.max(-(CEM_HALF - MARGIN), Math.min(CEM_HALF - MARGIN, local.z));
    if (cx !== local.x || cz !== local.z) {
        const world = localToWorldXZ(
            cemeteryData.worldX, cemeteryData.worldZ,
            cx, cz,
            cemeteryData.rotation
        );
        c.mesh.position.x = world.x;
        c.mesh.position.z = world.z;
    }
}

function _isPointInCreatureHouseRegion(x, z, region) {
    const local = worldToLocalXZ(x, z, region.x, region.z, region.rotation || 0);
    const localZ = local.z - (region.centerLocalZ || 0);
    return Math.abs(local.x) <= region.halfW && Math.abs(localZ) <= region.halfD;
}

function _isPointInCreatureEntryBand(x, z, region) {
    const local = worldToLocalXZ(
        x,
        z,
        region.entryX ?? region.doorwayX,
        region.entryZ ?? region.doorwayZ,
        region.rotation || 0
    );
    const halfW = region.entryHalfW ?? region.doorwayHalfW;
    const halfD = region.entryHalfD ?? region.doorwayHalfD;
    return Math.abs(local.x) <= halfW && Math.abs(local.z) <= halfD;
}

function _isPointInCreatureHouseDoorway(x, z, region) {
    return _isPointInCreatureEntryBand(x, z, region);
}

function _isPointInCreatureCaveRegion(x, z, region) {
    const local = worldToLocalXZ(x, z, region.x, region.z, region.rotation || 0);
    const localZ = local.z - (region.centerLocalZ || 0);
    return Math.abs(local.x) <= region.halfW && Math.abs(localZ) <= region.halfD;
}

function _isPointInCreatureCaveEntry(x, z, region) {
    return _isPointInCreatureEntryBand(x, z, region);
}

function _isPointInCreatureCemeteryRegion(x, z, region) {
    const local = worldToLocalXZ(x, z, region.x, region.z, region.rotation || 0);
    return Math.abs(local.x) <= region.halfW && Math.abs(local.z) <= region.halfD;
}

function _isPointInCreatureCemeteryEntry(x, z, region) {
    return _isPointInCreatureEntryBand(x, z, region);
}

function _syncCreatureHouseRegion(c) {
    c.houseRegion = null;
    for (const region of creatureHouseRegions) {
        if (_isPointInCreatureHouseRegion(c.mesh.position.x, c.mesh.position.z, region)) {
            c.houseRegion = region;
            return;
        }
    }
}

function _syncCreatureCaveRegion(c) {
    c.caveRegion = null;
    for (const region of creatureCaveRegions) {
        if (_isPointInCreatureCaveRegion(c.mesh.position.x, c.mesh.position.z, region)) {
            c.caveRegion = region;
            return;
        }
    }
}

function _syncCreatureCemeteryRegion(c) {
    c.cemeteryRegion = null;
    if (c.isCemZombie) return;
    for (const region of creatureCemeteryRegions) {
        if (_isPointInCreatureCemeteryRegion(c.mesh.position.x, c.mesh.position.z, region)) {
            c.cemeteryRegion = region;
            return;
        }
    }
}

function _enforceCreatureHouseRegions(c, prevXZ) {
    if (!creatureHouseRegions.length) return true;

    for (const region of creatureHouseRegions) {
        const wasInside = _isPointInCreatureHouseRegion(prevXZ.x, prevXZ.z, region);
        const isInside  = _isPointInCreatureHouseRegion(c.mesh.position.x, c.mesh.position.z, region);
        if (!wasInside && !isInside) continue;

        if (wasInside && !isInside) {
            if (c.houseRegion === region) c.houseRegion = null;
            continue;
        }

        if (wasInside && isInside) {
            c.houseRegion = region;
            continue;
        }

        if (isEntityAboveEnclosureBarrier(region, c.mesh.position.y)) {
            c.houseRegion = isInside ? region : null;
            continue;
        }

        const doorOpen = region.door?.isOpen || region.door?.wallEntry?.active === false;
        const enteringThroughDoorway = doorOpen && _isPointInCreatureHouseDoorway(c.mesh.position.x, c.mesh.position.z, region);
        if (enteringThroughDoorway) {
            c.houseRegion = region;
            return true;
        } else {
            c.mesh.position.x = prevXZ.x;
            c.mesh.position.z = prevXZ.z;
            if (c.houseRegion === region) c.houseRegion = null;
            return false;
        }
    }

    if (c.houseRegion && !_isPointInCreatureHouseRegion(c.mesh.position.x, c.mesh.position.z, c.houseRegion)) {
        c.houseRegion = null;
    }
    return true;
}

function _enforceCreatureCemeteryRegions(c, prevXZ) {
    if (c.isCemZombie || !creatureCemeteryRegions.length) return true;

    for (const region of creatureCemeteryRegions) {
        const wasInside = _isPointInCreatureCemeteryRegion(prevXZ.x, prevXZ.z, region);
        const isInside  = _isPointInCreatureCemeteryRegion(c.mesh.position.x, c.mesh.position.z, region);
        if (!wasInside && !isInside) continue;

        if (wasInside && !isInside) {
            if (c.cemeteryRegion === region) c.cemeteryRegion = null;
            continue;
        }

        if (wasInside && isInside) {
            c.cemeteryRegion = region;
            continue;
        }

        if (isEntityAboveEnclosureBarrier(region, c.mesh.position.y)) {
            c.cemeteryRegion = isInside ? region : null;
            continue;
        }

        const gateOpen = region.gateWall?.active === false;
        const enteringThroughGate = gateOpen && _isPointInCreatureCemeteryEntry(c.mesh.position.x, c.mesh.position.z, region);
        if (enteringThroughGate) {
            c.cemeteryRegion = region;
            return true;
        } else {
            c.mesh.position.x = prevXZ.x;
            c.mesh.position.z = prevXZ.z;
            if (c.cemeteryRegion === region) c.cemeteryRegion = null;
            return false;
        }
    }

    if (c.cemeteryRegion && !_isPointInCreatureCemeteryRegion(c.mesh.position.x, c.mesh.position.z, c.cemeteryRegion)) {
        c.cemeteryRegion = null;
    }
    return true;
}

function _enforceCreatureCaveRegions(c, prevXZ) {
    if (!creatureCaveRegions.length) return true;

    for (const region of creatureCaveRegions) {
        const wasInside = _isPointInCreatureCaveRegion(prevXZ.x, prevXZ.z, region);
        const isInside  = _isPointInCreatureCaveRegion(c.mesh.position.x, c.mesh.position.z, region);
        if (!wasInside && !isInside) continue;

        if (wasInside && !isInside) {
            if (c.caveRegion === region) c.caveRegion = null;
            continue;
        }

        if (wasInside && isInside) {
            c.caveRegion = region;
            continue;
        }

        if (isEntityAboveEnclosureBarrier(region, c.mesh.position.y)) {
            c.caveRegion = isInside ? region : null;
            continue;
        }

        if (_isPointInCreatureCaveEntry(c.mesh.position.x, c.mesh.position.z, region)) {
            c.caveRegion = region;
            return true;
        } else {
            c.mesh.position.x = prevXZ.x;
            c.mesh.position.z = prevXZ.z;
            if (c.caveRegion === region) c.caveRegion = null;
            return false;
        }
    }

    if (c.caveRegion && !_isPointInCreatureCaveRegion(c.mesh.position.x, c.mesh.position.z, c.caveRegion)) {
        c.caveRegion = null;
    }
    return true;
}

function _snapshotCreatureRegionState(c) {
    return { houseRegion: c.houseRegion, caveRegion: c.caveRegion, cemeteryRegion: c.cemeteryRegion };
}

function _restoreCreatureRegionState(c, state) {
    c.houseRegion = state.houseRegion;
    c.caveRegion = state.caveRegion;
    c.cemeteryRegion = state.cemeteryRegion;
}

function _tryCreatureStep(c, prevXZ, stepX, stepZ) {
    c.mesh.position.x = prevXZ.x + stepX;
    c.mesh.position.z = prevXZ.z + stepZ;

    resolveCircularEntityWallOverlaps(c.mesh.position, c.mesh.position.y, 0.5, 3, prevXZ);
    _clampToCemeteryBounds(c);
    if (!_enforceCreatureHouseRegions(c, prevXZ)) return false;
    if (!_enforceCreatureCaveRegions(c, prevXZ)) return false;
    if (!_enforceCreatureCemeteryRegions(c, prevXZ)) return false;
    return true;
}

function _moveCreatureStepWithSlide(c, stepX, stepZ) {
    const prevXZ = { x: c.mesh.position.x, z: c.mesh.position.z };
    const prevState = _snapshotCreatureRegionState(c);

    if (_tryCreatureStep(c, prevXZ, stepX, stepZ)) return;

    const candidates = [];
    for (const [axisX, axisZ] of [[stepX, 0], [0, stepZ]]) {
        if (Math.abs(axisX) < 1e-6 && Math.abs(axisZ) < 1e-6) continue;

        c.mesh.position.x = prevXZ.x;
        c.mesh.position.z = prevXZ.z;
        _restoreCreatureRegionState(c, prevState);

        if (_tryCreatureStep(c, prevXZ, axisX, axisZ)) {
            candidates.push({
                x: c.mesh.position.x,
                z: c.mesh.position.z,
                state: _snapshotCreatureRegionState(c),
                distSq: (player.position.x - c.mesh.position.x) ** 2 + (player.position.z - c.mesh.position.z) ** 2,
            });
        }
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => a.distSq - b.distSq);
        c.mesh.position.x = candidates[0].x;
        c.mesh.position.z = candidates[0].z;
        _restoreCreatureRegionState(c, candidates[0].state);
    } else {
        c.mesh.position.x = prevXZ.x;
        c.mesh.position.z = prevXZ.z;
        _restoreCreatureRegionState(c, prevState);
    }
}

function _moveCreatureWithWallCollisions(c, dx, dz, dist, delta) {
    const speed = c.speed ?? (c.isCemZombie ? CEMETERY_ZOMBIE_SPEED : CREATURE_SPEED);
    const travelDist = speed * delta;
    if (travelDist <= 0) return;

    if (c.houseRegion === undefined) _syncCreatureHouseRegion(c);
    if (c.caveRegion === undefined) _syncCreatureCaveRegion(c);
    if (c.cemeteryRegion === undefined) _syncCreatureCemeteryRegion(c);

    // Enclosure walls are thin enough that a full capped frame can tunnel across them.
    // Step below the creature radius so every wall crossing gets an overlap pass.
    const maxStepDist = 0.35;
    const steps = Math.max(1, Math.ceil(travelDist / maxStepDist));
    const stepDelta = delta / steps;
    const dirX = dx / dist;
    const dirZ = dz / dist;

    for (let s = 0; s < steps; s++) {
        _moveCreatureStepWithSlide(c, dirX * speed * stepDelta, dirZ * speed * stepDelta);
    }
}

// ── Per-creature update ───────────────────────────────────────────────────────

function _updateCreature(c, delta) {
    if (DEBUG_CREATURES_FREEZE) return;

    // Emerge from ground
    if (c.emergeTimer > 0) {
        c.emergeTimer -= delta;
        const t = Math.max(0, 1 - c.emergeTimer / CEMETERY_ZOMBIE_EMERGE_SEC);
        c.mesh.position.y = c.emergeStartY + (c.emergeTargetY - c.emergeStartY) * t;
        if (Math.random() < delta * 8) {
            spawnDigParticles(
                c.mesh.position.x + (Math.random() - 0.5) * 1.5,
                c.emergeTargetY,
                c.mesh.position.z + (Math.random() - 0.5) * 1.5,
                0x3a2e22
            );
        }
        // Track player while rising
        if (c.isCemZombie) {
            const edx = player.position.x - c.mesh.position.x;
            const edz = player.position.z - c.mesh.position.z;
            if (Math.hypot(edx, edz) > 0.01) c.mesh.rotation.y = Math.atan2(edx, edz);
        }
        return;
    }

    const dx   = player.position.x - c.mesh.position.x;
    const dz   = player.position.z - c.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    // Face player
    if (dist > 0.01) {
        c.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Crawler limb animation (diagonal gait: leftArm+rightLeg in phase, rightArm+leftLeg offset by π)
    if (c.type === 'crawler') {
        const phase = (c.mesh.userData.crawlerLegPhase || 0) + delta * 35;
        c.mesh.userData.crawlerLegPhase = phase;
        const limbs = c.mesh.userData.crawlerLimbs;
        if (limbs) {
            const offsets = [0, Math.PI, Math.PI, 0];
            for (let li = 0; li < limbs.length; li++) {
                limbs[li].rotation.x = Math.sin(phase + offsets[li]) * 0.35;
            }
        }
    }

    // Weeping angel FOV freeze (only beyond lock distance)
    if (c.type === 'angel' && dist > WEEPING_ANGEL_LOCK_DIST) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        if (camDir.lengthSq() > 0.001) camDir.normalize();

        const toAngel = new THREE.Vector3(
            c.mesh.position.x - camera.position.x,
            0,
            c.mesh.position.z - camera.position.z
        );
        if (toAngel.lengthSq() > 0.001) toAngel.normalize();

        // Freeze when angel is within the horizontal frustum + body-width margin.
        // Computed dynamically so it's correct at any window aspect ratio.
        const halfHFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
        const freezeCos = Math.cos(halfHFov + WEEPING_ANGEL_BODY_MARGIN);
        c.mesh.userData.angelFrozen = camDir.dot(toAngel) >= freezeCos;
    } else {
        c.mesh.userData.angelFrozen = false;
    }

    if (c.mesh.userData.angelFrozen) return;

    // Move toward player
    if (dist > 0.5) {
        _moveCreatureWithWallCollisions(c, dx, dz, dist, delta);

        const targetY = getMoverSurfaceHeight(c.mesh.position.x, c.mesh.position.z, false);
        c.mesh.position.y = moveScalarToward(c.mesh.position.y, targetY, 20 * delta);
    }

    // Hit cooldown
    if (c.hitCooldown > 0) c.hitCooldown -= delta;

    // Damage player on contact
    const dy   = player.position.y - c.mesh.position.y;
    const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist3d < 2.0 && c.hitCooldown <= 0 && !playerDead) {
        c.hitCooldown = CREATURE_HIT_COOLDOWN;
        playerHealth  = Math.max(0, playerHealth - CREATURE_HIT_DAMAGE);
        _damageFlashEl.classList.remove('active');
        void _damageFlashEl.offsetWidth;
        _damageFlashEl.classList.add('active');
        if (playerHealth <= 0) hardReset();
    }
}

// ── Main frame update ─────────────────────────────────────────────────────────

function updateCreatures(delta) {
    if (playerDead) return;

    if (DEBUG_CREATURES_2) {
        _spawnDebugCreatureCircle();
    }

    // DEBUG_CREATURES_FREEZE: spawn all 3 types in a row on first frame; they stay frozen
    if (DEBUG_CREATURES_FREEZE && !_ncFreezeSpawned) {
        _ncFreezeSpawned = true;
        const types = ['zombie', 'crawler', 'angel'];
        const xOffsets = [-7, 0, 7];
        for (let i = 0; i < 3; i++) {
            _spawnNightCreature(types[i], xOffsets[i], 10);
        }
    }

    const nowIsNight = (gameTime / FULL_CYCLE) >= NIGHT_START;

    // Night → day: destroy all non-cemetery night creatures
    if (_ncWasNight && !nowIsNight && !DEBUG_CREATURES_FREEZE && !DEBUG_CREATURES_2) {
        for (let i = nightCreatures.length - 1; i >= 0; i--) {
            const c = nightCreatures[i];
            if (!c.isCemZombie) {
                _explodeCreature(c);
                nightCreatures.splice(i, 1);
            }
        }
    }

    // Reset spawn timer each time night begins
    if (!_ncWasNight && nowIsNight) {
        _ncSpawnTimer = CREATURE_SPAWN_INTERVAL;
    }
    _ncWasNight = nowIsNight;

    // Pre-unlock: silently remove any creatures that may have spawned via debug
    if (!_ncSpawnUnlocked && !DEBUG_CREATURES && !DEBUG_CREATURES_2 && !DEBUG_CREATURES_FREEZE && nowIsNight) {
        for (let i = nightCreatures.length - 1; i >= 0; i--) {
            const c = nightCreatures[i];
            if (!c.isCemZombie) {
                scene.remove(c.mesh);
                nightCreatures.splice(i, 1);
            }
        }
    }

    // Passive health regen (only outside demon apocalypse, which has its own regen)
    if (!demonApocalypse) {
        playerHealth = Math.min(100, playerHealth + CREATURE_HEALTH_REGEN * delta);
    }

    // Delayed night transition (1 sec after zombie emergence)
    if (_nightTransitionTimer >= 0) {
        _nightTransitionTimer -= delta;
        if (_nightTransitionTimer <= 0) {
            _nightTransitionTimer = -1;
            startDayNightTransition(NIGHT_START + 0.05, 3);
        }
    }

    // Cemetery zombie countdown
    if (_cemZombieCountdown >= 0 && !_cemZombiesSpawned) {
        _cemZombieCountdown -= delta;
        if (_cemZombieCountdown <= 0) {
            _spawnCemeteryZombies();
            _cemZombiesSpawned  = true;
            _cemZombieCountdown = -1;
        }
    }

    // Night spawn timer
    if (!demonApocalypse && nowIsNight) {
        const inOuterBand = isPlayerInOuterBand();
        const canSpawn    = _ncSpawnUnlocked || DEBUG_CREATURES;

        if (canSpawn) {
            _ncSpawnTimer -= delta;
            if (_ncSpawnTimer <= 0) {
                _ncSpawnTimer = CREATURE_SPAWN_INTERVAL;

                let spawnCount = 0;
                if (inOuterBand) {
                    if (Math.random() < 0.60) spawnCount = 2;
                } else if (currentHandItem === 'torch' && hasTorch) {
                    if (Math.random() < 0.40) {
                        spawnCount = Math.random() < 0.60 ? 1 : 2;
                    }
                } else {
                    if (Math.random() < 0.20) spawnCount = 1;
                }

                const types = ['zombie', 'crawler', 'angel'];
                for (let s = 0; s < spawnCount; s++) {
                    const angle = Math.random() * Math.PI * 2;
                    let sx = player.position.x + Math.cos(angle) * CREATURE_SPAWN_DIST;
                    let sz = player.position.z + Math.sin(angle) * CREATURE_SPAWN_DIST;
                    sx = Math.max(-(WORLD_SIZE - 150), Math.min(WORLD_SIZE - 150, sx));
                    sz = Math.max(-(WORLD_SIZE - 150), Math.min(WORLD_SIZE - 150, sz));
                    const type = _ncOpenWorldSpawned < 2 ? 'crawler' : types[Math.floor(Math.random() * 3)];
                    _ncOpenWorldSpawned++;
                    _spawnNightCreature(type, sx, sz);
                }
            }
        }
    }

    // Update each creature
    for (let i = nightCreatures.length - 1; i >= 0; i--) {
        _updateCreature(nightCreatures[i], delta);
    }

    // Separation — runs every 2 frames (O(n²) is negligible at creature counts)
    _ncSepFrame = (_ncSepFrame + 1) % 2;
    if (_ncSepFrame === 0 && nightCreatures.length > 1) {
        const SEP_RADIUS    = 1.5;
        const SEP_STRENGTH  = 8;
        const SEP_MAX_STEP  = 3;

        // Snapshot positions before the pass so every force is computed from the
        // same frame state. Without this, creature j<i reads its already-updated
        // position, making forces order-dependent and inconsistent in clusters.
        const snapX = nightCreatures.map(c => c.mesh.position.x);
        const snapZ = nightCreatures.map(c => c.mesh.position.z);

        for (let i = 0; i < nightCreatures.length; i++) {
            const ci = nightCreatures[i];
            if (ci.emergeTimer > 0) continue;
            let sepX = 0, sepZ = 0;
            for (let j = 0; j < nightCreatures.length; j++) {
                if (j === i) continue;
                const sdx = snapX[i] - snapX[j];
                const sdz = snapZ[i] - snapZ[j];
                const sd  = Math.sqrt(sdx * sdx + sdz * sdz);
                if (sd >= SEP_RADIUS) continue;
                const push = (SEP_RADIUS - sd) / SEP_RADIUS;
                if (sd > 0.001) {
                    sepX += (sdx / sd) * push;
                    sepZ += (sdz / sd) * push;
                } else {
                    // Nearly identical positions: use a deterministic direction so
                    // they don't stay locked. Golden-angle spread per pair keeps
                    // forces from cancelling when multiple creatures pile up.
                    const angle = (i - j) * 2.399;
                    sepX += Math.cos(angle) * push;
                    sepZ += Math.sin(angle) * push;
                }
            }
            const sepLen = Math.sqrt(sepX * sepX + sepZ * sepZ);
            if (sepLen > 0.001) {
                const preSepX = ci.mesh.position.x;
                const preSepZ = ci.mesh.position.z;
                const capped = Math.min(sepLen * SEP_STRENGTH, SEP_MAX_STEP);
                ci.mesh.position.x += (sepX / sepLen) * capped * delta;
                ci.mesh.position.z += (sepZ / sepLen) * capped * delta;
                // Re-check walls so separation can't push creatures through fences
                const prevXZ = { x: preSepX, z: preSepZ };
                resolveCircularEntityWallOverlaps(ci.mesh.position, ci.mesh.position.y, 0.5, 3, prevXZ);
                _clampToCemeteryBounds(ci);
                const prevState = _snapshotCreatureRegionState(ci);
                if (!_enforceCreatureHouseRegions(ci, prevXZ) || !_enforceCreatureCaveRegions(ci, prevXZ)) {
                    ci.mesh.position.x = prevXZ.x;
                    ci.mesh.position.z = prevXZ.z;
                    _restoreCreatureRegionState(ci, prevState);
                } else if (!_enforceCreatureCemeteryRegions(ci, prevXZ)) {
                    ci.mesh.position.x = prevXZ.x;
                    ci.mesh.position.z = prevXZ.z;
                    _restoreCreatureRegionState(ci, prevState);
                }
            }
        }
    }
}
