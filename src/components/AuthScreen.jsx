import { useState } from 'react'
import { useApp } from '../App.jsx'
import * as api from '../api.js'

export default function AuthScreen() {
  const { dispatch } = useApp()
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const submit = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.unlock(password)
      const status = await api.getStatus()
      dispatch({ type: 'SET_AUTH', email: status.email })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div style={{ width: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Vault Manager</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
          Enter your master password to unlock the vault.
        </p>
        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            Master password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoFocus
            required
            style={{ marginBottom: 16 }}
          />
          {error && (
            <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button className="btn-primary" type="submit" disabled={loading || !password} style={{ width: '100%' }}>
            {loading ? 'Unlocking…' : 'Unlock vault'}
          </button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 20, lineHeight: 1.6 }}>
          Your master password never leaves this server. The vault session is stored in server memory and expires after 8 hours.
        </p>
      </div>
    </div>
  )
}
