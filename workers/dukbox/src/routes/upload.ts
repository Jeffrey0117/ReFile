import { Hono } from 'hono'
import { sha256, sha256Short } from '../lib/hash'
import { isAllowedMime, MAX_UPLOAD_BYTES, URL_PREFIX, isTrustedUrl } from '../config'
import { runFallbackChain, type FallbackProvider } from '../fallback/chain'
import { catboxProvider } from '../fallback/catbox'
import { createPixeldrainProvider } from '../fallback/pixeldrain'
import { createLocalKvProvider } from '../fallback/local-kv'

export interface UploadEnv {
  API_KEY: string
  PIXELDRAIN_KEY?: string
  FILE_STORE: KVNamespace
}

interface FileRecord {
  readonly id: string
  readonly hash: string
  readonly size: number
  readonly mime: string
  readonly filename: string
  readonly url: string
  readonly provider: string
  readonly uploadedAt: number
}

export async function getFileRecord(kv: KVNamespace, id: string): Promise<FileRecord | null> {
  return kv.get<FileRecord>(id, 'json')
}

export function createUploadRoute() {
  const app = new Hono<{ Bindings: UploadEnv }>()

  app.post('/upload', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!(file instanceof File)) {
      return c.json({ error: 'Missing "file" field in multipart body' }, 400)
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ error: `File too large: ${file.size} bytes (max ${MAX_UPLOAD_BYTES})` }, 413)
    }

    const mime = file.type || 'application/octet-stream'

    if (!isAllowedMime(mime)) {
      return c.json({ error: `MIME type not allowed: ${mime}` }, 415)
    }

    const data = await file.arrayBuffer()
    const hash = await sha256(data)
    const shortHash = sha256Short(hash)
    const id = `${URL_PREFIX}/${shortHash}`

    const existing = await getFileRecord(c.env.FILE_STORE, id)
    if (existing) {
      if (existing.hash === hash) {
        return c.json({
          url: existing.url,
          id,
          hash: `sha256:${hash}`,
          size: existing.size,
          mime: existing.mime,
          deduplicated: true,
        })
      }
      return c.json({ error: 'Hash collision detected. Please try again or contact support.' }, 409)
    }

    // Fallback chain: Catbox (≤200MB, permanent) → Pixeldrain → Local KV (dev fallback)
    const baseUrl = new URL(c.req.url).origin
    const providers: FallbackProvider[] = [
      catboxProvider,
      createPixeldrainProvider({ apiKey: c.env.PIXELDRAIN_KEY }),
      createLocalKvProvider(c.env.FILE_STORE, baseUrl),
    ]

    let result
    try {
      result = await runFallbackChain(providers, data, file.name, mime)
    } catch {
      return c.json({ error: 'Upload failed. Please try again later.' }, 502)
    }

    if (!isTrustedUrl(result.url)) {
      return c.json({ error: 'Upload provider returned an untrusted URL' }, 502)
    }

    const record: FileRecord = {
      id,
      hash,
      size: file.size,
      mime,
      filename: file.name,
      url: result.url,
      provider: result.provider,
      uploadedAt: Date.now(),
    }

    await c.env.FILE_STORE.put(id, JSON.stringify(record))

    return c.json({
      url: result.url,
      id,
      hash: `sha256:${hash}`,
      size: file.size,
      mime,
    })
  })

  return app
}
