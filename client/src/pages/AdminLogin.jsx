import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ArrowLeft, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import SEO from '../components/SEO'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/admin/dashboard')
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <SEO title="Admin Login - Mohammad Khalid Portfolio" description="Sign in to manage your portfolio" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
      </div>

      <button onClick={toggle} className={`absolute top-4 right-4 p-2.5 rounded-full transition-colors z-10 cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400' : 'bg-white text-gray-600 shadow-md'}`}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button onClick={() => navigate('/')} className={`absolute top-4 left-4 p-2.5 rounded-full transition-colors z-10 cursor-pointer ${dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 shadow-md hover:bg-gray-50'}`}>
        <ArrowLeft size={18} />
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-sm p-8 rounded-2xl border shadow-xl relative z-10 ${dark ? 'bg-gray-800/80 backdrop-blur-xl border-gray-700' : 'bg-white/80 backdrop-blur-xl border-gray-200'}`}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">Admin Login</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Sign in to manage your portfolio</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${dark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              placeholder="admin" required />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${dark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              placeholder="••••••" required />
          </div>
          {error && <p className="text-blue-500 text-sm text-center">{error}</p>}
          <button type="submit"
            className="w-full py-2.5 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25 cursor-pointer">
            Sign In
          </button>
        </form>
      </motion.div>
    </div>
  )
}
