function enableMeshShadows(root) {
    root.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
    });
}

function enableMeshReceiveShadowOnly(root) {
    root.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = false;
        obj.receiveShadow = true;
    });
}

function smoothstep01(t) {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
}

function backgroundDist() {
    return 1500 + Math.random() * 500;
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function randomRotationY() {
    return Math.random() * Math.PI * 2;
}

function rotateXZ(x, z, rotation = 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
        x: x * cos + z * sin,
        z: -x * sin + z * cos
    };
}

function localToWorldXZ(originX, originZ, localX, localZ, rotation = 0) {
    const rotated = rotateXZ(localX, localZ, rotation);
    return {
        x: originX + rotated.x,
        z: originZ + rotated.z
    };
}

function worldToLocalXZ(worldX, worldZ, originX, originZ, rotation = 0) {
    const dx = worldX - originX;
    const dz = worldZ - originZ;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
        x: dx * cos - dz * sin,
        z: dx * sin + dz * cos
    };
}

function getRotatedHalfExtents(halfW, halfD, rotation = 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
        x: Math.abs(cos) * halfW + Math.abs(sin) * halfD,
        z: Math.abs(sin) * halfW + Math.abs(cos) * halfD
    };
}

function isPointInRotatedRect(x, z, rect) {
    const local = worldToLocalXZ(x, z, rect.x, rect.z, rect.rotation || 0);
    return Math.abs(local.x) <= rect.halfW && Math.abs(local.z) <= rect.halfD;
}

function rayHitSphere(rayOrigin, rayDir, center, radius, maxDistance = Infinity) {
    const oc = new THREE.Vector3().subVectors(rayOrigin, center);
    const b = oc.dot(rayDir);
    const c = oc.dot(oc) - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    let distance = -b - sqrtDisc;
    if (distance < 0) distance = -b + sqrtDisc;
    if (distance < 0) distance = 0;
    if (distance > maxDistance) return null;

    return {
        distance,
        point: rayOrigin.clone().addScaledVector(rayDir, distance)
    };
}

function rayHitCapsule(rayOrigin, rayDir, segmentA, segmentB, radius, maxDistance = Infinity) {
    const axis = new THREE.Vector3().subVectors(segmentB, segmentA);
    const length = axis.length();
    if (length < 1e-5) {
        return rayHitSphere(rayOrigin, rayDir, segmentA, radius, maxDistance);
    }
    axis.multiplyScalar(1 / length);

    let right = new THREE.Vector3(0, 1, 0).cross(axis);
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0).cross(axis);
    right.normalize();
    const forward = new THREE.Vector3().crossVectors(axis, right).normalize();

    const relOrigin = new THREE.Vector3().subVectors(rayOrigin, segmentA);
    const ox = relOrigin.dot(right);
    const oy = relOrigin.dot(axis);
    const oz = relOrigin.dot(forward);
    const dx = rayDir.dot(right);
    const dy = rayDir.dot(axis);
    const dz = rayDir.dot(forward);

    let bestDistance = Infinity;
    const considerDistance = (distance) => {
        if (distance < 0 || distance > maxDistance || distance >= bestDistance) return;
        bestDistance = distance;
    };

    const sphereA = rayHitSphere(rayOrigin, rayDir, segmentA, radius, maxDistance);
    if (sphereA) considerDistance(sphereA.distance);
    const sphereB = rayHitSphere(rayOrigin, rayDir, segmentB, radius, maxDistance);
    if (sphereB) considerDistance(sphereB.distance);

    const a = dx * dx + dz * dz;
    if (a > 1e-8) {
        const b = 2 * (ox * dx + oz * dz);
        const c = ox * ox + oz * oz - radius * radius;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            const sqrtDisc = Math.sqrt(disc);
            const invDenom = 1 / (2 * a);
            const t0 = (-b - sqrtDisc) * invDenom;
            const t1 = (-b + sqrtDisc) * invDenom;
            [t0, t1].forEach(distance => {
                const y = oy + dy * distance;
                if (y >= 0 && y <= length) considerDistance(distance);
            });
        }
    } else if (ox * ox + oz * oz <= radius * radius && oy >= 0 && oy <= length) {
        considerDistance(0);
    }

    if (bestDistance === Infinity) return null;
    return {
        distance: bestDistance,
        point: rayOrigin.clone().addScaledVector(rayDir, bestDistance)
    };
}

function getRaySegmentFrame(rayOrigin, rayDir, segmentA, segmentB) {
    const axis = new THREE.Vector3().subVectors(segmentB, segmentA);
    const length = axis.length();
    if (length < 1e-5) return null;
    axis.multiplyScalar(1 / length);

    let right = new THREE.Vector3(0, 1, 0).cross(axis);
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0).cross(axis);
    right.normalize();
    const forward = new THREE.Vector3().crossVectors(axis, right).normalize();

    const relOrigin = new THREE.Vector3().subVectors(rayOrigin, segmentA);
    return {
        length,
        ox: relOrigin.dot(right),
        oy: relOrigin.dot(axis),
        oz: relOrigin.dot(forward),
        dx: rayDir.dot(right),
        dy: rayDir.dot(axis),
        dz: rayDir.dot(forward)
    };
}

