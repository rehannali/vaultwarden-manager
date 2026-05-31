import { createContext, useContext, useReducer, useEffect } from 'react'
import * as api from './api.js'
import AuthScreen       from './components/AuthScreen.jsx'
import SearchSession    from './components/SearchSession.jsx'
import AssignDestinations from './components/AssignDestinations.jsx'
import ProgressView     from './components/ProgressView.jsx'

// ── State ─────────────────────────────────────────────────────────────────────

const initialState = {
  step: 'loading',          // loading | auth | search | assign | progress | done
  email: null,
  basket: [],               // [{ id, name, username, uri, organizationId, organizationName, collectionIds, collectionName }]
  organizations: [],        // [{ id, name }]
  destinations: {},         // { [itemId]: { vaultId, vaultName, collectionId, collectionName } }
  moveResults: []           // [{ itemId, ok, method, error }]
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':    return { ...state, step: action.step }
    case 'SET_AUTH':    return { ...state, step: 'search', email: action.email }
    case 'SESSION_EXPIRED': return { ...initialState, step: 'auth' }

    case 'ADD_TO_BASKET': {
      const ids = new Set(state.basket.map(i => i.id))
      return { ...state, basket: [...state.basket, ...action.items.filter(i => !ids.has(i.id))] }
    }
    case 'REMOVE_FROM_BASKET': {
      const next = { ...state.destinations }
      delete next[action.itemId]
      return { ...state, basket: state.basket.filter(i => i.id !== action.itemId), destinations: next }
    }
    case 'CLEAR_BASKET': return { ...state, basket: [], destinations: {} }

    case 'SET_ORGS': return { ...state, organizations: action.orgs }

    case 'SET_DEST': return {
      ...state,
      destinations: { ...state.destinations, [action.itemId]: action.dest }
    }
    case 'SET_DEST_BULK': {
      const next = { ...state.destinations }
      for (const id of action.itemIds) next[id] = action.dest
      return { ...state, destinations: next }
    }
    case 'CLEAR_DEST': {
      const next = { ...state.destinations }
      for (const id of action.itemIds) delete next[id]
      return { ...state, destinations: next }
    }

    case 'SET_RESULTS': return { ...state, moveResults: action.results, step: 'done' }

    case 'RESET':
      return { ...initialState, step: 'search', email: state.email, organizations: state.organizations }

    default: return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    api.getStatus()
      .then(s => {
        if (s.authenticated) dispatch({ type: 'SET_AUTH', email: s.email })
        else dispatch({ type: 'SET_STEP', step: 'auth' })
      })
      .catch(() => dispatch({ type: 'SET_STEP', step: 'auth' }))
  }, [])

  useEffect(() => {
    if (state.step === 'search' && !state.organizations.length) {
      api.getOrgs()
        .then(orgs => dispatch({ type: 'SET_ORGS', orgs }))
        .catch(err => { if (err.code === 'AUTH') dispatch({ type: 'SESSION_EXPIRED' }) })
    }
  }, [state.step])

  const onSessionExpired = () => dispatch({ type: 'SESSION_EXPIRED' })

  return (
    <Ctx.Provider value={{ state, dispatch, onSessionExpired }}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {state.step !== 'auth' && state.step !== 'loading' && <Header />}
        <main style={{ flex: 1, padding: '0 24px 40px' }}>
          {state.step === 'loading'  && <Loading />}
          {state.step === 'auth'     && <AuthScreen />}
          {state.step === 'search'   && <SearchSession />}
          {state.step === 'assign'   && <AssignDestinations />}
          {state.step === 'progress' && <ProgressView />}
          {state.step === 'done'     && <ProgressView />}
        </main>
      </div>
    </Ctx.Provider>
  )
}

function Header() {
  const { state, dispatch } = useApp()
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>Vault Manager</span>
        {state.step !== 'loading' && state.step !== 'auth' && (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {['search','assign','progress','done'].indexOf(state.step) >= 0 ? (
              <span>
                <StepDot active={state.step === 'search'}>Search</StepDot>
                {' → '}
                <StepDot active={state.step === 'assign'}>Assign</StepDot>
                {' → '}
                <StepDot active={state.step === 'progress' || state.step === 'done'}>Move</StepDot>
              </span>
            ) : null}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {state.email && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{state.email}</span>}
        {state.step !== 'auth' && (
          <button className="btn-ghost btn-sm" onClick={async () => {
            await api.lock().catch(() => {})
            dispatch({ type: 'SESSION_EXPIRED' })
          }}>Lock</button>
        )}
      </div>
    </header>
  )
}

function StepDot({ active, children }) {
  return <span style={{ color: active ? 'var(--accent)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}>{children}</span>
}

function Loading() {
  return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80, color: 'var(--muted)' }}>Connecting...</div>
}
