const ACCEL = 14;  // MODIFIED: accel controls how quickly you reach full speed while holding movement
const DECEL = 20;  // MODIFIED: decel controls how quickly you come to a stop after releasing movement
const PLAYER_RADIUS = 0.5;
const DRAGON_COLLISION_RADIUS = 4.5;

// Pre-allocated vectors — reused every frame to avoid per-frame GC allocations.
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _cameraOffset = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _desiredCameraPos = new THREE.Vector3();
const _csCamMat  = new THREE.Matrix4();    // scratch for SM cutscene camera transition
const _csCamQuat = new THREE.Quaternion(); // scratch for SM cutscene camera transition

function createDigZoneGroundPatch(lake) {
    if (!lake) return;
    lake.digHitRoot = makeWorldHitProfileRoot(
        new THREE.Vector3(lake.x, lake.floorY, lake.z),
        {
            shape: 'cylinder',
            start: { x: 0, y: -0.35, z: 0 },
            end: { x: 0, y: 0.35, z: 0 },
            radius: DIG_ZONE_SIZE / 2
        },
        { debugKey: 'lakeKeyDigHitboxDebug' }
    );

    function makeBlobTexture(halfSize, baseRadius, noise, feather) {
        const texSize = 256;
        const canvas = document.createElement('canvas');
        canvas.width = texSize;
        canvas.height = texSize;
        const ctx = canvas.getContext('2d');
        const image = ctx.createImageData(texSize, texSize);
        const data = image.data;

        for (let y = 0; y < texSize; y++) {
            for (let x = 0; x < texSize; x++) {
                const u = (x + 0.5) / texSize * 2 - 1;
                const v = (y + 0.5) / texSize * 2 - 1;
                const angle = Math.atan2(v, u);
                const worldX = u * halfSize;
                const worldZ = v * halfSize;
                const radial = Math.hypot(worldX, worldZ);
                const variation = THREE.MathUtils.clamp(
                    Math.sin(angle * 2.0 + 0.7) * 0.12 +
                    Math.cos(angle * 3.0 - 1.1) * 0.09 +
                    Math.sin(angle * 5.0 + 0.3) * 0.18 +
                    Math.cos(angle * 9.0 - 0.9) * 0.16 +
                    Math.sin(angle * 15.0 + 1.8) * 0.12 +
                    Math.cos(angle * 24.0 - 0.2) * 0.08 +
                    Math.sin(worldX * 0.18 + worldZ * 0.11) * 0.08 +
                    Math.cos(worldX * 0.13 - worldZ * 0.17) * 0.07 +
                    Math.sin(worldX * 0.31 + worldZ * 0.27) * 0.04,
                    -1,
                    1
                );
                const noisyRadius = Math.max(0.1, baseRadius + noise * variation);
                const alphaT = THREE.MathUtils.clamp((noisyRadius - radial) / feather, 0, 1);
                const alpha = alphaT * alphaT * (3 - 2 * alphaT);
                const i = (y * texSize + x) * 4;

                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
                data[i + 3] = Math.round(alpha * 255);
            }
        }

        ctx.putImageData(image, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    function addBlobPatch({
        color,
        opacity,
        yOffset,
        renderOrder,
        baseRadius,
        noise,
        feather
    }) {
        const halfSize = baseRadius + noise + feather * 2 + 1;
        const size = halfSize * 2;
        const patch = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            new THREE.MeshLambertMaterial({
                color,
                map: makeBlobTexture(halfSize, baseRadius, noise, feather),
                transparent: true,
                opacity,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(lake.x, lake.floorY + yOffset, lake.z);
        patch.renderOrder = renderOrder;
        patch.userData.ignoreCameraOcclusion = true;
        scene.add(patch);
    }

    // Set configs for both blob patches
    const bigPatchRadius = 3.5 * DIG_ZONE_SIZE;
    const smallPatchRadius = 1.5 * DIG_ZONE_SIZE;

    // Big outer patch
    addBlobPatch({
        color: 0x356035,
        opacity: 0.8,
        yOffset: 0.01,
        renderOrder: 3,
        baseRadius: bigPatchRadius,
        noise: bigPatchRadius * 0.18,
        feather: bigPatchRadius * 0.5
    });
    // Small inner patch
    addBlobPatch({
        color: 0x2e532e,
        opacity: 0.5,
        yOffset: 0.02,
        renderOrder: 4,
        baseRadius: smallPatchRadius,
        noise: smallPatchRadius * 0.18,
        feather: smallPatchRadius * 0.7
    });

}

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = skyColors.day.clone();
    scene.fog = new THREE.Fog(0x87CEEB, 100, 800);
    gameStartRealTimeMs = performance.now();
    shadowManLastMinuteChecked = -1;
    shadowManPostApocalypseUnlocked = false;
    shadowMan = null;

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lights
    ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 2000;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    scene.add(sun);
    scene.add(sun.target);

    // Create world
    planWaterBodies();
    createGround();
    createWater();
    bigLake = waterBodies.filter(w => w.kind === 'lake').sort((a, b) => b.cylinderRadius - a.cylinderRadius)[0] || null;
    createDigZoneGroundPatch(bigLake);

    if (DEBUG_AK47) {
        ak47Collected = true;
        addHandSlot('ak47');
    }

    if (DEBUG_SHOVEL) {
        hasShovel = true;
        addHandSlot('shovel');
    }

    if (DEBUG_TORCH) {
        hasTorch = true;
        addHandSlot('torch');
    }

    if (DEBUG_GOLDEN_KEY_OBTAINED) {
        hasGoldenKey = true;
        addInventoryItem('golden-key', 'Golden Key', null, { type: 'object', itemKey: 'golden-key' });
    }

    if (DEBUG_DIG_ZONE && bigLake) {
        const zoneMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
        const zoneMesh = new THREE.Mesh(new THREE.PlaneGeometry(DIG_ZONE_SIZE, DIG_ZONE_SIZE), zoneMat);
        zoneMesh.rotation.x = -Math.PI / 2;
        zoneMesh.position.set(bigLake.x, bigLake.floorY + 0.05, bigLake.z);
        zoneMesh.renderOrder = 5;
        scene.add(zoneMesh);
    }

    if (DEBUG_GOLDEN_KEY) {
        const boxY = getGroundHeight(0, 30);
        const boxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshLambertMaterial({ color: 0x8B5E3C })
        );
        boxMesh.position.set(0, boxY + 1, 30);
        setObjectHitProfile(boxMesh, { shape: 'sphere', center: { x: 0, y: 0, z: 0 }, radius: 2 }, { debugKey: 'debugKeyHitboxDebug' });
        scene.add(boxMesh);
        debugKeyBox = { mesh: boxMesh, hitCount: 0 };
    }

    createPlayer();
    // Reserve critical landmarks before generic clutter so unique progression
    // content cannot lose its placement budget to ambient world generation.
    createDragonVolcano();
    createHauntedHouse();
    createCemetery();
    // Reserve altar footprint and flatten terrain before vegetation so trees/rocks
    // sample the correct ground height. Meshes are built at talisman pickup.
    prepareAltarPlacement();
    createEnterableStructures();
    createClimbableStructures();
    createMountains();
    createWoodenMarkerSticks();
    createTrees();
    createRocks();
    createFlowers();
    createGrass();
    createCollisionDebugVisuals();
    createDistanceDebugStick();
    createNPCs();
    // createSecretGem() is now called in demonVictory() as a post-apocalypse reward
    if (DEBUG_GEMS) createSecretGem();
    createDragonGem();
    createDragon();

    if (DEBUG_ALTAR && altarData && dragon) {
        applyAscendedDragonMaterials(dragon);
        dragonAscended = true;
        dragonGemCollected = true;
        dragonBondFormed = true;
        dragonDescending = true;
        dragon.visible = true;
        dragon.position.set(altarData.worldX, altarData.worldGroundY + 20, altarData.worldZ + 40);
    }

    if (DEBUG_SWORD_THUNDER || DEBUG_SWORD_THUNDER_INF) {
        // Sword + aurafied blade in inventory
        hasSwordShield = true;
        addHandSlot('sword-shield');
        _upgradeSwordBlade(); // sets swordAuraActive = true, applies BasicMat + particles
        // Demon shrine at origin
        createShrine();
    }

    syncHandItemVisuals();
    updateStats();
    updateMenuPanels();

    // Event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('click', (e) => {
        if (isLocked) return;
        if (playerDead) return;
        if (timeMenuOpen) return;
        if (inventoryOpen) return;
        renderer.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        isLocked = document.pointerLockElement === renderer.domElement;
        if (!isLocked) ak47TriggerHeld = false;
    });

    window.addEventListener('resize', onWindowResize);

    // Start at noon
    gameTime = FULL_CYCLE * 0.25;
}