function rayHitFrustum(rayOrigin, rayDir, segmentA, segmentB, radiusStart, radiusEnd, maxDistance = Infinity) {
    const frame = getRaySegmentFrame(rayOrigin, rayDir, segmentA, segmentB);
    if (!frame) return rayHitSphere(rayOrigin, rayDir, segmentA, Math.max(radiusStart, radiusEnd), maxDistance);

    let bestDistance = Infinity;
    const considerDistance = (distance) => {
        if (distance < 0 || distance > maxDistance || distance >= bestDistance) return;
        bestDistance = distance;
    };

    const { length, ox, oy, oz, dx, dy, dz } = frame;
    const slope = (radiusEnd - radiusStart) / length;
    const radiusAtOriginY = radiusStart + slope * oy;
    const radiusDir = slope * dy;
    const a = dx * dx + dz * dz - radiusDir * radiusDir;
    const b = 2 * (ox * dx + oz * dz - radiusAtOriginY * radiusDir);
    const c = ox * ox + oz * oz - radiusAtOriginY * radiusAtOriginY;

    if (Math.abs(a) > 1e-8) {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            const sqrtDisc = Math.sqrt(disc);
            const invDenom = 1 / (2 * a);
            [(-b - sqrtDisc) * invDenom, (-b + sqrtDisc) * invDenom].forEach(distance => {
                const y = oy + dy * distance;
                if (y >= 0 && y <= length) considerDistance(distance);
            });
        }
    } else if (Math.abs(b) > 1e-8) {
        const distance = -c / b;
        const y = oy + dy * distance;
        if (y >= 0 && y <= length) considerDistance(distance);
    }

    if (Math.abs(dy) > 1e-8) {
        [
            { y: 0, radius: radiusStart },
            { y: length, radius: radiusEnd }
        ].forEach(cap => {
            if (cap.radius <= 1e-5) return;
            const distance = (cap.y - oy) / dy;
            const x = ox + dx * distance;
            const z = oz + dz * distance;
            if (x * x + z * z <= cap.radius * cap.radius) considerDistance(distance);
        });
    }

    if (bestDistance === Infinity) return null;
    return {
        distance: bestDistance,
        point: rayOrigin.clone().addScaledVector(rayDir, bestDistance)
    };
}

function rayHitLocalBox(rayOrigin, rayDir, center, halfSize, maxDistance = Infinity) {
    let tMin = 0;
    let tMax = maxDistance;
    const axes = ['x', 'y', 'z'];

    for (const axis of axes) {
        const min = center[axis] - halfSize[axis];
        const max = center[axis] + halfSize[axis];
        const origin = rayOrigin[axis];
        const dir = rayDir[axis];

        if (Math.abs(dir) < 1e-8) {
            if (origin < min || origin > max) return null;
            continue;
        }

        let t1 = (min - origin) / dir;
        let t2 = (max - origin) / dir;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;
    }

    const distance = tMin >= 0 ? tMin : tMax;
    if (distance < 0 || distance > maxDistance) return null;
    return {
        distance,
        point: rayOrigin.clone().addScaledVector(rayDir, distance)
    };
}

function getHitProfileWorldScale(root) {
    if (!root || !root.getWorldScale) return 1;
    const scale = root.getWorldScale(new THREE.Vector3());
    return Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
}

function localHitPointToWorld(root, localPoint) {
    const point = localPoint.isVector3
        ? localPoint.clone()
        : new THREE.Vector3(localPoint.x || 0, localPoint.y || 0, localPoint.z || 0);
    return root ? root.localToWorld(point) : point;
}

function getHitProfileLocalHalfSize(profile) {
    const hs = profile.halfSize || {};
    return new THREE.Vector3(hs.x || 0, hs.y || 0, hs.z || 0);
}

function getHitProfileWorldRadius(root, radius, fixedWorldRadius, radiusExtra = 0) {
    const worldScale = getHitProfileWorldScale(root);
    return (fixedWorldRadius ?? ((radius || 0) * worldScale)) + radiusExtra;
}

function attachHitProfileResultMeta(hit, root, profile) {
    if (!hit) return null;
    hit.root = root || null;
    hit.profile = profile;
    return hit;
}

