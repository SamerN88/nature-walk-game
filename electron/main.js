const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

let savesDir;

const SAVE_ID_RE = /^[a-z0-9-]+$/;

function savePath(id) {
    if (!SAVE_ID_RE.test(id)) throw new Error(`Invalid save id: ${id}`);
    return path.join(savesDir, `${id}.json`);
}

async function readSave(id) {
    const raw = await fs.readFile(savePath(id), 'utf8');
    return JSON.parse(raw);
}

// Write via a unique temp file + rename: a crash mid-write can't corrupt the
// save, and concurrent writes (autosave racing a final save) can't interleave
// on a shared temp path — the last rename simply wins.
async function writeSave(id, record) {
    const target = savePath(id);
    const tmp = `${target}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record), 'utf8');
    await fs.rename(tmp, target);
}

function registerIpcHandlers() {
    ipcMain.handle('saves:list', async () => {
        const entries = await fs.readdir(savesDir).catch(() => []);
        const saves = [];
        for (const entry of entries) {
            if (!entry.endsWith('.json')) continue;
            const id = entry.slice(0, -5);
            if (!SAVE_ID_RE.test(id)) continue;
            try {
                const record = await readSave(id);
                saves.push({
                    id,
                    name: record.name ?? null,
                    seed: record.seed,
                    createdAt: record.createdAt ?? null,
                    updatedAt: record.updatedAt ?? null,
                    hasSnapshot: !!record.snapshot,
                });
            } catch (err) {
                console.error(`Skipping unreadable save ${entry}:`, err.message);
            }
        }
        return saves;
    });

    ipcMain.handle('saves:read', (_e, id) => readSave(id));

    ipcMain.handle('saves:write', (_e, id, record) => writeSave(id, record));

    ipcMain.handle('saves:create', async (_e, record) => {
        const id = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
        await writeSave(id, record);
        return id;
    });

    ipcMain.handle('saves:rename', async (_e, id, name) => {
        const record = await readSave(id);
        record.name = name;
        record.updatedAt = Date.now();
        await writeSave(id, record);
    });

    ipcMain.handle('saves:delete', (_e, id) => fs.unlink(savePath(id)));

    ipcMain.handle('app:quit', () => app.quit());
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        backgroundColor: '#1a472a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(async () => {
    savesDir = path.join(app.getPath('userData'), 'saves');
    await fs.mkdir(savesDir, { recursive: true });
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
