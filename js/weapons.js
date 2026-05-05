function createAK47Mesh(scale = 1) {
    const rifle = new THREE.Group();
    const metal = new THREE.MeshLambertMaterial({ color: 0x242424 });
    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const wood = new THREE.MeshLambertMaterial({ color: 0x6f4a2f });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.62), metal);
    body.position.set(0, 0, 0.02);
    rifle.add(body);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.35), wood);
    stock.position.set(0, 0.01, -0.46);
    rifle.add(stock);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.38), wood);
    handguard.position.set(0, -0.005, 0.36);
    rifle.add(handguard);

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.72), darkMetal);
    barrel.position.set(0, 0.025, 0.73);
    rifle.add(barrel);

    const muzzleCap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.1), darkMetal);
    muzzleCap.position.set(0, 0.025, 1.13);
    rifle.add(muzzleCap);

    const gasTube = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), darkMetal);
    gasTube.position.set(0, 0.08, 0.39);
    rifle.add(gasTube);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.07), darkMetal);
    rearSight.position.set(0, 0.11, -0.12);
    rifle.add(rearSight);

    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), darkMetal);
    frontSight.position.set(0, 0.09, 0.95);
    rifle.add(frontSight);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), darkMetal);
    grip.position.set(0, -0.16, -0.12);
    grip.rotation.x = -0.35;
    rifle.add(grip);

    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.24, 0.14), darkMetal);
    magazine.position.set(0, -0.18, 0.13);
    magazine.rotation.x = -0.25;
    rifle.add(magazine);

    rifle.scale.setScalar(scale);
    enableMeshShadows(rifle);

    const muzzle = new THREE.Object3D();
    muzzle.userData.ignoreCameraOcclusion = true;
    muzzle.userData.isBeam = true;
    muzzle.position.set(0, 0.02, 1.22);
    rifle.add(muzzle);

    return { mesh: rifle, muzzle };
}

function createShovelMesh(scale = 1) {
    const group = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
    const metal = new THREE.MeshLambertMaterial({ color: 0xAAAAAA });
    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.06 * scale, 2.2 * scale, 8), wood);
    handle.position.y = 1.1 * scale;
    group.add(handle);
    // Blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.65 * scale, 0.06 * scale), metal);
    blade.position.y = -0.33 * scale;
    group.add(blade);
    enableMeshShadows(group);
    return group;
}

function createGoldenKeyMesh() {
    const group = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x886600, emissiveIntensity: 0.4 });
    // Key ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.12, 8, 20), gold);
    ring.position.y = 0.45;
    group.add(ring);
    // Shank
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), gold);
    shank.position.y = -0.1;
    group.add(shank);
    // Teeth
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.13), gold);
    tooth1.position.set(0.22, -0.38, 0);
    group.add(tooth1);
    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.13), gold);
    tooth2.position.set(0.19, -0.56, 0);
    group.add(tooth2);
    enableMeshShadows(group);
    return group;
}

// ── Stick / Torch meshes & hand slot system ──────────────────────────────────

function getItemDisplayName(item) {
    const names = { fist: 'Fist', shovel: 'Shovel', ak47: 'AK47', stick: 'Stick', torch: 'Torch', 'sword-shield': 'Sword & Shield' };
    return names[item] || item;
}

// Adds an item to the dynamic hand slot list and auto-equips it.
// If `replaces` is given, that item's slot is swapped in-place (e.g. stick -> torch).
function addHandSlot(itemName, replaces = null) {
    if (replaces !== null) {
        const idx = handSlots.indexOf(replaces);
        if (idx !== -1) {
            handSlots[idx] = itemName;
            currentHandItem = itemName;
            return;
        }
    }
    if (!handSlots.includes(itemName)) {
        handSlots.push(itemName);
    }
    currentHandItem = itemName;
}

function createPlayerStickMesh(scale = 1) {
    const group = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x7A5230 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.065 * scale, 1.4 * scale, 7), wood);
    handle.position.y = 0.7 * scale;
    group.add(handle);
    // const tip = new THREE.Mesh(new THREE.ConeGeometry(0.065 * scale, 0.28 * scale, 7), wood);
    // tip.position.y = 1.54 * scale;
    // group.add(tip);
    enableMeshShadows(group);
    return group;
}

function createPlayerTorchMesh(scale = 1) {
    const group = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x7A5230 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.9 });
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xFFDD00, transparent: true, opacity: 0.8 });

    // Handle: at local +Y so rotation.z=PI on player puts it pointing world -Y (downward grip).
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.065 * scale, 1.4 * scale, 7), wood);
    handle.position.y = 0.7 * scale;
    group.add(handle);

    // Flame group: counter-rotates so its local +Y always points world +Y,
    // regardless of the torch group's own tilt (rotation.x = PI/3.5, rotation.z = PI).
    // Math: group applies M = Rz(PI)·Rx(PI/3.5). To make flameGroup's +Y be world +Y:
    //   M · Rx(β) · [0,1,0] = [0,1,0]  →  β = PI - PI/3.5
    const flameGroup = new THREE.Group();
    flameGroup.position.y = -0.1 * scale;
    flameGroup.position.z = -0.02 * scale;
    flameGroup.rotation.x = Math.PI + Math.PI / 3.6;
    group.add(flameGroup);
    group.userData.flameGroup = flameGroup;

    // Outer flame cone: ConeGeometry tip is at +Y by default. Place base at y=0, tip at y=0.4.
    const flameCone = new THREE.Mesh(new THREE.ConeGeometry(0.13 * scale, 0.4 * scale, 8), flameMat);
    flameCone.position.y = 0.2 * scale - 0.0002;
    flameCone.castShadow = false;
    flameCone.receiveShadow = false;
    flameGroup.add(flameCone);

    // Lower hemisphere: thetaStart=PI/2, thetaLength=PI/2 → lower half-sphere.
    // Flat face sits at y=0 (aligns with cone base), dome hangs toward -Y.
    const flameBase = new THREE.Mesh(
        new THREE.SphereGeometry(0.125 * scale, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        flameMat
    );
    flameBase.position.y = 0;
    flameBase.castShadow = false;
    flameBase.receiveShadow = false;
    flameGroup.add(flameBase);

    // Inner core cone (brighter center)
    const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.28 * scale, 8), innerFlameMat);
    flameCore.position.y = 0.14 * scale;
    flameCore.castShadow = false;
    flameCore.receiveShadow = false;
    flameGroup.add(flameCore);

    // Point light parented to flameGroup so it sits exactly on the flame.
    // player.js retrieves it via group.userData.torchLight.
    const torchLt = new THREE.PointLight(0xFF6600, 0, 150, 1.2);
    torchLt.position.set(0, 0.2 * scale, 0);  // center of outer flame cone
    flameGroup.add(torchLt);
    group.userData.torchLight = torchLt;

    enableMeshShadows(group);
    // Flames are transparent light effects — must not cast shadows after enableMeshShadows overwrites them.
    flameGroup.traverse(obj => {
        if (obj.isMesh) { obj.castShadow = false; obj.receiveShadow = false; }
    });
    return group;
}

function updateTorchLight(delta) {
    if (!torchEquippedLight) return;
    const torchActive = hasTorch && (currentHandItem === 'torch') && !playerDead && !mountedOnDragon;
    if (torchEquippedLight.castShadow !== torchActive) {
        torchEquippedLight.castShadow = torchActive;
    }
    if (!torchActive) {
        torchEquippedLight.intensity = 0;
        return;
    }
    const ud = torchEquippedLight.userData;
    if (!ud.baseIntensity) { torchEquippedLight.intensity = 20; return; } // fallback if userData not set
    ud.flickerTimer -= delta;
    if (ud.flickerTimer <= 0) {
        // Extreme flicker matching campfire magnitude
        ud.flickerTimer     = 0.03 + Math.random() * 0.12;
        ud.targetIntensity  = ud.baseIntensity * (0.7 + Math.random() * 0.6);
        ud.targetDistance   = ud.baseDistance  * (0.7 + Math.random() * 0.6);
    }
    const iBlend = Math.min(1, delta * 9);
    const dBlend = Math.min(1, delta * 6);
    ud.currentIntensity += (ud.targetIntensity - ud.currentIntensity) * iBlend;
    ud.currentDistance  += (ud.targetDistance  - ud.currentDistance)  * dBlend;

    const t = performance.now() * 0.0005;
    const breath = Math.sin(t * 13.1) * 0.17 + Math.sin(t * 21.3 + 2.1) * 0.09;
    torchEquippedLight.intensity = Math.max(0.5, ud.currentIntensity + breath * ud.baseIntensity);
    torchEquippedLight.distance  = Math.max(20,  ud.currentDistance  + breath * ud.baseDistance * 0.10);
}

// ── End Stick / Torch ────────────────────────────────────────────────────────

