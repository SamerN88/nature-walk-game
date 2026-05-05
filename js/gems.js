function createSecretGem() {
    const gemGroup = new THREE.Group();
    gemGroup.userData.ignoreCameraOcclusion = true;

    // Main gem crystal
    const gemGeometry = new THREE.OctahedronGeometry(0.8, 0);
    const gemMaterial = new THREE.MeshLambertMaterial({
        color: 0x00FFFF,
        emissive: 0xFF00FF,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85
    });
    const gem = new THREE.Mesh(gemGeometry, gemMaterial);
    gem.scale.y = 1.5;
    gemGroup.add(gem);

    // Inner glow
    const glowGeometry = new THREE.OctahedronGeometry(0.5, 0);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xFF00FF,
        transparent: true,
        opacity: 0.6
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.scale.y = 1.5;
    gemGroup.add(glow);

    // Outer glow sphere
    const outerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.2
        })
    );
    gemGroup.add(outerGlow);

    // Point light for the gem
    const gemLight = new THREE.PointLight(0x00FFFF, 0, 20); // set intensity to 0 but it immediately gets overridden in updateGem
    gemLight.position.y = 0;
    gemGroup.add(gemLight);
    gemGroup.userData.outerGlow = outerGlow;
    gemGroup.userData.pointLight = gemLight;

    // Find a spawn position: ring 800-1500 from origin, at least 500 from player.
    // Surface-clamped so the gem sits on top of whatever is there (terrain, mountain, structure).
    let x, z;
    if (DEBUG_GEMS || DEBUG_BOOST) {
        const a = Math.random() * Math.PI * 2;
        const d = 10 + Math.random() * 50;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
    } else {
        const playerX = player ? player.position.x : 0;
        const playerZ = player ? player.position.z : 0;
        let found = false;
        for (let attempt = 0; attempt < 80; attempt++) {
            const a = Math.random() * Math.PI * 2;
            const d = 800 + Math.random() * 700;
            const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
            if (isPointInWater(cx, cz)) continue;
            const dx = cx - playerX, dz = cz - playerZ;
            if (dx * dx + dz * dz >= 500 * 500) { x = cx; z = cz; found = true; break; }
        }
        if (!found) {
            // Fallback: try angles opposite the player, skipping water
            const baseAngle = Math.atan2(playerZ, playerX) + Math.PI;
            for (let i = 0; i < 8; i++) {
                const a = baseAngle + (i / 8) * Math.PI * 2;
                const d = 800 + Math.random() * 400;
                const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
                if (!isPointInWater(cx, cz)) { x = cx; z = cz; found = true; break; }
            }
            if (!found) {
                x = Math.cos(baseAngle) * 1000;
                z = Math.sin(baseAngle) * 1000;
            }
        }
    }
    const terrainY = getGroundHeight(x, z);
    const structY = getStructureHeight(x, z);
    const groundY = Math.max(terrainY, structY);

    gemGroup.position.set(x, groundY + 1.5, z);
    scene.add(gemGroup);

    // Tag every child so the beam raycast can identify this as the secret gem
    gemGroup.traverse(obj => { obj.userData.isSecretGem = true; });

    secretGem = {
        mesh: gemGroup,
        x: x,
        z: z,
        baseY: groundY + 1.5,
        rotationSpeed: 1,
        bobSpeed: 2,
        bobAmount: 0.3
    };
}

function createDragonGem() {
    if (!dragonVolcano) {
        createDragonVolcano();
    }

    const gemGroup = new THREE.Group();
    gemGroup.userData.ignoreCameraOcclusion = true;

    // Main gem crystal - red and black
    const gemGeometry = new THREE.OctahedronGeometry(0.8, 0);
    // const gemMaterial = new THREE.MeshLambertMaterial({
    //     color: 0xFF0000,
    //     emissive: 0x330000,
    //     emissiveIntensity: 0.8,
    //     transparent: true,
    //     opacity: 0.85
    // });
    const gemMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        specular: 0xaa2222,
        shininess: 80,
        transparent: true,
        opacity: 0.7,
        flatShading: false,
        emissive: 0x550000,
        emissiveIntensity: 0.8,
    });
    const gem = new THREE.Mesh(gemGeometry, gemMaterial);
    gem.scale.y = 1.5;
    gemGroup.add(gem);

    // Inner dark core
    const coreGeometry = new THREE.OctahedronGeometry(0.4, 0);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        // specular: 0x000000,
        // shininess: 60,
        // transparent: true,
        // opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.scale.y = 1.5;
    gemGroup.add(core);

    // Outer glow
    const outerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.15
        })
    );
    gemGroup.add(outerGlow);

    // Point light
    const gemLight = new THREE.PointLight(0xFF0000, 0, 20); // set intensity to 0 but it immediately gets overridden in updateDragonGem
    gemGroup.add(gemLight);
    gemGroup.userData.outerGlow = outerGlow;
    gemGroup.userData.pointLight = gemLight;

    let x;
    let z;
    let baseY;

    if (DEBUG_GEMS) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 50;
        x = Math.cos(angle) * distance;
        z = Math.sin(angle) * distance;
        baseY = getLandSurfaceHeight(x, z) + 1.5;
    } else {
        x = dragonVolcano ? dragonVolcano.x : 0;
        z = dragonVolcano ? dragonVolcano.z : 0;
        baseY = dragonVolcano ? dragonVolcano.platformTopY + 1.5 : getLandSurfaceHeight(x, z) + 1.5;
    }

    gemGroup.position.set(x, baseY, z);
    scene.add(gemGroup);

    dragonGem = {
        mesh: gemGroup,
        x: x,
        z: z,
        baseY,
        rotationSpeed: 1.5,
        bobSpeed: 2.5,
        bobAmount: 0.4
    };
}

