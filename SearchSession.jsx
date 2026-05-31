import { useState } from 'react'
import { useApp } from '../App.jsx'
import * as api from '../api.js'

export default function SearchSession() {
  const { state, dispatch, onSessionExpired } = useApp()
  const [term, setTerm]         = useState('')
  const [results, setResults]   = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [searched, setSearched] = useState(false)

  const basketIds = new Set(state.basket.map(i => i.id))

  const doSearch = async e => {
    e.preventDefault()
    if (!term.trim()) return
    setLoading(true)
    setError(null)
    setSelected(new Set())
    try {
      const items = await api.search(term.trim())
      setResults(items)
      setSearched(true)
    } catch (err) {
      if (err.code === 'AUTH') return onSessionExpired()
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = id => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const nonBasket = results.filter(i => !basketIds.has(i.id)).map(i => i.id)
    setSelected(prev => prev.size === nonBasket.length ? new Set() : new Set(nonBasket))
  }

  const addToBasket = () => {
    const toAdd = results.filter(i => selected.has(i.id))
    dispatch({ type: 'ADD_TO_BASKET', items: toAdd })
    setSelected(new Set())
  }

  const nonBasketResults = results.filter(i => !basketIds.has(i.id))
  const allSelected = nonBasketResults.length > 0 && nonBasketResults.every(i => selected.has(i.id))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

      {/* Left: search + results */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Search vault</h2>
        <form onSubmit={doSearch} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Search across all vaults and collections…"
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={loading || !term.trim()} style={{ whiteSpace: 'nowrap', width: 'auto' }}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {searched && results.length === 0 && !loading && (
          <p style={{ color: 'var(--muted)' }}>No items found for "{term}".</p>
        )}

        {results.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                {results.length} result{results.length !== 1 ? 's' : ''}
                {basketIds.size > 0 && results.some(i => basketIds.has(i.id)) && (
                  <span style={{ marginLeft: 8, color: 'var(--accent)' }}>
                    ({results.filter(i => basketIds.has(i.id)).length} already in basket)
                  </span>
                )}
              </span>
              {selected.size > 0 && (
                <button className="btn-primary btn-sm" onClick={addToBasket}>
                  Add {selected.size} to basket
                </button>
              )}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" checked={allSelected} onChange={selectAll} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                    </th>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Vault</th>
                    <th>Collection</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(item => {
                    const inBasket = basketIds.has(item.id)
                    return (
                      <tr key={item.id} style={{ opacity: inBasket ? 0.45 : 1 }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => !inBasket && toggleSelect(item.id)}
                            disabled={inBasket}
                            style={{ width: 'auto', accentColor: 'var(--accent)' }}
                          />
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                          {inBasket && <span className="badge badge-purple" style={{ marginLeft: 8 }}>in basket</span>}
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{item.username || '—'}</td>
                        <td>
                          <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                            {item.organizationName}
                          </span>
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{item.collectionName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Right: basket */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>
            Basket
            {state.basket.length > 0 && (
              <span style={{ marginLeft: 8, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, padding: '1px 7px', borderRadius: 99, fontWeight: 500 }}>
                {state.basket.length}
              </span>
            )}
          </h2>
          {state.basket.length > 0 && (
            <button className="btn-ghost btn-sm" onClick={() => dispatch({ type: 'CLEAR_BASKET' })}>Clear</button>
          )}
        </div>

        {state.basket.length === 0 ? (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Search and select items to add them here. You can search multiple times.
          </div>
        ) : (
          <>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              {state.basket.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < state.basket.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.organizationName}</div>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_FROM_BASKET', itemId: item.id })}
                    style={{ background: 'none', color: 'var(--muted)', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => dispatch({ type: 'SET_STEP', step: 'assign' })}
            >
              Assign destinations →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
