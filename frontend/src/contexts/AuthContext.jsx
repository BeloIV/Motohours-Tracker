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

  const apiUrl = import.meta.env.VITE_API_URL || '/api'

  axios.defaults.baseURL = apiUrl

  // Attach token to every request
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
      // Only 401 means the session is gone; 403 is "not allowed" (e.g. not an
      // admin) and a failed login is a 401 that must not show "session expired"
      const isLogin = error.config?.url?.endsWith('/auth/login')
      if (error.response?.status === 401 && !isLogin && localStorage.getItem('token')) {
        localStorage.removeItem('token')
        setUser(null)
        toast.error('Relácia vypršala. Prihláste sa znova.')
      }
      return Promise.reject(error)
    }
  )

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      checkAuth()
    } else {
      setLoading(false)
    }
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

  const login = async (username, password) => {
    try {
      const response = await axios.post('/auth/login', { username, password })
      const { token, user } = response.data
      localStorage.setItem('token', token)
      setUser(user)
      toast.success(`Vitajte, ${user.username}!`)
      return true
    } catch (error) {
      toast.error(error.response?.data?.error || 'Prihlásenie zlyhalo')
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    toast.success('Odhlásenie úspešné!')
  }

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
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
