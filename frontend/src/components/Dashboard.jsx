import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import EntriesForm from './EntriesForm'
import EntriesTable from './EntriesTable'
import ChargingControl from './ChargingControl'
import ChargingTable from './ChargingTable'
import axios from 'axios'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [chargingSessions, setChargingSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentChargingPage, setCurrentChargingPage] = useState(1)
  const entriesPerPage = 5

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadEntries(),
        loadChargingSessions(),
        loadActiveSession()
      ])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadEntries = async () => {
    try {
      const response = await axios.get('/entries')
      setEntries(response.data.entries)
    } catch (error) {
      console.error('Failed to load entries:', error)
      throw error
    }
  }

  const loadChargingSessions = async () => {
    try {
      const response = await axios.get('/charging')
      setChargingSessions(response.data.sessions)
    } catch (error) {
      console.error('Failed to load charging sessions:', error)
      throw error
    }
  }

  const loadActiveSession = async () => {
    try {
      const response = await axios.get('/charging/active')
      setActiveSession(response.data.session)
    } catch (error) {
      console.error('Failed to load active session:', error)
      setActiveSession(null)
    }
  }

  const handleEntryAdded = async (newEntry) => {
    setEntries(prev => [newEntry, ...prev])
    toast.success('Entry added successfully!')
  }

  const handleEntryDeleted = async (entryId) => {
    setEntries(prev => prev.filter(entry => entry.id !== entryId))
    toast.success('Entry deleted successfully!')
  }



  const handleChargingStarted = async (session) => {
    setActiveSession(session)
    setChargingSessions(prev => [session, ...prev])
    toast.success('Charging started!')
  }

  const handleChargingStopped = async (session) => {
    setActiveSession(null)
    setChargingSessions(prev => 
      prev.map(s => s.id === session.id ? session : s)
    )
    toast.success(session.message || 'Charging stopped!')
  }

  const handleChargingSessionDeleted = async (sessionId) => {
    setChargingSessions(prev => prev.filter(session => session.id !== sessionId))
    toast.success('Charging session deleted successfully!')
  }



  if (loading) {
    return (
      <div className="main-content">
        <div className="form-card">
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="main-content">
      <div className="form-card">
        <h2>Pridať nový záznam</h2>
        <div className="user-display">
          <p>Prihlásený ako: <strong>{user.username}</strong></p>
        </div>
        
        <EntriesForm onEntryAdded={handleEntryAdded} />
        
        <ChargingControl 
          activeSession={activeSession}
          onChargingStarted={handleChargingStarted}
          onChargingStopped={handleChargingStopped}
        />
      </div>

      <div className="table-card">
        <h2>Všetky záznamy</h2>
        
        <EntriesTable 
          entries={entries}
          currentUser={user.username}
          onEntryDeleted={handleEntryDeleted}
          currentPage={currentPage}
          entriesPerPage={entriesPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <div className="charging-table-card">
        <h2>Nabíjacie relácie</h2>
        
        <ChargingTable 
          sessions={chargingSessions}
          currentUser={user.username}
          onSessionDeleted={handleChargingSessionDeleted}
          currentPage={currentChargingPage}
          entriesPerPage={entriesPerPage}
          onPageChange={setCurrentChargingPage}
        />
      </div>
    </div>
  )
}

export default Dashboard 