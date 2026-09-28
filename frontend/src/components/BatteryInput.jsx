import React from 'react'

export const batteryColor = (value) => {
  if (value === null || value === undefined || value === '') return 'var(--text-muted)'
  const v = Number(value)
  if (v < 20) return 'var(--color-danger)'
  if (v < 50) return 'var(--color-warning)'
  return 'var(--color-success)'
}

const BatteryInput = ({ id, label, value, onChange, presets = [0, 25, 50, 75, 100] }) => {
  const touched = value !== '' && value !== null && value !== undefined
  const num = touched ? Number(value) : 0
  const color = batteryColor(touched ? num : null)

  return (
    <div className="battery-input">
      <div className="battery-input__head">
        <label htmlFor={id}>{label}</label>
        <span className="battery-input__value" style={{ color }}>
          {touched ? `${num} %` : '— %'}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={num}
        onChange={(e) => onChange(e.target.value)}
        className="battery-input__slider"
        style={{ '--fill': `${num}%`, '--fill-color': color }}
      />

      <div className="battery-input__presets">
        {presets.map(p => (
          <button
            key={p}
            type="button"
            className={`battery-chip ${touched && num === p ? 'battery-chip--active' : ''}`}
            onClick={() => onChange(String(p))}
          >
            {p}%
          </button>
        ))}
      </div>
    </div>
  )
}

export default BatteryInput
