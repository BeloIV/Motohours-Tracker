import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '')

const VehicleEditor = ({ vehicle, onClose, onSaved, onDelete }) => {
  const isNew = !vehicle
  const [name, setName] = useState(vehicle?.name || '')
  const [initialMh, setInitialMh] = useState(
    vehicle?.initial_motohours != null ? String(parseFloat(vehicle.initial_motohours)) : ''
  )
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const currentPhoto = vehicle?.photo_path ? `${API_BASE}${vehicle.photo_path}` : null
  const shownPhoto = preview || currentPhoto

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Zadajte názov vozíka')
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('initial_motohours', initialMh || '0')
      if (photo) formData.append('photo', photo)

      const res = isNew
        ? await axios.post('/vehicles', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await axios.put(`/vehicles/${vehicle.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })

      toast.success(isNew ? `Vozík "${res.data.vehicle.name}" bol pridaný` : 'Vozík bol upravený')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Chyba pri ukladaní vozíka')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet__head">
          <div>
            <p className="sheet__eyebrow">{isNew ? 'Nový vozík' : 'Úprava vozíka'}</p>
            <h3 className="sheet__title">{isNew ? 'Pridať vozík' : vehicle.name}</h3>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Zavrieť">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="sheet__body">
          <div className="form-group">
            <label htmlFor="veh-name">Názov vozíka</label>
            <input
              id="veh-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="napr. Vozík #1"
              className="form-control"
              disabled={saving}
              autoFocus={isNew}
            />
          </div>

          <div className="form-group">
            <label htmlFor="veh-mh">
              Počiatočný stav
              <span className="form-hint">motohodiny pred prvým nabíjaním</span>
            </label>
            <input
              id="veh-mh"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={initialMh}
              onChange={e => setInitialMh(e.target.value)}
              placeholder="0"
              className="form-control"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="veh-photo">
              Fotka
              <span className="form-hint">{currentPhoto && !preview ? 'nahraním sa nahradí' : 'voliteľné'}</span>
            </label>

            {shownPhoto && <img src={shownPhoto} alt="" className="vehicle-editor__preview" />}

            <input
              id="veh-photo"
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="visually-hidden"
              disabled={saving}
            />
            <label htmlFor="veh-photo" className="file-btn">
              {photo ? photo.name : (currentPhoto ? 'Zmeniť fotku' : 'Vybrať fotku')}
            </label>
          </div>

          <button type="submit" className="btn btn--block btn--primary" disabled={saving || !name.trim()}>
            {saving ? 'Ukladám…' : (isNew ? 'Pridať vozík' : 'Uložiť zmeny')}
          </button>

          {!isNew && (
            <button
              type="button"
              className="btn btn--block btn--ghost"
              style={{ marginTop: 'var(--space-sm)' }}
              onClick={() => onDelete(vehicle)}
              disabled={saving}
            >
              Vymazať vozík
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

export default VehicleEditor
