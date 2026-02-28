import type { StorageBackend } from './types.js'
import type { BackendConfig } from '../config/types.js'
import { HttpUploadBackend } from './http-upload.js'
import { S3Backend } from './s3.js'
import { DukBackend } from './duk.js'
import { SelfHostedBackend } from './self-hosted.js'

export function createBackend(config: BackendConfig): StorageBackend {
  switch (config.type) {
    case 'http-upload':
      return new HttpUploadBackend(config)
    case 's3':
      return new S3Backend(config)
    case 'duk':
      return new DukBackend(config)
    case 'self-hosted':
      return new SelfHostedBackend(config)
    default:
      throw new Error(`Unknown backend type: ${(config as { type: string }).type}`)
  }
}
