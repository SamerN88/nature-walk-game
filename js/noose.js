const SPECIAL_PORTAL_TIGHTENED_NOOSE_Y_OFFSET = 0.36;
const SPECIAL_PORTAL_NIGHT_BLEND_SPEED = 0.85;
const SPECIAL_PORTAL_SWING_AMPLITUDE = 0.1;
const SPECIAL_PORTAL_BODY_HIT_RANGE = 45;
const SPECIAL_PORTAL_BODY_HITS_TO_BANISH = 3;
const SPECIAL_PORTAL_BODY_FADE_DURATION = 2.0;
const SPECIAL_PORTAL_NOOSE_LOOP_REST_ROT_X = 0.4;
const SPECIAL_PORTAL_NOOSE_LOOP_ALIVE_ROT_X = 0.68;

const _specialPortalRaycaster = new THREE.Raycaster();

function _lerpNooseValue(a, b, t) {
    return a + (b - a) * t;
}

function _makeNooseEuler(x, y, z) {
    return { x, y, z };
}

function _setNooseEuler(euler, rest, active, t) {
    euler.set(
        _lerpNooseValue(rest.x, active.x, t),
        _lerpNooseValue(rest.y, active.y, t),
        _lerpNooseValue(rest.z, active.z, t)
    );
}

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
    for (const y of [lintelCenterY - wrapYHalf, lintelCenterY + wrapYHalf]) {
        for (const z of [-wrapZHalf, wrapZHalf]) {
            const corner = new THREE.Mesh(new THREE.SphereGeometry(ropeRadius, 10, 8), ropeMat);
            corner.position.set(0, y, z);
            corner.castShadow = true;
            parent.add(corner);
        }
    }

    const pivotKnot = new THREE.Mesh(new THREE.SphereGeometry(ropeRadius * 1.9, 10, 8), ropeMat);
    pivotKnot.position.set(0, ropeTopY-0.05, 0);
    // pivotKnot.scale.set(1.12, 0.86, 1.12);
    pivotKnot.castShadow = true;
    parent.add(pivotKnot);

    const swingGroup = new THREE.Group();
    swingGroup.position.set(0, ropeTopY, 0);
    parent.add(swingGroup);

    const rope = new THREE.Mesh(new THREE.CylinderGeometry(ropeRadius, ropeRadius, dropLen, 10), ropeMat);
    rope.position.set(0, -dropLen / 2, 0);
    rope.castShadow = true;
    swingGroup.add(rope);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), ropeMat);
    knot.position.set(0, nooseCenterY + 0.85 - ropeTopY, 0);
    knot.scale.set(1.15, 0.85, 0.9);
    knot.castShadow = true;
    swingGroup.add(knot);

    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.11, 10, 32), ropeMat);
    loop.position.set(0, nooseCenterY - ropeTopY, 0);
    loop.scale.y = 1.38;
    loop.castShadow = true;
    swingGroup.add(loop);

    return { nooseCenterY, ropeTopY, loop, swingGroup };
}

function tightenSpecialPortalNooseLoop() {
    if (!specialPortalFrameData || !specialPortalFrameData.nooseLoop) return;

    const loop = specialPortalFrameData.nooseLoop;
    if (loop.geometry) loop.geometry.dispose();
    loop.geometry = new THREE.TorusGeometry(0.36, 0.11, 10, 32);
    loop.position.y = specialPortalFrameData.nooseCenterY
        + SPECIAL_PORTAL_TIGHTENED_NOOSE_Y_OFFSET
        - specialPortalFrameData.ropeTopY;
    loop.position.z -= 0.1;
    loop.rotation.x = SPECIAL_PORTAL_NOOSE_LOOP_REST_ROT_X;
    loop.scale.set(1, 1.12, 1);
}

function _createNooseLimbSegment(radiusTop, radiusBottom, length, material) {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7), material);
    segment.position.y = -length / 2;
    segment.castShadow = true;
    segment.receiveShadow = true;
    return segment;
}

