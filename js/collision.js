function addStructureBox(x, z, y, width, height, depth, rotation = 0, extra = {}) {
    const structure = {
        type: 'box',
        x,
        z,
        y,
        width,
        height,
        depth,
        rotation,
        ...extra
    };
    structures.push(structure);
    return structure;
}

function addLocalStructureBox(originX, originZ, localX, localZ, y, width, height, depth, rotation = 0, extra = {}) {
    const world = localToWorldXZ(originX, originZ, localX, localZ, rotation);
    return addStructureBox(world.x, world.z, y, width, height, depth, rotation, extra);
}

function addRigidBoxStructureParts(group, material, parts) {
    return parts.map(part => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(part.width, part.height, part.depth),
            material
        );
        mesh.position.set(part.localX, part.localY + part.height / 2, part.localZ);
        mesh.castShadow = part.castShadow !== false;
        mesh.receiveShadow = part.receiveShadow !== false;
        group.add(mesh);
        return { mesh, part };
    });
}

function registerRigidBoxStructureParts(partMeshes, extraForPart = null) {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const worldEuler = new THREE.Euler();

    partMeshes.forEach(({ mesh, part }, index) => {
        mesh.getWorldPosition(worldPos);
        mesh.getWorldQuaternion(worldQuat);
        mesh.getWorldScale(worldScale);
        worldEuler.setFromQuaternion(worldQuat, 'YXZ');

        const extra = extraForPart ? (extraForPart(part, index) || {}) : {};
        addStructureBox(
            worldPos.x,
            worldPos.z,
            worldPos.y - (part.height * worldScale.y) / 2,
            part.width * worldScale.x,
            part.height * worldScale.y,
            part.depth * worldScale.z,
            worldEuler.y,
            extra
        );
    });
}

function createColliderMarker(parent, type, config = {}) {
    const marker = new THREE.Object3D();
    marker.position.set(config.localX || 0, config.localY || 0, config.localZ || 0);
    marker.rotation.y = config.localRotation || 0;
    marker.userData.collider = {
        type,
        ...config
    };
    parent.add(marker);
    return marker;
}

function registerColliderMarkers(markers) {
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const worldEuler = new THREE.Euler();

    markers.forEach(marker => {
        const collider = marker.userData.collider;
        if (!collider) return;

        marker.getWorldPosition(worldPos);
        marker.getWorldQuaternion(worldQuat);
        marker.getWorldScale(worldScale);
        worldEuler.setFromQuaternion(worldQuat, 'YXZ');

        if (collider.type === 'solidWall') {
            const halfW = collider.halfW * worldScale.x;
            const halfD = collider.halfD * worldScale.z;
            const height = collider.height * worldScale.y;
            addSolidWallRect(
                worldPos.x,
                worldPos.z,
                halfW,
                halfD,
                worldPos.y - height / 2,
                worldPos.y + height / 2,
                worldEuler.y,
                collider.extra || {}
            );
        } else if (collider.type === 'structureBox') {
            const width = collider.width * worldScale.x;
            const height = collider.height * worldScale.y;
            const depth = collider.depth * worldScale.z;
            addStructureBox(
                worldPos.x,
                worldPos.z,
                worldPos.y - height / 2,
                width,
                height,
                depth,
                worldEuler.y,
                collider.extra || {}
            );
        } else if (collider.type === 'ceilingRect') {
            addCeilingRect(
                worldPos.x,
                worldPos.z,
                collider.halfW * worldScale.x,
                collider.halfD * worldScale.z,
                worldPos.y,
                worldEuler.y
            );
        } else if (collider.type === 'roofCollider') {
            const thickness = collider.thickness * worldScale.y;
            addRoofColliderRect(
                worldPos.x,
                worldPos.z,
                collider.halfW * worldScale.x,
                collider.halfD * worldScale.z,
                worldPos.y + thickness / 2,
                worldPos.y - thickness / 2,
                worldEuler.y
            );
        } else if (collider.type === 'enclosedBound') {
            addEnclosedBoundRect(
                worldPos.x,
                worldPos.z,
                collider.halfW * worldScale.x,
                collider.halfD * worldScale.z,
                worldEuler.y
            );
        }
    });
}

