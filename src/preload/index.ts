import { contextBridge, ipcRenderer } from 'electron'
import type { DesignCompareApi } from '../shared/api'

// This preload runs in every frame (nodeIntegrationInSubFrames), so it branches on where it is.

if (window.top === window) {
  // The app window and the lens window: expose the bridge.
  const api: DesignCompareApi = {
    hasFigmaToken: () => ipcRenderer.invoke('figma:has-token'),
    setFigmaToken: token => ipcRenderer.invoke('figma:set-token', token),
    renderFigmaFrame: link => ipcRenderer.invoke('figma:render', link),
    lens: {
      start: (x, y, zoom) => ipcRenderer.send('lens:start', x, y, zoom),
      move: (x, y) => ipcRenderer.send('lens:move', x, y),
      setZoom: zoom => ipcRenderer.send('lens:zoom', zoom),
      end: () => ipcRenderer.send('lens:end'),
      onFrame: (callback) => {
        ipcRenderer.on('lens:frame', (_event, frame) => callback(frame))
      },
    },
  }
  contextBridge.exposeInMainWorld('api', api)
}
else if (window.parent === window.top && !/(^|\.)figma\.com$/.test(location.hostname)) {
  // The site iframe: hide its scrollbar (scrolling still works) so the page lays out at the
  // exact iframe width instead of losing ~15px to the scrollbar.
  const style = document.createElement('style')
  style.textContent = 'html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}'
  const inject = () => (document.head ?? document.documentElement)?.appendChild(style)
  if (document.head) inject()
  else document.addEventListener('DOMContentLoaded', inject, { once: true })
}
