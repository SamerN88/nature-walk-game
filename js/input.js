function onKeyDown(event) {
    if (event.code === 'KeyP') {
        if (playerDead) return;
        if (event.repeat) return;
        event.preventDefault();
        if (inventoryOpen || viewingNoteItem) {
            // Close inventory (and any open note), then open game menu
            if (viewingNoteItem) closeNoteViewer();
            inventoryOpen = false;
            document.getElementById('inventory-overlay').style.display = 'none';
            openTimeMenu();
        } else {
            toggleTimeMenu();
        }
        return;
    }

    if (event.code === 'KeyE') {
        if (playerDead) return;
        if (event.repeat) return;
        if (timeMenuOpen) return; // E does nothing while game menu is open
        // Only open inventory when the player has something beyond bare fists
        if (!inventoryOpen && handSlots.length <= 1 && inventoryItems.length === 0) return;
        event.preventDefault();
        toggleInventory();
        return;
    }

    if (event.code === 'Escape') {
        return; // ESC never closes inventory/note viewer; only I does
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
            if (!mountedOnDragon && (isGrounded || (infiniteJump && !roundMode && !demonApocalypse))) {
                velocity.y = 15 * (boostUnlocked && boostActive && !roundMode ? 3 : 1);
                isGrounded = false;
            }
            break;
        case 'KeyB':
            if ((boostUnlocked || holyGemCollected) && !roundMode) {
                boostActive = !boostActive;
                flashEquipHint(boostActive ? 'BOOST: ON' : 'BOOST: OFF');
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
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
        case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': {
            const slotIdx = parseInt(event.code[5]) - 1;
            if (slotIdx >= 0 && slotIdx < handSlots.length) {
                currentHandItem = handSlots[slotIdx];
                syncHandItemVisuals();
                flashEquipHint(getItemDisplayName(handSlots[slotIdx]));
            }
            break;
        }
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

