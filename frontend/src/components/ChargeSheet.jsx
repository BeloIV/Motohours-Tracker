import React, { useEffect, useState } from 'react'
import BatteryInput from './BatteryInput'

const ChargeSheet = ({ mode, vehicle, session, loading, onClose, onSubmit }) => {
  const [motohours, setMotohours] = useState('')
  const [battery, setBattery] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!vehicle) return null

  const isStart = mode === 'start'
  const lastMh = parseFloat(vehicle.last_motohours) || 0
  const canSubmit = battery !== '' && (!isStart || motohours !== '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(isStart
      ? { motohours: parseFloat(motohours), battery_start: parseInt(battery) }
      : { battery_end: parseInt(battery) }
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <p className="sheet__eyebrow">{isStart ? 'Začiatok nabíjania' : 'Koniec nabíjania'}</p>
            <h3 className="sheet__title">{vehicle.name}</h3>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Zavrieť">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="sheet__body">
          {isStart ? (
            <div className="form-group">
              <label htmlFor="sheet-mh">
                Motohodiny
                <span className="form-hint">posledný stav {lastMh.toFixed(1)} mh</span>
              </label>
              <input
                id="sheet-mh"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={lastMh}
                value={motohours}
                onChange={(e) => setMotohours(e.target.value)}
                placeholder={lastMh.toFixed(1)}
                className="form-control form-control--lg"
                autoFocus
              />
            </div>
          ) : (
            <p className="sheet__summary">
              Štart na <strong style={{ color: 'var(--text-primary)' }}>{session?.battery_start}&nbsp;%</strong>
              {session?.motohours != null && <> pri {parseFloat(session.motohours).toFixed(1)}&nbsp;mh</>}
            </p>
          )}

          <BatteryInput
            id="sheet-battery"
            label={isStart ? 'Stav batérie pred nabíjaním' : 'Stav batérie po nabíjaní'}
            value={battery}
            onChange={setBattery}
            presets={isStart ? [0, 10, 20, 30, 50] : [50, 80, 90, 95, 100]}
          />

          <button
            type="submit"
            className={`btn btn--block ${isStart ? 'btn--start' : 'btn--stop'}`}
            disabled={loading || !canSubmit}
          >
            {loading
              ? (isStart ? 'Spúšťam…' : 'Zastavujem…')
              : (isStart ? 'Spustiť nabíjanie' : 'Zastaviť nabíjanie')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChargeSheet
