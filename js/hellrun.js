function createShrine() {
    const group = new THREE.Group();
    const gy = getGroundHeight(0, 0);
    group.position.set(0, gy, 0);

    // Stone base
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x444455 });
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 1.2, 8), baseMat);
    baseMesh.position.y = 0.6;
    baseMesh.userData.ignoreCameraOcclusion = true;
    group.add(baseMesh);

    // Obelisk
    const obeliskMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const obelisk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), obeliskMat);
    obelisk.position.y = 4.2;
    obelisk.userData.ignoreCameraOcclusion = true;
    group.add(obelisk);

    // Obelisk cap
    const capMat = new THREE.MeshLambertMaterial({ color: 0xFF0000, emissive: new THREE.Color(0xFF0000), emissiveIntensity: 0.8 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1.5, 4), capMat);
    cap.position.y = 8;
    cap.userData.ignoreCameraOcclusion = true;
    group.add(cap);

    // Cap glow light
    const pLight = new THREE.PointLight(0xFF0000, 5, 1);
    pLight.position.y = 8;
    group.add(pLight);

    // Three orbiting crystals
    const crystalMat = new THREE.MeshLambertMaterial({ color: 0xFF2200, emissive: new THREE.Color(0xFF2200), emissiveIntensity: 0.6 });
    const crystalHeights = [5, 5.8, 4.5];
    const crystals = [];
    for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), crystalMat.clone());
        const a = (i / 3) * Math.PI * 2;
        c.position.set(Math.cos(a) * 2.5, crystalHeights[i], Math.sin(a) * 2.5);
        c.userData.ignoreCameraOcclusion = true;
        const crystalLight = new THREE.PointLight(0xFF2200, 10, 50);
        c.add(crystalLight);
        group.add(c);
        crystals.push(c);
    }

    // Ground rune ring
    const runeMat = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const runeRing = new THREE.Mesh(new THREE.RingGeometry(3.5, 4, 32), runeMat);
    runeRing.rotation.x = -Math.PI / 2;
    runeRing.position.y = 0.05;
    runeRing.userData.ignoreCameraOcclusion = true;
    group.add(runeRing);

    // Floating embers
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xFF4400 });
    const embers = [];
    for (let i = 0; i < 20; i++) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), emberMat.clone());
        const ea = Math.random() * Math.PI * 2;
        const er = Math.random() * 3;
        e.position.set(Math.cos(ea) * er, 0.5 + Math.random() * 4, Math.sin(ea) * er);
        e.userData.offset = Math.random() * Math.PI * 2;
        e.userData.ignoreCameraOcclusion = true;
        group.add(e);
        embers.push(e);
    }

    // Permanent thin red beacon — rotates, rises particles, stays forever
    const BEACON_BASE_Y = 8.5;
    const BEACON_HEIGHT = 3000;
    const beaconGrp = new THREE.Group();
    beaconGrp.position.y = BEACON_BASE_Y;
    beaconGrp.userData.ignoreCameraOcclusion = true;

    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xFF1100, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false,
    });
    const beamMesh = new THREE.Mesh(
        // new THREE.CylinderGeometry(0.04, 0.18, BEACON_HEIGHT, 8, 1, true),
        new THREE.CylinderGeometry(0.3, 0.3, BEACON_HEIGHT, 8, 1, true),
        beamMat
    );
    beamMesh.position.y = BEACON_HEIGHT / 2 - 1;
    beamMesh.userData.ignoreCameraOcclusion = true;
    // renderOrder > 0 forces the beam to draw after water (renderOrder 0),
    // so depthTest correctly keeps the beam visible in front of background water.
    beamMesh.renderOrder = 2;
    beaconGrp.add(beamMesh);

    // Inner brighter core
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xFF5500, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(
        // new THREE.CylinderGeometry(0.015, 0.06, BEACON_HEIGHT, 6, 1, true),
        new THREE.CylinderGeometry(0.13, 0.13, BEACON_HEIGHT, 6, 1, true),
        coreMat
    );
    coreMesh.position.y = BEACON_HEIGHT / 2 - 1;
    coreMesh.userData.ignoreCameraOcclusion = true;
    coreMesh.renderOrder = 2;
    beaconGrp.add(coreMesh);

    // Rising particles spiraling up the beacon
    const beaconParticles = [];
    const bpMat = new THREE.MeshBasicMaterial({ color: 0xFF4400, transparent: true });
    for (let i = 0; i < 40; i++) {
        const bp = new THREE.Mesh(
            new THREE.SphereGeometry(0.045 + Math.random() * 0.065, 4, 4),
            bpMat.clone()
        );
        bp.userData.orbitAngle = (i / 14) * Math.PI * 2;
        bp.userData.orbitRadius = 0.08 + Math.random() * 0.52;
        bp.userData.riseSpeed = 6 + Math.random() * 9;
        bp.userData.maxY = 35 + Math.random() * 40;
        bp.position.y = Math.random() * bp.userData.maxY;
        bp.userData.ignoreCameraOcclusion = true;
        beaconGrp.add(bp);
        beaconParticles.push(bp);
    }

    group.add(beaconGrp);
    group.userData.beaconGrp = beaconGrp;
    group.userData.beaconParticles = beaconParticles;

    group.userData.crystals = crystals;
    group.userData.embers   = embers;
    group.userData.runeRing = runeRing;
    setObjectHitProfile(group, {
        shape: 'frustum',
        start: { x: 0, y: 0.1, z: 0 },
        end: { x: 0, y: 8.6, z: 0 },
        radiusStart: 4.9,
        radiusEnd: 1.0
    }, { debugKey: 'shrineStartHitboxDebug' });

    shrine = group;
    scene.add(shrine);
    shrineActive = true;
    spawnShrineBeacon(group.position.x, group.position.y, group.position.z);
}

