import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'
import SessionDetail from './SessionDetail'
import { batteryColor } from './BatteryInput'

const ChargingTable = ({ sessions, currentUser, onSessionDeleted, onSessionUpdated, currentPage, entriesPerPage, onPageChange }) => {
  const [confirm, setConfirm] = useState(null)
  const [detail, setDetail] = useState(null)

  const handleDelete = (sessionId) => {
    setConfirm({
      message: 'Vymazať túto nabíjaciu reláciu?',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await axios.delete(`/charging/${sessionId}`)
          setDetail(null)
          onSessionDeleted(sessionId)
        } catch (error) {
          toast.error('Chyba pri mazaní relácie')
        }
      }
    })
  }

  const formatDate = (value) => new Date(value).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })
  const formatTime = (value) => new Date(value).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })

  const totalPages = Math.ceil(sessions.length / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const currentSessions = sessions.slice(startIndex, startIndex + entriesPerPage)

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>Zatiaľ žiadne nabíjanie.</p>
        <p className="empty-state__hint">Prvý záznam pribudne, keď spustíš nabíjanie vozíka.</p>
      </div>
    )
  }

  return (
    <div>
      <ConfirmDialog
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <SessionDetail
        session={detail}
        currentUser={currentUser}
        onClose={() => setDetail(null)}
        onDelete={handleDelete}
        onUpdated={(updated) => { setDetail(updated); onSessionUpdated(updated) }}
      />

      <ul className="log">
        {currentSessions.map(session => {
          const isOwn = session.user_id === currentUser.id
          const active = session.status === 'active'
          const from = session.battery_start
          const to = session.battery_end

          return (
            <li key={session.id}>
              <button
                type="button"
                className={`log-row ${isOwn ? 'log-row--own' : ''} ${active ? 'log-row--active' : ''}`}
                onClick={() => setDetail(session)}
              >
                <span className="log-row__who">
                  <span className="log-row__vehicle">
                    {session.vehicle_name || 'Bez vozíka'}
                    {active && <span className="pill pill--charging">Nabíja sa</span>}
                  </span>
                  <span className="log-row__user">{session.user_name}</span>
                </span>

                <span className="log-row__battery">
                  {from != null ? (
                    <>
                      <span className="battery-bar" aria-hidden="true">
                        <i style={{ width: `${from}%`, background: batteryColor(from) }} />
                        {to != null && <i className="battery-bar__ghost" style={{ width: `${to}%`, background: batteryColor(to) }} />}
                      </span>
                      <span className="log-row__battery-text">
                        {from}%{to != null && <> &rarr; <strong style={{ color: batteryColor(to) }}>{to}%</strong></>}
                      </span>
                    </>
                  ) : <span className="muted">—</span>}
                </span>

                <span className="log-row__mh mono">
                  {session.motohours != null ? `${parseFloat(session.motohours).toFixed(1)} mh` : '—'}
                </span>

                <span className="log-row__when">
                  <span>{formatDate(session.start_time)} {formatTime(session.start_time)}</span>
                  <span className="muted">
                    {active ? 'prebieha' : (session.duration_text && session.duration_text !== '-' ? session.duration_text : '< 1m')}
                  </span>
                </span>

                <span className="log-row__chevron" aria-hidden="true">&rsaquo;</span>
              </button>
            </li>
          )
        })}
      </ul>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="pagination-btn">&lsaquo;</button>
          <div className="page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => onPageChange(n)} className={`page-number ${n === currentPage ? 'active' : ''}`}>{n}</button>
            ))}
          </div>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-btn">&rsaquo;</button>
        </div>
      )}
    </div>
  )
}

export default ChargingTable
