const DEMON_SPAWN_COUNT = 150; //DEBUG - originally 150, change it to examine demons more closely
const DEMON_HIT_DAMAGE = 40; //DEBUG - originally 40, set to 0 for testing without dying
// Circumference of the campfire-timer SVG arc (r=13): 2π×13
const _CAMPFIRE_ARC_CIRC = 2 * Math.PI * 13;

function createDemon(biasedSpeed = false) {
    const demon = new THREE.Group();
    demon.userData.ignoreCameraOcclusion = true;
    const skinMat  = new THREE.MeshLambertMaterial({ color: 0x220000 });
    const darkMat  = new THREE.MeshLambertMaterial({ color: 0x220000 });
    const clothMat = new THREE.MeshLambertMaterial({ color: 0x220000 }); // used to be 0x2e1e0e
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const boneMat  = new THREE.MeshLambertMaterial({ color: 0xc8b88a });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.9), clothMat); 
    torso.position.y = 3.9; 
    demon.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 6), skinMat); 
    neck.position.y = 5.025; 
    demon.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.1), skinMat);
    head.position.y = 5.825; 
    demon.add(head);
    const faceAnimatedParts = [head];

    const eyeGeo = new THREE.SphereGeometry(0.18, 6, 6);
    [-0.32, 0.32].forEach(ex => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(ex, 5.875, 0.56); 
        demon.add(eye);
        faceAnimatedParts.push(eye);
    });

    const jawGroup = new THREE.Group();
    // bottom bone (black)
    const jawBottom = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.18, 0.3),
        darkMat
    );
    jawBottom.position.set(0, 5.0, 0.4);
    jawGroup.add(jawBottom);
    // left vertical bone (black)
    const jawLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.5, 0.3),
        darkMat
    );
    jawLeft.position.set(-0.35, 5.25, 0.4);
    jawGroup.add(jawLeft);
    // right vertical bone (black)
    const jawRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.5, 0.3),
        darkMat
    );
    jawRight.position.set(0.35, 5.25, 0.4);
    jawGroup.add(jawRight);
    // inner mouth wall (blood red)
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x8b0000 });
    const mouthBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.35, 0.05),
        mouthMat
    );

    // NOTE: REMOVED MOUTH COLOR, NOW IT'S SEE-THROUGH
    // slightly behind the jaw bones
    // mouthBack.position.set(0, 5.18, 0.3);
    // jawGroup.add(mouthBack);

    demon.add(jawGroup);
    faceAnimatedParts.push(jawGroup);

    // children[6,7,8,9]: Arms + hands (animated)
    const DEMON_TYPE = Math.floor(Math.random() * 4);  // we have 4 different styles for the arms
    const armGeo = new THREE.CylinderGeometry(0.15, 0.12, 2.9, 6);
    const armLongSpikeGeo = new THREE.CylinderGeometry(0.01, 0.19, 2.9, 6);
    const armShortSpikeGeo = new THREE.CylinderGeometry(0.01, 0.19, 0.9, 6);
    if (DEMON_TYPE === 0) {
        // Style 1: 4 cylindrical arms with 2 floating spheres (WEAKEST TYPE)
        [-1, 1].forEach(side => {
            // TOP arm
            const arm1 = new THREE.Mesh(armGeo, skinMat);
            arm1.rotation.z = side * (-Math.PI / 2.8);
            arm1.rotation.x = Math.PI / 3.5;
            arm1.position.set(side * 1.4, 4.5, 0.7);
            demon.add(arm1);

            // Floating spheres
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), darkMat); 
            sphere.position.set(side * 1.95, 3.9, 0.7); 
            demon.add(sphere);

            // BOTTOM arm
            const arm2 = new THREE.Mesh(armGeo, skinMat);
            arm2.rotation.z = side * (Math.PI / 2.5) + Math.PI; // flip cone direction
            arm2.rotation.x = -Math.PI / 3.5;
            arm2.position.set(side * 1.4, 3.3, 0.5);
            demon.add(arm2);
        });
    } else if (DEMON_TYPE === 1) {
        // Style 2: 4 cylindrical arms with 2 floating spheres and 2 small spikes
        [-1, 1].forEach(side => {
            // TOP arm
            const arm1 = new THREE.Mesh(armGeo, skinMat);
            arm1.rotation.z = side * (-Math.PI / 2.8);
            arm1.rotation.x = Math.PI / 3.5;
            arm1.position.set(side * 1.4, 4.5, 0.7);
            demon.add(arm1);

            // MIDDLE arm — short horizontal spikes
            const arm2 = new THREE.Mesh(armShortSpikeGeo, skinMat);
            arm2.rotation.z = side * (Math.PI / 2) + Math.PI;   // 90 degrees = horizontal
            arm2.rotation.y = side * (-Math.PI / 11);
            arm2.position.set(side * 0.9, 3.87, 0.4);
            demon.add(arm2);

            // Floating spheres
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), darkMat); 
            sphere.position.set(side * 1.95, 3.9, 0.7); 
            demon.add(sphere);

            // BOTTOM arm
            const arm3 = new THREE.Mesh(armGeo, skinMat);
            arm3.rotation.z = side * (Math.PI / 2.5) + Math.PI; // flip cone direction
            arm3.rotation.x = -Math.PI / 3.5;
            arm3.position.set(side * 1.4, 3.3, 0.5);
            demon.add(arm3);
        });
    } else if (DEMON_TYPE === 2) {
        // Style 3: 4 cylindrical arms with 2 floating spheres and 2 long spikes
        [-1, 1].forEach(side => {
            // TOP arm
            const arm1 = new THREE.Mesh(armGeo, skinMat);
            arm1.rotation.z = side * (-Math.PI / 2.8);
            arm1.rotation.x = Math.PI / 3.5;
            arm1.position.set(side * 1.4, 4.5, 0.7);
            demon.add(arm1);

            // MIDDLE arm — long horizontal spikes
            const arm2 = new THREE.Mesh(armLongSpikeGeo, skinMat);
            arm2.rotation.z = side * (Math.PI / 2) + Math.PI;   // 90 degrees = horizontal
            arm2.rotation.y = side * (-Math.PI / 11);
            arm2.position.set(side * 1.4, 3.87, 0.6);
            demon.add(arm2);

            // Floating spheres
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), darkMat); 
            sphere.position.set(side * 1.95, 3.9, 0.7); 
            demon.add(sphere);

            // BOTTOM arm
            const arm3 = new THREE.Mesh(armGeo, skinMat);
            arm3.rotation.z = side * (Math.PI / 2.5) + Math.PI; // flip cone direction
            arm3.rotation.x = -Math.PI / 3.5;
            arm3.position.set(side * 1.4, 3.3, 0.5);
            demon.add(arm3);
        });
    } else {
        // Style 4: 6 long spikes for arms (STRONGEST TYPE)
        [-1, 1].forEach(side => {
            // TOP arm — long horizontal spikes
            const arm1 = new THREE.Mesh(armLongSpikeGeo, skinMat);
            arm1.rotation.z = side * (-Math.PI / 2.8);
            arm1.rotation.x = Math.PI / 3.5;
            arm1.position.set(side * 1.4, 4.5, 0.7);
            demon.add(arm1);

            // MIDDLE arm — long horizontal spikes
            const arm2 = new THREE.Mesh(armLongSpikeGeo, skinMat);
            arm2.rotation.z = side * (Math.PI / 2) + Math.PI;   // 90 degrees = horizontal
            arm2.rotation.y = side * (-Math.PI / 11);
            arm2.position.set(side * 0.9, 3.87, 0.4);
            demon.add(arm2);

            // BOTTOM arm — long horizontal spikes
            const arm3 = new THREE.Mesh(armLongSpikeGeo, skinMat);
            arm3.rotation.z = side * (Math.PI / 2.5) + Math.PI; // flip cone direction
            arm3.rotation.x = -Math.PI / 3.5;
            arm3.position.set(side * 1.4, 3.3, 0.5);
            demon.add(arm3);
        });
    }
    const legGeo = new THREE.CylinderGeometry(0.25, 0.1, 3.6, 6);
    [-0.32, 0.32].forEach((lx, li) => {
        const leg = new THREE.Mesh(legGeo, clothMat);
        leg.position.set(lx, 1.8, li === 0 ? 0.1 : -0.1);
        leg.rotation.z = lx * 0.1;
        demon.add(leg);
    });

    demon.scale.set(1.2, 1.2, 1.2);

    // Random speed in range: 50% walk speed to 60% run speed
    const minSpd = 0.5*WALK_SPEED; //DEBUG - change the speed to examine demons more closely
    const maxSpd = 0.6*RUN_SPEED;
    // biasedSpeed: squared sampling biased toward faster (round 3+)
    const t = biasedSpeed ? 1 - Math.pow(Math.random(), 2) : Math.random();
    const speed  = minSpd + t * (maxSpd - minSpd);
    const normalizedSpd = (speed - minSpd) / (maxSpd - minSpd);
    // Hit cooldown: slowest -> 1 hit/sec (1.0s), fastest -> 2 hits/sec (0.5s)
    const hitCooldown = 1.0 - normalizedSpd * 0.5;

    demon.children.forEach(part => {
        part.userData.baseX = part.position.x;
        part.userData.baseY = part.position.y;
        part.userData.baseZ = part.position.z;
    });
    demon.userData.faceAnimatedParts = faceAnimatedParts;
    enableMeshShadows(demon);

    return {
        mesh: demon,
        type: 'demon',
        speed,
        hitCooldown,
        hitTimer: Math.random() * hitCooldown,
        gunShotsToKill: 3 + DEMON_TYPE,
        gunHitCenterY: 4.8, // root is at feet; gun ray tests should target torso/head volume
        gunHitRadius: 4.6,
        lungeProgress: 0,
        lunging: false,
        animPhase: Math.random() * Math.PI * 2,  // randomise animation start
        wallPhaseTimer: 0,
        wallPhaseWall: null,
        wallPhaseActive: false
    };
}

function triggerDemonApocalypse() {
    if (demonApocalypse) return;
    demonApocalypse = true;
    updateTopCornerHudVisibility();

    // ── Blood-red apocalypse sky ──
    scene.background = new THREE.Color(0x6B0000);
    scene.fog.color  = new THREE.Color(0x3B0000);
    scene.fog.near   = 60;
    scene.fog.far    = 500;
    sun.color.setHex(0xFF2200);
    sun.intensity    = 0.45;
    ambientLight.color.setHex(0x550000);
    ambientLight.intensity = 0.35;
    updateWaterLighting();
    setWaterCombatColor(true);

    // Show UI (counter + health bar — no banner)
    document.getElementById('demon-counter').style.display      = 'block';
    document.getElementById('health-bar-container').style.display = 'block';

    // Despawn all peaceful NPCs for performance and atmosphere
    if (!savedNpcCounts) despawnAllNPCsForHell();

    // Remove magenta gem but do NOT grant powers yet (granted on victory)
    if (secretGem && !gemCollected) {
        scene.remove(secretGem.mesh);
        gemCollected = true;
    }

    // Always dismount the player; then poof the dragon only if not tethered.
    if (mountedOnDragon) unmountDragon();
    if (dragon && !dragonTethered) {
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

    // Dramatic crimson screen flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(150,0,0,0.85);pointer-events:none;z-index:800;transition:opacity 1.5s';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    setTimeout(() => flash.remove(), 1800);

    // ── Spawn demons with random speeds; sort and assign spawn distance by speed ──
    const cx = player.position.x;
    const cz = player.position.z;
    const allDemons = [];

    for (let i = 0; i < DEMON_SPAWN_COUNT; i++) {
        const dData = createDemon();
        allDemons.push(dData);
        scene.add(dData.mesh);
        demons.push(dData);
    }

    positionDemonsAroundPlayer(allDemons, cx, cz);

    updateDemonCounter();
}

function updateDemonCounter() {
    const el = document.getElementById('demon-count');
    if (!el) return;
    if (roundMode) {
        const alive = demons.length;
        const notYetSpawned = roundDemonsTotal - roundDemonsSpawned;
        el.textContent = alive + notYetSpawned;
        // Update round label if present
        const rl = document.getElementById('round-label');
        if (rl) { rl.textContent = `ROUND ${currentRound}`; rl.style.display = 'block'; }
    } else {
        el.textContent = demons.length;
        const rl = document.getElementById('round-label');
        if (rl) rl.style.display = 'none';
    }
}

// Campfire shield linger countdown — pie arc depletes over 10 s

function isCampfireShieldActive() {
    return demonApocalypse && (!roundMode || currentRound >= 3);
}

function updateCampfireLingerUI(nearFire, timerVal) {
    const wrap = document.getElementById('campfire-linger-wrap');
    const arc  = document.getElementById('campfire-timer-arc');
    const txt  = document.getElementById('campfire-timer-text');
    if (!wrap) return;
    if (!nearFire && timerVal > 0) {
        wrap.style.display = 'flex';
        const frac = timerVal / 10;
        arc.setAttribute('stroke-dashoffset', (_CAMPFIRE_ARC_CIRC * (1 - frac)).toFixed(2));
        // Fade from orange -> red as time runs low
        const g = Math.round(100 * frac);
        arc.setAttribute('stroke', `rgb(255,${g + 50},0)`);
        txt.textContent = Math.ceil(timerVal) + 's';
    } else {
        wrap.style.display = 'none';
    }
}

function updateHealthBar() {
    const health = mountedOnDragon ? dragonHealth : playerHealth;
    const fill = document.getElementById('health-bar-fill');
    if (!fill) return;
    fill.style.width = Math.max(0, health) + '%';
    if (nearCampfireFlag) {
        fill.classList.add('health-bar-campfire');
        fill.style.background = '';
    } else {
        fill.classList.remove('health-bar-campfire');
        const g = Math.round(200 * (health / 100));
        fill.style.background = `linear-gradient(90deg, rgb(255,${g},0), rgb(200,${Math.round(g*0.8)},0))`;
    }
}

function explodeDemon(zData, index) {
    const mesh = zData.mesh;
    const pos  = mesh.position.clone();
    const colors = [0x3d5c2a, 0xff2200, 0x2e1e0e, 0xc8b88a, 0x000000, 0xff6600];

    const particles = new THREE.Group();
    particles.userData.ignoreCameraOcclusion = true;
    // 60 particles, bigger sizes, faster velocities
    for (let i = 0; i < 60; i++) {
        const size = 0.3 + Math.random() * 0.9;
        const geo  = Math.random() > 0.4
            ? new THREE.BoxGeometry(size, size, size)
            : new THREE.SphereGeometry(size * 0.6, 5, 5);
        const p = new THREE.Mesh(
            geo,
            new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
        );
        p.position.copy(pos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4));
        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 35,
            Math.random() * 28 + 10,
            (Math.random() - 0.5) * 35
        );
        particles.add(p);
    }

    // Large shockwave ring
    const ringGeo = new THREE.RingGeometry(0.2, 1, 20);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xff2200, transparent: true, opacity: 1, side: THREE.DoubleSide }));
    ring.userData.ignoreCameraOcclusion = true;
    ring.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    scene.add(particles);
    scene.remove(mesh);
    demons.splice(index, 1);
    recordKill('demon');
    if (roundMode) roundKillCount++;
    if (roundMode) updateBestDemonRoundsRun();
    updateStats();
    updateDemonCounter();

    let t = 0;
    const anim = () => {
        t += 0.016;
        particles.children.forEach(p => {
            p.position.addScaledVector(p.userData.velocity, 0.016);
            p.userData.velocity.y -= 28 * 0.016;
            p.material.transparent = true;
            p.material.opacity = Math.max(0, 1 - t * 0.7);
        });
        const rs = 1 + t * 16;
        ring.scale.set(rs, rs, 1);
        ring.material.opacity = Math.max(0, 1 - t * 1.5);
        if (t < 2) requestAnimationFrame(anim);
        else { scene.remove(particles); scene.remove(ring); }
    };
    anim();

    if (demons.length === 0) demonVictory();
}

// Separation runs every 3rd frame to reduce O(n²) cost without noticeable visual change.
let _demonSepFrame = 0;

function updateDemons(delta) {
    if (!demonApocalypse || playerDead || demons.length === 0) return;

    _demonSepFrame = (_demonSepFrame + 1) % 3;
    const runSeparation = _demonSepFrame === 0;

    const targetPos = mountedOnDragon ? dragon.position : player.position;
    const now = performance.now() / 1000;
    const campfireShieldActive = isCampfireShieldActive();
    const playerWaterState = mountedOnDragon
        ? null
        : getWaterTraversalState(
            player.position.x,
            player.position.z,
            player.position.y,
            PLAYER_WATER_HEIGHT
        );

    let nearFire = false;
    if (campfireShieldActive) {
        // Campfire proximity check — shield lingers for 10 s after leaving
        for (const cp of campfirePositions) {
            if (targetPos.distanceTo(cp) < 22) { nearFire = true; break; }
        }
        if (nearFire) {
            campfireShieldTimer = 10;
        } else {
            campfireShieldTimer = Math.max(0, campfireShieldTimer - delta);
        }
        nearCampfireFlag = nearFire || campfireShieldTimer > 0;
    } else {
        campfireShieldTimer = 0;
        nearCampfireFlag = false;
    }
    document.getElementById('campfire-shield').style.display =
        nearCampfireFlag ? 'block' : 'none';
    updateCampfireLingerUI(nearFire, campfireShieldTimer);

    const sepRadius = 6;   // minimum distance between demons
    const demonRadius = 0.8; // for wall collision

    for (let i = demons.length - 1; i >= 0; i--) {
        const z  = demons[i];
        const zp = z.mesh.position;
        const dx = targetPos.x - zp.x;
        const dz = targetPos.z - zp.z;
        const distXZ  = Math.sqrt(dx * dx + dz * dz);
        const previousXZ = { x: zp.x, z: zp.z };

        // Face player
        if (distXZ > 0.01) z.mesh.rotation.y = Math.atan2(dx, dz);

        // ── Chase (XZ movement) ──
        if (distXZ > 5) {
            zp.x += (dx / distXZ) * z.speed * delta;
            zp.z += (dz / distXZ) * z.speed * delta;
        }

        // ── Water handling: demons stay on submerged ground unless a nearby submerged player pulls them up ──
        const demonWaterState = getWaterTraversalState(zp.x, zp.z, zp.y);
        if (demonWaterState.water && !demonWaterState.structureAboveWater) {
            const playerCanPullDemonUp =
                playerWaterState &&
                playerWaterState.isSwimming &&
                distXZ <= DEMON_WATER_PLAYER_RISE_RANGE;

            if (playerCanPullDemonUp) {
                const targetY = Math.max(demonWaterState.floorY, player.position.y);
                zp.y = moveScalarToward(zp.y, targetY, z.speed * delta);
            } else {
                zp.y = demonWaterState.floorY;
            }
        } else {
            zp.y = demonWaterState.landY;
        }

        // ── Solid wall collision ──
        // Enclosed structure walls (tent/house/cave) are skipped when the player is >50 units
        // away — this prevents demons from getting permanently stuck inside those structures.
        // All other walls (towers, arches, etc.) are always respected.
        const farFromPlayer = distXZ >= 50;
        for (const wall of solidWalls) {
            if (farFromPlayer && wall.isEnclosed) continue;
            if (z.wallPhaseActive && z.wallPhaseWall === wall) continue;
            if (wall.minY !== undefined && (zp.y < wall.minY || zp.y > wall.maxY)) continue;
            const push = resolveCircularWallCollision(zp, demonRadius, wall, previousXZ);
            if (push) {
                zp.x += push.x;
                zp.z += push.z;
            }
        }

        updateDemonWallPhaseState(z, zp, zp.y, demonRadius, delta, farFromPlayer);

        // ── Separation: accumulate and clamp so demons don't slingshot each other ──
        // Runs every 3rd frame only — O(n²) cost is too high to pay every frame.
        if (runSeparation) {
            const SEPARATION_STRENGTH = 10; // MODIFIED: fixed separation tuning
            const MAX_SEPARATION_STEP = 4;  // MODIFIED: hard cap on separation speed contribution

            let sepX = 0; // MODIFIED: accumulate separation X
            let sepZ = 0; // MODIFIED: accumulate separation Z

            for (let j = 0; j < demons.length; j++) {
                if (j === i) continue;

                const sdx = zp.x - demons[j].mesh.position.x;
                const sdz = zp.z - demons[j].mesh.position.z;
                const sd  = Math.sqrt(sdx * sdx + sdz * sdz);

                if (sd < sepRadius && sd > 0.001) {
                    const push = (sepRadius - sd) / sepRadius; // MODIFIED: normalized overlap strength
                    sepX += (sdx / sd) * push; // MODIFIED: accumulate direction only
                    sepZ += (sdz / sd) * push; // MODIFIED: accumulate direction only
                }
            }

            const sepLen = Math.sqrt(sepX * sepX + sepZ * sepZ); // MODIFIED: measure accumulated separation
            if (sepLen > 0.001) {
                const capped = Math.min(sepLen * SEPARATION_STRENGTH, MAX_SEPARATION_STEP); // MODIFIED: cap total push
                zp.x += (sepX / sepLen) * capped * delta; // MODIFIED: apply capped separation
                zp.z += (sepZ / sepLen) * capped * delta; // MODIFIED: apply capped separation
            }
        }

        // ── Idle animation: super-fast menacing head shift ──
        const phase = now * 90 + z.animPhase; // fast oscillation
        z.mesh.userData.faceAnimatedParts.forEach(part => {
            const baseX = part.userData.baseX; // part's original X position
            const shiftAmount = 0.06; // how far it slides left-right
            part.position.x = baseX + Math.sin(phase) * shiftAmount;
        });

        // ── Hit player when in 3D range ──
        const hitDy = targetPos.y - zp.y;
        const dist3D = Math.sqrt(dx * dx + hitDy * hitDy + dz * dz);
        z.hitTimer -= delta;
        if (dist3D < 5.5 && z.hitTimer <= 0) {
            z.hitTimer = z.hitCooldown;
            z.lunging  = true;
            z.lungeProgress = 0;

            let damage = DEMON_HIT_DAMAGE;
            if (hasSwordShield && currentHandItem === 'sword-shield') damage *= 0.7;
            if (nearCampfireFlag) damage *= 0.5;
            playerHealth = Math.max(0, playerHealth - damage);
            dragonHealth = Math.max(0, dragonHealth - damage);

            // Red screen flash
            const flash = document.createElement('div');
            flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(220,0,0,0.38);pointer-events:none;z-index:400;transition:opacity 0.3s';
            document.body.appendChild(flash);
            setTimeout(() => { flash.style.opacity = '0'; }, 60);
            setTimeout(() => flash.remove(), 400);

            updateHealthBar();
            const activeHealth = mountedOnDragon ? dragonHealth : playerHealth;
            if (activeHealth <= 0 && !playerDead) showDeathScreen();
        }
    }

    const HEALTH_REGEN_RATE = 5;
    const CAMPFIRE_HEALTH_REGEN_RATE = 5 * HEALTH_REGEN_RATE
    // Passive health regen
    if (!playerDead) {
        const regenRate = nearCampfireFlag ? CAMPFIRE_HEALTH_REGEN_RATE : HEALTH_REGEN_RATE;

        playerHealth = Math.min(100, playerHealth + regenRate * delta);
        dragonHealth = Math.min(100, dragonHealth + regenRate * delta);

        updateHealthBar();
    }
}

