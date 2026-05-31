import { useState, useEffect } from 'react'
import { useApp } from '../App.jsx'
import * as api from '../api.js'

export default function ProgressView() {
  const { state, dispatch, onSessionExpired } = useApp()
  const { basket, destinations, moveResults } = state
  const isDone = state.step === 'done'

  const [running, setRunning]     = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [progress, setProgress]   = useState([])

  const moves = basket.map(item => {
    const dest = destinations[item.id]
    return {
      itemId: item.id,
      itemName: item.name,
      srcOrgId: item.organizationId || null,
      srcLabel: item.organizationName + (item.collectionName !== '—' ? ` / ${item.collectionName}` : ''),
      dstOrgId: dest?.vaultId === '__personal__' ? null : (dest?.vaultId || null),
      dstCollectionId: dest?.collectionId || null,
      dstLabel: dest ? (dest.vaultName + (dest.collectionName ? ` / ${dest.collectionName}` : '')) : '?',
      method: dest?.vaultId && item.organizationId && item.organizationId === dest.vaultId ? 'fast' : 'slow'
    }
  })

  const hasSlow = moves.some(m => m.method === 'slow')

  const execute = async () => {
    setRunning(true)
    const results = []
    setProgress([])

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      setProgress(prev => [...prev, { ...m, status: 'running' }])
      try {
        const res = await api.moveItems([{
          itemId: m.itemId,
          srcOrgId: m.srcOrgId,
          dstOrgId: m.dstOrgId,
          dstCollectionId: m.dstCollectionId
        }])
        const r = res.results[0]
        results.push(r)
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: r.ok ? 'ok' : 'error', error: r.error } : p))
      } catch (err) {
        if (err.code === 'AUTH') { onSessionExpired(); return }
        results.push({ itemId: m.itemId, ok: false, error: err.message })
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', error: err.message } : p))
      }
    }

    dispatch({ type: 'SET_RESULTS', results })
    setRunning(false)
  }

  const ok    = isDone ? moveResults.filter(r => r.ok).length : 0
  const fail  = isDone ? moveResults.filter(r => !r.ok).length : 0

  if (isDone) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          {fail === 0 ? (
            <div style={{ background: 'var(--green-dim)', color: 'var(--green)', padding: '12px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
              ✓ All {ok} items moved successfully.
            </div>
          ) : (
            <div style={{ background: 'var(--amber-dim)', color: 'var(--amber)', padding: '12px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
              {ok} succeeded · {fail} failed — failed items were not deleted from source.
            </div>
          )}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          <table>
            <thead><tr><th>Item</th><th>Moved to</th><th>Status</th></tr></thead>
            <tbody>
              {progress.map((m, i) => (
                <tr key={m.itemId}>
                  <td style={{ fontWeight: 500 }}>{m.itemName}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{m.dstLabel}</td>
                  <td>
                    {m.status === 'ok'    && <span className="badge badge-green">✓ moved</span>}
                    {m.status === 'error' && <span className="badge badge-red" title={m.error}>✗ failed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={() => dispatch({ type: 'RESET' })}>Start new session</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Review & move</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{moves.length} item{moves.length !== 1 ? 's' : ''} to move</p>
        </div>
        {!running && (
          <button className="btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_STEP', step: 'assign' })}>
            ← Back
          </button>
        )}
      </div>

      {hasSlow && !confirmed && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          <strong style={{ color: 'var(--amber)' }}>Note:</strong>
          <span style={{ color: 'var(--text)', marginLeft: 6 }}>
            Some items cross vault boundaries and will be re-encrypted (clone + delete). This is safe — originals are only deleted after a successful copy.
          </span>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <table>
          <thead><tr><th>Item</th><th>From</th><th>→ To</th><th>Method</th>{running && <th>Status</th>}</tr></thead>
          <tbody>
            {moves.map((m, i) => {
              const prog = progress[i]
              return (
                <tr key={m.itemId}>
                  <td style={{ fontWeight: 500 }}>{m.itemName}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{m.srcLabel}</td>
                  <td style={{ fontSize: 13 }}>{m.dstLabel}</td>
                  <td>
                    {m.method === 'fast' && <span className="badge badge-green">Collection change</span>}
                    {m.method === 'slow' && <span className="badge badge-amber">Clone + delete</span>}
                  </td>
                  {running && (
                    <td>
                      {!prog             && <span style={{ color: 'var(--muted)' }}>—</span>}
                      {prog?.status === 'running' && <span style={{ color: 'var(--amber)' }}>…</span>}
                      {prog?.status === 'ok'      && <span className="badge badge-green">✓</span>}
                      {prog?.status === 'error'   && <span className="badge badge-red" title={prog.error}>✗</span>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!running && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {hasSlow && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              I understand clone + delete items will be re-encrypted
            </label>
          )}
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto' }}
            disabled={hasSlow && !confirmed}
            onClick={execute}
          >
            Move {moves.length} item{moves.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {running && (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Moving items… do not close this page.</p>
      )}
    </div>
  )
}
