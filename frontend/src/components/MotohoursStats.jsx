import React, { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const fmt = (h) => (h > 0 ? h.toFixed(1) : '—')

const MotohoursStats = () => {
  const [vehicles, setVehicles] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await axios.get('/charging/stats')
        setVehicles(response.data.vehicles)
      } catch (error) {
        console.error('Failed to load stats:', error)
        toast.error('Chyba pri načítaní štatistík')
      } finally {
        setLoading(false)
      }
    }
    loadStats()
    window.addEventListener('refreshStats', loadStats)
    return () => window.removeEventListener('refreshStats', loadStats)
  }, [])

  return (
    <div className="card">
      <h2>Odjazdené motohodiny</h2>

      {loading || !vehicles ? (
        <p className="muted">Načítavam…</p>
      ) : vehicles.length === 0 ? (
        <div className="empty-state"><p>Žiadne vozíky.</p></div>
      ) : (
        <div className="hours-table">
          <div className="hours-table__head">
            <span />
            <span>Dnes</span>
            <span>Týždeň</span>
            <span>Mesiac</span>
          </div>

          {vehicles.map(v => (
            <div key={v.id} className="hours-table__row">
              <span className="hours-table__vehicle">
                {v.name}
                <span className="hours-table__odo mono">{v.last_motohours.toFixed(1)} mh</span>
              </span>
              <span className={`hours-table__cell hours-table__cell--today mono ${v.today.hours > 0 ? 'is-active' : ''}`}>
                {fmt(v.today.hours)}
              </span>
              <span className={`hours-table__cell mono ${v.thisWeek.hours > 0 ? 'is-active' : ''}`}>
                {fmt(v.thisWeek.hours)}
              </span>
              <span className={`hours-table__cell mono ${v.thisMonth.hours > 0 ? 'is-active' : ''}`}>
                {fmt(v.thisMonth.hours)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MotohoursStats
