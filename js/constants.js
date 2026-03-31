// Debug modes (for easy testing)
const DEBUG_GEMS = false;  // makes gems spawn very close to origin
const DEBUG_COLLISIONS = false;  // makes collision surfaces visible (translucent red)
const DEBUG_CHEST = false;  // for quick access to chest
const DEBUG_APOCALYPSE = false;  // for quick access to demon apocalypse
const DEBUG_AK47 = false;  // spawn with the AK47 already collected and equipped
const DEBUG_SHOVEL = false; // spawn with the shovel already in hand
const DEBUG_TORCH = false; // spawn with the torch already in hand
const DEBUG_DIG_ZONE = false; // show dig zone at lake floor as translucent red square
const DEBUG_GOLDEN_KEY = false;  // punchable box 30 units ahead; 3 hits reveals the golden key
const DEBUG_GOLDEN_KEY_IN_LAKE = false; // key is already revealed when player first reaches the lake floor
const DEBUG_GOLDEN_KEY_OBTAINED = false; // start with the golden key already collected
const DEBUG_DISTANCE = -1;  // -1 means disabled; if >=0, spawns a single large red stake at that distance from origin along +Z
const DEBUG_SHADOW_MAN = false;  // spawns shadow man immediately at game start with big red beacon
const DEBUG_SHADOW_MAN_IGNORE_BUFFER = false;  // ignores the initial buffer when shadow man cannot spawn
const DEBUG_FREEZE_SHADOW_MAN = false;  // prevents despawn and rotation
const DEBUG_VOLCANO = false;  // spawns the player near the volcano for dragon gem testing
const DEBUG_WATER = false;  // shows a tall red translucent wall around water cylinder boundaries
const DEBUG_CAVE_WRITING = false;  // spawns a hovering red beacon above the cave with the writing
const DEBUG_VOLCANO_HINT = false;  // spawns a hovering green beacon above the cave with the volcano hint note
const DEBUG_FARMER = false;        // spawns the farmer 5 units in front of the player (which drops key-hint note)
const DEBUG_CUTSCENE = false;  // spawns a finalPhase shadow man 150 units ahead of origin — walk within 50 to trigger cutscene
const DEBUG_HAUNTED_HOUSE = false; // spawn player 75 units from HH entrance at start
const DEBUG_DESPAWN_HH = false;   // skip straight to post-despawn state: skeleton + boulder on world floor, HH gone
const DEBUG_CEMETERY = false;      // spawn player 75 units from cemetery entrance at start
const DEBUG_TALISMAN = false;      // start with talisman already in inventory
const DEBUG_INF_JUMP = false;  // gives player infinite jump
const DEBUG_SWORD_THUNDER = false; // spawn at origin with aurafied sword in inventory + demon shrine in place
const DEBUG_SWORD_THUNDER_INF = false; // like DEBUG_SWORD_THUNDER, but every sword hit triggers lightning without recharge
const DEBUG_SWORD_THUNDER_TRANSITION = false; // makes sword lightning recharge after 1 kill instead of 100

// Demon teleport ability
    /* 
    NOTES FROM TESTING THIS OUT:
        - 3 sec gives the impression that demons teleport often; difficult to maintain a huge train at 
          round 4 and above (which is good, I want it to be challenging)
        - 10% chance gives a fair balance; most demons stay put, allowing player to form a fairly sized 
          train, but prevents player from exploiting the train strategy too much
        - 40 units makes it so in rounds 1 and 2, it's easy to maintain a train of all or most demons 
          without them teleporting; but in higher rounds, it's difficult to put all demons in a train 
          because they will keep exiting the 40-unit raidus, forcing the player to move and stay alert
    */
const DEMON_TELEPORT_INTERVAL_SEC = 3;      // seconds between each teleport eligibility check
const DEMON_TELEPORT_CHANCE   = 0.10;       // chance to teleport each check
const DEMON_TELEPORT_DISABLE_DIST = 40;     // teleport disabled when demon is closer than this to player

// true: player falls naturally to ground before cutscene starts; false: teleport to surface instantly
const FALL_TO_CUTSCENE = true;

// Game constants
const DAY_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const NIGHT_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const FULL_CYCLE = DAY_DURATION + NIGHT_DURATION;
