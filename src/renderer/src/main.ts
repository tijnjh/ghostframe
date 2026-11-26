import './styles.css'
import { figmaEmbedUrl, parseFigmaNodeUrl } from '../../shared/figma-url'
import { loadSettings, saveSettings } from './settings'
import type { Mode, Settings } from './settings'

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T

const settings: Settings = loadSettings()

const siteFrame = $<HTMLIFrameElement>('siteFrame')
const figmaFrame = $<HTMLIFrameElement>('figmaFrame')
const designImg = $<HTMLImageElement>('designImg')

/**
 * The design layer is either the Figma embed or an image. Images come from the Figma API
 * (known pixel ratio, shown at true size) or were dropped/pasted (unknown export scale,
 * fitted to the site width).
 */
let image: { url: string, pixelRatio: number | null } | null = null
let hasToken = false
let status: { text: string, warn?: boolean } | null = null
let renderRequest = 0

// ---------------------------------------------------------------- inputs

const persist = () => saveSettings(settings)

const numberFields = ['width', 'height', 'opacity', 'swipe', 'dx', 'dy'] as const
const choiceFields = ['zoom', 'blend', 'interact'] as const
const urlFields = ['site', 'figma'] as const

for (const key of numberFields) {
  const el = $<HTMLInputElement>(key)
  el.value = String(settings[key])
  el.addEventListener('input', () => {
    settings[key] = Number(el.value) || 0
    persist()
    render()
  })
}
for (const key of choiceFields) {
  const el = $<HTMLSelectElement>(key)
  el.value = settings[key]
  el.addEventListener('input', () => {
    Object.assign(settings, { [key]: el.value })
    persist()
    render()
  })
}
for (const key of urlFields) {
  const el = $<HTMLInputElement>(key)
  el.value = settings[key]
  el.addEventListener('input', () => {
    settings[key] = el.value
    persist()
  })
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void load()
  })
}

const full = $<HTMLInputElement>('full')
full.checked = settings.full
full.addEventListener('change', () => {
  settings.full = full.checked
  persist()
  render()
})

function setNumber(key: (typeof numberFields)[number], value: number): void {
  settings[key] = value
  $<HTMLInputElement>(key).value = String(value)
}

function setMode(mode: Mode): void {
  settings.mode = mode
  persist()
  render()
}

$('modeSeg').addEventListener('click', (e) => {
  const mode = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]')?.dataset.mode
  if (mode) setMode(mode as Mode)
})

$('deviceSeg').addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-w]')
  if (!button) return
  setNumber('width', Number(button.dataset.w))
  setNumber('height', Number(button.dataset.h))
  persist()
  render()
})

$('load').addEventListener('click', () => void load())
$('reloadSite').addEventListener('click', reloadSite)

// ---------------------------------------------------------------- figma token

const tokenInput = $<HTMLInputElement>('token')

async function refreshToken(): Promise<void> {
  hasToken = await window.api.hasFigmaToken()
  tokenInput.placeholder = hasToken ? 'Saved ✓ (paste to replace)' : 'figd_… (optional)'
  $('forgetToken').classList.toggle('hidden', !hasToken)
}

tokenInput.addEventListener('change', async () => {
  const value = tokenInput.value.trim()
  if (!value) return
  tokenInput.value = ''
  await window.api.setFigmaToken(value)
  await refreshToken()
  void load()
})
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tokenInput.blur()
})
$('forgetToken').addEventListener('click', async () => {
  await window.api.setFigmaToken('')
  await refreshToken()
  if (image?.pixelRatio) clearImage()
})

// ---------------------------------------------------------------- loading

function normalizeSiteUrl(input: string): string {
  const url = input.trim()
  if (!url) return ''
  return /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `http://${url}`
}

function reloadSite(): void {
  const src = siteFrame.getAttribute('src')
  if (src) siteFrame.setAttribute('src', src)
}

async function load(): Promise<void> {
  const site = normalizeSiteUrl(settings.site)
  if (site) siteFrame.setAttribute('src', site)

  const link = settings.figma.trim()
  const canRender = hasToken && parseFigmaNodeUrl(link) !== null
  if (canRender) {
    await loadFigmaImage(link)
  }
  else if (link) {
    if (image?.pixelRatio) clearImage() // drop a stale API render; keep a manually dropped image
    figmaFrame.setAttribute('src', figmaEmbedUrl(link))
    status = hasToken && !parseFigmaNodeUrl(link)
      ? { text: 'Link has no node-id, showing the embed. Copy a link to the frame for a pixel-exact render.', warn: true }
      : null
  }
  render()
}

