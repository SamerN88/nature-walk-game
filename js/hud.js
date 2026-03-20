function updateMenuPanels() {
    const controls = document.getElementById('menu-controls-list');
    if (controls) {
        const lines = [
            'M - Menu',
            'I - Inventory',
            'WASD - Move',
            'SHIFT - Run',
            'SPACE - Jump',
            'Click - Punch/Interact'
        ];
        if (dragonGemCollected) lines.push('U - Unmount dragon');
        if (dragonBondFormed) lines.push('T - Tether dragon');
        lines.push('1 - Fist');
        if (hasShovel) lines.push('2 - Shovel');
        if (ak47Collected) lines.push('3 - AK47');
        controls.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
    }

    const map = ['deer', 'rabbit', 'bird', 'human', 'demon'];
    map.forEach(type => {
        const el = document.getElementById(`kills-${type}`);
        if (el) el.textContent = killBreakdown[type];
    });

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
        if (velocity.y <= 0 && previousY >= roof.topY - 0.05 && player.position.y <= roof.topY + 0.35) {
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

