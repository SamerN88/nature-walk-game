const HINTS = [
    "The giving tree.",
    "Light.",
    "Campers leave things behind.",
    "Memento mori.",
    "In the deep dark woods.",
    "Pit of fire.",
    "Follow him.",
    "Near the edge, they made a symbol of flesh.",
    "Hold your breath.",
    "Anybody home?",
];

// One condition per hint, ordered to match HINTS.
// A torch is a lit stick, so hasTorch implies the stick milestone.
const _hintConditions = [
    () => hasStick || hasTorch,
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

// Milestones latch: item flags can flip back (stick consumed by lighting the
// torch, torch extinguished in the haunted house), but a condition that has
// ever been satisfied stays satisfied for hint purposes.
const _hintMilestonesMet = _hintConditions.map(() => false);

// Called every frame (and on menu open) so milestones satisfied between menu
// opens are never missed. hintStage = first never-met milestone, so hints for
// already-met conditions are skipped even when they were met out of order.
function updateHintMilestones() {
    for (let i = 0; i < _hintConditions.length; i++) {
        if (!_hintMilestonesMet[i] && _hintConditions[i]()) _hintMilestonesMet[i] = true;
    }
    const next = _hintMilestonesMet.indexOf(false);
    const stage = next === -1 ? HINTS.length : next;
    if (stage !== hintStage) {
        hintStage = stage;
        hintRevealed = false;
    }
}

function updateHintArea() {
    updateHintMilestones();
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
