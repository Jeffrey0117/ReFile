import { Hono } from 'hono'
import type { UploadEnv } from './upload'

export function createLocalServeRoute() {
  const app = new Hono<{ Bindings: UploadEnv }>()

  // GET /local/:id/:filename — serve file from KV (local dev only)
  app.get('/local/:id/:filename', async (c) => {
    const id = c.req.param('id')
    const data = await c.env.FILE_STORE.get(`blob:${id}`, 'arrayBuffer')

    if (!data) {
      return c.json({ error: 'File not found in local store' }, 404)
    }

    const filename = decodeURIComponent(c.req.param('filename'))
    c.header('Content-Type', 'application/octet-stream')
    c.header('Content-Disposition', `attachment; filename="${filename}"`)
    c.header('Content-Length', String(data.byteLength))

    return c.body(data)
  })

  return app
}
