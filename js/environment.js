function createTree(x, z, scale = 1) {
    const tree = new THREE.Group();
    tree.userData.ignoreCameraOcclusion = true;

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.5 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    tree.userData.trunkMesh = trunk;
    tree.userData.treeHitCount = 0;
    tree.userData.treeScale = scale;
    tree.userData.treeHitCenterY = 5.15 * scale;
    tree.userData.treeHitRadius = 3.5 * scale;

    // Foliage layers
    const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });

    const foliage1 = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 * scale, 3 * scale, 8),
        foliageMaterial
    );
    foliage1.position.y = 4 * scale;
    foliage1.castShadow = false;
    foliage1.receiveShadow = true;
    tree.add(foliage1);

    const foliage2 = new THREE.Mesh(
        new THREE.ConeGeometry(2 * scale, 2.5 * scale, 8),
        foliageMaterial
    );
    foliage2.position.y = 5.5 * scale;
    foliage2.castShadow = false;
    tree.add(foliage2);

    const foliage3 = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 * scale, 2 * scale, 8),
        foliageMaterial
    );
    foliage3.position.y = 6.8 * scale;
    foliage3.castShadow = false;
    tree.add(foliage3);

    // Invisible shadow-proxy cone: spans the full foliage envelope so the shadow
    // pass renders one mesh instead of three. colorWrite/depthWrite = false keeps
    // it invisible to the player; the shadow pass uses its own depth material so
    // the proxy still casts a shadow correctly.
    // Foliage spans Y = 2.5s (base of foliage1) to 7.8s (top of foliage3).
    // Total height 5.3s, centre at 5.15s, max radius 2.5s.
    const shadowProxy = new THREE.Mesh(
        new THREE.ConeGeometry(2.5 * scale, 5.3 * scale, 8),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    );
    shadowProxy.position.y = 5.15 * scale;
    shadowProxy.castShadow = true;
    tree.add(shadowProxy);

    tree.position.set(x, getGroundHeight(x, z), z);
    scene.add(tree);
    trees.push(tree);
}

function createTrees() {
    // Create a forest
    for (let i = 0; i < 800; i++) {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        const z = (Math.random() - 0.5) * WORLD_SIZE * 1.5;

        // Don't place trees on the path or too close to spawn
        if (Math.abs(x) < 5 && Math.abs(z) < 60) continue;
        if (Math.sqrt(x*x + z*z) < 10) continue;
        if (isPointInWater(x, z)) continue;
        // Use a non-zero tree radius so foliage doesn't overlap enterable structures
        if (placementFootprints.some(fp => fp.noTree && footprintsOverlap({ x, z, radius: 4 }, fp, 0))) continue;

        const scale = 0.7 + Math.random() * 0.6;
        createTree(x, z, scale);
    }
}

function createWoodenMarkerSticks() {
    const stickCount = 3;
    const stickHeight = 4;
    const stickMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    const innerRegion = {
        type: 'box',
        minX: -WORLD_SIZE * 0.5,
        maxX: WORLD_SIZE * 0.5,
        minZ: -WORLD_SIZE * 0.5,
        maxZ: WORLD_SIZE * 0.5
    };

    for (let i = 0; i < stickCount; i++) {
        const placement = findPlacement(() => {
            const point = samplePointInRegion(innerRegion);
            if (Math.abs(point.x) < 5 && Math.abs(point.z) < 60) return null;
            if (isPointInWater(point.x, point.z)) return null;

            return {
                x: point.x,
                z: point.z,
                footprint: { ...makePlacementFootprint(point.x, point.z, 3), noTree: true }
            };
        }, 180);

        if (!placement) continue;

        const baseY = getGroundHeight(placement.x, placement.z);
        const stick = new THREE.Mesh(
            new THREE.CylinderGeometry(0.75, 1.1, stickHeight, 12),
            stickMaterial
        );
        stick.position.set(placement.x, baseY + stickHeight / 2 - 0.5, placement.z);
        stick.castShadow = true;
        stick.receiveShadow = true;
        stick.userData.ignoreCameraOcclusion = false;
        scene.add(stick);
    }
}

function createRocks() {
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });

    for (let i = 0; i < 300; i++) {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        const z = (Math.random() - 0.5) * WORLD_SIZE * 1.5;

        if (Math.sqrt(x*x + z*z) < 5) continue;
        if (isPointInWater(x, z)) continue;

        const rockGeometry = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.7, 0);
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x, getGroundHeight(x, z) + 0.2, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.scale.y = 0.6 + Math.random() * 0.4;
        scene.add(rock);
    }
}

