# ReFile

Monorepo for file virtualization and cloud storage backends.

ReFile replaces large local files with lightweight pointer files (`.refile`, `.revid`, `.remusic`, `.repic`), uploading the actual data to cloud storage. Pull them back anytime with hash-verified integrity.

## Ecosystem

```
                        ReFile (monorepo)
                       /       |          \
                   CLI      Workers      Consumers
                    |      /   |   \         |
                refile   duky dukic dukbox  MemoryGuy
```

### Virtual File Extensions

| Extension | MIME Type | Upload Platform | Domain |
|-----------|-----------|----------------|--------|
| `.repic` | `image/*` | upimg-nextjs | urusai.cc |
| `.revid` | `video/*` | duky | duky.cc |
| `.remusic` | `audio/*` | dukic | dukic.cc |
| `.refile` | everything else | dukbox | dukbox.cc |

A pointer file is a small JSON that stores the hash, URL, size, and metadata of the original file:

```json
{
  "v": 1,
  "type": "refile",
  "mime": "video/mp4",
  "url": "https://duky.cc/v/a1b2c3d4e5f6g7h8/movie.mp4",
  "hash": "sha256:abcdef1234567890...",
  "size": 1073741824,
  "name": "movie.mp4",
  "createdAt": 1719000000000,
  "backend": "duky"
}
```

### Upload Platforms (duk series)

| Service | Purpose | Accepts | Fallback Chain |
|---------|---------|---------|---------------|
| **duky** | Video hosting | `video/*` + magic bytes | Pixeldrain -> Catbox |
| **dukic** | Audio hosting | `audio/*` + magic bytes | Catbox -> Pixeldrain |
| **dukbox** | General storage | all MIME types | Catbox -> Pixeldrain |

All Workers share the same HTTP API:

```
POST   /upload           Upload a file (multipart/form-data, Bearer auth)
GET    /:prefix/:id/:fn  Download / redirect
HEAD   /:prefix/:id/:fn  Check existence
GET    /:prefix/:id/meta Metadata JSON
DELETE /:prefix/:id      Delete (Bearer auth)
GET    /health           Health check
```

## Monorepo Structure

```
ReFile/
  src/                    # CLI source
    backends/             # Storage backends (http-upload, s3, duk)
    commands/             # push, pull, init, status
    config/               # Config types and loader
    core/                 # refile-format, hasher, file-meta, file-walker
    utils/                # logger, format, progress
    index.ts              # CLI entry (commander)
  workers/
    duky/                 # Video Worker (Cloudflare Workers + Hono)
    dukic/                # Audio Worker
    dukbox/               # General Worker
  package.json            # Workspaces: ["workers/*"]
```

## CLI Usage

```bash
# Initialize config
refile init

# Push files to cloud (replaces with pointer)
refile push ./videos --backend duky
refile push ./music --backend dukic
refile push ./archive --backend dukbox

# Pull files back (downloads and restores original)
refile pull ./videos

# Check status
refile status
```

## Worker Development

```bash
# Install all workspaces
npm install

# Start a worker locally
cd workers/duky
npx wrangler dev

# Set API key for local dev (create .dev.vars)
echo "API_KEY=your-dev-key" > .dev.vars

# Deploy to Cloudflare
npx wrangler deploy

# Set production secret
npx wrangler secret put API_KEY
```

## Backend Configuration

ReFile supports three backend types:

**duk** (Cloudflare Workers):
```json
{
  "defaultBackend": "duky",
  "backends": {
    "duky": {
      "type": "duk",
      "variant": "duky",
      "endpoint": "https://duky.cc",
      "apiKey": "your-api-key"
    }
  }
}
```

**http-upload** (generic HTTP):
```json
{
  "type": "http-upload",
  "endpoint": "https://example.com/upload",
  "fieldName": "file",
  "responseUrlPath": "url"
}
```

**s3** (S3-compatible):
```json
{
  "type": "s3",
  "bucket": "my-bucket",
  "region": "us-east-1",
  "accessKeyId": "...",
  "secretAccessKey": "..."
}
```

## MemoryGuy Integration

[MemoryGuy](https://github.com/jeffbai-sb/MemoryGuy) uses ReFile's core libraries to virtualize large files directly from its Disk Virtualization tab. It scans all NTFS volumes for large files and lets you push them to any configured backend, freeing disk space while keeping pointer files in place.

## Security

- Timing-safe API key authentication (via `timingSafeEqual`)
- SHA-256 hash verification on push and pull
- Magic byte validation for video/audio MIME types
- Trusted host URL validation for redirect endpoints
- No hardcoded secrets (`.dev.vars` for local, `wrangler secret` for prod)
- System path exclusion (Windows, Program Files, etc.)

## License

MIT
