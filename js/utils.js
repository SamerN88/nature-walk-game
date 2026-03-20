function enableMeshShadows(root) {
    root.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
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

function findPlacement(createCandidate, attempts = 160) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const candidate = createCandidate();
        if (!candidate || !candidate.footprint) continue;
        if (!canPlaceFootprint(candidate.footprint)) continue;
        reserveFootprint(candidate.footprint);
        return candidate;
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