function _createNooseJointCap(radius, material) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), material);
    cap.castShadow = true;
    cap.receiveShadow = true;
    return cap;
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

    if (leftLeg) body.remove(leftLeg);
    if (rightLeg) body.remove(rightLeg);
    if (leftArm) body.remove(leftArm);
    if (rightArm) body.remove(rightArm);
    if (leftEye) body.remove(leftEye);
    if (rightEye) body.remove(rightEye);

    const parts = {
        head,
        eyes: [],
        arms: [],
        legs: []
    };

    const eyeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0
    });

    [-1, 1].forEach(side => {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.55 * S, 2.72, 0.02);
        body.add(shoulder);
        shoulder.add(_createNooseJointCap(0.145, material));

        const upperLen = 0.80;
        const lowerLen = 1.18;
        const upperMesh = _createNooseLimbSegment(0.14, 0.12, upperLen, material);
        shoulder.add(upperMesh);

        const elbow = new THREE.Group();
        elbow.position.y = -upperLen;
        shoulder.add(elbow);
        elbow.add(_createNooseJointCap(0.12, material));

        const lowerMesh = _createNooseLimbSegment(0.12, 0.095, lowerLen, material);
        elbow.add(lowerMesh);

        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), material);
        hand.position.set(0, -lowerLen, 0);
        // hand.scale.set(1.05, 0.72, 0.95);
        hand.castShadow = true;
        hand.receiveShadow = true;
        elbow.add(hand);

        parts.arms.push({
            side,
            upper: shoulder,
            lower: elbow,
            upperRest: _makeNooseEuler(0, 0, side * 0.03),
            lowerRest: _makeNooseEuler(0, 0, 0),
            upperActive: _makeNooseEuler(-0.22, 0, side * 0.54),
            lowerActive: _makeNooseEuler(0.2, side * 0.08, -side * 2.92)
        });
    });

    [-1, 1].forEach(side => {
        const hip = new THREE.Group();
        hip.position.set(side * 0.25 * S, 1.42, 0);
        body.add(hip);

        const upperLen = 0.94;
        const lowerLen = 0.96;
        const upperMesh = _createNooseLimbSegment(0.16, 0.145, upperLen, material);
        hip.add(upperMesh);

        const knee = new THREE.Group();
        knee.position.y = -upperLen;
        hip.add(knee);
        knee.add(_createNooseJointCap(0.145, material));

        const lowerMesh = _createNooseLimbSegment(0.145, 0.118, lowerLen, material);
        knee.add(lowerMesh);

        const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), material);
        foot.geometry.rotateX(Math.PI / 2);
        foot.scale.set(1, 0.42, 1);
        foot.position.set(0, -lowerLen - 0.07, 0.03);
        foot.rotation.x = 1.2;
        foot.castShadow = true;
        foot.receiveShadow = true;
        knee.add(foot);

        parts.legs.push({
            side,
            upper: hip,
            lower: knee,
            foot,
            upperRest: _makeNooseEuler(0, 0, side * 0.015),
            lowerRest: _makeNooseEuler(0, 0, 0),
            footRest: _makeNooseEuler(1.2, 0, 0)
        });
    });

    if (head) {
        head.scale.set(1.2, 1.07, 1.4);
        head.rotation.set(-0.75, 0, 0.3);
        head.userData.deadPositionY = head.position.y;
        head.userData.deadPositionZ = head.position.z + 0.3;
        head.position.z += 0.3;

        for (const ex of [-0.095, 0.095]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
            eye.position.set(ex, -0.29, 0.05);
            eye.visible = false;
            eye.userData.isEye = true;
            head.add(eye);
            parts.eyes.push(eye);
        }
    }

    body.userData.nooseParts = parts;
    body.userData.nooseBodyMaterial = material;
    body.userData.nooseEyeMaterial = eyeMat;

    return body;
}

function spawnSpecialPortalHangingBody() {
    if (!specialPortalFrameData || specialPortalFrameData.body || specialPortalFrameData.bodyGone) return;

    const body = createSpecialPortalHangingBodyMesh();
    if (!body) return;

    const bodyScale = 1.45;
    body.scale.setScalar(bodyScale);
    body.position.set(
        0,
        specialPortalFrameData.nooseCenterY
            + SPECIAL_PORTAL_TIGHTENED_NOOSE_Y_OFFSET
            - 3.10 * bodyScale
            - specialPortalFrameData.ropeTopY,
        0
    );
    body.rotation.y = Math.PI;
    tightenSpecialPortalNooseLoop();
    specialPortalFrameData.nooseRoot.add(body);
    specialPortalFrameData.body = body;
}

function _getSpecialPortalBodyFocusPoint() {
    if (!specialPortalFrameData || !specialPortalFrameData.body) return null;
    return specialPortalFrameData.body.localToWorld(new THREE.Vector3(0, 2.25, 0));
}

function _isSpecialPortalBodyVulnerable() {
    if (!specialPortalFrameData || !specialPortalFrameData.body) return false;
    if (specialPortalFrameData.bodyGone || specialPortalFrameData.fading) return false;
    if ((gameTime / FULL_CYCLE) < NIGHT_START || specialPortalFrameData.nightBlend < 0.35) return false;

    specialPortalFrameData.group.updateMatrixWorld(true);
    const focus = _getSpecialPortalBodyFocusPoint();
    return !!focus && player.position.distanceTo(focus) <= SPECIAL_PORTAL_BODY_HIT_RANGE;
}

