function createNPCs() {
    // Create deer
    for (let i = 0; i < 200; i++) {
        createDeer();
    }
    // Create rabbits
    for (let i = 0; i < 350; i++) {
        createRabbit();
    }
    // Create birds — 150 small, 150 big
    for (let i = 0; i < 150; i++) { createBird(1); }
    for (let i = 0; i < 150; i++) { createBird(4); }
    // Create humans
    for (let i = 0; i < 150; i++) {
        createHuman();
    }
}

function createDeer() {
    const deer = new THREE.Group();
    deer.userData.ignoreCameraOcclusion = true;
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x6B4912 });

    // Body
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1.5, 4, 8),
        bodyMaterial
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = 1.2;
    deer.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        bodyMaterial
    );
    head.position.set(1.2, 1.5, 0);
    deer.add(head);

    // Snout
    const snout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 0.3, 6),
        bodyMaterial
    );
    snout.rotation.z = Math.PI / 2;
    snout.position.set(1.5, 1.4, 0);
    deer.add(snout);

    // Ears
    [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(
            new THREE.ConeGeometry(0.1, 0.25, 4),
            bodyMaterial
        );
        ear.position.set(1.1, 1.8, side * 0.2);
        deer.add(ear);
    });

    // Antlers
    [-1, 1].forEach(side => {
        const antler = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4),
            legMaterial
        );
        antler.position.set(1.0, 1.9, side * 0.15);
        antler.rotation.z = side * 0.3;
        deer.add(antler);
    });

    // Legs
    [[-0.5, 0.25], [-0.5, -0.25], [0.5, 0.25], [0.5, -0.25]].forEach(pos => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6),
            legMaterial
        );
        leg.position.set(pos[0], 0.4, pos[1]);
        deer.add(leg);
    });

    // Tail
    const tail = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0xFFFFFF })
    );
    tail.position.set(-1, 1.3, 0);
    deer.add(tail);

    const spawn = findNPCSpawnPosition({
        type: 'box',
        minX: -WORLD_SIZE * 0.6,
        maxX: WORLD_SIZE * 0.6,
        minZ: -WORLD_SIZE * 0.6,
        maxZ: WORLD_SIZE * 0.6
    });
    const x = spawn.x;
    const z = spawn.z;
    deer.position.set(x, getGroundHeight(x, z), z);
    enableMeshShadows(deer);
    scene.add(deer);

    npcs.push({
        mesh: deer,
        type: 'deer',
        waterHeight: 2.15,
        speed: 2 + Math.random() * 2,
        direction: Math.random() * Math.PI * 2,
        changeTimer: 0,
        changeInterval: 2 + Math.random() * 4,
        waterBobPhase: Math.random() * Math.PI * 2
    });
}

function createRabbit() {
    const rabbit = new THREE.Group();
    rabbit.userData.ignoreCameraOcclusion = true;
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xAAAAAA });
    const innerEarMaterial = new THREE.MeshLambertMaterial({ color: 0xFFCCCC });

    // Body
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        bodyMaterial
    );
    body.scale.set(1, 0.8, 1.2);
    body.position.y = 0.25;
    rabbit.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        bodyMaterial
    );
    head.position.set(0.25, 0.35, 0);
    rabbit.add(head);

    // Ears
    [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.04, 0.2, 4, 6),
            bodyMaterial
        );
        ear.position.set(0.2, 0.6, side * 0.08);
        ear.rotation.z = side * 0.2;
        rabbit.add(ear);
    });

    // Tail
    const tail = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0xFFFFFF })
    );
    tail.position.set(-0.3, 0.25, 0);
    rabbit.add(tail);

    const spawn = findNPCSpawnPosition({
        type: 'box',
        minX: -WORLD_SIZE * 0.5,
        maxX: WORLD_SIZE * 0.5,
        minZ: -WORLD_SIZE * 0.5,
        maxZ: WORLD_SIZE * 0.5
    });
    const x = spawn.x;
    const z = spawn.z;
    rabbit.position.set(x, getGroundHeight(x, z), z);
    enableMeshShadows(rabbit);
    scene.add(rabbit);

    npcs.push({
        mesh: rabbit,
        type: 'rabbit',
        waterHeight: 0.72,
        speed: 3 + Math.random() * 3,
        direction: Math.random() * Math.PI * 2,
        changeTimer: 0,
        changeInterval: 0.5 + Math.random() * 2,
        hopTimer: 0,
        waterBobPhase: Math.random() * Math.PI * 2
    });
}