function addSolidWallRect(x, z, halfW, halfD, minY, maxY, rotation = 0, extra = {}) {
    const wall = {
        x,
        z,
        halfW,
        halfD,
        minY,
        maxY,
        rotation,
        ...extra
    };
    solidWalls.push(wall);
    return wall;
}

function addLocalSolidWall(originX, originZ, localX, localZ, halfW, halfD, minY, maxY, rotation = 0, extra = {}) {
    const world = localToWorldXZ(originX, originZ, localX, localZ, rotation);
    return addSolidWallRect(world.x, world.z, halfW, halfD, minY, maxY, rotation, extra);
}

function addCeilingRect(x, z, halfW, halfD, y, rotation = 0) {
    ceilings.push({ x, z, halfW, halfD, y, rotation });
}

function addLocalCeiling(originX, originZ, localX, localZ, halfW, halfD, y, rotation = 0) {
    const world = localToWorldXZ(originX, originZ, localX, localZ, rotation);
    addCeilingRect(world.x, world.z, halfW, halfD, y, rotation);
}

function addRoofColliderRect(x, z, halfW, halfD, topY, bottomY, rotation = 0) {
    roofColliders.push({ x, z, halfW, halfD, topY, bottomY, rotation });
}

function addRoofColliderCircle(x, z, radius, topY, bottomY) {
    roofColliders.push({ x, z, radius, topY, bottomY, rotation: 0 });
}

function addLocalRoofCollider(originX, originZ, localX, localZ, halfW, halfD, topY, bottomY, rotation = 0) {
    const world = localToWorldXZ(originX, originZ, localX, localZ, rotation);
    addRoofColliderRect(world.x, world.z, halfW, halfD, topY, bottomY, rotation);
}

function addEnclosedBoundRect(x, z, halfW, halfD, rotation = 0) {
    enclosedStructureBounds.push({ x, z, halfW, halfD, rotation });
}

function addLocalEnclosedBound(originX, originZ, localX, localZ, halfW, halfD, rotation = 0) {
    const world = localToWorldXZ(originX, originZ, localX, localZ, rotation);
    addEnclosedBoundRect(world.x, world.z, halfW, halfD, rotation);
}

function getCollisionPushSign(currentCoord, previousCoord, limit) {
    if (previousCoord !== null && previousCoord !== undefined && Math.abs(previousCoord) > limit + 1e-5) {
        return previousCoord >= 0 ? 1 : -1;
    }

    if (Math.abs(currentCoord) > 1e-5) {
        return currentCoord >= 0 ? 1 : -1;
    }

    if (previousCoord !== null && previousCoord !== undefined && Math.abs(previousCoord) > 1e-5) {
        return previousCoord >= 0 ? 1 : -1;
    }

    return 1;
}

function resolveCircularWallCollision(position, radius, wall, previousPosition = null) {
    const rotation = wall.rotation || 0;
    const local = worldToLocalXZ(position.x, position.z, wall.x, wall.z, rotation);
    const previousLocal = previousPosition
        ? worldToLocalXZ(previousPosition.x, previousPosition.z, wall.x, wall.z, rotation)
        : null;
    const limitX = wall.halfW + radius;
    const limitZ = wall.halfD + radius;
    const overlapX = limitX - Math.abs(local.x);
    const overlapZ = limitZ - Math.abs(local.z);

    if (overlapX <= 0 || overlapZ <= 0) return null;

    if (overlapX < overlapZ) {
        const pushX = overlapX * getCollisionPushSign(local.x, previousLocal?.x, limitX);
        return rotateXZ(pushX, 0, rotation);
    }

    const pushZ = overlapZ * getCollisionPushSign(local.z, previousLocal?.z, limitZ);
    return rotateXZ(0, pushZ, rotation);
}