function syncHandItemVisuals() {
    ak47Equipped = ak47Collected && (currentHandItem === 'ak47');

    if (akChest && akChest.gunMesh) {
        akChest.gunMesh.visible = !!(akChest.opened && !akChest.collected);
    } else if (akChestGun) {
        akChestGun.visible = false;
    }

    const showPlayerGun = ak47Collected && ak47Equipped && !playerDead && !mountedOnDragon;
    if (playerAk47) playerAk47.visible = showPlayerGun;

    if (!showPlayerGun) {
        ak47TriggerHeld = false;
        ak47MuzzleFlashTimer = 0;
        ak47MuzzleLightTimer = 0;
        if (ak47MuzzleFlash) ak47MuzzleFlash.visible = false;
        if (ak47MuzzleLight) ak47MuzzleLight.intensity = 0;
    }

    if (playerShovel) {
        playerShovel.visible = hasShovel && (currentHandItem === 'shovel') && !playerDead && !mountedOnDragon;
    }
    if (playerStickMesh) {
        playerStickMesh.visible = hasStick && (currentHandItem === 'stick') && !playerDead && !mountedOnDragon;
    }
    if (playerTorchMesh) {
        playerTorchMesh.visible = hasTorch && (currentHandItem === 'torch') && !playerDead && !mountedOnDragon;
    }
    if (playerSwordMesh) {
        playerSwordMesh.visible = hasSwordShield && (currentHandItem === 'sword-shield') && !playerDead && !mountedOnDragon;
    }
    if (playerShieldMesh) {
        playerShieldMesh.visible = hasSwordShield && (currentHandItem === 'sword-shield') && !playerDead && !mountedOnDragon;
    }
}

function createSwordMesh(scale = 1) {
    const grp = new THREE.Group();
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xe3ecff, emissive: 0x111820, emissiveIntensity: 0.3 });
    const goldMat  = new THREE.MeshLambertMaterial({ color: 0xc8a830, emissive: 0x4a3000, emissiveIntensity: 0.2 });
    const gripMat  = new THREE.MeshLambertMaterial({ color: 0x171321 });

    // Blade (tapered)
    const bladeH = 3.6 * scale;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, bladeH, 4), bladeMat);
    blade.position.y = bladeH / 2 + 0.55 * scale;
    // blade.rotation.y = Math.PI / 4;
    blade.scale.z = 0.2;
    blade.userData.isBlade = true;
    grp.add(blade);

    // Tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.3 * scale, 4), bladeMat);
    tip.position.y = bladeH + 0.7 * scale;
    // tip.rotation.y = Math.PI / 4;
    tip.scale.z = 0.2;
    tip.userData.isBlade = true;
    grp.add(tip);

    // Fuller (center groove decoration on blade)
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, bladeH * 0.85, 0.03 * scale), bladeMat);
    fuller.position.y = bladeH / 2 + 0.55 * scale;
    fuller.userData.isBlade = true;
    grp.add(fuller);

    // Guard (crossguard)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(1.5 * scale, 0.12 * scale, 0.22 * scale), goldMat);
    guard.position.y = 0.55 * scale;
    grp.add(guard);

    // Grip
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.1 * scale, 0.9 * scale, 8), gripMat);
    grip.position.y = 0.1 * scale;
    grp.add(grip);

    // Pommel
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 8, 6), goldMat);
    pommel.position.y = -0.46 * scale;
    grp.add(pommel);

    enableMeshShadows(grp);
    return grp;
}

function createShieldMesh(scale = 1) {
    const grp = new THREE.Group();
    const shieldMat  = new THREE.MeshLambertMaterial({ color: 0x4a3c28 });
    const rimMat     = new THREE.MeshLambertMaterial({ color: 0xb8960a, emissive: 0x302200, emissiveIntensity: 0.2 });
    const emblemMat  = new THREE.MeshLambertMaterial({ color: 0xd4a820, emissive: 0x402a00, emissiveIntensity: 0.3 });

    // Main body (kite shield shape approximated as flat disc with scale)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.92 * scale, 0.7 * scale, 0.12 * scale, 32), shieldMat);
    body.rotation.x = Math.PI / 2;
    grp.add(body);

    // Rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88 * scale, 0.1 * scale, 6, 32), rimMat);
    rim.position.z = 0.02 * scale;
    grp.add(rim);

    // Boss (center emblem)
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 8, 6), emblemMat);
    boss.position.z = 0.1 * scale;
    grp.add(boss);

    // Cross decoration
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 0.1 * scale, 0.06 * scale), emblemMat);
    crossH.position.z = 0.07 * scale;
    grp.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.85 * scale, 0.06 * scale), emblemMat);
    crossV.position.z = 0.07 * scale;
    grp.add(crossV);

    enableMeshShadows(grp);
    return grp;
}


function createTalismanMesh(scale = 1) {
    const grp = new THREE.Group();
    const goldMat = new THREE.MeshLambertMaterial({
        color: 0xd6a43a,
        emissive: 0x5a3900,
        emissiveIntensity: 0.35
    });
    const goldDarkMat = new THREE.MeshLambertMaterial({
        color: 0x8b6120,
        emissive: 0x352100,
        emissiveIntensity: 0.2
    });
    const purpleMat = new THREE.MeshLambertMaterial({
        color: 0x4d245f,
        emissive: 0x2b0d35,
        emissiveIntensity: 0.65
    });
    const gemMat = new THREE.MeshLambertMaterial({
        color: 0xb78ac8,
        emissive: 0x4d255e,
        emissiveIntensity: 0.95
    });

    function makeTriPoints(width, height) {
        return [
            new THREE.Vector2(0, height / 2),
            new THREE.Vector2(-width / 2, -height / 2),
            new THREE.Vector2(width / 2, -height / 2),
        ];
    }

    function tracePolygon(path, points) {
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
        path.closePath();
    }

    function makeTriangleMesh(width, height, depth, mat) {
        const shape = new THREE.Shape();
        tracePolygon(shape, makeTriPoints(width, height));
        const geom = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelSize: depth * 0.12,
            bevelThickness: depth * 0.12,
            bevelSegments: 1
        });
        geom.translate(0, 0, -depth / 2);
        return new THREE.Mesh(geom, mat);
    }

    function makeTriangleFrameMesh(width, height, depth, frame, mat) {
        const outer = makeTriPoints(width, height);
        const innerW = Math.max(0.08, width - frame * 2);
        const innerH = Math.max(0.08, height - frame * 2);
        const innerScaleX = innerW / width;
        const innerScaleY = innerH / height;
        const inner = outer.map(p => new THREE.Vector2(p.x * innerScaleX, p.y * innerScaleY));

        const shape = new THREE.Shape();
        tracePolygon(shape, outer);
        const hole = new THREE.Path();
        tracePolygon(hole, inner.slice().reverse());
        shape.holes.push(hole);

        const geom = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelSize: depth * 0.1,
            bevelThickness: depth * 0.1,
            bevelSegments: 1
        });
        geom.translate(0, 0, -depth / 2);
        return new THREE.Mesh(geom, mat);
    }

    const backPlate = makeTriangleMesh(1.46 * scale, 1.24 * scale, 0.08 * scale, purpleMat);
    backPlate.position.z = -0.04 * scale;
    backPlate.position.y -= 0.04 * scale
    grp.add(backPlate);

    const outerFrame = makeTriangleFrameMesh(1.68 * scale, 1.48 * scale, 0.12 * scale, 0.15 * scale, goldMat);
    outerFrame.position.z = 0.03 * scale;
    grp.add(outerFrame);

    // Small solid apex triangle at very top of emblem face
    const apexTri = makeTriangleMesh(0.26 * scale, 0.20 * scale, 0.07 * scale, goldMat);
    apexTri.position.set(0, 0.57 * scale, 0.07 * scale);
    grp.add(apexTri);

    // Inner triangle frame (~65% of outer)
    const innerFrame = makeTriangleFrameMesh(1.08 * scale, 0.95 * scale, 0.08 * scale, 0.09 * scale, goldMat);
    innerFrame.position.set(0, -0.18 * scale, 0.04 * scale);
    grp.add(innerFrame);

    // Hourglass / "black widow" symbol: two triangle outlines touching tip-to-tip.
    // Upper inverted + lower upright share their apex at y ≈ -0.08*scale.
    const hgW = 0.62 * scale, hgH = 0.38 * scale, hgD = 0.08 * scale, hgF = 0.07 * scale;
    const hgZ = 0.095 * scale;
    // Upper triangle flipped so apex points down; center placed so apex lands at -0.08*scale
    const hourglassTop = makeTriangleFrameMesh(hgW, hgH, hgD, hgF, goldMat);
    hourglassTop.position.set(0, -0.05 * scale, hgZ); // apex-down at 0.11 - hgH/2 = -0.08 ✓
    hourglassTop.rotation.z = Math.PI;
    grp.add(hourglassTop);
    // Lower triangle apex points up; center placed so apex lands at -0.08*scale
    const hourglassBot = makeTriangleFrameMesh(hgW, hgH, hgD, hgF, goldMat);
    hourglassBot.position.set(0, -0.36 * scale, hgZ); // apex-up at -0.27 + hgH/2 = -0.08 ✓
    grp.add(hourglassBot);

    const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.13 * scale, 0.035 * scale, 10, 20), goldDarkMat);
    hanger.position.set(0, 0.885 * scale, 0.03 * scale);
    grp.add(hanger);

    const hangerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.13 * scale, 10), goldMat);
    hangerCollar.position.set(0, 0.74 * scale, 0.03 * scale);
    grp.add(hangerCollar);

    const stemTop = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.1 * scale, 0.16 * scale, 10), goldMat);
    stemTop.position.set(0, -0.8 * scale, 0.02 * scale);
    grp.add(stemTop);

    const stemMid = new THREE.Mesh(new THREE.CylinderGeometry(0.085 * scale, 0.055 * scale, 0.18 * scale, 10), goldDarkMat);
    stemMid.position.set(0, -0.95 * scale, 0.02 * scale);
    grp.add(stemMid);

    const gemCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.1 * scale, 0.1 * scale, 10), goldMat);
    gemCap.position.set(0, -1.07 * scale, 0.02 * scale);
    grp.add(gemCap);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15 * scale, 0), gemMat);
    gem.position.set(0, -1.19 * scale, 0.02 * scale);
    gem.scale.y = 1.35;
    grp.add(gem);

    // Glow light
    const glow = new THREE.PointLight(0xaa33ff, 0, 10);
    glow.position.set(0, -0.12 * scale, 0.4 * scale);
    glow.userData.isTalismanGlow = true;
    grp.add(glow);

    enableMeshShadows(grp);
    return grp;
}

