import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BatteryInput, { batteryColor } from './BatteryInput'

const FIELD_LABELS = {
  motohours: 'Motohodiny',
  battery_start: 'Pred nabíjaním',
  battery_end: 'Po nabíjaní'
}

const formatChange = (field, value) => {
  if (value === null || value === undefined || value === '') return '—'
  return field === 'motohours' ? `${parseFloat(value).toFixed(1)} mh` : `${value} %`
}

const formatFull = (value) =>
  value ? new Date(value).toLocaleString('sk-SK', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '—'

const Row = ({ label, children }) => (
  <div className="detail-row">
    <span className="detail-row__label">{label}</span>
    <span className="detail-row__value">{children}</span>
  </div>
)

const SessionDetail = ({ session, currentUser, onClose, onDelete, onUpdated }) => {
  const [editing, setEditing] = useState(false)
  const [motohours, setMotohours] = useState('')
  const [batteryStart, setBatteryStart] = useState('')
  const [batteryEnd, setBatteryEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    axios.get(`/charging/${session.id}/history`)
      .then(res => { if (!cancelled) setHistory(res.data.changes) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [session?.id])

  useEffect(() => {
    setEditing(false)
    setMotohours(session?.motohours != null ? String(parseFloat(session.motohours)) : '')
    setBatteryStart(session?.battery_start != null ? String(session.battery_start) : '')
    setBatteryEnd(session?.battery_end != null ? String(session.battery_end) : '')
  }, [session?.id])

  if (!session) return null

  const active = session.status === 'active'
  const from = session.battery_start
  const to = session.battery_end
  const gained = from != null && to != null ? to - from : null

  const isAdmin = currentUser.role === 'admin'
  const mine = session.user_id === currentUser.id || session.stopped_by === currentUser.id
  const canEdit = isAdmin || mine
  const canDelete = !active && (isAdmin || mine)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { motohours: parseFloat(motohours), battery_start: parseInt(batteryStart) }
      if (!active) payload.battery_end = parseInt(batteryEnd)

      const res = await axios.patch(`/charging/${session.id}`, payload)
      onUpdated(res.data.session)
      setEditing(false)
      toast.success(res.data.message)

      const fresh = await axios.get(`/charging/${session.id}/history`)
      setHistory(fresh.data.changes)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Chyba pri úprave')
    } finally {
      setSaving(false)
    }
  }

  const editValid = motohours !== '' && batteryStart !== '' && (active || batteryEnd !== '')

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <p className="sheet__eyebrow">Detail nabíjania</p>
            <h3 className="sheet__title">{session.vehicle_name || 'Bez vozíka'}</h3>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Zavrieť">&times;</button>
        </div>

        <div className="sheet__body">
          <div className="detail-list">
            <Row label="Spustil">
              <strong>{session.user_name}</strong>
              <span className="muted">{formatFull(session.start_time)}</span>
            </Row>

            <Row label="Zastavil">
              {active
                ? <span className="pill pill--charging">Prebieha</span>
                : (
                  <>
                    <strong>{session.stopped_by_name || 'neznáme'}</strong>
                    <span className="muted">{formatFull(session.stop_time)}</span>
                  </>
                )}
            </Row>

            <Row label="Trvanie">
              {active ? '—' : (session.duration_text && session.duration_text !== '-' ? session.duration_text : 'menej ako minúta')}
            </Row>

            <Row label="Motohodiny">
              <span className="mono">
                {session.motohours != null ? `${parseFloat(session.motohours).toFixed(1)} mh` : '—'}
              </span>
            </Row>

            <Row label="Batéria">
              {from != null ? (
                <span className="mono">
                  <span style={{ color: batteryColor(from) }}>{from} %</span>
                  {to != null && (
                    <>
                      {' → '}
                      <span style={{ color: batteryColor(to) }}>{to} %</span>
                      {gained != null && <span className="muted"> ({gained >= 0 ? '+' : ''}{gained} b.)</span>}
                    </>
                  )}
                </span>
              ) : '—'}
            </Row>
          </div>

          {canEdit && !editing && (
            <button className="btn btn--block btn--ghost" onClick={() => setEditing(true)}>
              Upraviť záznam
            </button>
          )}

          {canEdit && editing && (
            <div className="detail-edit">
              <div className="form-group">
                <label htmlFor="detail-mh">Motohodiny</label>
                <input
                  id="detail-mh"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={motohours}
                  onChange={(e) => setMotohours(e.target.value)}
                  className="form-control"
                  disabled={saving}
                />
              </div>

              <BatteryInput
                id="detail-battery-start"
                label="Pred nabíjaním"
                value={batteryStart}
                onChange={setBatteryStart}
                presets={[0, 10, 20, 30, 50]}
              />

              {!active && (
                <BatteryInput
                  id="detail-battery-end"
                  label="Po nabíjaní"
                  value={batteryEnd}
                  onChange={setBatteryEnd}
                  presets={[50, 80, 90, 95, 100]}
                />
              )}

              <div className="detail-edit__actions">
                <button className="btn btn--ghost" onClick={() => setEditing(false)} disabled={saving}>Zrušiť</button>
                <button className="btn btn--primary" onClick={handleSave} disabled={saving || !editValid}>
                  {saving ? 'Ukladám…' : 'Uložiť'}
                </button>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="audit">
              <p className="audit__title">Úpravy záznamu</p>
              <ul className="audit__list">
                {history.map(change => (
                  <li key={change.id} className="audit__item">
                    <span className="audit__what">
                      {FIELD_LABELS[change.field] || change.field}
                      {': '}
                      <span className="muted">{formatChange(change.field, change.old_value)}</span>
                      {' → '}
                      <strong>{formatChange(change.field, change.new_value)}</strong>
                    </span>
                    <span className="audit__who">
                      {change.user_name || 'neznámy'} · {formatFull(change.changed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canDelete && (
            <button className="btn btn--block btn--ghost" onClick={() => onDelete(session.id)}>
              Vymazať záznam
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
