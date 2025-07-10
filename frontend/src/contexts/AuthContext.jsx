import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export { AuthContext }

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Set up axios defaults
  const apiUrl = import.meta.env.VITE_API_URL || 
    (import.meta.env.DEV ? '/api' : 'https://regulusbackend.bytboyzserver.xyz/api')
  
  axios.defaults.baseURL = apiUrl
  console.log('API Base URL set to:', apiUrl)

  // Add token to requests if it exists
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Handle token expiration
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token')
        setUser(null)
        toast.error('Session expired. Please login again.')
      }
      return Promise.reject(error)
    }
  )

  // Check if user is authenticated on app load
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      checkAuth()
    } else {
      setLoading(false)
    }
    // Load users after a short delay to ensure axios is configured
    setTimeout(() => {
      loadUsers()
    }, 100)
  }, [])

  const checkAuth = async () => {
    try {
      const response = await axios.get('/auth/me')
      setUser(response.data.user)
    } catch (error) {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      const fullUrl = axios.defaults.baseURL + '/auth/users'
      console.log('Loading users from:', fullUrl)
      console.log('Axios base URL:', axios.defaults.baseURL)
      
      // First, let's test if the API is reachable
      try {
        const healthCheck = await axios.get('/', { timeout: 5000 })
        console.log('API health check response:', healthCheck.status)
      } catch (healthError) {
        console.warn('API health check failed:', healthError.message)
      }
      
      const response = await axios.get('/auth/users', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      console.log('Users response:', response.data)
      
      if (response.data && response.data.users) {
        setUsers(response.data.users)
        console.log('Users loaded successfully:', response.data.users)
      } else {
        console.warn('No users found in response:', response.data)
        setUsers([])
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      console.error('Error headers:', error.response?.headers)
      console.error('Full error:', error)
      setUsers([]) // Ensure users is always an array
      toast.error('Failed to load users. Please refresh the page.')
    } finally {
      setUsersLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const response = await axios.post('/auth/login', { username, password })
      const { token, user } = response.data
      
      localStorage.setItem('token', token)
      setUser(user)
      toast.success(`Welcome, ${user.username}!`)
      return true
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed'
      toast.error(message)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    toast.success('Logged out successfully!')
  }

  const value = {
    user,
    users,
    isAuthenticated: !!user,
    loading,
    usersLoading,
    login,
    logout,
    checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 