function createBird(birdScale = 1) {
    const bird = new THREE.Group();
    bird.userData.ignoreCameraOcclusion = true;
    const bodyColor = [0x4444FF, 0xFF4444, 0xFFFF00, 0x44FF44, 0xFF8800][Math.floor(Math.random() * 5)];
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    const wings = [];

    // Body
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        bodyMaterial
    );
    body.scale.set(1, 0.8, 1.3);
    bird.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        bodyMaterial
    );
    head.position.set(0.18, 0.05, 0);
    bird.add(head);

    // Beak
    const beak = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.1, 4),
        new THREE.MeshLambertMaterial({ color: 0xFFA500 })
    );
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.3, 0.05, 0);
    bird.add(beak);

    // Wings
    [-1, 1].forEach(side => {
        const wing = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.15, 0.25),
            bodyMaterial
        );
        wing.position.set(0, 0, side * 0.18);
        bird.add(wing);
        wings.push(wing);
    });

    // Tail
    const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.08, 0.12),
        bodyMaterial
    );
    tail.position.set(-0.2, 0, 0);
    bird.add(tail);
    bird.userData.wings = wings;

    bird.scale.set(birdScale, birdScale, birdScale);

    const spawn = findNPCSpawnPosition({
        type: 'box',
        minX: -WORLD_SIZE * 0.5,
        maxX: WORLD_SIZE * 0.5,
        minZ: -WORLD_SIZE * 0.5,
        maxZ: WORLD_SIZE * 0.5
    });
    const x = spawn.x;
    const z = spawn.z;
    const flyHeight = birdScale > 1
        ? (30 + Math.random() * 30)   // big birds fly higher
        : (10 + Math.random() * 20);  // small birds fly lower
    bird.position.set(x, getGroundHeight(x, z) + flyHeight, z);
    enableMeshShadows(bird);
    scene.add(bird);

    npcs.push({
        mesh: bird,
        type: 'bird',
        waterHeight: 0.35 * birdScale,
        speed: birdScale > 1 ? (3 + Math.random() * 3) : (8 + Math.random() * 6),
        direction: Math.random() * Math.PI * 2,
        changeTimer: 0,
        changeInterval: 3 + Math.random() * 5,
        flyHeight: flyHeight,
        wingPhase: Math.random() * Math.PI * 2,
        waterBobPhase: Math.random() * Math.PI * 2
    });
}

function createHuman() {
    const human = new THREE.Group();
    human.userData.ignoreCameraOcclusion = true;
    const skinColor = [0xFFDBAC, 0xD2A06F, 0x8D5524, 0xC68642][Math.floor(Math.random() * 4)];
    const clothesColor = [0x3366CC, 0xCC3333, 0x33AA33, 0x9933CC, 0xCC9933][Math.floor(Math.random() * 5)];
    const skinMaterial = new THREE.MeshLambertMaterial({ color: skinColor });
    const clothesMaterial = new THREE.MeshLambertMaterial({ color: clothesColor });

    // Body/shirt
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 0.6, 4, 8),
        clothesMaterial
    );
    body.position.y = 1;
    human.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        skinMaterial
    );
    head.position.y = 1.65;
    human.add(head);

    // Hair
    const hairColor = [0x000000, 0x3D2314, 0x8B4513, 0xFFD700, 0xA52A2A][Math.floor(Math.random() * 5)];
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: hairColor })
    );
    hair.position.y = 1.7;
    human.add(hair);

    // Eyes
    [-1, 1].forEach(side => {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            new THREE.MeshLambertMaterial({ color: 0x000000 })
        );
        eye.position.set(0.2, 1.7, side * 0.1);
        human.add(eye);
    });

    // Legs
    [-1, 1].forEach(side => {
        const leg = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.1, 0.4, 4, 6),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        leg.position.set(0, 0.35, side * 0.15);
        human.add(leg);
    });

    // Arms
    [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.08, 0.35, 4, 6),
            skinMaterial
        );
        arm.position.set(0, 1, side * 0.4);
        arm.rotation.z = side * 0.3;
        human.add(arm);
    });

    const spawn = findNPCSpawnPosition({
        type: 'box',
        minX: -WORLD_SIZE * 0.4,
        maxX: WORLD_SIZE * 0.4,
        minZ: -WORLD_SIZE * 0.4,
        maxZ: WORLD_SIZE * 0.4
    });
    const x = spawn.x;
    const z = spawn.z;
    human.position.set(x, getGroundHeight(x, z), z);
    enableMeshShadows(human);
    scene.add(human);

    npcs.push({
        mesh: human,
        type: 'human',
        waterHeight: 1.96,
        speed: 1.5 + Math.random() * 1.5,
        direction: Math.random() * Math.PI * 2,
        changeTimer: 0,
        changeInterval: 3 + Math.random() * 5,
        walkPhase: Math.random() * Math.PI * 2,
        waterBobPhase: Math.random() * Math.PI * 2
    });
}

