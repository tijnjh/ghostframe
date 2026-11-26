import type { LensFrame } from './lens'

export type RenderFrameResult =
  | { ok: true, url: string, pixelRatio: number }
  | { ok: false, error: string }

/** Bridge exposed to the renderer as `window.api` by the preload script. */
export interface DesignCompareApi {
  hasFigmaToken: () => Promise<boolean>
  /** Saves the token (encrypted when the OS supports it); an empty string forgets it. */
  setFigmaToken: (token: string) => Promise<void>
  /** Renders the frame a Figma link points at to a PNG via the Figma REST API. */
  renderFigmaFrame: (link: string) => Promise<RenderFrameResult>
  lens: {
    /** App window: the magnifier was picked up at this client position. */
    start: (x: number, y: number, zoom: number) => void
    move: (x: number, y: number) => void
    setZoom: (zoom: number) => void
    end: () => void
    /** Lens window: receives a frame to draw; `null` means nothing is under the glass. */
    onFrame: (callback: (frame: LensFrame | null) => void) => void
  }
}
