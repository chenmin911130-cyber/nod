// Copyright (c) 2026 Min Chen (chenmin911130-cyber). All rights reserved.
// Unauthorized copying, modification, redistribution, or submission of this
// file (including as academic coursework) via any medium is strictly prohibited.

import { contextBridge, ipcRenderer } from 'electron'

// 只暴露白名单 API。API key 永远不经过这里, 渲染进程读不到 Hermes .env。
const api = {
  send: (msg: unknown) => ipcRenderer.send('bridge:send', msg),

  onEvent: (cb: (e: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => cb(payload)
    ipcRenderer.on('bridge:event', listener)
    return () => ipcRenderer.removeListener('bridge:event', listener)
  },

  onShortcut: (cb: (k: string) => void) => {
    const listener = (_e: unknown, key: string) => cb(key)
    ipcRenderer.on('app:shortcut', listener)
    return () => ipcRenderer.removeListener('app:shortcut', listener)
  },

  setOpacity: (n: number) => ipcRenderer.send('win:opacity', n),
  setPinned: (b: boolean) => ipcRenderer.send('win:pinned', b),
  setStealth: (on: boolean) => ipcRenderer.send('win:stealth', on),
  setView: (mode: 'workspace' | 'focus' | 'fullscreen') => ipcRenderer.send('win:view', mode),
  copy: (text: string) => ipcRenderer.send('app:copy', text),
  close: () => ipcRenderer.send('win:close'),
  minimize: () => ipcRenderer.send('win:minimize'),
  getConfig: () => ipcRenderer.invoke('app:config'),
  openExternal: (url: string) => ipcRenderer.send('app:open-external', url),
}

contextBridge.exposeInMainWorld('api', api)