function update(delta) {
    if (playerDead) return;

    // During shadow man cutscene: freeze player, skip all input/physics
    // Camera is handled by the animate() loop for robustness
    if (shadowManCutscene && !mountedOnDragon) {
        updateDayNightCycle(delta * 1000);
        updateNPCs(delta);
        updateGem(delta, performance.now() / 1000);
        updateDragonGem(delta, performance.now() / 1000);
        updateDragon(delta);
        return;
    }

    if (!mountedOnDragon) {
        const moveSpeed = (isRunning ? RUN_SPEED : WALK_SPEED) * speedMultiplier;

        // Get forward direction based on camera yaw
        _forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
        _right.set(Math.sin(cameraYaw - Math.PI / 2), 0, Math.cos(cameraYaw - Math.PI / 2));

        // Movement input
        direction.set(0, 0, 0);
        if (moveForward) direction.add(_forward);
        if (moveBackward) direction.sub(_forward);
        if (moveRight) direction.add(_right);
        if (moveLeft) direction.sub(_right);

        // MODIFIED: cache whether there is movement input, since we use it multiple times
        const hasInput = direction.lengthSq() > 0;

        // MODIFIED: compute desired horizontal velocity directly in world units/sec
        let targetVX = 0;
        // MODIFIED: compute desired horizontal velocity directly in world units/sec
        let targetVZ = 0;

        // MODIFIED: if input exists, normalize direction and set target velocity from true moveSpeed
        if (hasInput) {
            // MODIFIED: keep diagonal movement from being faster than straight movement
            direction.normalize();

            // MODIFIED: desired X velocity is direction times actual speed
            targetVX = direction.x * moveSpeed;

            // MODIFIED: desired Z velocity is direction times actual speed
            targetVZ = direction.z * moveSpeed;
        }

        // MODIFIED: choose whether we are accelerating toward target speed or decelerating toward zero
        const response = hasInput ? ACCEL : DECEL;

        // MODIFIED: frame-rate-independent smoothing factor; avoids physics changing with FPS
        const lerpFactor = 1 - Math.exp(-response * delta);

        // MODIFIED: smoothly move current X velocity toward target X velocity
        velocity.x += (targetVX - velocity.x) * lerpFactor;

        // MODIFIED: smoothly move current Z velocity toward target Z velocity
        velocity.z += (targetVZ - velocity.z) * lerpFactor;

        movePlayerHorizontallyWithCollisions(delta, PLAYER_RADIUS);
        const previousY = player.position.y;
        const startingWaterState = getWaterTraversalState(
            player.position.x,
            player.position.z,
            player.position.y,
            PLAYER_WATER_HEIGHT
        );

        if (startingWaterState.isSwimming) {
            if (velocity.y < 0) {
                velocity.y = Math.max(
                    velocity.y * PLAYER_WATER_ENTRY_DAMPING,
                    -PLAYER_WATER_SINK_SPEED
                );
            }

            const targetWaterVelocity = spaceHeld
                ? PLAYER_WATER_RISE_SPEED
                : -PLAYER_WATER_SINK_SPEED;
            const waterResponse = spaceHeld
                ? PLAYER_WATER_RISE_RESPONSE
                : PLAYER_WATER_SINK_RESPONSE;
            const waterLerpFactor = 1 - Math.exp(-waterResponse * delta);
            velocity.y += (targetWaterVelocity - velocity.y) * waterLerpFactor;
        } else {
            velocity.y -= GRAVITY * delta;
        }

        player.position.y += velocity.y * delta;

        respawnPlayerFromDragonVolcanoLava();

        const waterState = getWaterTraversalState(
            player.position.x,
            player.position.z,
            player.position.y,
            PLAYER_WATER_HEIGHT
        );

        if (waterState.isSwimming) {
            if (!startingWaterState.isSwimming && velocity.y < 0) {
                velocity.y = Math.max(
                    velocity.y * PLAYER_WATER_ENTRY_DAMPING,
                    -PLAYER_WATER_SINK_SPEED
                );
            }

            if (player.position.y <= waterState.floorY) {
                player.position.y = waterState.floorY;
                if (velocity.y < 0) velocity.y = 0;
            } else if (player.position.y > waterState.maxFloatY) {
                player.position.y = waterState.maxFloatY;
                if (velocity.y > 0) velocity.y = 0;
            }
        } else {
            const groundHeight = waterState.landY;
            if (player.position.y <= groundHeight) {
                player.position.y = groundHeight;
                if (velocity.y < 0) velocity.y = 0;
            }
        }

        const groundedOnRoof = resolveRoofCollision(previousY);
        const supportBaseHeight = getLandSurfaceHeight(player.position.x, player.position.z, player.position.y);
        const supportHeight = groundedOnRoof
            ? Math.max(supportBaseHeight, player.position.y)
            : supportBaseHeight;
        isGrounded = (player.position.y <= supportHeight + 0.2 && velocity.y <= 0);

        const finalOverlap = resolvePlayerWallOverlaps(PLAYER_RADIUS);
        if (finalOverlap.blockedX) velocity.x = 0;
        if (finalOverlap.blockedZ) velocity.z = 0;

        // Ceiling collision only blocks upward movement from below (inside structures).
        for (const ceil of ceilings) {
            if (isPointInRotatedRect(player.position.x, player.position.z, ceil)) {
                const previousTopY = previousY + PLAYER_COLLISION_HEIGHT;
                const currentTopY = player.position.y + PLAYER_COLLISION_HEIGHT;
                if (velocity.y > 0 && previousTopY < ceil.y - 0.05 && currentTopY >= ceil.y) {
                    player.position.y = ceil.y - PLAYER_COLLISION_HEIGHT - 0.01;
                    velocity.y = 0;
                }
            }
        }

        // Rotate player to face movement direction
        // MODIFIED: use hasInput instead of recomputing direction.length(), and threshold is no longer needed
        if (hasInput) {
            const targetRotation = Math.atan2(direction.x, direction.z);
            player.rotation.y = targetRotation;
        }
    }

    // Update camera position (third person) - only if not on dragon (dragon handles its own camera)
    if (!mountedOnDragon) {
        const pitchCos = Math.cos(cameraPitch);
        const pitchSin = Math.sin(cameraPitch);
        const pitchHeight = cameraPitch > 0
            ? pitchSin * cameraDistance * 0.65
            : pitchSin * cameraDistance * 1.8;
        _cameraOffset.set(
            -Math.sin(cameraYaw) * cameraDistance * pitchCos,
            cameraHeight + pitchHeight,
            -Math.cos(cameraYaw) * cameraDistance * pitchCos
        );

        _lookTarget.copy(player.position);
        _lookTarget.y += 4.25;

        _desiredCameraPos.copy(player.position).add(_cameraOffset);
        _desiredCameraPos.y += 2;
        scene.updateMatrixWorld();
        camera.position.copy(resolveThirdPersonCameraPosition(_lookTarget, _desiredCameraPos));
        camera.lookAt(_lookTarget);
    }

    // Update day/night cycle
    updateDayNightCycle(delta * 1000);

    // Update NPCs and gem
    updateNPCs(delta);
    updateGem(delta, performance.now() / 1000);
    updateDragonGem(delta, performance.now() / 1000);
    updateDragon(delta);
}




