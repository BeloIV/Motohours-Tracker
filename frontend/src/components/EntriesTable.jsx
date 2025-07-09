import React from 'react'
import axios from 'axios'

const EntriesTable = ({ entries, currentUser, onEntryDeleted, currentPage, entriesPerPage, onPageChange }) => {
  const handleDelete = async (entryId) => {
    if (window.confirm('Ste si istí, že chcete vymazať tento záznam?')) {
      try {
        await axios.delete(`/entries/${entryId}`)
        onEntryDeleted(entryId)
      } catch (error) {
        console.error('Failed to delete entry:', error)
      }
    }
  }



  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('sk-SK')
  }

  // Calculate pagination
  const totalPages = Math.ceil(entries.length / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const endIndex = startIndex + entriesPerPage
  const currentEntries = entries.slice(startIndex, endIndex)

  if (entries.length === 0) {
    return (
      <div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Dátum a čas</th>
                <th>Meno</th>
                <th>Motohodiny</th>
                <th>Kapacita batérie</th>
                <th>Akcie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#718096' }}>
                  Zatiaľ žiadne záznamy
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
              <th>Dátum a čas</th>
              <th>Meno</th>
              <th>Motohodiny</th>
              <th>Kapacita batérie</th>
              <th>Akcie</th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.map(entry => {
              const isOwnEntry = entry.user_name === currentUser
              return (
                <tr 
                  key={entry.id}
                  style={isOwnEntry ? {
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    borderLeft: '4px solid #48bb78'
                  } : {}}
                >
                  <td data-label="Dátum a čas">{formatDateTime(entry.created_at)}</td>
                  <td data-label="Meno">{entry.user_name}</td>
                  <td data-label="Motohodiny">{entry.motohours}</td>
                  <td data-label="Kapacita batérie">{entry.battery_capacity}%</td>
                  <td data-label="Akcie">
                    {isOwnEntry ? (
                      <button 
                        className="delete-btn" 
                        onClick={() => handleDelete(entry.id)}
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

export default EntriesTable 