import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const Register = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    if (!username || !password) {
      toast.error('Používateľské meno a heslo sú povinné')
      setLoading(false)
      return
    }

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
      const apiUrl = import.meta.env.VITE_API_URL || 'https://regulusbackend.bytboyzserver.xyz/api'
      const response = await axios.post(`${apiUrl}/auth/register`, {
        username,
        password
      })

      toast.success('Používateľ bol úspešne vytvorený!')
      setUsername('')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      const message = error.response?.data?.error || 'Chyba pri vytváraní používateľa'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-section">
      <div className="register-card">
        <h2>Pridanie nového používateľa</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Používateľské meno:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Zadajte používateľské meno"
              className="username-input"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Heslo:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Zadajte heslo (min. 6 znakov)"
              className="password-input"
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
              className="password-input"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="register-btn"
            disabled={loading}
          >
            {loading ? 'Vytváram...' : 'Vytvoriť používateľa'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Register 