import React, { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const Register = ({ inviteToken, onSuccess }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState(null)
  const [tokenValid, setTokenValid] = useState(inviteToken ? null : true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!inviteToken) return

    axios.get(`/auth/invite/${inviteToken}`)
      .then(res => {
        setCompanyName(res.data.company_name)
        setTokenValid(true)
      })
      .catch(() => {
        setTokenValid(false)
      })
  }, [inviteToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    if (password.length < 6) {
      toast.error('Heslo musí mať aspoň 6 znakov')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      toast.error('Heslá sa nezhodujú')
      setLoading(false)
      return
    }

    try {
      await axios.post('/auth/register', {
        username,
        password,
        ...(inviteToken && { invite_token: inviteToken })
      })

      toast.success(inviteToken
        ? `Vitajte v ${companyName}! Môžete sa prihlásiť.`
        : 'Účet bol vytvorený! Môžete sa prihlásiť.'
      )
      if (onSuccess) onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Chyba pri vytváraní účtu')
    } finally {
      setLoading(false)
    }
  }

  if (inviteToken && tokenValid === null) {
    return (
      <div className="login-section">
        <div className="login-card"><h2>Overujem pozvánku...</h2></div>
      </div>
    )
  }

  if (inviteToken && tokenValid === false) {
    return (
      <div className="login-section">
        <div className="login-card">
          <h2>Neplatná pozvánka</h2>
          <p style={{ color: '#e53e3e' }}>Tento pozývací odkaz je neplatný alebo bol už použitý.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="register-section">
      <div className="register-card">
        <h2>{inviteToken ? `Registrácia — ${companyName}` : 'Vytvorenie nového účtu'}</h2>
        {!inviteToken && (
          <p style={{ color: '#718096', fontSize: '14px', marginBottom: '16px' }}>
            Registráciou vytvoríte novú spoločnosť a stanete sa jej administrátorom.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reg-username">Používateľské meno:</label>
            <input
              id="reg-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Zadajte používateľské meno"
              className="form-control"
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Heslo:</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 znakov"
              className="form-control"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Potvrďte heslo:</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Zadajte heslo znova"
              className="form-control"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="register-btn"
            disabled={loading || !username || !password || !confirmPassword}
          >
            {loading ? 'Vytváram...' : 'Vytvoriť účet'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Register