function demonVictory() {
    if (roundMode) { endRound(); return; }
    shadowManPostApocalypseUnlocked = true;
    demonApocalypse = false;
    updateTopCornerHudVisibility();
    document.getElementById('demon-counter').style.display   = 'none';
    document.getElementById('campfire-shield').style.display  = 'none';
    nearCampfireFlag = false;
    campfireShieldTimer = 0;
    updateCampfireLingerUI(false, 0);

    // Restore fog
    scene.fog.near = 100;
    scene.fog.far  = 800;
    ambientLight.color.setHex(0x404040);
    sun.color.setHex(0xffffff);
    updateWaterLighting();
    setWaterCombatColor(false);

    // Respawn peaceful NPCs now that the apocalypse is over
    respawnSavedNPCs();

    // ── Grant gem powers to player (and white dragon, not original dragon) ──
    speedMultiplier = 10;
    jumpMultiplier  = 3;
    infiniteJump    = true;

    // ── Transform existing dragon into white post-apocalypse dragon ──
    if (dragon) {
        dragon.traverse(child => {
            if (!child.isMesh || !child.material) return;

            // Tail spikes & foot claws: electric blue, BasicMaterial (self-lit, visible in dark)
            if (child.userData.isDragonSpike || child.userData.isDragonClaw) {
                child.material = new THREE.MeshBasicMaterial({ color: 0x00DDFF });
                return;
            }
            // Eyes: already BasicMaterial — keep electric blue
            if (child.material.type === 'MeshBasicMaterial') {
                child.material = new THREE.MeshBasicMaterial({ color: 0x00DDFF });
                return;
            }
            const hex = child.material.color ? child.material.color.getHex() : 0;
            // Wing membranes: electric-blue translucent
            if (hex === 0x2a0a0a) {
                child.material = new THREE.MeshBasicMaterial({
                    color: 0x00DDFF, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
                return;
            }
            // Horns (redMaterial, 0xcc0000): BasicMaterial electric blue
            if (hex === 0xcc0000) {
                child.material = new THREE.MeshBasicMaterial({ color: 0x00DDFF });
                return;
            }
            // Everything else (body, neck, head, legs, wing bones, tail): dark blue-grey
            child.material = new THREE.MeshLambertMaterial({ color: 0x444455 });
        });
        dragonIsWhite = true;
        dragon.visible = true;
        // Trigger dragon descent
        dragonDescending = true;
        dragon.position.set(player.position.x, player.position.y + 150, player.position.z);
    }

    // ── Spawn magenta gem as post-apocalypse reward ──
    if (!gemCollected && !secretGem) createSecretGem();

    // ── Divine flash sequence ──
    let flashPhase = 0;
    const flashColors = [0xFFEE00, 0xFFFFFF, 0xAADDFF, 0xFFFFFF, 0x87CEEB];
    const flashDiv = document.createElement('div');
    flashDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:800;transition:background 0.3s,opacity 0.3s';
    document.body.appendChild(flashDiv);

    const doFlash = () => {
        if (flashPhase >= flashColors.length) {
            flashDiv.style.opacity = '0';
            setTimeout(() => flashDiv.remove(), 400);
            setTimeOfDay('day');
            document.getElementById('health-bar-container').style.display = 'none';
            createShrine();
            return;
        }
        const c = flashColors[flashPhase];
        const r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
        flashDiv.style.background = `rgb(${r},${g},${b})`;
        flashDiv.style.opacity    = '0.85';
        flashPhase++;
        setTimeout(doFlash, 280);
    };
    doFlash();
}

function showDeathScreen() {
    playerDead = true;
    deathPosition = player.position.clone();

    moveForward = false;   // MODIFIED: stop held movement immediately
    moveBackward = false;  // MODIFIED: stop held movement immediately
    moveLeft = false;      // MODIFIED: stop held movement immediately
    moveRight = false;     // MODIFIED: stop held movement immediately
    isRunning = false;     // MODIFIED: stop sprinting
    spaceHeld = false;     // MODIFIED: stop jump hold state

    velocity.set(0, 0, 0); // MODIFIED: fully freeze player motion
    isLocked = false;

    document.exitPointerLock();
    
    const ds = document.getElementById('death-screen');
    document.getElementById('death-sub').textContent = roundMode
        ? `Round ${currentRound} reached. ${roundKillCount} demon${roundKillCount === 1 ? '' : 's'} killed.`
        : 'The demon horde devoured your soul...';

    const fightBtn = document.getElementById('fight-again-btn');
    const hardBtn  = document.getElementById('hard-reset-btn');
    if (roundMode && fightBtn && hardBtn) {
        fightBtn.textContent = '⚔️ FIGHT AGAIN';
        fightBtn.onclick = restartCurrentRound;
        hardBtn.textContent  = '🌍 LEAVE HELL';
        hardBtn.onclick = exitRoundMode;
    } else if (fightBtn && hardBtn) {
        fightBtn.textContent = '💀 RESPAWN (+50 DEMONS)';
        fightBtn.onclick = respawnWithMoreDemons;
        hardBtn.textContent  = '🌍 RESTART WORLD';
        hardBtn.onclick = hardReset;
    }

    ds.classList.remove('active');
    ds.style.display = 'flex';
    setTimeout(() => ds.classList.add('active'), 1000); // enable buttons after 1s
}

function hardReset() {
    location.reload();
}

function respawnWithMoreDemons() {
    playerDead   = false;
    playerHealth = 100;
    dragonHealth = 100;
    document.getElementById('death-screen').style.display = 'none';
    renderer.domElement.requestPointerLock();

    // Place player safely away from horde
    const rx = deathPosition ? deathPosition.x : 0;
    const rz = deathPosition ? deathPosition.z : 0;
    player.position.set(rx, getGroundHeight(rx, rz), rz);
    velocity.set(0, 0, 0);

    // Add 50 new demons
    const newlyAdded = [];
    for (let i = 0; i < 50; i++) {
        const dData = createDemon();
        scene.add(dData.mesh);
        demons.push(dData);
        newlyAdded.push(dData);
    }

    // Reposition ALL current demons (old survivors + newly added ones)
    positionDemonsAroundPlayer(demons, player.position.x, player.position.z);

    updateDemonCounter();
    updateHealthBar();
}

function positionDemonsAroundPlayer(demonList, centerX, centerZ) {
    // Sort by speed so slower demons spawn closer, faster ones farther
    demonList.sort((a, b) => a.speed - b.speed);

    const total = demonList.length;
    const third = Math.max(1, Math.floor(total / 3));

    demonList.forEach((dData, idx) => {
        let dist;

        // Slowest third: 120–220 units away; middle: 220–350; fastest: 350–500
        const D1 = 120, D2 = 220, D3 = 350, D4 = 500; // spawn distance thresholds
        if (idx < third) {
            dist = D1 + Math.random() * (D2 - D1); // slow: 120–220
        } else if (idx < 2 * third) {
            dist = D2 + Math.random() * (D3 - D2); // medium: 220–350
        } else {
            dist = D3 + Math.random() * (D4 - D3); // fast: 350–500
        }
        // dist = 100; //DEBUG - uncomment to make demons start closer for testing

        const angle = Math.random() * Math.PI * 2;
        const sx = centerX + Math.cos(angle) * dist;
        const sz = centerZ + Math.sin(angle) * dist;

        dData.mesh.position.set(sx, getMoverSurfaceHeight(sx, sz, true), sz);
    });
}

// ─────────────────────────────────────────────────────────────

