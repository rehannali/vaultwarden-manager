import { useState, useEffect } from 'react'
import { useApp } from '../App.jsx'
import * as api from '../api.js'

// ── Destination picker modal ──────────────────────────────────────────────────

function DestPicker({ onConfirm, onCancel, orgs }) {
  const [vaultId, setVaultId]     = useState('')
  const [vaultName, setVaultName] = useState('')
  const [collections, setCollections] = useState([])
  const [colId, setColId]         = useState('')
  const [colName, setColName]     = useState('')
  const [loadingCols, setLoadingCols] = useState(false)

  const pickVault = async e => {
    const val = e.target.value
    setVaultId(val)
    setColId(''); setColName(''); setCollections([])
    if (!val) { setVaultName(''); return }
    if (val === '__personal__') {
      setVaultName('Personal Vault')
    } else {
      const org = orgs.find(o => o.id === val)
      setVaultName(org?.name || '')
      setLoadingCols(true)
      const cols = await api.getCollections(val).catch(() => [])
      setCollections(cols)
      setLoadingCols(false)
    }
  }

  const pickCol = e => {
    const val = e.target.value
    setColId(val)
    setColName(collections.find(c => c.id === val)?.name || '')
  }

  const ready = vaultId && (vaultId === '__personal__' || colId)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, width: 380 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Set destination</h3>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Vault</label>
        <select value={vaultId} onChange={pickVault} style={{ marginBottom: 16 }}>
          <option value="">Select vault…</option>
          <option value="__personal__">Personal Vault</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        {vaultId && vaultId !== '__personal__' && (
          <>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Collection</label>
            <select value={colId} onChange={pickCol} disabled={loadingCols} style={{ marginBottom: 16 }}>
              <option value="">{loadingCols ? 'Loading…' : 'Select collection…'}</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}

        {ready && (
          <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 12px', marginBottom: 20, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>Moving to: </span>
            <strong>{vaultName}{colName ? ` / ${colName}` : ''}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={!ready}
            onClick={() => onConfirm({ vaultId, vaultName, collectionId: colId || null, collectionName: colName })}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssignDestinations() {
  const { state, dispatch, onSessionExpired } = useApp()
  const { basket, organizations, destinations } = state

  const [selected, setSelected]     = useState(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState(null) // 'selected' | itemId

  const toggle = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const allChecked = basket.length > 0 && basket.every(i => selected.has(i.id))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(basket.map(i => i.id)))

  const openPicker = target => {
    setPickerTarget(target)
    setPickerOpen(true)
  }

  const applyDest = dest => {
    const ids = pickerTarget === 'selected'
      ? [...selected]
      : [pickerTarget]
    dispatch({ type: 'SET_DEST_BULK', itemIds: ids, dest })
    if (pickerTarget === 'selected') setSelected(new Set())
    setPickerOpen(false)
  }

  const assigned = basket.filter(i => destinations[i.id]).length
  const allAssigned = assigned === basket.length

  const moveMethod = (srcOrgId, dstVaultId) =>
    srcOrgId && dstVaultId !== '__personal__' && srcOrgId === dstVaultId ? 'fast' : 'slow'

  const proceed = () => dispatch({ type: 'SET_STEP', step: 'progress' })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {pickerOpen && (
        <DestPicker
          orgs={organizations}
          onConfirm={applyDest}
          onCancel={() => setPickerOpen(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Assign destinations</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
            {assigned}/{basket.length} items assigned
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_STEP', step: 'search' })}>
            ← Back to search
          </button>
          {selected.size > 0 && (
            <button className="btn-ghost btn-sm" onClick={() => openPicker('selected')}>
              Set destination for {selected.size} selected
            </button>
          )}
          {basket.length > 0 && assigned < basket.length && (
            <button className="btn-ghost btn-sm" onClick={() => {
              const unassigned = basket.filter(i => !destinations[i.id]).map(i => i.id)
              setSelected(new Set(unassigned))
              setTimeout(() => openPicker('selected'), 0)
            }}>
              Assign all unset
            </button>
          )}
          <button
            className="btn-primary btn-sm"
            disabled={!allAssigned}
            onClick={proceed}
            title={!allAssigned ? 'Assign all items first' : ''}
          >
            Review & move →
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              </th>
              <th>Item</th>
              <th>From</th>
              <th>→ Destination</th>
              <th>Method</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {basket.map(item => {
              const dest = destinations[item.id]
              const method = dest ? moveMethod(item.organizationId, dest.vaultId) : null
              return (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)}
                      style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    {item.username && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.username}</div>}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {item.organizationName}<br />
                    <span style={{ fontSize: 11 }}>{item.collectionName}</span>
                  </td>
                  <td>
                    {dest ? (
                      <span style={{ color: 'var(--text)', fontSize: 13 }}>
                        {dest.vaultName}{dest.collectionName ? ` / ${dest.collectionName}` : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>Not set</span>
                    )}
                  </td>
                  <td>
                    {method === 'fast' && <span className="badge badge-green">Collection change</span>}
                    {method === 'slow' && <span className="badge badge-amber">Clone + delete</span>}
                  </td>
                  <td>
                    <button className="btn-ghost btn-sm" onClick={() => openPicker(item.id)}>
                      {dest ? 'Change' : 'Set'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
