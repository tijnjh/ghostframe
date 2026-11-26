import { join } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import type { IpcMainEvent } from 'electron'
import { LENS } from '../shared/lens'
import type { LensFrame } from '../shared/lens'

const FRAME_INTERVAL_MS = 16

/**
 * The magnifier is its own transparent, click-through window floating above the app. That keeps
 * it out of `capturePage`, so it can show what is underneath it (iframes included) without
 * seeing itself. While the user holds it, the main window streams cursor positions here; we
 * move the lens window and keep capturing the patch under the glass.
 */
export function attachMagnifier(main: BrowserWindow, loadPage: (win: BrowserWindow, page: string) => void): void {
  const lens = new BrowserWindow({
    parent: main,
    width: LENS.windowSize,
    height: LENS.windowSize,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  })
  lens.setIgnoreMouseEvents(true)
  loadPage(lens, 'lens.html')

  let active = false
  let looping = false
  let cursor = { x: 0, y: 0 }
  let zoom: number = LENS.defaultZoom

  const fromMain = (event: IpcMainEvent) => event.sender === main.webContents

  function place(): void {
    const bounds = main.getContentBounds()
    lens.setPosition(
      Math.round(bounds.x + cursor.x - LENS.center),
      Math.round(bounds.y + cursor.y - LENS.lift - LENS.center),
    )
  }

  async function captureLoop(): Promise<void> {
    if (looping) return
    looping = true
    while (active && !main.isDestroyed() && !lens.isDestroyed()) {
      const [viewWidth, viewHeight] = main.getContentSize()
      const centerX = cursor.x
      const centerY = cursor.y - LENS.lift
      const half = LENS.radius / zoom
      const x = Math.max(0, Math.floor(centerX - half))
      const y = Math.max(0, Math.floor(centerY - half))
      const width = Math.min(viewWidth, Math.ceil(centerX + half)) - x
      const height = Math.min(viewHeight, Math.ceil(centerY + half)) - y

      let frame: LensFrame | null = null
      if (width > 0 && height > 0) {
        const image = await main.webContents.capturePage({ x, y, width, height })
        frame = { image: image.toDataURL(), x, y, width, height, centerX, centerY, zoom }
      }
      if (!active || lens.isDestroyed()) break
      lens.webContents.send('lens:frame', frame)
      await new Promise(resolve => setTimeout(resolve, FRAME_INTERVAL_MS))
    }
    looping = false
  }

  const onStart = (event: IpcMainEvent, x: number, y: number, startZoom: number) => {
    if (!fromMain(event)) return
    cursor = { x, y }
    zoom = clampZoom(startZoom)
    active = true
    place()
    lens.showInactive()
    void captureLoop()
  }
  const onMove = (event: IpcMainEvent, x: number, y: number) => {
    if (!fromMain(event) || !active) return
    cursor = { x, y }
    place()
  }
  const onZoom = (event: IpcMainEvent, value: number) => {
    if (fromMain(event)) zoom = clampZoom(value)
  }
  const onEnd = (event: IpcMainEvent) => {
    if (!fromMain(event)) return
    active = false
    lens.hide()
  }

  ipcMain.on('lens:start', onStart)
  ipcMain.on('lens:move', onMove)
  ipcMain.on('lens:zoom', onZoom)
  ipcMain.on('lens:end', onEnd)
  main.on('closed', () => {
    active = false
    ipcMain.off('lens:start', onStart)
    ipcMain.off('lens:move', onMove)
    ipcMain.off('lens:zoom', onZoom)
    ipcMain.off('lens:end', onEnd)
    if (!lens.isDestroyed()) lens.destroy()
  })
}

function clampZoom(value: number): number {
  return Number.isFinite(value) ? Math.min(LENS.maxZoom, Math.max(LENS.minZoom, value)) : LENS.defaultZoom
}
