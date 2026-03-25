function planWaterBodies() {
    const waterConfigs = [
        {
            kind: 'lake',
            radiusMin: 179,//90,
            radiusMax: 180,//135,
            region: { type: 'ring', minRadius: 220/*180*/, maxRadius: 1000/*1050*/ },
            flatness: 7.5,
            segments: 60,
            opacity: 0.78
        },
        {
            kind: 'pond',
            radiusMin: 99,//26,
            radiusMax: 100,//42,
            region: { type: 'ring', minRadius: 140, maxRadius: 950 },
            flatness: 5.5,
            segments: 60,
            opacity: 0.72
        },
        {
            kind: 'pond',
            radiusMin: 89,//26,
            radiusMax: 90,//42,
            region: { type: 'ring', minRadius: 140, maxRadius: 950 },
            flatness: 5.5,
            segments: 60,
            opacity: 0.72
        },
        {
            kind: 'pond',
            radiusMin: 79,//26,
            radiusMax: 80,//42,
            region: { type: 'ring', minRadius: 140, maxRadius: 950 },
            flatness: 5.5,
            segments: 60,
            opacity: 0.72
        }
    ];

    waterBodies = [];
    waterConfigs.forEach(config => {
        let placement = null;
        const flatnessPasses = [config.flatness, config.flatness + 2, Infinity];

        for (const allowedRange of flatnessPasses) {
            placement = findPlacement(() => {
                // R is the maximum crater radius; every polygon vertex lies within R.
                const R = randRange(config.radiusMin, config.radiusMax);
                const point = samplePointInRegion(config.region);

                // Flatness check: terrain inside R must not vary too wildly.
                const stats = sampleTerrainStats(point.x, point.z, R,
                    config.kind === 'lake' ? 4 : 3,
                    config.kind === 'lake' ? 14 : 10);
                if (stats.range > allowedRange) return null;

                // Build the crater polygon: 16 vertices evenly spaced in angle,
                // each with radius R * (1 - rand(0, 0.25)).  All vertices lie
                // strictly inside the circle of radius R.
                const POLY_N = 50;
                const polyVerts = [];
                const WATER_EDGE_PERTURBATION = 0.4;
                for (let i = 0; i < POLY_N; i++) {
                    polyVerts.push({ r: R * (1 - Math.random() * WATER_EDGE_PERTURBATION) });
                }

                // Bank: smooth transition zone outside R before terrain returns
                // to its natural height.
                const bankWidth = Math.max(8, R * 0.2);
                const bankOuterRadius = R + bankWidth;

                // surfaceY: sample terrain from R out to bankOuterRadius + a
                // margin, then drop below the minimum so the water surface never
                // sits above surrounding terrain troughs.
                let minSurroundHeight = Infinity;
                const bankSampleStep = Math.max(2, bankWidth * 0.25);
                for (let sr = R; sr <= bankOuterRadius + bankWidth; sr += bankSampleStep) {
                    const rs = sampleTerrainRingStats(point.x, point.z, sr, 50);
                    minSurroundHeight = Math.min(minSurroundHeight, rs.min);
                }
                const surfaceDropMargin = config.kind === 'lake' ? 4 : 2;
                const surfaceY = minSurroundHeight - surfaceDropMargin;

                const craterFloorY = config.kind === 'lake' ? LAKE_CRATER_FLOOR_Y : POND_CRATER_FLOOR_Y;
                const floorY = Math.min(
                    surfaceY - (config.kind === 'lake' ? 10 : 6),
                    craterFloorY
                );

                // Expand cylinderRadius until its full boundary ring sits on
                // terrain at or above surfaceY, so the water mesh never floats
                // visibly above a terrain trough at its edge.
                const CYL_CHECK_ANGLES = 36;
                const CYL_STEP         = 5;
                const CYL_MAX_STEPS    = 10;
                let cylinderRadius = R + 10;
                for (let step = 0; step < CYL_MAX_STEPS; step++) {
                    let ok = true;
                    for (let ci = 0; ci < CYL_CHECK_ANGLES; ci++) {
                        const a = (ci / CYL_CHECK_ANGLES) * 2*Math.PI;
                        const h = getBaseTerrainHeight(
                            point.x + Math.cos(a) * cylinderRadius,
                            point.z + Math.sin(a) * cylinderRadius
                        );
                        if (h <= surfaceY) { 
                            ok = false; 
                            break; 
                        }
                    }
                    if (ok) break;
                    cylinderRadius += CYL_STEP;
                }

                return {
                    kind: config.kind,
                    x: point.x,
                    z: point.z,
                    radius: R,           // used by getWaterBodyAt gameplay check
                    polyVerts,
                    surfaceY,
                    floorY,
                    floorRadius: R * 0.35,
                    bankOuterRadius,
                    cylinderRadius,
                    segments: config.segments,
                    opacity: config.opacity,
                    footprint: makePlacementFootprint(point.x, point.z, bankOuterRadius + 18)
                };
            }, 260);
            if (placement) break;
        }

        if (!placement) return;

        waterBodies.push({
            kind: placement.kind,
            x: placement.x,
            z: placement.z,
            radius: placement.radius,
            polyVerts: placement.polyVerts,
            surfaceY: placement.surfaceY,
            floorY: placement.floorY,
            floorRadius: placement.floorRadius,
            bankOuterRadius: placement.bankOuterRadius,
            cylinderRadius: placement.cylinderRadius,
            segments: placement.segments,
            opacity: placement.opacity,
            mesh: null
        });
    });
}

function createWater() {
    waterBodies.forEach(waterBody => {
        if (waterBody.mesh) return;

        const waterGroup = new THREE.Group();
        waterGroup.userData.ignoreCameraOcclusion = true;
        const waterVisualRadius = waterBody.cylinderRadius;
        const waterSurfaceMaterial = new THREE.MeshPhongMaterial({
            color: waterBody.kind === 'lake' ? 0x2467a8 : 0x2f7fc3,
            emissive: 0x10365a,
            emissiveIntensity: 0.12,
            shininess: 70,
            transparent: true,
            opacity: waterBody.opacity,
            side: THREE.DoubleSide
        });

        const waterSurface = new THREE.Mesh(
            new THREE.CircleGeometry(waterVisualRadius, waterBody.segments),
            waterSurfaceMaterial
        );
        waterSurface.rotation.x = -Math.PI / 2;
        waterSurface.position.y = waterBody.surfaceY;
        waterSurface.receiveShadow = true;
        waterSurface.userData.isWater = true;
        waterGroup.add(waterSurface);

        const waterDepth = Math.max(0.5, waterBody.surfaceY - waterBody.floorY);
        const waterVolumeDepth = waterDepth + WATER_VISUAL_EXTRA_BOTTOM_DEPTH;
        const waterVolumeMaterial = new THREE.MeshPhongMaterial({
            color: waterBody.kind === 'lake' ? 0x2467a8 : 0x2f7fc3,
            emissive: 0x10365a,
            emissiveIntensity: 0.08,
            shininess: 30,
            transparent: true,
            opacity: Math.max(0.22, waterBody.opacity * 0.52),
            side: THREE.DoubleSide
        });
        const waterVolume = new THREE.Mesh(
            new THREE.CylinderGeometry(waterVisualRadius, waterVisualRadius, waterVolumeDepth, waterBody.segments, 1, true),
            waterVolumeMaterial
        );
        waterVolume.position.y = waterBody.surfaceY - waterVolumeDepth / 2;
        waterVolume.userData.isWater = true;
        waterGroup.add(waterVolume);

        if (DEBUG_WATER) {
            const debugWallHeight = 100;
            const debugWall = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    waterVisualRadius,
                    waterVisualRadius,
                    debugWallHeight,
                    waterBody.segments,
                    1,
                    true
                ),
                new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.22,
                    side: THREE.DoubleSide,
                    depthWrite: false
                })
            );
            debugWall.position.y = waterBody.surfaceY + debugWallHeight / 2;
            waterGroup.add(debugWall);
        }

        waterGroup.position.set(waterBody.x, WATER_VISUAL_Y_OFFSET, waterBody.z);
        scene.add(waterGroup);

        waterBody.surfaceMaterial = waterSurfaceMaterial;
        waterBody.volumeMaterial = waterVolumeMaterial;
        waterBody.mesh = waterGroup;
    });

    updateWaterLighting();
}

function updateWaterLighting() {
    if (!ambientLight || !sun) return;

    const lightLevel = THREE.MathUtils.clamp(ambientLight.intensity * 0.9 + sun.intensity * 0.45, 0, 1);
    const surfaceEmissiveIntensity = THREE.MathUtils.lerp(0.02, 0.12, lightLevel);
    const volumeEmissiveIntensity = THREE.MathUtils.lerp(0.01, 0.08, lightLevel);

    waterBodies.forEach(waterBody => {
        if (waterBody.surfaceMaterial) {
            waterBody.surfaceMaterial.emissiveIntensity = surfaceEmissiveIntensity;
        }
        if (waterBody.volumeMaterial) {
            waterBody.volumeMaterial.emissiveIntensity = volumeEmissiveIntensity;
        }
    });
}


