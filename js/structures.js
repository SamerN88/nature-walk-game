function createClimbableStructures() {
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const darkRockMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });

    const wideRegion = { type: 'box', minX: -2600, maxX: 2600, minZ: -2600, maxZ: 2600 };

    for (let i = 0; i < 50; i++) {
        const placement = findPlacement(() => {
            const size = randRange(8, 23);
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 90) return null;
            return {
                x: point.x,
                z: point.z,
                size,
                rotation: randomRotationY(),
                footprint: makePlacementFootprint(point.x, point.z, size + 8)
            };
        }, 220);

        if (!placement) continue;

        const boulder = new THREE.Mesh(
            new THREE.SphereGeometry(placement.size, 8, 6),
            rockMaterial
        );
        const groundY = getGroundHeight(placement.x, placement.z);
        const radiusY = placement.size * 0.7;
        const centerY = groundY + radiusY - BOULDER_Y_SINK;
        boulder.position.set(placement.x, centerY, placement.z);
        boulder.rotation.y = placement.rotation;
        boulder.scale.y = 0.7;
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        scene.add(boulder);

        structures.push({
            type: 'sphere',
            x: placement.x,
            z: placement.z,
            centerY,
            radiusX: placement.size,
            radiusZ: placement.size,
            radiusY
        });
    }

    for (let i = 0; i < 40; i++) {
        const placement = findPlacement(() => {
            const radius = randRange(20, 60);
            const height = randRange(25, 75);
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 120) return null;
            return {
                x: point.x,
                z: point.z,
                radius,
                height,
                rotation: randomRotationY(),
                footprint: makePlacementFootprint(point.x, point.z, radius + 12)
            };
        }, 220);

        if (!placement) continue;

        const hill = new THREE.Mesh(
            new THREE.ConeGeometry(placement.radius, placement.height, 8),
            darkRockMaterial
        );
        const groundY = getGroundHeight(placement.x, placement.z);
        const hillDrop = getStructureBoundaryDrop(
            groundY,
            sampleCircleBoundaryMinGroundHeight(
                placement.x,
                placement.z,
                placement.radius,
                MOUNTAIN_EDGE_SAMPLE_COUNT
            )
        ) + MOUNTAIN_EXTRA_SINK;
        hill.position.set(placement.x, groundY + placement.height / 2 - hillDrop, placement.z);
        hill.rotation.y = placement.rotation;
        hill.castShadow = true;
        hill.receiveShadow = true;
        scene.add(hill);

        structures.push({
            type: 'cone',
            x: placement.x,
            z: placement.z,
            y: groundY - hillDrop,
            radius: placement.radius,
            height: placement.height
        });
    }

    for (let i = 0; i < 60; i++) {
        const placement = findPlacement(() => {
            const base = randRange(8, 23);
            const width = base * randRange(0.85, 1.25);
            const depth = base * randRange(0.85, 1.25);
            const height = randRange(4, 24);
            const rotation = randomRotationY();
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 100) return null;
            return {
                x: point.x,
                z: point.z,
                width,
                depth,
                height,
                rotation,
                footprint: makePlacementFootprint(point.x, point.z, getPlacementRadiusForRect(width, depth, 8))
            };
        }, 220);

        if (!placement) continue;

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(placement.width, placement.height, placement.depth),
            stoneMaterial
        );
        const groundY = getGroundHeight(placement.x, placement.z);
        const platformDrop = getStructureBoundaryDrop(
            groundY,
            sampleRectBoundaryMinGroundHeight(
                placement.x,
                placement.z,
                placement.width,
                placement.depth,
                placement.rotation,
                PRIMITIVE_BLOCK_EDGE_SAMPLE_COUNT
            )
        ) + PRIMITIVE_BLOCK_EXTRA_SINK;
        platform.position.set(placement.x, groundY + placement.height / 2 - platformDrop, placement.z);
        platform.rotation.y = placement.rotation;
        platform.castShadow = true;
        platform.receiveShadow = true;
        scene.add(platform);

        addStructureBox(
            placement.x,
            placement.z,
            groundY - platformDrop,
            placement.width,
            placement.height,
            placement.depth,
            placement.rotation
        );
    }

    for (let s = 0; s < 10; s++) {
        const placement = findPlacement(() => {
            const steps = 5 + Math.floor(Math.random() * 5);
            const rotation = randomRotationY();
            const totalRun = (steps - 1) * 6;
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 120) return null;
            return {
                x: point.x,
                z: point.z,
                steps,
                rotation,
                totalRun,
                footprint: makePlacementFootprint(
                    point.x,
                    point.z,
                    getPlacementRadiusForRect(8, totalRun + 8, 10)
                )
            };
        }, 220);

        if (!placement) continue;

        const stackGroundY = getGroundHeight(placement.x, placement.z);
        for (let i = 0; i < placement.steps; i++) {
            const localZ = -placement.totalRun / 2 + i * 6;
            const world = localToWorldXZ(placement.x, placement.z, 0, localZ, placement.rotation);
            const platform = new THREE.Mesh(
                new THREE.BoxGeometry(8, 3, 8),
                stoneMaterial
            );
            platform.position.set(world.x, stackGroundY + 1.5 + i * 3 - STAIRCASE_Y_SINK, world.z);
            platform.rotation.y = placement.rotation;
            platform.castShadow = true;
            platform.receiveShadow = true;
            scene.add(platform);

            addStructureBox(world.x, world.z, stackGroundY + i * 3 - STAIRCASE_Y_SINK, 8, 3, 8, placement.rotation);
        }
    }

    for (let i = 0; i < 30; i++) {
        const placement = findPlacement(() => {
            const length = randRange(15, 35);
            const height = randRange(8, 23);
            const width = randRange(5, 10);
            const rotation = randomRotationY();
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 100) return null;
            return {
                x: point.x,
                z: point.z,
                length,
                height,
                width,
                rotation,
                footprint: makePlacementFootprint(point.x, point.z, getPlacementRadiusForRect(width, length, 8))
            };
        }, 220);

        if (!placement) continue;

        const rampGeom = new THREE.BoxGeometry(placement.width, 1, placement.length);
        const ramp = new THREE.Mesh(rampGeom, stoneMaterial);
        const groundY = getGroundHeight(placement.x, placement.z);
        ramp.position.set(placement.x, groundY + placement.height / 2, placement.z);
        ramp.rotation.x = Math.atan2(placement.height, placement.length);
        ramp.rotation.y = placement.rotation;
        ramp.castShadow = true;
        ramp.receiveShadow = true;
        scene.add(ramp);

        structures.push({
            type: 'ramp',
            x: placement.x,
            z: placement.z,
            y: groundY,
            length: placement.length,
            height: placement.height,
            width: placement.width,
            rotation: placement.rotation
        });
    }

    for (let a = 0; a < 8; a++) {
        const placement = findPlacement(() => {
            const archHeight = randRange(20, 40);
            const rotation = randomRotationY();
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 120) return null;
            return {
                x: point.x,
                z: point.z,
                archHeight,
                rotation,
                footprint: makePlacementFootprint(point.x, point.z, getPlacementRadiusForRect(15, 6, 8))
            };
        }, 220);

        if (!placement) continue;

        const archGroundY = getGroundHeight(placement.x, placement.z);
        const archGroup = new THREE.Group();
        const archParts = [
            { localX: -6, localY: 0, localZ: 0, width: 3, height: placement.archHeight, depth: 3 },
            { localX: 6, localY: 0, localZ: 0, width: 3, height: placement.archHeight, depth: 3 },
            { localX: 0, localY: placement.archHeight, localZ: 0, width: 15, height: 3, depth: 4 }
        ];
        const archPartMeshes = addRigidBoxStructureParts(
            archGroup,
            stoneMaterial,
            archParts
        );

        archGroup.position.set(placement.x, archGroundY - PORTAL_FRAME_Y_SINK, placement.z);
        archGroup.rotation.y = placement.rotation;
        scene.add(archGroup);
        archGroup.updateMatrixWorld(true);
        registerRigidBoxStructureParts(archPartMeshes);
    }

    for (let t = 0; t < 15; t++) {
        const placement = findPlacement(() => {
            const towerHeight = randRange(30, 80);
            const rotation = randomRotationY();
            const point = samplePointInRegion(wideRegion);
            if (Math.hypot(point.x, point.z) < 130) return null;
            return {
                x: point.x,
                z: point.z,
                towerHeight,
                rotation,
                footprint: makePlacementFootprint(point.x, point.z, 18)
            };
        }, 220);

        if (!placement) continue;

        const towerGroundY = getGroundHeight(placement.x, placement.z);
        const towerGroup = new THREE.Group();

        const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(6, 8, placement.towerHeight, 8),
            stoneMaterial
        );
        tower.position.y = placement.towerHeight / 2;
        tower.castShadow = true;
        towerGroup.add(tower);
        structures.push({ type: 'cylinder', x: placement.x, z: placement.z, y: towerGroundY - TOWER_Y_SINK, radius: 8, height: placement.towerHeight });

        const towerTop = new THREE.Mesh(
            new THREE.CylinderGeometry(10, 10, 2, 8),
            darkRockMaterial
        );
        towerTop.position.y = placement.towerHeight + 1;
        towerTop.castShadow = true;
        towerGroup.add(towerTop);
        structures.push({ type: 'cylinder', x: placement.x, z: placement.z, y: towerGroundY + placement.towerHeight - TOWER_Y_SINK, radius: 10, height: 2 });

        towerGroup.position.set(placement.x, towerGroundY - TOWER_Y_SINK, placement.z);
        towerGroup.rotation.y = placement.rotation;
        scene.add(towerGroup);
    }
}

