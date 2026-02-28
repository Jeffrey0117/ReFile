import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import { FileStorage } from './storage.js'
import type { Request, Response, NextFunction } from 'express'

const PORT = parseInt(process.env.PORT || '3900', 10)
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const API_KEY = process.env.API_KEY || ''
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`

const storage = new FileStorage(DATA_DIR)

const upload = multer({
  dest: path.join(DATA_DIR, 'tmp'),
  limits: { fileSize: 500 * 1024 * 1024 },
})

const app = express()
app.use(cors())

function authGuard(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) { next(); return }
  const header = req.headers.authorization
  if (header === `Bearer ${API_KEY}`) { next(); return }
  res.status(401).json({ error: 'Unauthorized' })
}

// Upload
app.post('/upload', authGuard, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Missing "file" field' })
    return
  }

  try {
    const { hash, shortHash, size } = await storage.store(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
    )

    const url = `${BASE_URL}/f/${shortHash}/${encodeURIComponent(req.file.originalname)}`

    res.json({
      url,
      id: shortHash,
      hash: `sha256:${hash}`,
      size,
      mime: req.file.mimetype,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

// Serve
app.get('/f/:hash/:filename', (req: Request, res: Response) => {
  const result = storage.resolve(req.params.hash)
  if (!result) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  res.setHeader('Content-Type', result.meta.mime)
  res.setHeader('Content-Length', String(result.meta.size))
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(result.meta.filename)}"`,
  )
  res.sendFile(path.resolve(result.filePath))
})

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'refile-server' })
})

app.listen(PORT, () => {
  process.stdout.write(`refile-server listening on :${PORT}\n`)
  process.stdout.write(`  Data: ${DATA_DIR}\n`)
  process.stdout.write(`  Base URL: ${BASE_URL}\n`)
})
