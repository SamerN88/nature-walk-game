// ═══════════════════════════════════════════════════════════════════════════
// NW-BOT (js/botrun.js) — an optional, fully deterministic bot that plays the
// entire game. Dormant unless activated by the subtle "bot run" button on the
// title screen (or by the standalone harness in ../nature-walk-bot, which sets
// the same localStorage flag). See that folder's README for the architecture.
//
// window.__nwBotStart() arms the brain; window.__nwBotStop() disarms it (the
// green HUD banner is click-to-stop). localStorage 'nw-botrun' = bot mode on —
// the boot hook at the bottom of this file re-arms the brain after every page
// reload (world-reset deaths and save & quit reload by design), which is what
// makes the campaign resumable end to end.
// ═══════════════════════════════════════════════════════════════════════════
window.__nwBotStart = function () {
// ═══════════════════════════════════════════════════════════════════════════
// NW-BOT controller — the in-page brain. Injected by nw-bot.js (wrapped in an
// IIFE, so top-level `return` is legal and every injection gets a fresh scope).
//
// Architecture (three layers, strict input ownership: war > guard > motor):
//   MOTOR — one 60ms tick executing the current "task" (goto / nav / fly /
//           combat / aimhold / sweep / dive / climb / cemkite / angels).
//   REACT — two always-on watchers: the creature GUARD (kites night creatures
//           with the AK) and the WAR fighter (circuit-gunner for the demon
//           apocalypse and hell rounds, with latched death-screen clicks).
//   FSM   — an async campaign orchestrator. Every phase has a done() predicate
//           derived purely from live game state, so after any page reload
//           (deaths outside the apocalypse hard-reset the world by design)
//           the campaign fast-forwards to wherever the restored save left off.
//
// All tactics in here were battle-tested during the manual autopilot campaign:
// cemetery circle-kite, HH stair-climb + angel freeze-funnel, altar night window,
// volcano dive parameters, demon-war circuit gunner, cave mouth probing.
// ═══════════════════════════════════════════════════════════════════════════

// ── Teardown any previous instance ──────────────────────────────────────────
if (window.BOT && window.BOT._teardown) { try { window.BOT._teardown(); } catch (e) {} }

const BOT = {
    gen: window.BOT ? (window.BOT.gen || 0) + 1 : 1,
    phase: 'boot', detail: '', note: '',
    aborted: false, guardSuspended: false,
    _iv: [], _to: [],
};
window.BOT = BOT;

const DO_HELL_RUN = true;         // play hell rounds until death, then leave
const COMPLETE_KEY = 'nw-bot-complete';

BOT._teardown = function () {
    BOT.aborted = true;
    BOT._iv.forEach(clearInterval); BOT._to.forEach(clearTimeout);
    try {
        moveForward = moveBackward = moveLeft = moveRight = false;
        isRunning = false; spaceHeld = false; ak47TriggerHeld = false;
    } catch (e) {}
};
const ivl = (fn, ms) => { const id = setInterval(fn, ms); BOT._iv.push(id); return id; };

// ── LIB: input + geometry helpers ───────────────────────────────────────────
const V3 = THREE.Vector3;
const key = (code, type = 'keydown') => document.dispatchEvent(new KeyboardEvent(type, { code }));
const jump = () => { key('Space'); key('Space', 'keyup'); };
const press = (code) => { key(code); key(code, 'keyup'); };
let _lastEquip = 0;
function equip(item) {
    if (currentHandItem === item) return true;
    const idx = handSlots.indexOf(item);
    if (idx === -1) return false;
    const now = performance.now();
    if (now - _lastEquip < 400) return false;   // debounce
    _lastEquip = now;
    press('Digit' + (idx + 1));
    return true;
}
function clearMove() {
    moveForward = moveBackward = moveLeft = moveRight = false;
    isRunning = false; spaceHeld = false; ak47TriggerHeld = false;
}

const nearestOf = (arr, getPos) => {
    let best = null, bd = Infinity;
    for (const e of arr) {
        const p = getPos(e); if (!p) continue;
        const d = (p.x - player.position.x) ** 2 + (p.z - player.position.z) ** 2;
        if (d < bd) { bd = d; best = p; }
    }
    return best;
};
const worldPosOf = obj => { const v = new V3(); obj.getWorldPosition(v); return v; };

const SEL = {
    'tree-near': () => {
        let best = null, bd = Infinity;
        for (const t of trees) {
            const d = (t.position.x - player.position.x) ** 2 + (t.position.z - player.position.z) ** 2;
            if (d < bd) { bd = d; best = t; }
        }
        return best ? best.position.clone().add(new V3(0, 1.5 * (best.userData.treeScale || 1), 0)) : null;
    },
    'farmer': () => { const f = npcs.find(n => n.isFarmer); return f ? f.mesh.position.clone().add(new V3(0, 1.4, 0)) : null; },
    'npc': () => nearestOf(npcs, n => n.mesh.position.clone().add(new V3(0, n.type === 'bird' ? 0 : 1.2, 0))),
    'creature': () => nearestOf(nightCreatures, c => c.emergeTimer > 0 ? null : c.mesh.position.clone().add(new V3(0, c.gunHitCenterY, 0))),
    'demon': () => nearestOf(demons, d => d.mesh.position.clone().add(new V3(0, 3.5, 0))),
    'shadowman': () => shadowMan ? shadowMan.mesh.position.clone().add(new V3(0, 5.4, 0)) : null,
    'dragon': () => (dragon && dragon.visible) ? dragon.position.clone().add(new V3(0, 1, 0)) : null,
    'shovel': () => tentShovelMesh ? worldPosOf(tentShovelMesh) : null,
    'key': () => goldenKeyMesh ? goldenKeyMesh.position.clone() : null,
    'talisman': () => talismanItemMesh ? talismanItemMesh.position.clone() : null,
    'chest': () => akChest ? new V3(akChest.worldX, akChest.worldY + 0.6, akChest.worldZ) : null,
    'grave': () => cemeteryData ? worldPosOf(cemeteryData.talismanGraveHitRoot) : null,
    'digzone': () => bigLake ? new V3(bigLake.x, bigLake.floorY, bigLake.z) : null,
    'campfire-near': () => { const p = nearestOf(campfirePositions, q => q.clone()); return p ? p.add(new V3(0, 1.7, 0)) : null; },
    'corpse': () => altarData ? altarData.corpseHitPos.clone() : null,
    'note-key': () => keyHintNoteMesh ? keyHintNoteMesh.position.clone() : null,
    'note-volcano': () => volcanoHintNoteMesh ? worldPosOf(volcanoHintNoteMesh) : null,
    'gem-dragon': () => (dragonGem && !dragonGemCollected) ? dragonGem.mesh.position.clone() : null,
    'gem-secret': () => (secretGem && !gemCollected) ? secretGem.mesh.position.clone() : null,
    'gem-holy': () => (holyGem && !holyGemCollected) ? holyGem.mesh.position.clone() : null,
    'shrine': () => shrine ? shrine.position.clone().add(new V3(0, 4, 0)) : null,
    'ss-sword': () => (hauntedHouseData && hauntedHouseData.ssItemGrp.visible) ? worldPosOf(hauntedHouseData.worldSword) : null,
};
for (let i = 0; i < 3; i++) {
    SEL['altarTorch-' + i] = () => altarData ? altarData.torchWorldTips[i].clone().add(new V3(0, -1.6, 0)) : null;
}
// Ground NPCs only — the npcs array also holds 200 BIRDS, which fly at
// flyHeight and can never be meleed (the bot once trailed one with the
// crosshair, sword drawn, like a confused cat). No NPC has flee logic.
// Ground NPCs at a REACHABLE height. Two filters, both load-bearing:
// birds fly (never meleeable), and anything far above/below us is unreachable
// too — melee checks 3-D distance while goto only measures XZ, so an NPC on a
// bank overhead reads as "arrived" to the walker and "way out of range" to the
// puncher. That mismatch stranded the bot at the bottom of the dig lake,
// sword out, watching passers-by for 21 minutes.
function meleeNPCs() {
    return npcs.filter(n => n.type !== 'bird' &&
        Math.abs(n.mesh.position.y - player.position.y) < 10);
}
SEL['npc-near'] = () => {
    const p = nearestOf(meleeNPCs(), q => q.mesh.position);
    return p ? new V3(p.x, p.y + 1.2, p.z) : null;
};
function resolve(sel) {
    if (typeof sel === 'object') return new V3(sel.x, sel.y, sel.z);
    if (sel.startsWith('point:')) { const [x, y, z] = sel.slice(6).split(',').map(Number); return new V3(x, y, z); }
    const f = SEL[sel];
    return f ? f() : null;
}

// Camera aim with pitch feedback; returns angular error (radians).
const _dir = new V3(), _want = new V3();
function aimAt(target) {
    cameraYaw = Math.atan2(target.x - player.position.x, target.z - player.position.z);
    camera.getWorldDirection(_dir);
    _want.copy(target).sub(camera.position).normalize();
    const errY = Math.asin(Math.max(-1, Math.min(1, _want.y))) - Math.asin(Math.max(-1, Math.min(1, _dir.y)));
    cameraPitch = Math.max(-1.5, Math.min(1.5, cameraPitch - errY * 0.7));
    return _dir.angleTo(_want);
}
// Hitscan lead. The AK fires along the CAMERA's world direction on the game's
// own frame loop — up to a full react-tick AFTER we aimed — while both the bot
// (orbit-strafing at run speed) and the creature keep moving. That staleness
// put every shot a hair behind the target. Aim instead at the target displaced
// by the RELATIVE velocity over the staleness window, so the crosshair sits
// where the target will be when the shot actually samples the camera.
// Velocity is measured from the entity's own position deltas (stored on it).
const LEAD_S = 0.07;                 // ≈ half a react tick + a render frame
function leadTarget(ent, tx, tz) {
    const now = performance.now();
    let vx = 0, vz = 0;
    if (ent._ldT) {
        const dt = (now - ent._ldT) / 1000;
        if (dt > 0.01 && dt < 0.5) {
            vx = (tx - ent._ldX) / dt; vz = (tz - ent._ldZ) / dt;
            if (Math.hypot(vx, vz) > 45) { vx = 0; vz = 0; }  // spawn/teleport spike
        }
    }
    ent._ldX = tx; ent._ldZ = tz; ent._ldT = now;
    return { x: tx + (vx - velocity.x) * LEAD_S, z: tz + (vz - velocity.z) * LEAD_S };
}

// ── Exact dragon-beam aim (closed form) ─────────────────────────────────────
// Mounted, the camera is pinned looking at L = dragon + 18y from an offset
// built out of (cameraYaw, cameraPitch) — dragon.js:326. The beam is therefore
// the ray camPos → L. Writing "that ray passes through target T" out in full,
// with w = T − dragon, wh = |w.xz|, and ph the piecewise pitch-height term:
//     yaw = atan2(w.x, w.z)                    (camera, dragon and T coplanar)
//     ph  = 2 + 35·cos(p)·(18 − w.y)/wh   ⟹   k·sin(p) + B·cos(p) = 2
// with B = 35(w.y − 18)/wh and k = 22.75 when p > 0, 63 when p ≤ 0. That is a
// standard harmonic equation, so the pitch comes out in ONE step — no feedback
// lag, correct on a moving dragon against a moving target. (The old aimAt loop
// corrected only 70% of the error per 60ms tick and never settled while
// hovering: measured 11–20° residual and a 46% beam hit rate.)
function dragonAimSolve(tx, ty, tz) {
    const dp = dragon.position;
    const wx = tx - dp.x, wy = ty - dp.y, wz = tz - dp.z;
    const wh = Math.hypot(wx, wz);
    if (wh < 0.5) return false;                          // directly overhead: no solution
    const B = 35 * (wy - 18) / wh;
    for (const k of [22.75, 63]) {                       // p > 0 branch, then p ≤ 0
        const R = Math.hypot(k, B);
        if (R < 2) continue;
        const phi = Math.atan2(B, k), a = Math.asin(2 / R);
        for (const base of [a, Math.PI - a]) {
            let p = base - phi;
            while (p > Math.PI) p -= 2 * Math.PI;
            while (p < -Math.PI) p += 2 * Math.PI;
            if (Math.abs(p) > 1.45) continue;            // beyond usable pitch
            if ((k === 22.75) !== (p > 0)) continue;     // branch must match its own case
            cameraYaw = Math.atan2(wx, wz);
            cameraPitch = p;
            return true;
        }
    }
    return false;
}

// Height of whatever you would land on at (x,z) — terrain OR structures. The
// big cone mountains are `structures` primitives, NOT terrain, so
// getGroundHeight alone is blind to them: an early version of beamClear used
// it and happily "saw" straight through a mountain.
function surfaceH(x, z) {
    let h = getGroundHeight(x, z);
    if (typeof getStructureHeight === 'function') {
        const s = getStructureHeight(x, z);
        if (s > h) h = s;
    }
    return h;
}

// Does the beam have a clear run from the dragon to this point? The beam stops
// at the first solid it meets (dragonBeamAttack raycasts the scene and caps the
// kill ray there), so sample the surface under the line and reject anything
// hiding behind a ridge or a peak.
function beamClear(tx, ty, tz) {
    const dp = dragon.position;
    for (let i = 1; i < 14; i++) {
        const f = i / 14;
        const x = dp.x + (tx - dp.x) * f, z = dp.z + (tz - dp.z) * f;
        const y = dp.y + (ty - dp.y) * f;
        if (surfaceH(x, z) > y + 1) return false;
    }
    return true;
}

// True angular error between the beam (the real camera direction) and the
// line to a target — read-only, no camera mutation. Used to hold fire when we
// are not actually aimed (chase pot-shots used to spray and miss).
function aimErrorTo(tx, ty, tz) {
    camera.getWorldDirection(_dir);
    _want.set(tx, ty, tz).sub(camera.position).normalize();
    return _dir.angleTo(_want);
}

// Angular tolerance for a melee swing, SCALED BY DISTANCE: a body of the
// given half-width subtends a big angle up close and a tiny one far away, so
// a fixed gate makes the bot stand and stare exactly where it could hit.
function meleeAngTol(dist, halfWidth = 1.6) {
    return Math.min(0.6, Math.max(0.12, Math.atan2(halfWidth, Math.max(1, dist))));
}

let _lastPunch = 0;
function maybePunch(cadenceMs = 300) {
    const now = performance.now();
    if (now - _lastPunch < cadenceMs) return false;
    _lastPunch = now;
    punch();
    return true;
}

// Structure-collision probe at a given height (walls/domes/pillars).
function blockedXZ(x, z, margin, py) {
    // solidWalls is a SEPARATE registry from structures (cave walls, cemetery
    // fence, HH interior walls all live here) — without it the probe was blind
    // to every wall in the game. minY/maxY are absolute world Y.
    if (typeof solidWalls !== 'undefined') {
        for (const w of solidWalls) {
            if (w.maxY !== undefined && w.maxY < py - 1) continue;
            if (w.minY !== undefined && w.minY > py + 2.5) continue;
            const dx = x - w.x, dz = z - w.z, rot = w.rotation || 0;
            const c = Math.cos(-rot), sn = Math.sin(-rot);
            const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
            if (Math.abs(lx) < w.halfW + margin && Math.abs(lz) < w.halfD + margin) return true;
        }
    }
    for (const s of structures) {
        if (s.type === 'box') {
            const yb = s.y || 0, yt = yb + (s.height || 0);
            if (yt < py - 1 || yb > py + 2.5) continue;
            const dx = x - s.x, dz = z - s.z, rot = s.rotation || 0;
            const c = Math.cos(-rot), sn = Math.sin(-rot);
            const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
            if (Math.abs(lx) < s.width / 2 + margin && Math.abs(lz) < s.depth / 2 + margin) return true;
        } else if (s.type === 'sphere') {
            const cyb = (s.centerY || 0) - (s.radiusY || 0), cyt = (s.centerY || 0) + (s.radiusY || 0);
            if (cyt < py - 1 || cyb > py + 2.5) continue;
            const dx = (x - s.x) / ((s.radiusX || 1) + margin), dz = (z - s.z) / ((s.radiusZ || 1) + margin);
            if (dx * dx + dz * dz < 1) return true;
        } else if (s.type === 'cylinder') {
            const yb = s.y || 0, yt = yb + (s.height || 0);
            if (yt < py - 1 || yb > py + 2.5) continue;
            const r = (s.radius || s.radiusX || 1) + margin;
            if ((x - s.x) ** 2 + (z - s.z) ** 2 < r * r) return true;
        }
    }
    return false;
}

// Cave entry — systematic side-by-side sweep. Rank one candidate bearing per
// 30° sector (structure-free at the target's height first, then closest
// outside-ground level), then try the sides ONE AT A TIME in sequence: walk to
// a clean point outside that side, thrust straight in, and verify arrival at
// the target's LEVEL (roof walk-ons show dxz≈2 but dy≈+7). Failed side → back
// out, next side. No more flailing at the same two walls.
function rankCaveBearings(tx, tz, ty) {
    const scored = [];
    for (let k = 0; k < 32; k++) {
        const a = k * Math.PI / 16;
        let clear = true;
        for (let r = 4; r <= 18; r += 2) {
            if (blockedXZ(tx + Math.sin(a) * r, tz + Math.cos(a) * r, 0.7, ty)) { clear = false; break; }
        }
        const gY = getGroundHeight(tx + Math.sin(a) * 20, tz + Math.cos(a) * 20);
        scored.push({ a, score: (clear ? 0 : 1000) + Math.abs(gY - ty) });
    }
    const sectors = new Map();
    for (const s of scored) {
        const sec = Math.floor(s.a / (Math.PI / 6));
        if (!sectors.has(sec) || sectors.get(sec).score > s.score) sectors.set(sec, s);
    }
    return [...sectors.values()].sort((p, q) => p.score - q.score).map(s => s.a);
}

// Cave entry v3. Discovery: cave walls are `solidWall` colliders — INVISIBLE
// to the `structures` probes used before (they never saw a cave wall at all).
// A cave is a true RECTANGLE: two thin side walls + one back wall, with the
// entire fourth side open. So, deterministically: find the cave's three walls
// in the global solidWalls registry and the entrance is directly OPPOSITE the
// back wall — walk to the axis point outside the mouth and go straight in.
function caveMouthDir(tx, tz, ty) {
    if (typeof solidWalls === 'undefined') return null;
    const near = solidWalls.filter(w =>
        w.isEnclosed &&
        Math.hypot(w.x - tx, w.z - tz) < 25 &&
        (w.minY === undefined || w.minY < ty + 6) &&
        (w.maxY === undefined || w.maxY > ty));
    if (near.length < 3) return null;
    let back = null;                                    // back wall = widest span
    for (const w of near) if (!back || Math.max(w.halfW, w.halfD) > Math.max(back.halfW, back.halfD)) back = w;
    const sides = near.filter(w => w !== back);
    if (!sides.length) return null;
    const mx = sides.reduce((s, w) => s + w.x, 0) / sides.length;
    const mz = sides.reduce((s, w) => s + w.z, 0) / sides.length;
    let dx = mx - back.x, dz = mz - back.z;             // back → side-midpoint = toward the mouth
    const L = Math.hypot(dx, dz) || 1;
    return { a: Math.atan2(dx / L, dz / L), bx: back.x, bz: back.z };
}

async function enterCaveTo(tx, tz, ty, arrive = 2.6) {
    // 1) DETERMINISTIC: exact mouth from the cave's real wall rectangle.
    const m = caveMouthDir(tx, tz, ty);
    if (m) {
        for (let attempt = 0; attempt < 2; attempt++) {
            BOT.detail = 'cave: exact mouth entry';
            const sx = m.bx + Math.sin(m.a) * 23, sz = m.bz + Math.cos(m.a) * 23;
            await go(sx, sz, { arrive: 2.5, timeout: attempt ? 30000 : 60000 }).catch(() => {});
            await go(tx, tz, { arrive, run: false, noDetour: true, timeout: 9000 }).catch(() => {});
            if (Math.hypot(player.position.x - tx, player.position.z - tz) <= arrive + 0.8 &&
                Math.abs(player.position.y - ty) < 3.5) {
                BOT._caveEntry = { tx, tz, a: m.a };
                BOT.detail = 'entered via exact mouth';
                return;
            }
        }
    }
    // 2) FALLBACK: the user-designed FOUR-wall rectangle probe — caves are
    // four-sided, so walls sit at 90° increments, and moving to the next wall
    // is a rectangle around the corner with PERFECT RIGHT ANGLES at each turn:
    // OUT (away from the failed wall) → CORNER → across to the next wall's
    // outside point → stage → IN.
    const first = rankCaveBearings(tx, tz, ty)[0] ?? 0;
    const R_IN = 22, R_OUT = 34;
    for (let lap = 0; lap < 2; lap++) {
        for (let k = 0; k < 4; k++) {
            const n = lap * 4 + k;
            const a = first + k * Math.PI / 2;
            const sxx = tx + Math.sin(a) * R_IN, szz = tz + Math.cos(a) * R_IN;
            if (n === 0) {
                await go(sxx, szz, { arrive: 2.5, timeout: 60000 }).catch(() => {});
            } else {
                const ap = a - Math.PI / 2;                  // the wall that just failed
                const Ax = Math.sin(ap), Az = Math.cos(ap);
                const Bx = Math.sin(a), Bz = Math.cos(a);
                await go(tx + Ax * R_OUT, tz + Az * R_OUT, { arrive: 3, run: false, noDetour: true, timeout: 14000 }).catch(() => {});
                await go(tx + Ax * R_OUT + Bx * R_OUT, tz + Az * R_OUT + Bz * R_OUT, { arrive: 3, run: false, noDetour: true, timeout: 14000 }).catch(() => {});
                await go(tx + Bx * R_OUT, tz + Bz * R_OUT, { arrive: 3, run: false, noDetour: true, timeout: 14000 }).catch(() => {});
                await go(sxx, szz, { arrive: 2.5, run: false, noDetour: true, timeout: 10000 }).catch(() => {});
            }
            await go(tx, tz, { arrive, run: false, noDetour: true, timeout: 6500 }).catch(() => {});
            if (Math.hypot(player.position.x - tx, player.position.z - tz) <= arrive + 0.8 &&
                Math.abs(player.position.y - ty) < 3.5) {
                BOT._caveEntry = { tx, tz, a };
                BOT.detail = 'entered via wall ' + (n + 1);
                return;
            }
            BOT.detail = 'cave walls tried: ' + (n + 1);
        }
    }
    throw new Error('cave entry failed on all sides');
}

// Leave a cave the way we came in: stand at the centre, then straight-line out
// through the recorded mouth bearing and keep going a little past the wall
// line. Trivial by design — we already PROVED this line is clear on entry.
async function exitCave() {
    const e = BOT._caveEntry;
    if (!e) return;
    for (let i = 0; i < 3; i++) {
        BOT.detail = 'cave-exit';
        await go(e.tx, e.tz, { arrive: 2.6, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
        await go(e.tx + Math.sin(e.a) * 30, e.tz + Math.cos(e.a) * 30, { arrive: 3, run: false, noDetour: true, timeout: 15000 }).catch(() => {});
        if (Math.hypot(player.position.x - e.tx, player.position.z - e.tz) > 22) break;   // verified outside
    }
    BOT._caveEntry = null;
    BOT.detail = '';
}

// HH local<->world.
function hhL2W(lx, lz) { const h = hauntedHouseData; return localToWorldXZ(h.worldX, h.worldZ, lx, lz, h.rotation); }
function hhW2L(wx, wz) {
    // Inverse of the game's localToWorldXZ — verified by round-trip at runtime
    // (a sign-flipped inverse silently mirrors the interior route).
    const h = hauntedHouseData;
    const dx = wx - h.worldX, dz = wz - h.worldZ;
    const c = Math.cos(h.rotation), s = Math.sin(h.rotation);
    const cands = [
        { lx: dx * c + dz * s, lz: -dx * s + dz * c },
        { lx: dx * c - dz * s, lz: dx * s + dz * c },
    ];
    for (const cand of cands) {
        const p = hhL2W(cand.lx, cand.lz);
        if (Math.hypot(p.x - wx, p.z - wz) < 0.5) return cand;
    }
    return cands[0];
}

// ── Input ownership ─────────────────────────────────────────────────────────
const GUARD = { engaged: false, prevHand: null, sign: 1, lx: 0, lz: 0, stt: 0 };
function warArmed() { return (typeof demonApocalypse !== 'undefined' && demonApocalypse) || (typeof roundMode !== 'undefined' && roundMode); }
function inputOwner() {
    if (warArmed()) return 'war';
    if (GUARD.engaged) return 'guard';
    return 'motor';
}

// ── MOTOR: the task executor ────────────────────────────────────────────────
const MOTOR = { task: { type: 'idle' }, stuck: { t: 0, x: 0, z: 0, side: 1, detourUntil: 0, detourHeading: 0 } };
BOT.motor = MOTOR;
MOTOR.set = t => {
    clearMove();
    const s = MOTOR.stuck;
    s.detourUntil = 0; s.bestDist = undefined; s.detourCount = 0; s.t = performance.now();
    s.escapeUntil = 0; s.macroCount = 0; s.bestDistAt = performance.now();
    MOTOR.task = t;
    BOT.note = t.type + (t.sel ? ' ' + t.sel : '');
};
MOTOR.stop = () => { MOTOR.task = { type: 'idle' }; clearMove(); };

// Boxed-in escape: trapped INSIDE a structure (cave dome/house) during a trek,
// every bypass waypoint lands in another wall. Detect being surrounded, then
// commit to the bearing with the LONGEST structure-free run (the mouth) and
// walk it until back on open ground — reverse of the cave-entry protocol.
function boxedInEscapeHeading(px, pz, py) {
    let blocked = 0, best = null, bestClear = -1;
    for (let k = 0; k < 32; k++) {
        const a = k * Math.PI / 16;
        if (blockedXZ(px + Math.sin(a) * 6, pz + Math.cos(a) * 6, 1.2, py)) { blocked++; continue; }
        let clear = 0;
        for (let r = 4; r <= 60; r += 4) {
            if (blockedXZ(px + Math.sin(a) * r, pz + Math.cos(a) * r, 1.2, py)) break;
            clear = r;
        }
        if (clear > bestClear) { bestClear = clear; best = a; }
    }
    // "Boxed in" only if a majority of near bearings are walls (else it's just a
    // wall we're standing next to on open ground — normal detour handles that).
    return (blocked >= 18 && best !== null) ? best : null;
}

function gotoTick(t) {
    const px = player.position.x, pz = player.position.z;
    const dx = t.x - px, dz = t.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist <= (t.arrive ?? 2)) { clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'arrived'; return; }
    const s = MOTOR.stuck, now = performance.now();
    if (s.bestDist === undefined || dist < s.bestDist - 3) { s.bestDist = dist; s.detourCount = 0; s.bestDistAt = now; s.macroCount = s.macroCount || 0; }
    // Committed boxed-in escape (runs before target logic): once triggered, drive
    // the mouth bearing until we're clear of the surrounding structure.
    if (s.escapeUntil && now < s.escapeUntil) {
        if (boxedInEscapeHeading(px, pz, player.position.y) === null) { s.escapeUntil = 0; s.boxedSince = 0; }  // out
        else {
            cameraYaw = s.escapeHeading; cameraPitch = 0.12; moveForward = true; isRunning = t.run !== false && !t.walk;
            if (now - (s.escStuckT || 0) > 500 && isGrounded) { jump(); s.escStuckT = now; }
            // Give up on a trap the escape can't crack: fail the goto so the
            // phase throws → the FSM world-resets and replays (deterministic
            // convergence beats flailing in one cave for the trek's 7-min timeout).
            if (!s.boxedSince) s.boxedSince = now;
            if (now - s.boxedSince > 50000) {
                clearMove(); MOTOR.task = { type: 'idle' }; MOTOR.gotoTrapped = true;
                BOT.note = 'boxed-in — giving up (world reset)'; return;
            }
            BOT.note = 'boxed-in escape ' + Math.round((now - s.boxedSince) / 1000) + 's';
            return;
        }
    } else if (!t.noDetour && (now - (s.bestDistAt || now) > 12000)) {
        // No NET progress toward the target for 12s (jittering in a wall pocket
        // still resets the no-movement timer, so gate on net progress instead).
        const eh = boxedInEscapeHeading(px, pz, player.position.y);
        if (eh !== null) {
            s.escapeHeading = eh; s.escapeUntil = now + 6000; s.escStuckT = now;
            if (!s.boxedSince) s.boxedSince = now;
            s.bestDist = undefined; s.bestDistAt = now; t.waypoint = null;
            cameraYaw = eh; cameraPitch = 0.12; moveForward = true; isRunning = true;
            BOT.note = 'boxed-in escape (mouth ' + Math.round(eh * 180 / Math.PI) + '°)';
            return;
        }
    }
    // Macro-detour: no NET progress for 45s means a map-scale barrier (mountain
    // range, lake) that ±80-unit bypasses can't round — swing wide through an
    // intermediate waypoint hundreds of units perpendicular, escalating.
    if (!t.noDetour && now - (s.bestDistAt || now) > 45000 && dist > 120) {
        s.macroCount = (s.macroCount || 0) + 1;
        const side = (s.macroCount % 2 === 0) ? 1 : -1;
        const R = Math.min(900, 250 + 200 * s.macroCount);
        const ang = Math.atan2(t.x - px, t.z - pz) + side * 1.35;
        t.waypoint = { x: px + Math.sin(ang) * R, z: pz + Math.cos(ang) * R };
        s.bestDist = undefined; s.bestDistAt = now; s.detourCount = 0; s.detourUntil = 0;
        BOT.note = 'macro-detour#' + s.macroCount;
    }
    let heading;
    if (t.waypoint) {
        const wdx = t.waypoint.x - px, wdz = t.waypoint.z - pz;
        if (Math.hypot(wdx, wdz) < 5) { t.waypoint = null; s.t = now; heading = Math.atan2(dx, dz); }
        else heading = Math.atan2(wdx, wdz);
    } else heading = Math.atan2(dx, dz);
    const moved = Math.hypot(px - s.x, pz - s.z);
    if (moved > 1.2) { s.x = px; s.z = pz; s.t = now; }
    if (t.noDetour) {
        // Sequential cave-entry thrusts: the SEQUENCE is the detour strategy —
        // just hop when stuck and let the attempt time out cleanly.
        if (now - s.t > 800 && isGrounded) jump();
    } else if (s.detourUntil && now < s.detourUntil) {
        heading = s.detourHeading;
    } else {
        const stuckFor = now - s.t;
        if (stuckFor > 800 && isGrounded) jump();
        if (stuckFor > 2200) {
            s.detourCount = (s.detourCount || 0) + 1;
            if (s.detourCount >= 2 && dist < 60) {
                const ang = Math.atan2(px - t.x, pz - t.z) + 1.257 * s.detourCount;
                const R = Math.max(dist, 22);
                t.waypoint = { x: t.x + Math.sin(ang) * R, z: t.z + Math.cos(ang) * R };
                BOT.note = 'ring#' + s.detourCount;
            } else if (s.detourCount >= 2) {
                const side = (s.detourCount % 2 === 0) ? 1 : -1;
                const ang = Math.atan2(dx, dz) + side * 1.9;
                const R = 30 + Math.min(50, 12 * s.detourCount);
                t.waypoint = { x: px + Math.sin(ang) * R, z: pz + Math.cos(ang) * R };
                BOT.note = 'bypass#' + s.detourCount;
            } else {
                s.detourHeading = heading + s.side * 1.7;
                s.detourUntil = now + 1600;
                s.side *= -1;
            }
            s.t = now;
        }
    }
    // Proactive avoidance: steer around structures BEFORE hitting them.
    // Skipped for noDetour thrusts (cave-wall tests walk into structures on
    // purpose) and near the target (the structure is often the destination —
    // campfires, chests, altar tips). Reactive unstick remains the fallback.
    // Avoidance is for TRAVEL, not the final approach — when the destination
    // IS a structure (altar center, campfire, chest) the last stretch must head
    // straight in, so only avoid while well beyond the arrival radius.
    const running = t.run !== false && !t.walk;
    if (!t.noDetour && dist > (t.arrive ?? 2) + 10) {
        const py = player.position.y;
        const look = Math.min(running ? 16 : 10, dist - 2);
        const clear = h => !blockedXZ(px + Math.sin(h) * look, pz + Math.cos(h) * look, 1.4, py)
                        && !blockedXZ(px + Math.sin(h) * look * 0.5, pz + Math.cos(h) * look * 0.5, 1.4, py);
        if (!clear(heading)) {
            if (!s.avoidCommit || s.avoidCommit <= 0) {
                let picked = null;
                for (let k = 1; k <= 9; k++) {
                    const off = k * 0.22;
                    if (clear(heading + off)) { picked = 1; break; }
                    if (clear(heading - off)) { picked = -1; break; }
                }
                s.avoidSide = picked ?? (s.avoidSide || 1);
                s.avoidCommit = 6;
            }
            let found = false, h2 = heading;
            for (let k = 1; k <= 12; k++) {
                h2 = heading + s.avoidSide * k * 0.22;
                if (clear(h2)) { found = true; break; }
            }
            // Nothing clear in the whole scan → charge straight (dense clusters
            // like the altar pillars would otherwise make us orbit forever);
            // the reactive unstick ladder handles any genuine collision.
            if (found) { heading = h2; s.avoidCommit--; }
            else s.avoidCommit = 0;
        } else if (s.avoidCommit) s.avoidCommit = 0;
    }
    cameraYaw = heading; cameraPitch = 0.12;
    moveForward = true;
    isRunning = running;
}

function navTick(t) {
    if (!t.ns) t.ns = { sign: 1, commit: 0, lx: 0, lz: 0, stt: performance.now() };
    const ns = t.ns;
    const px = player.position.x, pz = player.position.z, py = player.position.y;
    const dx = t.x - px, dz = t.z - pz, dist = Math.hypot(dx, dz);
    if (dist <= (t.arrive ?? 2)) { clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'nav arrived'; return; }
    const bearing = Math.atan2(dx, dz);
    const margin = 1.6;
    const look = Math.min(7, Math.max(3.5, dist));
    const clear = h => !blockedXZ(px + Math.sin(h) * look, pz + Math.cos(h) * look, margin, py)
                    && !blockedXZ(px + Math.sin(h) * look * 0.5, pz + Math.cos(h) * look * 0.5, margin, py);
    let heading = bearing;
    if (!clear(bearing)) {
        if (ns.commit <= 0) {
            let picked = null;
            for (let k = 1; k <= 10; k++) {
                const off = k * 0.28;
                if (clear(bearing + off)) { picked = 1; break; }
                if (clear(bearing - off)) { picked = -1; break; }
            }
            ns.sign = picked ?? ns.sign;
            ns.commit = 8;
        }
        let found = false, h = bearing;
        for (let k = 1; k <= 14; k++) {
            h = bearing + ns.sign * k * 0.28;
            if (clear(h)) { found = true; break; }
        }
        heading = found ? h : bearing + ns.sign * 1.4;
        ns.commit--;
    } else ns.commit = 0;
    cameraYaw = heading; cameraPitch = 0.12;
    moveForward = true; moveBackward = moveLeft = moveRight = false;
    isRunning = t.run !== false && !t.walk;
    const moved = Math.hypot(px - ns.lx, pz - ns.lz);
    if (moved > 0.8) { ns.lx = px; ns.lz = pz; ns.stt = performance.now(); }
    else if (performance.now() - ns.stt > 600) {
        if (isGrounded) jump();
        if (performance.now() - ns.stt > 1400) { ns.sign *= -1; ns.commit = 10; ns.stt = performance.now(); }
    }
}

function flyTick(t) {
    if (!mountedOnDragon) { clearMove(); MOTOR.task = { type: 'idle' }; MOTOR.flyFailed = true; BOT.note = 'fly abort: not mounted'; return; }
    const dx = t.x - dragon.position.x, dz = t.z - dragon.position.z;
    const dh = Math.hypot(dx, dz), dy = t.y - dragon.position.y;
    if (dh < (t.arrive ?? 6) && Math.abs(dy) < 5) { clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'arrived(air)'; return; }
    cameraYaw = Math.atan2(dx, dz); cameraPitch = 0;
    // Fly-high doctrine: long hops cruise at near-ceiling altitude (325 clears
    // every mountain and crater rim in the world), then descend at the target.
    // Low-altitude cross-country flying orbits inside crater bowls forever.
    if (dh > 250 && dragon.position.y < 295) {
        moveForward = moveBackward = moveLeft = moveRight = false;
        spaceHeld = true; isRunning = false;
        BOT.note = 'fly: climbing to cruise (' + dragon.position.y.toFixed(0) + ')';
        return;
    }
    // Altitude-first near the target: pure vertical while far off the target
    // height, THEN translate (forward+up together stalls against walls).
    const bigDy = Math.abs(dy) > 10;
    moveForward = dh >= (t.arrive ?? 6) && !(bigDy && dh < 60);
    spaceHeld = dy > 4;
    isRunning = dy < -4 && dh < 200;           // don't dive while still far out
    if (dh > 200) { spaceHeld = spaceHeld || dragon.position.y < 295; isRunning = false; }
    // stuck watchdog: wedged against terrain/walls → CLIMB over it (the #1
    // cause is a hill above cruise altitude; sideways nudges alone oscillate)
    if (!t._fs) t._fs = { x: dragon.position.x, y: dragon.position.y, z: dragon.position.z, t: performance.now() };
    const fs = t._fs;
    if (Math.hypot(dragon.position.x - fs.x, dragon.position.z - fs.z) + Math.abs(dragon.position.y - fs.y) > 3) {
        fs.x = dragon.position.x; fs.y = dragon.position.y; fs.z = dragon.position.z; fs.t = performance.now();
    } else if (performance.now() - fs.t > 1500) {
        spaceHeld = true; isRunning = false;               // climb over the obstacle
        moveForward = true;
        moveRight = (Math.floor(performance.now() / 700) % 2 === 0); moveLeft = !moveRight;
    }
    // en-route terrain clearance: if the ground ahead rises to within 12 of us,
    // climb preemptively (cheap ground probe half a second ahead)
    if (moveForward && !spaceHeld) {
        const aheadX = dragon.position.x + Math.sin(cameraYaw) * 45;
        const aheadZ = dragon.position.z + Math.cos(cameraYaw) * 45;
        if (getGroundHeight(aheadX, aheadZ) > dragon.position.y - 12) spaceHeld = true;
    }
}

function combatTick(t) {
    if (t.hand) equip(t.hand);
    const target = resolve(t.sel);
    if (!target) {
        if (t.thenIdle !== false) { clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'no target (' + t.sel + ')'; }
        return;
    }
    const err = aimAt(target);
    const dist = Math.hypot(target.x - player.position.x, target.z - player.position.z);
    const minR = t.minR ?? 4, maxR = t.maxR ?? 6;
    moveForward = dist > maxR;
    moveBackward = dist < minR;
    isRunning = dist > maxR + 6;
    // Unstick: pursuit has no detour ladder, so hop when we are trying to
    // advance but have not actually moved (rocks, fences, terrain lips).
    if (moveForward) {
        const now = performance.now();
        if (!t.cs) t.cs = { x: player.position.x, z: player.position.z, t: now };
        if (Math.hypot(player.position.x - t.cs.x, player.position.z - t.cs.z) > 0.5) {
            t.cs.x = player.position.x; t.cs.z = player.position.z; t.cs.t = now;
        } else if (now - t.cs.t > 1000 && isGrounded) { jump(); t.cs.t = now; }
    }
    if (t.weapon === 'ak') ak47TriggerHeld = err < 0.10 && dist < 250;
    else if (t.weapon === 'melee') {
        // Angular tolerance must SCALE WITH DISTANCE: a body ~1.6 wide subtends
        // ~33° at 2.5 units but only ~5° at 20. A fixed 0.12 rad gate meant
        // that up close — exactly where we can actually hit — the fast-moving
        // required pitch kept the bot standing there NOT swinging, which is
        // the "walks up, then just stares at it" behaviour.
        if (err < meleeAngTol(dist, t.halfWidth) && dist < (t.punchAt ?? maxR + 2.5)) maybePunch(t.cadence ?? 320);
    }
    else if (t.weapon === 'beam') { if (err < 0.10) maybePunch(t.cadence ?? 420); }
}

function aimholdTick(t) {
    if (t.hand) equip(t.hand);
    const target = resolve(t.sel);
    if (!target) { BOT.note = 'aimhold: no target'; return; }
    const err = aimAt(target);
    const dist = target.distanceTo(player.position);
    if (t.punch && err < (t.errMax ?? 0.10) && dist < (t.maxDist ?? 9)) {
        if (maybePunch(t.cadence ?? 340) && t.count !== undefined) {
            t.count--;
            if (t.count <= 0) { MOTOR.task = { type: 'idle' }; BOT.note = 'aimhold done'; }
        }
    }
}

function sweepTick(t) {
    if (t.hand) equip(t.hand);
    const target = resolve(t.sel);
    if (target) cameraYaw = Math.atan2(target.x - player.position.x, target.z - player.position.z);
    const now = performance.now();
    if (!t.t0) t.t0 = now;
    const ph = ((now - t.t0) / 1000) * (t.rate ?? 1.2);
    const lo = t.pitchMin ?? -0.2, hi = t.pitchMax ?? 1.2;
    cameraPitch = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(ph));
    if (!target || target.distanceTo(player.position) < (t.punchMax ?? 8.5)) maybePunch(t.cadence ?? 300);
}

function diveTick(t) {
    if (typeof boostActive !== 'undefined' && boostActive) press('KeyB'); // dive tuned at run speed 40
    const dx = t.cx - player.position.x, dz = t.cz - player.position.z;
    const r = Math.hypot(dx, dz);
    cameraYaw = Math.atan2(dx, dz); cameraPitch = 0.3;
    if (t.phase === 'sprint') {
        moveForward = true; isRunning = true;
        if (!t.jumped && r < 64) { jump(); t.jumped = true; }
        if (r < (t.cutAt ?? 11)) { clearMove(); t.phase = 'fall'; BOT.note = 'dive: falling'; }
    } else if (t.phase === 'fall') {
        moveForward = r > 4 && !isGrounded;
        isRunning = false;
        if (isGrounded || player.position.y <= t.platformY + 1.5) {
            clearMove(); MOTOR.task = { type: 'idle' };
            MOTOR.diveResult = { r, y: player.position.y };
            BOT.note = 'dive landed r=' + r.toFixed(1);
        }
    }
}

// Dragon bond farm — hover low over NPCs and snipe the nearest with the beam
// (empirically the best beam mode: hover-and-aim beat strafing 2:1 in kill
// rate; the beam is a thin camera ray, so precise per-target aim + high cadence
// wins). Relocates toward the nearest NPC when none are in easy reach.
function dragonhoverTick(t) {
    if (!mountedOnDragon) { clearMove(); MOTOR.task = { type: 'idle' }; MOTOR.strafeFailed = true; return; }
    if (dragonBondFormed) { clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'bond formed'; return; }
    moveForward = moveBackward = moveLeft = moveRight = false;
    const gy = surfaceH(dragon.position.x, dragon.position.z);
    const dyy = (gy + 9) - dragon.position.y;
    spaceHeld = dyy > 3;
    isRunning = dyy < -3;
    // Targets: ground NPCs AND night creatures (user) — the beam one-shots
    // creatures too and they count toward the bond exactly like NPCs (see
    // dragonBeamAttack). Birds are skipped: they jink at altitude and the
    // ground field is denser. Aim points match each kind's hit profile.
    // TERRAIN BLOCKS THE BEAM: dragonBeamAttack raycasts solids first and caps
    // the kill ray at that hit, so a target behind a ridge is unhittable. Rank
    // candidates by line of sight — otherwise the bot locks onto a villager
    // over the hill, flies into the hillside, and fires into rock forever.
    let np = null, nd = Infinity, npAny = null, ndAny = Infinity;
    const consider = (p, aimY, d) => {
        if (d < ndAny) { ndAny = d; npAny = { x: p.x, y: aimY, z: p.z }; }
        if (d < nd && beamClear(p.x, aimY, p.z)) { nd = d; np = { x: p.x, y: aimY, z: p.z }; }
    };
    for (const n of npcs) {
        if (n.type === 'bird') continue;
        const p = n.mesh.position;
        consider(p, p.y + 1.0, Math.hypot(p.x - dragon.position.x, p.z - dragon.position.z));
    }
    if (typeof nightCreatures !== 'undefined') {
        for (const c of nightCreatures) {
            if (c.emergeTimer > 0) continue;
            const p = c.mesh.position;
            consider(p, p.y + (c.gunHitCenterY || 1.4), Math.hypot(p.x - dragon.position.x, p.z - dragon.position.z));
        }
    }
    if (!np && npAny) {
        // Everything is behind terrain — CLIMB (altitude buys line of sight)
        // and close on the nearest, but hold fire: shooting into a mountain
        // achieves nothing.
        spaceHeld = true; isRunning = false;
        cameraYaw = Math.atan2(npAny.x - dragon.position.x, npAny.z - dragon.position.z);
        cameraPitch = 0.1;
        moveForward = true;                                  // climb AND close
        BOT.note = 'no line of sight — climbing (nd=' + ndAny.toFixed(0) + ')';
        return;
    }
    if (!np) { BOT.note = 'hover: no targets'; return; }
    if (nd > 28) {
        // CHASE: fly straight at the prey (altitude-first near-ground handling),
        // then snipe once close. A stationary snipe at 100+ units hits nothing.
        const ty2 = surfaceH(np.x, np.z) + 9;
        const dyy2 = ty2 - dragon.position.y;
        // cameraPitch does NOT steer the dragon (flight uses yaw + space/run),
        // so we can hold a firing solution while closing — the chase becomes a
        // strafing run instead of a stream of blind pot-shots.
        if (!dragonAimSolve(np.x, np.y, np.z)) {
            cameraYaw = Math.atan2(np.x - dragon.position.x, np.z - dragon.position.z);
            cameraPitch = 0.1;
        }
        const nowC = performance.now();
        if (!t.ch) t.ch = { x: dragon.position.x, z: dragon.position.z, t: nowC, detourUntil: 0, side: 1 };
        const ch = t.ch;
        // Wedged? First climb, and if that does not free us within 4s, break
        // the lock by flying OFF-AXIS for a couple of seconds — some peaks are
        // taller than the flight ceiling, so "up" alone can never clear them.
        if (Math.hypot(dragon.position.x - ch.x, dragon.position.z - ch.z) > 2) {
            ch.x = dragon.position.x; ch.z = dragon.position.z; ch.t = nowC;
        }
        const stuckFor = nowC - ch.t;
        if (stuckFor > 4000 && !ch.detourUntil) { ch.detourUntil = nowC + 2500; ch.side *= -1; }
        if (ch.detourUntil && nowC > ch.detourUntil) { ch.detourUntil = 0; ch.t = nowC; }
        // Look-ahead climb (flyTick's doctrine, missing here): flying at the
        // TARGET's altitude says nothing about the ridge in between — that is
        // how the dragon ended up nose-first in a mountain.
        const ahX = dragon.position.x + Math.sin(cameraYaw) * 45;
        const ahZ = dragon.position.z + Math.cos(cameraYaw) * 45;
        const mustClimb = surfaceH(ahX, ahZ) > dragon.position.y - 12 || stuckFor > 1500;
        if (ch.detourUntil) cameraYaw += ch.side * 1.1;      // swing wide around the obstacle
        // ALWAYS advance. The old gate (|Δaltitude| < 16) froze the dragon in
        // place whenever it sat high above its prey — combined with a forced
        // climb that produced a hovering statue firing into a mountainside.
        moveForward = true;
        spaceHeld = mustClimb || dyy2 > 3;
        isRunning = !mustClimb && dyy2 < -3;
        // Re-check line of sight at the moment of firing: never spend beams on
        // rock even if the target looked clear when it was picked.
        if (aimErrorTo(np.x, np.y, np.z) < 0.12 && beamClear(np.x, np.y, np.z)) maybePunch(280);
        BOT.note = 'bond chase nd=' + nd.toFixed(0) + ' k=' + dragonBondKills +
                   (ch.detourUntil ? ' [detour]' : mustClimb ? ' [climb]' : '');
        return;
    }
    // Exact one-step solve (see dragonAimSolve); fall back to the feedback loop
    // only when the target is essentially straight overhead and has no solution.
    if (!dragonAimSolve(np.x, np.y, np.z)) {
        cameraYaw = Math.atan2(np.x - dragon.position.x, np.z - dragon.position.z);
        aimAt(new V3(np.x, np.y, np.z));
    }
    // Fire on the TRUE measured error (the camera updated last frame from the
    // previous solve), never on the solver's own optimism.
    const aerr = aimErrorTo(np.x, np.y, np.z);
    // Fire when on target; failsafe shot every 1.5s so a pathological aim can
    // never stall the farm completely.
    const nowP = performance.now();
    if ((aerr < 0.15 || nowP - (MOTOR._lastBeam || 0) > 1500) && beamClear(np.x, np.y, np.z)) {
        if (maybePunch(200)) MOTOR._lastBeam = nowP;
    }
    BOT.note = 'bond ' + dragonBondKills + '/' + (typeof DRAGON_BOND_KILLS_REQUIRED !== 'undefined' ? DRAGON_BOND_KILLS_REQUIRED : 100) +
               ' nd=' + nd.toFixed(0) + ' err=' + (aerr * 180 / Math.PI).toFixed(1) + '°';
}

// HH stair climb — mechanical ramp walk (user-designed). The old per-step
// targeting caused the up-down dithering: after passing a step its centre was
// BEHIND the player, so the yaw flipped 180° and it walked back down. Now:
// face a fixed point PAST the top of the axis the whole way, hold forward,
// never steer at steps. Done = above the top step AND past it along the axis
// (cleared the last step). A fall fails fast for a restart.
// NO JUMPING: every step is a structureBox, and structure boxes do not block
// horizontal movement at all (resolvePlayerWallOverlaps only consults
// solidWalls) — walking into a step snaps the player onto its top. Hopping up
// stairs was pure cosmetic noise.
function climbTick(t) {
    if (!t.cs) {
        const s0 = t.steps[0], sN = t.steps[t.steps.length - 1];
        const ax = sN.x - s0.x, az = sN.z - s0.z, al = Math.hypot(ax, az) || 1;
        t.cs = { stuckT: 0, lx: 0, lz: 0, maxY: -999, a0: s0, aN: sN, topY: sN.yTop,
                 ux: ax / al, uz: az / al, len: al };
    }
    const cs = t.cs;
    const px = player.position.x, pz = player.position.z, py = player.position.y;
    if (py > cs.maxY) cs.maxY = py;
    // Fell off the staircase → fail FAST so the phase repositions and retries
    // instead of flailing at ground level for the rest of the timeout.
    if (cs.maxY - py > 2.5 && cs.maxY > t.steps[0].yTop + 1) {
        clearMove(); MOTOR.task = { type: 'idle' }; MOTOR.climbTimedOut = true; BOT.note = 'climb fell y=' + py.toFixed(1); return;
    }
    const along = (px - cs.a0.x) * cs.ux + (pz - cs.a0.z) * cs.uz;
    if (py >= cs.topY - 0.4 && along >= cs.len + 2) {   // cleared the last step
        clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'climb done y=' + py.toFixed(1); return;
    }
    // Face straight up the axis at a fixed far point — forward the whole way.
    const fx = cs.aN.x + cs.ux * 8, fz = cs.aN.z + cs.uz * 8;
    cameraYaw = Math.atan2(fx - px, fz - pz);
    cameraPitch = -0.15;
    moveForward = true; moveBackward = moveLeft = moveRight = false; isRunning = false;
    const now = performance.now();
    // Walk, don't hop. Only if genuinely wedged (no movement for 1.2s — a real
    // obstacle, not a step) fall back to a jump.
    if (Math.hypot(px - cs.lx, pz - cs.lz) > 0.4) { cs.lx = px; cs.lz = pz; cs.stuckT = now; }
    else if (isGrounded && now - (cs.stuckT || now) > 1200) { jump(); cs.stuckT = now; }
    BOT.note = 'climb y=' + py.toFixed(1) + ' along=' + along.toFixed(1) + '/' + cs.len.toFixed(0);
    if (now - (t.startedAt || (t.startedAt = now)) > (t.timeout ?? 45000)) {
        clearMove(); MOTOR.task = { type: 'idle' }; MOTOR.climbTimedOut = true; BOT.note = 'climb timeout y=' + py.toFixed(1);
    }
}

// Cemetery zombie circle-kite: orbit the cemetery center at radius 15 firing
// the AK (penetrates 3, ignores walls); zombies (speed 6) never catch us (40).
function cemkiteTick(t) {
    if (!t.ks) t.ks = { sign: 1, lx: player.position.x, lz: player.position.z, stt: performance.now() };
    const ks = t.ks;
    equip('ak47');
    const cx = cemeteryData.worldX, cz = cemeteryData.worldZ;
    const px = player.position.x, pz = player.position.z;
    if (cemeteryData.gatesLocked === false) {
        clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'cemetery cleared'; return;
    }
    const zs = nightCreatures.filter(c => c.isCemZombie && c.emergeTimer <= 0);
    moveForward = moveBackward = moveLeft = moveRight = false;
    ak47TriggerHeld = false; isRunning = true;
    const now = performance.now();
    if (zs.length === 0) {
        const rho0 = Math.hypot(px - cx, pz - cz) || 1;
        cameraYaw = Math.atan2(-(pz - cz) / rho0 * ks.sign, (px - cx) / rho0 * ks.sign);
        cameraPitch = 0.1; moveForward = true;
        BOT.note = 'kite: waiting for zombies';
        return;
    }
    let z = null, bd = Infinity;
    for (const c of zs) {
        const d = (c.mesh.position.x - px) ** 2 + (c.mesh.position.z - pz) ** 2;
        if (d < bd) { bd = d; z = c; }
    }
    const zx = z.mesh.position.x, zz = z.mesh.position.z;
    const nearDist = Math.sqrt(bd);
    const F = Math.atan2(zx - px, zz - pz);
    const lpz = leadTarget(z, zx, zz);
    aimAt(new V3(lpz.x, z.mesh.position.y + (z.gunHitCenterY || 1.4), lpz.z));
    ak47TriggerHeld = nearDist < 160;
    const rho = Math.hypot(px - cx, pz - cz) || 1;
    let Dx = -(pz - cz) / rho * ks.sign, Dz = (px - cx) / rho * ks.sign;
    const radErr = rho - 15;
    Dx += (cx - px) / rho * (radErr * 0.05);
    Dz += (cz - pz) / rho * (radErr * 0.05);
    if (nearDist < 9) { Dx = (px - zx) / nearDist * 1.5; Dz = (pz - zz) / nearDist * 1.5; }
    const dl = Math.hypot(Dx, Dz) || 1; Dx /= dl; Dz /= dl;
    const fwd = Dx * Math.sin(F) + Dz * Math.cos(F);
    const rgt = -Dx * Math.cos(F) + Dz * Math.sin(F);
    moveForward = fwd > 0.25; moveBackward = fwd < -0.25;
    moveRight = rgt > 0.25; moveLeft = rgt < -0.25;
    const moved = Math.hypot(px - ks.lx, pz - ks.lz);
    if (moved > 1.0) { ks.lx = px; ks.lz = pz; ks.stt = now; }
    else if (now - ks.stt > 700) { ks.sign *= -1; ks.stt = now; jump(); }
    BOT.note = 'kite z=' + zs.length + ' nd=' + nearDist.toFixed(0) + ' hp=' + playerHealth.toFixed(0);
}

// HH angel gauntlet — freeze-funnel. Angels freeze inside the camera's ~110°
// horizontal FOV wedge UNLESS within 10u (they advance even while watched).
// Anchor at the south wall; the 10u lock releases watched angels one at a time
// nearest-first into the 7.5→2.0 sword kill window. Frozen at 9.5-16u? Walk to
// it (it can't move) until the lock releases it. All >16u? Pulse a look-away.
function angelsTick(t) {
    if (!t.as) {
        const a = hhL2W(-3.5, 21.5), c = hhL2W(-3.5, -10);
        t.as = { anchor: a, crowd: c, lastPunch: 0 };
    }
    const as = t.as;
    if (hhSeqPhase === 'flashbang' || hhSeqPhase === 'complete') {
        clearMove(); MOTOR.task = { type: 'idle' }; BOT.note = 'angels done aura=' + swordAuraActive; return;
    }
    equip('sword-shield');
    moveForward = moveBackward = moveLeft = moveRight = false; isRunning = false;
    const px = player.position.x, pz = player.position.z;
    const live = hhAngels.filter(a => a.mesh);
    let na = null, nd = Infinity, cx = 0, cz = 0;
    for (const a of live) {
        const d = Math.hypot(a.mesh.position.x - px, a.mesh.position.z - pz);
        cx += a.mesh.position.x; cz += a.mesh.position.z;
        if (d < nd) { nd = d; na = a; }
    }
    if (live.length) { cx /= live.length; cz /= live.length; } else { cx = as.crowd.x; cz = as.crowd.z; }
    const distAnchor = Math.hypot(as.anchor.x - px, as.anchor.z - pz);
    const now = performance.now();
    if (na && nd < 16) {
        const tp = na.mesh.position;
        const err = aimAt(new V3(tp.x, tp.y + 1.6, tp.z));
        if (nd > 9.5) moveForward = true;                 // frozen — close in
        if (err < 0.14 && nd < 7.4 && now - as.lastPunch > 240) { as.lastPunch = now; punch(); }
        BOT.note = 'angels engage nd=' + nd.toFixed(1) + ' n=' + live.length + ' hp=' + playerHealth.toFixed(0);
        return;
    }
    if (distAnchor > 2) {
        cameraYaw = Math.atan2(as.anchor.x - px, as.anchor.z - pz);
        cameraPitch = 0.1; moveForward = true;
        BOT.note = 'angels to-anchor n=' + live.length;
        return;
    }
    if (!live.length) {
        aimAt(new V3(as.crowd.x, player.position.y + 1, as.crowd.z));
        BOT.note = 'angels waiting phase=' + hhSeqPhase;
        return;
    }
    const cycle = now % 1350;
    if (cycle < 350) { cameraYaw = Math.atan2(px - cx, pz - cz); cameraPitch = 0; BOT.note = 'angels lure(away) n=' + live.length; }
    else { aimAt(new V3(cx, player.position.y + 1.5, cz)); BOT.note = 'angels lure(watch) n=' + live.length + ' nd=' + nd.toFixed(0); }
}

ivl(() => {
    try {
        if (typeof gameStarted === 'undefined' || !gameStarted) return;
        if (inputOwner() !== 'motor') return;
        if (playerDead) { clearMove(); return; }
        if (typeof shadowManCutscene !== 'undefined' && shadowManCutscene) { clearMove(); return; }
        const t = MOTOR.task;
        if (t.type === 'goto') gotoTick(t);
        else if (t.type === 'nav') navTick(t);
        else if (t.type === 'goto3d') flyTick(t);
        else if (t.type === 'combat') combatTick(t);
        else if (t.type === 'aimhold') aimholdTick(t);
        else if (t.type === 'sweep') sweepTick(t);
        else if (t.type === 'dive') diveTick(t);
        else if (t.type === 'climb') climbTick(t);
        else if (t.type === 'dragonhover') dragonhoverTick(t);
        else if (t.type === 'cemkite') cemkiteTick(t);
        else if (t.type === 'angels') angelsTick(t);
    } catch (e) { BOT.note = 'MOTOR ERR: ' + e.message; }
}, 60);

// ── REACT: creature guard ───────────────────────────────────────────────────
// Night creatures roam post-cemetery (30dmg/0.9s, up to speed 23). Outdoors:
// orbit-kite at ~26u with the AK. Inside the HH: stationary face-and-fire.
const _gd = new V3(), _gw = new V3();
ivl(() => {
    try {
        if (typeof gameStarted === 'undefined' || !gameStarted || playerDead) return;
        if (typeof shadowManCutscene !== 'undefined' && shadowManCutscene) return;
        // Never fight on foot while mounted — the guard's movement flags would
        // hijack the dragon's flight controls.
        if (typeof mountedOnDragon !== 'undefined' && mountedOnDragon) { GUARD.engaged = false; return; }
        // Never fight in/around the volcano crater: creatures cannot reach you
        // there (100% safe), and orbit-kiting on the gem platform once threw the
        // bot straight off the edge into the lava. Radius covers rim → platform.
        if (typeof dragonVolcano !== 'undefined' && dragonVolcano &&
            Math.hypot(player.position.x - dragonVolcano.x, player.position.z - dragonVolcano.z) < 60) {
            GUARD.engaged = false; return;
        }
        if (warArmed() || BOT.guardSuspended) { GUARD.engaged = false; return; }
        const indoor = typeof hhSeqPhase !== 'undefined' && !(hhSeqPhase === 'none' || hhSeqPhase === 'complete');
        const px = player.position.x, pz = player.position.z;
        let nd = Infinity, nc = null;
        for (const c of nightCreatures) {
            if (c.emergeTimer > 0 || c.isCemZombie) continue;
            const d = Math.hypot(c.mesh.position.x - px, c.mesh.position.z - pz);
            if (d < nd) { nd = d; nc = c; }
        }
        const engageR = indoor ? 200 : 95;
        if (nc && nd < engageR) {
            if (!GUARD.engaged) {
                GUARD.engaged = true;
                GUARD.prevHand = currentHandItem;
                GUARD.lx = px; GUARD.lz = pz; GUARD.stt = performance.now();
            }
            // No AK yet (early game, or a demo/save without it)? Do NOT stand
            // there holding a trigger for a gun we do not own — that is a free
            // kill for the creature. Fall back to the best melee weapon and
            // fight it hand to hand.
            const haveAK = typeof handSlots !== 'undefined' && handSlots.includes('ak47');
            if (haveAK) equip('ak47');
            else equip(handSlots.includes('sword-shield') ? 'sword-shield' : 'fist');
            moveForward = moveBackward = moveLeft = moveRight = false;
            const cxp = nc.mesh.position.x, czp = nc.mesh.position.z;
            const F = Math.atan2(cxp - px, czp - pz);
            const lp = leadTarget(nc, cxp, czp);
            const err0 = aimAt(new V3(lp.x, nc.mesh.position.y + (nc.gunHitCenterY || 1.4), lp.z));
            ak47TriggerHeld = haveAK && nd < 220;
            const rx = (px - cxp) / (nd || 1), rz = (pz - czp) / (nd || 1);
            if (!haveAK) {
                // Melee guard: close and swing. Distance-scaled tolerance, same
                // rule as every other melee site.
                isRunning = nd > 4;
                moveForward = nd > 3;
                if (err0 < meleeAngTol(nd) && nd < 6.5) maybePunch(240);
                BOT.note = 'guard MELEE nd=' + nd.toFixed(0) + ' hp=' + playerHealth.toFixed(0);
                return;
            }
            if (indoor) {
                isRunning = false;
                if (nd < 6) {
                    const fwd = rx * Math.sin(F) + rz * Math.cos(F);
                    moveForward = fwd > 0.2; moveBackward = fwd < -0.2;
                }
            } else {
                isRunning = true;
                let Dx = -rz * GUARD.sign, Dz = rx * GUARD.sign;
                const radErr = 26 - nd;
                Dx += rx * radErr * 0.06; Dz += rz * radErr * 0.06;
                if (nd < 10) { Dx = rx * 1.5; Dz = rz * 1.5; }
                const dl = Math.hypot(Dx, Dz) || 1; Dx /= dl; Dz /= dl;
                const fwd = Dx * Math.sin(F) + Dz * Math.cos(F);
                const rgt = -Dx * Math.cos(F) + Dz * Math.sin(F);
                moveForward = fwd > 0.25; moveBackward = fwd < -0.25;
                moveRight = rgt > 0.25; moveLeft = rgt < -0.25;
                const moved = Math.hypot(px - GUARD.lx, pz - GUARD.lz);
                if (moved > 1.0) { GUARD.lx = px; GUARD.lz = pz; GUARD.stt = performance.now(); }
                else if (performance.now() - GUARD.stt > 700) { GUARD.sign *= -1; GUARD.stt = performance.now(); jump(); }
            }
            BOT.note = 'guard nd=' + nd.toFixed(0) + ' hp=' + playerHealth.toFixed(0);
        } else if (GUARD.engaged && (!nc || nd > (indoor ? 250 : 130))) {
            GUARD.engaged = false;
            ak47TriggerHeld = false;
            moveForward = moveBackward = moveLeft = moveRight = false;
            if (GUARD.prevHand && handSlots.includes(GUARD.prevHand)) equip(GUARD.prevHand);
            BOT.note = 'guard clear';
        }
    } catch (e) { BOT.note = 'GUARD ERR: ' + e.message; }
}, 60);   // 60ms: shorter aim staleness — pairs with the hitscan lead above

// ── REACT: war fighter (apocalypse + hell rounds) — circuit gunner ──────────
// Never stop moving (run 40 vs demon max 24; teleports can't land within 40u).
// Circuit through campfires (regen 25/s near + 10s ×0.5 damage linger). Aim the
// AK at the nearest demon in ANY direction; movement decomposed camera-relative.
// Potential-field repulsion avoids running into clusters. hp<50 → campfire lap.
// Death: ONE latched click — fight-again in apocalypse (+50 demons per click —
// re-click inflation once took the horde from 150 to 1600), LEAVE HELL in rounds.
const WAR = { wp: 0, deadAt: 0, clicked: false, lx: 0, lz: 0, stt: 0, circuit: null, avoidSide: 1, escapeUntil: 0, escapeHeading: 0 };
const _ww1 = new V3();
ivl(() => {
    try {
        if (typeof gameStarted === 'undefined' || !gameStarted) return;
        if (!warArmed()) { WAR.circuit = null; return; }
        const now = performance.now();
        if (playerDead) {
            ak47TriggerHeld = false;
            if (!WAR.deadAt) WAR.deadAt = now;
            if (roundMode) {
                // Leaving hell: LEAVE HELL (exitRoundMode) is idempotent, so
                // RETRY every ~1.2s until roundMode actually clears — a single
                // click can be dropped under a heavy round's frame stall, which
                // once left the bot stuck dead forever. Suspend the guard now.
                BOT.guardSuspended = true;
                if (now - (WAR.lastLeaveClick || 0) > 1200) {
                    const btn = document.getElementById('hard-reset-btn');
                    if (btn) { btn.click(); WAR.lastLeaveClick = now; }
                }
            } else if (!WAR.clicked && now - WAR.deadAt > 1800) {
                // Apocalypse respawn: exactly ONE click (each fight-again adds
                // +50 demons — re-clicking spirals the horde).
                const btn = document.getElementById('fight-again-btn');
                if (btn) { btn.click(); WAR.clicked = true; }
            }
            return;
        }
        if (WAR.clicked) {
            // Just respawned: sprint clear for 4s before fighting — dying again
            // within seconds is the +50-per-death spiral that reaches 1800 demons.
            WAR.escapeUntil = now + 4000;
            let bestH = 0, bestScore = -1e9;
            const px0 = player.position.x, pz0 = player.position.z;
            for (let k = 0; k < 16; k++) {
                const a = k * Math.PI / 8;
                let score = 0;
                for (const d of demons) {
                    const ddx = d.mesh.position.x - px0, ddz = d.mesh.position.z - pz0;
                    const dd = Math.hypot(ddx, ddz);
                    if (dd > 120) continue;
                    const ba = Math.atan2(ddx, ddz);
                    let rel = Math.abs(ba - a); if (rel > Math.PI) rel = 2 * Math.PI - rel;
                    if (rel < 1.2) score -= (1.2 - rel) * (120 - dd);
                }
                if (score > bestScore) { bestScore = score; bestH = a; }
            }
            WAR.escapeHeading = bestH;
        }
        WAR.deadAt = 0; WAR.clicked = false;
        // Hopelessness cap: a spiraled horde (frame budget dies too) never gets
        // ground down — burn the world and replay. Deterministic convergence.
        if (demonApocalypse && demons.length > 700) {
            BOT.note = 'war spiraled (' + demons.length + ' demons) — world reset';
            try { hardReset(); } catch (e) { location.reload(); }
            return;
        }
        if (!WAR.circuit) {
            WAR.circuit = campfirePositions.slice()
                .sort((a, b) => (a.x ** 2 + a.z ** 2) - (b.x ** 2 + b.z ** 2))
                .slice(0, 3).map(p => [p.x, p.z]);
            if (!WAR.circuit.length) WAR.circuit = [[0, 0], [200, 0], [0, 200]];
            WAR.wp = 0;
        }
        const px = player.position.x, pz = player.position.z;
        let nd = Infinity, ndm = null;
        for (const d of demons) {
            const dd = Math.hypot(d.mesh.position.x - px, d.mesh.position.z - pz);
            if (dd < nd) { nd = dd; ndm = d; }
        }
        // ── Round tether management (user-designed) ─────────────────────────
        // The tethered dragon steals kills — poison for the ≤25 sword-recharge
        // farm. Untether at ≤30 demons when a recharge is coming (aura down,
        // healthy), and re-tether the moment it isn't: aura lights, the round
        // ends, or the farm bails on low hp (the dragon comes back to help).
        // If the aura is still banked from last round there is no farm — the
        // dragon just keeps fighting. 1.5s debounce so the toggle never
        // thrashes at the boundaries.
        if (roundMode && typeof dragonTethered !== 'undefined' &&
            typeof dragonBondFormed !== 'undefined' && dragonBondFormed && dragonGemCollected) {
            const rechargeLive = WAR.charging ||
                (demons.length > 0 && demons.length <= 30 &&
                 !(typeof swordAuraActive !== 'undefined' && swordAuraActive) && playerHealth > 55);
            const wantTether = !rechargeLive;
            if (dragonTethered !== wantTether && now - (WAR.tetherAt || 0) > 1500) {
                WAR.tetherAt = now;
                press('KeyT');
            }
        }
        // ── Sword-lightning opener (user-designed) ──────────────────────────
        // The 25-kill charge is farmed BEFORE the war (charge-sword phase).
        // First demon that closes to melee → draw the sword, drive straight at
        // it, and swing until the bolt lands (the AoE guts the opening crush
        // and the aura clears itself) — then straight back to the AK circuit
        // for the rest of the war. Gated on live swordAuraActive, so deaths
        // and reloads re-arm it for free while the charge lasts.
        if (WAR.swordLunge && (!(typeof swordAuraActive !== 'undefined' && swordAuraActive) || !ndm || nd > 14)) {
            WAR.swordLunge = false;                          // bolt fired / it got away
        }
        // In HELL ROUNDS the bolt is an EMERGENCY BACKUP: only spend it while
        // the horde is still big (>25). At ≤25 the recharge mode below is
        // busy earning the NEXT bolt — never waste a fresh charge on this
        // round's stragglers.
        if (typeof swordAuraActive !== 'undefined' && swordAuraActive && hasSwordShield && ndm &&
            (!roundMode || demons.length > 25) &&
            (nd < 5.5 || WAR.swordLunge)) {
            WAR.swordLunge = true;
            equip('sword-shield');
            ak47TriggerHeld = false;
            const tp = ndm.mesh.position;
            const err = aimAt(_ww1.set(tp.x, tp.y + 2.2, tp.z));
            moveForward = nd > 2.2; moveBackward = moveLeft = moveRight = false;
            isRunning = true;
            if (err < meleeAngTol(nd, 2.5) && nd < 5.2) maybePunch(180);
            BOT.note = 'war SWORD-BOLT nd=' + nd.toFixed(1) + ' hp=' + playerHealth.toFixed(0);
            return;
        }
        // ── Round-end sword recharge (user-designed) ────────────────────────
        // HELL ROUNDS only: once ≤25 demons remain, finish the round with the
        // SWORD — one-shot swipes (up to 3/swing), 25 kills relight the aura,
        // banking the emergency bolt for the NEXT round. Partial progress
        // persists in swordPostAuraKills across rounds/deaths, and the moment
        // the aura lights we snap back to the AK so the charge is preserved.
        // Melee only while healthy: enter above hp 55, bail below 45.
        if (WAR.charging && (!roundMode || !ndm || demons.length > 25 ||
            (typeof swordAuraActive !== 'undefined' && swordAuraActive) || playerHealth <= 45)) {
            WAR.charging = false;
        }
        if (roundMode && ndm && demons.length <= 25 && hasSwordShield &&
            !(typeof swordAuraActive !== 'undefined' && swordAuraActive) &&
            (WAR.charging || playerHealth > 55)) {
            WAR.charging = true;
            equip('sword-shield');
            ak47TriggerHeld = false;
            const tp = ndm.mesh.position;
            const err = aimAt(_ww1.set(tp.x, tp.y + 2.2, tp.z));
            moveForward = nd > 2.2; moveBackward = moveLeft = moveRight = false;
            isRunning = true;
            if (Math.hypot(px - WAR.lx, pz - WAR.lz) > 1.2) { WAR.lx = px; WAR.lz = pz; WAR.stt = now; }
            else if (now - WAR.stt > 900 && isGrounded) jump();
            if (err < meleeAngTol(nd, 2.5) && nd < 5.5) maybePunch(200);
            BOT.note = 'war RECHARGE ' + (typeof swordPostAuraKills !== 'undefined' ? swordPostAuraKills : '?') +
                '/25 nd=' + nd.toFixed(1) + ' D=' + demons.length + ' hp=' + playerHealth.toFixed(0);
            return;
        }
        equip('ak47');
        let cf = null, cfd = Infinity;
        for (const p of campfirePositions) {
            const dd = Math.hypot(p.x - px, p.z - pz);
            if (dd < cfd) { cfd = dd; cf = p; }
        }
        let tx, tz, mode;
        if (playerHealth < 50 && cf) { tx = cf.x; tz = cf.z; mode = 'FIRE'; }
        else {
            // Brush each fire INSIDE its 22-unit shield radius before turning —
            // switching at 22 grazes the boundary and never refreshes the linger.
            const w = WAR.circuit[WAR.wp];
            if (Math.hypot(w[0] - px, w[1] - pz) < 12) WAR.wp = (WAR.wp + 1) % WAR.circuit.length;
            tx = WAR.circuit[WAR.wp][0]; tz = WAR.circuit[WAR.wp][1]; mode = 'RUN';
        }
        let vx = tx - px, vz = tz - pz;
        { const vl0 = Math.hypot(vx, vz) || 1; vx /= vl0; vz /= vl0; }
        let rx = 0, rz = 0, nearCnt = 0;
        for (const d of demons) {
            const ddx = px - d.mesh.position.x, ddz = pz - d.mesh.position.z;
            const dd = Math.hypot(ddx, ddz);
            if (dd < 30 && dd > 0.01) { const w2 = (30 - dd) / (30 * dd); rx += ddx * w2; rz += ddz * w2; nearCnt++; }
        }
        vx += rx * 2.2; vz += rz * 2.2;
        if (nd < 12 && nearCnt > 0) { vx = rx; vz = rz; mode = 'FLEE'; }
        { const vl0 = Math.hypot(vx, vz) || 1; vx /= vl0; vz /= vl0; }
        // Steer the desired velocity around structures (houses/cave domes) —
        // wedging on one mid-war while demons close is an easy death.
        {
            const py = player.position.y;
            const hd0 = Math.atan2(vx, vz);
            const clearW = h => !blockedXZ(px + Math.sin(h) * 14, pz + Math.cos(h) * 14, 1.4, py)
                             && !blockedXZ(px + Math.sin(h) * 7, pz + Math.cos(h) * 7, 1.4, py);
            if (!clearW(hd0)) {
                let found = false, h2 = hd0;
                for (let k = 1; k <= 10; k++) {
                    h2 = hd0 + WAR.avoidSide * k * 0.25;
                    if (clearW(h2)) { found = true; break; }
                    h2 = hd0 - WAR.avoidSide * k * 0.25;
                    if (clearW(h2)) { WAR.avoidSide *= -1; found = true; break; }
                }
                if (found) { vx = Math.sin(h2); vz = Math.cos(h2); mode = mode + '/avoid'; }
            }
        }
        // Escape burst: wedged with demons closing → commit to the clearest
        // bearing (structures AND demons weighted) for a full second.
        if (WAR.escapeUntil && now < WAR.escapeUntil) {
            vx = Math.sin(WAR.escapeHeading); vz = Math.cos(WAR.escapeHeading); mode = 'BAIL';
        } else if (now - WAR.stt > 2500 && nd < 25) {
            let bestH = 0, bestScore = -1e9;
            const py = player.position.y;
            for (let k = 0; k < 16; k++) {
                const a = k * Math.PI / 8;
                let score = 0;
                if (blockedXZ(px + Math.sin(a) * 12, pz + Math.cos(a) * 12, 1.4, py)) score -= 500;
                if (blockedXZ(px + Math.sin(a) * 24, pz + Math.cos(a) * 24, 1.4, py)) score -= 200;
                for (const d of demons) {
                    const ddx = d.mesh.position.x - px, ddz = d.mesh.position.z - pz;
                    const dd = Math.hypot(ddx, ddz);
                    if (dd > 60) continue;
                    const ba = Math.atan2(ddx, ddz);
                    let rel = Math.abs(ba - a); if (rel > Math.PI) rel = 2 * Math.PI - rel;
                    if (rel < 1.2) score -= (1.2 - rel) * (60 - dd);
                }
                if (score > bestScore) { bestScore = score; bestH = a; }
            }
            WAR.escapeHeading = bestH;
            WAR.escapeUntil = now + 1200;
            WAR.stt = now;
            if (isGrounded) jump();
        }
        const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
        if (ndm && nd < 250) {
            const tp = ndm.mesh.position;
            const err = aimAt(_ww1.set(tp.x, tp.y + 3.2, tp.z));
            ak47TriggerHeld = err < 0.13;
        } else {
            cameraYaw = Math.atan2(vx, vz); cameraPitch = 0.08;
            ak47TriggerHeld = false;
        }
        const fwd = vx * Math.sin(cameraYaw) + vz * Math.cos(cameraYaw);
        const rgt = -vx * Math.cos(cameraYaw) + vz * Math.sin(cameraYaw);
        moveForward = fwd > 0.3; moveBackward = fwd < -0.3;
        moveRight = rgt > 0.3; moveLeft = rgt < -0.3;
        isRunning = true;
        if (Math.hypot(px - WAR.lx, pz - WAR.lz) > 1.2) { WAR.lx = px; WAR.lz = pz; WAR.stt = now; }
        else if (now - WAR.stt > 900) { if (isGrounded) jump(); if (now - WAR.stt > 2000) { WAR.wp = (WAR.wp + 1) % WAR.circuit.length; WAR.stt = now; } }
        BOT.note = 'war ' + mode + ' nd=' + (nd === Infinity ? '-' : nd.toFixed(0)) + ' hp=' + playerHealth.toFixed(0) + ' D=' + demons.length + (roundMode ? ' R' + currentRound : '');
    } catch (e) { BOT.note = 'WAR ERR: ' + e.message; }
}, 70);

// Input-live gate (the game's update() runs only under "pointer lock").
ivl(() => {
    if (typeof gameStarted !== 'undefined' && gameStarted && !timeMenuOpen && !playerDead) isLocked = true;
}, 400);

// ── HUD overlay ─────────────────────────────────────────────────────────────
(function makeHud() {
    let el = document.getElementById('nw-bot-hud');
    if (!el) {
        el = document.createElement('div');
        el.id = 'nw-bot-hud';
        // Banner hidden by request — remove 'display:none;' to re-enable it.
        // (It keeps updating either way; press ESC to stop the bot instead.)
        el.style.cssText = 'display:none;position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:950;' +
            'background:rgba(10,14,10,0.72);color:#9fe89f;font:12px/1.5 Menlo,monospace;' +
            'padding:6px 14px;border-radius:8px;border:1px solid rgba(120,255,120,0.25);cursor:pointer;white-space:nowrap';
        el.title = 'click to stop the bot';
        el.onclick = () => { try { window.__nwBotStop(); } catch (e) {} };
        document.body.appendChild(el);
    }
    ivl(() => {
        try {
            const hp = (typeof playerHealth !== 'undefined') ? Math.round(playerHealth) : '-';
            el.textContent = '🤖 NW-BOT  ·  ' + BOT.phase + (BOT.detail ? ' · ' + BOT.detail : '') + '  ·  hp ' + hp + '  ·  ' + BOT.note;
        } catch (e) {}
    }, 500);
})();

// ── FSM async plumbing ──────────────────────────────────────────────────────
const sleep = ms => new Promise(r => { const id = setTimeout(r, ms); BOT._to.push(id); });
async function until(fn, opts = {}) {
    const t0 = Date.now();
    for (;;) {
        if (BOT.aborted) throw new Error('aborted');
        let v = false;
        try { v = fn(); } catch (e) {}
        if (v) return v;
        if (Date.now() - t0 > (opts.timeout ?? 600000)) throw new Error('timeout:' + (opts.what || ''));
        await sleep(opts.poll ?? 250);
    }
}
async function motorRun(task, opts = {}) {
    MOTOR.gotoTrapped = false;
    MOTOR.set(task);
    await until(() => MOTOR.task.type === 'idle', { timeout: opts.timeout ?? 240000, what: task.type, poll: 300 });
    if (MOTOR.gotoTrapped) { MOTOR.gotoTrapped = false; throw new Error('goto trapped in structure'); }
}
const go = (x, z, o = {}) => motorRun({ type: 'goto', x, z, ...o }, o);
const navTo = (x, z, o = {}) => motorRun({ type: 'nav', x, z, ...o }, o);
const fly = (x, y, z, o = {}) => motorRun({ type: 'goto3d', x, y, z, ...o }, o);
async function sweepUntil(sel, cond, o = {}) {
    MOTOR.set({ type: 'sweep', sel, ...o });
    try { await until(cond, { timeout: o.timeout ?? 45000, what: 'sweep ' + sel }); }
    finally { MOTOR.stop(); }
}
async function hitOnce(sel, o = {}) {
    await motorRun({ type: 'aimhold', sel, punch: true, count: 1, ...o }, { timeout: o.timeout ?? 15000 });
}
// Steady aim-and-punch until cond — NO view oscillation. For digging, the
// target is a KNOWN fixed point below eye level: every punch thrown while a
// sweep pitches skyward is wasted (user call-out). Just stare at the dirt.
async function holdUntil(sel, cond, o = {}) {
    MOTOR.set({ type: 'aimhold', sel, punch: true, ...o });
    try { await until(cond, { timeout: o.timeout ?? 120000, what: 'hold ' + sel }); }
    finally { MOTOR.stop(); }
}
function dist2(x, z) { return Math.hypot(player.position.x - x, player.position.z - z); }


// Smooth cosmetic camera pan to a world point: shortest arc, ease-in-out, at
// ~30fps. (cameraPitch is INVERTED in this game — negative looks UP; see the
// sign handling in aimAt.) Only safe while the MOTOR is idle and the react
// layers are quiet, since both write the camera every tick.
// `faceBody` also turns the PLAYER's body to the same heading. The game only
// writes player.rotation.y while movement input is held, so a standing bot
// keeps whatever facing it last had — which left it silhouetting its own torch
// and casting the room into shadow. Turning the body puts the torchlight on
// whatever we are looking at.
async function lookSmooth(tx, ty, tz, ms = 1400, faceBody = false) {
    const y0 = cameraYaw, p0 = cameraPitch;
    const dx = tx - player.position.x, dz = tz - player.position.z;
    const horiz = Math.hypot(dx, dz) || 1;
    let dY = Math.atan2(dx, dz) - y0;
    while (dY > Math.PI) dY -= 2 * Math.PI;                  // shortest way round
    while (dY < -Math.PI) dY += 2 * Math.PI;
    const p1 = Math.max(-1.2, Math.min(1.2, -Math.atan2(ty - (player.position.y + 1.6), horiz)));
    const yaw1 = y0 + dY;
    const b0 = player.rotation.y;
    let dB = yaw1 - b0;
    while (dB > Math.PI) dB -= 2 * Math.PI;
    while (dB < -Math.PI) dB += 2 * Math.PI;
    // TIME-driven, not step-driven: a fixed count of sleep(33)s stretches to
    // several seconds whenever the machine is busy (timer granularity), so the
    // turn duration must be read from the clock and the easing sampled against
    // it. Busy machines then get fewer, larger steps — never a longer turn.
    const t0 = performance.now();
    for (;;) {
        const t = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // ease in-out
        cameraYaw = y0 + dY * e;
        cameraPitch = p0 + (p1 - p0) * e;
        if (faceBody) player.rotation.y = b0 + dB * e;
        if (t >= 1) break;
        // Step on ANIMATION FRAMES (one update per rendered frame = as smooth
        // as the display gets), with a timer race so a stalled/hidden renderer
        // can never wedge the turn.
        await Promise.race([new Promise(r => requestAnimationFrame(r)), sleep(50)]);
        if (BOT.aborted) return;
    }
    if (faceBody) player.rotation.y = yaw1;                  // exact final facing
}

// Direct pickup for the 3s-locked drops (golden key / farmer note / talisman):
// sweeping at a locked item just wastes punches while nodding up and down.
// Instead wait out the LIVE lock timer (correct even for saves restored
// mid-lock), walk within reach, look straight at the item, punch. The old
// sweep remains as the safeguard fallback if the direct punches miss.
async function pickupLocked(sel, unlocked, done, fallbackOpts) {
    await until(() => resolve(sel), { timeout: 15000, what: sel + ' spawn' }).catch(() => {});
    BOT.detail = 'waiting out ' + sel + ' lock';
    await until(unlocked, { timeout: 8000, poll: 150, what: sel + ' unlock' }).catch(() => {});
    BOT.detail = '';
    for (let i = 0; i < 6 && !done(); i++) {
        const p = resolve(sel);
        if (!p) break;
        if (dist2(p.x, p.z) > 5) await go(p.x, p.z, { arrive: 2.5, run: false, timeout: 20000 }).catch(() => {});
        await hitOnce(sel, { maxDist: 9 }).catch(() => {});
        await sleep(400);
    }
    if (!done()) await sweepUntil(sel, done, fallbackOpts);
}


// Escape a fenced enclosure (cemetery): ranked-bearing side sweep, inverted
// cave protocol — the only structure-free radial from the centre is the gate.
async function escapeEnclosure(cx, cz, escapeR) {
    const bearings = rankCaveBearings(cx, cz, player.position.y + 1);
    for (const a of bearings) {
        BOT.detail = 'enclosure-escape ' + Math.round(a * 180 / Math.PI) + '°';
        await go(cx + Math.sin(a) * 18, cz + Math.cos(a) * 18, { arrive: 2.5, run: false, noDetour: true, timeout: 14000 }).catch(() => {});
        await go(cx + Math.sin(a) * escapeR, cz + Math.cos(a) * escapeR, { arrive: 3, run: false, noDetour: true, timeout: 16000 }).catch(() => {});
        if (Math.hypot(player.position.x - cx, player.position.z - cz) >= 45) return true;
    }
    return false;
}

// Escape the cemetery if we're inside with the gates open (a caged trek start
// fights the fence forever).
async function escapeCemeteryIfInside() {
    try {
        if (!cemeteryData || cemeteryData.gatesLocked) return;
        const c = cemeteryData;
        if (dist2(c.worldX, c.worldZ) > 45) return;
        const ex = c.entranceWorldX, ez = c.entranceWorldZ;
        const vx0 = ex - c.worldX, vz0 = ez - c.worldZ, L = Math.hypot(vx0, vz0) || 1;
        const pvx = -vz0 / L, pvz = vx0 / L;
        for (let k = 0; k < 4 && dist2(c.worldX, c.worldZ) < 45; k++) {
            const off = [0, 3, -3, 5][k];
            await go(ex - vx0 / L * 6 + pvx * off, ez - vz0 / L * 6 + pvz * off, { arrive: 2, run: false, noDetour: true, timeout: 18000 }).catch(() => {});
            await go(ex + vx0 / L * 28 + pvx * off, ez + vz0 / L * 28 + pvz * off, { arrive: 2.5, run: false, noDetour: true, timeout: 18000 }).catch(() => {});
            if (dist2(c.worldX, c.worldZ) >= 45) break;
            await go(c.worldX, c.worldZ, { arrive: 15, run: false, timeout: 25000 }).catch(() => {});
        }
        if (dist2(c.worldX, c.worldZ) < 45) await escapeEnclosure(c.worldX, c.worldZ, 60);
    } catch (e) { /* best effort */ }
}

// ── Small-house navigation (exact geometry, zero search) ─────────────────────
// creatureHouseRegions[i] ↔ houseDoors[i] (registered in lockstep per house).
// The region carries the house centre, rotation, and the FIXED world doorway
// centre (doorwayX/Z). Never navigate to the door PANEL's world position: the
// panel swings ~2 units inward+sideways when open, so any axis derived from it
// is garbage on every reloaded/replayed phase (door state persists in saves —
// this was the "stuck in the little house forever" bug). And the collision
// layer rolls back ANY house-boundary crossing outside the ±2.25-wide doorway
// band (isPlayerEnclosureTransitionLegal), walls or no walls, so every
// crossing leg must ride the centre→doorway axis dead-on.
function houseRecs() {
    const out = [];
    if (typeof creatureHouseRegions === 'undefined' || typeof houseDoors === 'undefined') return out;
    for (let i = 0; i < Math.min(creatureHouseRegions.length, houseDoors.length); i++) {
        const r = creatureHouseRegions[i], d = houseDoors[i];
        const vx = r.doorwayX - r.x, vz = r.doorwayZ - r.z, L = Math.hypot(vx, vz) || 1;
        out.push({ r, d, cx: r.x, cz: r.z, dx: r.doorwayX, dz: r.doorwayZ,
                   ux: vx / L, uz: vz / L, doorY: worldPosOf(d.mesh).y });
    }
    return out;
}
function insideHouse(h, x = player.position.x, z = player.position.z) {
    const l = worldToLocalXZ(x, z, h.cx, h.cz, h.r.rotation || 0);
    return Math.abs(l.x) < h.r.halfW + 0.8 && Math.abs(l.z) < h.r.halfD + 0.8;
}
// Punches TOGGLE doors — only ever punch when actually closed, with the fist
// (a held AK would shoot instead of melee-toggling).
async function openHouseDoor(h) {
    for (let i = 0; i < 4 && !h.d.isOpen; i++) {
        equip('fist');
        await hitOnce({ x: h.dx, y: h.doorY + 0.3, z: h.dz }, { maxDist: 9 }).catch(() => {});
        await sleep(1100);                                   // swing animation
    }
    return h.d.isOpen;
}

// Enter a house the mechanical way (user doctrine): walk up to a ring around
// it, ORBIT the ring to the door side (never cut through — the walls plus the
// boundary-band rule make every shortcut illegal), stage on the door axis,
// open, then walk the axis straight in through the doorway band. Records the
// house (BOT._houseDoor) for the equally mechanical exit.
async function enterHouse(h) {
    const R = 13;    // orbit ring: walls reach ~8.2 from centre, tree-free zone is 15
    for (let att = 0; att < 3; att++) {
        BOT.detail = 'house-enter ' + att;
        if (dist2(h.cx, h.cz) > R + 8) await go(h.cx, h.cz, { arrive: R + 6, timeout: 300000 });
        const pa = Math.atan2(player.position.x - h.cx, player.position.z - h.cz);
        const da = Math.atan2(h.ux, h.uz);
        const diff = ((da - pa) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        const steps = Math.ceil(Math.abs(diff) / 0.6);
        for (let i = 1; i <= steps; i++) {
            const a = pa + diff * (i / steps);
            await go(h.cx + Math.sin(a) * R, h.cz + Math.cos(a) * R,
                     { arrive: 2.5, run: false, noDetour: true, timeout: 9000 }).catch(() => {});
        }
        BOT.guardSuspended = true;                           // no kiting in the doorway
        try {
            await go(h.dx + h.ux * 8, h.dz + h.uz * 8, { arrive: 1.6, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
            await go(h.dx + h.ux * 4, h.dz + h.uz * 4, { arrive: 1.2, run: false, noDetour: true, timeout: 9000 }).catch(() => {});
            if (!(await openHouseDoor(h))) continue;
            await go(h.cx + h.ux * 1.5, h.cz + h.uz * 1.5, { arrive: 1.2, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
            if (insideHouse(h)) { BOT._houseDoor = h; BOT.detail = ''; return; }
        } finally { BOT.guardSuspended = false; }
    }
    throw new Error('cannot enter house');
}

// Exit whatever house we're inside — mechanical, zero search (user doctrine):
// stand on the interior point of the centre→doorway axis (clear of the
// table/chest at local z=-2 and of the inward-swung door panel along local
// x=-2), open the door if anything closed it, then walk the axis straight out
// through the band. The exit endpoint (axis+10 ⇒ 14.75 from centre) ENDS
// BEYOND the >11 verification radius — the cemetery lesson.
async function exitHouse() {
    let h = BOT._houseDoor;
    if (!h || !insideHouse(h)) h = houseRecs().find(rec => insideHouse(rec));
    if (!h) { BOT._houseDoor = null; return; }               // not in a house
    BOT.guardSuspended = true;                               // walls beat kiting indoors
    try {
        for (let i = 0; i < 5; i++) {
            BOT.detail = 'house-exit ' + i;
            await go(h.cx + h.ux * 1.2, h.cz + h.uz * 1.2, { arrive: 1.1, run: false, noDetour: true, timeout: 10000 }).catch(() => {});
            if (!(await openHouseDoor(h))) continue;
            await go(h.dx + h.ux * 10, h.dz + h.uz * 10, { arrive: 2.2, run: false, noDetour: true, timeout: 10000 }).catch(() => {});
            if (!insideHouse(h) && dist2(h.cx, h.cz) > 11) { BOT._houseDoor = null; return; }
        }
        throw new Error('stuck in house — world reset');
    } finally { BOT.guardSuspended = false; BOT.detail = ''; }
}

// Phase-start recovery: a reload can restore us inside any house. The new
// exitHouse scans the regions itself and no-ops when we're not in one.
async function escapeHouseIfInside() { await exitHouse(); }

// Climb the HH entry stairs — mechanical (the climbTick doctrine): the stairs
// are a 7-wide lane of 1-high steps on local x=0 rising +5 to the entrance
// slab. Straight noDetour legs down the axis; never steer, never avoid. (The old approach aimed a normal `go` at a point INSIDE the
// 52×54 foundation structureBox — the proactive-avoidance scan saw every
// heading blocked and sidestepped along the south face forever: the infamous
// front-door pacing.)
async function hhStairEntry() {
    equip('torch');                                          // torch in hand arms the sequence trigger
    // The GUARD STAYS LIVE (user doctrine: fighting back outranks the errand).
    // Suspending it for the climb meant a night creature could kill the bot on
    // the porch while it politely kept walking. A kite may pull us off the
    // steps — the attempt loop simply climbs again.
    for (let att = 0; att < 4 && hhSeqPhase === 'none'; att++) {
        BOT.detail = 'hh-stairs ' + att;
        // ONE continuous walk from the foot of the stairs to inside the main
        // room. It used to be a ladder of six waypoints, and every leg ended
        // with MOTOR.set → clearMove(), so the bot stopped dead and
        // re-accelerated at each one — that is the half-second stutter.
        // Nothing here needs steering: the steps are structureBoxes (they snap
        // the player up rather than blocking), so a single straight noDetour
        // leg walks the whole lane smoothly.
        const foot = hhL2W(0, 48);
        if (Math.abs(hhW2L(player.position.x, player.position.z).lz) > 46) {
            await go(foot.x, foot.z, { arrive: 2.5, run: false, timeout: 25000 }).catch(() => {});
        }
        const inside = hhL2W(0, 16);
        await go(inside.x, inside.z, { arrive: 2.5, run: false, noDetour: true, timeout: 40000 }).catch(() => {});
    }
    BOT.detail = '';
    await until(() => hhSeqPhase === 'active', { timeout: 15000, what: 'hh enter' });
}

// Approach a campfire through its cave mouth (many sit in sunken cave domes).
// `target` (optional Vector3) picks a specific campfire; default = nearest.
async function approachCampfire(target) {
    const cfRaw = target || nearestOf(campfirePositions, q => q.clone());
    if (!cfRaw) throw new Error('no campfire');
    const cy = cfRaw.y ?? getGroundHeight(cfRaw.x, cfRaw.z);
    await enterCaveTo(cfRaw.x, cfRaw.z, cy, 2.6);
}

async function lightTorch() {
    // If the volcano-hint note is still out there, it lives at the BACK of one
    // of the campfire caves — light the torch at THAT cave (even when it isn't
    // the closest one) and grab the note in the same trip.
    let target = null;
    try {
        if (typeof volcanoHintNoteMesh !== 'undefined' && volcanoHintNoteMesh && !volcanoHintNotePickedUp) {
            const np = worldPosOf(volcanoHintNoteMesh);
            let bd = Infinity;
            for (const p of campfirePositions) {
                const d = Math.hypot(p.x - np.x, p.z - np.z);
                if (d < bd) { bd = d; target = p.clone(); }
            }
            if (bd > 60) target = null;    // odd worldgen: note not in a fire cave
        }
    } catch (e) { target = null; }
    await approachCampfire(target);
    equip('stick');
    await sweepUntil('campfire-near', () => hasTorch, { pitchMin: -0.3, pitchMax: 1.4, cadence: 300, punchMax: 11, hand: 'stick', timeout: 30000 });
    if (target && !volcanoHintNotePickedUp && volcanoHintNoteMesh) {
        try {
            const np = worldPosOf(volcanoHintNoteMesh);
            await go(np.x, np.z, { arrive: 3, run: false, timeout: 25000 });
            await sweepUntil('note-volcano', () => volcanoHintNotePickedUp,
                { pitchMin: 0.3, pitchMax: 1.45, cadence: 300, punchMax: 9, timeout: 30000 });
        } catch (e) { /* the volcano-note phase retries if this misses */ }
    }
    await exitCave();   // leave via the recorded mouth — no wall-flailing inside
}

async function mountDragon(bounds) {
    await until(() => dragon && dragon.visible && !dragonDescending, { timeout: 60000, what: 'dragon avail' });
    // Wait for the dragon to be near the GROUND before mounting — a prior
    // dismount can strand it high on a platform where a ground sweep can't reach
    // it (this once dead-locked the holy-gem phase). Toggling the tether pulls it
    // back down toward the player; give it time to arrive.
    for (let w = 0; w < 20 && dragon.position.y > player.position.y + 18; w++) {
        if (typeof dragonTethered !== 'undefined' && !dragonTethered) press('KeyT');
        await sleep(1000);
    }
    if (typeof dragonTethered !== 'undefined' && dragonTethered) press('KeyT');   // untether before mounting
    // The dragon parks wherever it last landed — possibly across the map.
    const dg0 = resolve('dragon');
    if (dg0 && dist2(dg0.x, dg0.z) > 60 && !bounds) await go(dg0.x, dg0.z, { arrive: 25, run: true, timeout: 300000 });
    for (let i = 0; i < 4; i++) {
        const dg = resolve('dragon');
        let tx = dg.x, tz = dg.z;
        if (bounds) {
            // Volcano platform: never chase the dragon past the rim (lava).
            const dd = Math.hypot(dg.x - bounds.cx, dg.z - bounds.cz);
            if (dd > bounds.maxR) { const sc = bounds.maxR / dd; tx = bounds.cx + (dg.x - bounds.cx) * sc; tz = bounds.cz + (dg.z - bounds.cz) * sc; }
        }
        await go(tx, tz, { arrive: 5, run: false, timeout: 60000 });
        MOTOR.set({ type: 'sweep', sel: 'dragon', pitchMin: -0.4, pitchMax: 1.4, cadence: 280, punchMax: 13 });
        try { await until(() => mountedOnDragon, { timeout: 12000, what: 'mount' }); MOTOR.stop(); return; }
        catch (e) { MOTOR.stop(); }
    }
    throw new Error('mount failed');
}

// Dismount only over flat open terrain (dismounting into cave domes glitches
// the dragon — user-reported). Probe a ring of candidate spots.
async function dismountSafe(nearX, nearZ) {
    let spot = null;
    outer:
    for (let r = 30; r <= 150; r += 30) {
        for (let k = 0; k < 12; k++) {
            const a = k * Math.PI / 6;
            const x = nearX + Math.sin(a) * r, z = nearZ + Math.cos(a) * r;
            if (blockedXZ(x, z, 3, getGroundHeight(x, z) + 1)) continue;
            // Never land in a lake — water is invisible to blockedXZ, and a
            // swimming bot is slow prey (one drop near the altar ended a world
            // at hp 47 with six creatures closing).
            if (typeof getWaterBodyAt === 'function' && getWaterBodyAt(x, z)) continue;
            const g0 = getGroundHeight(x, z);
            const g1 = getGroundHeight(x + 6, z), g2 = getGroundHeight(x, z + 6);
            if (Math.abs(g1 - g0) > 4 || Math.abs(g2 - g0) > 4) continue;
            spot = { x, z, g: g0 }; break outer;
        }
    }
    if (!spot) spot = { x: nearX, z: nearZ, g: getGroundHeight(nearX, nearZ) };
    await fly(spot.x, spot.g + 24, spot.z, { arrive: 6, timeout: 120000 });
    await fly(spot.x, spot.g + 6, spot.z, { arrive: 4, timeout: 30000 });
    press('KeyU');
    await until(() => !mountedOnDragon, { timeout: 10000, what: 'dismount' });
    await sleep(1200);
}

// Beam-farm NPCs from dragonback until the bond forms or stop() fires (e.g.
// the ritual's night window opening). Handles the volcano-parked dragon
// (resumed saves) and relocates to the densest NPC cluster when kills stall.
// Leaves the player MOUNTED — callers decide where to land.
async function bondFarm(stop = () => false) {
    const dNearVolc = dragon && dragon.visible &&
        Math.hypot(dragon.position.x - dragonVolcano.x, dragon.position.z - dragonVolcano.z) < 60;
    await mountDragon(dNearVolc ? { cx: dragonVolcano.x, cz: dragonVolcano.z, maxR: 8 } : undefined);
    if (dNearVolc) {
        for (let i = 0; i < 3 && player.position.y < 140; i++) {
            await fly(dragonVolcano.x, 160, dragonVolcano.z, { arrive: 14, timeout: 30000 }).catch(() => {});
        }
    }
    // Relocate to the world centre where NPCs are dense (flyTick's fly-high
    // doctrine handles terrain on the way).
    await fly(0, 150, 0, { arrive: 20, timeout: 90000 }).catch(() => {});
    // Hover-and-snipe over the dense world-centre field (measured best beam
    // mode). Relocate to the densest cluster whenever kills stall.
    let lastK = dragonBondKills;
    for (let i = 0; i < 30 && !dragonBondFormed && !stop(); i++) {
        MOTOR.strafeFailed = false;
        MOTOR.set({ type: 'dragonhover' });
        await until(() => dragonBondFormed || stop() || MOTOR.strafeFailed || dragonBondKills >= lastK + 15,
            { timeout: 60000, poll: 500, what: 'bond hover' }).catch(() => {});
        MOTOR.stop();
        if (MOTOR.strafeFailed) throw new Error('dismounted mid-bond');
        if (dragonBondFormed || stop()) break;
        if (dragonBondKills > lastK + 2) { lastK = dragonBondKills; continue; }
        lastK = dragonBondKills;
        // stalled — hop to the densest NPC cluster
        const cells = {};
        for (const n of npcs) { const k = Math.round(n.mesh.position.x / 100) + ',' + Math.round(n.mesh.position.z / 100); cells[k] = (cells[k] || 0) + 1; }
        let best = null, bc = 0;
        for (const k in cells) if (cells[k] > bc) { bc = cells[k]; best = k; }
        const [cx, cz] = best ? best.split(',').map(v => +v * 100) : [0, 0];
        await fly(cx, Math.max(getGroundHeight(cx, cz) + 25, dragon.position.y), cz, { arrive: 16, timeout: 45000 }).catch(() => {});
    }
}

// Farm 25 sword kills on ground NPCs to (re)light the aura. Shared by the
// charge-sword phase and by strikeCorpse (the ritual is an aura'd bolt, so
// without the aura the corpse can NEVER be struck — swinging at it forever
// was a silent deadlock).
const inWater = (x = player.position.x, z = player.position.z) =>
    typeof getWaterBodyAt === 'function' && !!getWaterBodyAt(x, z);

// Walk out of any lake we are standing in (the dig lake floor sits ~85 below
// the surface). Melee is impossible from down there and goto cannot tell.
async function leaveWater() {
    for (let r = 45; r <= 240 && inWater(); r += 45) {
        for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4;
            const x = player.position.x + Math.sin(a) * r, z = player.position.z + Math.cos(a) * r;
            if (inWater(x, z)) continue;
            BOT.detail = 'leaving the water';
            await go(x, z, { arrive: 4, run: true, timeout: 40000 }).catch(() => {});
            break;
        }
    }
    BOT.detail = '';
    return !inWater();
}

// Live pursuit of a MOVING target from wherever we stand — no stale waypoint
// anywhere in the approach. combatTick re-resolves the selector every 60ms, so
// the path CURVES to follow the target the whole way in. (Prefixing this with
// a goto to the target's last known spot is what produced the ugly "march to
// where he was, stop, turn 90°, walk again" approach.) The goto only appears
// as a RECOVERY leg — it owns the detour/unstick ladder — and only if the
// chase stops making ground against terrain.
async function pursue(sel, done, o = {}) {
    for (let i = 0; i < (o.rounds ?? 5) && !done(); i++) {
        MOTOR.set({ type: 'combat', sel, weapon: o.weapon ?? 'melee', hand: o.hand,
                    minR: 0, maxR: o.maxR ?? 4, punchAt: o.punchAt ?? 6.5,
                    cadence: o.cadence ?? 220 });
        let lx = player.position.x, lz = player.position.z, moveT = Date.now();
        try {
            await until(() => {
                if (done() || MOTOR.task.type === 'idle') return true;
                if (Math.hypot(player.position.x - lx, player.position.z - lz) > 3) {
                    lx = player.position.x; lz = player.position.z; moveT = Date.now();
                }
                return Date.now() - moveT > 5000;            // wedged, not closing
            }, { timeout: o.timeout ?? 120000, poll: 250 });
        } catch (e) { /* fall through to the recovery leg */ }
        MOTOR.stop();
        if (done()) return true;
        const p = resolve(sel);                              // unstick, then resume
        if (p) await go(p.x, p.z, { arrive: 12, timeout: 45000 }).catch(() => {});
    }
    return done();
}

async function chargeSwordAura() {
    equip('sword-shield');
    if (dist2(0, 0) > 250) await go(0, 0, { arrive: 150, timeout: 420000 });
    for (let i = 0; i < 40 && !swordAuraActive; i++) {
        if (inWater()) { await leaveWater(); continue; }     // never farm from a lake bed
        if (!SEL['npc-near']()) {                            // none in reach — reposition
            const any = nearestOf(npcs.filter(q2 => q2.type !== 'bird'), q => q.mesh.position);
            if (any) await go(any.x, any.z, { arrive: 6, run: true, timeout: 60000 }).catch(() => {});
            else await sleep(3000);                          // respawn lull
            continue;
        }
        BOT.detail = 'sword charge ' + (typeof swordPostAuraKills !== 'undefined' ? swordPostAuraKills : '?') + '/25';
        // ONE live-pursuit task instead of walk→stop→stare→walk: combat
        // re-resolves the nearest reachable NPC EVERY 60ms tick, so the
        // heading tracks the target continuously and the swing lands the
        // instant it is in reach. When one dies the selector rolls straight
        // on to the next, so the whole farm is a single uninterrupted chase.
        // (The old goto aimed at a SNAPSHOT of the NPC's position, arrived
        // where it used to be, then stood watching it walk away.)
        // maxR 4 (not 2.5): stop closing as soon as we are comfortably inside
        // the 7.5 punch reach, instead of crowding the target and dancing.
        MOTOR.set({ type: 'combat', sel: 'npc-near', weapon: 'melee', hand: 'sword-shield',
                    minR: 0, maxR: 4, punchAt: 6.5, cadence: 220 });
        await until(() => swordAuraActive || MOTOR.task.type === 'idle' || inWater(),
            { timeout: 60000, poll: 200 }).catch(() => {});
        MOTOR.stop();
    }
    BOT.detail = '';
    return !!swordAuraActive;
}

// Mechanical ritual strike (user-reported bug). GEOMETRY: the corpse lies on a
// slab 5.8 above ground, atop a THREE-STEP platform (30 / 24 / 18 wide, +1m
// per step) — from ground level it is ~15 units away horizontally, far beyond
// the 7.5 punch reach, so the bot MUST CLIMB THE STEPS. The old code walked at
// a point 4.5 from centre with normal detours enabled: it met the 1m step
// face, the unstick ladder side-stepped along it, and the bot danced in front
// of the steps until the night creatures killed it. Now: stage outside, walk
// straight in (steps are structureBoxes: walking into one snaps the player
// up, no jump needed), verify we are ON the platform, then hold a steady aim and swing — no view sweep, the
// corpse is a fixed known point (same lesson as digging).
// The GUARD IS LEFT LIVE throughout (user doctrine: fighting creatures is a
// reflex that trumps everything) — it owns inputs above the motor, so it
// interrupts the strike, clears the wave, and the loop re-climbs and retries.
async function strikeCorpse() {
    const a = altarData;
    const cx = a.worldX, cz = a.worldZ;
    const topY = a.worldGroundY + 2.5;                       // on the top step (+3)
    const onPlatform = () => player.position.y >= topY;
    // The bolt only fires at night: the instant the window shuts, stop
    // swinging and hand back to the caller (which re-waits for nightfall).
    const stillOpen = () => altarState === 'torches_lit' && _altarIsNight();
    for (let attempt = 0; attempt < 8 && stillOpen(); attempt++) {
        if (!swordAuraActive) {                              // no aura = no bolt, ever
            BOT.detail = 'no aura — recharging';
            await chargeSwordAura();
            await go(cx, cz, { arrive: 16, timeout: 300000 }).catch(() => {});
            if (!stillOpen()) break;
        }
        equip('sword-shield');
        if (!onPlatform()) {
            // Approach on a fresh bearing each attempt (the three platform
            // torches sit up top and can foul one line).
            BOT.detail = 'climbing the ritual steps ' + attempt;
            const ang = attempt * 1.1;
            const sx = cx + Math.sin(ang) * 20, sz = cz + Math.cos(ang) * 20;
            await go(sx, sz, { arrive: 3, timeout: 60000 }).catch(() => {});
            // straight in — never steer, never detour. The 1m steps are
            // structureBoxes: walking into one snaps us up, no jump needed.
            await go(cx + Math.sin(ang) * 5, cz + Math.cos(ang) * 5,
                { arrive: 2, run: false, noDetour: true, timeout: 25000 }).catch(() => {});
        }
        if (!onPlatform()) continue;                         // fell/blocked — next bearing
        BOT.detail = 'striking';
        await holdUntil('corpse', () => !stillOpen() || !onPlatform(),
            { cadence: 260, hand: 'sword-shield', errMax: 0.2, maxDist: 9, timeout: 30000 }).catch(() => {});
    }
    BOT.detail = '';
}

// ── Campaign phases ─────────────────────────────────────────────────────────
function hhEntered() { return (typeof hhSeqPhase !== 'undefined' && hhSeqPhase !== 'none') || hasSwordShield; }
function altarTipsLit() {
    return typeof altarTorchesLit !== 'undefined' &&
        (altarTorchesLit >= 3 || ['struck', 'ascending', 'complete'].includes(altarState));
}

const PHASES = [
{
    name: 'stick',
    done: () => hasStick || hasTorch,
    run: async () => {
        const t = resolve('tree-near');
        await go(t.x, t.z, { arrive: 5 });
        await motorRun({ type: 'aimhold', sel: 'tree-near', punch: true, count: 8, cadence: 340, maxDist: 9 }, { timeout: 30000 });
        await until(() => hasStick || hasTorch, { timeout: 15000, what: 'stick' });
    },
},
{
    name: 'shovel',
    done: () => hasShovel,
    run: async () => {
        const s = resolve('shovel');
        await go(s.x, s.z, { arrive: 4 });
        await sweepUntil('shovel', () => hasShovel, { pitchMin: 0, pitchMax: 1.4, cadence: 320, punchMax: 11, timeout: 30000 });
    },
},
{
    name: 'torch',
    done: () => hasTorch || (hhEntered() && altarTipsLit()),
    run: async () => {
        await escapeHouseIfInside();
        await lightTorch();
    },
},
{
    name: 'volcano-note',
    // Normally collected during the torch trip (same cave); this is the
    // safety net for resumes and odd worldgens.
    done: () => (typeof volcanoHintNotePickedUp !== 'undefined' && volcanoHintNotePickedUp) || !volcanoHintNoteMesh,
    run: async () => {
        const np = worldPosOf(volcanoHintNoteMesh);
        await go(np.x, np.z, { arrive: 30, timeout: 240000 });   // trek to the area first
        await enterCaveTo(np.x, np.z, np.y, 3);
        await sweepUntil('note-volcano', () => volcanoHintNotePickedUp,
            { pitchMin: 0.3, pitchMax: 1.45, cadence: 300, punchMax: 9, timeout: 30000 });
        await exitCave();
    },
},
{
    name: 'farmer',
    done: () => !npcs.some(n => n.isFarmer),
    run: async () => {
        equip('fist');
        // One unbroken live chase from here to the kill — the farmer walks, so
        // every step of the approach steers at where he IS.
        if (!(await pursue('farmer', () => !npcs.some(n => n.isFarmer),
                           { hand: 'fist', timeout: 180000 }))) {
            throw new Error('farmer not caught');
        }
    },
},
{
    name: 'farmer-note',
    // The farmer drops the key-hint note where he dies (3s pickup lock).
    done: () => (typeof keyHintNotePickedUp !== 'undefined' && keyHintNotePickedUp) ||
                (!npcs.some(n => n.isFarmer) && !keyHintNoteMesh),
    run: async () => {
        await until(() => keyHintNoteMesh, { timeout: 15000, what: 'note drop' });
        await pickupLocked('note-key', () => keyHintNoteLockTimer <= 0, () => keyHintNotePickedUp,
            { pitchMin: -0.3, pitchMax: 1.2, cadence: 300, punchMax: 9, timeout: 40000 });
    },
},
{
    name: 'golden-key',
    done: () => hasGoldenKey,
    run: async () => {
        equip('shovel');
        const dz = resolve('digzone');
        await go(dz.x, dz.z, { arrive: 3, timeout: 300000 });
        await holdUntil('digzone', () => hasGoldenKey || digCount >= 31,
            { cadence: 300, hand: 'shovel', errMax: 0.25, timeout: 120000 });
        if (!hasGoldenKey) {
            // The key spawns on the 31st dig with its 3s lock just started.
            await pickupLocked('key', () => goldenKeyLockTimer <= 0, () => hasGoldenKey,
                { pitchMin: 0.3, pitchMax: 1.45, cadence: 300, punchMax: 11, timeout: 45000 });
        }
    },
},
{
    name: 'ak47',
    done: () => ak47Collected,
    run: async () => {
        // The chest's house = the region whose centre is nearest the chest.
        let h = null, bd = Infinity;
        for (const rec of houseRecs()) {
            const dd = Math.hypot(rec.cx - akChest.worldX, rec.cz - akChest.worldZ);
            if (dd < bd) { bd = dd; h = rec; }
        }
        if (!h) throw new Error('no house regions');
        await enterHouse(h);                                 // orbits to the door side, records BOT._houseDoor
        // Stop SHORT of the chest (~3 units, on the axis toward the door) so
        // punches actually land — standing dead-centre on it made them miss.
        await go(akChest.worldX + h.ux * 3, akChest.worldZ + h.uz * 3, { arrive: 1.0, run: false, noDetour: true, timeout: 20000 });
        await sweepUntil('chest', () => ak47Collected, { pitchMin: 0.2, pitchMax: 1.2, cadence: 320, punchMax: 11, timeout: 45000 });
        await exitHouse();
    },
},
{
    name: 'cemetery',
    done: () => hasTalisman && cemeteryData && cemeteryData.gatesLocked === false &&
                Math.hypot(player.position.x - cemeteryData.worldX, player.position.z - cemeteryData.worldZ) > 45,
    run: async () => {
        // NOTE: the guard stays live for digs and (crucially) the EXIT — night
        // creatures spawn once the gates unlock, and an unguarded exit walk
        // once ended a world at hp 21. Only the kite suspends it (below).
        {
            const c = cemeteryData;
            if (!hasTalisman) {
                await escapeHouseIfInside();
                equip('torch');
                // Mechanical gate entry (user doctrine, mirrors the house
                // orbit): walk to a ring outside the fence, orbit parallel to
                // the walls to the gate side, then straight down the gate axis
                // through the gap. The old head-on go() aimed its avoidance
                // probes at the fence and jittered left-right at the entrance —
                // even when the gate was already facing us (here a zero-length
                // arc means we simply walk straight in).
                const erot = c.rotation;
                const cgp = (lx, lz) => localToWorldXZ(c.worldX, c.worldZ, lx, lz, erot);
                const CR = 40;                    // fence corners reach 35.4 from centre
                if (dist2(c.worldX, c.worldZ) > CR + 8) await go(c.worldX, c.worldZ, { arrive: CR + 6, timeout: 420000 });
                const pl = worldToLocalXZ(player.position.x, player.position.z, c.worldX, c.worldZ, erot);
                const pa = Math.atan2(pl.x, pl.z);            // gate sits at local angle 0 (+Z)
                const diff = ((0 - pa) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
                const steps = Math.ceil(Math.abs(diff) / 0.5);
                for (let i = 1; i <= steps; i++) {
                    const a = pa + diff * (i / steps);
                    const w = cgp(Math.sin(a) * CR, Math.cos(a) * CR);
                    await go(w.x, w.z, { arrive: 3, noDetour: true, timeout: 10000 }).catch(() => {});
                }
                for (const lz of [33, 26, 18]) {
                    const w = cgp(0, lz);
                    await go(w.x, w.z, { arrive: 2, run: false, noDetour: true, timeout: 14000 }).catch(() => {});
                }
                const g = resolve('grave');
                await go(g.x, g.z, { arrive: 4, timeout: 60000 });
                await holdUntil('grave', () => talismanGraveDigCount >= 10,
                    { cadence: 300, hand: 'shovel', errMax: 0.25, timeout: 90000 });
                await pickupLocked('talisman', () => talismanLockTimer <= 0, () => hasTalisman,
                    { pitchMin: 0.2, pitchMax: 1.45, cadence: 300, punchMax: 11, timeout: 45000 });
            }
            BOT.guardSuspended = true;   // zombies are the kite's own job
            try { await motorRun({ type: 'cemkite' }, { timeout: 180000 }); }
            finally { BOT.guardSuspended = false; }
            // Leave through the gate — user doctrine, and the map agrees: the
            // graves are gridded SKIPPING the axes (local x≈0 is a grave-free
            // walkway, and tombstones have no colliders anyway), and the gate
            // is the 7-wide gap at local (0,+25). So: walk to the CENTRE, then
            // ONE straight line down the gate axis to well past the fence — no
            // waypoint ladder to oscillate between. Endpoint 58 stays beyond
            // the 45-unit 'escaped' radius (the old verification bug).
            const rot = c.rotation;
            const gp = lz => localToWorldXZ(c.worldX, c.worldZ, 0, lz, rot);
            equip('torch');                                   // visibility at night
            const exitT0 = Date.now();
            for (let pass = 0; pass < 4 && dist2(c.worldX, c.worldZ) < 45; pass++) {
                BOT.detail = 'cem-exit pass ' + pass;
                if (Date.now() - exitT0 > 100000) break;      // → world reset below
                const c0 = gp(0);
                await go(c0.x, c0.z, { arrive: 2, run: false, timeout: 20000 }).catch(() => {});
                const out = gp(58);
                await go(out.x, out.z, { arrive: 2.5, run: false, noDetour: true, timeout: 30000 }).catch(() => {});
            }
            if (dist2(c.worldX, c.worldZ) < 45) throw new Error('caged in cemetery — world reset');
        }
    },
},
{
    name: 'haunted-house-enter',
    done: () => hhEntered(),
    run: async () => {
        await escapeHouseIfInside();
        await escapeCemeteryIfInside();
        equip('ak47');
        // Approach on OPEN ground: local (0,55) is clear of the foundation slab
        // (edge ≈27) and of the buried extra steps (they reach ≈44) — both are
        // structure boxes that used to jam the avoidance scan mid-approach.
        // Arrive tight (2.5, not 5) and ON the stair axis, so the single
        // straight walk-in below starts centred instead of angling across the
        // 7-wide stair lane.
        const app = hhL2W(0, 55);
        await go(app.x, app.z, { arrive: 2.5, timeout: 420000 });
        await hhStairEntry();
    },
},
{
    name: 'haunted-house-sword',
    done: () => hasSwordShield,
    run: async () => {
        // Route (user-taught, then proven): main room → hall doorway → hallway →
        // stairs FROM THE HALLWAY SIDE → walk-climb → deck → sword.
        const h = hauntedHouseData;
        const steps = h.stairStructures
            .map(s => ({ x: s.x, z: s.z, yTop: (s.y || 0) + (s.height || 0) }))
            .sort((a, b) => a.yTop - b.yTop);
        equip('torch');
        // Position-aware: a resumed save can start us ALREADY on floor 2 —
        // the ground-floor route legs can never XZ-arrive from up there
        // (this once burned a fail-streak while standing feet from the sword).
        if (player.position.y < 15) {
            // Fixed interior route (the HH layout is constant in local coords):
            // hall doorway → north corridor → east corridor → stair base.
            // The hallway doorway is EXACT local geometry: a 3.5-wide gap in
            // the partition centred at local (-10, -19.3); the open door panel
            // hugs its WEST edge (hinge at -11.75, swung into the main room).
            // The main room has no floor props, so any main-room point reaches
            // the doorway axis in ONE straight line — stage on the axis, then
            // cross dead-centre. (navTo at the door PIVOT — the hinge — plus
            // bracket offsets that landed in the wall was the old "can't find
            // the hallway" fumble.)
            if (hhW2L(player.position.x, player.position.z).lz > 14) {
                const mid = hhL2W(0, 10);                    // resumed on/near the threshold
                await go(mid.x, mid.z, { arrive: 2, run: false, noDetour: true, timeout: 15000 }).catch(() => {});
            }
            BOT.detail = 'leg:hall-door';
            let entered = false;
            for (let k = 0; k < 4 && !entered; k++) {
                const off = [0, 0.8, -0.8, 0][k];            // jiggle within the gap
                const sA = hhL2W(-10 + off, -13);            // stage on the axis, main-room side
                const cA = hhL2W(-10 + off, -22);            // through the gap, corridor side
                await go(sA.x, sA.z, { arrive: 1.2, run: false, noDetour: true, timeout: 15000 }).catch(() => {});
                await go(cA.x, cA.z, { arrive: 1.2, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
                entered = hhW2L(player.position.x, player.position.z).lz < -19.5;
            }
            if (!entered) throw new Error('corridor entry blocked');
            // Walk the corridor to the STAIRS' OWN local column — derived from
            // live stair coordinates, not assumed geometry.
            const s0l = hhW2L(steps[0].x, steps[0].z);
            const cLx = Math.max(-21, Math.min(21, s0l.lx));
            const c1 = hhL2W(cLx, -22);
            BOT.detail = 'leg:corridor-walk';
            // noDetour is ESSENTIAL here: the corridor is only 6 wide, so the
            // proactive-avoidance look-ahead keeps hitting its walls, decides
            // "straight is blocked" and sidesteps — which walked the bot into
            // the north wall for several seconds before it recovered and
            // turned east. The corridor IS the path; just walk its axis.
            await go(c1.x, c1.z, { arrive: 2.5, run: false, noDetour: true, timeout: 40000 });
            let climbed = false;
            for (let i = 0; i < 5; i++) {
                BOT.detail = 'leg:stair-base-' + i;
                await go(steps[0].x, steps[0].z, { arrive: 2, run: false, noDetour: true, timeout: 20000 }).catch(() => {});
                MOTOR.climbTimedOut = false;
                await motorRun({ type: 'climb', steps, timeout: 45000 }, { timeout: 60000 });
                if (!MOTOR.climbTimedOut) { climbed = true; break; }
                await go(c1.x, c1.z, { arrive: 2.5, run: false, timeout: 30000 }).catch(() => {});
            }
            if (!climbed) throw new Error('stair climb failed');
        }
        // Post-climb crossing (user-designed, mechanical): the climb already
        // overshoots the last step along the axis; now dogleg SIDEWAYS out of
        // the stairwell (toward the sword's side of the deck), then walk
        // literally straight to the sword — the stairwell is no longer in the
        // way. Falls are detected and re-climbed.
        const s0c = steps[0], sNc = steps[steps.length - 1];
        const uax = sNc.x - s0c.x, uaz = sNc.z - s0c.z, ual = Math.hypot(uax, uaz) || 1;
        const ux = uax / ual, uz = uaz / ual;
        for (let d = 0; d < 3 && !hasSwordShield; d++) {
            if (player.position.y < 15) {
                BOT.detail = 'leg:reclimb';
                await go(s0c.x - ux * 3, s0c.z - uz * 3, { arrive: 2, run: false, timeout: 30000 }).catch(() => {});
                MOTOR.climbTimedOut = false;
                await motorRun({ type: 'climb', steps, timeout: 45000 }, { timeout: 60000 });
                if (MOTOR.climbTimedOut || player.position.y < 15) continue;
            }
            BOT.detail = 'leg:dogleg';
            const swp0 = resolve('ss-sword');
            // lateral direction = component of (sword - stairTop) perpendicular
            // to the stair axis: "turn toward the sword's side" of the stairwell
            let lx = (swp0.x - sNc.x), lz = (swp0.z - sNc.z);
            const alongComp = lx * ux + lz * uz;
            lx -= alongComp * ux; lz -= alongComp * uz;
            const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
            const clearPt = { x: sNc.x + ux * 4.5 + lx * 5, z: sNc.z + uz * 4.5 + lz * 5 };
            await go(clearPt.x, clearPt.z, { arrive: 2, run: false, noDetour: true, timeout: 15000 }).catch(() => {});
            if (player.position.y < 15) continue;
            BOT.detail = 'leg:sword';
            await go(swp0.x, swp0.z, { arrive: 3, run: false, noDetour: true, timeout: 20000 }).catch(() => {});
            if (player.position.y < 15) continue;
            try {
                await sweepUntil('ss-sword', () => hasSwordShield, { pitchMin: -0.4, pitchMax: 1.0, cadence: 280, punchMax: 11, timeout: 40000 });
            } catch (e) { /* loop retries */ }
        }
        if (!hasSwordShield) throw new Error('sword not taken');
        // User ritual: exactly one second holding the sword, then carry the
        // TORCH — its light stays up through the descent until the sequence
        // snuffs it at the start of the angel waves (see the gauntlet phase).
        await sleep(1000);
        equip('torch');
    },
},
{
    name: 'haunted-house-gauntlet',
    done: () => (typeof hhSeqPhase !== 'undefined') && (hhSeqPhase === 'complete' || !hhEntered()),
    run: async () => {
        const h = hauntedHouseData;
        const steps = h.stairStructures
            .map(s => ({ x: s.x, z: s.z, yTop: (s.y || 0) + (s.height || 0) }))
            .sort((a, b) => a.yTop - b.yTop);
        if (hhSeqPhase === 'ss_taken') {
            // Descend = the ascent walked BACKWARDS (user doctrine): dogleg
            // point beside the stairwell → stairwell top on the stair axis →
            // one straight line down the axis past the bottom step. Gravity
            // handles each step edge (no fall damage). The old version aimed
            // an XZ-goto at the bottom step from the deck, which circled at
            // the stairwell lip — the descend oscillation.
            BOT.detail = 'leg:descend';
            const s0c2 = steps[0], sNc2 = steps[steps.length - 1];
            const ua2x = sNc2.x - s0c2.x, ua2z = sNc2.z - s0c2.z, ual2 = Math.hypot(ua2x, ua2z) || 1;
            const u2x = ua2x / ual2, u2z = ua2z / ual2;
            for (let d2 = 0; d2 < 4 && player.position.y > 15; d2++) {
                // lateral = from the stair axis toward where we stand (the
                // sword side) — the mirror of the ascent dogleg, recomputed
                // each retry from the live position.
                let l2x = player.position.x - sNc2.x, l2z = player.position.z - sNc2.z;
                const al2 = l2x * u2x + l2z * u2z;
                l2x -= al2 * u2x; l2z -= al2 * u2z;
                const ll2 = Math.hypot(l2x, l2z) || 1; l2x /= ll2; l2z /= ll2;
                const cp = { x: sNc2.x + u2x * 4.5 + l2x * 5, z: sNc2.z + u2z * 4.5 + l2z * 5 };
                await go(cp.x, cp.z, { arrive: 1.5, run: false, noDetour: true, timeout: 15000 }).catch(() => {});
                if (player.position.y < 15) break;
                const tp2 = { x: sNc2.x + u2x * 3, z: sNc2.z + u2z * 3 };
                await go(tp2.x, tp2.z, { arrive: 1.2, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
                const bp2 = { x: s0c2.x - u2x * 4, z: s0c2.z - u2z * 4 };
                await go(bp2.x, bp2.z, { arrive: 1.5, run: false, noDetour: true, timeout: 20000 }).catch(() => {});
            }
            if (player.position.y > 15) throw new Error('descend failed');
            BOT.detail = 'leg:north-corridor';
            // Walk WEST along the north corridor (local z=-22) in explicit steps
            // from the stairs' column to local x=0 — navTo oscillates in the
            // narrow corridor and once deadlocked a world here. The transition
            // fires at local x<8, z<-19. Verify by phase, retry a couple columns.
            const s0l = hhW2L(steps[0].x, steps[0].z);
            const startLx = Math.max(-18, Math.min(18, s0l.lx));
            for (let pass = 0; pass < 3 && hhSeqPhase === 'ss_taken'; pass++) {
                for (const lx of [startLx, 12, 6, 0, -6]) {
                    if (hhSeqPhase !== 'ss_taken') break;
                    const w = hhL2W(lx, -22);
                    await go(w.x, w.z, { arrive: 2.2, run: false, noDetour: true, timeout: 14000 }).catch(() => {});
                }
            }
            await until(() => hhSeqPhase !== 'ss_taken', { timeout: 15000, what: 'hallway_exit' });
        }
        if (hhSeqPhase === 'hallway_exit') {
            BOT.detail = 'leg:main-room';
            // Back through the hall doorway on the exact axis (gap centre local
            // x=-10) — straight noDetour legs, corridor side → main-room side.
            for (let k = 0; k < 4; k++) {
                const off = [0, 0.8, -0.8, 0][k];
                const cA = hhL2W(-10 + off, -22), sA = hhL2W(-10 + off, -13);
                await go(cA.x, cA.z, { arrive: 1.2, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
                await go(sA.x, sA.z, { arrive: 1.2, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
                if (hhW2L(player.position.x, player.position.z).lz > -18.5) break;
            }
            const mr = hhL2W(0, 5);
            await go(mr.x, mr.z, { arrive: 2.5, run: false, timeout: 40000 });
            await until(() => hhSeqPhase === 'timer' || hhSeqPhase === 'angel_waves', { timeout: 30000, what: 'timer' });
        }
        // ── The vigil (user-choreographed, purely cosmetic) ──────────────────
        // Sealed in with the torch: pause a beat, turn smoothly to regard the
        // hallway door that just shut behind us, hold it for three seconds,
        // then turn to face where the front entrance used to be and simply
        // wait for the house to snuff the flame. Three seconds later, draw the
        // sword. The game's own timer is generous here (torch out at t=10s,
        // first angel spawns at t=17.5s and only advances at t=25s).
        MOTOR.stop();
        equip('torch');
        BOT.guardSuspended = true;      // sealed house — nothing can reach us
        try {
            if (hhSeqPhase === 'timer' && !hhTorchExtinguished) {
                BOT.detail = 'vigil';
                await sleep(1000);
                const dr = hhL2W(HH_HALL_DOOR_CX, HH_HALL_Z);        // the closed hall door
                const dy = h.worldGroundY + 3.0;
                await lookSmooth(dr.x, dy, dr.z, 500, true);
                // Walk up for a CLOSE look at the door that just sealed.
                const near = hhL2W(HH_HALL_DOOR_CX, HH_HALL_Z + 4.5);
                await go(near.x, near.z, { arrive: 1.2, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
                await lookSmooth(dr.x, dy, dr.z, 300, true);         // re-settle after moving
                await sleep(2000);                                   // regard it, lit
                // Turn away, walk to the middle of the room, and look at where
                // the front entrance used to be.
                const en = hhL2W(0, HH_HALF_D), ey = h.worldGroundY + 2.75;
                await lookSmooth(en.x, ey, en.z, 500, true);
                const ctr = hhL2W(-3.5, 3);
                await go(ctr.x, ctr.z, { arrive: 1.5, run: false, noDetour: true, timeout: 15000 }).catch(() => {});
                await lookSmooth(en.x, ey, en.z, 300, true);
                BOT.detail = '';
            }
            await until(() => typeof hhTorchExtinguished !== 'undefined' && hhTorchExtinguished,
                { timeout: 90000, what: 'flame out' }).catch(() => {});
            await sleep(3000);                               // a beat in the dark
            equip('sword-shield');
            await motorRun({ type: 'angels' }, { timeout: 420000 });
        } finally { BOT.guardSuspended = false; BOT.detail = ''; }
        equip('fist');
        // Walk out mechanically: straight down the entrance-stair axis to open
        // ground past the buried steps (gravity handles the descent).
        const ei = hhL2W(0, 21), em = hhL2W(0, 30), eo = hhL2W(0, 46);
        await go(ei.x, ei.z, { arrive: 2, run: false, timeout: 30000 });
        await go(em.x, em.z, { arrive: 2, run: false, noDetour: true, timeout: 20000 }).catch(() => {});
        await go(eo.x, eo.z, { arrive: 3, run: false, noDetour: true, timeout: 20000 });
    },
},
{
    name: 'relight-torch',
    done: () => hasTorch || altarTipsLit(),
    run: async () => { await lightTorch(); },
},
{
    name: 'altar-torches',
    done: () => altarTipsLit(),
    run: async () => {
        // Trek to the altar with the guard live (creatures en route), then
        // suspend it while lighting — at night it otherwise thrashes the bot
        // off the tips indefinitely (kill AK creatures first if any are close).
        await go(altarData.worldX, altarData.worldZ, { arrive: 12, timeout: 420000 });
        // Suspend the guard for the whole lighting op — at night it otherwise
        // thrashes the bot off the tips forever (creatures respawn every 10s, so
        // "wait until clear" never clears). Full HP easily absorbs a stray hit
        // across the ~15s it takes to light three tips; regen tops us back up
        // between tips. Bail out to let the guard act only if HP gets low.
        BOT.guardSuspended = true;
        try {
            for (let i = 0; i < 3; i++) {
                if (altarData.torches[i].lit) continue;
                for (let attempt = 0; attempt < 5 && !altarData.torches[i].lit; attempt++) {
                    // Fighting back is a reflex that outranks the errand (user
                    // doctrine): hand inputs back to the guard early and give
                    // it long enough to actually clear the wave.
                    if (playerHealth < 75) {
                        BOT.guardSuspended = false;
                        await until(() => playerHealth > 90 || !nightCreatures.some(cc => !cc.isCemZombie &&
                            cc.emergeTimer <= 0 && Math.hypot(cc.mesh.position.x - player.position.x,
                                cc.mesh.position.z - player.position.z) < 70),
                            { timeout: 45000, poll: 1000, what: 'guard clear' }).catch(() => {});
                        BOT.guardSuspended = true;
                    }
                    const tip = altarData.torchWorldTips[i];
                    await go(tip.x, tip.z, { arrive: 3.5, run: false, timeout: 60000 });
                    if (Math.hypot(tip.x - player.position.x, tip.z - player.position.z) > 6) continue;
                    try {
                        await sweepUntil('altarTorch-' + i, () => altarData.torches[i].lit,
                            { pitchMin: 0, pitchMax: 1.3, cadence: 280, punchMax: 10, hand: 'torch', timeout: 30000 });
                    } catch (e) { /* retry */ }
                }
            }
        } finally { BOT.guardSuspended = false; }
        if (!altarTipsLit()) throw new Error('altar tips incomplete');
    },
},
{
    // If the torches finish lighting and it is ALREADY night, strike NOW —
    // before the volcano trip (user): leaving to fetch the dragon first can
    // burn the window and cost a whole in-game day waiting for the next one.
    // Purely opportunistic: skipped unless every precondition is already in
    // hand (torches lit, window open, aura charged), and it gives up the
    // moment the window closes so the main corpse-strike phase takes over.
    name: 'corpse-strike-early',
    done: () => {
        try {
            return !(typeof altarState !== 'undefined' && altarState === 'torches_lit' &&
                     typeof _altarIsNight === 'function' && _altarIsNight() &&
                     hasSwordShield && typeof swordAuraActive !== 'undefined' && swordAuraActive);
        } catch (e) { return true; }
    },
    run: async () => {
        await go(altarData.worldX, altarData.worldZ, { arrive: 16, timeout: 300000 }).catch(() => {});
        await strikeCorpse();
    },
},
{
    name: 'volcano-gem',
    done: () => dragonGemCollected,
    run: async () => {
        equip('ak47');
        await go(dragonVolcano.x, dragonVolcano.z, { arrive: 68, timeout: 420000 });
        MOTOR.diveResult = null;
        await motorRun({ type: 'dive', phase: 'sprint', cx: dragonVolcano.x, cz: dragonVolcano.z, platformY: dragonVolcano.platformTopY, cutAt: 11 }, { timeout: 40000 });
        const res = MOTOR.diveResult;
        if (!res || res.r > 12 || res.y > dragonVolcano.platformTopY + 8) {
            // missed onto the outer slope — climb back and retry (lava death would
            // world-reset and the campaign restarts itself)
            throw new Error('dive missed r=' + (res ? res.r.toFixed(1) : '?'));
        }
        const g = resolve('gem-dragon');
        if (g) await go(g.x, g.z, { arrive: 1.2, run: false, timeout: 30000 });
        await until(() => dragonGemCollected, { timeout: 20000, what: 'dragon gem' });
    },
},
{
    name: 'corpse-strike',
    // The strike window is 7:54 PM → midnight ONLY: after midnight the cycle
    // fraction wraps below NIGHT_START and _altarIsNight() is false even though
    // the HUD still says "Night" (cost 15 minutes of futile sweeping once).
    done: () => typeof altarState !== 'undefined' && altarState === 'complete',
    run: async () => {
        // Already struck (e.g. the early night strike did it) — just wait out
        // the ascension instead of flying all the way back for nothing.
        if (altarState !== 'torches_lit') {
            await until(() => altarState === 'complete', { timeout: 120000, what: 'ascension' });
            return;
        }
        // Runs right after volcano-gem: mount the dragon and FLY back to the
        // altar (dismounting at a flat spot NEARBY, never on the ritual) so the
        // long return trip happens while daylight burns down toward the strike
        // window. On-foot go() below remains the fallback for resumed saves.
        if (dragonGemCollected && typeof dragon !== 'undefined' && dragon && dragon.visible &&
            dist2(altarData.worldX, altarData.worldZ) > 120) {
            try {
                const nearVolc = Math.hypot(player.position.x - dragonVolcano.x, player.position.z - dragonVolcano.z) < 80;
                await mountDragon(nearVolc ? { cx: dragonVolcano.x, cz: dragonVolcano.z, maxR: 8 } : undefined);
                if (nearVolc) {
                    for (let i = 0; i < 3 && player.position.y < 140; i++) {
                        await fly(dragonVolcano.x, 160, dragonVolcano.z, { arrive: 14, timeout: 30000 }).catch(() => {});
                    }
                }
                await dismountSafe(altarData.worldX, altarData.worldZ);
            } catch (e) { /* fall back to walking */ }
        }
        await go(altarData.worldX, altarData.worldZ, { arrive: 12, timeout: 420000 });
        for (let attempt = 0; attempt < 6 && altarState === 'torches_lit'; attempt++) {
            if (!_altarIsNight() && !dragonBondFormed &&
                typeof dragon !== 'undefined' && dragon && dragon.visible) {
                // Daylight to burn (user-designed): spend the wait on dragon-
                // bond beam kills. The farm polls the clock — the moment the
                // strike window opens it breaks off, lands beside the altar,
                // and the ritual proceeds; unfinished bonding resumes in the
                // dragon-bond phase right after. Already-night arrivals skip
                // straight to the strike (bond happens entirely after).
                BOT.detail = 'bonding while waiting for night';
                try { await bondFarm(() => _altarIsNight()); } catch (e) { /* best effort */ }
                if (mountedOnDragon) { try { await dismountSafe(altarData.worldX, altarData.worldZ); } catch (e) {} }
                await go(altarData.worldX, altarData.worldZ, { arrive: 12, timeout: 300000 }).catch(() => {});
            }
            BOT.detail = 'waiting for the night window';
            await until(() => _altarIsNight(), { timeout: 420000, poll: 2000, what: 'night window' });
            // The guard stays LIVE for the whole strike (user doctrine) — it
            // interrupts, kills the wave, and strikeCorpse re-climbs.
            await strikeCorpse();
        }
        await until(() => altarState === 'complete', { timeout: 60000, what: 'ascension' });
    },
},
{
    // Bond mop-up (user-designed order): most bonding happens during the
    // corpse-strike's daylight wait (bondFarm with the night-window stop);
    // whatever remains finishes here. Bond BEFORE the war so the dragon can
    // be TETHERED into the apocalypse.
    name: 'dragon-bond',
    done: () => dragonBondFormed,
    run: async () => {
        await bondFarm();
        if (!dragonBondFormed) throw new Error('bond not formed');
    },
},
{
    // Recharge the sword lightning BEFORE the war (user-designed): the corpse
    // strike just SPENT the aura (that ritual is an aura'd bolt), so farm 25
    // sword kills on NPCs to light it again — the WAR tick's sword opener then
    // spends the bolt on the first demon that closes to melee. Skipped when
    // already charged, mid-war, or once the war is over (all state-derived).
    name: 'charge-sword',
    done: () => (typeof swordAuraActive !== 'undefined' && swordAuraActive) ||
                (typeof demonApocalypse !== 'undefined' && demonApocalypse) ||
                (typeof shadowManPostApocalypseUnlocked !== 'undefined' && shadowManPostApocalypseUnlocked),
    run: async () => {
        if (mountedOnDragon) await dismountSafe(0, 0);        // dragon-bond ends mounted
        // NPCs cluster near the world centre and never flee: walk to the
        // nearest, one swipe (hits up to 3), repeat until the aura lights.
        if (!(await chargeSwordAura())) throw new Error('sword charge incomplete');
    },
},
{
    name: 'shadow-man',
    done: () => (typeof shadowManPhase3Ready !== 'undefined' && shadowManPhase3Ready) ||
                (typeof shadowManPostApocalypseUnlocked !== 'undefined' && shadowManPostApocalypseUnlocked),
    run: async () => {
        if (mountedOnDragon) await dismountSafe(0, 0);
        // Tether the dragon now (user-designed): tethered, it survives the
        // apocalypse transition (demons.js skips the poof) and auto-snipes
        // demons within 30 for the entire war. Bond + gem are guaranteed here.
        if (typeof dragonTethered !== 'undefined' && !dragonTethered &&
            dragonBondFormed && dragonGemCollected) press('KeyT');
        equip('ak47');
        if (dist2(0, 0) > 150) await go(0, 0, { arrive: 100, timeout: 420000 });
        for (let i = 0; i < 40 && !shadowManPhase3Ready; i++) {
            if (shadowMan && !shadowMan.finalPhase) {
                // Despawn distance is 100-200: simply getting near counts the
                // spawn. goto (with the full unstick ladder) — combat mode has
                // no unstick and wedges on terrain en route.
                const sp = shadowMan.mesh.position;
                try { await go(sp.x, sp.z, { arrive: 80, timeout: 90000 }); } catch (e) {}
                MOTOR.stop();
            }
            await sleep(5000);
        }
    },
},
{
    name: 'apocalypse',
    done: () => typeof shadowManPostApocalypseUnlocked !== 'undefined' && shadowManPostApocalypseUnlocked,
    run: async () => {
        if (mountedOnDragon) await dismountSafe(0, 0);
        // Re-assert the tether right before the war (idempotent; a reload
        // could have restored an untethered dragon).
        if (typeof dragonTethered !== 'undefined' && !dragonTethered &&
            dragonBondFormed && dragonGemCollected) press('KeyT');
        if (!demonApocalypse) {
            equip('ak47');
            if (dist2(0, 0) > 90) await go(0, 0, { arrive: 60, timeout: 300000 });
            BOT.detail = 'hunting the final shadow man';
            // The final-phase SM never despawns and never moves — approach it
            // WHEREVER it stands. Meanwhile, only ONE shadow man can exist at a
            // time, so a lingering NON-final one far away starves the final
            // spawn forever — walk those down to despawn them.
            const huntT0 = Date.now();
            for (;;) {
                if (demonApocalypse || shadowManCutscene) break;
                if (shadowMan && shadowMan.finalPhase) break;
                if (Date.now() - huntT0 > 900000) throw new Error('final SM never spawned');
                if (shadowMan && !shadowMan.finalPhase) {
                    const sp2 = shadowMan.mesh.position;
                    await go(sp2.x, sp2.z, { arrive: 80, timeout: 90000 }).catch(() => {});
                    MOTOR.stop();
                    if (dist2(0, 0) > 150) await go(0, 0, { arrive: 60, timeout: 300000 }).catch(() => {});
                }
                await sleep(4000);
            }
            if (!demonApocalypse && !shadowManCutscene && shadowMan) {
                // Close to ~75 with goto (unstick), then aim-walk the last leg —
                // the cutscene fires within 67 while the SM is framed on screen.
                const sp = shadowMan.mesh.position;
                try { await go(sp.x, sp.z, { arrive: 75, timeout: 180000 }); } catch (e) {}
                MOTOR.set({ type: 'combat', sel: 'shadowman', weapon: 'melee', minR: 30, maxR: 45, punchAt: 0, thenIdle: true });
                await until(() => shadowManCutscene || demonApocalypse, { timeout: 120000, what: 'cutscene' });
                MOTOR.stop();
            }
            await until(() => demonApocalypse, { timeout: 90000, what: 'apocalypse start' });
        }
        BOT.detail = 'DEMON WAR — circuit gunner';
        // the WAR layer owns inputs now; deaths are latched (+50 each, no spirals)
        await until(() => !demonApocalypse && demons.length === 0, { timeout: 3600000, poll: 1000, what: 'victory' });
        BOT.detail = '';
    },
},
{
    name: 'secret-gem',
    done: () => typeof gemCollected !== 'undefined' && gemCollected,
    run: async () => {
        await until(() => secretGem, { timeout: 30000, what: 'secret gem spawn' });
        const g = resolve('gem-secret');
        // A resumed save can land here mounted — dismount nearby, collect on foot.
        if (mountedOnDragon) await dismountSafe(g.x, g.z);
        await go(g.x, g.z, { arrive: 1.2, timeout: 300000 });
        await until(() => gemCollected, { timeout: 15000, what: 'secret gem' });
        if (typeof boostActive !== 'undefined' && !boostActive) press('KeyB');
    },
},
{
    name: 'holy-gem',
    done: () => typeof holyGemCollected !== 'undefined' && holyGemCollected,
    run: async () => {
        // Land ON the platform near the gem, dismount, then WALK straight into
        // the gem on foot (collection radius 2.5). Trying to hover-drop THROUGH
        // the gem is fragile — the dismount drops the player beside it, not on
        // it, and the old loop just re-mounted forever instead of walking.
        for (let attempt = 0; attempt < 5 && !holyGemCollected; attempt++) {
            if (!mountedOnDragon) await mountDragon();
            const g = resolve('gem-holy');
            if (!g) break;
            // Approach the platform a touch to one side of the gem (landing dead
            // on it can bounce), settle, dismount onto the deck.
            const ox = g.x + 4, oz = g.z;
            await fly(ox, g.y + 14, oz, { arrive: 7, timeout: 120000 });
            await fly(ox, g.y + 4, oz, { arrive: 4, timeout: 30000 });
            MOTOR.stop();
            await sleep(800);
            press('KeyU');                                   // dismount onto the platform
            await until(() => !mountedOnDragon, { timeout: 10000, what: 'dismount' });
            await sleep(1200);                               // settle on the deck
            if (holyGemCollected) break;
            // WALK into the gem (short, no detour — the platform is small).
            const g2 = resolve('gem-holy') || g;
            for (let w = 0; w < 3 && !holyGemCollected; w++) {
                await go(g2.x, g2.z, { arrive: 1.0, run: false, noDetour: true, timeout: 12000 }).catch(() => {});
                await until(() => holyGemCollected, { timeout: 3000, what: 'holy gem walk' }).catch(() => {});
            }
        }
        await until(() => holyGemCollected, { timeout: 5000, what: 'holy gem' });
    },
},
{
    name: 'hell-run',
    done: () => !DO_HELL_RUN ||
        (typeof hasPlayedDemonRounds !== 'undefined' && hasPlayedDemonRounds && !roundMode),
    run: async () => {
        if (roundMode && hasPlayedDemonRounds) {
            // Restored INTO mid-hell (the exit reload resumes a mid-round
            // autosave) — the run already happened; use the game's own exit
            // instead of re-fighting the restored round forever.
            try { exitRoundMode(); } catch (e) {}
            await until(() => !roundMode, { timeout: 30000, what: 'leave hell' });
            await sleep(3000);
            return;
        }
        if (!roundMode) {
            if (mountedOnDragon) await dismountSafe(0, 0);
            // Bring the dragon INTO hell: tethered (T), it is NOT poofed by the
            // round entry — it floats 60 above the player and auto-snipes any
            // demon within 30, every second, all run long. Toggle it on now so
            // it closes in (63%-of-distance/s lerp) during the trek to the
            // shrine; the round keeps it regardless of where it is by then.
            if (typeof dragonTethered !== 'undefined' && !dragonTethered &&
                dragonBondFormed && dragonGemCollected) press('KeyT');
            equip('sword-shield');
            const s = resolve('shrine');
            await go(s.x, s.z, { arrive: 3.5, run: true, timeout: 300000 });
            await hitOnce('shrine', { maxDist: 9 });
            await until(() => roundMode, { timeout: 20000, what: 'hell entry' });
        }
        BOT.detail = 'HELL RUN — rounds until death, then leave';
        // Require !roundMode to be STABLE (not a between-round flicker) before
        // declaring we've left — then suspend the guard and return. save-quit
        // does the single pause+quit (pausing here raced the round state and
        // once stranded the bot paused mid-round).
        await until(() => {
            if (roundMode) { BOT._hellLeftAt = 0; return false; }
            if (!BOT._hellLeftAt) { BOT._hellLeftAt = Date.now(); return false; }
            return Date.now() - BOT._hellLeftAt > 1500;
        }, { timeout: 3600000, poll: 500, what: 'leave hell' });
        BOT.guardSuspended = true;
        MOTOR.stop();
        BOT.detail = '';
    },
},
{
    name: 'save-quit',
    done: () => { try { return localStorage.getItem(COMPLETE_KEY) === '1'; } catch (e) { return false; } },
    run: async () => {
        BOT.guardSuspended = true;                            // never fight during shutdown
        MOTOR.stop();
        try { localStorage.setItem(COMPLETE_KEY, '1'); } catch (e) {}
        // Pause (true pause freezes creatures) — but only if not already paused,
        // since KeyP toggles and a stray press would UNpause into the horde.
        if (!timeMenuOpen) { press('KeyP'); await until(() => timeMenuOpen, { timeout: 10000, what: 'pause menu' }); }
        await sleep(800);
        const btn = document.getElementById('save-quit-btn');
        if (btn) btn.click();                                 // page reloads to the title
        await sleep(20000);                                   // (context dies before this ends)
    },
},
];

// ── Campaign driver ─────────────────────────────────────────────────────────
const failStreak = {};
async function campaign() {
    await until(() => typeof gameStarted !== 'undefined' && gameStarted && typeof player !== 'undefined' && player, { timeout: 120000, what: 'game start' });
    await sleep(1500);
    for (;;) {
        if (BOT.aborted) return;
        let next = null;
        for (const p of PHASES) {
            let d = false;
            try { d = p.done(); } catch (e) { d = false; }
            if (!d) { next = p; break; }
        }
        if (!next) {
            BOT.phase = 'complete'; BOT.detail = 'FULL PLAYTHROUGH DONE';
            try { localStorage.removeItem('nw-botrun'); } catch (e) {}
            try {
                if (!document.getElementById('nw-bot-done')) {
                    const d = document.createElement('div');
                    d.id = 'nw-bot-done';
                    d.style.cssText = 'position:fixed;top:14%;left:50%;transform:translateX(-50%);z-index:999;' +
                        'background:rgba(8,30,10,0.9);color:#aef2ae;font:600 22px/1.6 Menlo,monospace;' +
                        'padding:18px 34px;border-radius:14px;border:1px solid rgba(140,255,140,0.4);text-align:center;pointer-events:none';
                    d.innerHTML = '🤖 NW-BOT<br>FULL PLAYTHROUGH COMPLETE 🏆';
                    document.body.appendChild(d);
                }
            } catch (e) {}
            return;
        }
        BOT.phase = next.name; BOT.detail = '';
        let ok = false;
        for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
            try {
                await next.run();
                ok = true;
            } catch (e) {
                if (BOT.aborted) return;
                BOT.note = next.name + ' attempt ' + attempt + ' failed: ' + e.message;
                MOTOR.stop();
                await sleep(2500);
            }
            try { if (next.done()) ok = true; } catch (e) {}
        }
        if (ok) { failStreak[next.name] = 0; continue; }
        failStreak[next.name] = (failStreak[next.name] || 0) + 1;
        BOT.note = next.name + ' hard-failed (streak ' + failStreak[next.name] + ')';
        if (failStreak[next.name] >= 3 && !warArmed()) {
            // Deterministic last resort: burn the world and replay from zero.
            // (The campaign is seed-independent; deaths do this too, by design.)
            BOT.note = 'phase deadlock — forcing world reset';
            await sleep(2000);
            try { hardReset(); } catch (e) { location.reload(); }
            return;
        }
        await sleep(15000);
    }
}
// Test bench: with window.__nwBotTestMode set BEFORE __nwBotStart(), the
// campaign stays down and a driver can call the primitives directly.
if (!window.__nwBotTestMode) campaign().catch(e => { if (!BOT.aborted) BOT.note = 'CAMPAIGN ERR: ' + e.message; });
BOT._test = { go, navTo, fly, motorRun, equip, houseRecs, insideHouse, enterHouse, exitHouse, hhStairEntry, enterCaveTo, exitCave, strikeCorpse, holdUntil, pickupLocked, lookSmooth, hhL2W, hhW2L, aimAt, leaveWater, inWater, meleeNPCs, chargeSwordAura, pursue,
                phase: n => PHASES.find(p => p.name === n) };

// ── Status for the supervisor ───────────────────────────────────────────────
BOT.status = function () {
    try {
        const p = player.position;
        return {
            gen: BOT.gen, phase: BOT.phase, detail: BOT.detail, note: BOT.note,
            pos: [p.x, p.y, p.z].map(v => +v.toFixed(1)),
            hp: +playerHealth.toFixed(0), dead: playerDead,
            hand: currentHandItem,
            time: document.getElementById('time-of-day').textContent + ' ' + document.getElementById('day-night').textContent,
            flags: {
                stick: hasStick, torch: hasTorch, shovel: hasShovel, key: hasGoldenKey, ak: ak47Collected,
                talis: hasTalisman, ss: hasSwordShield, aura: swordAuraActive, dgem: dragonGemCollected,
                bond: dragonBondFormed, holy: holyGemCollected, boost: boostUnlocked, asc: dragonAscended,
                secret: gemCollected, keyNote: keyHintNotePickedUp, volcNote: volcanoHintNotePickedUp,
            },
            kills: killCount,
            counts: { demon: demons.length, creature: nightCreatures.length, angel: hhAngels.length },
            hhPhase: hhSeqPhase, altar: altarState, altarLit: altarTorchesLit,
            smSpawns: shadowManTotalSpawns, smP3: shadowManPhase3Ready,
            apoc: demonApocalypse, round: roundMode ? currentRound : 0,
            mounted: mountedOnDragon,
            ctxLost: (typeof renderer !== 'undefined') ? renderer.getContext().isContextLost() : false,
            complete: (function () { try { return localStorage.getItem(COMPLETE_KEY) === '1'; } catch (e) { return false; } })(),
        };
    } catch (e) {
        return { gen: BOT.gen, phase: BOT.phase, note: 'status err: ' + e.message, booting: true };
    }
};

return 'BOT gen ' + BOT.gen + ' installed';

};

window.__nwBotStop = function () {
    try {
        localStorage.removeItem('nw-botrun');
        localStorage.removeItem('nw-botrun-save');
        sessionStorage.removeItem('nw-bot-live');
    } catch (e) {}
    try { if (window.BOT && window.BOT._teardown) window.BOT._teardown(); } catch (e) {}
    const hud = document.getElementById('nw-bot-hud');
    if (hud) hud.remove();
};

// ESC stops the bot (the HUD banner is hidden, so this is the kill switch).
document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    try { if (localStorage.getItem('nw-botrun') === '1' || (window.BOT && !window.BOT.aborted)) window.__nwBotStop(); } catch (err) {}
});

// ── Bootstrap: subtle title button + bot-mode boot hook ─────────────────────
(function () {
    function botModeOn() { try { return localStorage.getItem('nw-botrun') === '1'; } catch (e) { return false; } }

    // The subtle "bot run" button (bottom-right of the title screen only).
    // HIDDEN ON A VIRGIN INSTALL: a brand-new player should meet a clean title
    // screen, so the button only appears once at least one save file exists.
    // Once earned it is STICKY (localStorage 'nw-bot-btn') — deleting every
    // save afterwards does not take it away again.
    function botBtnUnlocked() {
        try { return localStorage.getItem('nw-bot-btn') === '1'; } catch (e) { return false; }
    }
    async function botBtnShouldShow() {
        if (botBtnUnlocked()) return true;
        try {
            if (typeof SAVE_API !== 'undefined' && SAVE_API && SAVE_API.list) {
                const saves = await SAVE_API.list();
                if (saves && saves.length) {
                    try { localStorage.setItem('nw-bot-btn', '1'); } catch (e) {}
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }
    function makeBotRunButton() {
        const startScreen = document.getElementById('start-screen');
        if (!startScreen || document.getElementById('bot-run-btn')) return;
        const b = document.createElement('button');
        b.id = 'bot-run-btn';
        b.textContent = 'bot run';
        b.style.cssText = 'position:absolute;right:16px;bottom:14px;z-index:60;' +
            'background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:7px;' +
            'color:rgba(255,255,255,0.65);font:12px Menlo,monospace;letter-spacing:0.08em;' +
            'padding:5px 12px;cursor:pointer;transition:color 0.2s,border-color 0.2s';
        b.onmouseenter = () => { b.style.color = 'rgba(190,255,190,0.95)'; b.style.borderColor = 'rgba(150,255,150,0.55)'; };
        b.onmouseleave = () => { b.style.color = 'rgba(255,255,255,0.65)'; b.style.borderColor = 'rgba(255,255,255,0.35)'; };
        b.onclick = () => {
            try {
                localStorage.setItem('nw-botrun', '1');
                localStorage.removeItem('nw-bot-complete');
                localStorage.removeItem('nw-botrun-save');
            } catch (e) {}
            const nb = document.getElementById('new-save-btn');
            const sb = document.getElementById('start-btn');
            if (nb && nb.offsetParent !== null) nb.click();
            else if (sb) sb.click();
        };
        startScreen.appendChild(b);
    }
    // Re-check while the title screen is up: a save created this session (or a
    // profile that already had one) unlocks the button without a restart.
    (function watchBotBtn() {
        let ticks = 0;
        const iv = setInterval(async () => {
            if (document.getElementById('bot-run-btn')) { clearInterval(iv); return; }
            if (await botBtnShouldShow()) { makeBotRunButton(); clearInterval(iv); return; }
            if (++ticks > 600) clearInterval(iv);             // ~15 min, then stop polling
        }, 1500);
    })();

    // Boot hook: while bot mode is on, keep the campaign alive across reloads.
    // World-reset deaths auto-resume by themselves (sessionStorage); this hook
    // covers fresh boots and app relaunches that land on the title screen.
    let armed = false;
    let tick = 0;
    let triedSavedLoad = false;
    let lastClickTick = -99;
    setInterval(() => {
        if (!botModeOn()) return;
        try {
            if (localStorage.getItem('nw-bot-complete') === '1') { localStorage.removeItem('nw-botrun'); return; }
        } catch (e) {}
        if (typeof gameStarted !== 'undefined' && gameStarted) {
            if (!armed) { armed = true; window.__nwBotStart(); }
            // 'nw-bot-live' marks THIS window as having an active bot run —
            // it survives same-window reloads (world-reset deaths) but not an
            // app relaunch, which is how closing the app stops the bot.
            try { sessionStorage.setItem('nw-bot-live', '1'); } catch (e) {}
            try { if (typeof activeSaveId !== 'undefined' && activeSaveId) localStorage.setItem('nw-botrun-save', activeSaveId); } catch (e) {}
            return;
        }
        const ss = document.getElementById('start-screen');
        if (!ss || ss.style.display === 'none') return;       // world is loading
        tick++;
        if (tick < 3) return;                                  // let the title settle
        // The standalone harness identifies itself via the URL query — readable
        // synchronously from the first tick (a sessionStorage-only marker once
        // lost a race with page load and wrongly disarmed a resumable run).
        const harness = (() => {
            try {
                return location.search.indexOf('nwbotharness') !== -1 ||
                       sessionStorage.getItem('nw-bot-harness') === '1';
            } catch (e) { return false; }
        })();
        if (!harness) {
            const live = (() => { try { return sessionStorage.getItem('nw-bot-live') === '1'; } catch (e) { return false; } })();
            if (live) return;      // same-window reload (world reset) — the game auto-resumes itself
            if (tick < 6) return;  // generous grace before concluding "fresh app launch"
            // Fresh app launch with a leftover flag: quitting the app stops the
            // bot, so disarm instead of resuming.
            try { localStorage.removeItem('nw-botrun'); localStorage.removeItem('nw-botrun-save'); } catch (e) {}
            return;
        }
        // Standalone harness window: resume the bot's save / start fresh.
        let savedId = null;
        try { savedId = localStorage.getItem('nw-botrun-save'); } catch (e) {}
        if (savedId && !triedSavedLoad &&
            typeof _loadSaveAndStart === 'function' && typeof SAVE_API !== 'undefined' && SAVE_API) {
            triedSavedLoad = true;
            lastClickTick = tick;
            try { _loadSaveAndStart(savedId, null); } catch (e) {}   // resume the bot's save
            return;
        }
        // Fallback: start a fresh game. Worldgen keeps the title visible for a
        // while (20s+ in fullscreen), so wait extra long after a stored-save
        // load before concluding it failed — firing early once double-booted
        // a resume into a fresh world.
        if (tick - lastClickTick < (triedSavedLoad ? 30 : 12)) return;
        lastClickTick = tick;
        const nb = document.getElementById('new-save-btn');
        const sb = document.getElementById('start-btn');
        if (nb && nb.offsetParent !== null) nb.click();
        else if (sb) sb.click();
    }, 1200);

    // A user-initiated "Save & quit" ends the bot run on the spot (the bot's
    // own campaign-ending save & quit also passes through here — harmless,
    // since it has already written the completion marker).
    const sq = document.getElementById('save-quit-btn');
    if (sq) sq.addEventListener('click', () => {
        if (!botModeOn()) return;
        try {
            localStorage.removeItem('nw-botrun');
            localStorage.removeItem('nw-botrun-save');
            sessionStorage.removeItem('nw-bot-live');
        } catch (e) {}
    }, true);
})();