function setWaterCombatColor(enable) {
    waterBodies.forEach(wb => {
        if (wb.surfaceMaterial) {
            if (enable) {
                if (wb._origSurfaceColor === undefined) {
                    wb._origSurfaceColor   = wb.surfaceMaterial.color.getHex();
                    wb._origSurfaceEmissive = wb.surfaceMaterial.emissive.getHex();
                }
                wb.surfaceMaterial.color.setHex(0x8B0000);
                wb.surfaceMaterial.emissive.setHex(0x3B0000);
            } else {
                if (wb._origSurfaceColor !== undefined) {
                    wb.surfaceMaterial.color.setHex(wb._origSurfaceColor);
                    wb.surfaceMaterial.emissive.setHex(wb._origSurfaceEmissive);
                }
            }
            wb.surfaceMaterial.needsUpdate = true;
        }
        if (wb.volumeMaterial) {
            if (enable) {
                if (wb._origVolumeColor === undefined) {
                    wb._origVolumeColor   = wb.volumeMaterial.color.getHex();
                    wb._origVolumeEmissive = wb.volumeMaterial.emissive.getHex();
                }
                wb.volumeMaterial.color.setHex(0x8B0000);
                wb.volumeMaterial.emissive.setHex(0x3B0000);
            } else {
                if (wb._origVolumeColor !== undefined) {
                    wb.volumeMaterial.color.setHex(wb._origVolumeColor);
                    wb.volumeMaterial.emissive.setHex(wb._origVolumeEmissive);
                }
            }
            wb.volumeMaterial.needsUpdate = true;
        }
    });
    // Underwater tint: blood-red or original blue
    underwaterTintEl.style.background = enable
        ? 'rgba(140, 0, 0, 0.45)'
        : 'rgba(36, 103, 168, 0.32)';
}

function getWaterBodyAt(x, z) {
    for (const water of waterBodies) {
        const dx = x - water.x;
        const dz = z - water.z;
        if (dx * dx + dz * dz <= water.cylinderRadius * water.cylinderRadius) {
            return water;
        }
    }
    return null;
}

function isPointInWater(x, z) {
    return !!getWaterBodyAt(x, z);
}

function getWaterVisualRadius(water) {
    return water.cylinderRadius;
}

function getWaterLogicalSurfaceY(water) {
    return water.surfaceY + WATER_VISUAL_Y_OFFSET;
}

function getWaterLogicalBottomY(water) {
    return water.floorY + WATER_VISUAL_Y_OFFSET;
}

function isPointInsideWaterCylinder(x, y, z) {
    for (const water of waterBodies) {
        const dx = x - water.x;
        const dz = z - water.z;
        const radius = getWaterVisualRadius(water);
        if (dx * dx + dz * dz > radius * radius) continue;

        const cylinderTopY = getWaterLogicalSurfaceY(water);
        const cylinderBottomY = getWaterLogicalBottomY(water);
        if (y <= cylinderTopY && y >= cylinderBottomY) {
            return water;
        }
    }

    return null;
}

function getWaterSurfaceHeight(x, z) {
    const water = getWaterBodyAt(x, z);
    return water ? getWaterLogicalSurfaceY(water) : -Infinity;
}

function getLandSurfaceHeight(x, z, playerY = undefined) {
    const terrainY = getDragonVolcanoTerrainFloorHeight(x, z, getGroundHeight(x, z));
    return Math.max(terrainY, getStructureHeight(x, z, playerY));
}

function getMoverSurfaceHeight(x, z, allowWater = false) {
    const structureY = getStructureHeight(x, z);
    const terrainY = getDragonVolcanoTerrainFloorHeight(x, z, getGroundHeight(x, z));
    const landY = Math.max(terrainY, structureY);

    if (!allowWater) return landY;

    const water = getWaterBodyAt(x, z);
    if (!water) return landY;
    const logicalSurfaceY = getWaterLogicalSurfaceY(water);
    if (structureY > logicalSurfaceY + WATER_SURFACE_STRUCTURE_CLEARANCE) return structureY;
    return logicalSurfaceY;
}

function getWaterTraversalState(x, z, y, entityHeight = 0) {
    const terrainY = getDragonVolcanoTerrainFloorHeight(x, z, getGroundHeight(x, z));
    const structureY = getStructureHeight(x, z, y);
    const landY = Math.max(terrainY, structureY);
    const water = getWaterBodyAt(x, z);

    if (!water) {
        return {
            water: null,
            terrainY,
            structureY,
            landY,
            floorY: landY,
            surfaceY: -Infinity,
            structureAboveWater: false,
            maxFloatY: landY,
            isSwimming: false
        };
    }

    const logicalSurfaceY = getWaterLogicalSurfaceY(water);
    const structureAboveWater = structureY > logicalSurfaceY + WATER_SURFACE_STRUCTURE_CLEARANCE;
    const floorY = structureAboveWater ? structureY : terrainY;
    const maxFloatY = Math.max(
        floorY,
        logicalSurfaceY - entityHeight * (1 - PLAYER_WATER_SURFACE_EMERGENCE)
    );
    const isSwimming = !structureAboveWater && y < logicalSurfaceY - 0.02 && floorY < logicalSurfaceY - 0.05;

    return {
        water,
        terrainY,
        structureY,
        landY,
        floorY,
        surfaceY: logicalSurfaceY,
        structureAboveWater,
        maxFloatY,
        isSwimming
    };
}

