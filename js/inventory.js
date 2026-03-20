// ─── Notes & Inventory System ─────────────────────────────────────────────────

const NOTE_KEY_HINT_ID      = 'key-hint';
const NOTE_VOLCANO_HINT_ID  = 'volcano-hint';
const NOTE_KEY_HINT_SRC     = 'images/key-hint.png';
const NOTE_VOLCANO_HINT_SRC = 'images/volcano-hint.png';

// Draws a parchment-paper look onto a canvas, compositing the given img on top
function renderNotePaper(canvas, img) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');

    // Base parchment
    ctx.fillStyle = '#C4A265';
    ctx.fillRect(0, 0, W, H);

    // Subtle horizontal grain
    ctx.strokeStyle = 'rgba(100,55,15,0.055)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 5) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Edge vignette / aging
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(55,22,5,0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Irregular border
    ctx.strokeStyle = 'rgba(75,38,8,0.58)';
    ctx.lineWidth = 11;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    // Draw the PNG image (black drawings composite over brown paper)
    const margin = 38;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const imgAspect = iw / ih;
    const availW = W - margin * 2;
    const availH = H - margin * 2;
    let dw, dh;
    if (imgAspect > availW / availH) {
        dw = availW; dh = availW / imgAspect;
    } else {
        dh = availH; dw = availH * imgAspect;
    }
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Creates the 3D note mesh group (flat on the ground by default).
// The texture face is added asynchronously once the image loads.
function buildNoteMesh3D(imgSrc, noteWidth, noteHeight, isFloating) {
    const noteGroup = new THREE.Group();
    noteGroup.userData.isNote = true;

    // Brown paper backing (thin flat box)
    const paperMat = new THREE.MeshLambertMaterial({ color: 0xB8935A });
    const backing = new THREE.Mesh(
        new THREE.BoxGeometry(noteWidth + 0.12, 0.05, noteHeight + 0.12),
        paperMat
    );
    backing.castShadow = true;
    backing.receiveShadow = true;
    noteGroup.add(backing);

    // Load image, render to canvas, apply as texture face
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = 512;
        canvas.height = 512;
        renderNotePaper(canvas, img);
        const tex = new THREE.CanvasTexture(canvas);
        const faceMat = new THREE.MeshBasicMaterial({ map: tex });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(noteWidth, noteHeight), faceMat);
        face.rotation.x = -Math.PI / 2; // face upward
        face.position.y = 0.04;
        noteGroup.add(face);
    };
    img.src = imgSrc;

    if (isFloating) {
        // Warm glow so it stands out on the ground
        const glow = new THREE.PointLight(0xFFD080, 4, 10);
        glow.position.y = 0.6;
        noteGroup.add(glow);
    }

    return noteGroup;
}

// ─── Spawn functions ──────────────────────────────────────────────────────────

function spawnVolcanoNote(wx, wy, wz, caveRotation) {
    const noteGroup = buildNoteMesh3D(NOTE_VOLCANO_HINT_SRC, 3.2, 2.1, false);
    noteGroup.position.set(wx, wy, wz);
    noteGroup.rotation.y = caveRotation + 0.65; // slight angle for natural look
    noteGroup.userData.noteId = NOTE_VOLCANO_HINT_ID;
    scene.add(noteGroup);
    volcanoHintNoteMesh = noteGroup;
}

function spawnKeyHintNote(deathPos) {
    const noteGroup = buildNoteMesh3D(NOTE_KEY_HINT_SRC, 3.2, 2.1, true);
    const baseY = deathPos.y + 0.9;
    noteGroup.position.set(deathPos.x, baseY, deathPos.z);
    noteGroup.rotation.y = Math.random() * Math.PI * 2;
    noteGroup.userData.noteId   = NOTE_KEY_HINT_ID;
    noteGroup.userData.bobPhase = Math.random() * Math.PI * 2;
    noteGroup.userData.baseY    = baseY;
    noteGroup.userData.isFloating = true;
    scene.add(noteGroup);
    keyHintNoteMesh  = noteGroup;
    keyHintNoteDropped = true;
}

// ─── Per-frame update ─────────────────────────────────────────────────────────

