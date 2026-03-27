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

// ── Stake / Torch meshes & hand slot system ──────────────────────────────────

function getItemDisplayName(item) {
    const names = { fist: 'Fist', shovel: 'Shovel', ak47: 'AK47', stake: 'Stake', torch: 'Torch', 'sword-shield': 'Sword & Shield' };
    return names[item] || item;
}

// Adds an item to the dynamic hand slot list and auto-equips it.
// If `replaces` is given, that item's slot is swapped in-place (e.g. stake -> torch).
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

function createPlayerStakeMesh(scale = 1) {
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
    flameGroup.add(flameCone);

    // Lower hemisphere: thetaStart=PI/2, thetaLength=PI/2 → lower half-sphere.
    // Flat face sits at y=0 (aligns with cone base), dome hangs toward -Y.
    const flameBase = new THREE.Mesh(
        new THREE.SphereGeometry(0.125 * scale, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        flameMat
    );
    flameBase.position.y = 0;
    flameGroup.add(flameBase);

    // Inner core cone (brighter center)
    const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.28 * scale, 8), innerFlameMat);
    flameCore.position.y = 0.14 * scale;
    flameGroup.add(flameCore);

    enableMeshShadows(group);
    return group;
}

function updateTorchLight() {
    if (!torchEquippedLight) return;
    const torchActive = hasTorch && (currentHandItem === 'torch') && !playerDead && !mountedOnDragon;
    torchEquippedLight.intensity = torchActive ? 20 : 0;
}

// ── End Stake / Torch ────────────────────────────────────────────────────────

function syncHandItemVisuals() {
    // Sync ak47Equipped from currentHandItem (DEBUG_AK47 overrides)
    if (DEBUG_AK47) {
        ak47Collected = true;
        ak47Equipped = true;
    } else {
        ak47Equipped = (currentHandItem === 'ak47');
    }

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
    if (playerStakeMesh) {
        playerStakeMesh.visible = hasStake && (currentHandItem === 'stake') && !playerDead && !mountedOnDragon;
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
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x4a1a6a, emissive: 0x2a0845, emissiveIntensity: 0.6 });
    const rimMat   = new THREE.MeshLambertMaterial({ color: 0xd4a820, emissive: 0x604000, emissiveIntensity: 0.4 });
    const gemMat   = new THREE.MeshLambertMaterial({ color: 0xcc44ee, emissive: 0x6600aa, emissiveIntensity: 0.8 });

    // Main disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * scale, 0.55 * scale, 0.1 * scale, 12), stoneMat);
    disc.rotation.x = Math.PI / 2;
    grp.add(disc);

    // Outer rim (torus)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5 * scale, 0.08 * scale, 6, 14), rimMat);
    grp.add(rim);

    // Center gem
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * scale, 0), gemMat);
    grp.add(gem);

    // Rune markings (4 small rods)
    for (let r = 0; r < 4; r++) {
        const angle = (r / 4) * Math.PI * 2;
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.28 * scale, 0.06 * scale), rimMat);
        rod.position.set(Math.cos(angle) * 0.3 * scale, Math.sin(angle) * 0.3 * scale, 0.06 * scale);
        rod.rotation.z = angle;
        grp.add(rod);
    }

    // Glow light
    const glow = new THREE.PointLight(0xaa33ff, 0, 10);
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
    raycaster.far = maxRange;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const excludeUUIDs = new Set();
    if (player) player.traverse(obj => excludeUUIDs.add(obj.uuid));

    const hits = raycaster.intersectObjects(scene.children, true)
        .filter(h => !excludeUUIDs.has(h.object.uuid) && !h.object.userData.isBeam);

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

