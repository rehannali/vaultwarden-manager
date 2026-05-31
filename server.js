import express from 'express'
import session from 'express-session'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 8 * 60 * 60 * 1000 }
}))

// ── bw helpers ────────────────────────────────────────────────────────────────

const bwEnv = (bwSession, extra = {}) => ({
  ...process.env,
  ...(bwSession ? { BW_SESSION: bwSession } : {}),
  ...extra
})

const bwRun = (args, bwSession, extra = {}) =>
  execAsync(`bw ${args}`, {
    env: bwEnv(bwSession, extra),
    maxBuffer: 20 * 1024 * 1024
  }).then(r => r.stdout.trim())

const bwPipe = (args, stdin, bwSession) =>
  new Promise((resolve, reject) => {
    const proc = spawn('bw', args.split(' '), { env: bwEnv(bwSession) })
    let out = '', err = ''
    proc.stdout.on('data', d => out += d)
    proc.stderr.on('data', d => err += d)
    proc.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `exit ${code}`)))
    proc.stdin.write(stdin)
    proc.stdin.end()
  })

const bwJson = async (args, bwSession) => {
  const raw = await bwRun(args, bwSession)
  return JSON.parse(raw || 'null')
}

// ── Auth middleware ────────────────────────────────────────────────────────────

const requireAuth = (req, res, next) => {
  if (!req.session.bwSession) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

const handleBwError = (res, err, req) => {
  const msg = err.message || String(err)
  if (msg.includes('Session key is invalid') || msg.includes('You are not logged in')) {
    req.session.bwSession = null
    return res.status(401).json({ error: 'Session expired. Please unlock again.' })
  }
  console.error('bw error:', msg)
  res.status(500).json({ error: msg })
}

// ── Auth endpoints ─────────────────────────────────────────────────────────────

app.get('/api/auth/status', async (req, res) => {
  if (!req.session.bwSession) return res.json({ authenticated: false })
  try {
    const status = await bwJson('status', req.session.bwSession)
    if (status?.status === 'unlocked') return res.json({ authenticated: true, email: status.userEmail })
    req.session.bwSession = null
    res.json({ authenticated: false })
  } catch {
    req.session.bwSession = null
    res.json({ authenticated: false })
  }
})

app.post('/api/auth/unlock', async (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Password required' })
  try {
    const token = await bwRun('unlock --passwordenv VAULT_PASS --raw', null, { VAULT_PASS: password })
    req.session.bwSession = token
    res.json({ ok: true })
  } catch (err) {
    const msg = err.message || ''
    if (msg.includes('Invalid master password') || msg.includes('error')) {
      return res.status(401).json({ error: 'Invalid master password' })
    }
    handleBwError(res, err, req)
  }
})

app.post('/api/auth/lock', requireAuth, (req, res) => {
  req.session.bwSession = null
  res.json({ ok: true })
})

// ── Search ─────────────────────────────────────────────────────────────────────

app.get('/api/search', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q?.trim()) return res.status(400).json({ error: 'Search term required' })
  try {
    await bwRun('sync --quiet', req.session.bwSession)
    const items = await bwJson(`list items --search "${q.replace(/"/g, '\\"')}"`, req.session.bwSession) || []
    if (!items.length) return res.json([])

    const orgs = await bwJson('list organizations', req.session.bwSession) || []
    const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]))

    const orgIds = [...new Set(items.map(i => i.organizationId).filter(Boolean))]
    const collMap = {}
    for (const oid of orgIds) {
      const cols = await bwJson(`list collections --organizationid ${oid}`, req.session.bwSession) || []
      for (const c of cols) collMap[c.id] = c.name
    }

    const result = items.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      username: i.login?.username ?? null,
      uri: i.login?.uris?.[0]?.uri ?? null,
      organizationId: i.organizationId ?? null,
      organizationName: i.organizationId ? (orgMap[i.organizationId] ?? 'Unknown Org') : 'Personal Vault',
      collectionIds: i.collectionIds ?? [],
      collectionName: i.collectionIds?.[0] ? (collMap[i.collectionIds[0]] ?? '—') : '—'
    }))
    res.json(result)
  } catch (err) { handleBwError(res, err, req) }
})

// ── Vault structure ────────────────────────────────────────────────────────────

app.get('/api/organizations', requireAuth, async (req, res) => {
  try {
    const orgs = await bwJson('list organizations', req.session.bwSession) || []
    res.json(orgs.map(o => ({ id: o.id, name: o.name })))
  } catch (err) { handleBwError(res, err, req) }
})

app.get('/api/collections/:orgId', requireAuth, async (req, res) => {
  try {
    const cols = await bwJson(`list collections --organizationid ${req.params.orgId}`, req.session.bwSession) || []
    res.json(cols.map(c => ({ id: c.id, name: c.name })))
  } catch (err) { handleBwError(res, err, req) }
})

// ── Move ───────────────────────────────────────────────────────────────────────

app.post('/api/move', requireAuth, async (req, res) => {
  const { moves } = req.body
  if (!Array.isArray(moves) || !moves.length) return res.status(400).json({ error: 'moves[] required' })

  const results = []
  for (const move of moves) {
    const { itemId, srcOrgId, dstOrgId, dstCollectionId } = move
    try {
      // Fast path: same org, just update collection assignment
      if (srcOrgId && dstOrgId && srcOrgId === dstOrgId) {
        const encoded = Buffer.from(JSON.stringify([dstCollectionId])).toString('base64')
        await bwPipe(`edit item-collections ${itemId}`, encoded, req.session.bwSession)
        results.push({ itemId, ok: true, method: 'fast' })
        continue
      }

      // Slow path: re-encrypt under destination key (clone + delete)
      const item = await bwJson(`get item ${itemId}`, req.session.bwSession)
      delete item.id
      delete item.revisionDate
      delete item.creationDate
      delete item.deletedDate

      if (!dstOrgId) {
        delete item.organizationId
        item.collectionIds = []
        item.folderId = null
      } else {
        item.organizationId = dstOrgId
        item.collectionIds = [dstCollectionId]
      }

      const encoded = Buffer.from(JSON.stringify(item)).toString('base64')
      await bwPipe('create item', encoded, req.session.bwSession)

      const deleteArgs = srcOrgId
        ? `delete item ${itemId} --organizationid ${srcOrgId}`
        : `delete item ${itemId}`
      await bwRun(deleteArgs, req.session.bwSession)

      results.push({ itemId, ok: true, method: 'slow' })
    } catch (err) {
      const msg = err.message || String(err)
      if (msg.includes('Session key is invalid')) {
        req.session.bwSession = null
        return res.status(401).json({ error: 'Session expired mid-move.' })
      }
      results.push({ itemId, ok: false, error: msg })
    }
  }
  res.json({ results })
})

// ── Static files (production) ─────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'))
    }
  })
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`bw-manager running on :${PORT}`))
