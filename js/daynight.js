// Pre-allocated Color reused every frame to avoid per-frame GC allocations in updateDayNightCycle.
const _skyColorBuf = new THREE.Color();
const DAY_START_HOUR = 5;

function timeToCycleProgress(hour, minute) {
    return ((hour + minute/60) - DAY_START_HOUR) / 24;
}

// Phase thresholds (cycleProgress 0=5:00 AM, offset 5 hrs)
    // Dawn:   0.00000 – 0.07083  (5:00 – 6:42)
    // Day:    0.07083 – 0.52083  (6:42 – 17:30)
    // Sunset: 0.52083 – 0.57083  (17:30 – 18:42)
    // Dusk:   0.57083 – 0.62083  (18:42 – 19:54)
    // Night:  0.62083 – 1.00000  (19:54 – 5:00)
const DAWN_END = timeToCycleProgress(6, 42);
const SUNSET_START = timeToCycleProgress(17, 30);
const DUSK_START = timeToCycleProgress(18, 42);
const NIGHT_START = timeToCycleProgress(19, 54);
const HALF_DAWN = DAWN_END / 2;


function setTimeOfDay(time) {
    if (demonApocalypse) return; // can't change time during apocalypse
    const phaseProgress = 0.3;

    switch (time) {
        case 'dawn':
            gameTime = FULL_CYCLE * (DAWN_END * phaseProgress);
            break;
        case 'day':
            gameTime = FULL_CYCLE * (
                DAWN_END + (SUNSET_START - DAWN_END) * phaseProgress
            );
            break;
        case 'sunset':
            gameTime = FULL_CYCLE * (
                SUNSET_START + (DUSK_START - SUNSET_START) * phaseProgress
            );
            break;
        case 'dusk':
            gameTime = FULL_CYCLE * (
                DUSK_START + (NIGHT_START - DUSK_START) * phaseProgress
            );
            break;
        case 'night':
            gameTime = FULL_CYCLE * (
                NIGHT_START + (1 - NIGHT_START) * phaseProgress
            );
            break;
    }

    // Apply lighting/sky immediately so you can see the change in the menu
    updateDayNightCycle(0);
    // Menu stays open; close only via M
}

function updateDayNightCycle(delta) {
    if (demonApocalypse) return; // time is frozen during apocalypse
    gameTime = (gameTime + delta) % FULL_CYCLE;

    const cycleProgress = gameTime / FULL_CYCLE;

    let sunIntensity, ambientIntensity;
    const sunAngle = cycleProgress * Math.PI * 2 - Math.PI / 2;

    if (cycleProgress < HALF_DAWN) {
        // Night to dawn (first half of dawn window)
        const t = cycleProgress / HALF_DAWN;
        _skyColorBuf.copy(skyColors.night).lerp(skyColors.dawn, t);
        sunIntensity = t * 0.5;
        ambientIntensity = 0.1 + t * 0.2;
    } else if (cycleProgress < DAWN_END) {
        // Dawn to day (second half of dawn window)
        const t = (cycleProgress - HALF_DAWN) / HALF_DAWN;
        _skyColorBuf.copy(skyColors.dawn).lerp(skyColors.day, t);
        sunIntensity = 0.5 + t * 0.5;
        ambientIntensity = 0.3 + t * 0.2;
    } else if (cycleProgress < SUNSET_START) {
        // Day
        _skyColorBuf.copy(skyColors.day);
        sunIntensity = 1;
        ambientIntensity = 0.5;
    } else if (cycleProgress < DUSK_START) {
        // Sunset: day fading to sunset colours
        const t = (cycleProgress - SUNSET_START) / (DUSK_START - SUNSET_START);
        _skyColorBuf.copy(skyColors.day).lerp(skyColors.sunset, t);
        sunIntensity = 1 - t * 0.3;
        ambientIntensity = 0.5 - t * 0.1;
    } else if (cycleProgress < NIGHT_START) {
        // Dusk: sunset fading to night
        const t = (cycleProgress - DUSK_START) / (NIGHT_START - DUSK_START);
        _skyColorBuf.copy(skyColors.sunset).lerp(skyColors.night, t);
        sunIntensity = 0.7 - t * 0.6;
        ambientIntensity = 0.4 - t * 0.3;
    } else {
        // Night
        _skyColorBuf.copy(skyColors.night);
        sunIntensity = 0.1;
        ambientIntensity = 0.1;
    }

    scene.background = _skyColorBuf;
    scene.fog.color = _skyColorBuf;
    sun.intensity = sunIntensity;
    ambientLight.intensity = ambientIntensity;
    updateSunShadowFocus();

    // Update sun color
    if (cycleProgress > SUNSET_START && cycleProgress < NIGHT_START) {
        sun.color.setHex(0xffa500); // orange during sunset+dusk
    } else if (cycleProgress < DAWN_END || cycleProgress > NIGHT_START) {
        sun.color.setHex(0x4444ff); // blue during dawn+night
    } else {
        sun.color.setHex(0xffffff); // white during day
    }

    updateWaterLighting();

    // Update UI
    const gameHours = (cycleProgress * 24 + DAY_START_HOUR) % 24; // Start at 5 AM
    const hours = Math.floor(gameHours);
    const minutes = Math.floor((gameHours - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    document.getElementById('time-of-day').textContent =
        `Time: ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    let timeOfDay;
    if (cycleProgress < DAWN_END) timeOfDay = 'Dawn';
    else if (cycleProgress < SUNSET_START) timeOfDay = 'Day';
    else if (cycleProgress < DUSK_START) timeOfDay = 'Sunset';
    else if (cycleProgress < NIGHT_START) timeOfDay = 'Dusk';
    else timeOfDay = 'Night';

    document.getElementById('day-night').textContent = timeOfDay;
}
