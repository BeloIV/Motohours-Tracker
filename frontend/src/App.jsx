import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from './contexts/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Header from './components/Header'

function App() {
  const { isAuthenticated, loading } = useContext(AuthContext)
  const [currentTime, setCurrentTime] = useState(new Date())

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
        <Login />
      )}
    </div>
  )
}

export default App 