async function loadFigmaImage(link: string): Promise<void> {
  const request = ++renderRequest
  status = { text: 'Rendering frame in Figma…' }
  render()
  const result = await window.api.renderFigmaFrame(link)
  if (request !== renderRequest) return
  if (!result.ok) {
    status = { text: `Figma: ${result.error}`, warn: true }
    render()
    return
  }
  status = { text: 'Downloading frame…' }
  render()
  setImage(result.url, result.pixelRatio, () => {
    if (request !== renderRequest) return
    status = null
    // Default the site width to the frame's width so the comparison is 1:1.
    setNumber('width', Math.round(designImg.naturalWidth / result.pixelRatio))
    persist()
  })
}

// ---------------------------------------------------------------- design image

function setImage(url: string, pixelRatio: number | null, onLoad?: () => void): void {
  if (image?.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
  image = { url, pixelRatio }
  designImg.onload = () => {
    onLoad?.()
    render()
  }
  designImg.onerror = () => {
    status = { text: 'Could not load the design image', warn: true }
    render()
  }
  designImg.src = url
}

function setImageFile(file: File | null | undefined): void {
  if (!file?.type.startsWith('image/')) return
  renderRequest++ // cancel any in-flight Figma render
  status = null
  setImage(URL.createObjectURL(file), null)
}

function clearImage(): void {
  if (image?.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
  image = null
  designImg.removeAttribute('src')
  render()
}

const fileInput = $<HTMLInputElement>('file')
$('pickImg').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  setImageFile(fileInput.files?.[0])
  fileInput.value = ''
})
$('clearImg').addEventListener('click', clearImage)

window.addEventListener('paste', (e) => {
  if ((e.target as HTMLElement).closest('input')) return
  const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
  if (item) {
    e.preventDefault()
    setImageFile(item.getAsFile())
  }
})

const drop = $('drop')
let dragDepth = 0
window.addEventListener('dragenter', (e) => {
  e.preventDefault()
  dragDepth++
  drop.classList.remove('hidden')
})
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) drop.classList.add('hidden')
})
window.addEventListener('dragover', e => e.preventDefault())
window.addEventListener('drop', (e) => {
  e.preventDefault()
  dragDepth = 0
  drop.classList.add('hidden')
  setImageFile(e.dataTransfer?.files[0])
})

// ---------------------------------------------------------------- keyboard

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return
  const modes: Record<string, Mode> = { 1: 'side', 2: 'overlay', 3: 'swipe' }
  if (modes[e.key]) {
    setMode(modes[e.key])
    return
  }
  if (e.key === 'r') {
    reloadSite()
    return
  }
  if (settings.mode === 'side') return
  const step = e.shiftKey ? 10 : 1
  const nudges: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const nudge = nudges[e.key]
  if (!nudge) return
  e.preventDefault()
  setNumber('dx', settings.dx + nudge[0])
  setNumber('dy', settings.dy + nudge[1])
  persist()
  render()
})

// ---------------------------------------------------------------- layout

const TAG_HEIGHT = 28
const SIDE_GAP = 24

function render(): void {
  const { mode } = settings
  const side = mode === 'side'
  const useImg = image !== null && designImg.naturalWidth > 0

  const siteW = Math.max(200, settings.width || 1440)
  // API renders have a known pixel ratio → true size. Dropped images → fitted to the site width.
  const designW = useImg && image?.pixelRatio ? Math.round(designImg.naturalWidth / image.pixelRatio) : siteW
  const imgH = useImg ? Math.round(designImg.naturalHeight * designW / designImg.naturalWidth) : 0
  const siteH = useImg && settings.full ? imgH : Math.max(200, settings.height || 900)
  const designH = useImg ? imgH : siteH

  const top = side ? TAG_HEIGHT : 0
  const dx = side ? 0 : settings.dx
  const dy = side ? 0 : settings.dy
  const stageW = side ? siteW + SIDE_GAP + designW : Math.max(siteW, designW + Math.max(0, dx))
  const stageH = top + Math.max(siteH, designH + Math.max(0, dy))

  // toolbar
  for (const b of $('modeSeg').children) b.classList.toggle('on', (b as HTMLElement).dataset.mode === mode)
  for (const b of $('deviceSeg').children) b.classList.toggle('on', Number((b as HTMLElement).dataset.w) === siteW)
  document.querySelectorAll('.ov').forEach(el => el.classList.toggle('hidden', side))
  document.querySelectorAll('.only-overlay').forEach(el => el.classList.toggle('hidden', mode !== 'overlay'))
  document.querySelectorAll('.only-swipe').forEach(el => el.classList.toggle('hidden', mode !== 'swipe'))
  $('opacityVal').textContent = `${settings.opacity}%`
  $('fullWrap').classList.toggle('hidden', !useImg)
  $('clearImg').classList.toggle('hidden', !image)
  $<HTMLInputElement>('height').disabled = useImg && settings.full
  renderStatus(useImg, siteW, designW)

  const hasContent = Boolean(siteFrame.getAttribute('src') || figmaFrame.getAttribute('src') || useImg)
  $('empty').classList.toggle('hidden', hasContent)

  // site layer
  Object.assign(siteFrame.style, {
    width: `${siteW}px`,
    height: `${siteH}px`,
    top: `${top}px`,
    left: '0px',
    zIndex: '1',
    pointerEvents: side || settings.interact === 'site' ? 'auto' : 'none',
  })

  // design layer
  const design = useImg ? designImg : figmaFrame
  ;(useImg ? figmaFrame : designImg).classList.add('hidden')
  design.classList.toggle('hidden', !useImg && !figmaFrame.getAttribute('src'))
  Object.assign(design.style, {
    width: `${designW}px`,
    height: useImg ? 'auto' : `${designH}px`,
    top: `${top + dy}px`,
    left: `${(side ? siteW + SIDE_GAP : 0) + dx}px`,
    zIndex: '2',
    opacity: mode === 'overlay' ? String(settings.opacity / 100) : '1',
    mixBlendMode: side ? 'normal' : settings.blend,
    clipPath: mode === 'swipe' ? `inset(0 0 0 ${(siteW * settings.swipe) / 100 - dx}px)` : 'none',
    pointerEvents: side || settings.interact === 'design' ? 'auto' : 'none',
  })

  // labels
  const tagSite = $('tagSite')
  const tagDesign = $('tagDesign')
  tagSite.classList.toggle('hidden', !side)
  tagDesign.classList.toggle('hidden', !side)
  tagSite.style.left = '0px'
  tagDesign.style.left = `${siteW + SIDE_GAP}px`
  tagSite.textContent = `Live site · ${siteW}px`
  tagDesign.textContent = useImg
    ? `Design · ${image?.pixelRatio ? 'Figma render' : 'image'} · ${designW}px`
    : 'Design · Figma embed'

  // swipe divider
  const line = $('swipeLine')
  line.classList.toggle('hidden', mode !== 'swipe')
  Object.assign(line.style, { left: `${(siteW * settings.swipe) / 100 - 1}px`, height: `${stageH}px` })

  // scale the stage
  const available = $('viewport').clientWidth - 32
  const scale = settings.zoom === 'fit' ? Math.min(1, available / stageW) : Number(settings.zoom)
  Object.assign($('stage').style, { width: `${stageW}px`, height: `${stageH}px`, transform: `scale(${scale})` })
  Object.assign($('sizer').style, { width: `${stageW * scale}px`, height: `${stageH * scale}px` })
}

function renderStatus(useImg: boolean, siteW: number, designW: number): void {
  const el = $('status')
  let text = ''
  let warn = false
  if (status) {
    ({ text, warn = false } = status)
  }
  else if (useImg && image?.pixelRatio && designW !== siteW) {
    text = `Frame is ${designW}px wide but the site is ${siteW}px. Set Width to ${designW} to compare 1:1.`
    warn = true
  }
  else if (!useImg && settings.figma.trim() && !hasToken) {
    text = 'Showing the Figma embed. Add a token for a pixel-exact render.'
  }
  el.textContent = text
  el.classList.toggle('warn', warn)
}

// ---------------------------------------------------------------- start

// Deferred to the next frame: re-scaling can toggle the viewport's scrollbar, which would
// otherwise re-trigger the observer within the same frame ("ResizeObserver loop" error).
let resizeFrame = 0
new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(render)
}).observe($('viewport'))
void refreshToken().then(() => {
  if (settings.site || settings.figma) void load()
  else render()
})
