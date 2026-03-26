function createGround() {
    // Main terrain - higher segment count for smoother visual
    const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, TERRAIN_SEGS, TERRAIN_SEGS);

    // Build height grid and displace vertices
    // PlaneGeometry lies in local XY plane. After rotation.x = -PI/2:
    //   local X -> world X, local Y -> world -Z, local Z (displacement) -> world Y
    const n = TERRAIN_SEGS + 1;
    terrainHeights = new Float32Array(n * n);

    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const lx = vertices[i];
        const ly = vertices[i + 1];
        const baseHeight = getBaseTerrainHeight(lx, -ly);
        const h = carveTerrainHeightForWater(lx, -ly, baseHeight);
        vertices[i + 2] = h;

        // Store height in grid indexed by local coords
        const ix = Math.round((lx + WORLD_SIZE) / (WORLD_SIZE * 2) * TERRAIN_SEGS);
        const iy = Math.round((ly + WORLD_SIZE) / (WORLD_SIZE * 2) * TERRAIN_SEGS);
        if (ix >= 0 && ix <= TERRAIN_SEGS && iy >= 0 && iy <= TERRAIN_SEGS) {
            terrainHeights[iy * n + ix] = h;
        }
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshLambertMaterial({
        color: 0x3d6b3d
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.userData.ignoreCameraOcclusion = true;
    ground.userData.isGround = true;
    ground.receiveShadow = true;
    scene.add(ground);
    groundMesh = ground;

    // Path
    const pathGeometry = new THREE.PlaneGeometry(4, 100, 1, 20);
    const pathMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    const path = new THREE.Mesh(pathGeometry, pathMaterial);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.05;
    path.userData.ignoreCameraOcclusion = true;
    path.receiveShadow = true;
    scene.add(path);
}

function getBaseTerrainHeight(worldX, worldZ) {
    return Math.sin(worldX * 0.02) * Math.cos(worldZ * 0.02) * 5 +
           Math.sin(worldX * 0.05) * Math.cos(worldZ * 0.03) * 2;
}

function sampleTerrainRingStats(x, z, radius, samples = 32) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const sampleX = x + Math.cos(angle) * radius;
        const sampleZ = z + Math.sin(angle) * radius;
        const h = getBaseTerrainHeight(sampleX, sampleZ);
        min = Math.min(min, h);
        max = Math.max(max, h);
        sum += h;
    }

    return {
        min,
        max,
        avg: sum / Math.max(1, samples),
        range: max - min
    };
}

// Returns the polygon edge radius of a water body at a given world angle.
// Vertices are evenly spaced in angle; we linearly interpolate between neighbours.
function waterPolyRadiusAt(water, angle) {
    const verts = water.polyVerts;
    const N = verts.length;
    const twoPi = Math.PI * 2;
    const a = ((angle % twoPi) + twoPi) % twoPi;   // normalise to [0, 2π)
    const segF = a / twoPi * N;
    const i0 = Math.floor(segF) % N;
    const t  = segF - Math.floor(segF);
    return verts[i0].r * (1 - t) + verts[(i0 + 1) % N].r * t;
}

function carveTerrainHeightForWater(worldX, worldZ, baseHeight) {
    let carvedHeight = baseHeight;

    for (const water of waterBodies) {
        const dx = worldX - water.x;
        const dz = worldZ - water.z;
        const dist = Math.hypot(dx, dz);
        if (dist > water.bankOuterRadius) continue;

        // Polygon edge radius in this direction determines where the
        // inner crater ends and the bank transition begins.
        const polyR = waterPolyRadiusAt(water, Math.atan2(dz, dx));

        let targetHeight;
        if (dist <= water.floorRadius) {
            targetHeight = water.floorY;
        } else if (dist <= polyR) {
            const t = smoothstep01((dist - water.floorRadius) / Math.max(0.01, polyR - water.floorRadius));
            targetHeight = water.floorY + (water.surfaceY - water.floorY) * t;
        } else {
            const t = smoothstep01((dist - polyR) / Math.max(0.01, water.bankOuterRadius - polyR));
            targetHeight = water.surfaceY + (baseHeight - water.surfaceY) * t;
        }

        carvedHeight = Math.min(carvedHeight, targetHeight);
    }

    return carvedHeight;
}

function getGroundHeight(worldX, worldZ) {
    if (!terrainHeights) {
        // Fallback before terrain is built
        return getBaseTerrainHeight(worldX, worldZ);
    }
    const n = TERRAIN_SEGS + 1;

    // Map world coords to fractional grid indices.
    // After rotation.x = -PI/2: localX = worldX, localY = -worldZ.
    // My grid stores iy = (localY + WORLD_SIZE) / (2*WORLD_SIZE) * TERRAIN_SEGS,
    // so iy increases with localY, i.e. fy = (WORLD_SIZE + localY) / (2*WORLD_SIZE) * TERRAIN_SEGS.
    const fx = (worldX  + WORLD_SIZE) / (WORLD_SIZE * 2) * TERRAIN_SEGS;
    const fy = (WORLD_SIZE - worldZ) / (WORLD_SIZE * 2) * TERRAIN_SEGS; // = (WORLD_SIZE + localY) / ...

    const ix0 = Math.max(0, Math.min(TERRAIN_SEGS - 1, Math.floor(fx)));
    const iy0 = Math.max(0, Math.min(TERRAIN_SEGS - 1, Math.floor(fy)));
    const ix1 = ix0 + 1;
    const iy1 = iy0 + 1;

    // tx: 0=small localX (left), 1=large localX (right)
    // ty: 0=small localY / large worldZ (bottom), 1=large localY / small worldZ (top)
    const tx = fx - ix0;
    const ty = fy - iy0;

    const h00 = terrainHeights[iy0 * n + ix0]; // BL
    const h10 = terrainHeights[iy0 * n + ix1]; // BR
    const h01 = terrainHeights[iy1 * n + ix0]; // TL
    const h11 = terrainHeights[iy1 * n + ix1]; // TR

    // Three.js PlaneGeometry splits each quad along the BL->TR diagonal (ty == tx).
    // Use exact barycentric interpolation to match the rendered mesh precisely.
    if (ty >= tx) {
        // Upper-left triangle: TL(h01), BL(h00), TR(h11)
        return h01 * (ty - tx) + h00 * (1 - ty) + h11 * tx;
    } else {
        // Lower-right triangle: BL(h00), BR(h10), TR(h11)
        return h00 * (1 - tx) + h10 * (tx - ty) + h11 * ty;
    }
}

