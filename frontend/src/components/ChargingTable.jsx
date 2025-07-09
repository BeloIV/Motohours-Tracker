import React from 'react'
import axios from 'axios'

const ChargingTable = ({ sessions, currentUser, onSessionDeleted, currentPage, entriesPerPage, onPageChange }) => {
  const handleDelete = async (sessionId) => {
    if (window.confirm('Ste si istí, že chcete vymazať túto nabíjaciu reláciu?')) {
      try {
        await axios.delete(`/charging/${sessionId}`)
        onSessionDeleted(sessionId)
      } catch (error) {
        console.error('Failed to delete charging session:', error)
      }
    }
  }



  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('sk-SK')
  }

  const getStatusIcon = (status) => {
    return status === 'active' ? '🟢 Aktívna' : '✅ Dokončená'
  }

  // Calculate pagination
  const totalPages = Math.ceil(sessions.length / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const endIndex = startIndex + entriesPerPage
  const currentSessions = sessions.slice(startIndex, endIndex)

  if (sessions.length === 0) {
    return (
      <div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Používateľ</th>
                <th>Čas začiatku</th>
                <th>Čas ukončenia</th>
                <th>Trvanie</th>
                <th>Stav</th>
                <th>Akcie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#718096' }}>
                  Zatiaľ žiadne nabíjacie relácie
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    )
  }

  return (
    <div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Používateľ</th>
              <th>Čas začiatku</th>
              <th>Čas ukončenia</th>
              <th>Trvanie</th>
              <th>Stav</th>
              <th>Akcie</th>
            </tr>
          </thead>
          <tbody>
            {currentSessions.map(session => {
              const isOwnSession = session.user_name === currentUser
              return (
                <tr 
                  key={session.id}
                  style={isOwnSession ? {
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    borderLeft: '4px solid #48bb78'
                  } : {}}
                >
                  <td data-label="Používateľ">{session.user_name}</td>
                  <td data-label="Čas začiatku">{formatDateTime(session.start_time)}</td>
                  <td data-label="Čas ukončenia">{formatDateTime(session.stop_time)}</td>
                  <td data-label="Trvanie">{session.duration_text || '-'}</td>
                  <td data-label="Stav">{getStatusIcon(session.status)}</td>
                  <td data-label="Akcie">
                    {isOwnSession && session.status === 'completed' ? (
                      <button 
                        className="delete-btn" 
                        onClick={() => handleDelete(session.id)}
                      >
                        Vymazať
                      </button>
                    ) : (
                      <span className="no-action">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Predchádzajúca
            </button>
            
            {/* Page Numbers */}
            <div className="page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`page-number ${pageNum === currentPage ? 'active' : ''}`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Ďalšia
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

export default ChargingTable 