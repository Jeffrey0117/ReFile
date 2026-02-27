import type { FallbackProvider, FallbackUploadResult } from './chain'

const MAX_SIZE = 100 * 1024 * 1024 // 100 MB

export function createLocalKvProvider(kv: KVNamespace, baseUrl: string): FallbackProvider {
  return {
    name: 'local-kv',
    maxSize: MAX_SIZE,

    async upload(data: ArrayBuffer, filename: string, _mime: string): Promise<FallbackUploadResult> {
      const hashBuf = await crypto.subtle.digest('SHA-256', data)
      const id = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16)

      await kv.put(`blob:${id}`, data)

      const cleanBase = baseUrl.replace(/\/$/, '')
      const url = `${cleanBase}/local/${id}/${encodeURIComponent(filename)}`

      return { url, provider: 'local-kv' }
    },
  }
}
