import fs from 'node:fs'
import path from 'node:path'
import mime from 'mime-types'
import type { Command } from 'commander'
import { loadConfig } from '../config/config.js'
import { createBackend } from '../backends/registry.js'
import { hashFile } from '../core/hasher.js'
import { createRefilePointer, writeRefilePointer, isRefilePath, getRefilePath } from '../core/refile-format.js'
import { walkFiles } from '../core/file-walker.js'
import { getFileMeta } from '../core/file-meta.js'
import { log } from '../utils/logger.js'
import { formatBytes } from '../utils/format.js'
import { createSpinner } from '../utils/progress.js'

export function registerPushCommand(program: Command): void {
  program
    .command('push <path>')
    .description('Upload files and replace with .refile pointers')
    .option('--dry-run', 'Show what would happen without doing it')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-r, --recursive', 'Recurse into directories', true)
    .option('--backend <name>', 'Override default backend')
    .action(async (targetPath: string, options: { dryRun?: boolean; yes?: boolean; recursive?: boolean; backend?: string }) => {
      const config = loadConfig()
      if (!config) {
        log.error('No config found. Run "refile init" first.')
        process.exit(1)
      }

      const backendName = options.backend ?? config.defaultBackend
      const backendConfig = config.backends[backendName]
      if (!backendConfig) {
        log.error(`Backend "${backendName}" not configured. Run "refile init".`)
        process.exit(1)
      }

      const backend = createBackend(backendConfig)
      const resolved = path.resolve(targetPath)

      // Collect files
      const allFiles = walkFiles(resolved, { recursive: options.recursive })
      const files = allFiles.filter((f) => !isRefilePath(f))

      if (files.length === 0) {
        log.warn('No files to push.')
        return
      }

      const totalSize = files.reduce((sum, f) => {
        try { return sum + fs.statSync(f).size } catch { return sum }
      }, 0)

      log.info(`Found ${files.length} files (${formatBytes(totalSize)})`)

      if (options.dryRun) {
        for (const f of files) {
          const size = fs.statSync(f).size
          log.dim(`  ${path.relative(process.cwd(), f)}  (${formatBytes(size)})`)
        }
        log.info('Dry run — no files were uploaded.')
        return
      }

      if (!options.yes) {
        const readline = await import('node:readline')
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        const answer = await new Promise<string>((resolve) => {
          rl.question(`Push ${files.length} files (${formatBytes(totalSize)})? [y/N] `, resolve)
        })
        rl.close()
        if (answer.toLowerCase() !== 'y') {
          log.info('Cancelled.')
          return
        }
      }

      let pushed = 0
      let failed = 0
      let freedBytes = 0

      for (const filePath of files) {
        const relPath = path.relative(process.cwd(), filePath)
        const spinner = createSpinner(`Pushing ${relPath}`)
        spinner.start()

        try {
          const buffer = fs.readFileSync(filePath)
          const hash = await hashFile(filePath)
          const meta = getFileMeta(filePath)
          const filename = path.basename(filePath)
          const mimeType = mime.lookup(filePath) || 'application/octet-stream'

          const result = await backend.upload(buffer, filename, mimeType)

          const pointer = createRefilePointer({
            mime: mimeType,
            url: result.url,
            hash,
            size: buffer.length,
            name: filename,
            backend: backend.name,
            meta: { mode: meta.mode, mtime: meta.mtime, atime: meta.atime },
          })

          const refilePath = getRefilePath(filePath, mimeType)
          writeRefilePointer(refilePath, pointer)

          // Verify pointer was written before deleting original
          if (fs.existsSync(refilePath)) {
            fs.unlinkSync(filePath)
            freedBytes += buffer.length
            pushed++
            spinner.succeed(`${relPath} → ${formatBytes(buffer.length)} freed`)
          } else {
            throw new Error('Failed to write .refile pointer')
          }
        } catch (err) {
          failed++
          spinner.fail(`${relPath} — ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      console.log('')
      log.success(`Pushed: ${pushed}  Failed: ${failed}  Freed: ${formatBytes(freedBytes)}`)
    })
}