function createFlowers() {
    const flowerColors = [0xFF69B4, 0xFFFF00, 0xFF6347, 0xDA70D6, 0xFFFFFF];

    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * WORLD_SIZE;
        const z = (Math.random() - 0.5) * WORLD_SIZE;
        if (isPointInWater(x, z)) continue;

        const flower = new THREE.Group();
        flower.userData.ignoreCameraOcclusion = true;

        // Stem
        const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
        const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.15;
        flower.add(stem);

        // Petals
        const petalGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const petalMaterial = new THREE.MeshLambertMaterial({
            color: flowerColors[Math.floor(Math.random() * flowerColors.length)]
        });
        const petals = new THREE.Mesh(petalGeometry, petalMaterial);
        petals.position.y = 0.35;
        petals.scale.y = 0.5;
        flower.add(petals);

        flower.position.set(x, getGroundHeight(x, z), z);
        scene.add(flower);
    }
}

function createGrass() {
    // Grass patches using simple cones
    const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });

    for (let i = 0; i < 2000; i++) {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        const z = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        if (isPointInWater(x, z)) continue;

        const grass = new THREE.Group();
        grass.userData.ignoreCameraOcclusion = true;

        for (let j = 0; j < 3; j++) {
            const blade = new THREE.Mesh(
                new THREE.ConeGeometry(0.05, 0.3 + Math.random() * 0.2, 4),
                grassMaterial
            );
            blade.position.set(
                (Math.random() - 0.5) * 0.2,
                0.15,
                (Math.random() - 0.5) * 0.2
            );
            blade.rotation.z = (Math.random() - 0.5) * 0.3;
            grass.add(blade);
        }

        grass.position.set(x, getGroundHeight(x, z), z);
        scene.add(grass);
    }
}

function isInsideDragonVolcanoCore(x, z, inset = 0) {
    if (!dragonVolcano) return false;

    const radius = Math.max(0, dragonVolcano.coreRadius - inset);
    const dx = x - dragonVolcano.x;
    const dz = z - dragonVolcano.z;
    return dx * dx + dz * dz < radius * radius;
}

function getDragonVolcanoShellHeight(x, z) {
    if (!dragonVolcano) return -Infinity;

    const dx = x - dragonVolcano.x;
    const dz = z - dragonVolcano.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < dragonVolcano.coreRadius || dist > dragonVolcano.outerBaseRadius) {
        return -Infinity;
    }

    if (dist <= dragonVolcano.outerTopRadius) {
        return dragonVolcano.topY;
    }

    const slopeSpan = dragonVolcano.outerBaseRadius - dragonVolcano.outerTopRadius;
    if (slopeSpan <= 1e-5) return dragonVolcano.topY;

    const t = (dist - dragonVolcano.outerTopRadius) / slopeSpan;
    return dragonVolcano.baseY + dragonVolcano.height * (1 - t);
}

function getDragonVolcanoTerrainFloorHeight(x, z, terrainY) {
    if (!isInsideDragonVolcanoCore(x, z)) return terrainY;
    return dragonVolcano.baseY;
}

function getDragonVolcanoPlatformTopHeight(x, z) {
    if (!dragonVolcano) return -Infinity;

    const dx = x - dragonVolcano.x;
    const dz = z - dragonVolcano.z;
    if (dx * dx + dz * dz > dragonVolcano.platformRadius * dragonVolcano.platformRadius) {
        return -Infinity;
    }

    return dragonVolcano.platformTopY;
}

function getDragonSupportHeight(x, z) {
    return Math.max(
        getLandSurfaceHeight(x, z),
        getDragonVolcanoPlatformTopHeight(x, z),
        getHolyGemPlatformHeight(x, z)
    );
}

// Like getDragonSupportHeight but only counts surfaces that are strictly below
// `aboveY`.  This prevents the platform (or any raised surface) from being used
// as a landing target when the dragon is already below it.
function getDragonSupportHeightBelow(x, z, aboveY) {
    const land    = getLandSurfaceHeight(x, z);
    const volcano = getDragonVolcanoPlatformTopHeight(x, z);
    const altar   = getHolyGemPlatformHeight(x, z);
    return Math.max(
        land,
        volcano < aboveY ? volcano : -Infinity,
        altar   < aboveY ? altar   : -Infinity
    );
}

function respawnPlayerAtOrigin() {
    player.position.set(0, getGroundHeight(0, 0), 0);
    velocity.set(0, 0, 0);
    isGrounded = true;
    isJumping = false;
    canJump = true;
    spaceHeld = false;
}

let _lavaResetPending = false;
function respawnPlayerFromDragonVolcanoLava() {
    if (!dragonVolcano || mountedOnDragon) return false;
    if (!isInsideDragonVolcanoCore(player.position.x, player.position.z, PLAYER_RADIUS * 0.15)) return false;
    if (player.position.y > dragonVolcano.lavaTopY) return false;

    // Hard reset back to title screen — no animation, pure reload
    if (!_lavaResetPending) {
        _lavaResetPending = true;
        location.reload();
    }
    return true;
}