function rayHitProfile(rayOrigin, rayDir, root, profile, maxDistance = Infinity, radiusExtra = 0) {
    if (!profile) return null;
    if (root && root.updateMatrixWorld) root.updateMatrixWorld(true);

    if (profile.shape === 'compound') {
        let best = null;
        for (const childProfile of profile.profiles || []) {
            const hit = rayHitProfile(rayOrigin, rayDir, root, childProfile, maxDistance, radiusExtra);
            if (hit && (!best || hit.distance < best.distance)) best = hit;
        }
        if (best) best.profile = profile;
        return best;
    }

    if (profile.shape === 'sphere') {
        const center = localHitPointToWorld(root, profile.center || { x: 0, y: 0, z: 0 });
        const radius = getHitProfileWorldRadius(root, profile.radius, profile.fixedWorldRadius, radiusExtra);
        const hit = rayHitSphere(rayOrigin, rayDir, center, radius, maxDistance);
        if (!hit) return null;
        hit.center = center;
        return attachHitProfileResultMeta(hit, root, profile);
    }

    if (profile.shape === 'capsule') {
        const a = localHitPointToWorld(root, profile.start || { x: 0, y: 0, z: 0 });
        const b = localHitPointToWorld(root, profile.end || { x: 0, y: 0, z: 0 });
        const radius = getHitProfileWorldRadius(root, profile.radius, profile.fixedWorldRadius, radiusExtra);
        const hit = rayHitCapsule(rayOrigin, rayDir, a, b, radius, maxDistance);
        if (!hit) return null;
        hit.segmentA = a;
        hit.segmentB = b;
        return attachHitProfileResultMeta(hit, root, profile);
    }

    if (profile.shape === 'frustum' || profile.shape === 'cone' || profile.shape === 'cylinder') {
        const a = localHitPointToWorld(root, profile.start || { x: 0, y: 0, z: 0 });
        const b = localHitPointToWorld(root, profile.end || { x: 0, y: 0, z: 0 });
        const defaultEndRadius = profile.shape === 'cylinder'
            ? (profile.radiusStart ?? profile.radiusBottom ?? profile.radius)
            : 0;
        const fixedRadiusStart = profile.fixedWorldRadiusStart ?? profile.fixedWorldRadius;
        const fixedRadiusEnd = profile.fixedWorldRadiusEnd ?? (profile.shape === 'cylinder' ? fixedRadiusStart : undefined);
        const radiusStart = getHitProfileWorldRadius(root, profile.radiusStart ?? profile.radiusBottom ?? profile.radius, fixedRadiusStart, radiusExtra);
        const radiusEnd = getHitProfileWorldRadius(root, profile.radiusEnd ?? profile.radiusTop ?? defaultEndRadius, fixedRadiusEnd, radiusExtra);
        const hit = rayHitFrustum(rayOrigin, rayDir, a, b, radiusStart, radiusEnd, maxDistance);
        if (!hit) return null;
        hit.segmentA = a;
        hit.segmentB = b;
        return attachHitProfileResultMeta(hit, root, profile);
    }

    if (profile.shape === 'box') {
        if (!root) return null;
        const inverse = root.matrixWorld.clone().invert();
        const localOrigin = rayOrigin.clone().applyMatrix4(inverse);
        const localDir = rayDir.clone().transformDirection(inverse).normalize();
        const center = localHitProfilePoint(profile.center);
        const halfSize = getHitProfileLocalHalfSize(profile);
        const localHit = rayHitLocalBox(localOrigin, localDir, center, halfSize, maxDistance);
        if (!localHit) return null;

        const worldPoint = localHit.point.clone().applyMatrix4(root.matrixWorld);
        return attachHitProfileResultMeta({
            distance: worldPoint.distanceTo(rayOrigin),
            point: worldPoint
        }, root, profile);
    }

    return null;
}

function isHitWithinPlayerReach(hit, reach) {
    if (!hit || !player) return false;
    if (hit.overlapsPlayer) return true;  // Case 2: hitbox overlaps player capsule
    const midY = player.position.y + PLAYER_COLLISION_HEIGHT * 0.5;
    const dx = hit.point.x - player.position.x;
    const dy = hit.point.y - midY;
    const dz = hit.point.z - player.position.z;
    return dx * dx + dy * dy + dz * dz <= reach * reach;
}

function getCameraPlayerHitMinDistance(margin = 1.5) {
    if (!camera || !player) return 0;
    return Math.max(0, camera.position.distanceTo(player.position) - margin);
}

// ── Segment distance helpers ──────────────────────────────────────────────────

const _dptsAB = new THREE.Vector3();
const _dptsClosest = new THREE.Vector3();

function distPointToSegment(point, segA, segB) {
    _dptsAB.subVectors(segB, segA);
    const lenSq = _dptsAB.lengthSq();
    const t = lenSq > 0
        ? Math.max(0, Math.min(1, _dptsClosest.subVectors(point, segA).dot(_dptsAB) / lenSq))
        : 0;
    _dptsClosest.copy(segA).addScaledVector(_dptsAB, t);
    return point.distanceTo(_dptsClosest);
}

const _dssD1 = new THREE.Vector3();
const _dssD2 = new THREE.Vector3();
const _dssR  = new THREE.Vector3();
const _dssC1 = new THREE.Vector3();
const _dssC2 = new THREE.Vector3();

