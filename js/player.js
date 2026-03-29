function createPlayer() {
    player = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1, 8, 16);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
    playerBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    playerBody.position.y = 1;
    playerBody.castShadow = true;
    player.add(playerBody);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.9;
    head.castShadow = true;
    player.add(head);

    // Hair
    const hairGeometry = new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.y = 1.95;
    hair.castShadow = true;
    player.add(hair);

    const playerAk47Model = createAK47Mesh(0.9);
    playerAk47 = playerAk47Model.mesh;
    playerAk47Muzzle = playerAk47Model.muzzle;
    playerAk47.position.set(-0.44, 1.18, 0.2);
    playerAk47.rotation.set(0, 0, 0);
    playerAk47.visible = false;
    player.add(playerAk47);

    playerShovel = createShovelMesh(0.85);
    // Held at right side, angled forward-down like carrying a shovel
    playerShovel.position.set(-0.44, 1.7, 0.7);
    playerShovel.rotation.set(Math.PI/3.5, 0, Math.PI);
    playerShovel.visible = false;
    player.add(playerShovel);

    playerStakeMesh = createPlayerStakeMesh(0.85);
    playerStakeMesh.position.set(-0.44, 1.7, 0.7);
    playerStakeMesh.rotation.set(Math.PI/3.5, 0, Math.PI);
    playerStakeMesh.visible = false;
    player.add(playerStakeMesh);

    playerTorchMesh = createPlayerTorchMesh(0.85);
    playerTorchMesh.position.set(-0.44, 1.7, 0.7);
    playerTorchMesh.rotation.set(Math.PI/3.5, 0, Math.PI);
    playerTorchMesh.visible = false;
    player.add(playerTorchMesh);

    torchEquippedLight = new THREE.PointLight(0xFF6600, 0, 150, 1.2);
    torchEquippedLight.position.set(0, 2.5, 1);
    torchEquippedLight.castShadow = true;
    torchEquippedLight.shadow.mapSize.set(200, 200); // RECONSIDER: this degrades performance a bit, do we need it?
    torchEquippedLight.shadow.bias = -0.0008;
    torchEquippedLight.shadow.normalBias = 0.08;
    torchEquippedLight.shadow.radius = 2;
    player.add(torchEquippedLight);

    const flashMat = new THREE.MeshBasicMaterial({
        color: AK47_BEAM_COLOR,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    ak47MuzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 15), flashMat);
    ak47MuzzleFlash.position.set(0, 0, 0.18);
    ak47MuzzleFlash.rotation.x = Math.PI / 2;
    ak47MuzzleFlash.visible = false;
    ak47MuzzleFlash.frustumCulled = false;
    ak47MuzzleFlash.renderOrder = 70;
    playerAk47Muzzle.add(ak47MuzzleFlash);

    ak47MuzzleLight = new THREE.PointLight(AK47_BEAM_COLOR, 0, 26);
    ak47MuzzleLight.position.set(0, 0, 0.08);
    playerAk47Muzzle.add(ak47MuzzleLight);

    // Sword (right hand side)
    playerSwordMesh = createSwordMesh(0.6);
    playerSwordMesh.position.set(-0.48, 1.0, 0.25);
    playerSwordMesh.rotation.set(-3*Math.PI / 4, Math.PI / 2.5, -Math.PI);
    playerSwordMesh.visible = false;
    player.add(playerSwordMesh);

    // Shield (left hand side)
    playerShieldMesh = createShieldMesh(0.84);
    playerShieldMesh.position.set(0.53, 1.15, 0.24);
    playerShieldMesh.rotation.set(0, Math.PI / 4.5, -Math.PI / 12);
    playerShieldMesh.visible = false;
    player.add(playerShieldMesh);

    player.position.set(0, 0, 0);
    scene.add(player);

    if (DEBUG_SHADOW_MAN) trySpawnShadowMan();

    if (DEBUG_CUTSCENE) {
        const dcX = 0, dcZ = 150;
        const dcMesh = createShadowManMesh();
        dcMesh.position.set(dcX, getGroundHeight(dcX, dcZ), dcZ);
        dcMesh.rotation.y = Math.PI; // face back toward player at origin
        scene.add(dcMesh);
        shadowMan = {
            mesh: dcMesh,
            spawnDistance: 150,
            disappearDistance: 0,
            maxPlayerDistance: 99999,
            finalPhase: true
        };
    }
}
