import React from 'react'

const ConfirmDialog = ({ message, onConfirm, onCancel }) => {
  if (!message) return null

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel}>Zrušiť</button>
          <button className="confirm-ok-btn" onClick={onConfirm}>Vymazať</button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