// Returns { distance, t } where t is the parameter along [p3,p4] at the closest point.
function distSegmentToSegment(p1, p2, p3, p4) {
    _dssD1.subVectors(p2, p1);
    _dssD2.subVectors(p4, p3);
    _dssR.subVectors(p1, p3);

    const a = _dssD1.dot(_dssD1);
    const e = _dssD2.dot(_dssD2);
    const f = _dssD2.dot(_dssR);

    let s, t;

    if (a <= 1e-10 && e <= 1e-10) {
        return { distance: p1.distanceTo(p3), t: 0 };
    }
    if (a <= 1e-10) {
        s = 0;
        t = Math.max(0, Math.min(1, f / e));
    } else {
        const c = _dssD1.dot(_dssR);
        if (e <= 1e-10) {
            t = 0;
            s = Math.max(0, Math.min(1, -c / a));
        } else {
            const b = _dssD1.dot(_dssD2);
            const denom = a * e - b * b;
            s = denom !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
            t = (b * s + f) / e;
            if (t < 0) {
                t = 0;
                s = Math.max(0, Math.min(1, -c / a));
            } else if (t > 1) {
                t = 1;
                s = Math.max(0, Math.min(1, (b - c) / a));
            }
        }
    }

    _dssC1.copy(p1).addScaledVector(_dssD1, s);
    _dssC2.copy(p3).addScaledVector(_dssD2, t);
    return { distance: _dssC1.distanceTo(_dssC2), t };
}

// ── Player capsule intersection test ─────────────────────────────────────────

const _phcHead = new THREE.Vector3();
const _phcBoxLocalFeet = new THREE.Vector3();
const _phcBoxLocalHead = new THREE.Vector3();

// Returns true if the target's hit profile intersects the player's capsule hitbox.
// Player capsule: feet at player.position, head at player.position + (0, PLAYER_COLLISION_HEIGHT, 0), radius PLAYER_HIT_RADIUS.
function doesHitProfileIntersectPlayerCapsule(root, profile) {
    if (!player || !profile) return false;
    if (root && root.updateMatrixWorld) root.updateMatrixWorld(true);

    const feet = player.position;
    _phcHead.set(feet.x, feet.y + PLAYER_COLLISION_HEIGHT, feet.z);

    if (profile.shape === 'compound') {
        return (profile.profiles || []).some(p => doesHitProfileIntersectPlayerCapsule(root, p));
    }

    if (profile.shape === 'sphere') {
        const center = localHitPointToWorld(root, profile.center || { x: 0, y: 0, z: 0 });
        const radius = getHitProfileWorldRadius(root, profile.radius, profile.fixedWorldRadius, 0);
        return distPointToSegment(center, feet, _phcHead) < radius + PLAYER_HIT_RADIUS;
    }

    if (profile.shape === 'capsule' || profile.shape === 'cylinder') {
        const a = localHitPointToWorld(root, profile.start || { x: 0, y: 0, z: 0 });
        const b = localHitPointToWorld(root, profile.end || { x: 0, y: 0, z: 0 });
        const radius = getHitProfileWorldRadius(root, profile.radius, profile.fixedWorldRadius, 0);
        return distSegmentToSegment(feet, _phcHead, a, b).distance < radius + PLAYER_HIT_RADIUS;
    }

    if (profile.shape === 'cone' || profile.shape === 'frustum') {
        const a = localHitPointToWorld(root, profile.start || { x: 0, y: 0, z: 0 });
        const b = localHitPointToWorld(root, profile.end || { x: 0, y: 0, z: 0 });
        const fixedRadiusStart = profile.fixedWorldRadiusStart ?? profile.fixedWorldRadius;
        const fixedRadiusEnd   = profile.fixedWorldRadiusEnd ?? undefined;
        const radiusStart = getHitProfileWorldRadius(root, profile.radiusStart ?? profile.radiusBottom ?? profile.radius, fixedRadiusStart, 0);
        const radiusEnd   = getHitProfileWorldRadius(root, profile.radiusEnd   ?? profile.radiusTop    ?? 0,               fixedRadiusEnd,   0);
        const { distance, t } = distSegmentToSegment(feet, _phcHead, a, b);
        return distance < (radiusStart + (radiusEnd - radiusStart) * t) + PLAYER_HIT_RADIUS;
    }

    if (profile.shape === 'box') {
        if (!root) return false;
        const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        _phcBoxLocalFeet.copy(feet).applyMatrix4(inv);
        _phcBoxLocalHead.copy(_phcHead).applyMatrix4(inv);
        const center = localHitProfilePoint(profile.center);
        const hs = getHitProfileLocalHalfSize(profile);
        // Expand box by player capsule radius (Minkowski sum): capsule overlaps iff
        // segment [localFeet, localHead] penetrates the expanded AABB.
        const worldScale = getHitProfileWorldScale(root);
        const r = PLAYER_HIT_RADIUS / Math.max(worldScale, 1e-5);
        const expandedHs = new THREE.Vector3(hs.x + r, hs.y + r, hs.z + r);
        const segDir = new THREE.Vector3().subVectors(_phcBoxLocalHead, _phcBoxLocalFeet);
        const segLen = segDir.length();
        if (segLen < 1e-5) {
            // Degenerate segment: point-in-expanded-AABB check
            return Math.abs(_phcBoxLocalFeet.x - center.x) <= expandedHs.x &&
                   Math.abs(_phcBoxLocalFeet.y - center.y) <= expandedHs.y &&
                   Math.abs(_phcBoxLocalFeet.z - center.z) <= expandedHs.z;
        }
        segDir.divideScalar(segLen);
        return rayHitLocalBox(_phcBoxLocalFeet, segDir, center, expandedHs, segLen) !== null;
    }

    return false;
}

