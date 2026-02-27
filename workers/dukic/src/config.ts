export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 // 100 MB (CF Workers limit)

export const ALLOWED_MIME_PREFIXES = ['audio/'] as const

export const URL_PREFIX = 'a' // /a/{id}/{filename}

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

// Magic byte detection for audio formats
export function isAudioByMagicBytes(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false
  const header = new Uint8Array(data, 0, 12)

  // MP3: ID3 tag or sync word 0xFFE0+
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) return true // ID3
  if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) return true // MPEG sync

  // FLAC: fLaC
  if (header[0] === 0x66 && header[1] === 0x4C &&
      header[2] === 0x61 && header[3] === 0x43) return true

  // OGG (Vorbis/Opus): OggS
  if (header[0] === 0x4F && header[1] === 0x67 &&
      header[2] === 0x67 && header[3] === 0x53) return true

  // WAV: RIFF....WAVE
  if (header[0] === 0x52 && header[1] === 0x49 &&
      header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x41 &&
      header[10] === 0x56 && header[11] === 0x45) return true

  // AAC ADTS: sync word 0xFFF0+
  if (header[0] === 0xFF && (header[1] & 0xF0) === 0xF0) return true

  // M4A/MP4 audio: ftyp at byte 4 (same container as video, allowed for audio)
  if (header[4] === 0x66 && header[5] === 0x74 &&
      header[6] === 0x79 && header[7] === 0x70) return true

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
