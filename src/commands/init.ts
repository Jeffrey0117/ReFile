import type { Command } from 'commander'
import { loadConfig, saveConfig, getConfigPath } from '../config/config.js'
import type { RefileConfig, HttpUploadConfig, S3Config, SelfHostedConfig } from '../config/types.js'
import { log } from '../utils/logger.js'

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const readline = await import('node:readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const suffix = defaultValue ? ` (${defaultValue})` : ''
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${question}${suffix}: `, resolve)
  })
  rl.close()
  return answer.trim() || defaultValue || ''
}

async function choose(question: string, options: string[]): Promise<number> {
  console.log(`\n${question}`)
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}) ${options[i]}`)
  }
  const answer = await prompt('Choice', '1')
  const idx = parseInt(answer, 10) - 1
  return idx >= 0 && idx < options.length ? idx : 0
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Configure storage backend')
    .action(async () => {
      log.info('refile setup\n')

      const existing = loadConfig()

      const backendIdx = await choose('Choose storage backend:', [
        'Self-hosted (refile-server)',
        'HTTP Upload (urusai.cc compatible)',
        'S3-compatible (MinIO / AWS S3 / Cloudflare R2)',
      ])

      let config: RefileConfig

      if (backendIdx === 0) {
        const endpoint = await prompt('Server URL', 'http://localhost:3900')
        const apiKey = await prompt('API key (leave blank if none)', '')

        const selfHostedConfig: SelfHostedConfig = {
          type: 'self-hosted',
          endpoint,
          apiKey,
        }

        config = {
          defaultBackend: 'self-hosted',
          backends: {
            ...existing?.backends,
            'self-hosted': selfHostedConfig,
          },
        }
      } else if (backendIdx === 1) {
        const endpoint = await prompt('Upload endpoint', 'https://api.urusai.cc/v1/upload')
        const fieldName = await prompt('Form field name', 'file')
        const responseUrlPath = await prompt('Response URL path (dot-notation)', 'data.url_direct')

        const httpConfig: HttpUploadConfig = {
          type: 'http-upload',
          endpoint,
          fieldName,
          responseUrlPath,
        }

        config = {
          defaultBackend: 'http-upload',
          backends: {
            ...existing?.backends,
            'http-upload': httpConfig,
          },
        }
      } else {
        const endpoint = await prompt('S3 endpoint (leave blank for AWS)', '')
        const bucket = await prompt('Bucket name', 'refile')
        const region = await prompt('Region', 'us-east-1')
        const accessKeyId = await prompt('Access Key ID')
        const secretAccessKey = await prompt('Secret Access Key')
        const prefix = await prompt('Key prefix', 'refile/')
        const publicUrlBase = await prompt('Public URL base (optional)', '')

        const s3Config: S3Config = {
          type: 's3',
          bucket,
          region,
          accessKeyId,
          secretAccessKey,
          ...(endpoint ? { endpoint } : {}),
          ...(prefix ? { prefix } : {}),
          ...(publicUrlBase ? { publicUrlBase } : {}),
        }

        config = {
          defaultBackend: 's3',
          backends: {
            ...existing?.backends,
            's3': s3Config,
          },
        }
      }

      saveConfig(config)
      log.success(`Config saved to ${getConfigPath()}`)
    })
}
