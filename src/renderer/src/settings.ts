export type Mode = 'side' | 'overlay' | 'swipe'

export interface Settings {
  site: string
  figma: string
  mode: Mode
  width: number
  height: number
  /** With an image design: size the site to the image's height so the whole page scrolls together. */
  full: boolean
  zoom: 'fit' | '1' | '0.75' | '0.5'
  opacity: number
  swipe: number
  blend: 'normal' | 'difference'
  dx: number
  dy: number
  interact: 'site' | 'design'
  lensZoom: number
}

export const defaults: Settings = {
  site: 'http://localhost:3000',
  figma: '',
  mode: 'side',
  width: 1440,
  height: 900,
  full: true,
  zoom: 'fit',
  opacity: 50,
  swipe: 50,
  blend: 'normal',
  dx: 0,
  dy: 0,
  interact: 'site',
  lensZoom: 3,
}

const KEY = 'ghostframe:settings'

export function loadSettings(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  }
  catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }
  catch {}
}