function movePlayerNearDragonVolcanoDebug() {
    if (!dragonVolcano || !player) return;

    const toOriginLength = Math.hypot(dragonVolcano.x, dragonVolcano.z);
    const dirX = toOriginLength > 1e-5 ? -dragonVolcano.x / toOriginLength : 1;
    const dirZ = toOriginLength > 1e-5 ? -dragonVolcano.z / toOriginLength : 0;
    const spawnRadius = dragonVolcano.coreRadius + PLAYER_RADIUS + 0.75;
    const x = dragonVolcano.x + dirX * spawnRadius;
    const z = dragonVolcano.z + dirZ * spawnRadius;

    player.position.set(x, getLandSurfaceHeight(x, z), z);
    velocity.set(0, 0, 0);
}

function createMountains() {
    const mountainMaterial = new THREE.MeshLambertMaterial({ color: MOUNTAIN_BODY_COLOR });
    const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

    const region = { type: 'ring', minRadius: 1450, maxRadius: 1950 };

    for (let i = 0; i < 30; i++) {
        const placement = findPlacement(() => {
            const height = randRange(150, 300);
            const radius = randRange(80, 140);
            const rotation = randomRotationY();
            const point = samplePointInRegion(region);
            return {
                x: point.x,
                z: point.z,
                height,
                radius,
                rotation,
                footprint: makePlacementFootprint(point.x, point.z, radius + 26)
            };
        }, 260);

        if (!placement) continue;

        const mountainGroup = new THREE.Group();

        const mountain = new THREE.Mesh(
            new THREE.ConeGeometry(placement.radius, placement.height, 6),
            mountainMaterial
        );
        mountain.position.y = placement.height / 2;
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        mountain.userData.isMountain = true;
        mountainGroup.add(mountain);
        const mountainDrop = getStructureBoundaryDrop(
            0,
            sampleCircleBoundaryMinGroundHeight(
                placement.x,
                placement.z,
                placement.radius,
                MOUNTAIN_EDGE_SAMPLE_COUNT
            )
        ) + MOUNTAIN_EXTRA_SINK;

        structures.push({
            type: 'cone',
            x: placement.x,
            z: placement.z,
            y: -mountainDrop,
            radius: placement.radius,
            height: placement.height
        });

        const snowCap = new THREE.Mesh(
            new THREE.ConeGeometry(30, placement.height * 0.3, 6),
            snowMaterial
        );
        snowCap.position.y = placement.height * 0.85;
        snowCap.castShadow = true;
        snowCap.receiveShadow = true;
        snowCap.userData.isMountain = true;
        mountainGroup.add(snowCap);

        mountainGroup.position.set(placement.x, -mountainDrop, placement.z);
        mountainGroup.rotation.y = placement.rotation;
        scene.add(mountainGroup);
    }
}

