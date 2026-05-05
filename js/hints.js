const HINTS = [
    "Where leaves grow.",
    "Light.",
    "Search the tents.",
    "Go where all are equal.",
    "In the dark woods.",
    "Seek the pit of fire.",
    "Follow him.",
    "Near the edge, they made a symbol of flesh.",
    "The lowest point.",
    "B&E",
];

// Conditions to advance FROM stage N to N+1.
// Ordered to match HINTS: stage 0 advances when hasStick, etc.
const _hintConditions = [
    () => hasStick,
    () => hasTorch,
    () => hasShovel,
    () => hasTalisman,
    () => hasSwordShield,
    () => dragonGemCollected,
    () => dragonAscended,       // demon apocalypse defeated
    () => holyGemCollected,
    () => hasGoldenKey,
    () => ak47Collected,
];

// Advance hintStage past any stages whose condition is already met,
// resetting hintRevealed each time we move forward.
function _advanceHintStage() {
    while (hintStage < _hintConditions.length && _hintConditions[hintStage]()) {
        hintStage++;
        hintRevealed = false;
    }
}

function updateHintArea() {
    _advanceHintStage();
    const area = document.getElementById('hint-area');
    if (!area) return;

    // Stage 10 = all items collected, button permanently disabled.
    if (hintStage >= HINTS.length) {
        area.innerHTML = '<button class="hint-btn hint-btn-disabled" disabled>Hint</button>';
        return;
    }

    if (hintRevealed) {
        area.innerHTML = '<div class="hint-text">' + HINTS[hintStage] + '</div>';
    } else {
        area.innerHTML = '<button class="hint-btn" onclick="onHintButtonClick()">Hint</button>';
    }
}

function onHintButtonClick() {
    if (hintModalConfirmed) {
        hintRevealed = true;
        updateHintArea();
    } else {
        document.getElementById('hint-modal').style.display = 'flex';
    }
}

function confirmHint() {
    hintModalConfirmed = true;
    hintRevealed = true;
    document.getElementById('hint-modal').style.display = 'none';
    updateHintArea();
}

function closeHintModal() {
    document.getElementById('hint-modal').style.display = 'none';
}
