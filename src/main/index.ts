import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { RenderFrameResult } from '../shared/api'
import { parseFigmaNodeUrl } from '../shared/figma-url'
import { renderFrame, RENDER_PIXEL_RATIO } from './figma'
import { clearFigmaToken, getFigmaToken, setFigmaToken } from './token-store'

/**
 * Sites (and dev servers with security middleware) often forbid being framed via
 * `X-Frame-Options` or CSP `frame-ancestors`. Strip both from iframe responses so any
 * URL can be shown next to the design. This replaces the separate proxy.
 */
function allowFramingOfAnySite(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'subFrame' || !details.responseHeaders) {
      callback({})
      return
    }
    const headers = { ...details.responseHeaders }
    for (const name of Object.keys(headers)) {
      const lower = name.toLowerCase()
      if (lower === 'x-frame-options') {
        delete headers[name]
      }
      else if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
        headers[name] = headers[name]
          .map(policy => policy.split(';').filter(d => !/^\s*frame-ancestors\b/i.test(d)).join(';'))
          .filter(policy => policy.trim() !== '')
      }
    }
    callback({ responseHeaders: headers })
  })
}

/** Only the app's own top-level page may use the bridge, never an embedded site. */
function assertFromApp(event: IpcMainInvokeEvent): void {
  if (event.senderFrame?.parent) throw new Error('IPC is only available to the app window')
}

function registerIpc(): void {
  ipcMain.handle('figma:has-token', (event) => {
    assertFromApp(event)
    return getFigmaToken() !== null
  })

  ipcMain.handle('figma:set-token', (event, token: unknown) => {
    assertFromApp(event)
    const value = typeof token === 'string' ? token.trim() : ''
    if (value) setFigmaToken(value)
    else clearFigmaToken()
  })

  ipcMain.handle('figma:render', async (event, link: unknown): Promise<RenderFrameResult> => {
    assertFromApp(event)
    const ref = typeof link === 'string' ? parseFigmaNodeUrl(link) : null
    if (!ref) return { ok: false, error: 'Link has no node-id — copy a link to the frame (right-click → Copy link to selection)' }
    const token = getFigmaToken()
    if (!token) return { ok: false, error: 'No Figma token saved' }
    try {
      return { ok: true, url: await renderFrame(ref, token), pixelRatio: RENDER_PIXEL_RATIO }
    }
    catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    title: 'Ghostframe',
    backgroundColor: '#111113',
    autoHideMenuBar: true,
    // Packaged builds get their icon from the installer; in dev, use the source icon.
    ...(app.isPackaged ? {} : { icon: join(__dirname, '../../build/icon.png') }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      // Runs the preload inside the site iframe too, where it hides the scrollbar so the
      // page lays out at exactly the chosen width. It exposes nothing to those frames.
      nodeIntegrationInSubFrames: true,
    },
  })

  // Links that open new windows (target=_blank) go to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Never let the app window itself be navigated away (e.g. by a dropped file or a framed site).
  win.webContents.on('will-navigate', event => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  allowFramingOfAnySite()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