function getAk47MuzzleWorldPosition(aimDir) {
    if (playerAk47Muzzle && playerAk47 && playerAk47.visible && player.visible) {
        return playerAk47Muzzle.getWorldPosition(new THREE.Vector3());
    }
    return camera.position.clone().addScaledVector(aimDir, 1.5);
}

function getAk47CrosshairHitPoint(maxRange = AK47_BEAM_MAX_VISUAL_RANGE) {
    const raycaster = new THREE.Raycaster();
    raycaster.near = getCameraPlayerHitMinDistance();
    raycaster.far = maxRange;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const excludeUUIDs = new Set();
    if (player) player.traverse(obj => excludeUUIDs.add(obj.uuid));

    const hits = raycaster.intersectObjects(scene.children, true)
        .filter(h =>
            !excludeUUIDs.has(h.object.uuid) &&
            !h.object.userData.isBeam &&
            !h.object.userData.isHitboxDebug
        );

    if (hits.length > 0) return hits[0].point.clone();
    return camera.position.clone().addScaledVector(raycaster.ray.direction, maxRange);
}

function triggerAk47ShotFX(aimDir, hits, beamEndPoint = null) {
    if (!ak47Collected || !ak47Equipped) return;




    // ########## Bullet beam [START] ##########

    const beamStart = getAk47MuzzleWorldPosition(aimDir);

    const firstHitDistance = hits.length > 0 ? hits[0].projected : AK47_BEAM_MAX_VISUAL_RANGE;
    const crosshairDistance = beamEndPoint
        ? camera.position.distanceTo(beamEndPoint)
        : AK47_BEAM_MAX_VISUAL_RANGE;
    const visualStopDistance = Math.min(firstHitDistance, crosshairDistance);

    const beamDistance = Math.min(AK47_BEAM_MAX_VISUAL_RANGE, Math.max(0.8, visualStopDistance));
    const beamEnd = (beamEndPoint && crosshairDistance <= beamDistance + 0.001)
        ? beamEndPoint.clone()
        : camera.position.clone().addScaledVector(aimDir, beamDistance);
    const beamVector = beamEnd.clone().sub(beamStart);
    const visualBeamLength = beamVector.length();
    const visualBeamDir = beamVector.clone().normalize();


    // thickness of beam
    const beamRadius = 0.025;

    const beamGeometry = new THREE.CylinderGeometry(
        beamRadius,
        beamRadius,
        visualBeamLength,
        6,
        1,
        false
    );

    const beamMaterial = new THREE.MeshBasicMaterial({
        color: AK47_BEAM_COLOR,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.userData.ignoreCameraOcclusion = true;
    beam.userData.isBeam = true;

    // position beam between start and end
    const midPoint = beamStart.clone().add(beamEnd).multiplyScalar(0.5);
    beam.position.copy(midPoint);

    // orient beam to match direction
    beam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        visualBeamDir
    );

    beam.frustumCulled = false;
    beam.renderOrder = 60;

    scene.add(beam);

    ak47Beams.push({
        mesh: beam,
        life: AK47_BEAM_LIFETIME
    });

    // ########## Bullet beam [END] ##########




    ak47MuzzleFlashTimer = AK47_MUZZLE_FLASH_LIFETIME;
    ak47MuzzleLightTimer = AK47_MUZZLE_LIGHT_LIFETIME;
    if (ak47MuzzleFlash) {
        ak47MuzzleFlash.visible = true;
        ak47MuzzleFlash.material.opacity = 1;
        const scale = 0.75 + Math.random() * 1.25;
        const scaleZ = 0.75 + Math.random() * 1.25;
        ak47MuzzleFlash.scale.set(scale, scale, scaleZ);
    }
    if (ak47MuzzleLight) {
        ak47MuzzleLight.intensity = 8;
        ak47MuzzleLight.distance = 25 + Math.random() * 5;
    }
}

function updateAK47Effects(delta) {
    syncHandItemVisuals();

    if (akChest && akChest.lidPivot) {
        const targetAngle = akChest.lidTargetAngle || 0;
        const speed = akChest.lidSpeed || Math.PI * 2.4;
        akChest.lidPivot.rotation.x = moveScalarToward(
            akChest.lidPivot.rotation.x,
            targetAngle,
            speed * delta
        );
    }

    if (ak47MuzzleFlashTimer > 0) {
        ak47MuzzleFlashTimer = Math.max(0, ak47MuzzleFlashTimer - delta);
        if (ak47MuzzleFlash) {
            ak47MuzzleFlash.visible = true;
            ak47MuzzleFlash.material.opacity = 1;
        }
    } else {
        if (ak47MuzzleFlash) ak47MuzzleFlash.visible = false;
    }

    if (ak47MuzzleLightTimer > 0) {
        ak47MuzzleLightTimer = Math.max(0, ak47MuzzleLightTimer - delta);
        if (ak47MuzzleLight) ak47MuzzleLight.intensity = 8;
    } else {
        if (ak47MuzzleLight) ak47MuzzleLight.intensity = 0;
    }

    for (let i = ak47Beams.length - 1; i >= 0; i--) {
        const beamData = ak47Beams[i];
        if (beamData.life > 0) {
            beamData.life = Math.max(0, beamData.life - delta);
            beamData.mesh.material.opacity = 1;
            continue;
        }

        if (beamData.life <= 0) {
            scene.remove(beamData.mesh);
            beamData.mesh.geometry.dispose();
            beamData.mesh.material.dispose();
            ak47Beams.splice(i, 1);
        }
    }
}

const AK_CHEST_INTERACT_DIST = 5;
const _punchPlayerMid = new THREE.Vector3();

function isPlayerCloseEnoughToAkChest() {
    if (!akChest || !player) return false;
    const dx = player.position.x - akChest.worldX;
    const dy = player.position.y - akChest.worldY;
    const dz = player.position.z - akChest.worldZ;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= AK_CHEST_INTERACT_DIST;
}

function tryInteractWithAkChest(aimDir, range) {
    if (!akChest || akChest.collected) return false;

    const rayRange = getMeleeRayRange(range);
    if (!rayHitObjectProfileFromCamera(aimDir, akChest.mesh, rayRange, range)) return false;

    if (!isPlayerCloseEnoughToAkChest()) return false;

    if (!akChest.opened) {
        if (DEBUG_CHEST || hasGoldenKey) {
            akChest.opened = true;
            akChest.lidTargetAngle = akChest.lidOpenAngle ?? -Math.PI * 0.65;
            syncHandItemVisuals();
        }
    } else if (!akChest.collected) {
        akChest.collected = true;
        ak47Collected = true;
        addHandSlot('ak47');
        syncHandItemVisuals();
        flashEquipHint('AK47');
        updateMenuPanels();
    }
    return true;
}

function getMeleeRayRange(punchRange) {
    return punchRange + camera.position.distanceTo(player.position);
}

function rayHitObjectProfileFromCamera(aimDir, root, maxDistance, playerReach = null, options = {}) {
    if (!root) return null;
    const profile = options.profile || root.userData[options.profileKey || 'hitProfile'];
    if (!profile) return null;
    const hit = _meleeRayHit(camera.position, aimDir, root, profile, maxDistance, Infinity, (options.radiusExtra || 0) + (options.perpExtra || 0));
    if (!hit) return null;
    if (playerReach !== null && !isHitWithinPlayerReach(hit, playerReach)) return null;
    return hit;
}

// Respects USE_GAP_CHECK. Used by all melee/punch hit detection; AK47 and dragon
// beam have their own paths and are not affected.
function _meleeRayHit(rayOrigin, rayDir, root, profile, maxDist, playerReach = Infinity, radiusExtra = 0) {
    return USE_GAP_CHECK
        ? rayHitProfileBeyondCameraPlayerGap(rayOrigin, rayDir, root, profile, maxDist, playerReach, radiusExtra)
        : rayHitProfile(rayOrigin, rayDir, root, profile, maxDist, radiusExtra);
}

function getDragonMountHit(aimDir, punchRange, punchRayRange) {
    if (!dragon || !dragon.visible || mountedOnDragon || demonApocalypse) return null;
    const profile = dragon.userData.mountHitProfile;
    if (!profile) return null;
    // Use rayHitProfile (no gap filter) so that hovering directly overhead doesn't
    // get falsely rejected: the gap filter's hit-point lands behind the player when
    // the camera ray hits the near face of the horizontal body capsule, and the
    // capsule-vs-player-capsule overlap test then barely misses. Reach gating via
    // isHitWithinPlayerReach is sufficient to validate the interaction.
    const hit = rayHitProfile(camera.position, aimDir, dragon, profile, punchRayRange);
    if (!hit || !isHitWithinPlayerReach(hit, punchRange)) return null;
    return hit;
}

function getNPCCombatProfile(npc) {
    return npc.hitProfile || {
        shape: 'sphere',
        center: { x: 0, y: 0, z: 0 },
        fixedWorldRadius: getNPCHitRadius(npc)
    };
}

function getDemonCombatProfile(demon) {
    return demon.hitProfile || {
        shape: 'sphere',
        center: { x: 0, y: demon.gunHitCenterY ?? 4.8, z: 0 },
        fixedWorldRadius: demon.gunHitRadius ?? 4.6
    };
}

// Perpendicular distance from worldPt to the forward aim ray.
// Returns Infinity if the point is behind the ray origin.
function _aimRayPerpDist(rayOrigin, rayDir, worldPt) {
    const toP = worldPt.clone().sub(rayOrigin);
    const along = toP.dot(rayDir);
    if (along < 0) return Infinity;
    return Math.sqrt(Math.max(0, toP.lengthSq() - along * along));
}

// Minimum perpendicular distance from the aim ray to segment [segA, segB].
// Returns { dist, closestPt } where closestPt is the point on the segment closest to the ray.
function _aimRayPerpDistToSeg(rayOrigin, rayDir, segA, segB) {
    const ab = segB.clone().sub(segA);
    const toA = segA.clone().sub(rayOrigin);

    // Perpendicular component of ab relative to the ray direction
    const ab_along = ab.dot(rayDir);
    const abPerp = ab.clone().addScaledVector(rayDir, -ab_along);
    const abPerpLenSq = abPerp.dot(abPerp);

    let t;
    if (abPerpLenSq < 1e-10) {
        t = 0; // segment nearly parallel to ray — all points equally close
    } else {
        const toA_along = toA.dot(rayDir);
        const toAPerp = toA.clone().addScaledVector(rayDir, -toA_along);
        t = Math.max(0, Math.min(1, -toAPerp.dot(abPerp) / abPerpLenSq));
    }

    const closestPt = segA.clone().addScaledVector(ab, t);
    return { dist: _aimRayPerpDist(rayOrigin, rayDir, closestPt), closestPt };
}

// Perpendicular-distance fallback for sword hit detection.
// If the aim ray passes within (shapeRadius + perpExtra) of the hit shape, returns a synthetic
// hit whose .point is the shape center/axis point closest to the ray — so isHitWithinPlayerReach
// gates on the actual target distance, not on the inflated surface.
// Returns null if the perp check fails or the shape is not sphere/capsule.
function _checkPerpFallback(rayOrigin, rayDir, root, profile, perpExtra) {
    if (!root || !profile || perpExtra <= 0) return null;
    root.updateMatrixWorld(true);

    if (profile.shape === 'compound') {
        for (const sub of (profile.profiles || [])) {
            const hit = _checkPerpFallback(rayOrigin, rayDir, root, sub, perpExtra);
            if (hit) return hit;
        }
        return null;
    }

    if (profile.shape === 'sphere') {
        const center = localHitPointToWorld(root, profile.center || { x: 0, y: 0, z: 0 });
        const radius = getHitProfileWorldRadius(root, profile.radius, profile.fixedWorldRadius, 0);
        if (_aimRayPerpDist(rayOrigin, rayDir, center) > radius + perpExtra) return null;
        return { distance: 0, point: center };
    }

    if (profile.shape === 'capsule') {
        const a = localHitPointToWorld(root, profile.start || { x: 0, y: 0, z: 0 });
        const b = localHitPointToWorld(root, profile.end || { x: 0, y: 0, z: 0 });
        const radius = getHitProfileWorldRadius(root, profile.radius, profile.fixedWorldRadius, 0);
        const { dist, closestPt } = _aimRayPerpDistToSeg(rayOrigin, rayDir, a, b);
        if (dist > radius + perpExtra) return null;
        return { distance: 0, point: closestPt };
    }

    return null;
}

function getMeleeKillableCandidates(aimDir, punchRange, punchRayRange, perpExtra = 0) {
    const candidates = [];

    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const profile = getNPCCombatProfile(npc);
        const hit = _meleeRayHit(camera.position, aimDir, npc.mesh, profile, punchRayRange, punchRange, perpExtra);
        if (!hit || !isHitWithinPlayerReach(hit, punchRange)) continue;
        candidates.push({ kind: 'npc', npc, dist: hit.point.distanceTo(_punchPlayerMid) });
    }

    const demonPunchRange = 9;
    const demonPunchRayRange = getMeleeRayRange(demonPunchRange);
    for (let i = 0; i < demons.length; i++) {
        const demon = demons[i];
        const profile = getDemonCombatProfile(demon);
        const hit = _meleeRayHit(camera.position, aimDir, demon.mesh, profile, demonPunchRayRange, demonPunchRange, perpExtra);
        if (!hit || !isHitWithinPlayerReach(hit, demonPunchRange)) continue;
        candidates.push({ kind: 'demon', demon, dist: hit.point.distanceTo(_punchPlayerMid) });
    }

    const creatureCandidates = getMeleeCreatureCandidates(aimDir, punchRange, _punchPlayerMid, perpExtra);
    for (const candidate of creatureCandidates) {
        candidates.push({ kind: 'creature', creature: candidate.creature, dist: candidate.dist });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates;
}

function resolveMeleeKillableCandidate(candidate) {
    if (!candidate) return { hit: false, killed: false };

    if (candidate.kind === 'npc') {
        const curIdx = npcs.indexOf(candidate.npc);
        if (curIdx === -1) return { hit: false, killed: false };
        explodeNPC(candidate.npc, curIdx);
        return { hit: true, killed: true };
    }

    if (candidate.kind === 'demon') {
        const curIdx = demons.indexOf(candidate.demon);
        if (curIdx === -1) return { hit: false, killed: false };
        explodeDemon(candidate.demon, curIdx);
        return { hit: true, killed: true };
    }

    if (candidate.kind === 'creature') {
        const wasAlive = typeof nightCreatures !== 'undefined' && nightCreatures.includes(candidate.creature);
        meleeHitCreature(candidate.creature);
        const killed = wasAlive && !nightCreatures.includes(candidate.creature);
        return { hit: true, killed };
    }

    return { hit: false, killed: false };
}

function getMeleeAltarCorpseHit(aimDir, punchRange, punchRayRange, perpExtra = 0) {
    if (!altarData || altarCorpseStruck || altarState !== 'torches_lit') return null;

    const profile = altarData.corpse.userData.hitProfile;
    const hit = _meleeRayHit(camera.position, aimDir, altarData.corpse, profile, punchRayRange, punchRange, perpExtra);
    if (!hit || !isHitWithinPlayerReach(hit, punchRange)) return null;
    return hit;
}

function getMeleeAltarLightningCandidate(aimDir, punchRange, punchRayRange, perpExtra = 0) {
    if (typeof _altarIsNight === 'function' && !_altarIsNight()) return null;

    const hit = getMeleeAltarCorpseHit(aimDir, punchRange, punchRayRange, perpExtra);
    if (!hit) return null;
    return { kind: 'altar', dist: hit.point.distanceTo(_punchPlayerMid) };
}

function getMeleeHHAngelCandidate(aimDir, punchRange, punchRayRange, perpExtra = 0) {
    if (typeof hhAngels === 'undefined' || hhAngels.length === 0) return null;

    const candidates = [];
    for (const angel of hhAngels) {
        if (!angel.mesh || angel.touchTriggered) continue;
        if (angel.specialFirst && !hhFirstAngelApproaching) continue;

        const profile = angel.hitProfile || {
            shape: 'capsule',
            start: { x: 0, y: 0.35, z: -0.08 },
            end: { x: 0, y: 3.25, z: -0.05 },
            radius: 0.62
        };
        const hit = _meleeRayHit(camera.position, aimDir, angel.mesh, profile, punchRayRange, punchRange, perpExtra);
        if (!hit || !isHitWithinPlayerReach(hit, punchRange)) continue;
        candidates.push({ dist: hit.point.distanceTo(_punchPlayerMid) });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0] || null;
}

function addMeleeObjectInteractionCandidate(candidates, kind, aimDir, root, punchRayRange, punchRange, resolve, options = {}) {
    const hit = rayHitObjectProfileFromCamera(aimDir, root, punchRayRange, punchRange, options);
    if (!hit) return;
    candidates.push({ intent: 'interaction', kind, dist: hit.point.distanceTo(_punchPlayerMid), resolve });
}

function getMeleeInteractionCandidates(aimDir, punchRange, punchRayRange, isSwordAttack, perpExtra = 0) {
    const candidates = [];

    if (!hasShovel && tentShovelMesh) {
        addMeleeObjectInteractionCandidate(candidates, 'shovelPickup', aimDir, tentShovelMesh, punchRayRange, punchRange, () => {
            hasShovel = true;
            tentShovelMesh.parent.remove(tentShovelMesh);
            tentShovelMesh = null;
            addHandSlot('shovel');
            syncHandItemVisuals();
            flashEquipHint('Shovel');
            return true;
        }, { perpExtra });
    }

    if (goldenKeyMesh && goldenKeyLockTimer <= 0) {
        addMeleeObjectInteractionCandidate(candidates, 'goldenKeyPickup', aimDir, goldenKeyMesh, punchRayRange, punchRange, () => {
            hasGoldenKey = true;
            scene.remove(goldenKeyMesh);
            goldenKeyMesh = null;
            addInventoryItem('golden-key', 'Golden Key', null, { type: 'object', itemKey: 'golden-key' });
            flashEquipHint('KEY FOUND');
            return true;
        }, { perpExtra });
    }

    if (akChest && !akChest.collected) {
        const chestHit = rayHitObjectProfileFromCamera(aimDir, akChest.mesh, punchRayRange, punchRange, { perpExtra });
        if (chestHit && isPlayerCloseEnoughToAkChest()) {
            candidates.push({
                intent: 'interaction',
                kind: 'akChest',
                dist: chestHit.point.distanceTo(_punchPlayerMid),
                resolve: () => tryInteractWithAkChest(aimDir, punchRange)
            });
        }
    }

    for (const door of houseDoors) {
        const hit = rayHitObjectProfileFromCamera(aimDir, door.mesh, punchRayRange, punchRange, { perpExtra });
        if (!hit) continue;
        candidates.push({
            intent: 'interaction',
            kind: 'door',
            dist: hit.point.distanceTo(_punchPlayerMid),
            resolve: () => {
                toggleHouseDoor(door);
                return true;
            }
        });
    }

    const noteCandidates = [];
    if (typeof volcanoHintNoteMesh !== 'undefined' && volcanoHintNoteMesh && !volcanoHintNotePickedUp) {
        noteCandidates.push(volcanoHintNoteMesh);
    }
    if (typeof keyHintNoteMesh !== 'undefined' && keyHintNoteMesh && !keyHintNotePickedUp && keyHintNoteLockTimer <= 0) {
        noteCandidates.push(keyHintNoteMesh);
    }
    for (const noteMesh of noteCandidates) {
        addMeleeObjectInteractionCandidate(candidates, 'notePickup', aimDir, noteMesh, punchRayRange, punchRange, () => {
            return tryPickupNote(aimDir, punchRange);
        }, { perpExtra });
    }

    if (typeof hauntedHouseData !== 'undefined' && hauntedHouseData && hhSeqPhase === 'active' && hauntedHouseData.ssItemGrp) {
        const ssTargets = [hauntedHouseData.worldSword, hauntedHouseData.worldShield].filter(Boolean);
        for (const target of ssTargets) {
            addMeleeObjectInteractionCandidate(candidates, 'swordShieldPickup', aimDir, target, punchRayRange, punchRange, () => {
                return tryPickupSSItem(aimDir, punchRange);
            }, { perpExtra });
        }
    }

    if (typeof cemeteryData !== 'undefined' && cemeteryData && cemeteryData.gatePivotL && !cemeteryData.gatesLocked) {
        for (const gateTarget of [cemeteryData.gatePivotL, cemeteryData.gatePivotR]) {
            const hit = rayHitObjectProfileFromCamera(aimDir, gateTarget, punchRayRange, punchRange, { perpExtra });
            if (!hit) continue;
            candidates.push({
                intent: 'interaction',
                kind: 'cemeteryGate',
                dist: hit.point.distanceTo(_punchPlayerMid),
                resolve: () => tryToggleCemeteryGate(aimDir, punchRange)
            });
        }
    }

    if (typeof talismanItemMesh !== 'undefined' && talismanItemMesh && talismanLockTimer <= 0) {
        addMeleeObjectInteractionCandidate(candidates, 'talismanPickup', aimDir, talismanItemMesh, punchRayRange, punchRange, () => {
            return tryPickupTalisman(aimDir, punchRange);
        }, { perpExtra });
    }

    if (isSwordAttack && typeof tryHitHHWhiteSM === 'function') {
        const angelHit = getMeleeHHAngelCandidate(aimDir, punchRange, punchRayRange, perpExtra);
        if (angelHit) {
            candidates.push({
                intent: 'interaction',
                kind: 'hhAngel',
                dist: angelHit.dist,
                resolve: () => tryHitHHWhiteSM(aimDir, punchRange, perpExtra)
            });
        }
    }

    if (isSwordAttack && (swordAuraActive || DEBUG_SWORD_THUNDER_INF) && typeof _altarIsNight === 'function' && !_altarIsNight()) {
        const altarCorpseHit = getMeleeAltarCorpseHit(aimDir, punchRange, punchRayRange, perpExtra);
        if (altarCorpseHit) {
            candidates.push({
                intent: 'interaction',
                kind: 'altarCorpseDayFeedback',
                dist: altarCorpseHit.point.distanceTo(_punchPlayerMid),
                resolve: () => tryHitAltarCorpseWithLightning(aimDir, punchRange)
            });
        }
    }

    if (typeof _isSpecialPortalBodyVulnerable === 'function' && _isSpecialPortalBodyVulnerable()) {
        specialPortalFrameData.group.updateMatrixWorld(true);
        const nooseProfile = _getSpecialPortalBodyHitProfile();
        const hit = _meleeRayHit(camera.position, aimDir, specialPortalFrameData.body, nooseProfile, punchRayRange, punchRange, perpExtra);
        if (hit && isHitWithinPlayerReach(hit, punchRange)) {
            candidates.push({
                intent: 'interaction',
                kind: 'nooseBody',
                dist: hit.point.distanceTo(_punchPlayerMid),
                resolve: () => damageSpecialPortalHangingBody()
            });
        }
    }

    if (currentHandItem === 'stick' && hasStick) {
        for (const cpPos of campfirePositions) {
            const cpRoot = cpPos.userData?.hitRoot;
            const cpProfile = cpPos.userData?.hitProfile;
            const hit = _meleeRayHit(camera.position, aimDir, cpRoot, cpProfile, punchRayRange, punchRange, perpExtra);
            if (!hit || !isHitWithinPlayerReach(hit, punchRange)) continue;
            candidates.push({
                intent: 'interaction',
                kind: 'campfire',
                dist: hit.point.distanceTo(_punchPlayerMid),
                resolve: () => {
                    hasStick = false;
                    hasTorch = true;
                    addHandSlot('torch', 'stick');
                    syncHandItemVisuals();
                    flashEquipHint('Torch');
                    return true;
                }
            });
        }
    }

    if (currentHandItem === 'torch' && hasTorch && typeof altarData !== 'undefined' && altarData && altarTorchesLit < 3) {
        for (let i = 0; i < altarData.torches.length; i++) {
            if (altarData.torches[i].lit) continue;
            const hit = rayHitObjectProfileFromCamera(aimDir, altarData.torchHitRoots[i], punchRayRange, punchRange, { perpExtra });
            if (!hit) continue;
            candidates.push({
                intent: 'interaction',
                kind: 'altarTorch',
                dist: hit.point.distanceTo(_punchPlayerMid),
                resolve: () => tryLightAltarTorch(aimDir, punchRange)
            });
        }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates;
}


function fireAK47() {
    if (!ak47Collected || !ak47Equipped || playerDead || mountedOnDragon) return;

    const now = performance.now();
    if (now - lastAk47ShotAt < AK47_SHOT_INTERVAL_MS) return;
    lastAk47ShotAt = now;

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const aimDir = new THREE.Vector3();
    camera.getWorldDirection(aimDir);
    const beamEndPoint = getAk47CrosshairHitPoint();

    const hits = [];

    npcs.forEach(npc => {
        const hit = rayHitProfileBeyondCameraPlayerGap(camera.position, aimDir, npc.mesh, getNPCCombatProfile(npc), AK47_BEAM_MAX_VISUAL_RANGE, Infinity, AK47_BEAM_HIT_MARGIN);
        if (hit) hits.push({ kind: 'npc', target: npc, projected: hit.distance });
    });

    demons.forEach(demon => {
        const hit = rayHitProfileBeyondCameraPlayerGap(camera.position, aimDir, demon.mesh, getDemonCombatProfile(demon), AK47_BEAM_MAX_VISUAL_RANGE, Infinity, AK47_BEAM_HIT_MARGIN);
        if (hit) hits.push({ kind: 'demon', target: demon, projected: hit.distance });
    });

    hits.push(...getCreatureGunHits(aimDir, AK47_BEAM_MAX_VISUAL_RANGE, AK47_BEAM_HIT_MARGIN));
    if (typeof getSpecialPortalBodyGunHits === 'function') {
        hits.push(...getSpecialPortalBodyGunHits(aimDir));
    }
    hits.sort((a, b) => a.projected - b.projected);
    triggerAk47ShotFX(aimDir, hits, beamEndPoint);

    let penetratedDemons = 0;
    let penetratedCreatures = 0;
    for (const hit of hits) {
        if (hit.kind === 'nooseBody') {
            damageSpecialPortalHangingBody();
            continue;
        }

        if (hit.kind === 'creature') {
            if (penetratedCreatures >= 3) break;
            penetratedCreatures++;
            damageCreatureFromGun(hit.target);
            continue;
        }

        if (hit.kind === 'npc') {
            const idx = npcs.indexOf(hit.target);
            if (idx !== -1) explodeNPC(hit.target, idx);
            continue;
        }

        if (penetratedDemons >= 3) break; // 4th demon blocks all remaining damage.
        penetratedDemons++;

        const idx = demons.indexOf(hit.target);
        if (idx === -1) continue;
        hit.target.gunShotsToKill = Math.max(0, (hit.target.gunShotsToKill ?? 2) - 1);
        if (hit.target.gunShotsToKill <= 0) {
            explodeDemon(hit.target, idx);
        }
    }
}

function punch() {
    if (playerDead) return;

    if (mountedOnDragon) {
        dragonBeamAttack();
        return;
    }

    // Punch animation always fires first — sword shows swipe arc, fist/tool shows radial ring
    if (currentHandItem === 'sword-shield') {
        triggerSwordSwipe();
    } else {
        const ring = document.getElementById('punch-ring');
        ring.classList.remove('punch-ring-active');
        void ring.offsetWidth; // force reflow
        ring.classList.add('punch-ring-active');
    }

    const punchRange = 7.5;
    const aimDir = new THREE.Vector3();
    camera.getWorldDirection(aimDir);
    const punchRayRange = getMeleeRayRange(punchRange);
    _punchPlayerMid.set(player.position.x, player.position.y + PLAYER_COLLISION_HEIGHT * 0.5, player.position.z);

    // Shrine interaction — no candidate needed, has its own distance gate
    if (shrineActive && shrine && player.position.distanceTo(shrine.position) < SHRINE_INTERACT_DIST) {
        const shrineHit = rayHitObjectProfileFromCamera(aimDir, shrine, punchRayRange, punchRange);
        if (shrineHit) {
            startDemonRound(1);
            return;
        }
    }

    // Extra candidates: dragon mount, debug box, dig zones, trees
    const extraCandidates = [];

    const dragonMountHit = getDragonMountHit(aimDir, punchRange, punchRayRange);
    if (dragonMountHit) {
        extraCandidates.push({
            intent: 'interaction',
            kind: 'dragonMount',
            dist: dragonMountHit.point.distanceTo(_punchPlayerMid),
            resolve: () => mountDragon()
        });
    }

    // DEBUG_GOLDEN_KEY: punchable box — 3 hits reveals the golden key
    if (debugKeyBox) {
        const boxHit = rayHitObjectProfileFromCamera(aimDir, debugKeyBox.mesh, punchRayRange, punchRange);
        if (boxHit) {
            extraCandidates.push({
                intent: 'interaction',
                kind: 'debugKeyBox',
                dist: boxHit.point.distanceTo(_punchPlayerMid),
                resolve: () => {
                    debugKeyBox.hitCount++;
                    if (debugKeyBox.hitCount >= 3) {
                        const pos = debugKeyBox.mesh.position.clone();
                        scene.remove(debugKeyBox.mesh);
                        debugKeyBox = null;
                        digCount = 31;
                        spawnGoldenKey(pos.x, pos.y, pos.z);
                    } else {
                        const origColor = debugKeyBox.mesh.material.color.getHex();
                        debugKeyBox.mesh.material.color.setHex(0xffffff);
                        setTimeout(() => { if (debugKeyBox) debugKeyBox.mesh.material.color.setHex(origColor); }, 80);
                    }
                }
            });
        }
    }

    if (currentHandItem === 'shovel' && bigLake && !hasGoldenKey && digCount < 31 && !goldenKeyMesh) {
        const digHit = bigLake.digHitRoot
            ? rayHitObjectProfileFromCamera(aimDir, bigLake.digHitRoot, punchRayRange, punchRange)
            : null;
        if (digHit) {
            extraCandidates.push({
                intent: 'interaction',
                kind: 'shovelDig',
                dist: digHit.point.distanceTo(_punchPlayerMid),
                resolve: () => tryDig(aimDir, punchRange, punchRayRange)
            });
        }
    }

    if (currentHandItem === 'shovel') {
        if (typeof cemeteryData !== 'undefined' && cemeteryData && !hasTalisman && !talismanItemMesh && cemeteryData.talismanGraveHitRoot) {
            const graveHit = rayHitObjectProfileFromCamera(aimDir, cemeteryData.talismanGraveHitRoot, punchRayRange);
            if (graveHit && isHitWithinPlayerReach(graveHit, punchRange)) {
                extraCandidates.push({
                    intent: 'interaction',
                    kind: 'graveDig',
                    dist: graveHit.point.distanceTo(_punchPlayerMid),
                    resolve: () => tryDigTalismanGrave(aimDir, punchRange, punchRayRange)
                });
            }
        }
    }

    // Tree hit — both world trees and large dark forest trees can yield a stick after enough hits
    if ((currentHandItem === 'fist' || (hasShovel && currentHandItem === 'shovel')) && !hasStick && !hasTorch) {
        for (const tree of trees) {
            const hit = rayHitObjectProfileFromCamera(aimDir, tree, punchRayRange, punchRange);
            if (!hit) continue;
            const capturedTree = tree;
            const capturedPoint = hit.point.clone();
            extraCandidates.push({
                intent: 'interaction',
                kind: 'treeHit',
                dist: hit.point.distanceTo(_punchPlayerMid),
                resolve: () => {
                    capturedTree.userData.treeHitCount = (capturedTree.userData.treeHitCount || 0) + 1;
                    spawnWoodSplinterEffect(capturedPoint);
                    if (capturedTree.userData.treeHitCount >= STICK_TREE_HITS_REQUIRED) {
                        capturedTree.userData.treeHitCount = 0;
                        hasStick = true;
                        addHandSlot('stick');
                        syncHandItemVisuals();
                        flashEquipHint('Stick');
                    }
                }
            });
        }
    }

    // Sword swipe hits up to 3 targets; regular melee hits 1
    const isSwordAttack = currentHandItem === 'sword-shield';
    const maxMeleeHits = isSwordAttack ? 3 : 1;
    const meleePerpExtra = isSwordAttack ? 1.5 : 0;
    const killableCandidates = getMeleeKillableCandidates(aimDir, punchRange, punchRayRange, meleePerpExtra);
    const interactionCandidates = getMeleeInteractionCandidates(aimDir, punchRange, punchRayRange, isSwordAttack, meleePerpExtra);
    const altarLightningCandidate = isSwordAttack && (swordAuraActive || DEBUG_SWORD_THUNDER_INF)
        ? getMeleeAltarLightningCandidate(aimDir, punchRange, punchRayRange, meleePerpExtra)
        : null;
    const intentCandidates = [
        killableCandidates[0] ? { intent: 'killable', dist: killableCandidates[0].dist } : null,
        altarLightningCandidate ? { intent: 'killable', kind: 'altar', dist: altarLightningCandidate.dist } : null,
        ...interactionCandidates,
        ...extraCandidates
    ].filter(Boolean).sort((a, b) => a.dist - b.dist);
    const bestIntent = intentCandidates[0] || null;

    if (!bestIntent) return;

    if (bestIntent.intent === 'interaction') {
        bestIntent.resolve();
        return;
    }

    if (isSwordAttack && (swordAuraActive || DEBUG_SWORD_THUNDER_INF)) {
        const allCandidates = [
            ...killableCandidates.map(candidate => ({ kind: candidate.kind, ref: candidate, dist: candidate.dist })),
            altarLightningCandidate,
        ].filter(Boolean).sort((a, b) => a.dist - b.dist);

        const firstTarget = allCandidates[0] || null;

        if (firstTarget) {
            if (firstTarget.kind === 'altar') {
                triggerLightningStrike(altarData.corpseHitPos);
                _triggerAltarCorpseStrike();
            } else if (firstTarget.kind === 'creature') {
                triggerLightningStrike(firstTarget.ref.creature.mesh.position.clone());
            } else {
                const strikePos = (firstTarget.ref.npc || firstTarget.ref.demon).mesh.position.clone();
                triggerLightningStrike(strikePos);
            }
            if (!DEBUG_SWORD_THUNDER_INF) _deactivateSwordAura();
            swordPostAuraKills = 0;
            // Lightning AoE kills everything — skip normal hit loop
        }
    } else {
        // Normal kill path; track sword kills toward 100-kill aura recharge
        let swordKillsThisSwing = 0;

        killableCandidates.slice(0, maxMeleeHits).forEach(candidate => {
            const result = resolveMeleeKillableCandidate(candidate);
            if (isSwordAttack && result.killed) swordKillsThisSwing++;
        });

        if (isSwordAttack && hasSwordShield && swordKillsThisSwing > 0) {
            const swordAuraRechargeKills = DEBUG_SWORD_THUNDER_TRANSITION ? 1 : 100;
            swordPostAuraKills += swordKillsThisSwing;
            if (swordPostAuraKills >= swordAuraRechargeKills) {
                swordPostAuraKills -= swordAuraRechargeKills;
                _reactivateSwordAura();
            }
        }
    }
}

function toggleHouseDoor(door) {
    if (door.targetAngle === 0) {
        // Open inward
        door.targetAngle = Math.PI / 2;
        door.isOpen = true;
        if (door.wallEntry) door.wallEntry.active = false;
    } else {
        // Close — wall re-activates once fully shut (handled in updateDoors)
        door.targetAngle = 0;
        door.isOpen = false;
    }
}


function flashEquipHint(label) {
    const el = document.getElementById('equip-hint');
    if (!el) return;
    el.textContent = label;
    el.classList.remove('equip-hint-flash');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('equip-hint-flash');
}


function tryDig(aimDir = null, punchRange = 7.5, punchRayRange = null) {
    if (!bigLake) return false;
    if (!aimDir || !bigLake.digHitRoot) return false;
    const rayRange = punchRayRange ?? getMeleeRayRange(punchRange);
    const hit = rayHitObjectProfileFromCamera(aimDir, bigLake.digHitRoot, rayRange, punchRange);
    if (!hit) return false;
    // Must be near the lake floor
    if (player.position.y > bigLake.floorY + 10) return false;

    digCount++;
    spawnDigParticles(bigLake.x + (Math.random() - 0.5) * 2, bigLake.floorY, bigLake.z + (Math.random() - 0.5) * 2);

    if (digCount >= 31) {
        spawnGoldenKey(bigLake.x, bigLake.floorY + 0.8, bigLake.z);
    }
    return true;
}

function spawnWoodSplinterEffect(hitPoint, hitNormal = null) {
    const count = 20;
    const meshes = [];
    const velocities = [];
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x7A5230, transparent: true, opacity: 1 });
    const outward = hitNormal ? hitNormal.clone() : new THREE.Vector3(0, 0.4, 0);
    if (outward.lengthSq() < 1e-6) outward.set(0, 0.4, 0);
    outward.normalize();
    const spawnBase = hitPoint.clone().addScaledVector(outward, 0.16);
    for (let i = 0; i < count; i++) {
        const len = 0.08 + Math.random() * 0.18;
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, len, 0.04),
            woodMat.clone()
        );
        mesh.position.copy(spawnBase).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.18,
            (Math.random() - 0.5) * 0.18,
            (Math.random() - 0.5) * 0.18
        ));
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.userData.ignoreCameraOcclusion = true;
        scene.add(mesh);
        meshes.push(mesh);
        const vel = outward.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 3,
            (Math.random() - 0.5) * 3
        ));
        velocities.push(vel);
    }
    digParticles.push({ meshes, velocities, life: 0, maxLife: 0.7 });
}

