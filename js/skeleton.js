// js/skeleton.js
// Skeleton and skull mesh construction.

function createSkullMesh(scale = 1) {
    const grp = new THREE.Group();
    const boneMat = new THREE.MeshLambertMaterial({ color: 0xd6d0b8 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x0a0808 });

    // Cranium
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.6 * scale, 10, 8), boneMat);
    cranium.scale.x = 0.8;
    cranium.scale.y = 1.1;
    cranium.scale.z = 0.8;
    cranium.position.y = 0.35 * scale;
    grp.add(cranium);

    // Jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.28 * scale, 0.55 * scale), boneMat);
    jaw.position.set(0, 0.0 * scale, 0.05 * scale);
    grp.add(jaw);

    // Eye sockets
    [-0.22, 0.22].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 6, 5), darkMat);
        eye.position.set(ex * scale, 0.42 * scale, 0.4 * scale);
        eye.scale.y = 1.15;
        eye.scale.z = 0.5;
        grp.add(eye);
    });

    // Nasal cavity
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.15 * scale, 0.1 * scale), darkMat);
    nose.position.set(0, 0.22 * scale, 0.45 * scale);
    grp.add(nose);

    // Teeth (4 small boxes)
    for (let t = 0; t < 4; t++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.14 * scale, 0.08 * scale), boneMat);
        tooth.position.set((-1.5 + t) * 0.16 * scale, -0.1 * scale, 0.4 * scale);
        grp.add(tooth);
    }

    enableMeshShadows(grp);
    return grp;
}

// Builds a complete human skeleton in a seated-against-wall pose.
//
// Group root = pelvis at floor level.
// The skeleton faces +z (forward); its back is toward -z (toward the wall).
// Lean ~25° backward so it reads as slumped/resting against a wall.

