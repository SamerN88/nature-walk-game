// ===== Save / Load system =====
//
// Electron builds persist gameplay to JSON save files (via the window.gameSaves
// bridge exposed by electron/preload.js). Each save file owns a world seed:
// Math.random is replaced with a seeded PRNG before init(), so world generation
// (terrain carving, water/structure/HH/cemetery/altar placement, forests) replays
// identically on every load. On top of that deterministic world, applySnapshot()
// restores all dynamic state captured by captureSnapshot().
//
// In a plain browser (no window.gameSaves) the game behaves exactly as before:
// a Start button and no persistence.

const SAVE_FORMAT_VERSION = 1;

// ── Seeded RNG ────────────────────────────────────────────────────────────────

const _nativeRandom = Math.random.bind(Math);

function _mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function applyGameSeed(seed) {
    const rng = _mulberry32(seed >>> 0);
    Math.random = () => rng();
}

function makeNewSeed() {
    return Math.floor(_nativeRandom() * 0xFFFFFFFF) >>> 0;
}

// ── Save-file plumbing ────────────────────────────────────────────────────────

const SAVE_API = (typeof window !== 'undefined' && window.gameSaves) ? window.gameSaves : null;
const AUTOSAVE_INTERVAL_MS = 5000;
const RESUME_SESSION_KEY = 'nw-resume-save';

let gameStarted = false;
let activeSaveId = null;
let activeSaveMeta = { name: null, createdAt: null, seed: null };
let _autosaveTimer = null;
let _lastGoodSnapshot = null;
let _saveWriteInFlight = false;

function _buildSaveRecord(snapshot) {
    return {
        version: SAVE_FORMAT_VERSION,
        name: activeSaveMeta.name,
        seed: activeSaveMeta.seed,
        createdAt: activeSaveMeta.createdAt,
        updatedAt: Date.now(),
        snapshot,
    };
}

async function _writeActiveSave(snapshot) {
    if (!SAVE_API || !activeSaveId || _saveWriteInFlight) return;
    _saveWriteInFlight = true;
    try {
        await SAVE_API.write(activeSaveId, _buildSaveRecord(snapshot));
    } catch (err) {
        console.error('Save write failed:', err);
    } finally {
        _saveWriteInFlight = false;
    }
}

function startAutosave() {
    if (!SAVE_API || !activeSaveId || _autosaveTimer) return;
    _autosaveTimer = setInterval(() => {
        if (!gameStarted || !canSnapshotNow()) return;
        try {
            _lastGoodSnapshot = captureSnapshot();
        } catch (err) {
            console.error('Snapshot capture failed:', err);
            return;
        }
        _writeActiveSave(_lastGoodSnapshot);
    }, AUTOSAVE_INTERVAL_MS);
}

// Saves, then returns to the title screen (via a clean page reload — no
// auto-resume marker, so the player lands on the save-file selection screen).
async function saveAndQuitGame() {
    if (!SAVE_API) return;
    if (_autosaveTimer) { clearInterval(_autosaveTimer); _autosaveTimer = null; }
    let snapshot = _lastGoodSnapshot;
    if (gameStarted && canSnapshotNow()) {
        try { snapshot = captureSnapshot(); } catch (err) { console.error('Snapshot capture failed:', err); }
    }
    gameStarted = false;
    if (activeSaveId && snapshot) {
        try { await SAVE_API.write(activeSaveId, _buildSaveRecord(snapshot)); }
        catch (err) { console.error('Final save failed:', err); }
    }
    location.reload();
}

// Called from hardReset(): reset the active save to a brand-new world (new seed)
// and relaunch straight into it. Returns false in browser mode.
function resetActiveSaveAndReload() {
    if (!SAVE_API || !activeSaveId) return false;
    if (_autosaveTimer) { clearInterval(_autosaveTimer); _autosaveTimer = null; }
    gameStarted = false; // stop any in-flight autosave from re-writing old state
    activeSaveMeta.seed = makeNewSeed();
    try { sessionStorage.setItem(RESUME_SESSION_KEY, activeSaveId); } catch (e) {}
    SAVE_API.write(activeSaveId, _buildSaveRecord(null))
        .catch(err => console.error('World reset save failed:', err))
        .finally(() => location.reload());
    return true;
}

