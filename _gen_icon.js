/* Generate Nod taskbar icon (v2): single rounded lowercase "n" monogram.
   Two outputs:
     desktop/assets/icon.png          - dark navy rounded-square app icon (256px)
     desktop/assets/icon-clear.png    - transparent version (monogram + dot only)
   Rendering: offscreen BrowserWindow -> capturePage (nativeImage cannot decode SVG). */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

// viewBox 0 0 100 100. 安全边距 ≥14 (内容外沿距边缘 ≥14)。
// 小写 n: 左竖 x32 / 右竖 x68 / 拱顶 y28 / 底 y78, stroke 11 圆头圆角, 一致粗细。
// 青点: (83,83) r4.5, 距字母 ≥5, 不接触边缘。
const MONOGRAM = `
  <g stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M32 78 V44 C32 34 40 28 50 28 C60 28 68 34 68 44 V78" stroke="#f5f8ff" stroke-width="11"/>
    <circle cx="83" cy="83" r="4.5" fill="#00d2ff" stroke="none"/>
  </g>`

const APP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#08122c"/>${MONOGRAM}
</svg>`

const CLEAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100">${MONOGRAM}
</svg>`

async function render(html, out) {
  const win = new BrowserWindow({
    width: 256, height: 256, show: false, frame: false,
    transparent: true,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  })
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      break
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  await new Promise((r) => setTimeout(r, 600))
  const png = (await win.webContents.capturePage()).toPNG()
  fs.writeFileSync(out, png)
  console.log('saved', out, png.length, 'bytes')
  win.destroy()
  await new Promise((r) => setTimeout(r, 300))
}

const wrap = (svg) => `<!doctype html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:transparent">${svg}</body></html>`

app.on('window-all-closed', () => {
  /* keep app alive between sequential renders */
})

app.whenReady().then(async () => {
  const dir = path.join(__dirname, 'desktop', 'assets')
  await render(wrap(APP_ICON), path.join(dir, 'icon.png'))
  await render(wrap(CLEAR_ICON), path.join(dir, 'icon-clear.png'))
  app.quit()
})
