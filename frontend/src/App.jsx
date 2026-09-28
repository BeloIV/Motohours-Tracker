import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from './contexts/AuthContext'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import Header from './components/Header'

function App() {
  const { isAuthenticated, loading } = useContext(AuthContext)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [view, setView] = useState('login') // 'login' | 'register'
  const [inviteToken, setInviteToken] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Detect invite token in URL: ?invite=<token>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (token) {
      setInviteToken(token)
      setView('register')
    }
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="login-section">
          <div className="login-card"><p className="muted">Načítavam…</p></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <Header currentTime={currentTime} />

      {isAuthenticated ? (
        <Dashboard />
      ) : (
        <div>
          {view === 'register' ? (
            <div>
              <Register
                inviteToken={inviteToken}
                onSuccess={() => { setView('login'); setInviteToken(null) }}
              />
              <div className="auth-switch">
                <button onClick={() => setView('login')} className="link-btn">
                  &larr; Späť na prihlásenie
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Login />
              <div className="auth-switch">
                <button onClick={() => setView('register')} className="link-btn">
                  Vytvoriť nový účet
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
