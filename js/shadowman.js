function createShadowManMesh() {
    const shadowGroup = new THREE.Group();
    shadowGroup.userData.ignoreCameraOcclusion = true;

    const shadowMat = new THREE.MeshLambertMaterial({ color: SHADOW_MAN_DAY_COLOR });
    const shadowNightMat = new THREE.MeshBasicMaterial({ color: SHADOW_MAN_NIGHT_COLOR });
    const parts = [];
    const partMeshes = [];

    // Torso
    const torso = {
        geometry: new THREE.BoxGeometry(1.5, 3.6, 0.7),
        position: [0, 5.4, 0]
    };
    parts.push(torso);

    // Head
    const head = {
        // geometry: new THREE.BoxGeometry(0.9, 1.3, 0.9),
        // position: [0, 8, 0]

        geometry: new THREE.SphereGeometry(0.52, 14, 14),
        position: [0, 8.1, 0],
        scale: [0.85, 1.4, 0.85]
    };
    parts.push(head);

    // Arms
    [-1, 1].forEach(side => {
        const arm = { 
            geometry: new THREE.BoxGeometry(0.28, 4.6, 0.28),
            position: [side * 1.2, 5.1, 0]
        };
        parts.push(arm);
    });

    // Shoulders
    const arm = { 
        geometry: new THREE.BoxGeometry(2.4, 0.7, 0.28),
        position: [0, 7, 0]
    };
    parts.push(arm);

    // Legs
    [-1, 1].forEach(side => {
        const leg = {
            // geometry: new THREE.BoxGeometry(0.45, 4.6, 0.45),
            geometry: new THREE.CylinderGeometry(0.24, 0.15, 4.6),
            position: [side * 0.4, 2.3, 0]
        };
        parts.push(leg);
    });

    parts.forEach(part => {
        const mesh = new THREE.Mesh(part.geometry, shadowMat);
        mesh.position.set(part.position[0], part.position[1], part.position[2]);
        if (part.scale) mesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        shadowGroup.add(mesh);
        partMeshes.push(mesh);
    });
    shadowGroup.userData.dayMaterial = shadowMat;
    shadowGroup.userData.nightMaterial = shadowNightMat;
    shadowGroup.userData.partMeshes = partMeshes;
    shadowGroup.userData.usingNightMaterial = false;
    shadowGroup.userData.headMesh = partMeshes[1]; // index 1 = head sphere

    // const glow = new THREE.PointLight(0xff9900, 20, 20);
    // glow.position.set(0, 5, 0);
    // shadowGroup.add(glow);

    return shadowGroup;
}

function updateShadowManColor() {
    if (!shadowMan) return;

    const partMeshes = shadowMan.mesh.userData.partMeshes;
    const dayMaterial = shadowMan.mesh.userData.dayMaterial;
    const nightMaterial = shadowMan.mesh.userData.nightMaterial;
    if (!partMeshes || !dayMaterial || !nightMaterial) return;

    const cycleProgress = gameTime / FULL_CYCLE;
    const useNightMaterial = cycleProgress >= NIGHT_START;
    if (shadowMan.mesh.userData.usingNightMaterial === useNightMaterial) return;

    const nextMaterial = useNightMaterial ? nightMaterial : dayMaterial;
    partMeshes.forEach(mesh => {
        mesh.material = nextMaterial;
    });
    shadowMan.mesh.userData.usingNightMaterial = useNightMaterial;
}

function spawnShadowManDebugBeacon(x, y, z) {
    const beaconHeight = 600;
    const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 8, beaconHeight, 18, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0xff2222,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    beacon.position.set(x, y + beaconHeight / 2, z);
    beacon.renderOrder = 930;
    beacon.userData.ignoreCameraOcclusion = true;
    scene.add(beacon);

    const startTime = performance.now();
    const durationMs = 3000;
    const animateBeaconFade = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / durationMs);
        beacon.material.opacity = 0.65 * (1 - t);

        if (t < 1) {
            requestAnimationFrame(animateBeaconFade);
            return;
        }

        scene.remove(beacon);
        beacon.geometry.dispose();
        beacon.material.dispose();
    };
    animateBeaconFade();
}

function spawnShrineBeacon(x, y, z) {
    const beaconHeight = 600;
    const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 8, beaconHeight, 18, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    beacon.position.set(x, y + beaconHeight / 2, z);
    beacon.renderOrder = 930;
    beacon.userData.ignoreCameraOcclusion = true;
    scene.add(beacon);

    const startTime = performance.now();
    const durationMs = 3000;
    const animateBeaconFade = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / durationMs);
        beacon.material.opacity = 0.65 * (1 - t);

        if (t < 1) {
            requestAnimationFrame(animateBeaconFade);
            return;
        }

        scene.remove(beacon);
        beacon.geometry.dispose();
        beacon.material.dispose();
    };
    animateBeaconFade();
}

function removeShadowMan() {
    if (!shadowMan || DEBUG_FREEZE_SHADOW_MAN) return;
    scene.remove(shadowMan.mesh);
    shadowMan = null;
}

function trySpawnShadowMan() {
    if (shadowMan || !player) return false;

    const spawnDistance = DEBUG_FREEZE_SHADOW_MAN ? 50 : randRange(SHADOW_MAN_MIN_SPAWN_DISTANCE, SHADOW_MAN_MAX_SPAWN_DISTANCE);
    const disappearDistance = randRange(SHADOW_MAN_MIN_DESPAWN_DISTANCE, SHADOW_MAN_MAX_DESPAWN_DISTANCE);
    const baseAngle = cameraYaw;
    const maxCoord = WORLD_SIZE - 40;

    // Phase 3: compute spawn angle biased toward world origin.
    // relOrigin = direction-to-origin relative to camera yaw, in [-π, π].
    // Case A (origin in view):  use ±20° around origin dir, clamped to ±50°.
    // Case B (origin off-screen): use the outer [10°, 50°] arc on whichever
    //   side is closer to origin — always guarantees a valid spawn angle.
    let phase3SpawnLo = 0, phase3SpawnHi = 0;
    if (shadowManPhase3Ready) {
        const camRange  = SHADOW_MAN_CAMERA_ANGLE_RANGE; // 50°
        const halfBias  = Math.PI / 9;   // 20°
        const edgeGap   = Math.PI / 18;  // 10°
        const toOriginAngle = Math.atan2(-player.position.x, -player.position.z);
        let relOrigin = toOriginAngle - baseAngle;
        while (relOrigin > Math.PI)  relOrigin -= 2 * Math.PI;
        while (relOrigin < -Math.PI) relOrigin += 2 * Math.PI;

        if (Math.abs(relOrigin) <= camRange) {
            // Origin is visible in camera range: ±20° centred on it, clamped to ±50°
            phase3SpawnLo = Math.max(-camRange, relOrigin - halfBias);
            phase3SpawnHi = Math.min( camRange, relOrigin + halfBias);
        } else if (relOrigin < 0) {
            // Origin is off-screen to the left: outer arc [-50°, -10°]
            phase3SpawnLo = -camRange;
            phase3SpawnHi = -edgeGap;
        } else {
            // Origin is off-screen to the right: outer arc [+10°, +50°]
            phase3SpawnLo =  edgeGap;
            phase3SpawnHi =  camRange;
        }
    }

    for (let attempt = 0; attempt < 18; attempt++) {
        const angle = shadowManPhase3Ready
            ? baseAngle + phase3SpawnLo + Math.random() * (phase3SpawnHi - phase3SpawnLo)
            : baseAngle + randRange(-SHADOW_MAN_CAMERA_ANGLE_RANGE, SHADOW_MAN_CAMERA_ANGLE_RANGE);
        const x = player.position.x + Math.sin(angle) * spawnDistance;
        const z = player.position.z + Math.cos(angle) * spawnDistance;

        if (Math.abs(x) > maxCoord || Math.abs(z) > maxCoord) continue;
        if (isPointInWater(x, z)) continue;

        const groundY = getGroundHeight(x, z);
        const structureY = getStructureHeight(x, z);
        if (structureY > groundY + 1) continue;

        const mesh = createShadowManMesh();
        mesh.position.set(x, groundY, z);
        mesh.rotation.y = Math.atan2(player.position.x - x, player.position.z - z);
        scene.add(mesh);

        const initialPlayerDistance = Math.hypot(
            player.position.x - x,
            player.position.z - z
        );

        if (DEBUG_SHADOW_MAN) spawnShadowManDebugBeacon(x, groundY, z);

        shadowManTotalSpawns++;
        if (!shadowManPhase3Ready && shadowManTotalSpawns >= SHADOW_MAN_PHASE3_SPAWN_THRESHOLD) {
            shadowManPhase3Ready = true;
        }

        // Phase 3 final spawn: player near world origin, shadow man won't despawn
        const playerDistFromOrigin = Math.hypot(player.position.x, player.position.z);
        const isFinalPhase = shadowManPhase3Ready &&
            playerDistFromOrigin <= SHADOW_MAN_PHASE3_PLAYER_SPAWN_RADIUS;

        shadowMan = {
            mesh,
            spawnDistance,
            disappearDistance,
            maxPlayerDistance: initialPlayerDistance + SHADOW_MAN_DESPAWN_DISTANCE_BUFFER,
            finalPhase: isFinalPhase
        };
        return true;
    }

    return false;
}