function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const rawDelta = currentTime - lastTime;
    lastTime = currentTime;

    if (rawDelta > 250) {
        // Tab was backgrounded; the huge accumulated delta would teleport physics
        // entities through walls. Skip the update and just re-render.
        renderer.render(scene, camera);
        return;
    }

    const delta = Math.min(rawDelta / 1000, 0.1);

    if (!playerDead && (isLocked || mountedOnDragon)) {
        update(delta);
    } else {
        updateNPCs(delta);
        updateDragon(delta);
        updateDayNightCycle(delta * 1000);
    }
    if (demonApocalypse && !playerDead) updateDemons(delta);
    updateRoundSpawning(delta);
    updateBetweenRound(delta);
    updateShrine(delta, performance.now() / 1000);
    updateShadowMan(currentTime);
    updateShadowManCutscene(delta);
    // Cutscene camera must run even if pointer lock is lost.
    // During 'falling' phase frozenPlayerPos is null — use live player position instead.
    if (shadowManCutscene && !playerDead && !mountedOnDragon && shadowMan) {
        const smLookPos = shadowMan.mesh.position.clone();
        smLookPos.y += 7.3;
        const refPos = shadowManCutscene.frozenPlayerPos || player.position;
        const dirToSM = smLookPos.clone().sub(refPos).normalize();
        const camPos = refPos.clone().addScaledVector(dirToSM, -8);
        camPos.y = refPos.y + 6;

        shadowManCutscene.cameraTransitionTimer = Math.min(
            shadowManCutscene.cameraTransitionTimer + delta,
            SHADOW_MAN_CAMERA_TRANSITION_SEC
        );
        const ct = smoothstep01(shadowManCutscene.cameraTransitionTimer / SHADOW_MAN_CAMERA_TRANSITION_SEC);
        if (ct < 1) {
            camera.position.lerpVectors(shadowManCutscene.cameraStartPos, camPos, ct);
            _csCamMat.lookAt(camPos, smLookPos, camera.up);
            _csCamQuat.setFromRotationMatrix(_csCamMat);
            camera.quaternion.slerpQuaternions(shadowManCutscene.cameraStartQuat, _csCamQuat, ct);
        } else {
            camera.position.copy(camPos);
            camera.lookAt(smLookPos);
        }
    }
    if (ak47TriggerHeld && isLocked && ak47Collected && ak47Equipped && !playerDead && !mountedOnDragon) {
        fireAK47();
    }
    updateAK47Effects(delta);
    updateDragonBondFlashes(delta);
    updateDigParticles(delta);
    updateGoldenKey(delta);
    updateTorchLight(delta);
    updateCampfireLights(delta);
    updateDoors(delta);
    updateNotes(delta);
    underwaterTintEl.style.opacity = isPointInsideWaterCylinder(
        camera.position.x,
        camera.position.y,
        camera.position.z
    ) ? '1' : '0';

    updateAltar(delta, performance.now() / 1000);
    updateHolyGem(delta, performance.now() / 1000);
    updateHauntedHouseSequence(delta);
    updateHHHallDoor(delta);
    updateCemeteryGates(delta);
    updateCreatures(delta);
    updateSpecialPortalNoose(delta);
    updateSwordBladeParticles(delta);
    updateSwordAuraOrbPulse(delta);
    updatePlayerTalismanPulse(delta);
    updateLightningEffects(delta);
    updateTalisman(delta);
    updateSwordSwipe(delta);
    updateSunShadowFocus();
    if (DEBUG_HIT_FRUSTUM) updateHitFrustumDebug();
    renderer.render(scene, camera);
}

const deathScreen = document.getElementById('death-screen');

deathScreen.addEventListener('mousedown', e => {
    e.stopPropagation();
    e.preventDefault();
});

deathScreen.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
});

// Start game
document.getElementById('start-btn').addEventListener('click', () => {
    const btn = document.getElementById('start-btn');
    // Lock exact dimensions before replacing text so size never changes
    btn.style.width  = btn.offsetWidth  + 'px';
    btn.style.height = btn.offsetHeight + 'px';
    btn.style.padding = '0';
    btn.innerHTML = '<span class="btn-spinner"></span>';
    btn.classList.add('loading');
    // Two rAF calls guarantee the browser paints the spinner before the blocking init()
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            init();
            document.getElementById('start-screen').style.display = 'none';
            animate();
            renderer.domElement.requestPointerLock();
        });
    });
});
