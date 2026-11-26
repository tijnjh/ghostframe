import { net } from 'electron'
import type { FigmaNodeRef } from '../shared/figma-url'

/** Frames are rendered at 2x so they stay sharp; the renderer divides by this to get CSS pixels. */
export const RENDER_PIXEL_RATIO = 2

interface ImagesResponse {
  err?: string | null
  message?: string
  images?: Record<string, string | null>
}

/** Asks the Figma REST API to render a single node to PNG and returns the (temporary) image URL. */
export async function renderFrame(ref: FigmaNodeRef, token: string): Promise<string> {
  const endpoint = new URL(`https://api.figma.com/v1/images/${encodeURIComponent(ref.fileKey)}`)
  endpoint.searchParams.set('ids', ref.nodeId)
  endpoint.searchParams.set('format', 'png')
  endpoint.searchParams.set('scale', String(RENDER_PIXEL_RATIO))

  const res = await net.fetch(endpoint.toString(), { headers: { 'X-Figma-Token': token } })
  const body = (await res.json().catch(() => ({}))) as ImagesResponse
  if (!res.ok || body.err) {
    if (res.status === 403) throw new Error('Figma rejected the token (invalid, expired, or no access to this file)')
    if (res.status === 404) throw new Error('File not found — check the link and that the token can access it')
    throw new Error(body.err || body.message || `Figma API returned HTTP ${res.status}`)
  }
  const url = body.images?.[ref.nodeId]
  if (!url) throw new Error('Frame not found — check the node-id in the link')
  return url
}
