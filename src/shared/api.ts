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
}