// States that cannot be captured mid-flight (short scripted transitions driven by
// timeouts/cutscene phases). Autosave simply waits them out; Save & quit falls
// back to the last good autosave (at most 5 s old).
function canSnapshotNow() {
    if (!gameStarted) return false;
    if (playerDead) return false;
    if (shadowManCutscene) return false;
    if (hhSeqPhase === 'flashbang') return false;
    if (altarState === 'struck' || altarState === 'ascending') return false;
    if (specialPortalFrameData && specialPortalFrameData.fading) return false;
    return true;
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

function _v3(v) { return [v.x, v.y, v.z]; }
function _setV3(v, a) { v.set(a[0], a[1], a[2]); }

// ── Capture ───────────────────────────────────────────────────────────────────

function captureSnapshot() {
    // If captured while paused (menu open), don't count the in-progress pause
    // toward elapsed session time — gameStartRealTimeMs is only shifted on resume.
    const _activePauseMs = (typeof _pauseStartedAtMs !== 'undefined' && _pauseStartedAtMs >= 0)
        ? performance.now() - _pauseStartedAtMs
        : 0;
    const snap = {
        version: SAVE_FORMAT_VERSION,

        session: {
            elapsedRealMs: performance.now() - gameStartRealTimeMs - _activePauseMs,
            gameTime,
            timeTransition: _timeTransition
                ? { fromTime: _timeTransition.fromTime, toTime: _timeTransition.toTime,
                    elapsed: _timeTransition.elapsed, duration: _timeTransition.duration }
                : null,
        },

        player: {
            position: _v3(player.position),
            rotY: player.rotation.y,
            velocity: _v3(velocity),
            cameraYaw, cameraPitch,
            isGrounded, isJumping, canJump,
            playerHealth, dragonHealth,
        },

        progress: {
            killCount,
            killBreakdown: { ...killBreakdown },
            respawnRate,
            gemCollected, boostUnlocked, boostActive, boostFromBeam,
            dragonGemCollected, dragonAscended, holyGemCollected,
            hasGoldenKey, ak47Collected, hasShovel, hasStick, hasTorch,
            hasSwordShield, hasTalisman, infiniteJump,
            farmerPermanentlyKilled,
            savedNpcCounts: savedNpcCounts ? { ...savedNpcCounts } : null,
            savedFarmerPresent,
            handSlots: handSlots.slice(),
            currentHandItem,
            inventoryItems: inventoryItems.map(i => ({
                id: i.id, name: i.name, imgSrc: i.imgSrc, type: i.type, itemKey: i.itemKey
            })),
            swordAuraActive, swordPostAuraKills,
            digCount, talismanGraveDigCount,
            keyHintNoteDropped, keyHintNotePickedUp, volcanoHintNotePickedUp,
            hintStage, hintRevealed, hintModalConfirmed,
            hintMilestonesMet: _hintMilestonesMet.slice(),
            campfireShieldTimer,
        },

        worldItems: {
            goldenKey: goldenKeyMesh
                ? { pos: _v3(goldenKeyMesh.position), baseY: goldenKeyBaseY }
                : null,
            keyHintNote: (keyHintNoteMesh && !keyHintNotePickedUp)
                ? { pos: _v3(keyHintNoteMesh.position), baseY: keyHintNoteMesh.userData.baseY }
                : null,
            akChest: akChest
                ? { opened: akChest.opened, collected: akChest.collected }
                : null,
            treeHits: trees.reduce((acc, tree, i) => {
                if (tree.userData.treeHitCount > 0) acc[i] = tree.userData.treeHitCount;
                return acc;
            }, {}),
            houseDoors: houseDoors.map(d => ({
                isOpen: d.isOpen, angle: d.angle, targetAngle: d.targetAngle
            })),
        },

        cemetery: cemeteryData ? {
            gatesLocked: cemeteryData.gatesLocked,
            gateRotL: cemeteryData.gatePivotL.rotation.y,
            gateRotR: cemeteryData.gatePivotR.rotation.y,
            gateTargetL: cemeteryData.gateTargetL,
            gateTargetR: cemeteryData.gateTargetR,
            gateWallActive: cemeteryData.gateWall.active !== false,
            talismanItemDropped: !!talismanItemMesh,
            talismanBaseY,
        } : null,

        altar: {
            created: !!altarData,
            state: altarState,
            corpseStruck: altarCorpseStruck,
            torchesLit: altarData ? altarData.torches.map(t => !!t.lit) : [],
        },

        hh: {
            exists: !!hauntedHouseData,
            phase: hhSeqPhase,
            timer: hhSeqTimer,
            torchExtinguished: hhTorchExtinguished,
            savedSequenceGameTime: hhSavedSequenceGameTime,
            firstAngelSpawned: hhFirstAngelSpawned,
            firstAngelApproaching: hhFirstAngelApproaching,
            angelWaveStage: hhAngelWaveStage,
            angelWaveTimer: hhAngelWaveTimer,
            angelStageSpawnCount: hhAngelStageSpawnCount,
            lastTorchState: hhLastTorchState,
            ssTaken: hauntedHouseData ? !hauntedHouseData.ssItemGrp.visible : true,
            entranceBlocked: hauntedHouseData ? hauntedHouseData.entranceBlockWall.active === true : false,
            hallDoorAngle: hauntedHouseData ? hauntedHouseData.hhHallDoorAngle : -Math.PI / 2,
            hallDoorTargetAngle: hauntedHouseData ? hauntedHouseData.hhHallDoorTargetAngle : -Math.PI / 2,
            hallDoorWallActive: hauntedHouseData ? hauntedHouseData.hallDoorBlockWall.active === true : false,
            crawlerEligible: hauntedHouseData ? hauntedHouseData.hhHallCrawlerEligible : false,
            crawlerEncounterStarted: hauntedHouseData ? hauntedHouseData.hhHallCrawlerEncounterStarted : false,
            crawlerUnreleased: !!(hauntedHouseData && hauntedHouseData.hhHallCrawler && !hauntedHouseData.hhHallCrawler.released),
            crawlerReleased: !!(hauntedHouseData && hauntedHouseData.hhHallCrawler && hauntedHouseData.hhHallCrawler.released),
            angels: hhAngels.filter(a => a.mesh).map(a => ({
                pos: _v3(a.mesh.position),
                rotY: a.mesh.rotation.y,
                specialFirst: a.specialFirst,
                freezeLockDist: a.freezeLockDist,
                speed: a.speed,
                oscillate: a.oscillate,
                ignoreLookFreeze: a.ignoreLookFreeze,
                hitsTaken: a.hitsTaken,
                noTalismanHits: a.noTalismanHits,
                hitCooldown: a.hitCooldown,
            })),
        },

        creatures: {
            list: nightCreatures.map(c => ({
                type: c.type,
                pos: _v3(c.mesh.position),
                rotY: c.mesh.rotation.y,
                hp: c.hp,
                hitCooldown: c.hitCooldown,
                isCemZombie: c.isCemZombie,
                isHHSpecialCrawler: !!c.isHHSpecialCrawler,
                speed: c.speed,
                emergeTimer: c.emergeTimer,
                emergeStartY: c.emergeStartY,
                emergeTargetY: c.emergeTargetY,
            })),
            spawnUnlocked: _ncSpawnUnlocked,
            wasNight: _ncWasNight,
            spawnTimer: _ncSpawnTimer,
            cemZombieCountdown: _cemZombieCountdown,
            cemZombiesSpawned: _cemZombiesSpawned,
            preSequenceGameTime: _preSequenceGameTime,
            nightTransitionTimer: _nightTransitionTimer,
            openWorldSpawned: _ncOpenWorldSpawned,
        },

        demonApocalypse,
        demonTeleportUnlockTimer,
        apocalypseRespawnCount: _apocalypseRespawnCount,
        demons: demons.map(d => ({
            pos: _v3(d.mesh.position),
            rotY: d.mesh.rotation.y,
            demonType: d.demonType ?? Math.max(0, (d.gunShotsToKill ?? 3) - 3),
            speed: d.speed,
            hitTimer: d.hitTimer,
            gunShotsToKill: d.gunShotsToKill,
            animPhase: d.animPhase,
            teleportTimer: d.teleportTimer,
        })),

        shadowman: {
            totalSpawns: shadowManTotalSpawns,
            phase3Ready: shadowManPhase3Ready,
            postApocalypseUnlocked: shadowManPostApocalypseUnlocked,
            nextCheckMs: shadowManNextCheckMs,
            active: shadowMan ? {
                pos: _v3(shadowMan.mesh.position),
                rotY: shadowMan.mesh.rotation.y,
                spawnDistance: shadowMan.spawnDistance,
                disappearDistance: shadowMan.disappearDistance,
                maxPlayerDistance: Number.isFinite(shadowMan.maxPlayerDistance) ? shadowMan.maxPlayerDistance : null,
                finalPhase: shadowMan.finalPhase,
            } : null,
        },

        hellrun: {
            roundKillCount, roundMode, currentRound,
            roundDemonsTotal, roundDemonsSpawned, roundSpawnTimer, roundBatchSize,
            roundBetweenActive, roundBetweenTimer,
            shrineExists: !!shrine,
            shrineVisible: shrine ? shrine.visible : false,
            shrineActive,
            bestDemonRoundsReached, bestDemonRoundsKills, hasPlayedDemonRounds,
        },

        dragon: {
            visible: dragon ? dragon.visible : false,
            pos: dragon ? _v3(dragon.position) : [0, 200, 0],
            rotY: dragon ? dragon.rotation.y : 0,
            velocity: _v3(dragonVelocity),
            descending: dragonDescending,
            mounted: mountedOnDragon,
            lavaTimer: dragonLavaTimer,
            bondKills: dragonBondKills,
            bondFormed: dragonBondFormed,
            tethered: dragonTethered,
            tetherShotTimer: dragonTetherShotTimer,
            ascended: dragonAscended,
        },

        secretGem: (secretGem && !gemCollected)
            ? { x: secretGem.x, z: secretGem.z, baseY: secretGem.baseY }
            : null,

        noose: specialPortalFrameData ? {
            bodySpawned: !!specialPortalFrameData.body,
            bodyGone: specialPortalFrameData.bodyGone,
            nightBlend: specialPortalFrameData.nightBlend,
            swingPhase: specialPortalFrameData.swingPhase,
            hitCount: specialPortalFrameData.hitCount || 0,
        } : null,

        npcs: npcs.map(n => {
            const base = {
                type: n.type,
                pos: _v3(n.mesh.position),
                rotY: n.mesh.rotation.y,
                speed: n.speed,
                direction: n.direction,
                changeTimer: n.changeTimer,
                changeInterval: n.changeInterval,
                waterBobPhase: n.waterBobPhase,
            };
            if (n.type === 'bird') {
                base.birdScale = n.birdScale ?? n.mesh.scale.x;
                base.bodyColor = n.bodyColor;
                base.flyHeight = n.flyHeight;
                base.wingPhase = n.wingPhase;
            } else if (n.type === 'rabbit') {
                base.hopTimer = n.hopTimer;
            } else if (n.type === 'human') {
                base.isFarmer = !!n.isFarmer;
                base.appearance = n.appearance || null;
                base.walkPhase = n.walkPhase;
            }
            return base;
        }),
    };

    return snap;
}

// ── Apply (restore) ───────────────────────────────────────────────────────────

function _applyApocalypseEnvironment() {
    scene.background = new THREE.Color(0x6B0000);
    scene.fog.color = new THREE.Color(0x3B0000);
    scene.fog.near = 60;
    scene.fog.far = 500;
    sun.color.setHex(0xFF2200);
    sun.intensity = 0.45;
    ambientLight.color.setHex(0x550000);
    ambientLight.intensity = 0.35;
    updateWaterLighting();
    setWaterCombatColor(true);
    document.getElementById('demon-counter').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
}

function _restoreNPCs(list) {
    for (const npc of npcs) scene.remove(npc.mesh);
    npcs.length = 0;

    for (const n of list) {
        switch (n.type) {
            case 'deer': createDeer(); break;
            case 'rabbit': createRabbit(); break;
            case 'bird': createBird(n.birdScale ?? 1, { bodyColor: n.bodyColor }); break;
            case 'human':
                createHuman({
                    isFarmer: n.isFarmer,
                    appearance: n.appearance || undefined,
                    spawnPosition: { x: n.pos[0], z: n.pos[2] },
                });
                break;
            default: continue;
        }
        const npc = npcs[npcs.length - 1];
        _setV3(npc.mesh.position, n.pos);
        npc.mesh.rotation.y = n.rotY;
        npc.speed = n.speed;
        npc.direction = n.direction;
        npc.changeTimer = n.changeTimer;
        npc.changeInterval = n.changeInterval;
        npc.waterBobPhase = n.waterBobPhase;
        if (n.type === 'bird') {
            npc.flyHeight = n.flyHeight;
            npc.wingPhase = n.wingPhase;
        } else if (n.type === 'rabbit') {
            npc.hopTimer = n.hopTimer;
        } else if (n.type === 'human') {
            npc.walkPhase = n.walkPhase;
        }
    }
}

function _restoreNightCreature(c) {
    let mesh, gunHitCenterY, gunHitRadius;
    if (c.type === 'zombie') {
        mesh = _buildZombieMesh();
        gunHitCenterY = 1.4; gunHitRadius = 0.80;
    } else if (c.type === 'crawler') {
        mesh = _buildCrawlerMesh();
        gunHitCenterY = 0.30; gunHitRadius = 0.75;
    } else {
        mesh = _buildWeepingAngelMesh();
        gunHitCenterY = 1.80; gunHitRadius = 0.85;
    }
    if (c.isHHSpecialCrawler) {
        _makeHHHallCrawlerBlack(mesh);
        mesh.userData.hhHallCrawler = true;
    }
    mesh.userData.ignoreCameraOcclusion = true;
    _setV3(mesh.position, c.pos);
    mesh.rotation.y = c.rotY;
    const hitProfile = makeCreatureHitProfile(c.type);
    attachHitProfileDebugVisual(mesh, hitProfile);
    scene.add(mesh);

    nightCreatures.push({
        type: c.type,
        mesh,
        hp: c.hp,
        hitCooldown: c.hitCooldown,
        gunHitCenterY,
        gunHitRadius,
        hitProfile,
        isCemZombie: c.isCemZombie,
        isHHSpecialCrawler: c.isHHSpecialCrawler,
        speed: c.speed,
        emergeTimer: c.emergeTimer,
        emergeStartY: c.emergeStartY,
        emergeTargetY: c.emergeTargetY,
    });
}

function _restoreHHAngel(a) {
    const mesh = _buildWeepingAngelMesh();
    mesh.userData.ignoreCameraOcclusion = true;
    _setV3(mesh.position, a.pos);
    mesh.rotation.y = a.rotY;
    scene.add(mesh);

    const partMeshes = [];
    mesh.traverse(obj => { if (obj.isMesh) partMeshes.push(obj); });

    const hitProfile = makeCreatureHitProfile('angel');
    attachHitProfileDebugVisual(mesh, hitProfile);

    hhAngels.push({
        mesh,
        specialFirst: a.specialFirst,
        freezeLockDist: a.freezeLockDist,
        speed: a.speed,
        oscillate: a.oscillate,
        ignoreLookFreeze: a.ignoreLookFreeze,
        hitsTaken: a.hitsTaken,
        noTalismanHits: a.noTalismanHits,
        hitCooldown: a.hitCooldown,
        hitProfile,
        touchTriggered: false,
        partMeshes,
        partBaseX: partMeshes.map(m => m.position.x),
    });
}

function applySnapshot(snap) {
    // ── Session clock & day/night ────────────────────────────────────────────
    gameStartRealTimeMs = performance.now() - snap.session.elapsedRealMs;
    lastTime = performance.now();
    gameTime = snap.session.gameTime;
    _timeTransition = snap.session.timeTransition ? { ...snap.session.timeTransition } : null;

    // ── Progression flags / items ────────────────────────────────────────────
    const p = snap.progress;
    killCount = p.killCount;
    killBreakdown = { ...p.killBreakdown };
    respawnRate = p.respawnRate;
    gemCollected = p.gemCollected;
    boostUnlocked = p.boostUnlocked;
    boostActive = p.boostActive;
    boostFromBeam = p.boostFromBeam;
    dragonGemCollected = p.dragonGemCollected;
    holyGemCollected = p.holyGemCollected;
    hasGoldenKey = p.hasGoldenKey;
    ak47Collected = p.ak47Collected;
    hasShovel = p.hasShovel;
    hasStick = p.hasStick;
    hasTorch = p.hasTorch;
    hasSwordShield = p.hasSwordShield;
    hasTalisman = p.hasTalisman;
    infiniteJump = p.infiniteJump;
    farmerPermanentlyKilled = p.farmerPermanentlyKilled;
    savedNpcCounts = p.savedNpcCounts ? { ...p.savedNpcCounts } : null;
    savedFarmerPresent = p.savedFarmerPresent;
    handSlots = p.handSlots.slice();
    currentHandItem = p.currentHandItem;
    digCount = p.digCount;
    talismanGraveDigCount = p.talismanGraveDigCount;
    keyHintNoteDropped = p.keyHintNoteDropped;
    keyHintNotePickedUp = p.keyHintNotePickedUp;
    volcanoHintNotePickedUp = p.volcanoHintNotePickedUp;
    hintStage = p.hintStage;
    hintRevealed = p.hintRevealed;
    hintModalConfirmed = p.hintModalConfirmed;
    for (let i = 0; i < _hintMilestonesMet.length; i++) {
        _hintMilestonesMet[i] = !!p.hintMilestonesMet[i];
    }
    campfireShieldTimer = p.campfireShieldTimer;

    for (const item of p.inventoryItems) {
        addInventoryItem(item.id, item.name, item.imgSrc, { type: item.type, itemKey: item.itemKey });
    }

    // ── World items ──────────────────────────────────────────────────────────
    if (hasShovel && tentShovelMesh) {
        tentShovelMesh.parent.remove(tentShovelMesh);
        tentShovelMesh = null;
    }

    const w = snap.worldItems;
    if (w.goldenKey) {
        spawnGoldenKey(w.goldenKey.pos[0], w.goldenKey.baseY, w.goldenKey.pos[2]);
        goldenKeyLockTimer = 0;
        goldenKeySpawnTime = performance.now() - 10000;
    }
    if (w.keyHintNote) {
        spawnKeyHintNote(new THREE.Vector3(
            w.keyHintNote.pos[0], w.keyHintNote.baseY - 0.9, w.keyHintNote.pos[2]
        ));
        keyHintNoteLockTimer = 0;
        keyHintNoteSpawnTime = performance.now() - 10000;
    }
    if (volcanoHintNotePickedUp && volcanoHintNoteMesh) {
        volcanoHintNoteMesh.removeFromParent();
        volcanoHintNoteMesh = null;
    }
    if (w.akChest && akChest) {
        akChest.opened = w.akChest.opened;
        akChest.collected = w.akChest.collected;
        akChest.lidTargetAngle = akChest.opened ? akChest.lidOpenAngle : 0;
        akChest.lidPivot.rotation.x = akChest.lidTargetAngle;
    }
    for (const [idx, count] of Object.entries(w.treeHits)) {
        const tree = trees[Number(idx)];
        if (tree) tree.userData.treeHitCount = count;
    }
    w.houseDoors.forEach((d, i) => {
        const door = houseDoors[i];
        if (!door) return;
        door.isOpen = d.isOpen;
        door.angle = d.angle;
        door.targetAngle = d.targetAngle;
        door.pivot.rotation.y = d.angle;
        if (door.wallEntry) door.wallEntry.active = (d.targetAngle === 0 && d.angle === 0);
    });

    // ── Cemetery ─────────────────────────────────────────────────────────────
    if (snap.cemetery && cemeteryData) {
        const c = snap.cemetery;
        cemeteryData.gatesLocked = c.gatesLocked;
        cemeteryData.gateTargetL = c.gateTargetL;
        cemeteryData.gateTargetR = c.gateTargetR;
        cemeteryData.gatePivotL.rotation.y = c.gateRotL;
        cemeteryData.gatePivotR.rotation.y = c.gateRotR;
        cemeteryData.gateWall.active = c.gateWallActive;

        if (c.talismanItemDropped && !hasTalisman) {
            talismanItemMesh = createTalismanMesh(0.8);
            talismanItemMesh.userData.ignoreCameraOcclusion = true;
            const talismanSpawn = new THREE.Vector3(
                cemeteryData.talismanGraveLocalX, 1.05, cemeteryData.talismanGraveLocalZ
            );
            cemeteryData.group.localToWorld(talismanSpawn);
            talismanBaseY = c.talismanBaseY ?? talismanSpawn.y;
            talismanItemMesh.position.copy(talismanSpawn);
            setObjectHitProfile(talismanItemMesh, { shape: 'sphere', center: { x: 0, y: 0, z: 0 }, radius: 1.0 }, { debugKey: 'talismanPickupHitboxDebug' });
            scene.add(talismanItemMesh);
            talismanSpawnTime = performance.now() - 10000;
            talismanLockTimer = 0;
        }
    }

    // ── Altar / holy gem ─────────────────────────────────────────────────────
    if (snap.altar.created) {
        createSacrificialAltar();
        if (altarData) {
            snap.altar.torchesLit.forEach((lit, i) => { if (lit) _lightAltarTorch(i); });
            if (snap.altar.state === 'complete') {
                altarState = 'complete';
                altarCorpseStruck = snap.altar.corpseStruck;
                altarData.corpse.visible = false;
                _createHolyGemPlatform();
                if (holyGemCollected && holyGem) {
                    scene.remove(holyGem.mesh);
                    if (altarData.holyGemPlatform && altarData.holyGemPlatform.undersideLight) {
                        altarData.holyGemPlatform.undersideLight.intensity = 0;
                    }
                }
            }
        }
    }

    // ── Haunted house ────────────────────────────────────────────────────────
    if (!snap.hh.exists) {
        hhSeqPhase = 'complete';
        if (hauntedHouseData) _despawnHauntedHouse();
    } else if (hauntedHouseData) {
        const h = snap.hh;
        hhSeqPhase = h.phase;
        hhSeqTimer = h.timer;
        hhTorchExtinguished = h.torchExtinguished;
        hhSavedSequenceGameTime = h.savedSequenceGameTime;
        hhFirstAngelSpawned = h.firstAngelSpawned;
        hhFirstAngelApproaching = h.firstAngelApproaching;
        hhAngelWaveStage = h.angelWaveStage;
        hhAngelWaveTimer = h.angelWaveTimer;
        hhAngelStageSpawnCount = h.angelStageSpawnCount;
        hhLastTorchState = null; // force writing/lit-state re-sync next frame

        if (h.ssTaken) hauntedHouseData.ssItemGrp.visible = false;
        if (h.entranceBlocked) removeHHEntrance();
        hauntedHouseData.hhHallDoorAngle = h.hallDoorAngle;
        hauntedHouseData.hhHallDoorTargetAngle = h.hallDoorTargetAngle;
        hauntedHouseData.hhHallDoorPivot.rotation.y = h.hallDoorAngle;
        hauntedHouseData.hallDoorBlockWall.active = h.hallDoorWallActive;

        for (const a of h.angels) _restoreHHAngel(a);

        if (h.crawlerUnreleased) {
            _spawnHHHallCrawler();
        }
        hauntedHouseData.hhHallCrawlerEligible = h.crawlerEligible;
        hauntedHouseData.hhHallCrawlerEncounterStarted = h.crawlerEncounterStarted;
        if (hhSeqPhase === 'complete' && hasSwordShield) {
            // Sequence over: stairs/entrance/door already in default (restored) state
            restoreHHEntrance();
            restoreHHHallDoor();
            hauntedHouseData.hhHallDoorAngle = -Math.PI / 2;
            hauntedHouseData.hhHallDoorPivot.rotation.y = -Math.PI / 2;
        }
    }

    // ── Sword aura (needs playerSwordMesh, exists since createPlayer) ────────
    if (hasSwordShield && p.swordAuraActive) {
        _upgradeSwordBlade();
    }
    swordAuraActive = p.swordAuraActive;
    swordPostAuraKills = p.swordPostAuraKills;

    // ── Night creatures & cemetery-zombie module state ───────────────────────
    for (const c of snap.creatures.list) _restoreNightCreature(c);
    _ncSpawnUnlocked = snap.creatures.spawnUnlocked;
    _ncWasNight = snap.creatures.wasNight;
    _ncSpawnTimer = snap.creatures.spawnTimer;
    _cemZombieCountdown = snap.creatures.cemZombieCountdown;
    _cemZombiesSpawned = snap.creatures.cemZombiesSpawned;
    _preSequenceGameTime = snap.creatures.preSequenceGameTime;
    _nightTransitionTimer = snap.creatures.nightTransitionTimer;
    _ncOpenWorldSpawned = snap.creatures.openWorldSpawned;

    // Link the released HH crawler back to hauntedHouseData so a later HH
    // despawn still cleans it up.
    if (hauntedHouseData && snap.hh.crawlerReleased) {
        const released = nightCreatures.find(c => c.isHHSpecialCrawler);
        if (released) hauntedHouseData.hhHallCrawler = { mesh: released.mesh, released: true };
    }

    // ── NPCs ─────────────────────────────────────────────────────────────────
    _restoreNPCs(snap.npcs);

    // ── Demons / apocalypse ──────────────────────────────────────────────────
    demonApocalypse = snap.demonApocalypse;
    demonTeleportUnlockTimer = snap.demonTeleportUnlockTimer;
    _apocalypseRespawnCount = snap.apocalypseRespawnCount;
    for (const d of snap.demons) {
        const dData = createDemon(false, { demonType: d.demonType, speed: d.speed });
        _setV3(dData.mesh.position, d.pos);
        dData.mesh.rotation.y = d.rotY;
        dData.hitTimer = d.hitTimer;
        dData.gunShotsToKill = d.gunShotsToKill;
        dData.animPhase = d.animPhase;
        dData.teleportTimer = d.teleportTimer;
        scene.add(dData.mesh);
        demons.push(dData);
    }

    // ── Shadow man ───────────────────────────────────────────────────────────
    shadowManTotalSpawns = snap.shadowman.totalSpawns;
    shadowManPhase3Ready = snap.shadowman.phase3Ready;
    shadowManPostApocalypseUnlocked = snap.shadowman.postApocalypseUnlocked;
    shadowManNextCheckMs = snap.shadowman.nextCheckMs;
    if (snap.shadowman.active) {
        const s = snap.shadowman.active;
        const mesh = createShadowManMesh();
        _setV3(mesh.position, s.pos);
        mesh.rotation.y = s.rotY;
        scene.add(mesh);
        shadowMan = {
            mesh,
            spawnDistance: s.spawnDistance,
            disappearDistance: s.disappearDistance,
            maxPlayerDistance: s.maxPlayerDistance === null ? Infinity : s.maxPlayerDistance,
            finalPhase: s.finalPhase,
        };
    }

    // ── Hell run ─────────────────────────────────────────────────────────────
    const hr = snap.hellrun;
    roundKillCount = hr.roundKillCount;
    roundMode = hr.roundMode;
    currentRound = hr.currentRound;
    roundDemonsTotal = hr.roundDemonsTotal;
    roundDemonsSpawned = hr.roundDemonsSpawned;
    roundSpawnTimer = hr.roundSpawnTimer;
    roundBatchSize = hr.roundBatchSize;
    roundBetweenActive = hr.roundBetweenActive;
    roundBetweenTimer = hr.roundBetweenTimer;
    bestDemonRoundsReached = hr.bestDemonRoundsReached;
    bestDemonRoundsKills = hr.bestDemonRoundsKills;
    hasPlayedDemonRounds = hr.hasPlayedDemonRounds;
    if (hr.shrineExists || (snap.dragon.ascended && !roundMode && !demonApocalypse)) {
        createShrine(); // sets shrineActive = true
        shrine.visible = hr.shrineExists ? hr.shrineVisible : true;
        shrineActive = hr.shrineExists ? hr.shrineActive : true;
    }

    // ── Dragon ───────────────────────────────────────────────────────────────
    const dg = snap.dragon;
    dragonAscended = dg.ascended;
    if (dragon) {
        if (dragonAscended) applyAscendedDragonMaterials(dragon);
        dragon.visible = dg.visible;
        _setV3(dragon.position, dg.pos);
        dragon.rotation.y = dg.rotY;
    }
    _setV3(dragonVelocity, dg.velocity);
    dragonDescending = dg.descending;
    dragonLavaTimer = dg.lavaTimer;
    dragonBondKills = dg.bondKills;
    dragonBondFormed = dg.bondFormed;
    dragonTethered = dg.tethered;
    dragonTetherShotTimer = dg.tetherShotTimer;

    // ── Gems ─────────────────────────────────────────────────────────────────
    if (dragonGemCollected && dragonGem) {
        scene.remove(dragonGem.mesh);
    }
    if (snap.secretGem) {
        createSecretGem();
        secretGem.x = snap.secretGem.x;
        secretGem.z = snap.secretGem.z;
        secretGem.baseY = snap.secretGem.baseY;
        secretGem.mesh.position.set(secretGem.x, secretGem.baseY, secretGem.z);
    }

    // ── Noose portal body ────────────────────────────────────────────────────
    if (snap.noose && specialPortalFrameData) {
        specialPortalFrameData.bodyGone = snap.noose.bodyGone;
        specialPortalFrameData.nightBlend = snap.noose.nightBlend;
        specialPortalFrameData.swingPhase = snap.noose.swingPhase;
        specialPortalFrameData.hitCount = snap.noose.hitCount;
        if (snap.noose.bodySpawned && !snap.noose.bodyGone) {
            spawnSpecialPortalHangingBody();
        }
    }

    // ── Player / camera ──────────────────────────────────────────────────────
    _setV3(player.position, snap.player.position);
    player.rotation.y = snap.player.rotY;
    _setV3(velocity, snap.player.velocity);
    cameraYaw = snap.player.cameraYaw;
    cameraPitch = snap.player.cameraPitch;
    isGrounded = snap.player.isGrounded;
    isJumping = snap.player.isJumping;
    canJump = snap.player.canJump;
    playerHealth = snap.player.playerHealth;
    dragonHealth = snap.player.dragonHealth;

    mountedOnDragon = dg.mounted;
    if (mountedOnDragon) updateMountedPlayerPose();

    // ── Environment & HUD sync ───────────────────────────────────────────────
    if (demonApocalypse) {
        _applyApocalypseEnvironment();
    } else {
        updateDayNightCycle(0);
        setWaterCombatColor(false);
    }
    updateTopCornerHudVisibility();
    syncHandItemVisuals();
    updateStats();
    updateMenuPanels();
    updateDemonCounter();
    updateHealthBar();
    updateBestDemonRoundsRun();
}

// ── Boot flow & title screen ──────────────────────────────────────────────────

function _bootWorld(seed, snapshot) {
    applyGameSeed(seed);
    init();
    if (snapshot) {
        try {
            applySnapshot(snapshot);
        } catch (err) {
            console.error('Snapshot restore failed — starting from world state as-is:', err);
        }
    }
    document.getElementById('start-screen').style.display = 'none';
    gameStarted = true;
    if (snapshot) _lastGoodSnapshot = snapshot;
    animate();
    // May be rejected when boot wasn't user-gesture-driven (e.g. auto-resume
    // after a world reset); the click-to-lock listener covers that case.
    try {
        const lockPromise = renderer.domElement.requestPointerLock();
        if (lockPromise && lockPromise.catch) lockPromise.catch(() => {});
    } catch (e) {}
    startAutosave();
}

// Locks the clicked button's size and swaps its label for a spinner.
function _showButtonSpinner(btn) {
    if (!btn) return;
    btn.style.width = btn.offsetWidth + 'px';
    btn.style.height = btn.offsetHeight + 'px';
    btn.style.padding = '0';
    btn.innerHTML = '<span class="btn-spinner"></span>';
    btn.classList.add('loading');
}

// Boots on the next two frames so the browser paints the spinner before the
// blocking init().
function _bootWithSpinner(btn, bootFn) {
    _showButtonSpinner(btn);
    requestAnimationFrame(() => requestAnimationFrame(bootFn));
}

async function _startFreshGame(btn, name = null) {
    _showButtonSpinner(btn);
    const seed = makeNewSeed();
    activeSaveMeta = { name: name || null, createdAt: Date.now(), seed };
    if (SAVE_API) {
        try {
            activeSaveId = await SAVE_API.create(_buildSaveRecord(null));
        } catch (err) {
            console.error('Could not create save file — playing without persistence:', err);
            activeSaveId = null;
        }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => _bootWorld(seed, null)));
}

