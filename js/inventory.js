// ─── Notes & Inventory System ─────────────────────────────────────────────────

const NOTE_KEY_HINT_ID      = 'key-hint';
const NOTE_VOLCANO_HINT_ID  = 'volcano-hint';
const NOTE_KEY_HINT_SRC     = 'images/key-hint.png';
const NOTE_VOLCANO_HINT_SRC = 'images/volcano-hint.png';

// Generates a stable torn-edge polygon path as an array of [x,y] points.
function makeTornEdgePath(W, H, step, jag) {
    const pts = [];
    function p(x, y) { pts.push([x, y]); }
    // Top (L→R)
    p(Math.random() * jag * 0.4, Math.random() * jag * 0.5);
    for (let x = step; x < W - step; x += step)
        p(x + (Math.random() - 0.5) * jag * 0.7, Math.random() * jag * 0.85);
    p(W - Math.random() * jag * 0.4, Math.random() * jag * 0.5);
    // Right (T→B)
    for (let y = step; y < H - step; y += step)
        p(W - Math.random() * jag * 0.85, y + (Math.random() - 0.5) * jag * 0.7);
    p(W - Math.random() * jag * 0.4, H - Math.random() * jag * 0.5);
    // Bottom (R→L)
    for (let x = W - step; x > step; x -= step)
        p(x + (Math.random() - 0.5) * jag * 0.7, H - Math.random() * jag * 0.85);
    p(Math.random() * jag * 0.4, H - Math.random() * jag * 0.5);
    // Left (B→T)
    for (let y = H - step; y > step; y -= step)
        p(Math.random() * jag * 0.85, y + (Math.random() - 0.5) * jag * 0.7);
    return function applyPath(ctx) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
    };
}

// Draws parchment paper (+ optional image) onto a canvas, clipped to the torn edge.
function drawNotePaper(ctx, W, H, applyTornPath, wrinkles, img) {
    ctx.clearRect(0, 0, W, H);
    applyTornPath(ctx);
    ctx.save();
    ctx.clip();

    // Base parchment
    ctx.fillStyle = '#C4A265';
    ctx.fillRect(0, 0, W, H);

    // Subtle horizontal grain
    ctx.strokeStyle = 'rgba(100,55,15,0.055)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 5) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Wrinkle/shadow spots
    for (const [gx, gy, gr] of wrinkles) {
        const wg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        wg.addColorStop(0, 'rgba(70,35,8,0.09)');
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg;
        ctx.fillRect(0, 0, W, H);
    }

    // Edge vignette
    const ev = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.7);
    ev.addColorStop(0, 'rgba(0,0,0,0)');
    ev.addColorStop(1, 'rgba(55,22,5,0.36)');
    ctx.fillStyle = ev;
    ctx.fillRect(0, 0, W, H);

    // Image composited on top
    if (img) {
        const margin = 34;
        const iw = img.naturalWidth || img.width || 1;
        const ih = img.naturalHeight || img.height || 1;
        const ar = iw / ih;
        const avW = W - margin * 2, avH = H - margin * 2;
        let dw, dh;
        if (ar > avW / avH) { dw = avW; dh = avW / ar; }
        else                 { dh = avH; dw = avH * ar; }
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    ctx.restore();

    // Torn edge shadow stroke (drawn outside clip so it follows the ragged outline)
    applyTornPath(ctx);
    ctx.strokeStyle = 'rgba(55,25,5,0.38)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
}

// Creates the 3D note mesh (flat on the ground), with torn irregular edges
// and parchment texture visible without scene lighting (MeshBasicMaterial).
function buildNoteMesh3D(imgSrc, noteWidth, noteHeight, isFloating) {
    const noteGroup = new THREE.Group();
    noteGroup.userData.isNote = true;

    const PW = 512, PH = 384;
    const canvas = document.createElement('canvas');
    canvas.width = PW; canvas.height = PH;
    const ctx = canvas.getContext('2d');

    // Generate stable torn-edge points and random wrinkle spots once
    const applyTornPath = makeTornEdgePath(PW, PH, 18, 15);
    const wrinkles = Array.from({ length: 5 }, () => [
        Math.random() * PW,
        Math.random() * PH,
        55 + Math.random() * 75,
    ]);

    // Initial draw (parchment visible immediately, before image loads)
    drawNotePaper(ctx, PW, PH, applyTornPath, wrinkles, null);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: false,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(noteWidth, noteHeight), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.02;
    noteGroup.add(plane);

    // Load image and redraw with it composited
    const img = new Image();
    img.onload = () => {
        drawNotePaper(ctx, PW, PH, applyTornPath, wrinkles, img);
        tex.needsUpdate = true;
    };
    img.src = imgSrc;

    if (isFloating) {
        const glow = new THREE.PointLight(0xFFD080, 2.5, 9);
        glow.position.y = 0.6;
        noteGroup.add(glow);
    }

    return noteGroup;
}