function createSkeletonMesh(scale) {
    scale = scale !== undefined ? scale : 1;
    const s = scale;
    const grp = new THREE.Group();

    const boneMat = new THREE.MeshLambertMaterial({ color: 0xd6d0b8 });

    // ── Cylinder bone between two points ─────────────────────────────────────
    function bone(ax, ay, az, bx, by, bz, r) {
        r = (r !== undefined ? r : 0.04) * s;
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-5) return;
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(r * 0.85, r, len, 5, 1),
            boneMat
        );
        mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
        const up = new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
        // Handle antiparallel case
        if (dir.dot(up) < -0.9999) {
            mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        } else {
            mesh.quaternion.setFromUnitVectors(up, dir);
        }
        grp.add(mesh);
        return mesh;
    }

    // ── Spine key positions (scale=1 values; multiply by s) ──────────────────
    // Spine tilts ~25° toward -z (wall). cos25≈0.906, sin25≈0.423
    const SBx = 0,  SBy = 0.22 * s,  SBz = -0.08 * s;  // spine base (lumbar root)
    const LTx = 0,  LTy = 0.60 * s,  LTz = -0.26 * s;  // lumbar top
    const TTx = 0,  TTy = 1.00 * s,  TTz = -0.43 * s;  // thoracic top
    const CTx = 0,  CTy = 1.17 * s,  CTz = -0.51 * s;  // cervical top (neck tip)

    // ── Pelvis ────────────────────────────────────────────────────────────────
    const sacrum = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.22 * s, 0.15 * s), boneMat);
    sacrum.position.set(0, 0.16 * s, -0.07 * s);
    grp.add(sacrum);

    const liMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.28 * s, 0.13 * s), boneMat);
    liMesh.position.set(-0.22 * s, 0.20 * s, -0.03 * s);
    liMesh.rotation.z = 0.28;
    grp.add(liMesh);

    const riMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.28 * s, 0.13 * s), boneMat);
    riMesh.position.set(0.22 * s, 0.20 * s, -0.03 * s);
    riMesh.rotation.z = -0.28;
    grp.add(riMesh);

    const pubisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.09 * s, 0.10 * s), boneMat);
    pubisMesh.position.set(0, 0.07 * s, 0.04 * s);
    grp.add(pubisMesh);

    // ── Spine ─────────────────────────────────────────────────────────────────
    bone(SBx, SBy, SBz, LTx, LTy, LTz, 0.065);   // lumbar
    bone(LTx, LTy, LTz, TTx, TTy, TTz, 0.058);   // thoracic
    bone(TTx, TTy, TTz, CTx, CTy, CTz, 0.048);   // cervical

    // ── Rib cage — taller than wide ───────────────────────────────────────────
    // Height span: y=0.55→0.97 = 0.42 units tall.
    // Max rib elbow x = 0.30 per side → total width 0.60, matching the pelvis outer width.
    //
    // Sternum: vertical bar at front of chest
    const sternumMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.44 * s, 0.06 * s), boneMat);
    const stX = 0, stY = 0.76 * s, stZ = -0.12 * s;
    sternumMesh.position.set(stX, stY, stZ);
    grp.add(sternumMesh);

    // 6 rib pairs. Format: [spineY, spineZ, elbowX, elbowY, elbowZ, sternumY, sternumZ]
    // Ribs fan from spine (back) through an outward elbow, then back to sternum (front).
    // Spine z follows the thoracic lean; elbow z is intermediate; sternum z ≈ -0.12.
    // Rib elbow x scaled so max = 0.30*s per side → total width 0.60*s,
    // matching the pelvis outer width (ilium centers ±0.22 + half-width 0.085 = ±0.305).
    const ribRows = [
        [0.56 * s, -0.24 * s,  0.23 * s, 0.54 * s, -0.18 * s,  0.54 * s, -0.12 * s],
        [0.63 * s, -0.27 * s,  0.28 * s, 0.61 * s, -0.20 * s,  0.61 * s, -0.12 * s],
        [0.71 * s, -0.31 * s,  0.30 * s, 0.69 * s, -0.24 * s,  0.69 * s, -0.12 * s],
        [0.79 * s, -0.34 * s,  0.30 * s, 0.77 * s, -0.27 * s,  0.77 * s, -0.12 * s],
        [0.87 * s, -0.38 * s,  0.27 * s, 0.85 * s, -0.31 * s,  0.85 * s, -0.12 * s],
        [0.95 * s, -0.41 * s,  0.22 * s, 0.93 * s, -0.35 * s,  0.93 * s, -0.12 * s],
    ];

    for (const [sy, sz, ex, ey, ez, sty, stz] of ribRows) {
        bone(0, sy, sz, ex, ey, ez, 0.022);
        bone(ex, ey, ez, stX + 0.04 * s, sty, stz, 0.022);
        bone(0, sy, sz, -ex, ey, ez, 0.022);
        bone(-ex, ey, ez, stX - 0.04 * s, sty, stz, 0.022);
    }

    // ── Clavicles ─────────────────────────────────────────────────────────────
    const lShoulder = [-0.52 * s, 0.96 * s, -0.41 * s];
    const rShoulder = [ 0.52 * s, 0.96 * s, -0.41 * s];
    bone(TTx, TTy, TTz, lShoulder[0], lShoulder[1], lShoulder[2], 0.028);
    bone(TTx, TTy, TTz, rShoulder[0], rShoulder[1], rShoulder[2], 0.028);

    // ── Arms — equal upper and lower bone lengths (each ≈ 0.563) ─────────────
    //
    // LEFT arm: bent at elbow, forearm resting across the lap.
    //   Upper arm hangs mostly straight down from shoulder, slight forward lean.
    //   Vector (0, -0.56, 0.06): len = √(0.3136+0.0036) ≈ 0.563 ✓
    //   Forearm swings forward toward the thigh.
    //   Vector (0.11, -0.23, 0.50): len = √(0.0121+0.0529+0.25) ≈ 0.561 ✓
    const lElbow = [-0.52 * s,  0.40 * s, -0.35 * s];
    const lWrist = [-0.41 * s,  0.17 * s,  0.15 * s];

    // RIGHT arm: hanging by the side, forearm resting on the floor.
    //   Upper arm hangs down and very slightly forward/outward.
    //   Vector (0.03, -0.56, 0.05): len = √(0.0009+0.3136+0.0025) ≈ 0.563 ✓
    //   Forearm descends to rest on the floor beside the hip.
    //   Vector (0, -0.358, 0.436): len = √(0+0.1282+0.1901) ≈ 0.563 ✓
    const rElbow = [ 0.55 * s,  0.40 * s, -0.36 * s];
    const rWrist = [ 0.55 * s,  0.04 * s,  0.08 * s];

    bone(lShoulder[0], lShoulder[1], lShoulder[2], lElbow[0], lElbow[1], lElbow[2], 0.048);
    bone(rShoulder[0], rShoulder[1], rShoulder[2], rElbow[0], rElbow[1], rElbow[2], 0.048);

    bone(lElbow[0], lElbow[1], lElbow[2], lWrist[0], lWrist[1], lWrist[2], 0.038);
    bone(rElbow[0], rElbow[1], rElbow[2], rWrist[0], rWrist[1], rWrist[2], 0.038);

    // ── Fingers (5 fingers × 3 bones × 2 hands) ──────────────────────────────
    function addFingers(wx, wy, wz, side) {
        const cols = [
            { dx: -0.09 * side, dz: 0.02, spread: -0.22 * side },  // thumb
            { dx: -0.04 * side, dz: 0.00, spread: -0.06 * side },  // index
            { dx:  0.00 * side, dz: 0.00, spread:  0.01 * side },  // middle
            { dx:  0.04 * side, dz: 0.00, spread:  0.06 * side },  // ring
            { dx:  0.08 * side, dz: 0.01, spread:  0.11 * side },  // pinky
        ];
        const segLens = [0.070, 0.052, 0.038];

        for (let fi = 0; fi < 5; fi++) {
            const c = cols[fi];
            let px = wx + c.dx * s;
            let py = wy + 0.005 * s;
            let pz = wz + c.dz * s;

            const rawX = c.spread * s;
            const rawY = -0.05 * s;
            const rawZ = 0.70 * s;
            const dlen = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
            const fdx = rawX / dlen, fdy = rawY / dlen, fdz = rawZ / dlen;

            const thickness = fi === 0 ? 0.018 : (fi === 4 ? 0.014 : 0.016);
            for (let bi = 0; bi < 3; bi++) {
                const bl = segLens[bi] * s;
                const nx = px + fdx * bl;
                const ny = py + fdy * bl;
                const nz = pz + fdz * bl;
                bone(px, py, pz, nx, ny, nz, thickness - bi * 0.002);
                px = nx; py = ny; pz = nz;
            }
        }
    }

    addFingers(lWrist[0], lWrist[1], lWrist[2], -1);
    addFingers(rWrist[0], rWrist[1], rWrist[2],  1);

    // ── Legs — equal upper and lower bone lengths (each ≈ 0.563) ─────────────
    //
    // RIGHT leg: extended forward (mostly straight).
    //   Femur vector (0, -0.06, 0.56): len = √(0.0036+0.3136) ≈ 0.563 ✓
    //   Tibia vector (0, -0.03, 0.56): len = √(0.0009+0.3136) ≈ 0.561 ✓
    //
    // LEFT leg: knee bent and splayed out to the side.
    //   Femur vector (-0.31, -0.04, 0.46): len = √(0.0961+0.0016+0.2116) ≈ 0.556 ✓
    //   Tibia vector (0.25, -0.05, 0.50): len = √(0.0625+0.0025+0.25) ≈ 0.561 ✓
    //   The tibia runs back toward center after the knee splays left,
    //   keeping the ankle near the ground and the foot pointing forward.

    const lHip = [-0.19 * s, 0.09 * s, 0.04 * s];
    const rHip = [ 0.19 * s, 0.09 * s, 0.04 * s];

    bone(0, 0.11 * s, 0.00 * s, lHip[0], lHip[1], lHip[2], 0.052);
    bone(0, 0.11 * s, 0.00 * s, rHip[0], rHip[1], rHip[2], 0.052);

    // Right: knee directly forward, ankle directly forward
    const rKnee  = [ 0.19 * s,  0.03 * s,  0.60 * s];
    const rAnkle = [ 0.19 * s,  0.00 * s,  1.16 * s];

    // Left: knee splays to the left side; tibia returns inward to ankle on the ground
    const lKnee  = [-0.50 * s,  0.05 * s,  0.50 * s];
    const lAnkle = [-0.25 * s,  0.00 * s,  1.00 * s];

    bone(lHip[0], lHip[1], lHip[2], lKnee[0],  lKnee[1],  lKnee[2],  0.055);
    bone(rHip[0], rHip[1], rHip[2], rKnee[0],  rKnee[1],  rKnee[2],  0.055);

    bone(lKnee[0],  lKnee[1],  lKnee[2],  lAnkle[0], lAnkle[1], lAnkle[2], 0.044);
    bone(rKnee[0],  rKnee[1],  rKnee[2],  rAnkle[0], rAnkle[1], rAnkle[2], 0.044);

    // Foot bones (ankle → metatarsal base)
    const lFootTip = [-0.25 * s,  0.04 * s,  1.24 * s];
    const rFootTip = [ 0.19 * s,  0.04 * s,  1.40 * s];

    bone(lAnkle[0], lAnkle[1], lAnkle[2], lFootTip[0], lFootTip[1], lFootTip[2], 0.036);
    bone(rAnkle[0], rAnkle[1], rAnkle[2], rFootTip[0], rFootTip[1], rFootTip[2], 0.036);

    // ── Toes (5 toes × 3 bones × 2 feet) — doubled length ────────────────────
    function addToes(ftx, fty, ftz, side, xBias) {
        xBias = xBias || 0;
        const cols = [
            { dx: -0.08 * side, spread:  0.14 * side },   // big toe
            { dx: -0.03 * side, spread:  0.04 * side },   // 2nd
            { dx:  0.01 * side, spread:  0.01 * side },   // 3rd
            { dx:  0.05 * side, spread: -0.04 * side },   // 4th
            { dx:  0.09 * side, spread: -0.10 * side },   // little
        ];
        // Doubled from original [0.058, 0.044, 0.030]
        const segLens = [0.116, 0.088, 0.060];

        for (let ti = 0; ti < 5; ti++) {
            const c = cols[ti];
            let px = ftx + c.dx * s;
            let py = fty - 0.01 * s;
            let pz = ftz - 0.02 * s;

            const rawX = c.spread * s + xBias * s;
            const rawY = 0.866 * s;  // sin(60°) — toes angle 60° up from floor
            const rawZ = 0.500 * s;  // cos(60°)
            const dlen = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
            const tdx = rawX / dlen, tdy = rawY / dlen, tdz = rawZ / dlen;

            const thickness = ti === 0 ? 0.019 : (ti === 4 ? 0.013 : 0.015);
            for (let bi = 0; bi < 3; bi++) {
                const bl = segLens[bi] * s;
                const nx = px + tdx * bl;
                const ny = py + tdy * bl;
                const nz = pz + tdz * bl;
                bone(px, py, pz, nx, ny, nz, thickness - bi * 0.002);
                px = nx; py = ny; pz = nz;
            }
        }
    }

    addToes(lFootTip[0], lFootTip[1], lFootTip[2], -1, -0.20);  // lean outward to match splayed knee
    addToes(rFootTip[0], rFootTip[1], rFootTip[2],  1);

    // ── Skull ─────────────────────────────────────────────────────────────────
    const skull = createSkullMesh(s / 2.5);
    skull.position.set(0 * s, 1.25 * s, -0.5 * s);
    skull.rotation.set(0.38, 0.20, 0.28);
    grp.add(skull);

    enableMeshShadows(grp);
    return grp;
}