function getSpecialPortalBodyGunHits(aimDir, maxRange = AK47_BEAM_MAX_VISUAL_RANGE) {
    if (!_isSpecialPortalBodyVulnerable()) return [];

    specialPortalFrameData.group.updateMatrixWorld(true);
    _specialPortalRaycaster.set(camera.position, aimDir);
    _specialPortalRaycaster.near = 0;
    _specialPortalRaycaster.far = maxRange;

    const hits = _specialPortalRaycaster.intersectObject(specialPortalFrameData.body, true)
        .filter(hit => !hit.object.userData.isEye);
    if (hits.length === 0) return [];

    return [{ kind: 'nooseBody', target: specialPortalFrameData, projected: hits[0].distance }];
}

function tryHitSpecialPortalBodyMelee(aimDir, punchRange) {
    if (!_isSpecialPortalBodyVulnerable()) return false;

    specialPortalFrameData.group.updateMatrixWorld(true);
    _specialPortalRaycaster.set(camera.position, aimDir);
    _specialPortalRaycaster.near = 0;
    _specialPortalRaycaster.far = punchRange;

    const rayHits = _specialPortalRaycaster.intersectObject(specialPortalFrameData.body, true)
        .filter(hit => !hit.object.userData.isEye);
    if (rayHits.length > 0) {
        damageSpecialPortalHangingBody();
        return true;
    }

    const focus = _getSpecialPortalBodyFocusPoint();
    if (!focus) return false;
    const toBody = focus.clone().sub(camera.position);
    const projected = toBody.dot(aimDir);
    if (projected <= 0 || projected > punchRange) return false;
    const perp = toBody.clone().sub(aimDir.clone().multiplyScalar(projected)).length();
    if (perp > 1.7) return false;

    damageSpecialPortalHangingBody();
    return true;
}

function damageSpecialPortalHangingBody() {
    if (!_isSpecialPortalBodyVulnerable()) return false;

    specialPortalFrameData.hitCount = (specialPortalFrameData.hitCount || 0) + 1;

    const hitPoint = _getSpecialPortalBodyFocusPoint();
    if (hitPoint && typeof _spawnHitParticles === 'function') {
        _spawnHitParticles(hitPoint);
    }

    if (specialPortalFrameData.hitCount >= SPECIAL_PORTAL_BODY_HITS_TO_BANISH) {
        _banishSpecialPortalHangingBody();
    }
    return true;
}

function _banishSpecialPortalHangingBody() {
    const data = specialPortalFrameData;
    if (!data || !data.body || data.fading) return;

    data.bodyGone = true;
    data.fading = true;
    data.fadeElapsed = 0;
    data.fadeStartY = data.body.position.y;

    const fadeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85
    });
    data.fadeMaterial = fadeMat;
    data.body.traverse(mesh => {
        if (!mesh.isMesh) return;
        if (mesh.userData.isEye) {
            mesh.visible = false;
            return;
        }
        mesh.material = fadeMat;
    });
}

function _updateSpecialPortalBodyFade(delta) {
    const data = specialPortalFrameData;
    if (!data || !data.fading || !data.body) return;

    data.fadeElapsed += delta;
    const t = Math.min(data.fadeElapsed / SPECIAL_PORTAL_BODY_FADE_DURATION, 1);
    if (data.fadeMaterial) data.fadeMaterial.opacity = 0.85 * (1 - t);
    data.body.position.y = data.fadeStartY + 5 * t;

    if (t >= 1) {
        data.nooseRoot.remove(data.body);
        data.body = null;
        data.fading = false;
        data.fadeMaterial = null;
    }
}

function _updateSpecialPortalBodyAnimation(data, blend) {
    const body = data.body;
    if (!body || data.fading) return;

    const parts = body.userData.nooseParts;
    if (!parts) return;

    const eased = smoothstep01(blend);
    const phase = data.swingPhase || 0;

    if (body.userData.nooseEyeMaterial) {
        body.userData.nooseEyeMaterial.opacity = eased;
    }
    parts.eyes.forEach(eye => {
        eye.visible = eased > 0.03;
    });

    if (parts.head) {
        parts.head.rotation.x = _lerpNooseValue(-0.75, -1.18, eased);
        parts.head.rotation.y = 0.08 * Math.sin(phase * 1.4) * eased;
        parts.head.rotation.z = _lerpNooseValue(0.3, 0.08, eased);
        parts.head.position.y = _lerpNooseValue(parts.head.userData.deadPositionY, parts.head.userData.deadPositionY + 0.16, eased);
        parts.head.position.z = _lerpNooseValue(parts.head.userData.deadPositionZ, parts.head.userData.deadPositionZ - 0.10, eased);
    }

    if (data.nooseLoop) {
        data.nooseLoop.rotation.x = _lerpNooseValue(
            SPECIAL_PORTAL_NOOSE_LOOP_REST_ROT_X,
            SPECIAL_PORTAL_NOOSE_LOOP_ALIVE_ROT_X,
            eased
        );
    }

    for (const arm of parts.arms) {
        const upperActive = _makeNooseEuler(
            arm.upperActive.x + 0.05 * Math.sin(phase * 3.2 + arm.side),
            arm.upperActive.y,
            arm.upperActive.z + arm.side * 0.05 * Math.sin(phase * 2.6)
        );
        const lowerActive = _makeNooseEuler(
            arm.lowerActive.x + 0.08 * Math.sin(phase * 4.1 + arm.side),
            arm.lowerActive.y,
            arm.lowerActive.z + arm.side * 0.06 * Math.cos(phase * 3.0)
        );
        _setNooseEuler(arm.upper.rotation, arm.upperRest, upperActive, eased);
        _setNooseEuler(arm.lower.rotation, arm.lowerRest, lowerActive, eased);
    }

    for (const leg of parts.legs) {
        const upperActive = _makeNooseEuler(
            0.36 * Math.sin(phase * 2.3 + leg.side * 1.8),
            leg.side * 0.14 * Math.sin(phase * 1.7),
            leg.side * (0.10 + 0.24 * Math.sin(phase * 2.0 + leg.side))
        );
        const lowerActive = _makeNooseEuler(
            0.20 + 0.58 * Math.sin(phase * 3.1 + leg.side * 2.4),
            0,
            -leg.side * 0.10 * Math.cos(phase * 2.7)
        );
        const footActive = _makeNooseEuler(
            leg.footRest.x + 0.32 * Math.sin(phase * 4.2 + leg.side),
            0,
            leg.side * 0.12 * Math.sin(phase * 3.5)
        );
        _setNooseEuler(leg.upper.rotation, leg.upperRest, upperActive, eased);
        _setNooseEuler(leg.lower.rotation, leg.lowerRest, lowerActive, eased);
        _setNooseEuler(leg.foot.rotation, leg.footRest, footActive, eased);
    }
}

function updateSpecialPortalNoose(delta) {
    const data = specialPortalFrameData;
    if (!data) return;

    _updateSpecialPortalBodyFade(delta);

    const nowIsNight = (gameTime / FULL_CYCLE) >= NIGHT_START;
    const canAnimate = !!data.body && !data.bodyGone && !data.fading;
    const targetBlend = nowIsNight && canAnimate ? 1 : 0;
    data.nightBlend = moveScalarToward(
        data.nightBlend || 0,
        targetBlend,
        SPECIAL_PORTAL_NIGHT_BLEND_SPEED * delta
    );
    if (!nowIsNight && data.nightBlend <= 0.01 && !data.bodyGone) {
        data.hitCount = 0;
    }

    data.swingPhase = (data.swingPhase || 0) + delta * 1.2 * (0.25 + data.nightBlend);
    const swing = SPECIAL_PORTAL_SWING_AMPLITUDE * smoothstep01(data.nightBlend);
    data.nooseRoot.rotation.z = Math.cos(data.swingPhase) * swing;
    data.nooseRoot.rotation.x = Math.sin(data.swingPhase) * swing * 0.55;

    _updateSpecialPortalBodyAnimation(data, data.nightBlend);
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
        nooseRoot: noose.swingGroup,
        nooseCenterY: noose.nooseCenterY,
        ropeTopY: noose.ropeTopY,
        nooseLoop: noose.loop,
        body: null,
        bodyGone: false,
        nightBlend: 0,
        swingPhase: 0,
        hitCount: 0,
        fading: false
    };

    if (DEBUG_NOOSE || DEBUG_NOOSE_BODY) {
        const spawn = localToWorldXZ(placement.x, placement.z, 0, 20, placement.rotation);
        player.position.set(spawn.x, getGroundHeight(spawn.x, spawn.z), spawn.z);
        cameraYaw = Math.atan2(placement.x - spawn.x, placement.z - spawn.z);
    }

    if (hasTalisman || DEBUG_NOOSE_BODY) spawnSpecialPortalHangingBody();
}