function spawnDigParticles(x, y, z, colorHex) {
    const count = 18;
    const meshes = [];
    const velocities = [];
    const baseHSL = { h: 0, s: 0, l: 0 };
    if (colorHex !== undefined) new THREE.Color(colorHex).getHSL(baseHSL);
    for (let i = 0; i < count; i++) {
        const size = 0.12 + Math.random() * 0.18;
        const color = colorHex !== undefined
            ? new THREE.Color().setHSL(
                baseHSL.h + (Math.random() - 0.5) * 0.02,
                baseHSL.s + (Math.random() - 0.5) * 0.08,
                baseHSL.l + Math.random() * 0.06)
            : new THREE.Color().setHSL(0.07 + Math.random() * 0.05, 0.6, 0.28 + Math.random() * 0.1);
        const mat = new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity: 1
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
        mesh.position.set(
            x + (Math.random() - 0.5) * 1.2,
            y + 0.2,
            z + (Math.random() - 0.5) * 1.2
        );
        scene.add(mesh);
        meshes.push(mesh);
        velocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            3 + Math.random() * 6,
            (Math.random() - 0.5) * 5
        ));
    }
    digParticles.push({ meshes, velocities, life: 0, maxLife: 1.2 });
}

function updateDigParticles(delta) {
    for (let i = digParticles.length - 1; i >= 0; i--) {
        const p = digParticles[i];
        p.life += delta;
        const t = p.life / p.maxLife;
        for (let j = 0; j < p.meshes.length; j++) {
            const m = p.meshes[j];
            m.position.addScaledVector(p.velocities[j], delta);
            p.velocities[j].y -= 12 * delta;
            m.material.opacity = 1 - t;
        }
        if (p.life >= p.maxLife) {
            p.meshes.forEach(m => scene.remove(m));
            digParticles.splice(i, 1);
        }
    }
}

