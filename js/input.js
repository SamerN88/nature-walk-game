function onKeyDown(event) {
    if (event.code === 'KeyM') {
        if (playerDead) return;
        if (event.repeat) return;
        event.preventDefault();
        toggleTimeMenu();
        return;
    }

    if (event.code === 'KeyI') {
        if (playerDead) return;
        if (event.repeat) return;
        event.preventDefault();
        toggleInventory();
        return;
    }

    if (event.code === 'Escape') {
        if (viewingNoteItem) { closeNoteViewer(); }
        else if (inventoryOpen) { toggleInventory(); }
        return;
    }

    if (playerDead) return;
    if (!isLocked) return;

    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': isRunning = true; break;
        case 'Space':
            spaceHeld = true;
            if (!mountedOnDragon) {
                const waterState = getWaterTraversalState(
                    player.position.x,
                    player.position.z,
                    player.position.y,
                    PLAYER_WATER_HEIGHT
                );
                if (waterState.isSwimming) break;
            }
            if (!mountedOnDragon && (isGrounded || infiniteJump)) {
                velocity.y = 15 * jumpMultiplier;
                isGrounded = false;
            }
            break;
        case 'KeyU':
            unmountDragon();
            break;
        case 'KeyT':
            if (dragonBondFormed && dragonGemCollected) {
                dragonTethered = !dragonTethered;
                // When untethering, send the dragon back down to the ground.
                if (!dragonTethered) dragonDescending = true;
                // Do NOT reset the shot timer on toggle — prevents rapid-T from bypassing the fire rate.
            }
            break;
        case 'Digit1':
            currentHandItem = 'fist';
            updateAK47VisualState();
            flashEquipHint('Fist');
            break;
        case 'Digit2':
            if (hasShovel) {
                currentHandItem = 'shovel';
                updateAK47VisualState();
                flashEquipHint('Shovel');
            }
            break;
        case 'Digit3':
            if (ak47Collected) {
                currentHandItem = 'ak47';
                updateAK47VisualState();
                flashEquipHint('AK47');
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': isRunning = false; break;
        case 'Space': spaceHeld = false; break;
    }
}

function onMouseDown(event) {
    if (event.button !== 0) return;
    if (!isLocked || playerDead) return;

    event.preventDefault();

    if (mountedOnDragon) {
        punch();
        return;
    }

    if (ak47Collected && ak47Equipped) {
        ak47TriggerHeld = true;
        fireAK47(); // immediate shot on press
        return;
    }

    punch();
}

function onMouseUp(event) {
    if (event.button !== 0) return;
    ak47TriggerHeld = false;
}

function onMouseMove(event) {
    if (!isLocked) return;
    if (shadowManCutscene) return; // camera is locked during cutscene

    const sensitivity = 0.002;
    cameraYaw -= event.movementX * sensitivity;
    cameraPitch += event.movementY * sensitivity;

    // Clamp vertical rotation (allow looking up to ~87.8 degrees up and down)
    cameraPitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, cameraPitch));
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

