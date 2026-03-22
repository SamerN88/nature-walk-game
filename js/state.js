const underwaterTintEl = document.getElementById('underwater-tint');

// Scene setup
let scene, camera, renderer;
let player, playerBody;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let isJumping = false;
let canJump = true;

// Controls
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isRunning = false;
let isLocked = false;
let spaceHeld = false;

// Camera
let cameraDistance = 8;
let cameraHeight = 4;
let cameraPitch = 0;
let cameraYaw = 0;
const CAMERA_OCCLUSION_BUFFER = 0.35;
const CAMERA_OCCLUSION_MIN_DISTANCE = 1.5;
const cameraOcclusionRaycaster = new THREE.Raycaster();

// Environment
let sun, ambientLight;
let skyColors = {
    day: new THREE.Color(0x87CEEB),
    sunset: new THREE.Color(0xFF6B35),
    night: new THREE.Color(0x0a0a20),
    dawn: new THREE.Color(0xFFB347)
};

// Time tracking
let gameTime = 0;
let lastTime = performance.now();
let gameStartRealTimeMs = performance.now();

// World bounds
const WORLD_SIZE = 3000;
const MOUNTAIN_BODY_COLOR = 0x5a5a5a;
const ORIGIN_CLEAR_RADIUS = 50;
const STRUCTURE_PLACEMENT_GAP = 10;
const STRUCTURE_WORLD_LIMIT = WORLD_SIZE - 120;
const MOUNTAIN_EDGE_SAMPLE_COUNT = 50;
const DEFAULT_TALLEST_SNOWY_MOUNTAIN_HEIGHT = 300;
const MOUNTAIN_EXTRA_SINK = 1;
const BOULDER_Y_SINK = 6;
const PORTAL_FRAME_Y_SINK = 2;
const STAIRCASE_Y_SINK = 1;
const TOWER_Y_SINK = 3;
const PRIMITIVE_BLOCK_EDGE_SAMPLE_COUNT = 50;
const PRIMITIVE_BLOCK_EXTRA_SINK = 1;
const GEM_COLLECTION_RADIUS = 2.5;

// Climbable structures
let structures = [];
let solidWalls = [];
let ceilings = []; // {x, z, halfW, halfD, y} — blocks player from going above y
let roofColliders = []; // rect: {x, z, halfW, halfD, topY, bottomY} or circle: {x, z, radius, topY, bottomY}
let placementFootprints = [];
let waterBodies = [];
let collisionDebugGroup = null;

// Terrain height grid (for pixel-perfect ground collision matching the visual mesh)
let terrainHeights = null;
let groundMesh = null; // terrain mesh, stored for raycasting
const TERRAIN_SEGS = 200; // must match PlaneGeometry segments
const LAKE_CRATER_FLOOR_Y = -85;
const POND_CRATER_FLOOR_Y = -25;
const WATER_VISUAL_Y_OFFSET = -5;
const WATER_VISUAL_EXTRA_BOTTOM_DEPTH = 100;
//const WATER_VISUAL_RADIUS_BONUS = 10;
const WATER_SURFACE_STRUCTURE_CLEARANCE = 0.25;
const PLAYER_WATER_HEIGHT = 2.25;
const PLAYER_WATER_SURFACE_EMERGENCE = 0.3;
const PLAYER_WATER_SINK_SPEED = 11;
const PLAYER_WATER_RISE_SPEED = 11;
const PLAYER_WATER_SINK_RESPONSE = 8;
const PLAYER_WATER_RISE_RESPONSE = 8;
const PLAYER_WATER_ENTRY_DAMPING = 0.45;
const NPC_WATER_BOB_SPEED = 10;
const NPC_WATER_MIN_SUBMERSION = 0.3;
const NPC_WATER_MAX_SUBMERSION = 0.7;
const DEMON_WATER_PLAYER_RISE_RANGE = 10;
const SHADOW_MAN_MIN_SPAWN_DISTANCE = 300;
const SHADOW_MAN_MAX_SPAWN_DISTANCE = 700;
const SHADOW_MAN_DESPAWN_DISTANCE_BUFFER = 300;
const SHADOW_MAN_MIN_DESPAWN_DISTANCE = 100;
const SHADOW_MAN_MAX_DESPAWN_DISTANCE = 200;
const SHADOW_MAN_DAY_COLOR = 0x050505;
const SHADOW_MAN_NIGHT_COLOR = 0xe0e0e0;
const SHADOW_MAN_CAMERA_ANGLE_RANGE = THREE.MathUtils.degToRad(50);
const SHADOW_MAN_SPAWN_CHECK_INTERVAL_MS = 30 * 1000;
const SHADOW_MAN_SPAWN_UNLOCK_MINUTE = DEBUG_SHADOW_MAN_IGNORE_BUFFER ? 0 : FULL_CYCLE; // 1 day and 1 night of peace
const SHADOW_MAN_BASE_SPAWN_CHANCE = 0.15;
const SHADOW_MAN_POST_APOCALYPSE_SPAWN_CHANCE = 0;
const SHADOW_MAN_PHASE2_SPAWN_CHANCE = 0.40;
const SHADOW_MAN_PHASE3_SPAWN_CHANCE = 0.70;
const SHADOW_MAN_PHASE3_CHECK_INTERVAL_MS = 10 * 1000;
const SHADOW_MAN_PHASE3_SPAWN_THRESHOLD = 15;
const SHADOW_MAN_PHASE3_PLAYER_SPAWN_RADIUS = 500;
const SHADOW_MAN_CUTSCENE_TRIGGER_DIST = 50;
const SHADOW_MAN_CUTSCENE_STOP_DIST = 3;
const DIG_ZONE_SIZE = 10;

// NPCs
let npcs = [];
// Counts of each NPC type saved before hell/apocalypse, null when not saved
let savedNpcCounts = null;

// Secret gem
let secretGem;
let gemCollected = false;
let speedMultiplier = 1;
let jumpMultiplier = 1;

// Time menu
let timeMenuOpen = false;

// Kill counter
let killCount = 0;
let killBreakdown = {
    deer: 0,
    rabbit: 0,
    bird: 0,
    human: 0,
    demon: 0
};

// Respawn rate (how many NPCs spawn per natural kill, default 0)
let respawnRate = 0;

// Demon Apocalypse system
let demonApocalypse = false;
let playerHealth = 100;
let dragonHealth = 100;
let playerDead = false;
let demons = [];
let campfirePositions = [];
let shadowMan = null;
let shadowManLastMinuteChecked = -1;
let shadowManPostApocalypseUnlocked = false;
let shadowManTotalSpawns = 0;
let shadowManPhase3Ready = false;
let shadowManCutscene = null;
let shadowManNextCheckMs = -1;

// ── Hell Run system (Demon Rounds) ──────────────────────────────
let roundKillCount   = 0;       // kills accumulated across all rounds this session
let deathPosition    = null;    // player position at time of death
let roundMode        = false;
let currentRound     = 0;
let roundDemonsTotal = 0;
let roundDemonsSpawned = 0;
let roundSpawnTimer  = 0;
let roundBatchSize   = 0;
let roundBetweenActive = false;
let roundBetweenTimer  = 0;
let shrine           = null;
let shrineActive     = false;
const SHRINE_INTERACT_DIST = 5;
let bestDemonRoundsReached = 0;
let bestDemonRoundsKills = 0;
let hasPlayedDemonRounds = false;

