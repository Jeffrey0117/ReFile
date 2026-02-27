// CF Workers hard limit: 100 MB request body
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 // 100 MB

export const ALLOWED_MIME_PREFIXES = ['video/'] as const

export const URL_PREFIX = 'v' // /v/{id}/{filename}

// Known fallback provider hostnames for redirect validation
export const TRUSTED_HOSTS = new Set([
  'files.catbox.moe',
  'litter.catbox.moe',
  'pixeldrain.com',
  'localhost',
  '127.0.0.1',
])

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
}

// Magic byte detection for video formats
export function isVideoByMagicBytes(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false
  const header = new Uint8Array(data, 0, 12)

  // MP4/MOV: ftyp at byte 4
  if (header[4] === 0x66 && header[5] === 0x74 &&
      header[6] === 0x79 && header[7] === 0x70) return true

  // WebM/MKV: EBML header 0x1A45DFA3
  if (header[0] === 0x1A && header[1] === 0x45 &&
      header[2] === 0xDF && header[3] === 0xA3) return true

  // AVI: RIFF....AVI
  if (header[0] === 0x52 && header[1] === 0x49 &&
      header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x41 && header[9] === 0x56 &&
      header[10] === 0x49) return true

  // FLV: FLV\x01
  if (header[0] === 0x46 && header[1] === 0x4C &&
      header[2] === 0x56 && header[3] === 0x01) return true

  // MPEG-TS: sync byte 0x47
  if (header[0] === 0x47) return true

  return false
}

export function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!TRUSTED_HOSTS.has(parsed.hostname)) return false
    // Allow http: only for localhost/127.0.0.1 (local dev)
    if (parsed.protocol === 'http:') {
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    }
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
