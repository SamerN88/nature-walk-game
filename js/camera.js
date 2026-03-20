function updateSunShadowFocus() {
    if (!sun) return;

    const focus = mountedOnDragon && dragon && dragon.visible
        ? dragon.position
        : (player ? player.position : camera.position);
    const cycleProgress = gameTime / FULL_CYCLE;
    const sunAngle = cycleProgress * Math.PI * 2 - Math.PI / 2;

    sun.target.position.set(focus.x, focus.y, focus.z);
    sun.position.x = focus.x + Math.cos(sunAngle) * 500;
    sun.position.y = focus.y + Math.sin(sunAngle) * 500 + 200;
    sun.position.z = focus.z + 200;
    sun.target.updateMatrixWorld();
}


function shouldIgnoreCameraOcclusion(object) {
    for (let current = object; current; current = current.parent) {
        if (current === player) return true;
        if (current.userData.ignoreCameraOcclusion || current.userData.isBeam) return true;
    }
    return false;
}

function resolveThirdPersonCameraPosition(targetPoint, desiredPosition) {
    const toCamera = desiredPosition.clone().sub(targetPoint);
    const desiredDistance = toCamera.length();
    if (desiredDistance <= 0.001) return desiredPosition;

    toCamera.normalize();
    cameraOcclusionRaycaster.set(targetPoint, toCamera);
    cameraOcclusionRaycaster.far = desiredDistance;

    const hit = cameraOcclusionRaycaster.intersectObjects(scene.children, true)
        .find(result => !shouldIgnoreCameraOcclusion(result.object));

    if (!hit) return desiredPosition;

    const safeDistance = Math.max(
        CAMERA_OCCLUSION_MIN_DISTANCE,
        hit.distance - CAMERA_OCCLUSION_BUFFER
    );

    return targetPoint.clone().addScaledVector(
        toCamera,
        Math.min(desiredDistance, safeDistance)
    );
}

