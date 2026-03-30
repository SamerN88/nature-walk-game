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
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(noteWidth, noteHeight), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.02;
    noteGroup.add(plane);

    // No image is drawn on the 3D floor note — all un-picked-up notes look the
    // same (plain parchment).  The image is shown in the inventory viewer after
    // the player picks the note up.  Keeping the canvas untainted also avoids
    // the texSubImage2D SecurityError that occurs when an <img> is drawn onto a
    // 2D canvas and then uploaded to WebGL.

    if (isFloating) {
        const glow = new THREE.PointLight(0xFFD080, 2.5, 9);
        glow.userData.isNoteGlow = true;
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
    keyHintNoteSpawnTime = performance.now();
    keyHintNoteLockTimer = 3;
}

// ─── Per-frame update ─────────────────────────────────────────────────────────

function updateNotes(delta) {
    if (keyHintNoteMesh && !keyHintNotePickedUp && keyHintNoteMesh.userData.isFloating) {
        keyHintNoteMesh.userData.bobPhase += delta * 1.8;
        keyHintNoteMesh.position.y =
            keyHintNoteMesh.userData.baseY + Math.sin(keyHintNoteMesh.userData.bobPhase) * 0.25;
        keyHintNoteMesh.rotation.y += delta * 0.45;

        const elapsed = (performance.now() - keyHintNoteSpawnTime) / 1000;
        keyHintNoteLockTimer = Math.max(0, 3 - elapsed);

        if (elapsed < 3) {
            const phase = elapsed * 2 * Math.PI;
            const pulse = 2 - 2 * Math.cos(phase);
            keyHintNoteMesh.traverse(obj => {
                if (obj.isMesh && obj.material?.color) {
                    obj.material.color.setRGB(1, 0.88 + pulse * 0.06, 0.72 + pulse * 0.14);
                }
                if (obj.isLight && obj.userData.isNoteGlow) {
                    obj.intensity = 0.6 + pulse * 1.9;
                }
            });
        } else {
            keyHintNoteMesh.traverse(obj => {
                if (obj.isMesh && obj.material?.color) {
                    obj.material.color.setRGB(1, 1, 1);
                }
                if (obj.isLight && obj.userData.isNoteGlow) {
                    obj.intensity = 0.6;
                }
            });
        }
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
        if (id === NOTE_KEY_HINT_ID && keyHintNoteLockTimer > 0) continue;

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
            keyHintNoteLockTimer = 0;
            addInventoryItem(NOTE_KEY_HINT_ID, 'Mysterious Note', NOTE_KEY_HINT_SRC);
        }
        flashEquipHint('NOTE FOUND');
        return true;
    }
    return false;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

function addInventoryItem(id, name, imgSrc, opts = {}) {
    if (inventoryItems.find(i => i.id === id)) return;
    inventoryItems.push({ id, name, imgSrc, type: opts.type || 'note', itemKey: opts.itemKey });
    if (inventoryOpen) renderInventoryGrid();
}

function removeInventoryItem(id) {
    const idx = inventoryItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    inventoryItems.splice(idx, 1);
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
        overlay.style.display = 'block';
        renderInventoryGrid();
        renderHandheldBar();
        if (document.pointerLockElement) document.exitPointerLock();
        isLocked = false;
    } else {
        overlay.style.display = 'none';
        if (!playerDead) renderer.domElement.requestPointerLock();
    }
}

let viewingNoteItem = null;

function setupHiDPICanvas(canvas, cssWidth, cssHeight, maxDpr = 2) {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, maxDpr));
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    if (cssWidth > 0) canvas.style.width = cssWidth + 'px';
    if (cssHeight > 0) canvas.style.height = cssHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    return ctx;
}

function drawContainedImage(ctx, img, boxWidth, boxHeight) {
    const scale = Math.min(boxWidth / img.width, boxHeight / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.drawImage(img, (boxWidth - drawW) / 2, (boxHeight - drawH) / 2, drawW, drawH);
}

function renderInventoryGrid() {
    const grid  = document.getElementById('inventory-grid');
    const panel = document.getElementById('inventory-panel');
    if (!grid) return;
    // Only show the notes panel when there is at least one item
    if (panel) panel.style.display = inventoryItems.length > 0 ? '' : 'none';
    grid.innerHTML = '';
    for (const item of inventoryItems) {
        const el = document.createElement('div');
        el.className = 'inv-item';
        el.title = item.name;

        if (item.type === 'object') {
            // Static object art stays crisp as a plain <img>; rendered 3D items still use the canvas path.
            if (item.imgSrc) {
                const img = document.createElement('img');
                img.className = 'inv-object-image';
                img.src = item.imgSrc;
                img.alt = item.name;
                img.draggable = false;
                el.appendChild(img);
            } else {
                const iconSrc = _renderItemIconDataURL(item.itemKey);
                const SLOT_SIZE = 62;
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.style.display = 'block';
                thumbCanvas.style.borderRadius = '3px';
                const tctx = setupHiDPICanvas(thumbCanvas, SLOT_SIZE, SLOT_SIZE, 3);
                const tImg = new Image();
                tImg.onload = () => {
                    tctx.clearRect(0, 0, SLOT_SIZE, SLOT_SIZE);
                    drawContainedImage(tctx, tImg, SLOT_SIZE, SLOT_SIZE);
                };
                tImg.src = iconSrc;
                el.appendChild(thumbCanvas);
            }
            el.addEventListener('click', () => openItemViewer(item));
        } else {
            // Render a torn-edge parchment thumbnail in a small canvas.
            // Use the same 4:3 aspect ratio as the note viewer (640×480) so the
            // thumbnail looks like a scaled-down version of the expanded note.
            const NOTE_AR = 640 / 480; // 4:3, matches openNoteViewer canvas
            const THUMB_CONTENT = 70;  // inv-item content area (80px box - 5px padding each side)
            const THUMB_W = THUMB_CONTENT;
            const THUMB_H = Math.round(THUMB_CONTENT / NOTE_AR); // 53px
            const TW = 256, TH = Math.round(256 / NOTE_AR); // 256×192
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = TW;
            thumbCanvas.height = TH;
            thumbCanvas.style.width = THUMB_W + 'px';
            thumbCanvas.style.height = THUMB_H + 'px';
            thumbCanvas.style.display = 'block';
            thumbCanvas.style.borderRadius = '3px';
            const tctx = thumbCanvas.getContext('2d');
            const tTornPath = makeTornEdgePath(TW, TH, 14, 11);
            const tWrinkles = Array.from({ length: 4 }, () => [
                Math.random() * TW, Math.random() * TH, 35 + Math.random() * 45,
            ]);
            drawNotePaper(tctx, TW, TH, tTornPath, tWrinkles, null);
            const tImg = new Image();
            tImg.onload = () => {
                drawNotePaper(tctx, TW, TH, tTornPath, tWrinkles, tImg);
            };
            tImg.src = item.imgSrc;

            el.appendChild(thumbCanvas);
            el.addEventListener('click', () => openNoteViewer(item));
        }
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

function openItemViewer(item) {
    // Reuse the note-viewer container to show either the supplied object image
    // or the rendered 3D icon on a plain dark background.
    viewingNoteItem = item;
    const viewer = document.getElementById('note-viewer');
    const canvas = document.getElementById('note-viewer-canvas');
    if (!viewer || !canvas) return;

    const VW = 480, VH = 480;
    const vctx = setupHiDPICanvas(canvas, VW, VH, 3);

    if (item.imgSrc) {
        vctx.fillStyle = 'rgba(18,18,22,1)';
        vctx.fillRect(0, 0, VW, VH);
        const vImg = new Image();
        vImg.onload = () => {
            drawContainedImage(vctx, vImg, VW, VH);
        };
        vImg.src = item.imgSrc;
        viewer.style.display = 'flex';
        return;
    }

    // Render the 3D icon at high resolution for the viewer
    _getIconRenderer();
    _iconRenderer.setSize(VW, VH);
    for (const m of _iconMeshes) _iconScene.remove(m);
    _iconMeshes = [];

    const cfg = _iconCamConfigs[item.itemKey] || _iconCamConfigs.fist;
    _iconCamera.position.set(...cfg.cam);
    _iconCamera.lookAt(...cfg.look);

    let mesh = null;
    switch (item.itemKey) {
        case 'golden-key':
            mesh = createGoldenKeyMesh();
            mesh.rotation.z = Math.PI * 0.25;
            mesh.rotation.y = 0.4;
            mesh.position.set(0, -0.05, 0);
            break;
    }
    if (mesh) { _iconScene.add(mesh); _iconMeshes.push(mesh); }
    _iconRenderer.render(_iconScene, _iconCamera);

    // Draw the rendered icon centered on a dark background
    vctx.fillStyle = 'rgba(18,18,22,1)';
    vctx.fillRect(0, 0, VW, VH);
    const dataUrl = _iconRenderer.domElement.toDataURL();
    _iconRenderer.setSize(200, 200); // restore default size
    const vImg = new Image();
    vImg.onload = () => { vctx.drawImage(vImg, 0, 0, VW, VH); };
    vImg.src = dataUrl;

    viewer.style.display = 'flex';
}

function closeNoteViewer() {
    viewingNoteItem = null;
    const viewer = document.getElementById('note-viewer');
    if (viewer) viewer.style.display = 'none';
}

// ─── Handheld icon renderer ────────────────────────────────────────────────────

let _iconRenderer = null;
let _iconScene = null;
let _iconCamera = null;
let _iconMeshes = [];

// Per-item camera positions and lookAt targets for best framing
const _iconCamConfigs = {
    fist:       { cam: [0, 0.5, 1.6],  look: [0, 0.3, 0] },
    shovel:     { cam: [1.0, 1.2, 2.6], look: [0, 0.3, 0] },
    ak47:       { cam: [0.3, 0.5, 1.8], look: [0, 0.2, 0] },
    stake:      { cam: [0.6, 1.1, 1.9], look: [0, 0.6, 0] },
    torch:      { cam: [0.6, 0.9, 1.9], look: [0, 0.5, 0] },
    'golden-key': { cam: [1.2, 0.8, 2.0], look: [0, 0, 0] },
};

function _getIconRenderer() {
    if (_iconRenderer) return _iconRenderer;
    _iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _iconRenderer.setSize(200, 200);
    _iconRenderer.setClearColor(0x000000, 0);

    _iconScene = new THREE.Scene();

    _iconCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

    const dLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dLight.position.set(2, 3, 2);
    _iconScene.add(dLight);
    _iconScene.add(new THREE.AmbientLight(0x808080, 1.2));

    return _iconRenderer;
}

function _renderItemIconDataURL(itemName) {
    _getIconRenderer();
    for (const m of _iconMeshes) _iconScene.remove(m);
    _iconMeshes = [];

    // Position camera for this item
    const cfg = _iconCamConfigs[itemName] || _iconCamConfigs.fist;
    _iconCamera.position.set(...cfg.cam);
    _iconCamera.lookAt(...cfg.look);

    let mesh = null;
    switch (itemName) {
        case 'fist': {
            // Skin-colored sphere representing the player's hand
            // const mat = new THREE.MeshLambertMaterial({ color: 0xffdbac });
            // mesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat);
            // mesh.position.set(0, 0.35, 0);
            // break;
            return 'images/fist.png';
        }
        case 'shovel':
            mesh = createShovelMesh(0.42);
            mesh.position.set(0, -0.4, 0);
            break;
        case 'ak47': {
            const { mesh: gun } = createAK47Mesh(0.6);
            gun.rotation.y = 0.25;
            gun.position.set(-0.15, 0.15, -0.35);
            mesh = gun;
            break;
        }
        case 'stake':
            mesh = createPlayerStakeMesh(0.82);
            mesh.position.set(0, -0.2, 0);
            break;
        case 'torch':
            mesh = createPlayerTorchMesh(0.82);
            // Flip to match in-game orientation (flame at top).
            // Icon only applies rotation.z = PI (no rotation.x tilt), so the flameGroup
            // counter-rotation must be PI (not PI - PI/3.5) to keep flame pointing world +Y.
            mesh.rotation.z = Math.PI;
            if (mesh.userData.flameGroup) mesh.userData.flameGroup.rotation.x = Math.PI;
            mesh.position.set(0, 0.2, 0);
            break;
        case 'golden-key':
            mesh = createGoldenKeyMesh();
            mesh.rotation.z = Math.PI * 0.25; // 45-degree tilt
            mesh.rotation.y = 0.4;
            mesh.position.set(0, -0.05, 0);
            break;
    }

    if (mesh) {
        _iconScene.add(mesh);
        _iconMeshes.push(mesh);
    }

    _iconRenderer.render(_iconScene, _iconCamera);
    return _iconRenderer.domElement.toDataURL();
}

function renderHandheldBar() {
    const panel = document.getElementById('handheld-panel');
    const row   = document.getElementById('handheld-slots-row');
    if (!panel || !row) return;

    // Only show the handheld panel when the player has something beyond the fist
    if (handSlots.length <= 1) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = '';

    const tooltip = document.getElementById('handheld-tooltip');

    row.innerHTML = '';
    for (let i = 0; i < handSlots.length; i++) {
        const item = handSlots[i];
        const displayName = getItemDisplayName(item);

        const slot = document.createElement('div');
        slot.className = 'handheld-slot';

        const num = document.createElement('span');
        num.className = 'handheld-slot-number';
        num.textContent = i + 1;
        slot.appendChild(num);

        const img = document.createElement('img');
        // Fist uses the dedicated PNG; everything else uses the 3D icon renderer
        img.src = _renderItemIconDataURL(item);
        img.alt = displayName;
        slot.appendChild(img);

        // Hover tooltip
        if (tooltip) {
            slot.addEventListener('mouseenter', () => {
                tooltip.textContent = displayName;
                tooltip.style.display = 'block';
                const r = slot.getBoundingClientRect();
                tooltip.style.left = (r.left + r.width / 2) + 'px';
                tooltip.style.top  = (r.top - 8) + 'px';
                tooltip.style.transform = 'translate(-50%, -100%)';
            });
            slot.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }

        row.appendChild(slot);
    }
}