function clampPlayerToWorldBounds() {
    const bound = WORLD_SIZE - 10;
    const clampedX = Math.max(-bound, Math.min(bound, player.position.x));
    const clampedZ = Math.max(-bound, Math.min(bound, player.position.z));
    const hitX = clampedX !== player.position.x;
    const hitZ = clampedZ !== player.position.z;
    player.position.x = clampedX;
    player.position.z = clampedZ;
    return { hitX, hitZ };
}

function clampPositionToWorldBounds(position) {
    const bound = WORLD_SIZE - 10;
    const clampedX = Math.max(-bound, Math.min(bound, position.x));
    const clampedZ = Math.max(-bound, Math.min(bound, position.z));
    const hitX = clampedX !== position.x;
    const hitZ = clampedZ !== position.z;
    position.x = clampedX;
    position.z = clampedZ;
    return { hitX, hitZ };
}

function isWallActiveForY(wall, y) {
    if (wall.active === false) return false;
    return wall.minY === undefined || (y >= wall.minY && y <= wall.maxY);
}

function getCircularWallSurfaceDistance(position, radius, wall) {
    const rotation = wall.rotation || 0;
    const local = worldToLocalXZ(position.x, position.z, wall.x, wall.z, rotation);
    const limitX = wall.halfW + radius;
    const limitZ = wall.halfD + radius;
    const outsideX = Math.max(0, Math.abs(local.x) - limitX);
    const outsideZ = Math.max(0, Math.abs(local.z) - limitZ);

    if (outsideX > 0 || outsideZ > 0) {
        return Math.hypot(outsideX, outsideZ);
    }

    return Math.min(limitX - Math.abs(local.x), limitZ - Math.abs(local.z));
}

function isDemonNearWallPhaseMargin(position, y, radius, wall, epsilon) {
    if (!isWallActiveForY(wall, y)) return false;
    return getCircularWallSurfaceDistance(position, radius, wall) <= epsilon;
}

function updateDemonWallPhaseState(demon, position, y, radius, delta, farFromPlayer) {
    const epsilon = 0.45;
    const phaseDelay = 3;
    const trackedWall = demon.wallPhaseWall;

    if (trackedWall) {
        const trackedWallActive = !(farFromPlayer && trackedWall.isEnclosed);
        if (!trackedWallActive || !isDemonNearWallPhaseMargin(position, y, radius, trackedWall, epsilon)) {
            demon.wallPhaseWall = null;
            demon.wallPhaseTimer = 0;
            demon.wallPhaseActive = false;
        }
    }

    if (!demon.wallPhaseWall) {
        for (const wall of solidWalls) {
            if (farFromPlayer && wall.isEnclosed) continue;
            if (!isDemonNearWallPhaseMargin(position, y, radius, wall, epsilon)) continue;

            demon.wallPhaseWall = wall;
            demon.wallPhaseTimer = 0;
            demon.wallPhaseActive = false;
            break;
        }
    }

    if (!demon.wallPhaseWall) return;

    demon.wallPhaseTimer += delta;
    if (demon.wallPhaseTimer >= phaseDelay) {
        demon.wallPhaseActive = true;
    }
}

function resolvePlayerWallOverlaps(radius, resolvePasses = 3, previousPosition = null) {
    let blockedX = false;
    let blockedZ = false;

    for (let pass = 0; pass < resolvePasses; pass++) {
        let hadOverlap = false;
        const passPreviousPosition = pass === 0 ? previousPosition : null;

        for (const wall of solidWalls) {
            if (!isWallActiveForY(wall, player.position.y)) continue;
            const push = resolveCircularWallCollision(player.position, radius, wall, passPreviousPosition);
            if (!push) continue;

            player.position.x += push.x;
            player.position.z += push.z;
            if (Math.abs(push.x) > 1e-5) blockedX = true;
            if (Math.abs(push.z) > 1e-5) blockedZ = true;
            hadOverlap = true;
        }

        const bounded = clampPlayerToWorldBounds();
        blockedX = blockedX || bounded.hitX;
        blockedZ = blockedZ || bounded.hitZ;
        if (!hadOverlap) break;
    }

    return { blockedX, blockedZ };
}

