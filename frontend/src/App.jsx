import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from './contexts/AuthContext'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import Header from './components/Header'

function App() {
  const { isAuthenticated, loading } = useContext(AuthContext)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="login-section">
          <div className="login-card">
            <h2>Loading...</h2>
          </div>
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
          {showRegister ? (
            <div>
              <Register />
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  onClick={() => setShowRegister(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '14px'
                  }}
                >
                  ← Späť na prihlásenie
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Login />
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  onClick={() => setShowRegister(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '14px'
                  }}
                >
                  Pridať nového používateľa
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