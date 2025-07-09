import React from 'react'
import { useAuth } from '../contexts/AuthContext'

const Header = ({ currentTime }) => {
  const { user, logout } = useAuth()

  const formatDateTime = (date) => {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
    return date.toLocaleDateString('sk-SK', options)
  }

  return (
    <header>
      <h1>Sledovač motohodín</h1>
      <div className="datetime">{formatDateTime(currentTime)}</div>
      {user && (
        <div className="user-info">
          <p>Prihlásený ako: {user.username}</p>
          <button onClick={logout} className="logout-btn">Odhlásiť</button>
        </div>
      )}
    </header>
  )
}

export default Header 