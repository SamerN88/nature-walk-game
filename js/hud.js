function updateMenuPanels() {
    const controls = document.getElementById('menu-controls-list');
    if (controls) {
        const lines = ['M - Menu'];
        // Only show inventory hint once the player has something to view
        if (inventoryItems.length > 0 || handSlots.length > 1) lines.push('I - Inventory');
        lines.push('WASD - Move', 'SHIFT - Run', 'SPACE - Jump', 'Click - Punch/Interact');
        if (dragonGemCollected) lines.push('U - Unmount dragon');
        if (dragonBondFormed) lines.push('T - Tether dragon');
        controls.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
    }

    const npcTypes = ['deer', 'rabbit', 'bird', 'human'];
    npcTypes.forEach(type => {
        const el = document.getElementById(`kills-${type}`);
        if (el) el.textContent = killBreakdown[type];
    });
    // Demon kill row only visible after apocalypse begins
    const demonKillRow = document.getElementById('kills-demon-row');
    if (demonKillRow) demonKillRow.style.display = demonApocalypse ? '' : 'none';
    const demonEl = document.getElementById('kills-demon');
    if (demonEl) demonEl.textContent = killBreakdown.demon;

    const bestSection = document.getElementById('best-hell-run-section');
    if (bestSection) {
        bestSection.style.display = hasPlayedDemonRounds ? 'block' : 'none';
    }

    const bestRoundEl = document.getElementById('best-demon-round');
    if (bestRoundEl) bestRoundEl.textContent = bestDemonRoundsReached;

    const bestKillsEl = document.getElementById('best-demon-kills');
    if (bestKillsEl) bestKillsEl.textContent = bestDemonRoundsKills;
}

function updateBestDemonRoundsRun() {
    if (!hasPlayedDemonRounds) return;

    if (
        currentRound > bestDemonRoundsReached ||
        (currentRound === bestDemonRoundsReached && roundKillCount > bestDemonRoundsKills)
    ) {
        bestDemonRoundsReached = currentRound;
        bestDemonRoundsKills = roundKillCount;
        updateMenuPanels();
    }
}

function updateTopCornerHudVisibility() {
    const showHud = timeMenuOpen || !demonApocalypse;
    document.getElementById('ui').style.display = showHud ? 'block' : 'none';
    document.getElementById('stats').style.display = showHud ? 'block' : 'none';
}

function updateStats() {
    document.getElementById('alive-count').textContent = npcs.length;
    document.getElementById('kill-count').textContent = killCount;
    updateMenuPanels();
}

function openTimeMenu() {
    if (timeMenuOpen) return;
    timeMenuOpen = true;
    const menu = document.getElementById('game-menu');
    menu.style.display = 'block';
    updateTopCornerHudVisibility();
    document.getElementById('respawn-rate').value = respawnRate;
    updateMenuPanels();
    document.exitPointerLock();
}

function toggleTimeMenu() {
    if (timeMenuOpen) {
        timeMenuOpen = false;
        document.getElementById('game-menu').style.display = 'none';
        updateTopCornerHudVisibility();
        if (!playerDead) {
            renderer.domElement.requestPointerLock();
        }
        return;
    }
    openTimeMenu();
}

function godSpawnNPCs() {
    const count = parseInt(document.getElementById('spawn-count').value) || 10;
    for (let i = 0; i < count; i++) {
        spawnRandomNPC();
    }
    updateStats();
}

function godKillNPCs() {
    const count = Math.min(parseInt(document.getElementById('kill-input').value) || 10, npcs.length);
    for (let i = 0; i < count; i++) {
        if (npcs.length > 0) {
            const index = Math.floor(Math.random() * npcs.length);
            scene.remove(npcs[index].mesh);
            npcs.splice(index, 1);
        }
    }
    updateStats();
}

function setRespawnRate() {
    respawnRate = parseInt(document.getElementById('respawn-rate').value) || 0;
}

function resolveRoofCollision(previousY) {
    let groundedOnRoof = false;

    for (const roof of roofColliders) {
        if (!isPointInsideRoofCollider(player.position.x, player.position.z, roof)) continue;

        // Landing from above: clamp to roof top.
        // previousY lower bound is roof.topY - 2.0 (not a tight 0.05) so that
        // walking laterally onto the roof is caught even when gravity has already
        // pulled the player slightly below topY in the same frame.
        // player.position.y upper bound of topY + 1.5 handles cases where the
        // player arrives from just above while still excluding deep-inside-cave players.
        if (velocity.y <= 0 && previousY >= roof.topY - 2.0 && player.position.y <= roof.topY + 1.5) {
            player.position.y = roof.topY;
            if (velocity.y < 0) velocity.y = 0;
            groundedOnRoof = true;
            continue;
        }

        // Hitting underside from inside.
        if (velocity.y > 0 && previousY <= roof.bottomY + 0.05 && player.position.y >= roof.bottomY) {
            player.position.y = roof.bottomY - 0.01;
            velocity.y = 0;
        }
    }

    return groundedOnRoof;
}

