import React, { useState } from 'react'
import axios from 'axios'

const EntriesForm = ({ onEntryAdded }) => {
  const [motohours, setMotohours] = useState('')
  const [batteryCapacity, setBatteryCapacity] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await axios.post('/entries', {
        motohours: parseFloat(motohours),
        battery_capacity: parseInt(batteryCapacity)
      })

      onEntryAdded(response.data.entry)
      setMotohours('')
      setBatteryCapacity('')
    } catch (error) {
      console.error('Failed to add entry:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="motohours">Motohodiny:</label>
        <input
          id="motohours"
          type="number"
          step="0.1"
          min="0"
          value={motohours}
          onChange={(e) => setMotohours(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Zadajte motohodiny"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="batteryCapacity">Kapacita batérie (%):</label>
        <input
          id="batteryCapacity"
          type="number"
          min="0"
          max="100"
          value={batteryCapacity}
          onChange={(e) => setBatteryCapacity(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Zadajte kapacitu batérie"
          required
        />
      </div>

      <button 
        type="submit" 
        className="submit-btn"
        disabled={loading}
      >
        {loading ? 'Pridávam...' : 'Pridať záznam'}
      </button>
    </form>
  )
}

export default EntriesForm 