// ── Camera-player gap hit acceptance ─────────────────────────────────────────
//
// A ray fired from the camera can intersect targets that are physically between
// the camera and the player ("in the gap"). These must be rejected unless the
// target hitbox physically overlaps the player (legitimate close-range hit).
//
// Gap test: a target is "behind the player" if its hit point lies outside the
// forward cone centred on the player's mid-body and opening in the aim direction.
// Tune CAMERA_GAP_CONE_HALF_ANGLE_DEG: wider accepts more side hits, narrower
// tightens gap rejection. 90° = exact forward hemisphere (dot > 0 boundary).
//
// Three cases:
//   Case 1  hit point inside cone  →  accept
//   Case 2  hit point outside cone AND hitbox overlaps player capsule  →  accept
//   Case 3  hit point outside cone AND no player overlap  →  reject
//
// playerReach is kept in the signature for call-site compatibility but is unused;
// range gating is handled by isHitWithinPlayerReach after this call.

const CAMERA_GAP_CONE_HALF_ANGLE_DEG = 120;
const _cameraGapConeCosThreshold = Math.cos(CAMERA_GAP_CONE_HALF_ANGLE_DEG * Math.PI / 180);
const _playerToHit = new THREE.Vector3();
const _playerMidBody = new THREE.Vector3();

function rayHitProfileBeyondCameraPlayerGap(rayOrigin, rayDir, root, profile, maxDistance = Infinity, playerReach = Infinity, radiusExtra = 0) {
    const firstHit = rayHitProfile(rayOrigin, rayDir, root, profile, maxDistance, radiusExtra);
    if (!firstHit) return null;

    if (!camera || !player) return firstHit;

    _playerMidBody.set(
        player.position.x,
        player.position.y + PLAYER_COLLISION_HEIGHT * 0.5,
        player.position.z
    );
    _playerToHit.subVectors(firstHit.point, _playerMidBody);
    const len = _playerToHit.length();

    // inGap: hit point is outside the forward cone (behind the player)
    const inGap = len < 1e-5 || _playerToHit.dot(rayDir) < _cameraGapConeCosThreshold * len;

    if (!inGap) return firstHit;  // Case 1: in front of player

    if (doesHitProfileIntersectPlayerCapsule(root, profile)) {
        firstHit.overlapsPlayer = true;
        return firstHit;  // Case 2: behind player but touching player capsule
    }

    return null;  // Case 3: behind player, not touching player
}

// ─── DEBUG_HIT_FRUSTUM ──────────────────────────────────────────────────────
const _HIT_FRUSTUM_LENGTH = 50;
let _hitFrustumMesh = null;
const _hitFrustumAimDir  = new THREE.Vector3();
const _hitFrustumMidBody = new THREE.Vector3();
const _hitFrustumAxisRef = new THREE.Vector3(0, -1, 0); // ConeGeometry tip is at +Y/2

function createHitFrustumDebug() {
    if (!DEBUG_HIT_FRUSTUM || !scene) return;
    const halfAngleRad = CAMERA_GAP_CONE_HALF_ANGLE_DEG * Math.PI / 180;
    const coneRadius = CAMERA_GAP_CONE_HALF_ANGLE_DEG < 90
        ? _HIT_FRUSTUM_LENGTH * Math.tan(halfAngleRad)
        : _HIT_FRUSTUM_LENGTH * 5; // 90°: effectively infinite — cap at something visible
    _hitFrustumMesh = new THREE.Mesh(
        new THREE.ConeGeometry(coneRadius, _HIT_FRUSTUM_LENGTH, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
    );
    _hitFrustumMesh.renderOrder = 49;
    _hitFrustumMesh.userData.ignoreCameraOcclusion = true;
    _hitFrustumMesh.userData.isHitboxDebug = true;
    scene.add(_hitFrustumMesh);
}

function updateHitFrustumDebug() {
    if (!_hitFrustumMesh || !player || !camera) return;
    camera.getWorldDirection(_hitFrustumAimDir);
    _hitFrustumMidBody.set(
        player.position.x,
        player.position.y + PLAYER_COLLISION_HEIGHT * 0.5,
        player.position.z
    );
    // Place mesh center halfway along the cone axis (apex at playerMidBody, base _HIT_FRUSTUM_LENGTH ahead)
    _hitFrustumMesh.position.copy(_hitFrustumMidBody).addScaledVector(_hitFrustumAimDir, _HIT_FRUSTUM_LENGTH * 0.5);
    // ConeGeometry tip points in +Y; we want tip at playerMidBody pointing toward aimDir,
    // so rotate -Y → aimDir (apex goes in +aimDir direction)
    _hitFrustumMesh.quaternion.setFromUnitVectors(_hitFrustumAxisRef, _hitFrustumAimDir);
}
// ────────────────────────────────────────────────────────────────────────────

let _hitboxDebugMaterial = null;
let _hitboxDebugUnitSphereGeometry = null;

function getHitboxDebugMaterial() {
    if (!_hitboxDebugMaterial) {
        _hitboxDebugMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }
    return _hitboxDebugMaterial;
}

function makeHitboxDebugSphereMesh(radius) {
    if (!_hitboxDebugUnitSphereGeometry) {
        _hitboxDebugUnitSphereGeometry = new THREE.SphereGeometry(1, 18, 10);
    }
    const mesh = new THREE.Mesh(_hitboxDebugUnitSphereGeometry, getHitboxDebugMaterial());
    mesh.scale.setScalar(radius);
    mesh.userData.ignoreCameraOcclusion = true;
    mesh.userData.isHitboxDebug = true;
    mesh.renderOrder = 50;
    return mesh;
}

function localHitProfilePoint(pointLike) {
    return pointLike?.isVector3
        ? pointLike.clone()
        : new THREE.Vector3(pointLike?.x || 0, pointLike?.y || 0, pointLike?.z || 0);
}

function getLocalDebugRadius(root, profile, radiusExtra = 0) {
    const worldScale = Math.max(1e-5, getHitProfileWorldScale(root));
    if (profile.fixedWorldRadius !== undefined) {
        return (profile.fixedWorldRadius + radiusExtra) / worldScale;
    }
    return (profile.radius || 0) + radiusExtra / worldScale;
}

function getLocalDebugRadiusValue(root, radius, fixedWorldRadius, radiusExtra = 0) {
    const worldScale = Math.max(1e-5, getHitProfileWorldScale(root));
    if (fixedWorldRadius !== undefined) return (fixedWorldRadius + radiusExtra) / worldScale;
    return (radius || 0) + radiusExtra / worldScale;
}

function createHitProfileDebugMesh(root, profile, radiusExtra = 0) {
    if (!root || !profile) return null;
    const radius = getLocalDebugRadius(root, profile, radiusExtra);
    let mesh = null;

    if (profile.shape === 'compound') {
        mesh = new THREE.Group();
        for (const childProfile of profile.profiles || []) {
            const childMesh = createHitProfileDebugMesh(root, childProfile, radiusExtra);
            if (childMesh) mesh.add(childMesh);
        }
    } else if (profile.shape === 'sphere') {
        mesh = makeHitboxDebugSphereMesh(radius);
        mesh.position.copy(localHitProfilePoint(profile.center));
    } else if (profile.shape === 'capsule') {
        const start = localHitProfilePoint(profile.start);
        const end = localHitProfilePoint(profile.end);
        const segment = end.clone().sub(start);
        const length = segment.length();
        mesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(radius, Math.max(0.001, length), 8, 16),
            getHitboxDebugMaterial()
        );
        mesh.position.copy(start).add(end).multiplyScalar(0.5);
        if (length > 1e-5) {
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), segment.normalize());
        }
        mesh.userData.ignoreCameraOcclusion = true;
        mesh.userData.isHitboxDebug = true;
        mesh.renderOrder = 50;
    } else if (profile.shape === 'frustum' || profile.shape === 'cone' || profile.shape === 'cylinder') {
        const start = localHitProfilePoint(profile.start);
        const end = localHitProfilePoint(profile.end);
        const segment = end.clone().sub(start);
        const length = segment.length();
        const defaultEndRadius = profile.shape === 'cylinder'
            ? (profile.radiusStart ?? profile.radiusBottom ?? profile.radius)
            : 0;
        const fixedRadiusStart = profile.fixedWorldRadiusStart ?? profile.fixedWorldRadius;
        const fixedRadiusEnd = profile.fixedWorldRadiusEnd ?? (profile.shape === 'cylinder' ? fixedRadiusStart : undefined);
        const radiusStart = getLocalDebugRadiusValue(root, profile.radiusStart ?? profile.radiusBottom ?? profile.radius, fixedRadiusStart, radiusExtra);
        const radiusEnd = getLocalDebugRadiusValue(root, profile.radiusEnd ?? profile.radiusTop ?? defaultEndRadius, fixedRadiusEnd, radiusExtra);
        mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radiusEnd, radiusStart, Math.max(0.001, length), 18, 1, false),
            getHitboxDebugMaterial()
        );
        mesh.position.copy(start).add(end).multiplyScalar(0.5);
        if (length > 1e-5) {
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), segment.normalize());
        }
        mesh.userData.ignoreCameraOcclusion = true;
        mesh.userData.isHitboxDebug = true;
        mesh.renderOrder = 50;
    } else if (profile.shape === 'box') {
        const halfSize = getHitProfileLocalHalfSize(profile);
        mesh = new THREE.Mesh(
            new THREE.BoxGeometry(halfSize.x * 2, halfSize.y * 2, halfSize.z * 2),
            getHitboxDebugMaterial()
        );
        mesh.position.copy(localHitProfilePoint(profile.center));
        mesh.userData.ignoreCameraOcclusion = true;
        mesh.userData.isHitboxDebug = true;
        mesh.renderOrder = 50;
    }

    if (mesh && profile.shape === 'compound') {
        mesh.traverse(obj => {
            obj.userData.ignoreCameraOcclusion = true;
            obj.userData.isHitboxDebug = true;
            obj.renderOrder = 50;
        });
    }
    return mesh;
}

