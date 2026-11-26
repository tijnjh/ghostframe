import './lens.css'
import { LENS } from '../../shared/lens'
import type { LensFrame } from '../../shared/lens'

const root = document.documentElement.style
root.setProperty('--c', `${LENS.center}px`)
root.setProperty('--r', `${LENS.radius}px`)

const canvas = document.getElementById('view') as HTMLCanvasElement
const zoomLabel = document.getElementById('zoom') as HTMLElement
const ctx = canvas.getContext('2d')!
const size = LENS.radius * 2
const dpr = window.devicePixelRatio || 1
canvas.width = Math.round(size * dpr)
canvas.height = Math.round(size * dpr)

let latest = 0

window.api.lens.onFrame((frame) => {
  const seq = ++latest
  if (!frame) {
    draw(null, null)
    return
  }
  const image = new Image()
  image.onload = () => {
    if (seq === latest) draw(image, frame)
  }
  image.src = frame.image
})

function draw(image: HTMLImageElement | null, frame: LensFrame | null): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#111113'
  ctx.fillRect(0, 0, size, size)
  if (!image || !frame) {
    zoomLabel.textContent = ''
    return
  }
  const { zoom } = frame
  const r = LENS.radius
  // Map page point p to glass point r + (p - centre) * zoom.
  const toLensX = (x: number) => r + (x - frame.centerX) * zoom
  const toLensY = (y: number) => r + (y - frame.centerY) * zoom

  // Crisp pixels once zoomed in far enough to inspect them.
  ctx.imageSmoothingEnabled = zoom < 4
  ctx.drawImage(image, toLensX(frame.x), toLensY(frame.y), frame.width * zoom, frame.height * zoom)

  if (zoom >= 8) {
    // Pixel grid, aligned to CSS pixels.
    ctx.strokeStyle = 'rgba(0, 0, 0, .18)'
    ctx.lineWidth = 1 / dpr
    ctx.beginPath()
    for (let x = Math.ceil(frame.centerX - r / zoom); x <= frame.centerX + r / zoom; x++) {
      ctx.moveTo(toLensX(x), 0)
      ctx.lineTo(toLensX(x), size)
    }
    for (let y = Math.ceil(frame.centerY - r / zoom); y <= frame.centerY + r / zoom; y++) {
      ctx.moveTo(0, toLensY(y))
      ctx.lineTo(size, toLensY(y))
    }
    ctx.stroke()
  }

  // Reticle: outline the pixel under the centre when zoomed in, a small cross otherwise.
  ctx.strokeStyle = 'rgba(122, 169, 255, .95)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (zoom >= 8) {
    const px = Math.floor(frame.centerX)
    const py = Math.floor(frame.centerY)
    ctx.rect(toLensX(px), toLensY(py), zoom, zoom)
  }
  else {
    ctx.moveTo(r - 7, r)
    ctx.lineTo(r + 7, r)
    ctx.moveTo(r, r - 7)
    ctx.lineTo(r, r + 7)
  }
  ctx.stroke()

  zoomLabel.textContent = `${zoom.toFixed(zoom < 10 ? 1 : 0)}×`
}
