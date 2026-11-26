import { LENS } from '../../shared/lens'

/**
 * The resting magnifier in the bottom-right corner. Press and hold to pick it up: the main
 * process shows the real lens window just above the cursor and streams the view under it.
 * Scroll while holding to zoom; release to put it back.
 */
export function setupMagnifier(dock: HTMLElement, zoom: { get: () => number, set: (z: number) => void }): void {
  let pointerId: number | null = null
  let pending: { x: number, y: number } | null = null
  let frame = 0

  const flush = () => {
    frame = 0
    if (pending) window.api.lens.move(pending.x, pending.y)
    pending = null
  }

  dock.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || pointerId !== null) return
    e.preventDefault()
    pointerId = e.pointerId
    dock.setPointerCapture(e.pointerId)
    // Iframes would otherwise swallow pointer and wheel events while dragging over them.
    document.body.classList.add('lens-active')
    window.api.lens.start(e.clientX, e.clientY, zoom.get())
  })

  dock.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return
    pending = { x: e.clientX, y: e.clientY }
    if (!frame) frame = requestAnimationFrame(flush)
  })

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    pointerId = null
    cancelAnimationFrame(frame)
    frame = 0
    pending = null
    document.body.classList.remove('lens-active')
    window.api.lens.end()
  }
  dock.addEventListener('pointerup', release)
  dock.addEventListener('pointercancel', release)
  dock.addEventListener('lostpointercapture', release)

  window.addEventListener('wheel', (e) => {
    if (pointerId === null) return
    e.preventDefault()
    const next = Math.min(LENS.maxZoom, Math.max(LENS.minZoom, zoom.get() * Math.exp(-e.deltaY * 0.0015)))
    zoom.set(next)
    window.api.lens.setZoom(next)
  }, { passive: false })
}