// ─── Spawn functions ──────────────────────────────────────────────────────────

// parent: optional Three.js Object3D to attach to (e.g. cave group).
// If omitted, added to scene root. Coords are in parent's local space when parent is given.
function spawnVolcanoNote(x, y, z, noteRotation, parent) {
    const noteGroup = buildNoteMesh3D(NOTE_VOLCANO_HINT_SRC, 1.1, 0.75, false);
    noteGroup.position.set(x, y, z);
    noteGroup.rotation.y = noteRotation;
    noteGroup.userData.noteId = NOTE_VOLCANO_HINT_ID;
    (parent || scene).add(noteGroup);
    volcanoHintNoteMesh = noteGroup;
}

function spawnKeyHintNote(deathPos) {
    const noteGroup = buildNoteMesh3D(NOTE_KEY_HINT_SRC, 1.1, 0.75, true);
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
        // Use world position so notes parented to structures (e.g. cave group) work correctly
        const notePos = new THREE.Vector3();
        mesh.getWorldPosition(notePos);
        const toNote  = notePos.clone().sub(camera.position);
        const proj    = toNote.dot(aimDir);
        if (proj <= 0 || proj > punchRange) continue;
        const perp = toNote.clone().sub(aimDir.clone().multiplyScalar(proj)).length();
        if (perp > 3.5) continue;

        mesh.removeFromParent(); // works whether parented to scene or a group
        if (id === NOTE_VOLCANO_HINT_ID) {
            volcanoHintNotePickedUp = true;
            volcanoHintNoteMesh = null;
            addInventoryItem(NOTE_VOLCANO_HINT_ID, 'Volcano Map', NOTE_VOLCANO_HINT_SRC);
        } else {
            keyHintNotePickedUp = true;
            keyHintNoteMesh = null;
            addInventoryItem(NOTE_KEY_HINT_ID, 'Mysterious Note', NOTE_KEY_HINT_SRC);
        }
        flashEquipHint('NOTE FOUND');
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
    const wasViewingNote = !!viewingNoteItem;
    if (viewingNoteItem) {
        closeNoteViewer();
    }
    if (wasViewingNote) {
        // I pressed while viewing a note: close note AND inventory entirely
        inventoryOpen = false;
        document.getElementById('inventory-overlay').style.display = 'none';
        if (!playerDead) renderer.domElement.requestPointerLock();
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
        if (!playerDead) renderer.domElement.requestPointerLock();
    }
}

let viewingNoteItem = null;

function renderInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const item of inventoryItems) {
        const el = document.createElement('div');
        el.className = 'inv-item';
        el.title = item.name;

        // Render a torn-edge parchment thumbnail in a small canvas
        const TW = 256, TH = 192;
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = TW;
        thumbCanvas.height = TH;
        thumbCanvas.style.width = '62px';
        thumbCanvas.style.height = '46px';
        thumbCanvas.style.display = 'block';
        thumbCanvas.style.borderRadius = '3px';
        const tctx = thumbCanvas.getContext('2d');
        const tTornPath = makeTornEdgePath(TW, TH, 14, 11);
        const tWrinkles = Array.from({ length: 4 }, () => [
            Math.random() * TW, Math.random() * TH, 35 + Math.random() * 45,
        ]);
        drawNotePaper(tctx, TW, TH, tTornPath, tWrinkles, null);
        const tImg = new Image();
        tImg.onload = () => { drawNotePaper(tctx, TW, TH, tTornPath, tWrinkles, tImg); };
        tImg.src = item.imgSrc;

        el.appendChild(thumbCanvas);
        el.addEventListener('click', () => openNoteViewer(item));
        grid.appendChild(el);
    }
}

function openNoteViewer(item) {
    viewingNoteItem = item;
    const viewer = document.getElementById('note-viewer');
    if (!viewer) return;

    // Render into the viewer canvas with torn parchment look
    const canvas = document.getElementById('note-viewer-canvas');
    const VW = 640, VH = 480;
    canvas.width = VW;
    canvas.height = VH;
    const vctx = canvas.getContext('2d');
    const vTornPath = makeTornEdgePath(VW, VH, 22, 18);
    const vWrinkles = Array.from({ length: 6 }, () => [
        Math.random() * VW, Math.random() * VH, 65 + Math.random() * 95,
    ]);
    drawNotePaper(vctx, VW, VH, vTornPath, vWrinkles, null);
    const vImg = new Image();
    vImg.onload = () => { drawNotePaper(vctx, VW, VH, vTornPath, vWrinkles, vImg); };
    vImg.src = item.imgSrc;

    viewer.style.display = 'flex';
}

function closeNoteViewer() {
    viewingNoteItem = null;
    const viewer = document.getElementById('note-viewer');
    if (viewer) viewer.style.display = 'none';
}
