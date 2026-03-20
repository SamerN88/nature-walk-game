// Debug modes (for easy testing)
const DEBUG_GEMS = true;  // makes gems spawn very close to origin
const DEBUG_COLLISIONS = false;  // makes collision surfaces visible (translucent red)
const DEBUG_CHEST = false;  // for quick access to chest
const DEBUG_APOCALYPSE = false;  // for quick access to demon apocalypse
const DEBUG_AK47 = false;  // spawn with the AK47 already collected and equipped
const DEBUG_SHOVEL = false; // spawn with the shovel already in hand
const DEBUG_DIG_ZONE = false; // show dig zone at lake floor as translucent red square
const DEBUG_GOLDEN_KEY = false;  // punchable box 30 units ahead; 3 hits reveals the golden key
const DEBUG_GOLDEN_KEY_IN_LAKE = false; // key is already revealed when player first reaches the lake floor
const DEBUG_GOLDEN_KEY_OBTAINED = false; // start with the golden key already collected
const DEBUG_DISTANCE = false;  // spawns a single large red stake at some distance from origin along +X
const DEBUG_SHADOW_MAN = false;  // spawns shadow man immediately at game start with big red beacon
const DEBUG_SHADOW_MAN_IGNORE_BUFFER = false;  // ignores the initial buffer when shadow man cannot spawn
const DEBUG_FREEZE_SHADOW_MAN = false;  // prevents despawn and rotation
const DEBUG_VOLCANO = false;  // spawns the player near the volcano for dragon gem testing
const DEBUG_WATER = false;  // shows a tall red translucent wall around water cylinder boundaries
const DEBUG_CAVE_WRITING = true;  // spawns a hovering red beacon above the cave with the writing
const DEBUG_VOLCANO_HINT = true;  // spawns a hovering green beacon above the cave with the volcano hint note
const DEBUG_KEY_HINT = true;      // first human kill always drops the key-hint note (ignores 5-kill warmup)
const DEBUG_CUTSCENE = false;  // spawns a finalPhase shadow man 150 units ahead of origin — walk within 50 to trigger cutscene

// true: player falls naturally to ground before cutscene starts; false: teleport to surface instantly
const FALL_TO_CUTSCENE = true;

// Game constants
const DAY_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const NIGHT_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const FULL_CYCLE = DAY_DURATION + NIGHT_DURATION;