function updateNotes(delta) {
    if (keyHintNoteMesh && !keyHintNotePickedUp && keyHintNoteMesh.userData.isFloating) {
        keyHintNoteMesh.userData.bobPhase += delta * 1.8;
        keyHintNoteMesh.position.y =
            keyHintNoteMesh.userData.baseY + Math.sin(keyHintNoteMesh.userData.bobPhase) * 0.25;
        keyHintNoteMesh.rotation.y += delta * 0.45;
    }
}

function updateDoors(delta) {
    for (const door of houseDoors) {
        if (door.angle === door.targetAngle) continue;
        const prev = door.angle;
        door.angle = moveScalarToward(door.angle, door.targetAngle, delta * 3.5);
        door.pivot.rotation.y = door.angle;
        // Re-activate the wall collider once the door has fully swung shut
        if (door.targetAngle === 0 && door.angle === 0 && prev !== 0) {
            if (door.wallEntry) door.wallEntry.active = true;
        }
    }
}

// ─── Punch / pickup ───────────────────────────────────────────────────────────

function tryPickupNote(aimDir, punchRange) {
    const candidates = [];
    if (volcanoHintNoteMesh && !volcanoHintNotePickedUp)
        candidates.push({ mesh: volcanoHintNoteMesh, id: NOTE_VOLCANO_HINT_ID });
    if (keyHintNoteMesh && !keyHintNotePickedUp)
        candidates.push({ mesh: keyHintNoteMesh, id: NOTE_KEY_HINT_ID });

    for (const { mesh, id } of candidates) {
        const notePos = mesh.position.clone();
        const toNote  = notePos.sub(camera.position);
        const proj    = toNote.dot(aimDir);
        if (proj <= 0 || proj > punchRange) continue;
        const perp = toNote.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
        if (perp > 3.5) continue;

        scene.remove(mesh);
        if (id === NOTE_VOLCANO_HINT_ID) {
            volcanoHintNotePickedUp = true;
            volcanoHintNoteMesh = null;
            addInventoryItem(NOTE_VOLCANO_HINT_ID, 'Volcano Map', NOTE_VOLCANO_HINT_SRC);
        } else {
            keyHintNotePickedUp = true;
            keyHintNoteMesh = null;
            addInventoryItem(NOTE_KEY_HINT_ID, 'Mysterious Note', NOTE_KEY_HINT_SRC);
        }
        flashEquipHint('NOTE FOUND  —  Press I');
        return true;
    }
    return false;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

function addInventoryItem(id, name, imgSrc) {
    if (inventoryItems.find(i => i.id === id)) return;
    inventoryItems.push({ id, name, imgSrc });
    if (inventoryOpen) renderInventoryGrid();
}

function toggleInventory() {
    if (viewingNoteItem) {
        closeNoteViewer();
        return;
    }
    inventoryOpen = !inventoryOpen;
    const overlay = document.getElementById('inventory-overlay');
    if (inventoryOpen) {
        overlay.style.display = 'flex';
        renderInventoryGrid();
        if (document.pointerLockElement) document.exitPointerLock();
        isLocked = false;
    } else {
        overlay.style.display = 'none';
    }
}

let viewingNoteItem = null;

function renderInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (inventoryItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'inv-empty';
        empty.textContent = 'Nothing here yet…';
        grid.appendChild(empty);
        return;
    }
    for (const item of inventoryItems) {
        const el = document.createElement('div');
        el.className = 'inv-item';
        el.title = item.name;
        el.innerHTML =
            `<img class="inv-item-img" src="${item.imgSrc}" alt="${item.name}">` +
            `<span class="inv-item-label">${item.name}</span>`;
        el.addEventListener('click', () => openNoteViewer(item));
        grid.appendChild(el);
    }
}

function openNoteViewer(item) {
    viewingNoteItem = item;
    const viewer = document.getElementById('note-viewer');
    if (!viewer) return;
    const img = document.getElementById('note-viewer-img');
    if (img) img.src = item.imgSrc;
    viewer.style.display = 'flex';
}

function closeNoteViewer() {
    viewingNoteItem = null;
    const viewer = document.getElementById('note-viewer');
    if (viewer) viewer.style.display = 'none';
}
