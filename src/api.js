const call = async (path, opts = {}) => {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined
  })
  if (res.status === 401) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error || 'Session expired'), { code: 'AUTH' })
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const getStatus      = ()    => call('/api/auth/status')
export const unlock         = (pwd) => call('/api/auth/unlock', { method: 'POST', body: { password: pwd } })
export const lock           = ()    => call('/api/auth/lock', { method: 'POST' })
export const search         = (q)   => call(`/api/search?q=${encodeURIComponent(q)}`)
export const getOrgs        = ()    => call('/api/organizations')
export const getCollections = (id)  => call(`/api/collections/${id}`)
export const moveItems      = (moves) => call('/api/move', { method: 'POST', body: { moves } })