function updateDragonGem(delta, time) {
    if (!dragonGem || dragonGemCollected) return;

    // Rotate and bob
    dragonGem.mesh.rotation.y += dragonGem.rotationSpeed * delta;
    dragonGem.mesh.position.y = dragonGem.baseY + Math.sin(time * dragonGem.bobSpeed) * dragonGem.bobAmount;

    // Pulsing glow
    const pulse = 0.3 + Math.sin(time * 3) * 0.2;
    dragonGem.mesh.userData.outerGlow.material.opacity = pulse;
    dragonGem.mesh.userData.pointLight.intensity = 10 + 3*Math.sin(time * 3);

    // Check collision with player
    const dx = player.position.x - dragonGem.x;
    const dz = player.position.z - dragonGem.z;
    const dy = player.position.y - dragonGem.mesh.position.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);

    if (dist < GEM_COLLECTION_RADIUS && !mountedOnDragon) {
        collectDragonGem();
    }
}

function collectDragonGem() {
    dragonGemCollected = true;

    // Capture world position before removing the mesh
    const gemWorldPos = dragonGem.mesh.position.clone();
    scene.remove(dragonGem.mesh);
    updateMenuPanels();

    // Particle burst — red and black, matching the gem's aesthetic
    const particles = new THREE.Group();
    particles.userData.ignoreCameraOcclusion = true;
    for (let i = 0; i < 30; i++) {
        const particle = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.3, 0),
            new THREE.MeshBasicMaterial({
                color: Math.random() > 0.4 ? 0xFF1100 : 0x111111,
                transparent: true,
                opacity: 1
            })
        );
        particle.position.copy(gemWorldPos);
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            Math.random() * 15,
            (Math.random() - 0.5) * 20
        );
        particles.add(particle);
    }
    scene.add(particles);
    let particleLife = 0;
    const animateGemParticles = () => {
        particleLife += 0.016;
        particles.children.forEach(p => {
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
            p.userData.velocity.y -= 15 * 0.016;
            p.material.opacity = Math.max(0, 1 - particleLife);
            p.rotation.x += 0.1;
            p.rotation.y += 0.15;
        });
        if (particleLife < 2) {
            requestAnimationFrame(animateGemParticles);
        } else {
            scene.remove(particles);
        }
    };
    animateGemParticles();

    // Flash effect
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg,#FF0000,#000000);opacity:0.7;pointer-events:none;z-index:1000;transition:opacity 1s';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 100);
    setTimeout(() => { flash.remove(); }, 1100);

    // Start dragon descent — spawn directly above the gem so it descends onto it
    const DRAGON_SPAWN_HEIGHT = 500;
    dragonDescending = true;
    dragon.visible = true;
    dragon.position.set(dragonGem.x, dragonGem.baseY + DRAGON_SPAWN_HEIGHT, dragonGem.z);
}


function updateGem(delta, time) {
    if (!secretGem || gemCollected) return;

    // Rotate and bob
    secretGem.mesh.rotation.y += secretGem.rotationSpeed * delta;
    secretGem.mesh.position.y = secretGem.baseY + Math.sin(time * secretGem.bobSpeed) * secretGem.bobAmount;

    // Pulsing glow effect
    const pulse = 0.3 + Math.sin(time * 3) * 0.2;
    secretGem.mesh.userData.outerGlow.material.opacity = pulse;
    secretGem.mesh.userData.pointLight.intensity = 5 + 3*Math.sin(time * 3);

    // Check collision with player
    const dx = player.position.x - secretGem.x;
    const dz = player.position.z - secretGem.z;
    const dy = player.position.y - secretGem.mesh.position.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);

    if (dist < GEM_COLLECTION_RADIUS && !mountedOnDragon) {
        collectGem();
    }
}

function collectGem() {
    gemCollected = true;
    boostUnlocked = true;
    boostActive = true;
    updateMenuPanels();
    flashEquipHint('BOOST: ON');

    // Visual feedback - gem explodes into particles
    const particles = new THREE.Group();
    particles.userData.ignoreCameraOcclusion = true;
    for (let i = 0; i < 30; i++) {
        const particle = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.2, 0),
            new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x00FFFF : 0xFF00FF,
                transparent: true,
                opacity: 1
            })
        );
        particle.position.copy(secretGem.mesh.position);
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            Math.random() * 15,
            (Math.random() - 0.5) * 20
        );
        particles.add(particle);
    }
    scene.add(particles);

    // Remove gem
    scene.remove(secretGem.mesh);

    // Animate particles
    let particleLife = 0;
    const animateParticles = () => {
        particleLife += 0.016;
        particles.children.forEach(p => {
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
            p.userData.velocity.y -= 15 * 0.016;
            p.material.opacity = Math.max(0, 1 - particleLife);
            p.rotation.x += 0.1;
            p.rotation.y += 0.1;
        });
        if (particleLife < 2) {
            requestAnimationFrame(animateParticles);
        } else {
            scene.remove(particles);
        }
    };
    animateParticles();

    // Flash screen effect
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(45deg,#00FFFF,#FF00FF);opacity:0.7;pointer-events:none;z-index:1000;transition:opacity 1s';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 100);
    setTimeout(() => { flash.remove(); }, 1100);
}