function showRoundBanner(title, subtitle, titleColor = '#ff2200', subtitleColor = '#ff6644') {
    const shadow = titleColor === '#ffdd00' ? '0 0 20px #ffaa00,0 0 40px #cc7700' : '0 0 20px #ff0000,0 0 40px #880000';
    const banner = document.createElement('div');
    banner.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:rgba(10,0,20,0.75);pointer-events:none;z-index:700;
        transition:opacity 0.5s;`;
    banner.innerHTML = `
        <div style="font-size:64px;font-weight:bold;color:${titleColor};
            text-shadow:${shadow};
            font-family:'Segoe UI',Arial,sans-serif;letter-spacing:4px;">${title}</div>
        ${subtitle ? `<div style="font-size:18px;font-weight:bold;color:${subtitleColor};margin-top:20px;
            font-family:'Segoe UI',Arial,sans-serif;
            text-shadow:${titleColor === '#ffdd00' ? '0 0 10px #ffaa00' : '0 0 10px #880000'};">${subtitle}</div>` : ''}`;
    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = '0'; }, 2000);
    setTimeout(() => banner.remove(), 2600);
}

function startDemonRound(roundNumber) {
    // Is this the ENTRY to the hell run, or just the next round inside one?
    // Read before roundMode is set below. Only the entry decides whether the
    // dragon comes along; every later round must leave it exactly as it is.
    const enteringHell = !roundMode;
    // Demons per round: 50, 100, 200, 300, 400, 500, ...
    currentRound       = roundNumber;
    roundDemonsTotal   = getRoundDemonCount(roundNumber); //DEBUG - change to get through rounds quickly
    roundDemonsSpawned = 0;
    roundSpawnTimer    = 0;
    roundBetweenActive = false;
    roundBetweenTimer  = 0;
    demonTeleportUnlockTimer = DEMON_TELEPORT_UNLOCK_DELAY_SEC;
    roundMode          = true;
    demonApocalypse    = true;
    updateTopCornerHudVisibility();
    if (typeof killAllNightCreatures === 'function') killAllNightCreatures();
    playerDead         = false;
    playerHealth       = 100;
    dragonHealth       = 100;
    hasPlayedDemonRounds = true;

    // Round 3+: batch size based on second half only (so we still get ~6 batches)
    const batchBase = roundNumber >= 3 ? Math.floor(roundDemonsTotal / 2) : roundDemonsTotal;
    const numBatches = getRoundNumBatches(roundNumber);
    roundBatchSize = Math.max(5, Math.ceil(batchBase / numBatches));
    if (roundNumber === 1) {
        roundKillCount = 0;
        // Despawn all peaceful NPCs on hell run start (round 1 only)
        if (!savedNpcCounts) despawnAllNPCsForHell();
    }
    updateBestDemonRoundsRun();

    // Hide shrine + prompt
    if (shrine) { shrine.visible = false; shrineActive = false; }
    document.getElementById('shrine-prompt').style.display = 'none';

    // Match original demon apocalypse sky
    scene.background = new THREE.Color(0x6B0000);
    scene.fog.color.setHex(0x3B0000);
    scene.fog.near = 60;
    scene.fog.far  = 500;
    sun.color.setHex(0xFF2200);
    sun.intensity  = 0.45;
    ambientLight.color.setHex(0x550000);
    ambientLight.intensity = 0.35;
    updateWaterLighting();
    setWaterCombatColor(true);

    // Show UI
    document.getElementById('demon-counter').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';

    // Always dismount the player; then, ONLY when entering hell, leave an
    // untethered dragon behind in the overworld. Once the dragon is down here
    // it stays for the rest of the run whether tethered or not: the player is
    // free to untether it and park it somewhere, and it has to still be there
    // when the next round starts. Poofing it every round meant an untethered
    // dragon vanished the moment a round ended.
    if (mountedOnDragon) unmountDragon();
    if (enteringHell && dragon && dragon.visible && !dragonTethered) {
        const poofPos = dragon.position.clone();
        const poofGroup = new THREE.Group();
        poofGroup.userData.ignoreCameraOcclusion = true;
        for (let i = 0; i < 30; i++) {
            const p = new THREE.Mesh(
                new THREE.SphereGeometry(0.4 + Math.random() * 0.8, 5, 5),
                new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.9 })
            );
            p.position.copy(poofPos).add(new THREE.Vector3(
                (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
            p.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * 20, Math.random() * 15 + 5, (Math.random() - 0.5) * 20);
            poofGroup.add(p);
        }
        scene.add(poofGroup);
        dragon.visible = false;
        dragonDescending = false;
        let pt = 0;
        const animPoof = () => {
            pt += 0.016;
            poofGroup.children.forEach(p => {
                p.position.addScaledVector(p.userData.vel, 0.016);
                p.material.opacity = Math.max(0, 0.9 - pt * 1.5);
            });
            if (pt < 0.8) requestAnimationFrame(animPoof);
            else scene.remove(poofGroup);
        };
        animPoof();
    }

    // Round 3+: spawn first half immediately, then delay first batch by 15s
    if (roundNumber >= 3) {
        const immediateCount = Math.floor(roundDemonsTotal / 2);
        const minDist = getRoundMinDist(roundNumber);
        const maxDist = getRoundMaxDist(roundNumber);
        const bound = WORLD_SIZE - 20;
        for (let i = 0; i < immediateCount; i++) {
            const dData = createDemon(true);
            const angle = Math.random() * Math.PI * 2;
            const dist  = minDist + Math.random() * (maxDist - minDist);
            const sx = player.position.x + Math.cos(angle) * dist;
            const sz = player.position.z + Math.sin(angle) * dist;
            const cx = Math.max(-bound, Math.min(bound, sx));
            const cz = Math.max(-bound, Math.min(bound, sz));
            dData.mesh.position.set(cx, getMoverSurfaceHeight(cx, cz, true), cz);
            scene.add(dData.mesh);
            demons.push(dData);
            roundDemonsSpawned++;
        }
        roundSpawnTimer = 15; // first batch fires 15s after immediate spawn
    }

    showRoundBanner(`ROUND ${currentRound}`, '');
    updateDemonCounter();
    updateHealthBar();
}

function getRoundMaxDist(round) {
    if (round <= 1) return 300;
    if (round === 2) return 400;
    if (round === 3) return 500;
    if (round >= 4 && round <= 6) return 600;
    return 750; // round 7+
}

function getRoundMinDist(round) {
    if (round <= 1) return 200;
    if (round === 2) return 150;
    if (round >= 3 && round <= 5) return 100;
    return 120; // round 6+
}

function getRoundDemonCount(round) {
    if (round <= 1) return 50;
    if (round === 2) return 100;
    if (round === 3) return 200;
    if (round === 4) return 300;
    if (round === 5) return 400;
    if (round === 6) return 500;
    return 500 + 50*(round - 6); // round 7+ (increment by 50 per round)
}

function getRoundNumBatches(round) {
    if (round <= 5) return 6;
    if (round >= 6 && round <= 8) return 8;
    if (round >= 9 && round <= 10) return 10;
    return 12; // round 11+
}

function updateRoundSpawning(delta) {
    if (!roundMode || roundBetweenActive || playerDead) return;
    if (roundDemonsSpawned >= roundDemonsTotal) return;

    roundSpawnTimer -= delta;
    if (roundSpawnTimer > 0) return;

    roundSpawnTimer = 15;
    const remaining  = roundDemonsTotal - roundDemonsSpawned;
    const batchCount = Math.min(roundBatchSize, remaining);
    const minDist    = getRoundMinDist(currentRound);
    const maxDist    = getRoundMaxDist(currentRound);
    const biased     = currentRound >= 3;

    for (let i = 0; i < batchCount; i++) {
        const dData = createDemon(biased);
        const angle = Math.random() * Math.PI * 2;
        const dist  = minDist + Math.random() * (maxDist - minDist);
        const sx    = player.position.x + Math.cos(angle) * dist;
        const sz    = player.position.z + Math.sin(angle) * dist;
        const bound = WORLD_SIZE - 20;
        const cx    = Math.max(-bound, Math.min(bound, sx));
        const cz    = Math.max(-bound, Math.min(bound, sz));
        dData.mesh.position.set(cx, getMoverSurfaceHeight(cx, cz, true), cz);
        scene.add(dData.mesh);
        demons.push(dData);
        roundDemonsSpawned++;
    }

    updateDemonCounter();
}

function endRound() {
    roundBetweenActive = true;
    roundBetweenTimer  = 5;

    // Single yellow flash
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,220,0,0.55);pointer-events:none;z-index:800;transition:opacity 0.4s';
    document.body.appendChild(f);
    setTimeout(() => { f.style.opacity = '0'; }, 100);
    setTimeout(() => f.remove(), 600);

    const subtitle = currentRound === 2 ? '🔥 CAMPFIRE SHIELD ACTIVATED 🔥' : '';
    showRoundBanner(`ROUND ${currentRound} COMPLETE`, subtitle, '#ffdd00', '#ffdd00');
}

function updateBetweenRound(delta) {
    if (!roundMode || !roundBetweenActive) return;

    roundBetweenTimer -= delta;

    if (roundBetweenTimer <= 0) {
        roundBetweenActive = false;
        startDemonRound(currentRound + 1);
    }
}

function showBetweenRoundUI(nextRound, nextDemonCount) {
    const ui = document.getElementById('between-round-ui');
    document.getElementById('between-round-title').textContent =
        `Round ${nextRound} incoming — ${nextDemonCount} demons`;
    ui.style.display = 'block';
}

function hideBetweenRoundUI() {
    document.getElementById('between-round-ui').style.display = 'none';
}

function updateBetweenRoundCountdownUI(timer) {
    document.getElementById('between-round-timer').textContent = Math.ceil(timer);
}

function updateShrine(delta, time) {
    if (!shrine || !shrine.visible) return;

    const baseAngle = time * 0.8;
    for (let i = 0; i < 3; i++) {
        const crystal = shrine.userData.crystals[i];
        const a = baseAngle + (i / 3) * Math.PI * 2;
        crystal.position.x = Math.cos(a) * 2.5;
        crystal.position.z = Math.sin(a) * 2.5;
        crystal.rotation.y = a;
    }

    shrine.userData.embers.forEach(e => {
        e.position.y += Math.sin(time * 2 + e.userData.offset) * delta * 0.4;
        e.position.x += Math.cos(time * 1.5 + e.userData.offset) * delta * 0.15;
        if (e.position.y > 6) e.position.y = 0.5;
    });

    shrine.userData.runeRing.material.opacity = 0.4 + Math.sin(time * 2) * 0.25;

    // Animate permanent beacon
    if (shrine.userData.beaconGrp) {
        shrine.userData.beaconGrp.rotation.y += delta * 0.35;
        const t = time;
        shrine.userData.beaconParticles.forEach((bp, idx) => {
            bp.position.y += bp.userData.riseSpeed * delta;
            // Spiral orbit
            bp.userData.orbitAngle += delta * (0.6 + idx * 0.04);
            bp.position.x = Math.cos(bp.userData.orbitAngle) * bp.userData.orbitRadius;
            bp.position.z = Math.sin(bp.userData.orbitAngle) * bp.userData.orbitRadius;
            // Fade out as it rises, reset at top
            const frac = bp.position.y / bp.userData.maxY;
            bp.material.opacity = Math.max(0, 0.85 * (1 - frac));
            if (bp.position.y > bp.userData.maxY) {
                bp.position.y = 0;
                bp.material.opacity = 0.85;
            }
        });
    }

    const dist = player.position.distanceTo(shrine.position);
    document.getElementById('shrine-prompt').style.display =
        (shrineActive && dist < SHRINE_INTERACT_DIST) ? 'block' : 'none';
}

function restartCurrentRound() {
    demons.forEach(d => scene.remove(d.mesh));
    demons.length = 0;
    playerDead = false;
    document.getElementById('death-screen').style.display = 'none';
    // Teleport to shrine
    const tx = shrine ? shrine.position.x : 0;
    const tz = shrine ? shrine.position.z + 8 : 8;
    player.position.set(tx, getGroundHeight(tx, tz), tz);
    velocity.set(0, 0, 0);
    renderer.domElement.requestPointerLock();
    startDemonRound(1);
}

function exitRoundMode() {
    roundMode = false;
    demonApocalypse = false;
    demonTeleportUnlockTimer = 0;
    updateTopCornerHudVisibility();
    roundBetweenActive = false;

    demons.forEach(d => scene.remove(d.mesh));
    demons.length = 0;

    setTimeOfDay('day');
    setWaterCombatColor(false);

    document.getElementById('demon-counter').style.display = 'none';
    document.getElementById('campfire-shield').style.display = 'none';
    document.getElementById('health-bar-container').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    hideBetweenRoundUI();

    playerDead   = false;
    playerHealth = 100;
    dragonHealth = 100;
    nearCampfireFlag = false;
    campfireShieldTimer = 0;
    roundKillCount = 0;

    // Respawn peaceful NPCs now that the hell run is over
    respawnSavedNPCs();

    updateHealthBar();

    player.position.set(0, getGroundHeight(0, 0), 8);
    velocity.set(0, 0, 0);

    renderer.domElement.requestPointerLock();

    if (shrine) { shrine.visible = true; shrineActive = true; }

    if (dragon && dragonAscended) {
        dragon.visible = true;
        dragonDescending = true;
        dragon.position.set(player.position.x, player.position.y + 150, player.position.z);
    }
}
