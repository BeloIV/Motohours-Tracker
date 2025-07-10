import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const { login, users, usersLoading } = useAuth()
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedUser) {
      setError('Prosím vyberte používateľa')
      setLoading(false)
      return
    }

    if (!password) {
      setError('Prosím zadajte heslo')
      setLoading(false)
      return
    }

    const success = await login(selectedUser, password)
    if (!success) {
      setPassword('')
      setSelectedUser('')
    }
    setLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (selectedUser && !password) {
        document.getElementById('password').focus()
      } else if (selectedUser && password) {
        handleSubmit(e)
      }
    }
  }

  return (
    <div className="login-section">
      <div className="login-card">
        <h2>Prihlásenie používateľa</h2>
        <form onSubmit={handleSubmit}>
          {usersLoading && <div>Načítavam používateľov...</div>}
          <div className="form-group">
            <label htmlFor="userSelect">Vyberte používateľa:</label>
            <select
              id="userSelect"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              onKeyPress={handleKeyPress}
              className="user-select"
              disabled={usersLoading || !users || users.length === 0}
            >
              <option value="">Vyberte používateľa</option>
              {Array.isArray(users) && users.length > 0 ? (
                users.map(user => (
                  <option key={user.id} value={user.username}>
                    {user.username}
                  </option>
                ))
              ) : (
                <option disabled>Žiadni používatelia</option>
              )}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Heslo:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Zadajte heslo"
              className="password-input"
            />
          </div>
          
          <button 
            type="submit" 
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Prihlasujem...' : 'Prihlásiť'}
          </button>
        </form>
        
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  )
}

export default Login 