function tryInteractWithAkChest(aimDir, range) {
    if (!akChest || akChest.collected) return false;

    const chestPos = new THREE.Vector3(akChest.worldX, akChest.worldY, akChest.worldZ);
    const toChest = chestPos.sub(camera.position);
    const projected = toChest.dot(aimDir);
    if (projected <= 0 || projected > range) return false;

    const perp = toChest.sub(aimDir.clone().multiplyScalar(projected)).length();
    if (perp > 2.2) return false;

    if (!akChest.opened) {
        if (DEBUG_CHEST || hasGoldenKey) {
            akChest.opened = true;
            akChest.lidPivot.rotation.x = -Math.PI * 0.65;
            hasGoldenKey = false;
            removeInventoryItem('golden-key'); // key consumed by chest
            updateKeyHUD();
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

function getDemonGunHitPoint(demon, out = new THREE.Vector3()) {
    out.copy(demon.mesh.position);
    out.y += (demon.gunHitCenterY ?? 4.8);
    return out;
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
        const toNPC = new THREE.Vector3().subVectors(npc.mesh.position, camera.position);
        const projected = toNPC.dot(aimDir);
        if (projected <= 0) return;
        const perp = toNPC.sub(aimDir.clone().multiplyScalar(projected)).length();
        if (perp <= getNPCHitRadius(npc)) {
            hits.push({ kind: 'npc', target: npc, projected });
        }
    });

    const demonHitPoint = new THREE.Vector3();
    demons.forEach(demon => {
        const toDemon = new THREE.Vector3().subVectors(
            getDemonGunHitPoint(demon, demonHitPoint),
            camera.position
        );
        const projected = toDemon.dot(aimDir);
        if (projected <= 0) return;
        const perp = toDemon.sub(aimDir.clone().multiplyScalar(projected)).length();
        if (perp <= (demon.gunHitRadius ?? 4.6)) {
            hits.push({ kind: 'demon', target: demon, projected });
        }
    });

    hits.sort((a, b) => a.projected - b.projected);
    triggerAk47ShotFX(aimDir, hits, beamEndPoint);

    let penetratedDemons = 0;
    for (const hit of hits) {
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

    // If mounted on dragon, fire beam instead
    if (mountedOnDragon) {
        dragonBeamAttack();
        return;
    }

    // Shrine interaction — start hell run (demon rounds)
    if (shrineActive && shrine) {
        const sd = player.position.distanceTo(shrine.position);
        if (sd < SHRINE_INTERACT_DIST) {
            startDemonRound(1);
            return;
        }
    }

    // Trigger punch animation — sword shows swipe arc instead of the radial ring
    if (currentHandItem === 'sword-shield') {
        triggerSwordSwipe();
    } else {
        const ring = document.getElementById('punch-ring');
        ring.classList.remove('punch-ring-active');
        void ring.offsetWidth; // force reflow
        ring.classList.add('punch-ring-active');
    }

    // Check if we can mount the dragon
    if (dragon && dragon.visible) {
        const dx = player.position.x - dragon.position.x;
        const dy = player.position.y - dragon.position.y;
        const dz = player.position.z - dragon.position.z;
        const distToDragon = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distToDragon < 15) {
            mountDragon();
            return;
        }
    }

    // Punch hits whatever the crosshair is aimed at — ray from camera = exact crosshair
    const punchRange = 25;
    const aimDir = new THREE.Vector3();
    camera.getWorldDirection(aimDir);

    // DEBUG_GOLDEN_KEY: punchable box — 3 hits reveals the golden key
    if (debugKeyBox) {
        const toBox = debugKeyBox.mesh.position.clone().sub(camera.position);
        const proj = toBox.dot(aimDir);
        if (proj > 0 && proj < punchRange) {
            const perp = toBox.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 2) {
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
                return;
            }
        }
    }

    // Shovel digging (only when shovel is equipped, in the dig zone, key not yet found)
    if (currentHandItem === 'shovel' && bigLake && !hasGoldenKey && digCount < 31 && !goldenKeyMesh) {
        if (tryDig()) return;
    }

    // Cemetery talisman grave digging
    if (currentHandItem === 'shovel') {
        if (tryDigTalismanGrave()) return;
    }

    // Tree hit with shovel — 3 hits anywhere on the tree equip a wooden stake.
    // Only show splinter effects before the stake has been obtained.
    if (hasShovel && currentHandItem === 'shovel' && !hasStake && !hasTorch) {
        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i];
            const treeScale = tree.userData.treeScale || 1;
            // Use the visual center of the tree (midway through foliage) for hit detection
            // so that hitting leaves or trunk both register correctly.
            const treeCenterWorld = new THREE.Vector3(
                tree.position.x,
                tree.position.y + 4 * treeScale,
                tree.position.z
            );
            const toCenter = treeCenterWorld.clone().sub(camera.position);
            const proj = toCenter.dot(aimDir);
            if (proj <= 0 || proj > punchRange) continue;
            const perp = toCenter.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 3.5 * treeScale) {
                tree.userData.treeHitCount = (tree.userData.treeHitCount || 0) + 1;
                // Raycast against the actual tree geometry to find the surface hit point
                const _treeRay = new THREE.Raycaster(camera.position, aimDir, 0, punchRange);
                const _treeHits = _treeRay.intersectObject(tree, true);
                const hitPoint = _treeHits.length > 0 ? _treeHits[0].point : camera.position.clone().addScaledVector(aimDir, proj);
                spawnWoodSplinterEffect(hitPoint);
                if (tree.userData.treeHitCount >= 3) {
                    tree.userData.treeHitCount = 0;
                    hasStake = true;
                    addHandSlot('stake');
                    syncHandItemVisuals();
                    flashEquipHint('Stake');
                }
                return;
            }
        }
    }

    // Shovel pickup (works without having the shovel)
    if (!hasShovel && tentShovelMesh) {
        const shovelWorldPos = new THREE.Vector3();
        tentShovelMesh.getWorldPosition(shovelWorldPos);
        const toShovel = shovelWorldPos.clone().sub(camera.position);
        const proj = toShovel.dot(aimDir);
        if (proj > 0 && proj < punchRange) {
            const perp = toShovel.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 1.8) {
                hasShovel = true;
                tentShovelMesh.parent.remove(tentShovelMesh);
                tentShovelMesh = null;
                addHandSlot('shovel');
                syncHandItemVisuals();
                flashEquipHint('Shovel');
                return;
            }
        }
    }

    // Golden key pickup (blocked for 3s after spawning)
    if (goldenKeyMesh && goldenKeyLockTimer <= 0) {
        const keyPos = goldenKeyMesh.position;
        const toKey = keyPos.clone().sub(camera.position);
        const proj = toKey.dot(aimDir);
        if (proj > 0 && proj < punchRange) {
            const perp = toKey.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 2.5) {
                hasGoldenKey = true;
                scene.remove(goldenKeyMesh);
                goldenKeyMesh = null;
                // Show the key in inventory rather than bottom-right HUD
                addInventoryItem('golden-key', 'Golden Key', null, { type: 'object', itemKey: 'golden-key' });
                flashEquipHint('KEY FOUND');
                return;
            }
        }
    }

    if (tryInteractWithAkChest(aimDir, punchRange)) return;

    // Door toggle — punch to open or close. Does NOT return early so other
    // targets (demons, NPCs) in the same direction also receive the hit.
    let doorHit = false;
    for (const door of houseDoors) {
        const centerPos = door.mesh.getWorldPosition(new THREE.Vector3());
        const toDoor = centerPos.clone().sub(camera.position);
        const proj = toDoor.dot(aimDir);
        if (proj > 0 && proj < punchRange) {
            const perp = toDoor.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 3.5) {
                toggleHouseDoor(door);
                doorHit = true;
                break;
            }
        }
    }

    // Note pickup
    tryPickupNote(aimDir, punchRange);

    // Sword & Shield item pickup from HH floor-2 display
    if (tryPickupSSItem(aimDir, punchRange)) return;

    // Talisman pickup from cemetery grave
    if (tryPickupTalisman(aimDir, punchRange)) return;

    // Hit HH white shadow man (sword-shield only)
    if (currentHandItem === 'sword-shield') {
        if (tryHitHHWhiteSM(aimDir, punchRange)) return;
    }

    // Campfire punch with stake equipped — light it into a torch
    if (currentHandItem === 'stake' && hasStake) {
        for (const cpPos of campfirePositions) {
            const toCampfire = cpPos.clone().sub(camera.position);
            const proj = toCampfire.dot(aimDir);
            if (proj <= 0 || proj > punchRange) continue;
            const perp = toCampfire.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 4) {
                hasStake = false;
                hasTorch = true;
                addHandSlot('torch', 'stake');
                syncHandItemVisuals();
                flashEquipHint('Torch');
                break;
            }
        }
    }

    // Sword swipe hits up to 3 targets; regular melee hits 1
    const isSwordAttack = currentHandItem === 'sword-shield';
    const maxMeleeHits = isSwordAttack ? 3 : 1;

    // Hit NPCs
    const candidateNPCs = [];
    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const toNPC = new THREE.Vector3().subVectors(npc.mesh.position, camera.position);
        const projected = toNPC.dot(aimDir);
        if (projected > 0 && projected < punchRange) {
            const perp = toNPC.clone().sub(aimDir.clone().multiplyScalar(projected)).length();
            if (perp < 2.5) candidateNPCs.push({ npc, dist: projected });
        }
    }
    candidateNPCs.sort((a, b) => a.dist - b.dist);
    candidateNPCs.slice(0, maxMeleeHits).forEach(h => {
        const curIdx = npcs.indexOf(h.npc);
        if (curIdx !== -1) explodeNPC(h.npc, curIdx);
    });

    // Hit demons — always checked regardless of door/NPC hit
    const candidateDemons = [];
    const demonPunchPoint = new THREE.Vector3();
    for (let i = 0; i < demons.length; i++) {
        const z = demons[i];
        const toZ = new THREE.Vector3().subVectors(
            getDemonGunHitPoint(z, demonPunchPoint),
            camera.position
        );
        const proj = toZ.dot(aimDir);
        if (proj > 0 && proj < punchRange) {
            const perp = toZ.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp <= (z.gunHitRadius ?? 4.6)) candidateDemons.push({ demon: z, dist: proj });
        }
    }
    candidateDemons.sort((a, b) => a.dist - b.dist);
    candidateDemons.slice(0, maxMeleeHits).forEach(h => {
        const curIdx = demons.indexOf(h.demon);
        if (curIdx !== -1) explodeDemon(h.demon, curIdx);
    });
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

function updateKeyHUD() {
    // Key is now shown in the inventory overlay, not the bottom-right HUD.
    // Always keep the legacy HUD element hidden.
    const el = document.getElementById('golden-key-hud');
    if (el) el.style.display = 'none';
}

function flashEquipHint(label) {
    const el = document.getElementById('equip-hint');
    if (!el) return;
    el.textContent = label;
    el.classList.remove('equip-hint-flash');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('equip-hint-flash');
}


function tryDig() {
    if (!bigLake) return false;
    const dx = player.position.x - bigLake.x;
    const dz = player.position.z - bigLake.z;
    // Must be within the square area (DIG_ZONE_SIZE/2 units radius in each axis) at the lake center
    if (Math.abs(dx) > DIG_ZONE_SIZE/2 || Math.abs(dz) > DIG_ZONE_SIZE/2) return false;
    // Must be near the lake floor
    if (player.position.y > bigLake.floorY + 10) return false;

    digCount++;
    spawnDigParticles(bigLake.x + (Math.random() - 0.5) * 2, bigLake.floorY, bigLake.z + (Math.random() - 0.5) * 2);

    if (digCount >= 31) {
        spawnGoldenKey(bigLake.x, bigLake.floorY + 0.8, bigLake.z);
    }
    return true;
}

function spawnWoodSplinterEffect(hitPoint) {
    const count = 20;
    const meshes = [];
    const velocities = [];
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x7A5230, transparent: true, opacity: 1 });
    for (let i = 0; i < count; i++) {
        const len = 0.08 + Math.random() * 0.18;
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, len, 0.04),
            woodMat.clone()
        );
        mesh.position.copy(hitPoint).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4
        ));
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.userData.ignoreCameraOcclusion = true;
        scene.add(mesh);
        meshes.push(mesh);
        velocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            2 + Math.random() * 5,
            (Math.random() - 0.5) * 6
        ));
    }
    digParticles.push({ meshes, velocities, life: 0, maxLife: 0.7 });
}

function spawnDigParticles(x, y, z) {
    const count = 18;
    const meshes = [];
    const velocities = [];
    for (let i = 0; i < count; i++) {
        const size = 0.12 + Math.random() * 0.18;
        const mat = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0.07 + Math.random() * 0.05, 0.6, 0.28 + Math.random() * 0.1),
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
            if (obj.isMesh && obj.material) {
                obj.material.emissiveIntensity = 0.4;
            }
            if (obj.isLight && obj.userData.isGoldenKeyLight) {
                obj.intensity = 0;
            }
        });
    }
}