function attachHitProfileDebugVisual(root, profile, options = {}) {
    if (!DEBUG_HITBOXES || !root || !profile) return null;
    const key = options.key || 'hitboxDebug';
    if (root.userData[key]) return root.userData[key];

    const mesh = createHitProfileDebugMesh(root, profile, options.radiusExtra || 0);
    if (!mesh) return null;
    root.add(mesh);
    root.userData[key] = mesh;
    return mesh;
}

function setObjectHitProfile(root, profile, options = {}) {
    if (!root || !profile) return profile;
    const key = options.profileKey || 'hitProfile';
    root.userData[key] = profile;
    attachHitProfileDebugVisual(root, profile, { key: options.debugKey || `${key}Debug`, radiusExtra: options.radiusExtra || 0 });
    return profile;
}

function makeWorldHitProfileRoot(position, profile, options = {}) {
    const root = new THREE.Object3D();
    root.position.copy(position);
    root.userData.ignoreCameraOcclusion = true;
    if (scene) scene.add(root);

    const key = options.profileKey || 'hitProfile';
    root.userData[key] = profile;
    if (options.radiusExtra !== undefined) root.userData.hitRadiusExtra = options.radiusExtra;
    attachHitProfileDebugVisual(root, profile, {
        key: options.debugKey || `${key}Debug`,
        radiusExtra: options.radiusExtra || 0
    });
    return root;
}

function rayHitObjectProfile(rayOrigin, rayDir, root, maxDistance = Infinity, options = {}) {
    if (!root) return null;
    const profile = options.profile || root.userData[options.profileKey || 'hitProfile'];
    if (!profile) return null;
    return rayHitProfile(rayOrigin, rayDir, root, profile, maxDistance, options.radiusExtra || 0);
}

function rayHitObjectProfileBeyondCameraPlayerGap(rayOrigin, rayDir, root, maxDistance = Infinity, options = {}) {
    if (!root) return null;
    const profile = options.profile || root.userData[options.profileKey || 'hitProfile'];
    if (!profile) return null;
    return rayHitProfileBeyondCameraPlayerGap(rayOrigin, rayDir, root, profile, maxDistance, Infinity, options.radiusExtra || 0);
}

function getPlacementRadiusForRect(width, depth, extra = 0) {
    return Math.hypot(width * 0.5, depth * 0.5) + extra;
}

function samplePointInRegion(region) {
    if (region.type === 'ring') {
        const angle = Math.random() * Math.PI * 2;
        const distance = randRange(region.minRadius, region.maxRadius);
        return {
            x: Math.cos(angle) * distance,
            z: Math.sin(angle) * distance
        };
    }

    return {
        x: randRange(region.minX, region.maxX),
        z: randRange(region.minZ, region.maxZ)
    };
}

function makePlacementFootprint(x, z, radius) {
    return { x, z, radius };
}

function isFootprintWithinWorld(footprint) {
    const limit = footprint.limit ?? STRUCTURE_WORLD_LIMIT;
    return Math.abs(footprint.x) <= limit - footprint.radius &&
           Math.abs(footprint.z) <= limit - footprint.radius;
}

function overlapsOriginClearZone(footprint) {
    return Math.hypot(footprint.x, footprint.z) < ORIGIN_CLEAR_RADIUS + footprint.radius;
}

function footprintsOverlap(a, b, gap = STRUCTURE_PLACEMENT_GAP) {
    const minDist = a.radius + b.radius + gap;
    return (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < minDist * minDist;
}

function canPlaceFootprint(footprint) {
    if (!isFootprintWithinWorld(footprint)) return false;
    if (overlapsOriginClearZone(footprint)) return false;

    for (const existing of placementFootprints) {
        if (footprintsOverlap(footprint, existing)) return false;
    }

    return true;
}

function reserveFootprint(footprint) {
    placementFootprints.push({ ...footprint });
}

function tryReservePlacementCandidate(candidate) {
    if (!candidate || !candidate.footprint) return null;
    if (!canPlaceFootprint(candidate.footprint)) return null;
    reserveFootprint(candidate.footprint);
    return candidate;
}

function findPlacement(createCandidate, attempts = 160) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const placement = tryReservePlacementCandidate(createCandidate());
        if (placement) return placement;
    }
    return null;
}