function getStructureHeight(x, z, playerY = undefined) {
    let maxHeight = -Infinity;

    for (const s of structures) {
        let height = -Infinity;

        if (s.type === 'box') {
            const local = worldToLocalXZ(x, z, s.x, s.z, s.rotation || 0);
            if (Math.abs(local.x) <= s.width / 2 &&
                Math.abs(local.z) <= s.depth / 2) {
                if (s.skipSupportHeight) {
                    height = -Infinity;
                } else {
                    // minPlayerY: only apply this platform if player is already near its level.
                    // Prevents multi-story buildings from snapping the player to upper floors on entry.
                    if (s.minPlayerY !== undefined && playerY !== undefined && playerY < s.minPlayerY) {
                        height = -Infinity;
                    } else {
                        height = s.y + s.height;
                    }
                }
            }
        } else if (s.type === 'sphere') {
            const dx = x - s.x;
            const dz = z - s.z;
            const radiusX = s.radiusX ?? s.radius;
            const radiusZ = s.radiusZ ?? s.radius;
            const radiusY = s.radiusY ?? ((s.height ?? (s.radius * 2)) * 0.5);
            const centerY = s.centerY ?? (s.y + radiusY);
            const norm = (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ);
            if (norm < 1) {
                // Ellipsoid surface height
                height = centerY + radiusY * Math.sqrt(1 - norm);
            }
        } else if (s.type === 'cone') {
            const dx = x - s.x;
            const dz = z - s.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < s.radius) {
                // Cone surface - height decreases linearly from center
                height = s.y + s.height * (1 - dist / s.radius);
            }
        } else if (s.type === 'cylinder') {
            const dx = x - s.x;
            const dz = z - s.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < s.radius) {
                height = s.y + s.height;
            }
        } else if (s.type === 'ramp') {
            const local = worldToLocalXZ(x, z, s.x, s.z, s.rotation || 0);
            const localX = local.x;
            const localZ = local.z;

            if (Math.abs(localX) < s.width / 2 && Math.abs(localZ) < s.length / 2) {
                const progress = (localZ + s.length / 2) / s.length;
                height = s.y + progress * s.height;
            }
        }

        if (height > maxHeight) {
            maxHeight = height;
        }
    }

    const volcanoHeight = getDragonVolcanoShellHeight(x, z);
    if (volcanoHeight > maxHeight) {
        maxHeight = volcanoHeight;
    }

    return maxHeight;
}

