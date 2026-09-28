import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'
import VehicleEditor from './VehicleEditor'

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '')

const VehicleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17V5h9v12" /><path d="M12 9h4l4 4v4h-8" />
    <circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" />
  </svg>
)

const VehicleManager = ({ vehicles, onVehiclesChanged }) => {
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null) // { vehicle } | { vehicle: null } for a new one

  const handleDelete = (vehicle) => {
    setConfirm({
      message: `Vymazať vozík "${vehicle.name}" vrátane všetkých jeho záznamov?`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await axios.delete(`/vehicles/${vehicle.id}`)
          toast.success('Vozík a všetky jeho záznamy boli vymazané')
          setEditing(null)
          onVehiclesChanged()
        } catch (err) {
          toast.error(err.response?.data?.error || 'Chyba pri mazaní vozíka')
        }
      }
    })
  }

  return (
    <div className="vehicle-manager">
      <ConfirmDialog
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      {editing && (
        <VehicleEditor
          vehicle={editing.vehicle}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onVehiclesChanged() }}
          onDelete={handleDelete}
        />
      )}

      <div className="section-head">
        <h3>Správa vozíkov</h3>
        <button type="button" className="link-btn" onClick={() => setEditing({ vehicle: null })}>
          + Pridať vozík
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="empty-state">
          <p>Zatiaľ žiadne vozíky.</p>
        </div>
      ) : (
        <div className="vehicle-manager__list">
          {vehicles.map(v => {
            const photoUrl = v.photo_path ? `${API_BASE}${v.photo_path}` : null
            return (
              <button
                key={v.id}
                type="button"
                className="vehicle-manager__item"
                onClick={() => setEditing({ vehicle: v })}
              >
                <span className="vehicle-manager__item-photo">
                  {photoUrl ? <img src={photoUrl} alt="" /> : <VehicleIcon />}
                </span>
                <span className="vehicle-manager__item-name">
                  {v.name}
                  <span className="vehicle-manager__item-mh mono">
                    {parseFloat(v.last_motohours).toFixed(1)} mh
                  </span>
                </span>
                <span className="log-row__chevron" aria-hidden="true">&rsaquo;</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default VehicleManager
