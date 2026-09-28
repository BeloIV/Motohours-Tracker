import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const InvitePanel = () => {
  const [inviteUrl, setInviteUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const generateInvite = async () => {
    setLoading(true)
    try {
      const response = await axios.post('/auth/invite')
      const token = response.data.token
      const url = `${window.location.origin}/?invite=${token}`
      setInviteUrl(url)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nepodarilo sa vytvoriť pozvánku')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteUrl)
        .then(() => toast.success('Odkaz skopírovaný!'))
        .catch(() => toast.error('Kopírovanie zlyhalo'))
    } else {
      // Fallback for HTTP (non-secure) contexts
      const el = document.createElement('textarea')
      el.value = inviteUrl
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      ok ? toast.success('Odkaz skopírovaný!') : toast.error('Kopírovanie zlyhalo')
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '12px' }}>Pozvať používateľa</h3>
      <button
        onClick={generateInvite}
        disabled={loading}
        className="login-btn"
        style={{ width: 'auto', padding: '8px 16px' }}
      >
        {loading ? 'Generujem...' : 'Vytvoriť pozývací odkaz'}
      </button>

      {inviteUrl && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ fontSize: '13px', color: '#718096', marginBottom: '6px' }}>
            Zdieľajte tento odkaz (platí pre jedno použitie):
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={inviteUrl}
              readOnly
              className="form-control"
              style={{ fontSize: '12px', flex: 1 }}
              onClick={(e) => e.target.select()}
            />
            <button
              onClick={copyToClipboard}
              className="login-btn"
              style={{ width: 'auto', padding: '8px 12px', whiteSpace: 'nowrap' }}
            >
              Kopírovať
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvitePanel
