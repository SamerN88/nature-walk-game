// Pre-allocated vectors/objects to avoid per-frame heap allocations in updateDragon
// and dragonBeamAttack / dragonTetherShoot.
const _dragonForward      = new THREE.Vector3();
const _dragonRight        = new THREE.Vector3();
const _dragonCamOffset    = new THREE.Vector3();
const _dragonLookTarget   = new THREE.Vector3();
const _dragonDesiredCam   = new THREE.Vector3();
const _dragonAimDir       = new THREE.Vector3();
const _dragonSnoutOffset  = new THREE.Vector3();
const _dragonBeamStart    = new THREE.Vector3();
const _dragonBeamEnd      = new THREE.Vector3();
const _dragonBeamVec      = new THREE.Vector3();
const _dragonUp           = new THREE.Vector3(0, 1, 0);
const _dragonBeamRaycaster = new THREE.Raycaster();
const _dragonScreenCenter  = new THREE.Vector2(0, 0); // crosshair is always screen center

function createDragon() {
    dragon = new THREE.Group();
    dragon.userData.ignoreCameraOcclusion = true;
    const wings = [];

    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const redMaterial = new THREE.MeshLambertMaterial({ color: 0xcc0000 });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xFF2200 });

    // Body
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(3, 10, 8, 16),
        bodyMaterial
    );
    body.rotation.z = Math.PI / 2;
    dragon.add(body);

    // Neck
    const neck = new THREE.Mesh(
        new THREE.CapsuleGeometry(1.5, 5, 8, 12),
        bodyMaterial
    );
    neck.position.set(7, 2, 0);
    neck.rotation.z = -Math.PI / 4;
    dragon.add(neck);

    // Head
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.5, 3),
        bodyMaterial
    );
    head.position.set(11, 5, 0);
    dragon.add(head);

    // Snout
    const snout = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.5, 2),
        bodyMaterial
    );
    snout.position.set(13.5, 4.5, 0);
    dragon.add(snout);

    // Eyes
    [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 8, 8),
            eyeMaterial
        );
        eye.position.set(11.5, 5.8, side * 1.2);
        dragon.add(eye);
    });

    // Horns
    [-1, 1].forEach(side => {
        const horn = new THREE.Mesh(
            new THREE.ConeGeometry(0.4, 2, 6),
            redMaterial
        );
        horn.position.set(10, 6.5, side * 1);
        horn.rotation.z = 0.3;
        dragon.add(horn);
    });

    // Wings
    [-1, 1].forEach(side => {
        const wing = new THREE.Group();
        const wingBoneLength = 7.6;
        const wingBoneRotY = side * 1;
        const wingBoneRotZ = Math.PI / 2.1;
        const wingBoneCenter = new THREE.Vector3(2.2, 2.4, side * 4.7);
        const wingRoot = wingBoneCenter.clone().sub(
            new THREE.Vector3(0, wingBoneLength / 2, 0).applyEuler(
                new THREE.Euler(0, wingBoneRotY, wingBoneRotZ)
            )
        );
        wing.position.copy(wingRoot);

        const wingMembraneShape = new THREE.Shape();
        wingMembraneShape.moveTo(4, 4);
        wingMembraneShape.lineTo(4, -4);
        wingMembraneShape.lineTo(-8, 0);
        wingMembraneShape.closePath();

        const wingMembrane = new THREE.Mesh(
            new THREE.ShapeGeometry(wingMembraneShape),
            new THREE.MeshLambertMaterial({
                color: 0x2a0a0a,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9
            })
        );
        wingMembrane.position.set(-2, 3, side * 8).sub(wingRoot);
        wingMembrane.rotation.x = side * 0.3;
        wing.add(wingMembrane);

        const wingBonePivot = new THREE.Group();
        wingBonePivot.rotation.z = wingBoneRotZ;
        wingBonePivot.rotation.y = wingBoneRotY;

        const wingBone = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.3, wingBoneLength, 6),
            bodyMaterial
        );
        wingBone.position.y = wingBoneLength / 2;
        wingBonePivot.add(wingBone);
        wing.add(wingBonePivot);

        dragon.add(wing);
        wings.push(wing);
    });

    // Tail
    const tailPivot = new THREE.Group();
    tailPivot.position.set(-5, 0, 0);
    dragon.add(tailPivot);

    const tail = new THREE.Mesh(
        new THREE.ConeGeometry(2, 12, 8),
        bodyMaterial
    );
    tail.position.set(-6, 0, 0);
    tail.rotation.z = Math.PI / 2;
    tailPivot.add(tail);

    // Tail spikes
    for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 1.5, 4),
            redMaterial
        );
        spike.position.set(-3.2 - i * 2.7, 1.45 - i * 0.35, 0);
        spike.rotation.z = Math.PI / 4;
        spike.userData.isDragonSpike = true;
        tailPivot.add(spike);
    }

    // Legs
    [[-3, -1], [-3, 1], [3, -1], [3, 1]].forEach(pos => {
        const leg = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.8, 3, 6, 8),
            bodyMaterial
        );
        leg.position.set(pos[0], -3.5, pos[1] * 2);
        dragon.add(leg);

        // Claws
        for (let c = 0; c < 3; c++) {
            const claw = new THREE.Mesh(
                new THREE.ConeGeometry(0.2, 0.8, 4),
                redMaterial
            );
            claw.position.set(pos[0] + (c - 1) * 0.5, -5.5, pos[1] * 2.35);
            claw.rotation.x = Math.PI;
            claw.userData.isDragonClaw = true;
            dragon.add(claw);
        }
    });

    // Start high in sky, will descend
    dragon.position.set(player.position.x, 200, player.position.z);
    dragon.visible = false;
    dragon.userData.wings = wings;
    dragon.userData.tailPivot = tailPivot;
    enableMeshShadows(dragon);
    scene.add(dragon);

    // Debugging
    if (DEBUG_APOCALYPSE) triggerDemonApocalypse();
    if (DEBUG_VOLCANO) movePlayerNearDragonVolcanoDebug();
}

function findClearDescendPoint(prefX, prefZ) {
    const isOver = (tx, tz) => enclosedStructureBounds.some(
        b => isPointInRotatedRect(tx, tz, b)
    );
    if (!isOver(prefX, prefZ)) return { x: prefX, z: prefZ };
    // Try offsets in 8 directions at increasing radii until a clear spot is found
    for (let r = 12; r <= 60; r += 8) {
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            const tx = prefX + Math.cos(angle) * r;
            const tz = prefZ + Math.sin(angle) * r;
            if (!isOver(tx, tz)) return { x: tx, z: tz };
        }
    }
    return { x: prefX, z: prefZ }; // fallback — no clear spot found
}

function updateMountedPlayerPose() {
    if (!mountedOnDragon || !dragon || !player) return;

    const riderOffset = mountedPlayerLocalOffset.clone().applyQuaternion(dragon.quaternion);
    player.position.copy(dragon.position).add(riderOffset);
    player.rotation.set(0, dragon.rotation.y + Math.PI / 2, 0);
}

function updateDragon(delta) {
    if (!dragon) return;
    const UNASCENDED_DRAGON_MAX_FLY_HEIGHT = 325;

    if (dragonDescending && !mountedOnDragon && !dragonTethered) {
        const previousDragonX = dragon.position.x;
        const previousDragonZ = dragon.position.z;

        // DRAGON_HOVER_HEIGHT: how far above the ground the dragon stops.
        // The dragon eases toward (groundY + targetDist), which is below the
        // stopping threshold (groundY + DRAGON_HOVER_HEIGHT).  Because the true
        // easing target is lower than the stop point, the dragon is still
        // decelerating when it crosses the threshold — smooth halt, no crawl.
        const DRAGON_HOVER_HEIGHT = 6;  // tunable: units above ground at landing
        const targetDist = 3;            // easing aim point below DRAGON_HOVER_HEIGHT
        const groundY = getDragonSupportHeightBelow(dragon.position.x, dragon.position.z, dragon.position.y);
        const targetY = groundY + targetDist;

        const descentRate = 1 - Math.exp(-0.75 * delta);
        dragon.position.y += (targetY - dragon.position.y) * descentRate;
        resolveCircularEntityWallOverlaps(
            dragon.position,
            dragon.position.y,
            DRAGON_COLLISION_RADIUS,
            3,
            { x: previousDragonX, z: previousDragonZ }
        );

        if (dragon.position.y <= groundY + DRAGON_HOVER_HEIGHT) {
            dragon.position.y = groundY + DRAGON_HOVER_HEIGHT; // correct sub-frame overshoot (<0.05 units)
            dragonDescending = false;
        }
    }

    if (mountedOnDragon) {
        const flySpeed = 400 * (dragonAscended ? speedMultiplier : 1);

        // Dragon faces camera direction - dragon's +X is head
        dragon.rotation.set(0, Math.atan2(-Math.cos(cameraYaw), Math.sin(cameraYaw)), 0);

        // Forward vector (camera direction)
        _dragonForward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
        // Right vector matches player convention (sin(yaw - PI/2), 0, cos(yaw - PI/2))
        _dragonRight.set(Math.sin(cameraYaw - Math.PI / 2), 0, Math.cos(cameraYaw - Math.PI / 2));

        if (moveForward)  dragonVelocity.addScaledVector(_dragonForward,  flySpeed * delta);
        if (moveBackward) dragonVelocity.addScaledVector(_dragonForward, -flySpeed * delta);
        if (moveRight)    dragonVelocity.addScaledVector(_dragonRight,    flySpeed * delta);
        if (moveLeft)     dragonVelocity.addScaledVector(_dragonRight,   -flySpeed * delta);

        // SPACE = up, SHIFT = down
        if (spaceHeld) dragonVelocity.y += flySpeed * delta;
        if (isRunning) dragonVelocity.y -= flySpeed * delta;

        // Apply drag — same conditional friction as player:
        // coast while keys held, stop fast when released
        const anyKeyHeld = moveForward || moveBackward || moveLeft || moveRight || spaceHeld || isRunning;
        dragonVelocity.multiplyScalar(anyKeyHeld ? 0.85 : 0.5);

        // Update position
        const previousDragonX = dragon.position.x;
        const previousDragonZ = dragon.position.z;
        const previousDragonY = dragon.position.y;
        dragon.position.addScaledVector(dragonVelocity, delta);
        const wallOverlaps = resolveCircularEntityWallOverlaps(
            dragon.position,
            dragon.position.y,
            DRAGON_COLLISION_RADIUS,
            3,
            { x: previousDragonX, z: previousDragonZ }
        );
        if (wallOverlaps.blockedX) dragonVelocity.x = 0;
        if (wallOverlaps.blockedZ) dragonVelocity.z = 0;

        // Keep above ground
        const dgY = getLandSurfaceHeight(dragon.position.x, dragon.position.z);
        if (dragon.position.y < dgY + 8) {
            dragon.position.y = dgY + 8;
            if (dragonVelocity.y < 0) dragonVelocity.y = 0;
        }
        if (!dragonAscended && dragon.position.y > UNASCENDED_DRAGON_MAX_FLY_HEIGHT) {
            dragon.position.y = UNASCENDED_DRAGON_MAX_FLY_HEIGHT;
            if (dragonVelocity.y > 0) dragonVelocity.y = 0;
        }
        const groundedOnRoof = resolveCircularBodyRoofCollision(
            dragon.position,
            previousDragonY,
            8,
            dragon.position.y - previousDragonY
        );
        if (groundedOnRoof && dragonVelocity.y < 0) {
            dragonVelocity.y = 0;
        }

        // Camera follows dragon (further back than normal player cam)
        _dragonLookTarget.copy(dragon.position);
        _dragonLookTarget.y += 18;
        const dragonCamDist = 35;
        const dragonCamH = 14;
        const pitchCos = Math.cos(cameraPitch);
        const pitchSin = Math.sin(cameraPitch);
        const pitchHeight = cameraPitch > 0
            ? pitchSin * dragonCamDist * 0.65
            : pitchSin * dragonCamDist * 1.8;
        _dragonCamOffset.set(
            -Math.sin(cameraYaw) * dragonCamDist * pitchCos,
            dragonCamH + pitchHeight,
            -Math.cos(cameraYaw) * dragonCamDist * pitchCos
        );
        _dragonDesiredCam.copy(dragon.position).add(_dragonCamOffset);
        _dragonDesiredCam.y += 2;
        scene.updateMatrixWorld();
        camera.position.copy(resolveThirdPersonCameraPosition(_dragonLookTarget, _dragonDesiredCam));
        camera.lookAt(_dragonLookTarget);
    }

    if (mountedOnDragon) {
        updateMountedPlayerPose();
    }

    // Wing animation
    if (dragon.visible) {
        const wingFlap = Math.sin(performance.now() / 200) * 0.3;
        const tailSwing = Math.sin(performance.now() / 350) * 0.22;
        (dragon.userData.wings || []).forEach(wing => {
            wing.rotation.z = wingFlap;
        });
        if (dragon.userData.tailPivot) {
            dragon.userData.tailPivot.rotation.y = tailSwing;
        }
    }

    // Tether: float above the player and auto-shoot nearby demons.
    if (dragonTethered && !mountedOnDragon) {
        // Smoothly follow the target position above the player.
        const targetX = player.position.x;
        const targetY = player.position.y + DRAGON_TETHER_HEIGHT;
        const targetZ = player.position.z;
        const followRate = 1 - Math.exp(-1 * delta);
        dragon.position.x += (targetX - dragon.position.x) * followRate;
        dragon.position.y += (targetY - dragon.position.y) * followRate;
        dragon.position.z += (targetZ - dragon.position.z) * followRate;

        // Face toward player.
        const dxP = player.position.x - dragon.position.x;
        const dzP = player.position.z - dragon.position.z;
        dragon.rotation.set(0, Math.atan2(dxP, dzP) - Math.PI/2, 0);

        // Auto-shoot the closest demon within detection radius.
        dragonTetherShotTimer -= delta;
        if (dragonTetherShotTimer <= 0 && demons.length > 0) {
            let closestDemon = null;
            let closestDist = Infinity;
            let closestIdx = -1;
            for (let i = 0; i < demons.length; i++) {
                const dx = demons[i].mesh.position.x - player.position.x;
                const dz = demons[i].mesh.position.z - player.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= DRAGON_TETHER_DETECT_RADIUS && dist < closestDist) {
                    closestDist = dist;
                    closestDemon = demons[i];
                    closestIdx = i;
                }
            }
            if (closestDemon) {
                dragonTetherShoot(closestDemon, closestIdx);
            }
            dragonTetherShotTimer = DRAGON_TETHER_SHOT_INTERVAL;
        }
    }

    // Lava rescue: if the unmounted dragon sits in lava for >3 s, teleport it
    // back to its initial spawn point above the volcano platform.
    if (!mountedOnDragon && dragonVolcano) {
        const inLava = isInsideDragonVolcanoCore(dragon.position.x, dragon.position.z)
            && dragon.position.y <= dragonVolcano.lavaTopY;
        if (inLava) {
            dragonLavaTimer += delta;
            if (dragonLavaTimer >= 3) {
                dragonLavaTimer = 0;
                dragon.position.set(
                    dragonVolcano.x,
                    dragonVolcano.platformTopY + 150,
                    dragonVolcano.z
                );
                dragonDescending = true;
            }
        } else {
            dragonLavaTimer = 0;
        }
    }
}

function mountDragon() {
    if (!dragon || !dragon.visible || mountedOnDragon) return;
    if (demonApocalypse) return; // cannot mount during a hell run

    const dx = player.position.x - dragon.position.x;
    const dy = player.position.y - dragon.position.y;
    const dz = player.position.z - dragon.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 25) {
        mountedOnDragon = true;
        dragonDescending = false;
        player.visible = true;
        dragonVelocity.set(0, 0, 0);
        updateMountedPlayerPose();
        syncHandItemVisuals();
    }
}

function unmountDragon() {
    if (!mountedOnDragon) return;

    mountedOnDragon = false;
    player.visible = true;

    // Drop the player from their current mounted position so they fall naturally.
    // Do NOT teleport to ground — getDragonSupportHeight has no y-awareness and
    // would pull the player up to a platform that is above them.
    const riderOffset = mountedPlayerLocalOffset.clone().applyQuaternion(dragon.quaternion);
    player.position.copy(dragon.position).add(riderOffset);
    velocity.set(0, 0, 0);
    isGrounded = false;
    syncHandItemVisuals();

    // Dragon descends back down so the player can remount
    dragonDescending = true;
}

function dragonBeamAttack() {
    if (!mountedOnDragon) return;

    // Aim direction = where the camera is looking (crosshair direction)
    camera.getWorldDirection(_dragonAimDir);

    // Beam starts from the tip of the dragon's snout (local +X front face at (15, 4.5, 0))
    _dragonSnoutOffset.set(15, 4.5, 0).applyQuaternion(dragon.quaternion);
    _dragonBeamStart.copy(dragon.position).add(_dragonSnoutOffset);

    // Raycast from screen center (crosshair) against all solid scene objects.
    // Exclude the dragon, player, NPCs, and any still-fading beam meshes so the
    // ray only hits terrain and structures (including structures blocking the view).
    _dragonBeamRaycaster.setFromCamera(_dragonScreenCenter, camera);

    const excludeUUIDs = new Set();
    dragon.traverse(obj => excludeUUIDs.add(obj.uuid));
    player.traverse(obj => excludeUUIDs.add(obj.uuid));
    npcs.forEach(npc => npc.mesh.traverse(obj => excludeUUIDs.add(obj.uuid)));

    const solidHits = _dragonBeamRaycaster.intersectObjects(scene.children, true)
        .filter(h => !excludeUUIDs.has(h.object.uuid) && !h.object.userData.isBeam && !h.object.userData.isWater);

    let beamEndPoint;
    if (solidHits.length > 0) {
        beamEndPoint = solidHits[0].point;
    } else {
        // Aimed at sky — extend a long way
        _dragonBeamEnd.copy(camera.position).addScaledVector(_dragonAimDir, 1000);
        beamEndPoint = _dragonBeamEnd;
    }

    _dragonBeamVec.copy(beamEndPoint).sub(_dragonBeamStart);
    const visualLength = _dragonBeamVec.length();
    const beamDir = _dragonBeamVec.clone().normalize();
    // Kill detection uses camera as ray origin — measure range from camera too
    const cameraRayLength = camera.position.distanceTo(beamEndPoint);

    const beamGeometry = new THREE.CylinderGeometry(0.5, 1.5, visualLength, 8);
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: dragonAscended ? 0x00DDFF : 0xFF2200,
        transparent: true,
        opacity: 0.85
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.userData.isBeam = true; // exclude from future raycasts
    beam.position.copy(_dragonBeamStart).addScaledVector(beamDir, visualLength / 2);
    beam.quaternion.setFromUnitVectors(_dragonUp, beamDir);
    scene.add(beam);

    // Kill NPCs in beam path — ray from camera, range capped at camera->endpoint dist
    const killList = [];
    npcs.forEach((npc, index) => {
        const toNPC = npc.mesh.position.clone().sub(camera.position);
        const projected = toNPC.dot(_dragonAimDir);
        if (projected > 0 && projected < cameraRayLength) {
            const perpDist = toNPC.clone().sub(_dragonAimDir.clone().multiplyScalar(projected)).length();
            if (perpDist < 8) {
                killList.push(index);
            }
        }
    });

    // Use explodeNPC for each killed NPC (handles kill count, animation, removal)
    killList.sort((a, b) => b - a).forEach(index => {
        if (!dragonBondFormed) {
            dragonBondKills++;
            if (dragonBondKills >= DRAGON_BOND_KILLS_REQUIRED) {
                dragonBondFormed = true;
                updateMenuPanels();
                playDragonBondFlash();
            }
        }
        explodeNPC(npcs[index], index);
    });

    // Also kill demons in beam path
    const demonKillList = [];
    demons.forEach((z, index) => {
        const toZ = z.mesh.position.clone().sub(camera.position);
        const proj = toZ.dot(aimDir);
        if (proj > 0 && proj < cameraRayLength) {
            const perp = toZ.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
            if (perp < 8) demonKillList.push(index);
        }
    });
    demonKillList.sort((a, b) => b - a).forEach(index => {
        if (!dragonBondFormed) {
            dragonBondKills++;
            if (dragonBondKills >= DRAGON_BOND_KILLS_REQUIRED) {
                dragonBondFormed = true;
                updateMenuPanels();
                playDragonBondFlash();
            }
        }
        explodeDemon(demons[index], index);
    });

    setTimeout(() => { beam.material.opacity = 0.4; }, 100);
    setTimeout(() => { scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); }, 250);
}

