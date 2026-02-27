export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 // 100 MB (CF Workers limit)

export const URL_PREFIX = 'f' // /f/{id}/{filename}

export const TRUSTED_HOSTS = new Set([
  'files.catbox.moe',
  'litter.catbox.moe',
  'pixeldrain.com',
  'localhost',
  '127.0.0.1',
])

// dukbox accepts all file types — no MIME restriction
export function isAllowedMime(_mime: string): boolean {
  return true
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