async function _loadSaveAndStart(id, btnEl) {
    let record;
    try {
        record = await SAVE_API.read(id);
    } catch (err) {
        console.error('Could not read save file:', err);
        return;
    }
    activeSaveId = id;
    activeSaveMeta = { name: record.name ?? null, createdAt: record.createdAt ?? Date.now(), seed: record.seed };
    _bootWithSpinner(btnEl, () => _bootWorld(record.seed, record.snapshot || null));
}

function _formatSaveDate(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const _GEAR_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<circle cx="12" cy="12" r="3.2"></circle>
<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.63.87 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.04z"></path>
</svg>`;

function _closeAllSaveMenus() {
    document.querySelectorAll('.save-row-menu').forEach(m => { m.style.display = 'none'; });
}

async function _renderSaveList() {
    const listEl = document.getElementById('save-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    // Fixed-position menus don't scroll with their rows — just close them.
    listEl.onscroll = _closeAllSaveMenus;
    let saves = [];
    try {
        saves = await SAVE_API.list();
    } catch (err) {
        console.error('Could not list saves:', err);
    }
    // Oldest created at the top, newest at the bottom
    saves.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    if (saves.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'save-list-empty';
        empty.textContent = 'No save files yet.';
        listEl.appendChild(empty);
        return;
    }

    for (const s of saves) {
        const row = document.createElement('div');
        row.className = 'save-row';

        const info = document.createElement('button');
        info.className = 'save-row-main';
        info.innerHTML = `
            <span class="save-row-name">${s.name ? _escapeHtml(s.name) : 'Unnamed save'}</span>
            <span class="save-row-date">${_formatSaveDate(s.updatedAt)}</span>`;
        info.addEventListener('click', () => _loadSaveAndStart(s.id, info));
        row.appendChild(info);

        const gearBtn = document.createElement('button');
        gearBtn.className = 'save-row-gear';
        gearBtn.title = 'Options';
        gearBtn.innerHTML = _GEAR_SVG;
        row.appendChild(gearBtn);

        const menu = document.createElement('div');
        menu.className = 'save-row-menu';
        menu.style.display = 'none';
        // Menu clicks must not reach the document-level close-all handler,
        // or the two-step "Delete?" confirm closes before the second click.
        menu.addEventListener('click', e => e.stopPropagation());

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => _beginRenameSave(row, s, menu));
        menu.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'save-menu-delete';
        deleteBtn.addEventListener('click', async () => {
            if (deleteBtn.dataset.confirm !== '1') {
                deleteBtn.dataset.confirm = '1';
                deleteBtn.textContent = 'Delete?';
                return;
            }
            try { await SAVE_API.remove(s.id); } catch (err) { console.error('Delete failed:', err); }
            await _renderSaveList();
            _refreshTitleButtons();
        });
        menu.appendChild(deleteBtn);
        row.appendChild(menu);

        gearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.style.display !== 'none';
            document.querySelectorAll('.save-row-menu').forEach(m => { m.style.display = 'none'; });
            if (!open) {
                // position:fixed popover anchored to the gear button, so it
                // escapes #save-list's overflow clipping
                const r = gearBtn.getBoundingClientRect();
                menu.style.top = `${r.bottom + 5}px`;
                menu.style.right = `${window.innerWidth - r.right}px`;
                menu.style.display = 'flex';
            }
            delete deleteBtn.dataset.confirm;
            deleteBtn.textContent = 'Delete';
        });

        listEl.appendChild(row);
    }
}

function _escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function _beginRenameSave(row, saveMeta, menu) {
    menu.style.display = 'none';
    const nameEl = row.querySelector('.save-row-name');
    if (!nameEl) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'save-rename-input';
    input.maxLength = 40;
    input.value = saveMeta.name || '';
    input.placeholder = 'Save name';
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
        if (committed) return;
        committed = true;
        const newName = input.value.trim() || null;
        try { await SAVE_API.rename(saveMeta.id, newName); }
        catch (err) { console.error('Rename failed:', err); }
        if (activeSaveId === saveMeta.id) activeSaveMeta.name = newName;
        await _renderSaveList();
    };
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { committed = true; _renderSaveList(); }
    });
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('blur', commit);
}

async function _refreshTitleButtons() {
    const startBtn = document.getElementById('start-btn');
    const saveButtons = document.getElementById('save-buttons');
    if (!SAVE_API || !saveButtons) return;
    let saves = [];
    try { saves = await SAVE_API.list(); } catch (e) {}
    const haveSaves = saves.length > 0;
    if (startBtn) startBtn.style.display = haveSaves ? 'none' : '';
    saveButtons.style.display = haveSaves ? 'flex' : 'none';
}

// The name prompt for a NEW world. Only reached from "New game", which only
// exists once a save does — the very first world is named for the player, so
// nothing stands between the Start button and the game.
const FIRST_WORLD_NAME = 'First world';
function _showNameScreen(show) {
    const main = document.getElementById('title-main');
    const name = document.getElementById('name-screen');
    const input = document.getElementById('name-input');
    if (main) main.style.display = show ? 'none' : '';
    if (name) name.style.display = show ? 'flex' : 'none';
    const hint = document.getElementById('start-menu-hint');
    if (hint) hint.style.display = show ? 'none' : '';
    if (show && input) { input.value = ''; input.focus(); }
}

function _showLoadScreen(show) {
    const main = document.getElementById('title-main');
    const load = document.getElementById('load-screen');
    if (main) main.style.display = show ? 'none' : '';
    if (load) load.style.display = show ? 'flex' : 'none';
    const hint = document.getElementById('start-menu-hint');
    if (hint) hint.style.display = show ? 'none' : '';
    if (show) _renderSaveList();
}

function _injectSaveQuitButton() {
    if (!SAVE_API) return;
    const grid = document.getElementById('game-menu-grid');
    if (!grid || document.getElementById('save-quit-btn')) return;
    const wrap = document.createElement('div');
    wrap.id = 'save-quit-wrap';
    const btn = document.createElement('button');
    btn.id = 'save-quit-btn';
    btn.textContent = 'Save & quit';
    btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'Saving…';
        saveAndQuitGame();
    });
    wrap.appendChild(btn);
    grid.appendChild(wrap);
}

async function initTitleScreen() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        // Start only shows when there are no saves at all, so this world is by
        // definition the first one — name it and get out of the way.
        startBtn.addEventListener('click', () => _startFreshGame(startBtn, FIRST_WORLD_NAME));
    }

    if (!SAVE_API) return; // browser mode: plain Start button, no persistence

    _injectSaveQuitButton();

    const newBtn = document.getElementById('new-save-btn');
    const loadBtn = document.getElementById('load-save-btn');
    const backBtn = document.getElementById('load-back-btn');
    if (newBtn) newBtn.addEventListener('click', () => _showNameScreen(true));
    if (loadBtn) loadBtn.addEventListener('click', () => _showLoadScreen(true));
    if (backBtn) backBtn.addEventListener('click', () => _showLoadScreen(false));

    const nameInput = document.getElementById('name-input');
    const createBtn = document.getElementById('name-create-btn');
    const cancelBtn = document.getElementById('name-cancel-btn');
    // An empty name is allowed — the row just reads "Unnamed save", exactly as
    // every world did before this prompt existed.
    const createNamed = () => _startFreshGame(createBtn, nameInput ? nameInput.value.trim() : null);
    if (createBtn) createBtn.addEventListener('click', createNamed);
    if (cancelBtn) cancelBtn.addEventListener('click', () => _showNameScreen(false));
    if (nameInput) nameInput.addEventListener('keydown', e => {
        e.stopPropagation();                       // the game binds plain keys
        if (e.key === 'Enter') createNamed();
        if (e.key === 'Escape') _showNameScreen(false);
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.save-row-menu').forEach(m => { m.style.display = 'none'; });
    });

    // Relaunch straight into a save after a hard reset ("restart world")
    let resumeId = null;
    try {
        resumeId = sessionStorage.getItem(RESUME_SESSION_KEY);
        sessionStorage.removeItem(RESUME_SESSION_KEY);
    } catch (e) {}
    if (resumeId) {
        _loadSaveAndStart(resumeId, null);
        return;
    }

    await _refreshTitleButtons();
}
