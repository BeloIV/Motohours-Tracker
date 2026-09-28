import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import ChargingControl from './ChargingControl'
import ChargingTable from './ChargingTable'
import MotohoursStats from './MotohoursStats'
import InvitePanel from './InvitePanel'
import VehicleManager from './VehicleManager'
import axios from 'axios'
import toast from 'react-hot-toast'

const REFRESH_MS = 15000

// Keep the previous state object when nothing actually changed, so React has
// no reason to re-render and the screen stays still between polls.
const keepIfSame = (prev, next) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)

const Dashboard = () => {
  const { user } = useAuth()
  const [chargingSessions, setChargingSessions] = useState([])
  const [activeSessions, setActiveSessions] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentChargingPage, setCurrentChargingPage] = useState(1)
  const entriesPerPage = 5

  const activeIdsRef = useRef(null)
  const lastLogRef = useRef(null)

  const loadVehicles = useCallback(async () => {
    try {
      const res = await axios.get('/vehicles')
      setVehicles(prev => keepIfSame(prev, res.data.vehicles))
    } catch (error) {
      console.error('Failed to load vehicles:', error)
    }
  }, [])

  // Announce sessions that someone else ended while this screen was open
  const announceForeignStops = useCallback((nextActive, sessions) => {
    const previous = activeIdsRef.current
    const nextIds = nextActive.map(s => s.id)
    activeIdsRef.current = nextIds

    if (previous === null) return
    previous
      .filter(id => !nextIds.includes(id))
      .map(id => sessions.find(s => s.id === id))
      .filter(s => s && s.status === 'completed' && s.stopped_by_name && s.stopped_by_name !== user.username)
      .forEach(s => toast(`${s.vehicle_name || 'Vozík'} — nabíjanie zastavil ${s.stopped_by_name}`, { icon: '\u26A1' }))
  }, [user.username])

  const refresh = useCallback(async () => {
    try {
      const [logRes, activeRes] = await Promise.all([
        axios.get('/charging'),
        axios.get('/charging/active')
      ])
      const sessions = logRes.data.sessions
      const active = activeRes.data.sessions || []

      announceForeignStops(active, sessions)

      const serialized = JSON.stringify(sessions)
      const changed = lastLogRef.current !== serialized
      lastLogRef.current = serialized

      setChargingSessions(prev => (changed ? sessions : prev))
      setActiveSessions(prev => keepIfSame(prev, active))

      if (changed) {
        await loadVehicles()
        window.dispatchEvent(new CustomEvent('refreshStats'))
      }
    } catch (error) {
      console.error('Refresh failed:', error)
    }
  }, [announceForeignStops, loadVehicles])

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([refresh(), loadVehicles()])
      } catch (error) {
        toast.error('Chyba pri načítaní dát')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [refresh, loadVehicles])

  // Poll quietly; skip hidden tabs and catch up as soon as the window is back
  useEffect(() => {
    const tick = () => { if (!document.hidden) refresh() }
    const timer = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [refresh])

  const handleChargingStarted = (session) => {
    setActiveSessions(prev => [...prev, session])
    setChargingSessions(prev => [session, ...prev])
    activeIdsRef.current = null
    loadVehicles()
    window.dispatchEvent(new CustomEvent('refreshStats'))
  }

  const handleChargingStopped = (data) => {
    setActiveSessions(prev => prev.filter(s => s.id !== data.session.id))
    setChargingSessions(prev => prev.map(s => s.id === data.session.id ? data.session : s))
    if (data.message) toast.success(data.message)
    activeIdsRef.current = null
    loadVehicles()
    window.dispatchEvent(new CustomEvent('refreshStats'))
  }

  // A rename or a new photo also changes how past sessions are labelled
  const handleVehiclesChanged = useCallback(async () => {
    lastLogRef.current = null
    await Promise.all([loadVehicles(), refresh()])
  }, [loadVehicles, refresh])

  const handleSessionUpdated = (updated) => {
    setChargingSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
    setActiveSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
    lastLogRef.current = null
  }

  const handleChargingSessionDeleted = (sessionId) => {
    setChargingSessions(prev => prev.filter(s => s.id !== sessionId))
    loadVehicles()
    window.dispatchEvent(new CustomEvent('refreshStats'))
  }

  if (loading) {
    return (
      <div className="main-content">
        <div className="card"><p className="muted">Načítavam…</p></div>
      </div>
    )
  }

  return (
    <div className="main-content dashboard-flex">
      <div className="dashboard-left">
        <div className="card">
          <h2>Vozíky</h2>
          <ChargingControl
            activeSessions={activeSessions}
            onChargingStarted={handleChargingStarted}
            onChargingStopped={handleChargingStopped}
            vehicles={vehicles}
          />
        </div>

        <div className="card">
          <h2>História nabíjania</h2>
          <ChargingTable
            sessions={chargingSessions}
            currentUser={user}
            onSessionDeleted={handleChargingSessionDeleted}
            onSessionUpdated={handleSessionUpdated}
            currentPage={currentChargingPage}
            entriesPerPage={entriesPerPage}
            onPageChange={setCurrentChargingPage}
          />
        </div>
      </div>

      <div className="dashboard-right">
        <MotohoursStats />
        {user.role === 'admin' && (
          <>
            <div className="card">
              <VehicleManager vehicles={vehicles} onVehiclesChanged={handleVehiclesChanged} />
            </div>
            <div className="card">
              <InvitePanel />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard
