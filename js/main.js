const WALK_SPEED = 20;
const RUN_SPEED = WALK_SPEED*2;
const ACCEL = 14;  // MODIFIED: accel controls how quickly you reach full speed while holding movement
const DECEL = 20;  // MODIFIED: decel controls how quickly you come to a stop after releasing movement
const PLAYER_RADIUS = 0.5;
const DRAGON_COLLISION_RADIUS = 4.5;

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
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lights
    ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
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

    if (DEBUG_SHOVEL) {
        hasShovel = true;
        currentHandItem = 'shovel';
    }

    if (DEBUG_GOLDEN_KEY_OBTAINED) {
        hasGoldenKey = true;
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
        scene.add(boxMesh);
        debugKeyBox = { mesh: boxMesh, hitCount: 0 };
    }

    createPlayer();
    createTrees();
    createRocks();
    createFlowers();
    createGrass();
    createMountains();
    createDragonVolcano();
    createClimbableStructures();
    createEnterableStructures();
    createCollisionDebugVisuals();
    createDistanceDebugStake();
    createNPCs();
    // createSecretGem() is now called in demonVictory() as a post-apocalypse reward
    if (DEBUG_GEMS) createSecretGem();
    createDragonGem();
    createDragon();
    updateAK47VisualState();
    updateKeyHUD();
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

    // WHOLE FUNCTION MODIFIED BY CHATGPT:
    if (!mountedOnDragon) {
        const moveSpeed = (isRunning ? RUN_SPEED : WALK_SPEED) * speedMultiplier;

        // Get forward direction based on camera yaw
        const forward = new THREE.Vector3(
            Math.sin(cameraYaw),
            0,
            Math.cos(cameraYaw)
        );
        const right = new THREE.Vector3(
            Math.sin(cameraYaw - Math.PI / 2),
            0,
            Math.cos(cameraYaw - Math.PI / 2)
        );

        // Movement input
        direction.set(0, 0, 0);
        if (moveForward) direction.add(forward);
        if (moveBackward) direction.sub(forward);
        if (moveRight) direction.add(right);
        if (moveLeft) direction.sub(right);

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
            velocity.y -= 35 * delta;
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
        const supportBaseHeight = getLandSurfaceHeight(player.position.x, player.position.z);
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
                if (velocity.y > 0 && previousY <= ceil.y && player.position.y >= ceil.y) {
                    player.position.y = ceil.y - 0.01;
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
        const cameraOffset = new THREE.Vector3(
            -Math.sin(cameraYaw) * cameraDistance * pitchCos,
            cameraHeight + pitchHeight,
            -Math.cos(cameraYaw) * cameraDistance * pitchCos
        );

        const lookTarget = player.position.clone();
        lookTarget.y += 4.25;

        const desiredCameraPosition = player.position.clone().add(cameraOffset);
        desiredCameraPosition.y += 2;
        scene.updateMatrixWorld();
        camera.position.copy(resolveThirdPersonCameraPosition(lookTarget, desiredCameraPosition));
        camera.lookAt(lookTarget);
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
    const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

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
        smLookPos.y += 8.4;
        const refPos = shadowManCutscene.frozenPlayerPos || player.position;
        const dirToSM = smLookPos.clone().sub(refPos).normalize();
        const camPos = refPos.clone().addScaledVector(dirToSM, -8);
        camPos.y = refPos.y + 6;
        scene.updateMatrixWorld();
        camera.position.copy(camPos);
        camera.lookAt(smLookPos);
    }
    if (ak47TriggerHeld && isLocked && ak47Collected && ak47Equipped && !playerDead && !mountedOnDragon) {
        fireAK47();
    }
    updateAK47Effects(delta);
    updateDragonBondFlashes(delta);
    updateDigParticles(delta);
    updateGoldenKey(delta);
    updateDoors(delta);
    updateNotes(delta);
    underwaterTintEl.style.opacity = isPointInsideWaterCylinder(
        camera.position.x,
        camera.position.y,
        camera.position.z
    ) ? '1' : '0';

    updateSunShadowFocus();
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
    document.getElementById('start-screen').style.display = 'none';
    init();
    animate();
    renderer.domElement.requestPointerLock();
});