function rayIntersectAABB(origin, dir, min, max, maxDistance = Infinity) {
    let tMin = -Infinity;
    let tMax = Infinity;

    const axes = ['x', 'y', 'z'];
    for (const axis of axes) {
        const o = origin[axis];
        const d = dir[axis];
        const mn = min[axis];
        const mx = max[axis];

        if (Math.abs(d) < 1e-8) {
            if (o < mn || o > mx) return Infinity;
            continue;
        }

        let t1 = (mn - o) / d;
        let t2 = (mx - o) / d;
        if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
        }

        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return Infinity;
    }

    if (tMax < 0) return Infinity;
    const hitT = tMin >= 0 ? tMin : tMax;
    if (hitT < 0 || hitT > maxDistance) return Infinity;
    return hitT;
}

function getStructureAABB(s, outMin, outMax) {
    if (s.type === 'box') {
        const extents = getRotatedHalfExtents(s.width / 2, s.depth / 2, s.rotation || 0);
        outMin.set(s.x - extents.x, s.y, s.z - extents.z);
        outMax.set(s.x + extents.x, s.y + s.height, s.z + extents.z);
        return true;
    }

    if (s.type === 'sphere') {
        const rx = s.radiusX ?? s.radius;
        const rz = s.radiusZ ?? s.radius;
        const ry = s.radiusY ?? ((s.height ?? (s.radius * 2)) * 0.5);
        const cy = s.centerY ?? (s.y + ry);
        outMin.set(s.x - rx, cy - ry, s.z - rz);
        outMax.set(s.x + rx, cy + ry, s.z + rz);
        return true;
    }

    if (s.type === 'cone') {
        outMin.set(s.x - s.radius, s.y, s.z - s.radius);
        outMax.set(s.x + s.radius, s.y + s.height, s.z + s.radius);
        return true;
    }

    if (s.type === 'cylinder') {
        outMin.set(s.x - s.radius, s.y, s.z - s.radius);
        outMax.set(s.x + s.radius, s.y + s.height, s.z + s.radius);
        return true;
    }

    if (s.type === 'ramp') {
        const hw = s.width / 2;
        const hl = s.length / 2;
        const c = Math.cos(s.rotation);
        const si = Math.sin(s.rotation);
        const ex = Math.abs(c) * hw + Math.abs(si) * hl;
        const ez = Math.abs(si) * hw + Math.abs(c) * hl;
        outMin.set(s.x - ex, s.y, s.z - ez);
        outMax.set(s.x + ex, s.y + s.height, s.z + ez);
        return true;
    }

    return false;
}

function getBulletStructureBlockDistance(origin, dir, maxRange) {
    let nearest = maxRange;
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();

    for (const s of structures) {
        if (s.bulletPass) continue;
        if (!getStructureAABB(s, min, max)) continue;
        const hitT = rayIntersectAABB(origin, dir, min, max, nearest);
        if (hitT < nearest) nearest = hitT;
    }

    for (const wall of solidWalls) {
        if (wall.bulletPass) continue;
        const wallMinY = wall.minY ?? -10000;
        const wallMaxY = wall.maxY ?? 10000;
        const extents = getRotatedHalfExtents(wall.halfW, wall.halfD, wall.rotation || 0);
        min.set(wall.x - extents.x, wallMinY, wall.z - extents.z);
        max.set(wall.x + extents.x, wallMaxY, wall.z + extents.z);
        const hitT = rayIntersectAABB(origin, dir, min, max, nearest);
        if (hitT < nearest) nearest = hitT;
    }

    return nearest;
}

