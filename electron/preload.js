const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameSaves', {
    list:   ()            => ipcRenderer.invoke('saves:list'),
    read:   (id)          => ipcRenderer.invoke('saves:read', id),
    write:  (id, record)  => ipcRenderer.invoke('saves:write', id, record),
    create: (record)      => ipcRenderer.invoke('saves:create', record),
    rename: (id, name)    => ipcRenderer.invoke('saves:rename', id, name),
    remove: (id)          => ipcRenderer.invoke('saves:delete', id),
    quit:   ()            => ipcRenderer.invoke('app:quit'),
});