function resolveCircularEntityWallOverlaps(position, y, radius, resolvePasses = 3, previousPosition = null) {
    let blockedX = false;
    let blockedZ = false;

    for (let pass = 0; pass < resolvePasses; pass++) {
        let hadOverlap = false;
        const passPreviousPosition = pass === 0 ? previousPosition : null;

        for (const wall of solidWalls) {
            if (!isWallActiveForY(wall, y)) continue;
            const push = resolveCircularWallCollision(position, radius, wall, passPreviousPosition);
            if (!push) continue;

            position.x += push.x;
            position.z += push.z;
            if (Math.abs(push.x) > 1e-5) blockedX = true;
            if (Math.abs(push.z) > 1e-5) blockedZ = true;
            hadOverlap = true;
        }

        const bounded = clampPositionToWorldBounds(position);
        blockedX = blockedX || bounded.hitX;
        blockedZ = blockedZ || bounded.hitZ;
        if (!hadOverlap) break;
    }

    return { blockedX, blockedZ };
}

function resolveCircularBodyRoofCollision(position, previousY, supportOffset, verticalMotion) {
    let groundedOnRoof = false;

    for (const roof of roofColliders) {
        if (!isPointInsideRoofCollider(position.x, position.z, roof)) continue;

        const roofTop = roof.topY + supportOffset;
        const roofBottom = roof.bottomY - supportOffset;

        if (verticalMotion <= 0 && previousY >= roofTop - 0.05 && position.y <= roofTop + 0.35) {
            position.y = roofTop;
            groundedOnRoof = true;
            continue;
        }

        if (verticalMotion > 0 && previousY <= roofBottom + 0.05 && position.y >= roofBottom) {
            position.y = roofBottom - 0.01;
        }
    }

    return groundedOnRoof;
}

function isPointInsideRoofCollider(x, z, roof) {
    if (roof.radius !== undefined) {
        const dx = x - roof.x;
        const dz = z - roof.z;
        return dx * dx + dz * dz <= roof.radius * roof.radius;
    }

    return isPointInRotatedRect(x, z, roof);
}

function getPlayerMovementSubsteps(totalDX, totalDZ) {
    const maxComponent = Math.max(Math.abs(totalDX), Math.abs(totalDZ));
    if (maxComponent <= 1e-6) return 1;
    return Math.max(1, Math.min(24, Math.ceil(maxComponent / 0.35)));
}

function movePlayerAxisWithCollisions(axis, amount, radius) {
    if (Math.abs(amount) <= 1e-8) return false;

    const previousPosition = { x: player.position.x, z: player.position.z };
    player.position[axis] += amount;
    const bounded = clampPlayerToWorldBounds();
    const overlaps = resolvePlayerWallOverlaps(radius, 3, previousPosition);

    return axis === 'x'
        ? (bounded.hitX || overlaps.blockedX)
        : (bounded.hitZ || overlaps.blockedZ);
}

function movePlayerHorizontallyWithCollisions(delta, radius) {
    const totalDX = velocity.x * delta;
    const totalDZ = velocity.z * delta;
    const substeps = getPlayerMovementSubsteps(totalDX, totalDZ);

    let stepDX = totalDX / substeps;
    let stepDZ = totalDZ / substeps;

    for (let i = 0; i < substeps; i++) {
        if (stepDX !== 0) {
            const blockedX = movePlayerAxisWithCollisions('x', stepDX, radius);
            if (blockedX) {
                velocity.x = 0;
                stepDX = 0;
            }
        }

        if (stepDZ !== 0) {
            const blockedZ = movePlayerAxisWithCollisions('z', stepDZ, radius);
            if (blockedZ) {
                velocity.z = 0;
                stepDZ = 0;
            }
        }
    }
}

function makeCollisionDebugMaterial(opacity = 0.22) {
    return new THREE.MeshBasicMaterial({
        color: 0xff2222,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false
    });
}

function prepareCollisionDebugMesh(mesh) {
    mesh.renderOrder = 900;
    mesh.raycast = () => {};
    mesh.userData.isDebugCollision = true;
    return mesh;
}