function updateNPCs(delta) {
    npcs.forEach(npc => {
        npc.changeTimer += delta;

        // Change direction periodically
        if (npc.changeTimer > npc.changeInterval) {
            npc.changeTimer = 0;
            npc.direction += (Math.random() - 0.5) * Math.PI;
            npc.changeInterval = (npc.type === 'rabbit' ? 0.5 : 2) + Math.random() * 4;
        }

        // Move NPC
        const moveX = Math.sin(npc.direction) * npc.speed * delta;
        const moveZ = Math.cos(npc.direction) * npc.speed * delta;

        npc.mesh.position.x += moveX;
        npc.mesh.position.z += moveZ;

        // Keep in bounds
        const bound = WORLD_SIZE * 0.9;
        if (Math.abs(npc.mesh.position.x) > bound || Math.abs(npc.mesh.position.z) > bound) {
            npc.direction += Math.PI; // Turn around
            npc.mesh.position.x = Math.max(-bound, Math.min(bound, npc.mesh.position.x));
            npc.mesh.position.z = Math.max(-bound, Math.min(bound, npc.mesh.position.z));
        }

        // Update Y position based on type
        if (npc.type === 'bird') {
            // Birds fly
            npc.wingPhase += delta * 15;
            const baseY = getGroundHeight(npc.mesh.position.x, npc.mesh.position.z);
            npc.mesh.position.y = baseY + npc.flyHeight + Math.sin(npc.wingPhase * 0.5) * 2;
            // Wing flapping animation
            (npc.mesh.userData.wings || []).forEach(wing => {
                wing.rotation.x = Math.sin(npc.wingPhase) * 0.5;
            });
        } else if (npc.type === 'rabbit') {
            npc.hopTimer += delta * 8;
            const waterState = getWaterTraversalState(
                npc.mesh.position.x,
                npc.mesh.position.z,
                npc.mesh.position.y,
                npc.waterHeight || 1
            );
            if (waterState.water && !waterState.structureAboveWater) {
                npc.waterBobPhase += delta * NPC_WATER_BOB_SPEED;
                const bobMid = (NPC_WATER_MIN_SUBMERSION + NPC_WATER_MAX_SUBMERSION) * 0.5;
                const bobAmp = (NPC_WATER_MAX_SUBMERSION - NPC_WATER_MIN_SUBMERSION) * 0.5;
                const submersion = bobMid + Math.sin(npc.waterBobPhase) * bobAmp;
                const bobY = waterState.surfaceY - (npc.waterHeight || 1) * submersion;
                npc.mesh.position.y = Math.max(waterState.floorY, bobY);
            } else {
                npc.mesh.position.y = waterState.landY + Math.abs(Math.sin(npc.hopTimer)) * 0.3;
            }
        } else {
            const waterState = getWaterTraversalState(
                npc.mesh.position.x,
                npc.mesh.position.z,
                npc.mesh.position.y,
                npc.waterHeight || 1
            );
            if (waterState.water && !waterState.structureAboveWater) {
                npc.waterBobPhase += delta * NPC_WATER_BOB_SPEED;
                const bobMid = (NPC_WATER_MIN_SUBMERSION + NPC_WATER_MAX_SUBMERSION) * 0.5;
                const bobAmp = (NPC_WATER_MAX_SUBMERSION - NPC_WATER_MIN_SUBMERSION) * 0.5;
                const submersion = bobMid + Math.sin(npc.waterBobPhase) * bobAmp;
                const bobY = waterState.surfaceY - (npc.waterHeight || 1) * submersion;
                npc.mesh.position.y = Math.max(waterState.floorY, bobY);
            } else {
                npc.mesh.position.y = waterState.landY;
            }
        }

        // Face movement direction
        npc.mesh.rotation.y = npc.direction;
    });
}

