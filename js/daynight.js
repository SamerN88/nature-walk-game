function setTimeOfDay(time) {
    if (demonApocalypse) return; // can't change time during apocalypse
    // Set gameTime based on selected time
    // 0.0 - 0.125: Night to dawn
    // 0.125 - 0.25: Dawn to day
    // 0.25 - 0.375: Day (morning)
    // 0.375 - 0.5: Day to sunset
    // 0.5 - 0.625: Sunset to night
    // 0.625 - 1.0: Night

    switch (time) {
        case 'dawn':
            gameTime = FULL_CYCLE * (0.51/24); // 30% into dawn (~5:44 AM)
            break;
        case 'day':
            gameTime = FULL_CYCLE * (6.02/24); // 40% into day (~11:01 AM)
            break;
        case 'sunset':
            gameTime = FULL_CYCLE * (12.86/24); // 30% into sunset (~17:52)
            break;
        case 'dusk':
            gameTime = FULL_CYCLE * (14.06/24); // 30% into dusk (~19:04)
            break;
        case 'night':
            gameTime = FULL_CYCLE * (17.63/24); // 30% into night (~22:38)
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

    // Phase thresholds (cycleProgress 0=5:00 AM, offset 5 hrs)
    // Dawn:   0.00000 – 0.07083  (5:00 – 6:42)
    // Day:    0.07083 – 0.52083  (6:42 – 17:30)
    // Sunset: 0.52083 – 0.57083  (17:30 – 18:42)
    // Dusk:   0.57083 – 0.62083  (18:42 – 19:54)
    // Night:  0.62083 – 1.00000  (19:54 – 5:00)
    const DAWN_END    = 1.7  / 24; // 6:42
    const SUNSET_START = 12.5 / 24; // 17:30
    const DUSK_START   = 13.7 / 24; // 18:42
    const NIGHT_START  = 14.9 / 24; // 19:54
    const HALF_DAWN    = DAWN_END / 2;

    let skyColor, sunIntensity, ambientIntensity;
    const sunAngle = cycleProgress * Math.PI * 2 - Math.PI / 2;

    if (cycleProgress < HALF_DAWN) {
        // Night to dawn (first half of dawn window)
        const t = cycleProgress / HALF_DAWN;
        skyColor = skyColors.night.clone().lerp(skyColors.dawn, t);
        sunIntensity = t * 0.5;
        ambientIntensity = 0.1 + t * 0.2;
    } else if (cycleProgress < DAWN_END) {
        // Dawn to day (second half of dawn window)
        const t = (cycleProgress - HALF_DAWN) / HALF_DAWN;
        skyColor = skyColors.dawn.clone().lerp(skyColors.day, t);
        sunIntensity = 0.5 + t * 0.5;
        ambientIntensity = 0.3 + t * 0.2;
    } else if (cycleProgress < SUNSET_START) {
        // Day
        skyColor = skyColors.day.clone();
        sunIntensity = 1;
        ambientIntensity = 0.5;
    } else if (cycleProgress < DUSK_START) {
        // Sunset: day fading to sunset colours
        const t = (cycleProgress - SUNSET_START) / (DUSK_START - SUNSET_START);
        skyColor = skyColors.day.clone().lerp(skyColors.sunset, t);
        sunIntensity = 1 - t * 0.3;
        ambientIntensity = 0.5 - t * 0.1;
    } else if (cycleProgress < NIGHT_START) {
        // Dusk: sunset fading to night
        const t = (cycleProgress - DUSK_START) / (NIGHT_START - DUSK_START);
        skyColor = skyColors.sunset.clone().lerp(skyColors.night, t);
        sunIntensity = 0.7 - t * 0.6;
        ambientIntensity = 0.4 - t * 0.3;
    } else {
        // Night
        skyColor = skyColors.night.clone();
        sunIntensity = 0.1;
        ambientIntensity = 0.1;
    }

    scene.background = skyColor;
    scene.fog.color = skyColor;
    sun.intensity = sunIntensity;
    ambientLight.intensity = ambientIntensity;
    updateSunShadowFocus();

    // Update sun color
    if (cycleProgress > 12.5/24 && cycleProgress < 14.9/24) {
        sun.color.setHex(0xffa500); // orange during sunset+dusk
    } else if (cycleProgress < 1.7/24 || cycleProgress > 14.9/24) {
        sun.color.setHex(0x4444ff); // blue during dawn+night
    } else {
        sun.color.setHex(0xffffff); // white during day
    }

    updateWaterLighting();

    // Update UI
    const gameHours = (cycleProgress * 24 + 5) % 24; // Start at 5 AM
    const hours = Math.floor(gameHours);
    const minutes = Math.floor((gameHours - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    document.getElementById('time-of-day').textContent =
        `Time: ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    let timeOfDay;
    if (cycleProgress < 1.7/24) timeOfDay = 'Dawn';
    else if (cycleProgress < 12.5/24) timeOfDay = 'Day';
    else if (cycleProgress < 13.7/24) timeOfDay = 'Sunset';
    else if (cycleProgress < 14.9/24) timeOfDay = 'Dusk';
    else timeOfDay = 'Night';

    document.getElementById('day-night').textContent = timeOfDay;
}