function spawnGoldenKey(x, y, z) {
    goldenKeyMesh = createGoldenKeyMesh();
    goldenKeyBaseY = y;
    goldenKeyMesh.position.set(x, y, z);
    goldenKeyMesh.userData.isGoldenKey = true;
    goldenKeyMesh.userData.ignoreCameraOcclusion = true;
    setObjectHitProfile(goldenKeyMesh, { shape: 'sphere', center: { x: 0, y: 0, z: 0 }, radius: 1.2 }, { debugKey: 'goldenKeyHitboxDebug' });
    const keyLight = new THREE.PointLight(0xFFCC44, 0, 12);
    keyLight.userData.isGoldenKeyLight = true;
    goldenKeyMesh.add(keyLight);
    scene.add(goldenKeyMesh);
    goldenKeySpawnTime = performance.now();
    goldenKeyLockTimer = 3; // exactly 3 oscillations × 1 s each
}

function updateGoldenKey(delta) {
    // DEBUG_GOLDEN_KEY_IN_LAKE: spawn key the first time player reaches the lake floor
    if (DEBUG_GOLDEN_KEY_IN_LAKE && !debugGoldenKeySpawned && !goldenKeyMesh && !hasGoldenKey && bigLake) {
        const dx = player.position.x - bigLake.x;
        const dz = player.position.z - bigLake.z;
        if (Math.abs(dx) < bigLake.cylinderRadius && player.position.y < bigLake.floorY + 10) {
            debugGoldenKeySpawned = true;
            digCount = 31;
            spawnGoldenKey(bigLake.x, bigLake.floorY + 0.8, bigLake.z);
        }
    }

    if (!goldenKeyMesh) return;

    // Spin and bob
    goldenKeyMesh.rotation.y += delta * 1.2;
    goldenKeyMesh.position.y = goldenKeyBaseY + 0.3 + Math.sin(performance.now() / 700) * 0.3;

    // Lock-out countdown with pulsing gold glow + point light
    if (goldenKeyLockTimer > 0) {
        goldenKeyLockTimer = Math.max(0, goldenKeyLockTimer - delta);
        // Phase-locked pulse: starts and ends at 0 over exactly 4 cycles
        const phase = (performance.now() - goldenKeySpawnTime) / 1000 * 2 * Math.PI;
        const pulse = 2 - 2 * Math.cos(phase);
        goldenKeyMesh.traverse(obj => {
            if (obj.userData.isHitboxDebug) return;
            if (obj.isMesh && obj.material) {
                obj.material.emissiveIntensity = 0.4 + pulse * 1.4;
            }
            if (obj.isLight && obj.userData.isGoldenKeyLight) {
                obj.intensity = pulse * 1.5;
            }
        });
    } else {
        // Settled glow once pickable
        goldenKeyMesh.traverse(obj => {
            if (obj.userData.isHitboxDebug) return;
            if (obj.isMesh && obj.material) {
                obj.material.emissiveIntensity = 0.4;
            }
            if (obj.isLight && obj.userData.isGoldenKeyLight) {
                obj.intensity = 0;
            }
        });
    }
}