function getNPCHitRadius(npc) {
    if (npc.type === 'bird') return (npc.mesh.scale.x > 1.5) ? 6.0 : 2.8;
    if (npc.type === 'deer') return 3.2;
    if (npc.type === 'human') return 2.8;
    return 2.2;
}

function explodeNPC(npcData, index) {
    const npc = npcData.mesh;
    const position = npc.position.clone();
    const npcType = npcData.type;

    // Create explosion particles
    const particleCount = 25;
    const particles = new THREE.Group();
    particles.userData.ignoreCameraOcclusion = true;

    // Get colors based on NPC type
    let colors;
    switch (npcType) {
        case 'deer': colors = [0x8B6914, 0x6B4912, 0xFFFFFF]; break;
        case 'rabbit': colors = [0xAAAAAA, 0xFFFFFF, 0xFFCCCC]; break;
        case 'bird': colors = [0x4444FF, 0xFF4444, 0xFFFF00, 0x44FF44]; break;
        case 'human': colors = [0xFFDBAC, 0x3366CC, 0xCC3333, 0x33AA33]; break;
        default: colors = [0xFF0000, 0xFF6600, 0xFFFF00];
    }

    for (let i = 0; i < particleCount; i++) {
        const size = 0.1 + Math.random() * 0.3;
        const geom = Math.random() > 0.5
            ? new THREE.BoxGeometry(size, size, size)
            : new THREE.SphereGeometry(size * 0.5, 4, 4);

        const particle = new THREE.Mesh(
            geom,
            new THREE.MeshLambertMaterial({
                color: colors[Math.floor(Math.random() * colors.length)]
            })
        );

        particle.position.copy(position);
        particle.position.y += 1;
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 12 + 5,
            (Math.random() - 0.5) * 15
        );
        particle.userData.rotSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        particles.add(particle);
    }

    // Add a flash/shockwave ring
    const ringGeom = new THREE.RingGeometry(0.1, 0.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.userData.ignoreCameraOcclusion = true;
    ring.position.copy(position);
    ring.position.y += 1;
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    scene.add(particles);

    // Remove the NPC
    scene.remove(npc);
    npcs.splice(index, 1);

    // Animate explosion
    let explosionTime = 0;
    const animateExplosion = () => {
        explosionTime += 0.016;

        // Animate particles
        particles.children.forEach(p => {
            p.position.add(p.userData.velocity.clone().multiplyScalar(0.016));
            p.userData.velocity.y -= 20 * 0.016; // gravity
            p.rotation.x += p.userData.rotSpeed.x * 0.016;
            p.rotation.y += p.userData.rotSpeed.y * 0.016;
            p.rotation.z += p.userData.rotSpeed.z * 0.016;

            // Fade out
            if (p.material.opacity !== undefined) {
                p.material.transparent = true;
                p.material.opacity = Math.max(0, 1 - explosionTime * 0.8);
            }

            // Scale down
            const scale = Math.max(0.1, 1 - explosionTime * 0.5);
            p.scale.set(scale, scale, scale);
        });

        // Animate shockwave ring
        const ringScale = 1 + explosionTime * 8;
        ring.scale.set(ringScale, ringScale, 1);
        ring.material.opacity = Math.max(0, 1 - explosionTime * 2);

        if (explosionTime < 2) {
            requestAnimationFrame(animateExplosion);
        } else {
            scene.remove(particles);
            scene.remove(ring);
        }
    };
    animateExplosion();

    // Increment kill count
    recordKill(npcType);

    // Spawn NPCs based on respawn rate
    for (let i = 0; i < respawnRate; i++) {
        spawnRandomNPC();
    }

    // Update stats display
    updateStats();
}

function spawnRandomNPC() {
    const types = ['deer', 'rabbit', 'bird', 'human'];
    const type = types[Math.floor(Math.random() * types.length)];

    switch (type) {
        case 'deer': createDeer(); break;
        case 'rabbit': createRabbit(); break;
        case 'bird': createBird(); break;
        case 'human': createHuman(); break;
    }
}

function recordKill(type) {
    killCount++;
    if (killBreakdown[type] !== undefined) {
        killBreakdown[type]++;
    }
}

