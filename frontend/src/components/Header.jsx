import React from 'react'
import { useAuth } from '../contexts/AuthContext'

const Header = ({ currentTime }) => {
  const { user, logout } = useAuth()

  const formatDateTime = (date) => {
    return date.toLocaleDateString('sk-SK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <header>
      <h1>Motohodiny</h1>
      <div className="header-spacer" />
      <div className="datetime">{formatDateTime(currentTime)}</div>
      {user && (
        <div className="user-info">
          <p>{user.username}</p>
          {user.role === 'admin' && <span className="role-badge">Admin</span>}
          <button onClick={logout} className="logout-btn">Odhlásiť</button>
        </div>
      )}
    </header>
  )
}

export default Header 