// Copyright (c) 2026 Min Chen (chenmin911130-cyber). All rights reserved.
// Unauthorized copying, modification, redistribution, or submission of this
// file (including as academic coursework) via any medium is strictly prohibited.

import { app, BrowserWindow, ipcMain, globalShortcut, clipboard, screen, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import koffi from 'koffi'
import { PythonBridge } from './bridge'

const user32 = koffi.load('user32.dll')
// HWND 在 64 位 Windows 是 64 位整数; 用 uint64 声明即可传窗口句柄值
const SetWindowDisplayAffinity = user32.func('bool SetWindowDisplayAffinity(uint64 hwnd, uint affinity)')

// desktop/dist-electron/main.js 运行时:
//   __dirname   = <repo>/desktop/dist-electron
//   desktopDir  = <repo>/desktop
//   repoRoot    = <repo>
const desktopDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopDir, '..')
// 用户可写配置目录 %APPDATA%\Nod —— 与引擎一致，永不写安装目录（兼容 Program Files 等受保护目录）
const USER_DIR = path.join(app.getPath('appData'), 'Nod')
const USER_CONFIG_PATH = path.join(USER_DIR, 'config.json')
const USER_WINDOW_STATE_PATH = path.join(USER_DIR, 'window_state.json')
// 只读默认模板（打包版 = resources/engine/_internal/config.json；开发 = 项目根 config.json）
const DEFAULT_CONFIG_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'engine', '_internal', 'config.json')
  : path.join(repoRoot, 'config.json')
const INDEX_HTML = path.join(desktopDir, 'dist', 'index.html')

const MIN_W = 1024
const MIN_H = 640
const OPACITY_MIN = 10
const OPACITY_MAX = 100

let win: BrowserWindow | null = null
let bridge: PythonBridge | null = null
let opacitySaveTimer: NodeJS.Timeout | null = null
let quitting = false

function ensureUserConfig(): void {
  // 首次启动：把只读默认模板复制到 %APPDATA%\Nod（迁移）。引擎侧也会做同样迁移，这里兜底。
  try {
    fs.mkdirSync(USER_DIR, { recursive: true })
    if (!fs.existsSync(USER_CONFIG_PATH) && fs.existsSync(DEFAULT_CONFIG_PATH)) {
      fs.copyFileSync(DEFAULT_CONFIG_PATH, USER_CONFIG_PATH)
    }
  } catch (e) {
    console.error('[config] migrate failed:', e)
  }
}

function readConfig(): any {
  // 优先用户配置(%APPDATA%\Nod)，回退只读默认模板
  for (const p of [USER_CONFIG_PATH, DEFAULT_CONFIG_PATH]) {
    try {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'))
      // API key 永不进入 renderer（打包版默认模板可能内嵌 key）
      if (cfg?.llm?.api_key) {
        const { api_key, ...llm } = cfg.llm
        cfg.llm = llm
      }
      return cfg
    } catch {
      /* try next */
    }
  }
  return {}
}

