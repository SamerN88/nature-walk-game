const SPECIAL_PORTAL_TIGHTENED_NOOSE_Y_OFFSET = 0.36;

function createSpecialPortalNoose(parent, archHeight) {
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xc8aa73 });
    const ropeRadius = 0.12;
    const lintelCenterY = archHeight + 1.5;
    const ropeTopY = archHeight - 0.15;
    const nooseCenterY = archHeight - 11.0;
    const dropLen = ropeTopY - (nooseCenterY + 0.9);

    const wrapYHalf = 1.65;
    const wrapZHalf = 2.15;
    const addWrapSegment = (x, y, z, length, axis) => {
        const segment = new THREE.Mesh(new THREE.CylinderGeometry(ropeRadius, ropeRadius, length, 10), ropeMat);
        segment.position.set(x, y, z);
        if (axis === 'z') segment.rotation.x = Math.PI / 2;
        segment.castShadow = true;
        parent.add(segment);
    };
    addWrapSegment(0, lintelCenterY, -wrapZHalf, wrapYHalf * 2, 'y');
    addWrapSegment(0, lintelCenterY, wrapZHalf, wrapYHalf * 2, 'y');
    addWrapSegment(0, lintelCenterY + wrapYHalf, 0, wrapZHalf * 2, 'z');
    addWrapSegment(0, lintelCenterY - wrapYHalf, 0, wrapZHalf * 2, 'z');

    const rope = new THREE.Mesh(new THREE.CylinderGeometry(ropeRadius, ropeRadius, dropLen, 10), ropeMat);
    rope.position.set(0, ropeTopY - dropLen / 2, 0);
    rope.castShadow = true;
    parent.add(rope);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), ropeMat);
    knot.position.set(0, nooseCenterY + 0.85, 0);
    knot.scale.set(1.15, 0.85, 0.9);
    knot.castShadow = true;
    parent.add(knot);

    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.11, 10, 32), ropeMat);
    loop.position.set(0, nooseCenterY, 0);
    loop.scale.y = 1.38;
    loop.castShadow = true;
    parent.add(loop);

    return { nooseCenterY, loop };
}

function tightenSpecialPortalNooseLoop() {
    if (!specialPortalFrameData || !specialPortalFrameData.nooseLoop) return;

    const loop = specialPortalFrameData.nooseLoop;
    if (loop.geometry) loop.geometry.dispose();
    loop.geometry = new THREE.TorusGeometry(0.36, 0.11, 10, 32);
    loop.position.y = specialPortalFrameData.nooseCenterY + SPECIAL_PORTAL_TIGHTENED_NOOSE_Y_OFFSET;
    loop.position.z -= 0.1;
    loop.rotation.x = 0.4;
    loop.scale.set(1, 1.12, 1);
}

function createSpecialPortalHangingBodyMesh() {
    if (typeof _buildZombieMesh !== 'function') return null;

    const S = 0.87;
    const body = _buildZombieMesh();
    const bodyColor = CREATURE_BODY_COLOR;
    const material = new THREE.MeshLambertMaterial({ color: bodyColor });

    body.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            obj.material = material;
        }
    });

    // Capture all references upfront before any removal shifts indices.
    const leftLeg = body.children[0];
    const rightLeg = body.children[1];
    const head = body.children[4];
    const leftEye = body.children[5];
    const rightEye = body.children[6];
    const leftArm = body.children[7];
    const rightArm = body.children[8];

    if (leftArm) body.remove(leftArm);
    if (rightArm) body.remove(rightArm);

    if (leftEye) body.remove(leftEye);
    if (rightEye) body.remove(rightEye);

    const legLengthScale = 1.3;
    [leftLeg, rightLeg].forEach(leg => {
        if (!leg) return;
        leg.rotation.set(0, 0, 0);
        const baseLegHeight = leg.geometry && leg.geometry.parameters ? leg.geometry.parameters.height : 1.39;
        leg.scale.y *= legLengthScale;
        leg.position.y -= baseLegHeight * (legLengthScale - 1) / 2;
        leg.position.x += 0.05 * (leg === leftLeg ? 1 : -1);

        const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), material);
        foot.geometry.rotateX(Math.PI / 2);
        foot.scale.set(1, 0.42, 1);
        foot.position.set(leg.position.x, leg.position.y - baseLegHeight * leg.scale.y / 2 - 0.07, 0.03);
        foot.rotation.x = 1.2;
        foot.castShadow = true;
        foot.receiveShadow = true;
        body.add(foot);
    });

    const armLen = 1.77;
    const armTopY = 2.70;
    [-1, 1].forEach(side => {
        const x = side * 0.6 * S;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.10, armLen, 7), material);
        arm.position.set(x, armTopY - armLen / 2, 0);
        arm.castShadow = true;
        arm.receiveShadow = true;
        arm.rotation.z = Math.PI / 100 * side;
        body.add(arm);
    });

    if (head) {
        head.scale.set(1.2, 1.07, 1.4);
        head.rotation.set(-0.75, 0, 0.3);
        // head.position.y -= 0.12;
        head.position.z += 0.3;
    }

    return body;
}

function spawnSpecialPortalHangingBody() {
    if (!specialPortalFrameData || specialPortalFrameData.body) return;

    const body = createSpecialPortalHangingBodyMesh();
    if (!body) return;

    const bodyScale = 1.45;
    body.scale.setScalar(bodyScale);
    body.position.set(0, specialPortalFrameData.nooseCenterY + SPECIAL_PORTAL_TIGHTENED_NOOSE_Y_OFFSET - 3.10 * bodyScale, 0);
    body.rotation.y = Math.PI;
    tightenSpecialPortalNooseLoop();
    specialPortalFrameData.group.add(body);
    specialPortalFrameData.body = body;
}

function createSpecialHangingPortalFrame(stoneMaterial) {
    const innerRegion = { type: 'ring', minRadius: 450, maxRadius: 1500 };
    const archHeight = 38;
    const placement = findPlacementInRegion(innerRegion, (point, rotation) => {
        if (Math.hypot(point.x, point.z) < 450) return null;
        return {
            x: point.x,
            z: point.z,
            archHeight,
            rotation: rotation ?? randomRotationY(),
            footprint: makePlacementFootprint(point.x, point.z, getPlacementRadiusForRect(18, 8, 14))
        };
    }, 240, { pointDensity: 1.25, rotationCount: 8 });

    if (!placement) return;

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
    const noose = createSpecialPortalNoose(archGroup, placement.archHeight);

    archGroup.position.set(placement.x, archGroundY - PORTAL_FRAME_Y_SINK, placement.z);
    archGroup.rotation.y = placement.rotation;
    scene.add(archGroup);
    archGroup.updateMatrixWorld(true);
    registerRigidBoxStructureParts(archPartMeshes);

    specialPortalFrameData = {
        group: archGroup,
        nooseCenterY: noose.nooseCenterY,
        nooseLoop: noose.loop,
        body: null
    };

    if (DEBUG_NOOSE || DEBUG_NOOSE_BODY) {
        const spawn = localToWorldXZ(placement.x, placement.z, 0, 20, placement.rotation);
        player.position.set(spawn.x, getGroundHeight(spawn.x, spawn.z), spawn.z);
        cameraYaw = Math.atan2(placement.x - spawn.x, placement.z - spawn.z);
    }

    if (hasTalisman || DEBUG_NOOSE_BODY) spawnSpecialPortalHangingBody();
}