function createDragonVolcano() {
    const volcanoHeight = 213;
    const outerBaseRadius = 230;
    const outerTopRadius = 65;
    const coreRadius = 48;
    const lavaHeight = volcanoHeight * 0.3;
    const platformRadius = 10;
    const platformThickness = 2.5;
    const innerWallThickness = 3;
    const innerWallSegments = 40;
    const volcanoRegion = { type: 'ring', minRadius: 1500, maxRadius: 2000 };

    const placement = findPlacementInRegion(volcanoRegion, point => ({
        x: point.x,
        z: point.z,
        footprint: makePlacementFootprint(point.x, point.z, outerBaseRadius + 40)
    }), 320, { pointDensity: 1.35 }) || (() => {
        const angle = Math.random() * Math.PI * 2;
        const distance = backgroundDist();
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const fp = makePlacementFootprint(x, z, outerBaseRadius + 40);
        reserveFootprint(fp);
        return { x, z, footprint: fp };
    })();

    const volcanoDrop = getStructureBoundaryDrop(
        0,
        sampleCircleBoundaryMinGroundHeight(
            placement.x,
            placement.z,
            outerBaseRadius,
            MOUNTAIN_EDGE_SAMPLE_COUNT
        )
    ) + MOUNTAIN_EXTRA_SINK;

    const baseY = -volcanoDrop;
    const topY = baseY + volcanoHeight;
    const platformTopY = baseY + volcanoHeight * 0.5;
    const platformBottomY = platformTopY - platformThickness;
    const lavaTopY = baseY + lavaHeight;

    const rockMaterial = new THREE.MeshLambertMaterial({ color: MOUNTAIN_BODY_COLOR, side: THREE.DoubleSide });
    const lavaMaterial = new THREE.MeshPhongMaterial({
        color: 0xff5a00,
        emissive: 0xff2200,
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.92
    });
    const lavaSurfaceMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide
    });

    const volcanoGroup = new THREE.Group();

    const outerShell = new THREE.Mesh(
        new THREE.CylinderGeometry(outerTopRadius, outerBaseRadius, volcanoHeight, 28, 1, true),
        rockMaterial
    );
    outerShell.position.y = volcanoHeight / 2;
    outerShell.castShadow = true;
    outerShell.receiveShadow = true;
    volcanoGroup.add(outerShell);

    const innerWall = new THREE.Mesh(
        new THREE.CylinderGeometry(coreRadius, coreRadius, volcanoHeight, 28, 1, true),
        rockMaterial
    );
    innerWall.position.y = volcanoHeight / 2;
    innerWall.castShadow = true;
    innerWall.receiveShadow = true;
    volcanoGroup.add(innerWall);

    const rim = new THREE.Mesh(
        new THREE.RingGeometry(coreRadius, outerTopRadius, 28),
        rockMaterial
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = volcanoHeight;
    rim.receiveShadow = true;
    volcanoGroup.add(rim);

    const craterFloor = new THREE.Mesh(
        new THREE.CircleGeometry(coreRadius * 0.98, 28),
        rockMaterial
    );
    craterFloor.rotation.x = -Math.PI / 2;
    craterFloor.position.y = 0.05;
    craterFloor.receiveShadow = true;
    volcanoGroup.add(craterFloor);

    const lavaRadius = coreRadius + 1.5;

    const lava = new THREE.Mesh(
        new THREE.CylinderGeometry(lavaRadius, lavaRadius, lavaHeight, 28),
        lavaMaterial
    );
    lava.position.y = lavaHeight / 2;
    volcanoGroup.add(lava);

    const lavaSurface = new THREE.Mesh(
        new THREE.CircleGeometry(lavaRadius * 0.99, 28),
        lavaSurfaceMaterial
    );
    lavaSurface.rotation.x = -Math.PI / 2;
    lavaSurface.position.y = lavaHeight + 0.08;
    volcanoGroup.add(lavaSurface);

    const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(platformRadius, platformRadius, platformThickness, 20),
        rockMaterial
    );
    platform.position.y = platformBottomY - baseY + platformThickness / 2;
    platform.castShadow = true;
    platform.receiveShadow = true;
    volcanoGroup.add(platform);

    const lavaLight = new THREE.PointLight(0xff5a00, 400, volcanoHeight, 1.5);
    lavaLight.position.y = lavaHeight + 10;
    volcanoGroup.add(lavaLight);

    scene.add(volcanoGroup);
    addRoofColliderCircle(
        placement.x,
        placement.z,
        platformRadius,
        platformTopY,
        platformBottomY
    );

    for (let i = 0; i < innerWallSegments; i++) {
        const angle = (i / innerWallSegments) * Math.PI * 2;
        const wallCenterRadius = coreRadius + innerWallThickness * 0.5;
        const wallArcHalfWidth = coreRadius * Math.tan(Math.PI / innerWallSegments) + 1.6;
        addSolidWallRect(
            placement.x + Math.cos(angle) * wallCenterRadius,
            placement.z + Math.sin(angle) * wallCenterRadius,
            wallArcHalfWidth,
            innerWallThickness * 0.5,
            baseY,
            topY - 0.25,
            Math.PI / 2 - angle
        );
    }

    dragonVolcano = {
        mesh: volcanoGroup,
        x: placement.x,
        z: placement.z,
        baseY,
        topY,
        height: volcanoHeight,
        outerBaseRadius,
        outerTopRadius,
        coreRadius,
        innerWallThickness,
        lavaTopY,
        platformTopY,
        platformRadius
    };

    volcanoGroup.position.set(placement.x, baseY, placement.z);
}

function findNPCSpawnPosition(region, attempts = 80) {
    for (let i = 0; i < attempts; i++) {
        const point = samplePointInRegion(region);
        if (isPointInWater(point.x, point.z)) continue;
        return point;
    }

    const fallback = samplePointInRegion(region);
    if (!isPointInWater(fallback.x, fallback.z)) {
        return { x: fallback.x, z: fallback.z };
    }

    for (let radius = 30; radius <= 240; radius += 30) {
        for (let step = 0; step < 12; step++) {
            const angle = (step / 12) * Math.PI * 2;
            const x = fallback.x + Math.cos(angle) * radius;
            const z = fallback.z + Math.sin(angle) * radius;
            if (!isPointInWater(x, z)) return { x, z };
        }
    }

    return { x: 0, z: 0 };
}