// Dragon system
let dragonGem;
let dragonGemCollected = false;
let dragonVolcano = null;
let tallestSnowyMountainHeight = DEFAULT_TALLEST_SNOWY_MOUNTAIN_HEIGHT;
let dragon;
let dragonDescending = false;
let dragonDescendTracksPlayer = false;  // currently unused, but leaving it in for posterity
let mountedOnDragon = false;
let dragonLavaTimer = 0;  // seconds the unmounted dragon has spent continuously in lava
let dragonBondKills = 0;        // NPC/demon kills made via the dragon beam
let dragonBondFormed = false;   // true once DRAGON_BOND_KILLS_REQUIRED reached
let dragonTethered = false;     // true when player has toggled tether on with T
let dragonTetherShotTimer = 0;  // countdown to next tether auto-shot
let dragonBondFlashes = [];     // [{light1, light2, elapsed}] – bond formation flash state
let dragonVelocity = new THREE.Vector3();
const mountedPlayerLocalOffset = new THREE.Vector3(3, 1.8, 0);
let dragonIsWhite = false;
let isGrounded = false;
let infiniteJump = false;
let nearCampfireFlag = false;
let campfireShieldTimer = 0;  // seconds remaining of campfire shield after leaving range
let enclosedStructureBounds = []; // footprints of houses/caves/tents — dragon avoids landing on these
let akChest = null;
let akChestGun = null;
let ak47Collected = false;
let ak47Equipped = false;
let lastAk47ShotAt = 0;
let playerAk47 = null;
let playerAk47Muzzle = null;
let ak47MuzzleFlash = null;
let ak47MuzzleLight = null;
let ak47MuzzleFlashTimer = 0;
let ak47MuzzleLightTimer = 0;
let ak47Beams = [];
let ak47TriggerHeld = false;

// Hand-held item system
let hasShovel = false;
let currentHandItem = 'fist'; // 'fist' | 'shovel' | 'ak47' | 'stake' | 'torch'
let playerShovel = null;
let tentShovelMesh = null;

// Tree / Stake / Torch system
let trees = []; // all tree groups tracked for stake harvesting
let hasStake = false;
let hasTorch = false;
let playerStakeMesh = null;    // equipped stake mesh on player
let playerTorchMesh = null;    // equipped torch mesh on player
let torchEquippedLight = null; // PointLight active when torch equipped

// Dynamic hand slot system — slot 0 is always fist; items added in acquisition order
let handSlots = ['fist'];

// Lake digging / golden key system
let digCount = 0;
let hasGoldenKey = false;
let goldenKeyMesh = null;
let goldenKeyLockTimer = 0;  // seconds remaining before key can be picked up after spawning
let goldenKeySpawnTime = 0; // performance.now() at spawn, for phase-locked pulse animation
let goldenKeyBaseY = 0;    // base Y used for bob animation (set when key is spawned)
let debugGoldenKeySpawned = false; // one-shot for DEBUG_GOLDEN_KEY_IN_LAKE
let debugKeyBox = null;    // { mesh, hitCount } for DEBUG_GOLDEN_KEY punchable box
let bigLake = null;
let digParticles = []; // [{meshes:[], life, maxLife, gravity:[]}]

// Notes & Inventory
let keyHintNoteDropped = false;
let keyHintNotePickedUp = false;
let keyHintNoteMesh = null;
let volcanoHintNotePickedUp = false;
let volcanoHintNoteMesh = null;
let lastHumanDeathPos = null;
let inventoryOpen = false;
let inventoryItems = [];

// Doors
let houseDoors = [];
// Dragon bond / tether constants
const DRAGON_BOND_KILLS_REQUIRED  = 300; // dragon-beam kills needed to form bond
const DRAGON_TETHER_HEIGHT        = 60;  // units above player head when tethered
const DRAGON_TETHER_DETECT_RADIUS = 30;  // radius around player to detect demons for tether shots
const DRAGON_TETHER_SHOT_INTERVAL = 1;   // seconds between tether auto-shots

const AK47_SHOT_INTERVAL_MS = 100; // 600 RPM
const AK47_BEAM_LIFETIME = 0.03;
const AK47_MUZZLE_FLASH_LIFETIME = 0.03;
const AK47_MUZZLE_LIGHT_LIFETIME = 0.03;
const AK47_BEAM_MAX_VISUAL_RANGE = 900;
const AK47_BEAM_MIN_VISUAL_RANGE = 80;
const AK47_BEAM_COLOR = 0xffe438;
