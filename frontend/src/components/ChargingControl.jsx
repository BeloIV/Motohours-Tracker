import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import ChargeSheet from './ChargeSheet'
import { batteryColor } from './BatteryInput'

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '')

const elapsed = (from, now) => {
  const mins = Math.max(0, Math.floor((now - new Date(from)) / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`
}

const ChargingControl = ({ activeSessions, onChargingStarted, onChargingStopped, vehicles }) => {
  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (activeSessions.length === 0) return
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [activeSessions.length])

  const sessionFor = (vehicleId) => activeSessions.find(s => s.vehicle_id === vehicleId)

  const submit = async (payload) => {
    const { mode, vehicle } = sheet
    setLoading(true)
    try {
      if (mode === 'start') {
        const res = await axios.post('/charging/start', { vehicle_id: vehicle.id, ...payload })
        onChargingStarted(res.data.session)
        toast.success(`${vehicle.name} sa nabíja`)
      } else {
        const res = await axios.post('/charging/stop', { vehicle_id: vehicle.id, ...payload })
        onChargingStopped(res.data)
      }
      setSheet(null)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Niečo sa pokazilo')
    } finally {
      setLoading(false)
    }
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="empty-state">
        <p>Zatiaľ žiadne vozíky.</p>
        <p className="empty-state__hint">Admin ich pridá v sekcii Správa vozíkov.</p>
      </div>
    )
  }

  return (
    <>
      <div className="fleet">
        {vehicles.map(v => {
          const session = sessionFor(v.id)
          const charging = !!session
          const photoUrl = v.photo_path ? `${API_BASE}${v.photo_path}` : null

          return (
            <article key={v.id} className={`fleet-card ${charging ? 'fleet-card--charging' : ''}`}>
              <div className="fleet-card__photo">
                {photoUrl ? <img src={photoUrl} alt="" /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17V5h9v12"/><path d="M12 9h4l4 4v4h-8"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>}
              </div>

              <div className="fleet-card__body">
                <div className="fleet-card__title">
                  <h4>{v.name}</h4>
                  <span className={`pill ${charging ? 'pill--charging' : ''}`}>
                    {charging ? 'Nabíja sa' : 'Voľný'}
                  </span>
                </div>

                <p className="fleet-card__meta">
                  <span className="mono">{parseFloat(v.last_motohours).toFixed(1)} mh</span>
                  {charging && (
                    <>
                      <span className="dot" />
                      <span style={{ color: batteryColor(session.battery_start) }}>
                        štart {session.battery_start} %
                      </span>
                      <span className="dot" />
                      {elapsed(session.start_time, now)}
                    </>
                  )}
                </p>
              </div>

              <button
                className={`btn ${charging ? 'btn--stop' : 'btn--start'}`}
                onClick={() => setSheet({ mode: charging ? 'stop' : 'start', vehicle: v })}
              >
                {charging ? 'Zastaviť' : 'Nabíjať'}
              </button>
            </article>
          )
        })}
      </div>

      {sheet && (
        <ChargeSheet
          mode={sheet.mode}
          vehicle={sheet.vehicle}
          session={sessionFor(sheet.vehicle.id)}
          loading={loading}
          onClose={() => !loading && setSheet(null)}
          onSubmit={submit}
        />
      )}
    </>
  )
}

export default ChargingControl