function getRegionSearchPoints(region, density = 1) {
    const points = [];

    if (region.type === 'ring') {
        const radialSteps = Math.max(6, Math.round(12 * density));
        const angleSteps = Math.max(16, Math.round(28 * density));
        const span = Math.max(1e-5, region.maxRadius - region.minRadius);
        const centerRadius = region.minRadius + span * 0.5;
        const radii = [];

        for (let i = 0; i <= radialSteps; i++) {
            radii.push(region.minRadius + (span * i / radialSteps));
        }
        radii.sort((a, b) => Math.abs(a - centerRadius) - Math.abs(b - centerRadius));

        radii.forEach((radius, radiusIndex) => {
            const angleOffset = (radiusIndex % 2) * (Math.PI / angleSteps);
            for (let step = 0; step < angleSteps; step++) {
                const angle = angleOffset + (step / angleSteps) * Math.PI * 2;
                points.push({
                    x: Math.cos(angle) * radius,
                    z: Math.sin(angle) * radius
                });
            }
        });

        return points;
    }

    const width = region.maxX - region.minX;
    const depth = region.maxZ - region.minZ;
    const stepsX = Math.max(5, Math.round(11 * density));
    const stepsZ = Math.max(5, Math.round(11 * density));
    const xs = [];
    const zs = [];
    const centerX = (region.minX + region.maxX) * 0.5;
    const centerZ = (region.minZ + region.maxZ) * 0.5;

    for (let i = 0; i <= stepsX; i++) {
        xs.push(region.minX + (width * i / stepsX));
    }
    for (let i = 0; i <= stepsZ; i++) {
        zs.push(region.minZ + (depth * i / stepsZ));
    }

    xs.sort((a, b) => Math.abs(a - centerX) - Math.abs(b - centerX));
    zs.sort((a, b) => Math.abs(a - centerZ) - Math.abs(b - centerZ));

    xs.forEach((x, ix) => {
        zs.forEach((z, iz) => {
            // ix=0 and iz=0 are closest to center (arrays are pre-sorted by distance from center),
            // so ix+iz correctly orders points from center outward.
            points.push({ x, z, _sortKey: ix + iz });
        });
    });

    points.sort((a, b) => a._sortKey - b._sortKey);
    points.forEach(point => delete point._sortKey);
    return points;
}

function findPlacementInRegion(region, createCandidateFromPoint, attempts = 160, options = {}) {
    const pointDensity = options.pointDensity ?? 1;
    const rotationCount = options.rotationCount ?? 1;

    const tryCandidate = (point, rotation) => {
        return tryReservePlacementCandidate(createCandidateFromPoint(point, rotation));
    };

    for (let attempt = 0; attempt < attempts; attempt++) {
        const point = samplePointInRegion(region);
        const placement = tryCandidate(point, null);
        if (placement) return placement;
    }

    const searchPoints = getRegionSearchPoints(region, pointDensity);
    for (const point of searchPoints) {
        for (let step = 0; step < rotationCount; step++) {
            const rotation = rotationCount <= 1
                ? null
                : (step / rotationCount) * Math.PI * 2;
            const placement = tryCandidate(point, rotation);
            if (placement) return placement;
        }
    }

    return null;
}

function sampleTerrainStats(x, z, radius, ringCount = 3, samplesPerRing = 10) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    const sampleHeight = (sx, sz) => {
        const h = getGroundHeight(sx, sz);
        min = Math.min(min, h);
        max = Math.max(max, h);
        sum += h;
        count++;
    };

    sampleHeight(x, z);

    for (let ring = 1; ring <= ringCount; ring++) {
        const dist = radius * (ring / ringCount);
        for (let i = 0; i < samplesPerRing; i++) {
            const angle = (i / samplesPerRing) * Math.PI * 2 + (ring * 0.17);
            sampleHeight(
                x + Math.cos(angle) * dist,
                z + Math.sin(angle) * dist
            );
        }
    }

    return {
        min,
        max,
        avg: sum / Math.max(1, count),
        range: max - min
    };
}

function sampleCircleBoundaryMinGroundHeight(x, z, radius, samples) {
    let min = Infinity;

    for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const sampleX = x + Math.cos(angle) * radius;
        const sampleZ = z + Math.sin(angle) * radius;
        min = Math.min(min, getGroundHeight(sampleX, sampleZ));
    }

    return min;
}

function sampleRectBoundaryMinGroundHeight(x, z, width, depth, rotation = 0, samples = PRIMITIVE_BLOCK_EDGE_SAMPLE_COUNT) {
    let min = Infinity;
    const perimeter = width * 2 + depth * 2;

    for (let i = 0; i < samples; i++) {
        const t = (i / samples) * perimeter;
        let localX = 0;
        let localZ = 0;

        if (t < width) {
            localX = -width / 2 + t;
            localZ = -depth / 2;
        } else if (t < width + depth) {
            localX = width / 2;
            localZ = -depth / 2 + (t - width);
        } else if (t < width * 2 + depth) {
            localX = width / 2 - (t - width - depth);
            localZ = depth / 2;
        } else {
            localX = -width / 2;
            localZ = depth / 2 - (t - width * 2 - depth);
        }

        const world = localToWorldXZ(x, z, localX, localZ, rotation);
        min = Math.min(min, getGroundHeight(world.x, world.z));
    }

    return min;
}

function getStructureBoundaryDrop(baseY, minBoundaryGroundY) {
    return Math.max(0, baseY - minBoundaryGroundY);
}

function moveScalarToward(current, target, maxStep) {
    const delta = target - current;
    if (Math.abs(delta) <= maxStep) return target;
    return current + Math.sign(delta) * maxStep;
}