// Creates visible glowing aura spheres (additive blending) on both the dragon and
// the player that pulse 3 times over 3 seconds to mark the dragon bond formation.
// Because they are emissive meshes with additive blending they are fully visible

function makeBondAuraMesh(radius) {
    const mat = new THREE.MeshBasicMaterial({
        color: 0x88DDFF,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,      // render inside-out so it glows outward
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.userData.ignoreCameraOcclusion = true;
    scene.add(mesh);
    return mesh;
}

function playDragonBondFlash() {
    const dragonAura = makeBondAuraMesh(18);  // large enough to wrap the dragon
    const playerAura = makeBondAuraMesh(4);   // fits snugly around the player
    dragonBondFlashes.push({ dragonAura, playerAura, elapsed: 0 });
}

function updateDragonBondFlashes(delta) {
    const FLASH_DURATION = 3.0; // seconds for 3 pulses
    for (let i = dragonBondFlashes.length - 1; i >= 0; i--) {
        const f = dragonBondFlashes[i];
        f.elapsed += delta;
        if (f.elapsed >= FLASH_DURATION) {
            scene.remove(f.dragonAura);
            f.dragonAura.geometry.dispose();
            f.dragonAura.material.dispose();
            scene.remove(f.playerAura);
            f.playerAura.geometry.dispose();
            f.playerAura.material.dispose();
            dragonBondFlashes.splice(i, 1);
            continue;
        }
        // max(0, sin(t*6π)) produces exactly 3 positive bumps in [0,1]
        const t = f.elapsed / FLASH_DURATION;
        const pulse = Math.max(0, Math.sin(t * 6 * Math.PI));

        // Follow dragon and player as they move during the effect
        f.dragonAura.position.copy(dragon.position);
        f.playerAura.position.copy(player.position);

        f.dragonAura.material.opacity = pulse * 0.55;
        f.playerAura.material.opacity = pulse * 0.70;
    }
}


function dragonTetherShoot(targetDemon, targetIndex) {
    _dragonSnoutOffset.set(15, 4.5, 0).applyQuaternion(dragon.quaternion);
    _dragonBeamStart.copy(dragon.position).add(_dragonSnoutOffset);
    _dragonBeamEnd.copy(targetDemon.mesh.position);
    _dragonBeamEnd.y += targetDemon.gunHitCenterY ?? 4.8;

    _dragonBeamVec.copy(_dragonBeamEnd).sub(_dragonBeamStart);
    const beamLen = _dragonBeamVec.length();
    const beamDir = _dragonBeamVec.clone().normalize();

    const beamGeo = new THREE.CylinderGeometry(0.3, 0.9, beamLen, 8);
    const beamMat = new THREE.MeshBasicMaterial({ color: dragonAscended ? 0x00DDFF : 0xFF2200, transparent: true, opacity: 0.82 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.userData.isBeam = true;
    beam.position.copy(_dragonBeamStart).addScaledVector(beamDir, beamLen / 2);
    beam.quaternion.setFromUnitVectors(_dragonUp, beamDir);
    scene.add(beam);
    setTimeout(() => { beam.material.opacity = 0.3; }, 100);
    setTimeout(() => { scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); }, 260);

    explodeDemon(targetDemon, targetIndex);
}