function createEnterableStructures() {
    const woodMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const tentMaterial = new THREE.MeshLambertMaterial({ color: 0xD2691E, side: THREE.DoubleSide });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x3d3d3d });
    const chestWoodMaterial = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const chestMetalMaterial = new THREE.MeshLambertMaterial({ color: 0xbb9955 });

    const addHouseTable = (house, placement, groundY) => {
        const table = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.3, 2),
            woodMaterial
        );
        table.position.set(0, 2, -2);
        house.add(table);

        [[-1, -0.5], [-1, 0.5], [1, -0.5], [1, 0.5]].forEach(legPos => {
            const leg = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 1.7, 0.2),
                woodMaterial
            );
            leg.position.set(legPos[0], 1, -2 + legPos[1]);
            house.add(leg);
        });

        const tableWorld = localToWorldXZ(placement.x, placement.z, 0, -2, placement.rotation);
        // Treat house tables like simple climbable primitives: tabletop only, no separate wall blocker.
        addStructureBox(
            tableWorld.x,
            tableWorld.z,
            groundY + 1.85,
            3,
            0.3,
            2,
            placement.rotation
        );
    };

    const addHouseChest = (house, placement, groundY) => {
        const chest = new THREE.Group();
        const chestW = 3.2;
        const chestD = 2.0;
        const chestBaseH = 1.0;
        const chestLidH = 0.85;
        const chestLocalZ = -1.85;

        const chestBase = new THREE.Mesh(
            new THREE.BoxGeometry(chestW, chestBaseH, chestD),
            chestWoodMaterial
        );
        chestBase.position.y = chestBaseH / 2;
        chest.add(chestBase);

        const trim = new THREE.Mesh(
            new THREE.BoxGeometry(chestW * 1.02, 0.14, chestD * 1.02),
            chestMetalMaterial
        );
        trim.position.y = chestBaseH - 0.02;
        chest.add(trim);

        const lidPivot = new THREE.Group();
        lidPivot.position.set(0, chestBaseH, -chestD / 2 + 0.12);

        const lid = new THREE.Mesh(
            new THREE.BoxGeometry(chestW * 0.96, chestLidH, chestD - 0.08),
            chestWoodMaterial
        );
        lid.position.set(0, chestLidH / 2, chestD / 2 - 0.12);
        lidPivot.add(lid);

        const latch = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.22, 0.12),
            chestMetalMaterial
        );
        latch.position.set(0, chestLidH * 0.35, chestD - 0.2);
        lidPivot.add(latch);

        chest.add(lidPivot);
        chest.position.set(0, 0, chestLocalZ);
        house.add(chest);

        const chestAk47Model = createAK47Mesh(0.92);
        akChestGun = chestAk47Model.mesh;
        akChestGun.position.set(0.15, chestBaseH + 0.08, 0.02);
        akChestGun.rotation.set(0, -Math.PI / 2, Math.PI / 2);
        akChestGun.visible = false;
        chest.add(akChestGun);

        const chestWorld = localToWorldXZ(placement.x, placement.z, 0, chestLocalZ, placement.rotation);
        akChest = {
            mesh: chest,
            lidPivot: lidPivot,
            gunMesh: akChestGun,
            opened: false,
            collected: false,
            worldX: chestWorld.x,
            worldY: groundY + chestBaseH,
            worldZ: chestWorld.z,
            halfW: chestW / 2,
            halfD: chestD / 2
        };

        addStructureBox(
            chestWorld.x,
            chestWorld.z,
            groundY,
            chestW,
            chestBaseH + 0.12,
            chestD,
            placement.rotation
        );
    };

    const houseRegions = [
        { type: 'box', minX: -10,  maxX: 130, minZ: -160, maxZ: -20 },
        { type: 'box', minX: -190, maxX: -20, minZ: -20,  maxZ: 130 },
        { type: 'box', minX: 70,   maxX: 250, minZ: 70,   maxZ: 250 },
        { type: 'box', minX: -320, maxX: -90, minZ: -260, maxZ: -70 },
        { type: 'box', minX: 200,  maxX: 420, minZ: -150, maxZ: 40 },
    ];
    const housePlacements = houseRegions
        .map(region => findPlacementInRegion(region, (point, rotation) => ({
            x: point.x,
            z: point.z,
            rotation: rotation ?? randomRotationY(),
            footprint: { ...makePlacementFootprint(point.x, point.z, 15), noTree: true }
        }), 240, { rotationCount: 12, pointDensity: 1.1 }))
        .filter(Boolean);
    const chestHouseIndex = housePlacements.length > 0
        ? Math.floor(Math.random() * housePlacements.length)
        : -1;

    housePlacements.forEach((placement, houseIndex) => {
        const groundY = getGroundHeight(placement.x, placement.z);
        const house = new THREE.Group();
        const houseColliderMarkers = [];

        // Floor
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(12, 0.5, 10),
            floorMaterial
        );
        floor.position.y = 0.25;
        floor.userData.ignoreCameraOcclusion = true;
        house.add(floor);

        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(12, 8, 0.5),
            woodMaterial
        );
        backWall.position.set(0, 4, -4.75);
        house.add(backWall);

        // Left wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 8, 10),
            woodMaterial
        );
        leftWall.position.set(-5.75, 4, 0);
        house.add(leftWall);

        // Right wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 8, 10),
            woodMaterial
        );
        rightWall.position.set(5.75, 4, 0);
        house.add(rightWall);

        // Front wall left
        const frontLeft = new THREE.Mesh(
            new THREE.BoxGeometry(4, 8, 0.5),
            woodMaterial
        );
        frontLeft.position.set(-4, 4, 4.75);
        house.add(frontLeft);

        // Front wall right
        const frontRight = new THREE.Mesh(
            new THREE.BoxGeometry(4, 8, 0.5),
            woodMaterial
        );
        frontRight.position.set(4, 4, 4.75);
        house.add(frontRight);

        // Front top (above door)
        const frontTop = new THREE.Mesh(
            new THREE.BoxGeometry(4, 2, 0.5),
            woodMaterial
        );
        frontTop.position.set(0, 7, 4.75);
        house.add(frontTop);

        // Roof
        const roofGeom = new THREE.BoxGeometry(14, 1, 12);
        const roof = new THREE.Mesh(roofGeom, roofMaterial);
        roof.position.y = 8.5;
        house.add(roof);

        // Peaked roof
        const peakGeom = new THREE.CylinderGeometry(0, 8, 4, 4);
        const peak = new THREE.Mesh(peakGeom, roofMaterial);
        peak.position.y = 10.5;
        peak.rotation.y = Math.PI / 4;
        house.add(peak);

        if (houseIndex === chestHouseIndex) addHouseChest(house, placement, groundY);
        else addHouseTable(house, placement, groundY);

        // Door — hinge on left side of doorway (x=-2 in house local space)
        const doorPivot = new THREE.Group();
        doorPivot.position.set(-2, 0, 4.75);
        house.add(doorPivot);
        const doorWoodMat = new THREE.MeshLambertMaterial({ color: 0x6B3A1F });
        const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(3.9, 5.9, 0.32), doorWoodMat);
        doorPanel.position.set(2, 2.95, 0);
        doorPanel.receiveShadow = true;
        doorPivot.add(doorPanel);
        // Raised panels and hardware on the OUTSIDE face (+z in doorPivot space = exterior)
        const dUpperPan = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 0.07), doorWoodMat);
        dUpperPan.position.set(2, 4.4, 0.14);
        doorPivot.add(dUpperPan);
        const dLowerPan = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 0.07), doorWoodMat);
        dLowerPan.position.set(2, 1.4, 0.14);
        doorPivot.add(dLowerPan);
        const dKnobMat = new THREE.MeshLambertMaterial({ color: 0xC8A830 });
        const dKnob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), dKnobMat);
        dKnob.position.set(3.55, 2.95, 0.22);
        doorPivot.add(dKnob);
        [1.0, 4.8].forEach(hy => {
            const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.06), dKnobMat);
            hinge.position.set(0.18, hy, 0.2);
            doorPivot.add(hinge);
        });

        houseColliderMarkers.push(
            createColliderMarker(house, 'solidWall', { localX: 0, localY: 4, localZ: -4.75, halfW: 6.0, halfD: 0.25, height: 8, extra: { isEnclosed: true } }),
            createColliderMarker(house, 'solidWall', { localX: -5.75, localY: 4, localZ: 0, halfW: 0.25, halfD: 5.0, height: 8, extra: { isEnclosed: true } }),
            createColliderMarker(house, 'solidWall', { localX: 5.75, localY: 4, localZ: 0, halfW: 0.25, halfD: 5.0, height: 8, extra: { isEnclosed: true } }),
            createColliderMarker(house, 'solidWall', { localX: -4, localY: 4, localZ: 4.75, halfW: 2.0, halfD: 0.25, height: 8, extra: { isEnclosed: true } }),
            createColliderMarker(house, 'solidWall', { localX: 4, localY: 4, localZ: 4.75, halfW: 2.0, halfD: 0.25, height: 8, extra: { isEnclosed: true } }),
            createColliderMarker(house, 'solidWall', { localX: 0, localY: 7, localZ: 4.75, halfW: 2.0, halfD: 0.25, height: 2, extra: { isEnclosed: true } }),
            createColliderMarker(house, 'structureBox', { localX: 0, localY: 0.25, localZ: 0, width: 12, height: 0.5, depth: 10 }),
            createColliderMarker(house, 'ceilingRect', { localX: 0, localY: 8, localZ: 0, halfW: 6.0, halfD: 5.0 }),
            createColliderMarker(house, 'roofCollider', { localX: 0, localY: 8.5, localZ: 0, halfW: 7.0, halfD: 6.0, thickness: 1.0 }),
            createColliderMarker(house, 'enclosedBound', { localX: 0, localY: 0, localZ: 0, halfW: 8, halfD: 7 })
        );

        house.position.set(placement.x, groundY, placement.z);
        house.rotation.y = placement.rotation;
        scene.add(house);
        house.updateMatrixWorld(true);
        registerColliderMarkers(houseColliderMarkers);

        // Register the doorway as a toggleable solid wall collider (disabled when door opens)
        const doorOpeningWorld = localToWorldXZ(placement.x, placement.z, 0, 4.75, placement.rotation);
        const doorWallEntry = addSolidWallRect(
            doorOpeningWorld.x, doorOpeningWorld.z,
            2.0, 0.25,
            groundY, groundY + 6,
            placement.rotation,
            { isEnclosed: true }
        );
        const doorData = { pivot: doorPivot, mesh: doorPanel, wallEntry: doorWallEntry, isOpen: false, angle: 0, targetAngle: 0 };
        houseDoors.push(doorData);
        creatureHouseRegions.push({
            x: placement.x,
            z: placement.z,
            halfW: 6.0,
            halfD: 5.0,
            rotation: placement.rotation,
            barrierTopY: groundY + 9,
            door: doorData,
            doorwayX: doorOpeningWorld.x,
            doorwayZ: doorOpeningWorld.z,
            doorwayHalfW: 2.25,
            doorwayHalfD: 1.4,
        });
    });

    const caveRegions = [
        { type: 'box', minX: -250, maxX: -70, minZ: -180, maxZ: -20 },
        { type: 'box', minX: 110,  maxX: 300, minZ: 20,   maxZ: 190 },
        { type: 'box', minX: -420, maxX: -190, minZ: 120, maxZ: 290 },
        // Index 3: secret cave with writing, far out near the background mountains
        { type: 'ring', minRadius: 800, maxRadius: 1100 },
    ];
    const volcanoNoteCandidates = [];
    let caveIdx = 0;
    caveRegions.forEach(region => {
        const isWritingCave = caveIdx === 3;
        const canHostVolcanoNote = !isWritingCave;
        caveIdx++;

        const placement = findPlacementInRegion(region, (point, rotation) => {
            const resolvedRotation = rotation ?? randomRotationY();
            const footprintCenter = localToWorldXZ(point.x, point.z, 0, -6, resolvedRotation);
            return {
                x: point.x,
                z: point.z,
                rotation: resolvedRotation,
                footprint: { ...makePlacementFootprint(footprintCenter.x, footprintCenter.z, 20), noTree: true }
            };
        }, 260, { rotationCount: 12, pointDensity: isWritingCave ? 1.2 : 1.05 });

        if (!placement) return;

        // Sample terrain at a grid of points across the cave footprint and use
        // the maximum so the cave floor never sinks below the terrain on slopes.
        const caveSamplePts = [
            [0, 0], [0, -6], [0, -12],
            [-8, 0], [-8, -6], [-8, -12],
            [ 8, 0], [ 8, -6], [ 8, -12],
            [-10, -6], [10, -6],
            [2.5, -10],  // note position (cW/2-1.5, -(cD-2)) — ensures groundY >= terrain there
        ];
        const groundY = caveSamplePts.reduce((maxY, [lx, lz]) => {
            const wp = localToWorldXZ(placement.x, placement.z, lx, lz, placement.rotation);
            return Math.max(maxY, getGroundHeight(wp.x, wp.z));
        }, getGroundHeight(placement.x, placement.z));
        const cave = new THREE.Group();
        const caveColliderMarkers = [];

        const cW = 8;
        const cD = 12;
        const cH = 9;
        const wT = 2;
        const roofThickness = 1.0;
        const leanAmount = 0.3;

        const caveStoneMat = new THREE.MeshLambertMaterial({ color: 0x666666, side: THREE.DoubleSide });
        const interiorMat = new THREE.MeshLambertMaterial({ color: 0x232323, side: THREE.DoubleSide });
        const leanInset = Math.tan(leanAmount) * cH;

        function createWallPrism(points, material) {
            const positions = [];
            const tri = (a, b, c) => {
                positions.push(...points[a], ...points[b], ...points[c]);
            };

            tri(0, 1, 5); tri(0, 5, 4);
            tri(2, 6, 7); tri(2, 7, 3);
            tri(0, 4, 6); tri(0, 6, 2);
            tri(1, 3, 7); tri(1, 7, 5);
            tri(4, 5, 7); tri(4, 7, 6);
            tri(0, 2, 3); tri(0, 3, 1);

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geom.computeVertexNormals();
            const wall = new THREE.Mesh(geom, material);
            wall.receiveShadow = true;
            return wall;
        }

        cave.add(createWallPrism([
            [-cW, 0, 0], [-cW - wT, 0, 0], [-cW, 0, -cD], [-cW - wT, 0, -cD],
            [-cW + leanInset, cH, 0], [-cW - wT + leanInset, cH, 0],
            [-cW + leanInset, cH, -cD + leanInset], [-cW - wT + leanInset, cH, -cD + leanInset]
        ], caveStoneMat));

        cave.add(createWallPrism([
            [cW, 0, 0], [cW + wT, 0, 0], [cW, 0, -cD], [cW + wT, 0, -cD],
            [cW - leanInset, cH, 0], [cW + wT - leanInset, cH, 0],
            [cW - leanInset, cH, -cD + leanInset], [cW + wT - leanInset, cH, -cD + leanInset]
        ], caveStoneMat));

        cave.add(createWallPrism([
            [-cW - wT, 0, -cD - wT], [cW + wT, 0, -cD - wT], [-cW - wT, 0, -cD], [cW + wT, 0, -cD],
            [-cW - wT + leanInset, cH, -cD - wT + leanInset], [cW + wT - leanInset, cH, -cD - wT + leanInset],
            [-cW - wT + leanInset, cH, -cD + leanInset], [cW + wT - leanInset, cH, -cD + leanInset]
        ], caveStoneMat));

        const roofTopOuterW = 2 * (cW + wT - leanInset);
        const roofTopOuterD = cD + wT - leanInset;
        const caveRoof = new THREE.Mesh(
            new THREE.BoxGeometry(roofTopOuterW, roofThickness, roofTopOuterD),
            caveStoneMat
        );
        caveRoof.position.set(0, cH - roofThickness / 2, (-cD - wT + leanInset) / 2);
        cave.add(caveRoof);

        const ceilingInnerW = 2 * (cW - leanInset);
        const ceilingInnerD = cD - leanInset;
        const caveCeiling = new THREE.Mesh(
            new THREE.PlaneGeometry(ceilingInnerW, ceilingInnerD),
            interiorMat
        );
        caveCeiling.rotation.x = Math.PI / 2;
        caveCeiling.position.set(0, cH - 0.03, (-cD + leanInset) / 2);
        caveCeiling.receiveShadow = true;
        cave.add(caveCeiling);

        const caveFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(cW * 2, cD),
            floorMaterial
        );
        caveFloor.rotation.x = -Math.PI / 2;
        caveFloor.position.set(0, 0.1, -cD / 2);
        caveFloor.receiveShadow = true;
        caveFloor.userData.ignoreCameraOcclusion = true;
        cave.add(caveFloor);

        // Gap-filling slab: sits flush under the cave (top at y=0) and extends
        // 5 units down into the terrain so no gap shows on uneven ground.
        const slabThickness = 5;
        const slabW = (cW + wT) * 2;   // matches outer wall width: 20
        const slabD = cD + wT;          // matches outer wall depth: 14
        const caveSlab = new THREE.Mesh(
            new THREE.BoxGeometry(slabW, slabThickness, slabD),
            caveStoneMat
        );
        caveSlab.position.set(0, -slabThickness / 2, -(cD + wT) / 2);
        cave.add(caveSlab);

        const fireZ = -cD / 2;
        const noteLocalX = cW / 2 - 1.5;   // local position of the volcano-hint note
        const noteLocalZ = -(cD - 2);
        for (let r = 0; r < 5; r++) {
            let rx, rz;
            do {
                rx = (Math.random() - 0.5) * (cW * 2 - 2);
                rz = -(Math.random() * (cD - 2) + 1);
            } while (
                Math.hypot(rx, rz - fireZ) < 2.2 ||
                (canHostVolcanoNote && Math.hypot(rx - noteLocalX, rz - noteLocalZ) < 2.5)
            );

            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.5 + Math.random() * 1, 0),
                stoneMaterial
            );
            rock.position.set(rx, 0.5, rz);
            rock.castShadow = true;
            rock.receiveShadow = true;
            cave.add(rock);
        }

        const firePos = new THREE.Vector3(0, 0.2, -cD / 2);
        const logMat = new THREE.MeshLambertMaterial({ color: 0x5C3317 });
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xFF4400 });
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.85 });
        const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xFFDD00, transparent: true, opacity: 0.7 });

        for (let li = 0; li < 4; li++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 6), logMat);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = (li / 4) * Math.PI;
            log.position.copy(firePos);
            cave.add(log);
        }

        const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 10), emberMat);
        embers.position.copy(firePos);
        cave.add(embers);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 8), flameMat);
        flame.position.set(firePos.x, firePos.y + 0.85, firePos.z);
        flame.castShadow = false;
        flame.receiveShadow = false;
        cave.add(flame);

        const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), innerFlameMat);
        flameCore.position.set(firePos.x, firePos.y + 1.05, firePos.z);
        flameCore.castShadow = false;
        flameCore.receiveShadow = false;
        cave.add(flameCore);

        const fireLight = new THREE.PointLight(0xFF6600, 12, 120);
        fireLight.position.set(firePos.x, firePos.y + 1, firePos.z);
        // fireLight.castShadow = true; // DEBUG SHADOW - decided to disable for performance reasons
        fireLight.userData.baseIntensity    = 12;
        fireLight.userData.currentIntensity = 12;
        fireLight.userData.targetIntensity  = 12;
        fireLight.userData.baseDistance     = 120;
        fireLight.userData.currentDistance  = 120;
        fireLight.userData.targetDistance   = 120;
        fireLight.userData.flickerTimer     = 0;
        cave.add(fireLight);
        campfireLights.push(fireLight);

        if (isWritingCave) {
            const writingImg = new Image();
            writingImg.onload = () => {
                const tex = new THREE.Texture(writingImg);
                tex.needsUpdate = true;
                const writingMat = new THREE.MeshBasicMaterial({
                    map: tex,
                    transparent: true,
                    alphaTest: 0.05,
                    color: 0x6e6e6e,  // OG color: 0xCC8844
                    depthWrite: false,
                    side: THREE.DoubleSide,
                });
                const writingMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), writingMat);
                writingMesh.rotation.x = leanAmount;
                writingMesh.position.set(0, cH * 0.45, -cD + cH * 0.45 * Math.tan(leanAmount) + 0.12);
                cave.add(writingMesh);
            };
            writingImg.src = IMAGE_CAVE_WRITING;
        }

        cave.position.set(placement.x, groundY, placement.z);
        cave.rotation.y = placement.rotation;
        scene.add(cave);

        if (isWritingCave && DEBUG_CAVE_WRITING) {
            const beaconHeight = 500;
            const hoverGap = 30;
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
            beacon.position.set(
                placement.x,
                groundY + cH + hoverGap + beaconHeight / 2,
                placement.z - cD / 2
            );
            beacon.renderOrder = 930;
            beacon.userData.ignoreCameraOcclusion = true;
            scene.add(beacon);
        }

        const caveWallColliderHeight = cH - 0.1;
        caveColliderMarkers.push(
            createColliderMarker(cave, 'solidWall', { localX: -cW - wT / 2, localY: caveWallColliderHeight / 2, localZ: -cD / 2, halfW: wT / 2, halfD: cD / 2, height: caveWallColliderHeight, extra: { isEnclosed: true } }),
            createColliderMarker(cave, 'solidWall', { localX: cW + wT / 2, localY: caveWallColliderHeight / 2, localZ: -cD / 2, halfW: wT / 2, halfD: cD / 2, height: caveWallColliderHeight, extra: { isEnclosed: true } }),
            createColliderMarker(cave, 'solidWall', { localX: 0, localY: caveWallColliderHeight / 2, localZ: -cD - wT / 2, halfW: cW + wT, halfD: wT / 2, height: caveWallColliderHeight, extra: { isEnclosed: true } }),
            createColliderMarker(cave, 'structureBox', { localX: 0, localY: 0.1, localZ: -cD / 2, width: cW * 2, height: 0.2, depth: cD }),
            createColliderMarker(cave, 'ceilingRect', { localX: 0, localY: cH - roofThickness, localZ: -cD / 2, halfW: cW, halfD: cD / 2 }),
            createColliderMarker(cave, 'roofCollider', { localX: 0, localY: cH - roofThickness / 2, localZ: -(cD + wT) / 2, halfW: cW + wT, halfD: (cD + wT) / 2, thickness: roofThickness }),
            createColliderMarker(cave, 'enclosedBound', { localX: 0, localY: 0, localZ: -cD / 2, halfW: cW + wT + 2, halfD: cD / 2 + wT + 1 })
        );
        cave.updateMatrixWorld(true);
        registerColliderMarkers(caveColliderMarkers);
        const caveEntryWorld = localToWorldXZ(placement.x, placement.z, 0, 0, placement.rotation);
        creatureCaveRegions.push({
            x: placement.x,
            z: placement.z,
            halfW: cW,
            halfD: cD / 2,
            outerHalfW: cW + wT,
            outerHalfD: (cD + wT) / 2,
            rotation: placement.rotation,
            centerLocalZ: -cD / 2,
            outerCenterLocalZ: -(cD + wT) / 2,
            barrierTopY: groundY + cH,
            entryX: caveEntryWorld.x,
            entryZ: caveEntryWorld.z,
            entryHalfW: cW + 0.75,
            entryHalfD: 1.4,
        });

        if (canHostVolcanoNote) {
            volcanoNoteCandidates.push({
                x: placement.x,
                z: placement.z,
                rotation: placement.rotation,
                groundY,
                caveHeight: cH,
                caveWidth: cW,
                caveDepth: cD
            });
        }

        const fireWorld = localToWorldXZ(placement.x, placement.z, 0, -cD / 2, placement.rotation);
        campfirePositions.push(new THREE.Vector3(fireWorld.x, groundY + 0.2, fireWorld.z));
    });

    if (volcanoNoteCandidates.length > 0) {
        const chosenCandidate = volcanoNoteCandidates[Math.floor(Math.random() * volcanoNoteCandidates.length)];
        const noteWorld = localToWorldXZ(
            chosenCandidate.x,
            chosenCandidate.z,
            chosenCandidate.caveWidth / 2 - 1.5,
            -(chosenCandidate.caveDepth - 2),
            chosenCandidate.rotation
        );

        spawnVolcanoNote(noteWorld.x, chosenCandidate.groundY + 0.14, noteWorld.z, 0.65 + chosenCandidate.rotation, null);

        if (DEBUG_VOLCANO_HINT) {
            const beaconHeight = 500;
            const hoverGap = 30;
            const beacon = new THREE.Mesh(
                new THREE.CylinderGeometry(8, 8, beaconHeight, 18, 1, true),
                new THREE.MeshBasicMaterial({
                    color: 0x00ff44,
                    transparent: true,
                    opacity: 0.65,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            beacon.position.set(
                noteWorld.x,
                chosenCandidate.groundY + chosenCandidate.caveHeight + hoverGap + beaconHeight / 2,
                noteWorld.z
            );
            beacon.renderOrder = 930;
            beacon.userData.ignoreCameraOcclusion = true;
            scene.add(beacon);
        }
    }

    const tentRegions = [
        { type: 'box', minX: 20,   maxX: 140, minZ: -20,  maxZ: 90 },
        { type: 'box', minX: -150, maxX: -20, minZ: -90,  maxZ: 40 },
        { type: 'box', minX: -90,  maxX: 90,  minZ: 120,  maxZ: 290 },
        { type: 'box', minX: -340, maxX: -150, minZ: -80, maxZ: 80 },
        { type: 'box', minX: 100,  maxX: 260, minZ: -260, maxZ: -90 },
    ];

    const builtTentGroups = [];

    tentRegions.forEach(region => {
        const placement = findPlacementInRegion(region, (point, rotation) => {
            const resolvedRotation = rotation ?? randomRotationY();
            return {
                x: point.x,
                z: point.z,
                rotation: resolvedRotation,
                footprint: { ...makePlacementFootprint(point.x, point.z, 11), noTree: true }
            };
        }, 220, { rotationCount: 12, pointDensity: 1.05 });

        if (!placement) return;

        const groundY = getGroundHeight(placement.x, placement.z);
        const tent = new THREE.Group();
        const tentColliderMarkers = [];

        // Tent fabric - 3 sided pyramid (south/+Z face is open entrance)
        // Corners at NE(4.24,0,4.24), NW(-4.24,0,4.24), SW(-4.24,0,-4.24), SE(4.24,0,-4.24), Apex(0,7,0)
        const cr = 4.24;
        const tentVerts = new Float32Array([
            // East face: apex, SE, NE
            0, 7, 0,   cr, 0, -cr,  cr, 0, cr,
            // West face: apex, NW, SW
            0, 7, 0,  -cr, 0, cr,  -cr, 0, -cr,
            // North face (back): apex, SW, SE
            0, 7, 0,  -cr, 0, -cr,  cr, 0, -cr,
        ]);
        const tentGeomCustom = new THREE.BufferGeometry();
        tentGeomCustom.setAttribute('position', new THREE.BufferAttribute(tentVerts, 3));
        tentGeomCustom.computeVertexNormals();
        const tentMesh = new THREE.Mesh(tentGeomCustom, tentMaterial);
        tent.add(tentMesh);

        // Interior backside
        const tentVertsBack = new Float32Array([
            0, 7, 0,   cr, 0, cr,  cr, 0, -cr,
            0, 7, 0,  -cr, 0, -cr, -cr, 0, cr,
            0, 7, 0,   cr, 0, -cr, -cr, 0, -cr,
        ]);
        const tentGeomBack = new THREE.BufferGeometry();
        tentGeomBack.setAttribute('position', new THREE.BufferAttribute(tentVertsBack, 3));
        tentGeomBack.computeVertexNormals();
        const interiorMesh = new THREE.Mesh(tentGeomBack, new THREE.MeshLambertMaterial({ color: 0xD2B48C, side: THREE.DoubleSide }));
        tent.add(interiorMesh);

        // Tent floor
        const tentFloor = new THREE.Mesh(
            new THREE.CircleGeometry(5, 8),
            new THREE.MeshLambertMaterial({ color: 0x8B7355 })
        );
        tentFloor.rotation.x = -Math.PI / 2;
        tentFloor.position.y = 0.05;
        tentFloor.userData.ignoreCameraOcclusion = true;
        tent.add(tentFloor);

        // Bedroll inside
        const bedroll = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.8, 2.5, 4, 8),
            new THREE.MeshLambertMaterial({ color: 0x4a3728 })
        );
        bedroll.rotation.z = Math.PI / 2;
        bedroll.position.set(-1, 0.4, 0);
        tent.add(bedroll);

        tentColliderMarkers.push(
            createColliderMarker(tent, 'solidWall', { localX: 4.24, localY: 3.5, localZ: 0, halfW: 0.18, halfD: 4.24, height: 7.0, extra: { isEnclosed: true, bulletPass: true } }),
            createColliderMarker(tent, 'solidWall', { localX: -4.24, localY: 3.5, localZ: 0, halfW: 0.18, halfD: 4.24, height: 7.0, extra: { isEnclosed: true, bulletPass: true } }),
            createColliderMarker(tent, 'solidWall', { localX: 0, localY: 3.5, localZ: -4.24, halfW: 4.24, halfD: 0.18, height: 7.0, extra: { isEnclosed: true, bulletPass: true } }),
            createColliderMarker(tent, 'ceilingRect', { localX: 0, localY: 6.8, localZ: 0, halfW: 4.3, halfD: 4.3 }),
            createColliderMarker(tent, 'roofCollider', { localX: 0, localY: 6.85, localZ: 0, halfW: 4.3, halfD: 4.3, thickness: 0.5 }),
            createColliderMarker(tent, 'enclosedBound', { localX: 0, localY: 0, localZ: 0, halfW: 6, halfD: 6 })
        );

        tent.position.set(placement.x, groundY, placement.z);
        tent.rotation.y = placement.rotation;
        scene.add(tent);
        tent.updateMatrixWorld(true);
        registerColliderMarkers(tentColliderMarkers);
        builtTentGroups.push(tent);
    });

    // Place a shovel on the floor of one randomly chosen tent
    if (builtTentGroups.length > 0) {
        const chosenTent = builtTentGroups[Math.floor(Math.random() * builtTentGroups.length)];

        // Desired local XZ offset inside the tent (right of centre, back from entrance)
        const localX = 1.8;
        const localZ = -1.2;

        // Convert to world XZ so we can sample actual terrain height there
        const ty = chosenTent.rotation.y;
        const worldShovelX = chosenTent.position.x + localX * Math.cos(ty) - localZ * Math.sin(ty);
        const worldShovelZ = chosenTent.position.z + localX * Math.sin(ty) + localZ * Math.cos(ty);
        const terrainAtShovel = getGroundHeight(worldShovelX, worldShovelZ);

        // Local Y: terrain relative to tent origin, then add clearance so shovel sits visibly above it.
        // The shovel laid flat (rotation.z=PI/2) has ~0.3 unit radius, so 0.5 clearance is safe.
        const localY = Math.max(0.35, (terrainAtShovel - chosenTent.position.y) + 0.5);

        const shovelInTent = createShovelMesh(1.0);
        shovelInTent.position.set(localX, localY, localZ);
        shovelInTent.rotation.set(0, Math.PI / 1.5, Math.PI / 2);
        shovelInTent.userData.isTentShovel = true;
        chosenTent.add(shovelInTent);
        chosenTent.updateMatrixWorld(true);
        tentShovelMesh = shovelInTent;
    }
}

// ── updateCampfireLights: per-frame extreme flicker for cave campfire lights ──
function updateCampfireLights(delta) {
    const t = performance.now() * 0.001;
    for (const light of campfireLights) {
        const ud = light.userData;
        ud.flickerTimer -= delta;
        if (ud.flickerTimer <= 0) {
            // Extreme flicker: intensity swings from 40% to 180% of base, distance 50–140%
            ud.flickerTimer      = 0.03 + Math.random() * 0.12;
            ud.targetIntensity   = ud.baseIntensity * (0.4 + Math.random() * 1.4);
            ud.targetDistance    = ud.baseDistance  * (0.5 + Math.random() * 0.9);
        }
        const iBlend = Math.min(1, delta * 9);
        const dBlend = Math.min(1, delta * 6);
        ud.currentIntensity += (ud.targetIntensity - ud.currentIntensity) * iBlend;
        ud.currentDistance  += (ud.targetDistance  - ud.currentDistance)  * dBlend;

        // High-frequency breath adds organic micro-variation
        const breath = Math.sin(t * 11.3) * 0.18 + Math.sin(t * 19.7 + 0.9) * 0.10;
        light.intensity = Math.max(0.5, ud.currentIntensity + breath * ud.baseIntensity);
        light.distance  = Math.max(15,  ud.currentDistance  + breath * ud.baseDistance * 0.12);
    }
}
