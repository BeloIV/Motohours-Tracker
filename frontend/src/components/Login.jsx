import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const success = await login(username, password)
    if (!success) {
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="login-section">
      <div className="login-card">
        <h2>Prihlásenie</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Používateľské meno:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Zadajte používateľské meno"
              className="form-control"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Heslo:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Zadajte heslo"
              className="form-control"
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading || !username || !password}>
            {loading ? 'Prihlasujem...' : 'Prihlásiť'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