function createCollisionDebugVisuals() {
    if (!DEBUG_COLLISIONS || collisionDebugGroup) return;

    collisionDebugGroup = new THREE.Group();
    collisionDebugGroup.name = 'collision-debug';
    scene.add(collisionDebugGroup);

    const structureMat = makeCollisionDebugMaterial(0.18);
    const wallMat = makeCollisionDebugMaterial(0.24);
    const planeMat = makeCollisionDebugMaterial(0.3);

    const addDebugMesh = mesh => {
        prepareCollisionDebugMesh(mesh);
        collisionDebugGroup.add(mesh);
    };

    for (const s of structures) {
        let mesh = null;

        if (s.type === 'box') {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(s.width, s.height, s.depth),
                structureMat
            );
            mesh.position.set(s.x, s.y + s.height / 2, s.z);
            mesh.rotation.y = s.rotation || 0;
        } else if (s.type === 'sphere') {
            const rx = s.radiusX ?? s.radius;
            const rz = s.radiusZ ?? s.radius;
            const ry = s.radiusY ?? ((s.height ?? (s.radius * 2)) * 0.5);
            const cy = s.centerY ?? ((s.y ?? 0) + ry);
            mesh = new THREE.Mesh(
                new THREE.SphereGeometry(1, 16, 12),
                structureMat
            );
            mesh.position.set(s.x, cy, s.z);
            mesh.scale.set(rx, ry, rz);
        } else if (s.type === 'cone') {
            mesh = new THREE.Mesh(
                new THREE.ConeGeometry(s.radius, s.height, 20),
                structureMat
            );
            mesh.position.set(s.x, s.y + s.height / 2, s.z);
        } else if (s.type === 'cylinder') {
            mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(s.radius, s.radius, s.height, 20),
                structureMat
            );
            mesh.position.set(s.x, s.y + s.height / 2, s.z);
        } else if (s.type === 'ramp') {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(s.width, 1, s.length),
                structureMat
            );
            mesh.position.set(s.x, s.y + s.height / 2, s.z);
            mesh.rotation.set(Math.atan2(s.height, s.length), s.rotation || 0, 0);
        }

        if (mesh) addDebugMesh(mesh);
    }

    for (const wall of solidWalls) {
        const minY = wall.minY ?? 0;
        const maxY = wall.maxY ?? 12;
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(wall.halfW * 2, Math.max(0.08, maxY - minY), wall.halfD * 2),
            wallMat
        );
        mesh.position.set(wall.x, (minY + maxY) / 2, wall.z);
        mesh.rotation.y = wall.rotation || 0;
        addDebugMesh(mesh);
    }

    for (const ceil of ceilings) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(ceil.halfW * 2, 0.08, ceil.halfD * 2),
            planeMat
        );
        mesh.position.set(ceil.x, ceil.y, ceil.z);
        mesh.rotation.y = ceil.rotation || 0;
        addDebugMesh(mesh);
    }

    for (const roof of roofColliders) {
        let mesh;
        if (roof.radius !== undefined) {
            mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    roof.radius,
                    roof.radius,
                    Math.max(0.08, roof.topY - roof.bottomY),
                    24
                ),
                planeMat
            );
        } else {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(roof.halfW * 2, Math.max(0.08, roof.topY - roof.bottomY), roof.halfD * 2),
                planeMat
            );
            mesh.rotation.y = roof.rotation || 0;
        }
        mesh.position.set(roof.x, (roof.topY + roof.bottomY) / 2, roof.z);
        addDebugMesh(mesh);
    }
}

function createDistanceDebugStake() {
    if (DEBUG_DISTANCE < 0) return;

    const x = 0;
    const z = DEBUG_DISTANCE;
    const baseY = getGroundHeight(x, z);

    const stakeHeight = 8.4;
    const stake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 1.1, stakeHeight, 12),
        new THREE.MeshLambertMaterial({ color: 0xff2222 })
    );
    stake.position.set(x, baseY + stakeHeight / 2, z);
    stake.userData.ignoreCameraOcclusion = true;
    scene.add(stake);
}
