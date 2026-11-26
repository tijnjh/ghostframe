export interface FigmaNodeRef {
  fileKey: string
  /** Node id in API form, e.g. `12:345` (links use `12-345`). */
  nodeId: string
}

const FIGMA_HOST = /(^|\.)figma\.com$/

function parseUrl(input: string): URL | null {
  try {
    return new URL(input.trim())
  } catch {
    return null
  }
}

/** Extracts the file key and node id from a design, file, proto or branch link. */
export function parseFigmaNodeUrl(input: string): FigmaNodeRef | null {
  const url = parseUrl(input)
  if (!url || !FIGMA_HOST.test(url.hostname)) return null
  const match = url.pathname.match(/^\/(?:design|file|proto)\/([^/]+)(?:\/branch\/([^/]+))?/)
  const node = url.searchParams.get('node-id') ?? url.searchParams.get('starting-point-node-id')
  if (!match || !node) return null
  return { fileKey: match[2] ?? match[1], nodeId: node.replace(/-/g, ':') }
}

/** Turns a regular Figma link into an Embed Kit 2 URL with Figma's UI hidden. */
export function figmaEmbedUrl(input: string): string {
  const url = parseUrl(input)
  if (!url || !FIGMA_HOST.test(url.hostname)) return input.trim()
  if (url.hostname === 'embed.figma.com' || url.pathname.startsWith('/embed')) return url.toString()
  url.hostname = 'embed.figma.com'
  const params: Record<string, string> = {
    'embed-host': 'share',
    'hide-ui': '1',
    'footer': 'false',
    'scaling': 'scale-down-width',
    'content-scaling': 'fixed',
  }
  for (const [key, value] of Object.entries(params)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value)
  }
  return url.toString()
}
