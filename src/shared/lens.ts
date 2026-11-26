/**
 * Geometry of the magnifier window, in CSS pixels. The window is a transparent square holding a
 * round glass that floats straight above the cursor, so the pointer never covers what it shows.
 */
export const LENS = {
  /** Width and height of the transparent lens window (glass + rim + shadow room). */
  windowSize: 272,
  /** Centre of the glass, from the window's top-left corner (same on both axes). */
  center: 136,
  /** Radius of the visible glass. */
  radius: 110,
  /** Distance from the cursor up to the centre of the glass. */
  lift: 150,
  minZoom: 1.5,
  maxZoom: 24,
  defaultZoom: 3,
} as const

/** A captured patch of the app window, and where the glass is looking. Page CSS pixels. */
export interface LensFrame {
  /** PNG data URL of the captured area (at device resolution). */
  image: string
  x: number
  y: number
  width: number
  height: number
  /** Page point under the centre of the glass. */
  centerX: number
  centerY: number
  zoom: number
}
