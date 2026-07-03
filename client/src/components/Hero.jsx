import { motion } from 'framer-motion'
import { ArrowDown, Globe, Link2, Mail, FileText } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

export default function Hero({ profile, resumeVisible }) {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section id="hero" className={`min-h-screen flex items-center justify-center relative overflow-hidden ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-6 ${dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
            {profile?.experienceYears || 18}+ Years of Experience
          </div>
        </motion.div>

        {profile?.avatar && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.05 }}
            className="flex justify-center mb-6">
            <img src={profile.avatar} alt={profile.name}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-blue-500/30 shadow-xl shadow-blue-500/20" />
          </motion.div>
        )}

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold mb-4">
          <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
            {profile?.name || 'Mohammad Khalid'}
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className={`text-xl md:text-2xl font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
          {profile?.title || 'Senior Solution Architect'}
        </motion.p>

        <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className={`text-base max-w-2xl mx-auto mb-8 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          {profile?.location || 'Delhi, India'}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
          className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={() => scrollTo('contact')}
            className="px-6 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25 cursor-pointer">
            Get In Touch
          </button>
          <button onClick={() => scrollTo('projects')}
            className={`px-6 py-3 rounded-xl font-medium border-2 transition-all cursor-pointer ${dark ? 'border-gray-700 text-gray-300 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
            View Projects
          </button>
          {resumeVisible !== false && (
            <button onClick={() => navigate('/resume')}
              className="px-6 py-3 rounded-xl font-medium border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 cursor-pointer">
              <FileText size={18} /> View Resume
            </button>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-4 mt-8">
          {profile?.linkedIn && (
            <a href={profile.linkedIn} target="_blank" rel="noopener noreferrer" title="LinkedIn"
              className={`p-2.5 rounded-full transition-colors ${dark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-800'}`}>
              <Link2 size={20} />
            </a>
          )}
          {profile?.github && (
            <a href={profile.github} target="_blank" rel="noopener noreferrer" title="GitHub"
              className={`p-2.5 rounded-full transition-colors ${dark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-800'}`}>
              <Globe size={20} />
            </a>
          )}
          <button onClick={() => scrollTo('contact')}
            className={`p-2.5 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-800'}`}>
            <Mail size={20} />
          </button>
        </motion.div>
      </div>

      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        onClick={() => scrollTo('summary')}
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 p-2 rounded-full animate-bounce cursor-pointer ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
        <ArrowDown size={24} />
      </motion.button>
    </section>
  )
}
