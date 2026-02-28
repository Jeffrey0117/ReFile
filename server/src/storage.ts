import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface FileMeta {
  readonly hash: string
  readonly filename: string
  readonly mime: string
  readonly size: number
  readonly uploadedAt: number
}

export class FileStorage {
  private readonly filesDir: string
  private readonly metaDir: string
  private readonly index: Map<string, string> = new Map()

  constructor(dataDir: string) {
    this.filesDir = path.join(dataDir, 'files')
    this.metaDir = path.join(dataDir, 'meta')
    fs.mkdirSync(this.filesDir, { recursive: true })
    fs.mkdirSync(this.metaDir, { recursive: true })
    this.rebuildIndex()
  }

  private rebuildIndex(): void {
    const files = fs.readdirSync(this.metaDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const hash = file.replace('.json', '')
      this.index.set(hash.slice(0, 12), hash)
    }
  }

  async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  async store(
    tmpPath: string,
    filename: string,
    mime: string,
  ): Promise<{ hash: string; shortHash: string; size: number }> {
    const hash = await this.hashFile(tmpPath)
    const shortHash = hash.slice(0, 12)
    const ext = path.extname(filename)
    const destPath = path.join(this.filesDir, `${hash}${ext}`)

    if (!fs.existsSync(destPath)) {
      try {
        fs.renameSync(tmpPath, destPath)
      } catch {
        fs.copyFileSync(tmpPath, destPath)
        fs.unlinkSync(tmpPath)
      }
    } else {
      fs.unlinkSync(tmpPath)
    }

    const size = fs.statSync(destPath).size

    const meta: FileMeta = {
      hash,
      filename,
      mime,
      size,
      uploadedAt: Date.now(),
    }

    fs.writeFileSync(
      path.join(this.metaDir, `${hash}.json`),
      JSON.stringify(meta, null, 2),
    )

    this.index.set(shortHash, hash)

    return { hash, shortHash, size }
  }

  resolve(shortHash: string): { filePath: string; meta: FileMeta } | null {
    const fullHash = this.index.get(shortHash)
    if (!fullHash) return null

    const metaPath = path.join(this.metaDir, `${fullHash}.json`)
    if (!fs.existsSync(metaPath)) return null

    const meta: FileMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    const ext = path.extname(meta.filename)
    const filePath = path.join(this.filesDir, `${fullHash}${ext}`)

    if (!fs.existsSync(filePath)) return null

    return { filePath, meta }
  }
}
