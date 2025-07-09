import React, { useState } from 'react'
import axios from 'axios'

const ChargingControl = ({ activeSession, onChargingStarted, onChargingStopped }) => {
  const [loading, setLoading] = useState(false)

  const handleStartCharging = async () => {
    setLoading(true)
    try {
      const response = await axios.post('/charging/start')
      onChargingStarted(response.data.session)
    } catch (error) {
      console.error('Failed to start charging:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStopCharging = async () => {
    setLoading(true)
    try {
      const response = await axios.post('/charging/stop')
      onChargingStopped(response.data)
    } catch (error) {
      console.error('Failed to stop charging:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="charging-section">
      <h3>Ovládanie nabíjania</h3>
      <div className="charging-buttons">
        <button
          id="startChargingBtn"
          onClick={handleStartCharging}
          className="charging-btn start-btn"
          disabled={loading || activeSession}
        >
          {loading ? 'Spúšťam...' : 'Spustiť nabíjanie'}
        </button>
        <button
          id="stopChargingBtn"
          onClick={handleStopCharging}
          className="charging-btn stop-btn"
          disabled={loading || !activeSession}
        >
          {loading ? 'Zastavujem...' : 'Zastaviť akékoľvek nabíjanie'}
        </button>
      </div>
      <div className={`charging-status ${activeSession ? 'active' : ''}`}>
        {activeSession ? (
          <p>
            {activeSession.user_name === 'You' ? 'Your' : `${activeSession.user_name}'s`} charging started at: {formatDateTime(activeSession.start_time)}
          </p>
        ) : (
                      <p>Žiadna aktívna nabíjacia relácia</p>
        )}
      </div>
    </div>
  )
}

export default ChargingControl 