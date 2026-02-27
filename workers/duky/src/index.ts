import { Hono } from 'hono'
import { corsMiddleware } from './middleware/cors'
import { authMiddleware, type AuthEnv } from './middleware/auth'
import { createUploadRoute, type UploadEnv } from './routes/upload'
import { createServeRoute } from './routes/serve'
import { createMetaRoute } from './routes/meta'
import { createLocalServeRoute } from './routes/local-serve'

type Env = AuthEnv & UploadEnv

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', corsMiddleware)

// Public routes (no auth)
app.route('/', createServeRoute())
app.route('/', createMetaRoute())
app.route('/', createLocalServeRoute())

// Auth-protected routes
app.use('/upload', authMiddleware)
app.route('/', createUploadRoute())

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'duky', version: '0.1.0' }))

export default app