function updateShadowMan(currentTimeMs) {
    if (demonApocalypse) return;
    if (shadowManCutscene) return;

    const elapsedMs = currentTimeMs - gameStartRealTimeMs;
    const unlockMs = SHADOW_MAN_SPAWN_UNLOCK_MINUTE * SHADOW_MAN_SPAWN_CHECK_INTERVAL_MS;

    // The dragon gem overrides the initial peace period and starts checks immediately.
    if (shadowManNextCheckMs < 0 && (dragonGemCollected || elapsedMs >= unlockMs)) {
        shadowManNextCheckMs = dragonGemCollected ? elapsedMs : unlockMs;
    }

    // Periodic spawn check
    if (shadowManNextCheckMs >= 0 && elapsedMs >= shadowManNextCheckMs &&
        !shadowMan && !shadowManPostApocalypseUnlocked) {

        const isNightPhase = (gameTime / FULL_CYCLE) >= NIGHT_START;
        const phase1Chance = isNightPhase ? 0.30 : SHADOW_MAN_BASE_SPAWN_CHANCE;
        const spawnChance = dragonGemCollected
            ? (shadowManPhase3Ready
                ? SHADOW_MAN_PHASE3_SPAWN_CHANCE
                : SHADOW_MAN_PHASE2_SPAWN_CHANCE)
            : phase1Chance;

        if (Math.random() < spawnChance) {
            trySpawnShadowMan();
        }

        // Advance to next check window
        const interval = shadowManPhase3Ready
            ? SHADOW_MAN_PHASE3_CHECK_INTERVAL_MS
            : SHADOW_MAN_SPAWN_CHECK_INTERVAL_MS;
        shadowManNextCheckMs += interval;
        // Skip missed intervals (lag/tab switch)
        while (shadowManNextCheckMs <= elapsedMs) {
            shadowManNextCheckMs += interval;
        }
    }

    if (!shadowMan || playerDead) return;
    updateShadowManColor();

    const dx = player.position.x - shadowMan.mesh.position.x;
    const dz = player.position.z - shadowMan.mesh.position.z;
    const distXZ = Math.hypot(dx, dz);

    // Face the player
    if (distXZ > 0.01) {
        shadowMan.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Phase 3 final shadow man: no despawn, watches for cutscene trigger
    if (shadowMan.finalPhase) {
        if (distXZ <= SHADOW_MAN_CUTSCENE_TRIGGER_DIST) {
            startShadowManCutscene();
        }
        return;
    }

    // Normal despawn behavior
    if (distXZ <= shadowMan.disappearDistance) {
        removeShadowMan();
        return;
    }

    if (distXZ >= shadowMan.maxPlayerDistance) {
        removeShadowMan();
        return;
    }
}

function startShadowManCutscene() {
    if (shadowManCutscene || !shadowMan) return;

    // If riding dragon, dismount and poof it
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

    // Freeze player
    velocity.set(0, 0, 0);

    // Store SM part base X positions for oscillation reset
    const parts = shadowMan.mesh.userData.partMeshes;
    const partBaseX = parts.map(m => m.position.x);

    // Hide all HUD elements
    ['ui', 'stats', 'crosshair', 'demon-counter', 'health-bar-container',
     'golden-key-hud', 'punch-ring', 'equip-hint'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Create blood-red vignette overlay (initially invisible)
    const vignetteEl = document.createElement('div');
    vignetteEl.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
        'pointer-events:none', 'z-index:750', 'opacity:0',
        'background:radial-gradient(ellipse at center, transparent 0%, transparent 70%, rgba(140,0,0,0.95) 90%)'
    ].join(';');
    document.body.appendChild(vignetteEl);

    // Detect if player is airborne
    const csGroundY = getGroundHeight(player.position.x, player.position.z);
    const csStructY = getStructureHeight(player.position.x, player.position.z);
    const csSurfY   = Math.max(csGroundY, csStructY);
    const csAirborne = player.position.y > csSurfY + 0.5;

    // If airborne and not falling-to-cutscene mode, teleport to surface immediately
    if (csAirborne && !FALL_TO_CUTSCENE) {
        player.position.y = csSurfY;
        velocity.set(0, 0, 0);
    }

    const csStartFalling = csAirborne && FALL_TO_CUTSCENE;

    shadowManCutscene = {
        phase: csStartFalling ? 'falling' : 'freeze',
        // falling | freeze | approach | face_freeze | head_oscillate | body_oscillate | flash
        timer: 0,
        frozenPlayerPos: csStartFalling ? null : player.position.clone(),
        approachStart: null,
        approachTarget: null,
        vignetteEl,
        eyes: null,
        parts,
        partBaseX,
        flashShown: false,
        cameraStartPos: camera.position.clone(),
        cameraStartQuat: camera.quaternion.clone(),
        cameraTransitionTimer: 0,
    };
}

function updateShadowManCutscene(delta) {
    if (!shadowManCutscene) return;
    const cs = shadowManCutscene;
    cs.timer += delta;

    // ── PHASE: falling (airborne — wait to land before freezing) ────
    if (cs.phase === 'falling') {
        // Kill horizontal movement; let gravity bring the player down
        velocity.x = 0;
        velocity.z = 0;
        velocity.y -= 35 * delta;
        player.position.y += velocity.y * delta;

        // Check if player has landed on solid surface
        const fallGroundY = getGroundHeight(player.position.x, player.position.z);
        const fallStructY = getStructureHeight(player.position.x, player.position.z);
        const fallSurfY   = Math.max(fallGroundY, fallStructY);
        if (player.position.y <= fallSurfY) {
            player.position.y = fallSurfY;
            velocity.set(0, 0, 0);
            cs.phase = 'freeze';
            cs.timer = 0;
            cs.frozenPlayerPos = player.position.clone();
        }
        return; // camera override in animate() handles view throughout
    }

    // All other phases: keep player fully frozen in place
    player.position.copy(cs.frozenPlayerPos);
    velocity.set(0, 0, 0);

    // ── PHASE: freeze ──────────────────────────────────────────
    if (cs.phase === 'freeze') {
        if (cs.timer >= 2) {
            cs.phase = 'approach';
            cs.timer = 0;

            if (shadowMan) {
                const smPos = shadowMan.mesh.position;
                const adx = cs.frozenPlayerPos.x - smPos.x;
                const adz = cs.frozenPlayerPos.z - smPos.z;
                const adist = Math.hypot(adx, adz);
                const nx = adx / adist, nz = adz / adist;
                cs.approachStart = smPos.clone();
                cs.approachTarget = new THREE.Vector3(
                    cs.frozenPlayerPos.x - nx * SHADOW_MAN_CUTSCENE_STOP_DIST,
                    cs.frozenPlayerPos.y,
                    cs.frozenPlayerPos.z - nz * SHADOW_MAN_CUTSCENE_STOP_DIST
                );
            }
        }
    }

    // ── PHASE: approach ────────────────────────────────────────
    else if (cs.phase === 'approach') {
        if (shadowMan && cs.approachStart && cs.approachTarget) {
            const durationSec = Math.max(0.001, SHADOW_MAN_CUTSCENE_APPROACH_DURATION_SEC);
            const t = Math.min(cs.timer / durationSec, 1);
            shadowMan.mesh.position.lerpVectors(cs.approachStart, cs.approachTarget, t);
            shadowMan.mesh.position.y = cs.approachTarget.y; // match player foot height
            const adx = cs.frozenPlayerPos.x - shadowMan.mesh.position.x;
            const adz = cs.frozenPlayerPos.z - shadowMan.mesh.position.z;
            shadowMan.mesh.rotation.y = Math.atan2(adx, adz);
        }

        if (cs.timer >= SHADOW_MAN_CUTSCENE_APPROACH_DURATION_SEC) {
            // Snap to final and transition
            if (shadowMan && cs.approachTarget) {
                shadowMan.mesh.position.copy(cs.approachTarget);
                const adx = cs.frozenPlayerPos.x - shadowMan.mesh.position.x;
                const adz = cs.frozenPlayerPos.z - shadowMan.mesh.position.z;
                shadowMan.mesh.rotation.y = Math.atan2(adx, adz);
            }
            cs.phase = 'face_freeze';
            cs.timer = 0;
        }
    }

    // ── PHASE: face_freeze (shadow man holds perfectly still, up close) ──
    else if (cs.phase === 'face_freeze') {
        cs.phase = 'head_oscillate'; // THIS DISABLES face_freeze PHASE
        // if (cs.timer >= 3.0) {
        //     cs.phase = 'head_oscillate';
        //     cs.timer = 0;
        // }
    }

    // ── PHASE: head_oscillate ──────────────────────────────────
    else if (cs.phase === 'head_oscillate') {
        if (shadowMan) {
            const headMesh = shadowMan.mesh.userData.headMesh;
            if (headMesh) {
                headMesh.position.x = cs.partBaseX[1] + Math.sin(performance.now() * 0.09) * 0.1;
            }
            const adx = cs.frozenPlayerPos.x - shadowMan.mesh.position.x;
            const adz = cs.frozenPlayerPos.z - shadowMan.mesh.position.z;
            shadowMan.mesh.rotation.y = Math.atan2(adx, adz);
        }

        if (cs.timer >= 3.0) {
            // Add red demon eyes to shadow man
            if (shadowMan && !cs.eyes) {
                const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
                cs.eyes = [];
                [-0.2, 0.2].forEach(ex => {
                    const eye = new THREE.Mesh(eyeGeo, eyeMat);
                    eye.position.set(ex, 8.2, 0.44);
                    eye.userData.baseX = ex;
                    shadowMan.mesh.add(eye);
                    cs.eyes.push(eye);
                });
            }
            // Reveal vignette
            if (cs.vignetteEl) cs.vignetteEl.style.opacity = '1';
            cs.phase = 'body_oscillate';
            cs.timer = 0;
        }
    }

    // ── PHASE: body_oscillate ──────────────────────────────────
    else if (cs.phase === 'body_oscillate') {
        const osc = Math.sin(performance.now() * 0.09) * 0.25;

        if (shadowMan) {
            // All body parts oscillate
            cs.parts.forEach((part, i) => {
                part.position.x = cs.partBaseX[i] + osc;
            });
            // Eyes sync with oscillation
            if (cs.eyes) {
                cs.eyes.forEach(eye => {
                    eye.position.x = eye.userData.baseX + osc;
                });
            }
            const adx = cs.frozenPlayerPos.x - shadowMan.mesh.position.x;
            const adz = cs.frozenPlayerPos.z - shadowMan.mesh.position.z;
            shadowMan.mesh.rotation.y = Math.atan2(adx, adz);
        }

        // Vignette: radial red creeps inward over 4 seconds
        if (cs.vignetteEl) {
            const prog = Math.min(cs.timer / 4.0, 1.0);
            const inner = (70 * (1 - prog)).toFixed(1);
            const outer = Math.min(100, parseFloat(inner) + 20).toFixed(1);
            cs.vignetteEl.style.background =
                `radial-gradient(ellipse at center, transparent 0%, transparent ${inner}%, rgba(140,0,0,0.95) ${outer}%)`;
        }

        if (cs.timer >= 4.0) {
            cs.phase = 'flash';
            cs.timer = 0;
        }
    }

    // ── PHASE: flash ───────────────────────────────────────────
    else if (cs.phase === 'flash') {
        if (!cs.flashShown) {
            // cs.flashShown = true;  // commenting this will use the time set below rather than 1 true frame
            showShadowManFaceFlash();
        }
        if (cs.timer >= 0.15) {
            endShadowManCutscene();
            triggerDemonApocalypse();
        }
    }
}

function showShadowManFaceFlash() {
    const w = window.innerWidth, h = window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Gradient background: black (bottom) to #360000 (top)
    const bgGrd = ctx.createLinearGradient(0, h, 0, 0);
    bgGrd.addColorStop(0, '#000000');
    bgGrd.addColorStop(1, '#360000');
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, w, h);

    // Elongated oval face covering full vertical height
    const faceH = h;
    const faceW = faceH * (0.85 / 1.4); // shadow man head x/y scale ratio
    const cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing red eyes
    const eyeY = cy - faceH * 0.07;
    const eyeR = faceW * 0.13;
    const eyeSpacing = faceW * 0.2;
    [-1, 1].forEach(side => {
        const ex = cx + side * eyeSpacing;
        const grd = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eyeR * 1.8);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.15, '#ff4444');
        grd.addColorStop(0.45, '#cc0000');
        grd.addColorStop(1, 'rgba(180,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR * 1.8, 0, Math.PI * 2);
        ctx.fill();
    });

    const flashDiv = document.createElement('div');
    flashDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9000;pointer-events:none;';
    flashDiv.appendChild(canvas);
    document.body.appendChild(flashDiv);
    // Auto-remove (also cleaned up if page unloads)
    setTimeout(() => { if (flashDiv.parentNode) flashDiv.remove(); }, 130);
}

function endShadowManCutscene() {
    if (!shadowManCutscene) return;
    const cs = shadowManCutscene;

    // Remove vignette
    if (cs.vignetteEl && cs.vignetteEl.parentNode) cs.vignetteEl.remove();

    // Orient camera to face toward where the SM was standing
    if (shadowMan && cs.frozenPlayerPos) {
        const smPos = shadowMan.mesh.position;
        cameraYaw = Math.atan2(smPos.x - cs.frozenPlayerPos.x, smPos.z - cs.frozenPlayerPos.z);
        cameraPitch = 0;
    }

    // Reset SM part positions then remove shadow man
    if (shadowMan) {
        cs.parts.forEach((part, i) => { part.position.x = cs.partBaseX[i]; });
        scene.remove(shadowMan.mesh);
        shadowMan = null;
    }

    // Restore HUD elements hidden at cutscene start.
    // ui/stats stay hidden — triggerDemonApocalypse() calls updateTopCornerHudVisibility().
    document.getElementById('crosshair').style.display = '';
    document.getElementById('demon-counter').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    // Return control of these to normal game logic:
    document.getElementById('punch-ring').style.display = '';
    document.getElementById('equip-hint').style.display = '';
    updateKeyHUD(); // restores golden-key-hud based on hasGoldenKey

    // Suppress future shadow man spawns
    shadowManPostApocalypseUnlocked = true;

    shadowManCutscene = null;
    velocity.set(0, 0, 0);
}