function readWindowState(): { x?: number; y?: number; w?: number; h?: number } {
  try {
    return JSON.parse(fs.readFileSync(USER_WINDOW_STATE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function writeWindowState(b: { x: number; y: number; w: number; h: number }): void {
  try {
    fs.mkdirSync(USER_DIR, { recursive: true })
    fs.writeFileSync(USER_WINDOW_STATE_PATH, JSON.stringify(b))
  } catch {
    /* ignore */
  }
}

// 透明度写盘: 防抖 400ms, 字段必须是 ui.opacity
function writeOpacity(value: number): void {
  if (opacitySaveTimer) clearTimeout(opacitySaveTimer)
  opacitySaveTimer = setTimeout(() => {
    try {
      const cfg = readConfig()
      cfg.ui = cfg.ui || {}
      cfg.ui.opacity = Math.round(value)
      fs.mkdirSync(USER_DIR, { recursive: true })
      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(cfg, null, 2))
    } catch (e) {
      console.error('[config] save opacity failed:', e)
      dialog.showErrorBox('Nod', 'Failed to save settings (disk/permission?). Your opacity change may not persist.')
    }
  }, 400)
}

function clampOpacity(n: number): number {
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Math.round(n)))
}

function createWindow(): void {
  const st = readWindowState()
  const cfg = readConfig()
  const opacity = clampOpacity(cfg?.ui?.opacity ?? 83)
  const wa = screen.getPrimaryDisplay().workArea

  const w = Math.min(Math.max(st.w ?? 1280, MIN_W), wa.width)
  const h = Math.min(Math.max(st.h ?? 800, MIN_H), wa.height)

  // 仅当保存的位置仍在屏幕可见范围内才恢复, 否则交给系统定位
  let x: number | undefined = st.x
  let y: number | undefined = st.y
  if (typeof x === 'number' && typeof y === 'number') {
    // 保证窗口左上角落在工作区内, 至少留 120px 宽 / 120px 高可见
    x = Math.max(wa.x, Math.min(x, wa.x + wa.width - 120))
    y = Math.max(wa.y, Math.min(y, wa.y + wa.height - 120))
  } else {
    x = undefined
    y = undefined
  }

  win = new BrowserWindow({
    width: w,
    height: h,
    x,
    y,
    minWidth: MIN_W,
    minHeight: MIN_H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: "Nod",
    icon: path.join(desktopDir, 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setOpacity(opacity / 100)
  win.loadFile(INDEX_HTML)

  // 就绪后再显示, 避免透明无边框窗在 Windows 上被初始化为最小化/隐藏
  win.once('ready-to-show', () => {
    win?.show()
    win?.focus()
    // Electron 透明无边框窗在 Windows show 后会丢失 alwaysOnTop, 强制重设
    win?.setAlwaysOnTop(true)
  })

  win.on('close', () => {
    if (win) {
      const b = win.getBounds()
      writeWindowState({ x: b.x, y: b.y, w: b.width, h: b.height })
    }
  })
  win.on('closed', () => {
    win = null
  })
}

let stealthOn = false
let normalBounds: Electron.Rectangle | null = null

function applyStealth(on: boolean): void {
  if (!win) return
  try {
    const buf = win.getNativeWindowHandle()
    const hwnd = buf.readBigUInt64LE(0) // Buffer 内容 = HWND 值(小端 64 位)
    // 同进程调用自己的窗口, 权限必然通过
    SetWindowDisplayAffinity(hwnd, on ? 0x11 : 0x00) // WDA_EXCLUDEFROMCAPTURE / WDA_NONE
    stealthOn = on
  } catch (err) {
    console.error('[stealth] failed:', err)
  }
}

function setupIpc(): void {
  ipcMain.on('bridge:send', (_e, msg: unknown) => {
    bridge?.send(msg)
  })

  ipcMain.on('win:opacity', (_e, n: number) => {
    const v = clampOpacity(n)
    win?.setOpacity(v / 100)
    writeOpacity(v)
  })

  ipcMain.on('win:pinned', (_e, b: boolean) => {
    win?.setAlwaysOnTop(!!b)
  })

  ipcMain.on('win:close', () => {
    win?.close()
  })

  ipcMain.on('win:minimize', () => {
    win?.minimize()
  })

  ipcMain.on('win:stealth', (_e, on: boolean) => {
    applyStealth(!!on)
  })

  ipcMain.on('win:view', (_e, mode: string) => {
    if (!win) return
    if (mode === 'workspace') {
      // normalBounds 可能为 null（首次挂载 setView 即触发），setBounds(null) 会抛异常
      // 中断后续 setMinimumSize → 最小尺寸限制失效。防御性判空。
      if (normalBounds) win.setBounds(normalBounds)
      win.setMinimumSize(MIN_W, MIN_H)
      if (win.isMinimized()) win.restore()
      normalBounds = null
      return
    }
    if (!normalBounds) normalBounds = win.getBounds()
    const wa = screen.getPrimaryDisplay().workArea
    if (mode === 'fullscreen') {
      win.setMinimumSize(640, 480)
      win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height })
    } else {
      win.setMinimumSize(640, 480)
      // Auto 左侧悬浮: 640 × 900 左右的竖向阅读卡片(受工作区高度约束)
      win.setBounds({ x: wa.x + 24, y: wa.y + 24, width: 640, height: Math.min(900, wa.height - 48) })
    }
    win.setAlwaysOnTop(true)
  })

  ipcMain.on('app:copy', (_e, text: string) => {
    clipboard.writeText(String(text ?? ''))
  })

  ipcMain.on('app:open-external', (_e, url: string) => {
    const u = String(url ?? '')
    if (/^https?:\/\//i.test(u)) shell.openExternal(u)
  })

  ipcMain.handle('app:config', () => readConfig())
}

function registerShortcuts(): void {
  const map: Array<[string, string]> = [
    ['F2', 'f2'],
    ['F3', 'f3'],
    ['F4', 'f4'],
    ['F8', 'f8'],
    ['F9', 'f9'],
  ]
  for (const [accel, key] of map) {
    try {
      globalShortcut.register(accel, () => {
        win?.webContents.send('app:shortcut', key)
      })
    } catch {
      /* 快捷键被占用则跳过 */
    }
  }
}

function startBridge(): void {
  bridge = new PythonBridge(repoRoot, {
    onEvent: (e) => {
      const ev = e as { type?: string; state?: string; text?: string }
      if (ev?.type === 'state' || ev?.type === 'error') {
        console.log(`[bridge] ${ev.type}: ${ev.state ?? ev.text ?? ''}`)
      }
      win?.webContents.send('bridge:event', e)
    },
    onLog: (line) => {
      console.error('[python]', line)
    },
    onExit: (code) => {
      if (!quitting) {
        console.error(`[python] engine exited (code ${code})`)
        app.quit()
      }
    },
  }, app.isPackaged)
  bridge.start()
}

app.whenReady().then(() => {
  // Windows 任务栏显示应用名(而非 "Electron")
  app.setAppUserModelId('com.nod.app')
  ensureUserConfig()
  setupIpc()
  createWindow()
  registerShortcuts()
  startBridge()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      startBridge()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  quitting = true
  globalShortcut.unregisterAll()
  if (bridge) {
    bridge.kill()
    bridge = null
  }
})