// ── Lightning strike effect (aurafied sword) ──────────────────────────────────

function triggerLightningStrike(targetPos, options = {}) {
    const boltHeight = 800;
    const boltDurationSec = 1.5;
    
    const killRadius = options.killRadius ?? 50;
    const sphereRadiusFactor = options.sphereRadiusFactor ?? 0.7;
    const ringRadiusFactor = options.ringRadiusFactor ?? 1;
    const sphereEndRadius = options.sphereEndRadius ?? (killRadius * sphereRadiusFactor);
    const ringEndRadius = options.ringEndRadius ?? (killRadius * ringRadiusFactor);
    const baseSphereRadius = 1;
    const baseRingOuterRadius = 1.8;
    const sphereEndScale = Math.max(1, sphereEndRadius / baseSphereRadius);
    const ringEndScale = Math.max(1, ringEndRadius / baseRingOuterRadius);

    const strikeY = targetPos.y;
    const skyY    = targetPos.y + boltHeight;
    const boltGroup = new THREE.Group();
    boltGroup.userData.ignoreCameraOcclusion = true;
    const centerBoltPts = [new THREE.Vector3(targetPos.x, skyY, targetPos.z)];
    const centerBoltSegments = Math.floor(boltHeight/50);
    const jitterAmp = 28;
    const jitterTaper = 0.45;
    for (let s = 1; s < centerBoltSegments; s++) {
        const t = s / centerBoltSegments;
        centerBoltPts.push(new THREE.Vector3(
            targetPos.x + (Math.random() - 0.5) * jitterAmp * (1 - t * jitterTaper),
            skyY + (strikeY - skyY) * t,
            targetPos.z + (Math.random() - 0.5) * jitterAmp * (1 - t * jitterTaper)
        ));
    }
    centerBoltPts.push(new THREE.Vector3(targetPos.x, strikeY, targetPos.z));
    const addSegmentedCenterBolt = (radius, radialSegments, material) => {
        for (let i = 0; i < centerBoltPts.length - 1; i++) {
            const start = centerBoltPts[i];
            const end = centerBoltPts[i + 1];
            const segmentVec = end.clone().sub(start);
            const segmentLen = segmentVec.length();
            if (segmentLen <= 1e-5) continue;

            const segment = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, segmentLen, radialSegments, 1, true),
                material
            );
            segment.position.copy(start).add(end).multiplyScalar(0.5);
            segment.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                segmentVec.normalize()
            );
            segment.frustumCulled = false;
            segment.userData.ignoreCameraOcclusion = true;
            boltGroup.add(segment);
        }
    };

    // Center beam: pure white core plus a pale outer shell, matching the shrine
    // beacon's layered beam treatment while keeping the existing line bolts intact.
    const outerBoltMat = new THREE.MeshBasicMaterial({
        color: 0xc7faff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    outerBoltMat.userData.baseOpacity = outerBoltMat.opacity;
    addSegmentedCenterBolt(0.7, 10, outerBoltMat);

    const coreBoltMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    coreBoltMat.userData.baseOpacity = coreBoltMat.opacity;
    addSegmentedCenterBolt(0.24, 8, coreBoltMat);

    // Three overlapping bolt-line passes: bright white main + two cyan glow variants
    const boltDefs = [
        // { jitter: 10, color: 0xffffff, opacity: 1.0 },
        // { jitter:  6, color: 0x88ddff, opacity: 0.65 },
        // { jitter:  4, color: 0xffffff, opacity: 0.35 },
        { jitter: 12, color: 0xffffff, opacity: 1.0 },
        { jitter: 10, color: 0xbbeeff, opacity: 0.8 },
        { jitter:  8, color: 0x88ddff, opacity: 0.65 },
        { jitter:  6, color: 0xc7efff, opacity: 0.5 },
        { jitter:  4, color: 0xffffff, opacity: 0.35 },
        { jitter:  2, color: 0xc7efff, opacity: 0.2 },
        { jitter: 12, color: 0xffffff, opacity: 1.0 },
        { jitter: 10, color: 0xbbeeff, opacity: 1.0 },
        { jitter:  8, color: 0x88ddff, opacity: 1.0 },
        { jitter:  6, color: 0xaaddff, opacity: 1.0 },
        { jitter:  4, color: 0xffffff, opacity: 1.0 },
        { jitter:  2, color: 0xc7efff, opacity: 1.0 },

        { jitter: 18, color: 0xffffff, opacity: 1.0 },
        { jitter: 10, color: 0xbbeeff, opacity: 0.8 },
        { jitter: 18, color: 0x88ddff, opacity: 0.65 },
        { jitter:  6, color: 0xc7efff, opacity: 0.5 },
        { jitter:  4, color: 0xffffff, opacity: 0.35 },
        { jitter:  2, color: 0xc7efff, opacity: 0.2 },
        { jitter: 12, color: 0xffffff, opacity: 1.0 },
        { jitter: 10, color: 0xbbeeff, opacity: 1.0 },
        { jitter:  8, color: 0x88ddff, opacity: 1.0 },
        { jitter:  6, color: 0xaaddff, opacity: 1.0 },
        { jitter:  4, color: 0xffffff, opacity: 1.0 },
        { jitter:  12, color: 0xc7efff, opacity: 1.0 },

        { jitter: 12, color: 0xffffff, opacity: 1.0 },
        { jitter: 10, color: 0xbbeeff, opacity: 0.8 },
        { jitter:  8, color: 0x88ddff, opacity: 0.65 },
        { jitter:  6, color: 0xc7efff, opacity: 0.5 },
        { jitter:  4, color: 0xffffff, opacity: 0.35 },
        { jitter:  2, color: 0xc7efff, opacity: 0.2 },
        { jitter: 12, color: 0xffffff, opacity: 1.0 },
        { jitter: 10, color: 0xbbeeff, opacity: 1.0 },
        { jitter:  8, color: 0x88ddff, opacity: 1.0 },
        { jitter:  25, color: 0xaaddff, opacity: 1.0 },
        { jitter:  25, color: 0xffffff, opacity: 1.0 },
        { jitter:  25, color: 0xc7efff, opacity: 1.0 },

        { jitter:  32, color: 0xffffff, opacity: 1.0 },
        { jitter:  32, color: 0xbbeeff, opacity: 0.8 },
        { jitter:  32, color: 0x88ddff, opacity: 0.65 },
        { jitter:  32, color: 0xc7efff, opacity: 0.5 },
        { jitter:  32, color: 0xffffff, opacity: 0.35 },
        { jitter:  32, color: 0xc7efff, opacity: 0.2 },
        { jitter:  45, color: 0xffffff, opacity: 1.0 },
        { jitter:  45, color: 0xbbeeff, opacity: 1.0 },
        { jitter:  45, color: 0x88ddff, opacity: 1.0 },
        { jitter:  45, color: 0xaaddff, opacity: 1.0 },
        { jitter:  45, color: 0xffffff, opacity: 1.0 },
        { jitter:  45, color: 0xc7efff, opacity: 1.0 },
    ];
    for (const def of boltDefs) {
        const pts = [new THREE.Vector3(targetPos.x, skyY, targetPos.z)];
        const SEGS = 14;
        for (let s = 1; s < SEGS; s++) {
            const t = s / SEGS;
            pts.push(new THREE.Vector3(
                targetPos.x + (Math.random() - 0.5) * def.jitter * (1 - t * 0.55),
                skyY + (strikeY - skyY) * t,
                targetPos.z + (Math.random() - 0.5) * def.jitter * (1 - t * 0.55)
            ));
        }
        pts.push(new THREE.Vector3(targetPos.x, strikeY, targetPos.z));
        const mat = new THREE.LineBasicMaterial({
            color: def.color, transparent: true, opacity: def.opacity, depthWrite: false
        });
        mat.userData.baseOpacity = def.opacity;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
        line.frustumCulled = false;
        line.userData.ignoreCameraOcclusion = true;
        boltGroup.add(line);
    }
    scene.add(boltGroup);

    // Bright impact point light
    const strikeLight = new THREE.PointLight(0xaaddff, 12, 80);
    strikeLight.position.set(targetPos.x, strikeY + 3, targetPos.z);
    scene.add(strikeLight);

    // Wide sky flash light
    const skyLight = new THREE.PointLight(0xffffff, 4, 600);
    skyLight.position.set(targetPos.x, skyY * 0.4 + strikeY * 0.6, targetPos.z);
    scene.add(skyLight);

    // Expanding energy blast sphere
    const blastMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 16),
        new THREE.MeshBasicMaterial({
            color: 0x78f1ff, transparent: true, opacity: 0.6,
            depthWrite: false, side: THREE.DoubleSide
        })
    );
    blastMesh.position.copy(targetPos);
    blastMesh.frustumCulled = false;
    blastMesh.userData.ignoreCameraOcclusion = true;
    scene.add(blastMesh);

    // Flat ground shockwave ring
    const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 1.8, 48),
        new THREE.MeshBasicMaterial({
            color: 0xe0fcff, transparent: true, opacity: 0.9,
            depthWrite: false, side: THREE.DoubleSide
        })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(targetPos.x, strikeY + 0.15, targetPos.z);
    ringMesh.frustumCulled = false;
    ringMesh.userData.ignoreCameraOcclusion = true;
    scene.add(ringMesh);

    // Screen flash
    const flashEl = document.getElementById('lightning-flash');
    if (flashEl) {
        flashEl.style.transition = 'none';
        flashEl.style.opacity = '0.8';
        setTimeout(() => {
            flashEl.style.transition = 'opacity 0.25s ease-out';
            flashEl.style.opacity = '0';
        }, 60);
    }

    // Immediately kill all NPCs/demons within a given radius
    _lightningAoeKill(targetPos, killRadius);

    lightningEffects.push({
        boltGroup, strikeLight, skyLight, blastMesh, ringMesh,
        elapsed: 0, duration: boltDurationSec,
        sphereEndScale, ringEndScale
    });
}

function _lightningAoeKill(centerPos, radius) {
    // Iterate backwards so splicing doesn't skip entries
    for (let i = demons.length - 1; i >= 0; i--) {
        if (demons[i].mesh.position.distanceTo(centerPos) <= radius) {
            explodeDemon(demons[i], i);
        }
    }
    for (let i = npcs.length - 1; i >= 0; i--) {
        if (npcs[i].mesh.position.distanceTo(centerPos) <= radius) {
            explodeNPC(npcs[i], i);
        }
    }
    lightningAoeKillCreatures(centerPos, radius);
}

function updateLightningEffects(delta) {
    for (let i = lightningEffects.length - 1; i >= 0; i--) {
        const ef = lightningEffects[i];
        ef.elapsed += delta;
        const t        = Math.min(ef.elapsed / ef.duration, 1.0);
        const fadeOut  = 1.0 - t;

        // Fade bolt lines
        for (const line of ef.boltGroup.children) {
            line.material.opacity = (line.material.userData.baseOpacity || 1.0) * fadeOut;
        }

        // Fade lights
        ef.strikeLight.intensity = 12 * fadeOut;
        ef.skyLight.intensity    = 4  * fadeOut;

        // Expand blast sphere to the requested end radius.
        const blastScale = 1 + t * ((ef.sphereEndScale ?? 22) - 1);
        ef.blastMesh.scale.setScalar(blastScale);
        ef.blastMesh.material.opacity = 0.6 * Math.max(0, 1 - t * 1.4);

        // Expand ground ring so its outer radius reaches the requested end radius.
        const ringScale = 1 + t * ((ef.ringEndScale ?? 19) - 1);
        ef.ringMesh.scale.setScalar(ringScale);
        ef.ringMesh.material.opacity = 0.9 * fadeOut;

        if (ef.elapsed >= ef.duration) {
            scene.remove(ef.boltGroup);
            scene.remove(ef.strikeLight);
            scene.remove(ef.skyLight);
            scene.remove(ef.blastMesh);
            scene.remove(ef.ringMesh);
            lightningEffects.splice(i, 1);
        }
    }
}
