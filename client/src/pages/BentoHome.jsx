import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { 
  Bot, User, Sparkles, ArrowLeft, Sun, Moon, 
  MapPin, Clock, Briefcase, GraduationCap, Award, 
  FolderGit2, FileText, Mail, Globe, Link2, ExternalLink,
  ChevronRight, Quote, Grid, ArrowDown, ChevronDown, CheckCircle2, Phone, Send, Loader2,
  BookOpen, Calendar, Tag, AlertTriangle
} from 'lucide-react'
import SEO from '../components/SEO'

// Subtitle Specialty Carousel
function SpecialtyCarousel({ dark }) {
  const specialties = [
    'Senior Solution Architect',
    'Enterprise .NET Core Expert',
    'Full-Stack Developer',
    'AI Solutions Integrator'
  ]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % specialties.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-8 overflow-hidden relative mt-1.5 flex items-center justify-center md:justify-start">
      <AnimatePresence mode="wait">
        <motion.p
          key={specialties[index]}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className={`text-lg md:text-xl font-semibold bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 bg-clip-text text-transparent`}
        >
          {specialties[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// Live Time in Delhi India (Asia/Kolkata)
function LiveClock({ dark }) {
  const [time, setTime] = useState('')
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const updateTime = () => {
      const options = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }
      const formatter = new Intl.DateTimeFormat([], options)
      setTime(formatter.format(new Date()))
      setSeconds(prev => prev + 1)
    }

    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className={`p-1.5 rounded-full ${dark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}
        >
          <Clock size={16} />
        </motion.div>
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
        </span>
      </div>
      <div>
        <p className={`text-xs font-semibold ${dark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-widest`}>
          Local Time (Delhi)
        </p>
        <p className={`text-sm font-bold font-mono tracking-tight ${dark ? 'text-white' : 'text-gray-800'}`}>
          {time || 'Loading...'}
        </p>
      </div>
    </div>
  )
}

export default function BentoHome({ onToggleLayout }) {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [data, setData] = useState({ profile: {}, skills: [], experiences: [], education: [], certifications: [], projects: [], resumes: [] })
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  const [activeTag, setActiveTag] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [formStatus, setFormStatus] = useState('idle')
  const [formError, setFormError] = useState('')
  const tracked = useRef(false)

  useEffect(() => {
    if (!tracked.current && !localStorage.getItem('token')) {
      tracked.current = true
      axios.post('/api/analytics/track').catch(() => {})
    }
    const fetchData = async () => {
      try {
        const [profile, skills, experiences, education, certifications, projects, resumes, articles] = await Promise.all([
          axios.get('/api/profile'), axios.get('/api/skills'),
          axios.get('/api/experiences'), axios.get('/api/education'),
          axios.get('/api/certifications'), axios.get('/api/projects'),
          axios.get('/api/resumes'), axios.get('/api/articles', { params: { limit: 3, skip: 0 } }),
        ])
        setData({
          profile: profile.data,
          skills: skills.data,
          experiences: experiences.data,
          education: education.data,
          certifications: certifications.data,
          projects: projects.data,
          resumes: resumes.data,
          articles: articles.data.items,
        })
      } catch (err) {
        console.error('Failed to fetch Bento data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormStatus('sending')
    setFormError('')
    try {
      await axios.post('/api/contact', form)
      setFormStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setFormStatus('idle'), 5000)
    } catch (err) {
      setFormStatus('idle')
      setFormError(err.response?.data?.error || 'Failed to send message')
    }
  }

  const allTags = useMemo(() => {
    if (!data.projects?.length) return []
    const tagSet = new Set()
    data.projects.forEach(p => p.techStack?.forEach(t => tagSet.add(t)))
    return [...tagSet].sort()
  }, [data.projects])

  const filteredProjects = useMemo(() => {
    if (!activeTag) return data.projects
    return data.projects.filter(p => p.techStack?.includes(activeTag))
  }, [data.projects, activeTag])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Grid size={16} className="text-blue-500 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const { visibleSections = {}, name, title, summary, avatar, location, email, phone, linkedIn, github, experienceYears } = data.profile || {}
  const show = (key) => visibleSections[key] !== false

  const glassClass = dark 
    ? 'bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 shadow-2xl hover:border-gray-700/60 transition-all duration-300' 
    : 'bg-white/70 backdrop-blur-xl border border-gray-200/50 shadow-lg hover:border-gray-300/60 transition-all duration-300'

  const cardTitleClass = `text-xs font-bold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'} mb-2 flex items-center gap-1.5`

  return (
    <>
      <SEO
        title={`${name || 'Mohammad Khalid'} — Bento Grid Layout`}
        description={summary || 'Software Developer Portfolio showcasing projects, skills, and experience'}
        image={avatar}
      />

      {/* Modern Bento Atmosphere Grid and fluid blur circles */}
      <div className={`min-h-screen relative overflow-hidden font-sans ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          {/* Blueprint Grid Lines Overlay */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
            backgroundImage: `linear-gradient(to right, ${dark ? '#fff' : '#000'} 1px, transparent 1px), linear-gradient(to bottom, ${dark ? '#fff' : '#000'} 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} />
        </div>

        {/* Minimalist Top Sticky Header — hidden when Navbar is present */}
        {!onToggleLayout && (
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${
          dark ? 'bg-gray-950/70 border-gray-900' : 'bg-white/70 border-gray-200'
        }`}>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Grid size={16} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                  {name || 'Mohammad Khalid'}
                </span>
                <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'} font-medium`}>Senior Solution Architect</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Back to Classic Page */}
              <button 
                onClick={() => onToggleLayout ? onToggleLayout() : navigate('/')} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all border cursor-pointer ${
                  dark ? 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <ArrowLeft size={12} /> Classic Layout
              </button>

              {/* Theme toggle */}
              <button onClick={toggle} className={`p-2 rounded-full cursor-pointer transition-colors ${
                dark ? 'bg-gray-900 text-yellow-400 hover:bg-gray-800' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}>
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>
        </header>
        )}

        {/* Main Bento Grid layout */}
        <main className={`max-w-6xl mx-auto px-4 ${onToggleLayout ? 'pt-20' : ''} py-8 relative z-10`}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

            {/* Profile Avatar Card (Col span: 2) */}
            {show('hero') && (
              <motion.div 
                id="hero"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`md:col-span-2 p-6 md:p-8 rounded-3xl flex flex-col justify-between ${glassClass}`}
              >
                <div>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-5">
                    {avatar && (
                      <div className="relative">
                        <img 
                          src={avatar} 
                          alt={name} 
                          className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover border-2 border-blue-500/20 shadow-xl" 
                        />
                        <span className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-gray-900"></span>
                        </span>
                      </div>
                    )}
                    <div className="text-center sm:text-left flex-1 min-w-0">
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 ${
                        dark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        Available for Work
                      </div>
                      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                        <span className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                          {name}
                        </span>
                      </h1>
                      <SpecialtyCarousel dark={dark} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4 pt-4 border-t border-gray-800/10 dark:border-gray-100/5">
                  <button onClick={() => { const el = document.getElementById('contact'); el?.scrollIntoView({ behavior: 'smooth' }); }} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all shadow-md shadow-blue-500/10 cursor-pointer text-center">
                    <Mail size={13} /> Email Me
                  </button>
                  <button onClick={() => navigate('/chat')} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer text-center transition-all ${
                    dark 
                      ? 'bg-gray-800/80 border-gray-700 text-gray-200 hover:bg-gray-800 hover:text-white' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
                  }`}>
                    <Bot size={13} /> AI Assistant
                  </button>
                  <button onClick={() => navigate('/resume')} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-semibold border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer text-center ${
                    dark ? 'bg-emerald-500/5' : 'bg-emerald-50'
                  }`}>
                    <FileText size={13} /> Resume PDF
                  </button>
                </div>
              </motion.div>
            )}

            {/* Time & Clock Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`p-6 rounded-3xl flex flex-col justify-between ${glassClass}`}
            >
              <div className={cardTitleClass}>
                <MapPin size={13} className="text-cyan-500" /> Location & Time
              </div>
              <div className="my-3">
                <p className={`text-base font-bold tracking-tight ${dark ? 'text-white' : 'text-gray-800'}`}>
                  {location || 'Delhi, India'}
                </p>
                <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                  Timezone: GMT+5:30 (IST)
                </p>
              </div>
              <LiveClock dark={dark} />
            </motion.div>

            {/* Micro Experience Stats Card */}
            {show('summary') && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`p-6 rounded-3xl flex flex-col justify-between ${glassClass}`}
              >
                <div className={cardTitleClass}>
                  <Sparkles size={13} className="text-yellow-500" /> Career Highlights
                </div>
                <div className="flex items-end justify-between my-2">
                  <div>
                    <span className="text-4xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent font-mono leading-none">
                      {experienceYears}+
                    </span>
                    <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'} font-semibold mt-1`}>Years of Experience</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent font-mono leading-none">
                      15+
                    </span>
                    <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'} font-medium mt-0.5`}>Enterprise Projects</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between text-[11px]">
                  <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Avg. Architecture Load</span>
                  <span className="font-semibold text-emerald-500 font-mono">99.9% Sla</span>
                </div>
              </motion.div>
            )}

            {/* Summary / Executive Bio Card */}
            {show('summary') && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={`md:col-span-2 p-6 md:p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between ${glassClass}`}
              >
                <Quote className={`absolute -right-3 -top-3 opacity-[0.03] dark:opacity-[0.05] ${dark ? 'text-white' : 'text-black'}`} size={120} />
                <div>
                  <div className={cardTitleClass}>
                    <Quote size={13} className="text-blue-500" /> Architect Profile
                  </div>
                  <p className={`text-sm leading-relaxed mt-2.5 italic font-medium ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                    "{summary}"
                  </p>
                </div>
                <div className="mt-4 pt-3.5 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Core Philosophy</span>
                  <span className="text-xs font-bold text-blue-500 font-mono">Scalable, Clean & Secure</span>
                </div>
              </motion.div>
            )}

            {/* Technical Skills Bento Grid (Col span: 2) */}
            {show('skills') && data.skills?.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`md:col-span-2 p-6 rounded-3xl flex flex-col justify-between ${glassClass}`}
              >
                <div>
                  <div className={cardTitleClass}>
                    <Grid size={13} className="text-emerald-500" /> Core Competencies
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mt-3">
                    {data.skills.slice(0, 4).map(cat => (
                      <div key={cat._id} className={`p-3.5 rounded-2xl ${dark ? 'bg-gray-950/40 border border-gray-800/60' : 'bg-white border border-gray-200/50 shadow-sm'}`}>
                        <span className={`text-xs font-bold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>{cat.category}</span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cat.items?.slice(0, 3).map(skill => (
                            <span key={skill.name} className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                              dark ? 'bg-gray-900 text-gray-300 border border-gray-800' : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3 text-center sm:text-right">
                  <a href="#skills-anchor" onClick={() => {
                    const el = document.getElementById('skills')
                    el?.scrollIntoView({ behavior: 'smooth' })
                  }} className="inline-flex items-center gap-1 text-xs font-bold text-cyan-500 hover:underline cursor-pointer">
                    View All Skill Categories <ChevronRight size={13} />
                  </a>
                </div>
              </motion.div>
            )}

            {/* Dynamic Projects Bento Box (Col span: 3/4) */}
            {show('projects') && data.projects?.length > 0 && (
              <motion.div 
                id="projects"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className={`md:col-span-3 lg:col-span-4 p-6 md:p-8 rounded-3xl ${glassClass}`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className={cardTitleClass}>
                      <FolderGit2 size={13} className="text-purple-500" /> Featured Projects
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight">Enterprise & AI Engineering Solutions</h2>
                  </div>

                  {/* Filter Tags */}
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-w-xl">
                      <button 
                        onClick={() => setActiveTag(null)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          !activeTag 
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md' 
                            : dark ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-600'
                        }`}
                      >
                        All
                      </button>
                      {allTags.slice(0, 8).map(tag => (
                        <button 
                          key={tag} 
                          onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            tag === activeTag 
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md' 
                              : dark ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grid list of project blocks */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects?.slice(0, 6).map((proj, i) => (
                    <motion.div 
                      key={proj._id}
                      layout
                      onClick={() => setSelectedProject(proj)}
                      className={`p-5 rounded-2xl cursor-pointer transition-all border group relative flex flex-col justify-between min-h-[170px] ${
                        dark 
                          ? 'bg-gray-950/40 border-gray-900 hover:border-blue-500/50' 
                          : 'bg-white border-gray-200 hover:border-blue-400/50 hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className={`font-bold group-hover:text-blue-500 text-base transition-colors ${dark ? 'text-gray-100' : 'text-gray-850'}`}>
                            {proj.name}
                          </h3>
                          <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                        </div>
                        <p className={`text-sm leading-relaxed line-clamp-3 mb-4 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {proj.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {proj.techStack?.slice(0, 3).map(badge => (
                          <span key={badge} className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            dark ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {badge}
                          </span>
                        ))}
                        {proj.techStack?.length > 3 && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${dark ? 'bg-gray-900 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                            +{proj.techStack.length - 3}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Timeline Careers Bento Card (Col span: 2) */}
            {(show('experience') || show('education')) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`md:col-span-2 p-6 rounded-3xl flex flex-col justify-between ${glassClass}`}
              >
                <div>
                  <div className={cardTitleClass}>
                    <Briefcase size={13} className="text-yellow-500" /> Recent Work Experience
                  </div>
                  <div className="space-y-4 mt-3">
                    {data.experiences?.slice(0, 2).map((exp, index) => (
                      <div key={exp._id} className="relative pl-5 border-l-2 border-blue-500/20">
                        <div className="absolute left-[-5px] top-[5px] w-2 h-2 rounded-full bg-blue-500 shadow-md shadow-blue-500/50" />
                        <span className={`text-xs font-semibold font-mono uppercase ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
                          {exp.startDate} - {exp.endDate || 'Present'}
                        </span>
                        <h4 className={`text-sm font-bold mt-0.5 ${dark ? 'text-gray-150' : 'text-gray-800'}`}>
                          {exp.role} @ {exp.company}
                        </h4>
                        <p className={`text-sm mt-0.5 line-clamp-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {exp.location} &middot; {exp.bullets?.[0] || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3.5 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between text-xs">
                  <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Scroll down for full Career Chronology</span>
                  <a href="#timeline-anchor" onClick={() => {
                    const el = document.getElementById('experience')
                    el?.scrollIntoView({ behavior: 'smooth' })
                  }} className="font-bold text-cyan-500 hover:underline cursor-pointer">
                    Explore Timeline
                  </a>
                </div>
              </motion.div>
            )}

            {/* Certifications and Credentials Bento Card */}
            {show('certifications') && data.certifications?.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className={`p-6 rounded-3xl flex flex-col justify-between ${glassClass}`}
              >
                <div className={cardTitleClass}>
                  <Award size={13} className="text-blue-500" /> Top Credentials
                </div>
                <div className="space-y-3.5 my-2">
                  {data.certifications.slice(0, 3).map(cert => (
                    <div key={cert._id} className="group">
                      <p className={`text-xs font-bold truncate ${dark ? 'text-gray-200' : 'text-gray-700'}`}>
                        {cert.name}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{cert.issuer}</span>
                        {cert.link && (
                          <a href={cert.link} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400">
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between text-xs">
                  <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Verified Issuer Network</span>
                  <span className="font-semibold text-blue-400 uppercase tracking-widest">Microsoft</span>
                </div>
              </motion.div>
            )}

            {/* Blog Bento Card */}
            {show('blog') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => navigate('/blog')}
                className={`p-6 rounded-3xl flex flex-col justify-between cursor-pointer group ${glassClass}`}
              >
                <div className={cardTitleClass}>
                  <BookOpen size={13} className="text-orange-500" /> Latest Articles
                </div>
                <div className="my-2 flex-1">
                  <p className={`text-sm font-bold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>Technical Insights</p>
                  <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Architecture, .NET, AI & more</p>
                </div>
                <div className="pt-2 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between text-xs">
                  <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Read articles</span>
                  <span className="font-semibold text-orange-400 uppercase tracking-widest group-hover:translate-x-1 transition-transform"><ChevronRight size={13} /></span>
                </div>
              </motion.div>
            )}

            {/* Postmortems Bento Card */}
            {show('blog') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                onClick={() => navigate('/postmortems')}
                className={`p-6 rounded-3xl flex flex-col justify-between cursor-pointer group ${glassClass}`}
              >
                <div className={cardTitleClass}>
                  <AlertTriangle size={13} className="text-red-500" /> Failure Log
                </div>
                <div className="my-2 flex-1">
                  <p className={`text-sm font-bold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>Production Postmortems</p>
                  <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>What broke, why, and what I learned</p>
                </div>
                <div className="pt-2 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between text-xs">
                  <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Browse incidents</span>
                  <span className="font-semibold text-red-400 uppercase tracking-widest group-hover:translate-x-1 transition-transform"><ChevronRight size={13} /></span>
                </div>
              </motion.div>
            )}

            {/* Connect & Social Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className={`p-6 rounded-3xl flex flex-col justify-between ${glassClass}`}
            >
              <div className={cardTitleClass}>
                <Mail size={13} className="text-cyan-500" /> Digital Footprint
              </div>
              <div className="space-y-2.5 my-2">
                {linkedIn && (
                  <a href={linkedIn} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold border transition-all ${
                    dark ? 'bg-gray-950/40 border-gray-800/80 hover:bg-gray-800/80 text-gray-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm'
                  }`}>
                    <Link2 size={13} className="text-blue-500" /> LinkedIn Profile
                  </a>
                )}
                {github && (
                  <a href={github} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold border transition-all ${
                    dark ? 'bg-gray-950/40 border-gray-800/80 hover:bg-gray-800/80 text-gray-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm'
                  }`}>
                    <Globe size={13} className="text-violet-500" /> GitHub Repository
                  </a>
                )}
              </div>
              <div className="pt-2 border-t border-gray-800/10 dark:border-gray-100/5 flex items-center justify-between text-xs">
                <span className={dark ? 'text-gray-500' : 'text-gray-400'}>Contact Matrix</span>
                <span className="font-semibold text-emerald-500 font-mono">Secure SSL</span>
              </div>
            </motion.div>

          </div>

          {/* Detailed Skill Categories Subsection */}
          {show('skills') && data.skills?.length > 0 && (
            <section id="skills" className="mt-16 pt-10 border-t border-gray-800/10 dark:border-gray-100/5">
              <div className="text-center mb-8">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 ${
                  dark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  Complete Skill Tree
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Full Technology Stack Inventory</h2>
                <p className={`text-xs mt-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Detailed technical breakdown across domains</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.skills.map(cat => (
                  <div key={cat._id} className={`p-6 rounded-3xl ${glassClass}`}>
                    <h3 className="font-bold text-base mb-4 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">{cat.category}</h3>
                    <div className="space-y-3">
                      {cat.items?.map(skill => (
                        <div key={skill.name}>
                          <div className="flex items-center justify-between text-xs mb-1 font-medium">
                            <span className={dark ? 'text-gray-300' : 'text-gray-700'}>{skill.name}</span>
                            <span className="font-bold font-mono text-cyan-400">{skill.level}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-800/10 dark:bg-gray-100/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: `${skill.level}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Detailed Careers Chronology Section */}
          {(show('experience') || show('education')) && (
            <section id="experience" className="mt-16 pt-10 border-t border-gray-800/10 dark:border-gray-100/5">
              <div className="text-center mb-8">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 ${
                  dark ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  Chronology
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Professional Career & Education</h2>
                <p className={`text-xs mt-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Chronological pathway of architectural achievements</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Experience Column */}
                {show('experience') && data.experiences?.length > 0 && (
                  <div className={`p-6 md:p-8 rounded-3xl ${glassClass}`}>
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-gray-800/10 dark:border-gray-100/5 pb-3">
                      <Briefcase size={16} className="text-yellow-500" /> Work History
                    </h3>
                    <div className="space-y-6 relative border-l-2 border-gray-800/10 dark:border-gray-100/5 pl-6 ml-2">
                      {data.experiences.map((exp, idx) => (
                        <div key={exp._id} className="relative">
                          <div className="absolute left-[-31px] top-[4px] w-4 h-4 rounded-full bg-yellow-500 border-4 border-gray-950 flex items-center justify-center" />
                          <span className="text-xs font-bold uppercase tracking-wider text-yellow-500 font-mono bg-yellow-500/5 px-2 py-0.5 rounded border border-yellow-500/10">
                            {exp.startDate} - {exp.endDate || 'Present'}
                          </span>
                          <h4 className="text-base font-extrabold mt-2 leading-snug">{exp.role}</h4>
                          <p className={`text-xs font-semibold ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>{exp.company} &middot; {exp.location}</p>
                          <ul className="mt-3.5 space-y-2">
                            {exp.bullets?.map((b, i) => (
                              <li key={i} className={`text-sm leading-relaxed flex items-start gap-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education Column */}
                {show('education') && data.education?.length > 0 && (
                  <div className={`p-6 md:p-8 rounded-3xl ${glassClass} self-start`}>
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-gray-800/10 dark:border-gray-100/5 pb-3">
                      <GraduationCap size={16} className="text-blue-500" /> Education
                    </h3>
                    <div className="space-y-6 relative border-l-2 border-gray-800/10 dark:border-gray-100/5 pl-6 ml-2">
                      {data.education.map((edu, idx) => (
                        <div key={edu._id} className="relative">
                          <div className="absolute left-[-31px] top-[4px] w-4 h-4 rounded-full bg-blue-500 border-4 border-gray-950" />
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                            {edu.startDate} - {edu.endDate}
                          </span>
                          <h4 className="text-base font-extrabold mt-2 leading-snug">{edu.degree}</h4>
                          <p className={`text-xs font-semibold ${dark ? 'text-gray-300' : 'text-gray-600'} mt-0.5`}>
                            {edu.field ? `${edu.field} &middot; ` : ''}{edu.institution}
                          </p>
                          {edu.location && (
                            <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>{edu.location}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Blog Section */}
          {show('blog') && data.articles?.length > 0 && (
            <section id="blog" className="mt-16 pt-10 border-t border-gray-800/10 dark:border-gray-100/5">
              <div className="text-center mb-8">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 ${
                  dark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  Blog
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Technical Insights</h2>
                <p className={`text-xs mt-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Thoughts on architecture, engineering, and technology</p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {data.articles.slice(0, 3).map((article, i) => (
                  <motion.div
                    key={article._id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => navigate('/blog/' + article.slug)}
                    className={`p-6 rounded-3xl cursor-pointer flex flex-col group ${glassClass}`}
                  >
                    {article.coverImage && (
                      <div className="mb-4 -mx-6 -mt-6 rounded-t-2xl overflow-hidden h-36">
                        <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs mb-3">
                      <span className={`flex items-center gap-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Calendar size={12} /> {new Date(article.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      {article.tags?.length > 0 && (
                        <span className={`flex items-center gap-1 ${dark ? 'text-orange-400' : 'text-orange-600'}`}>
                          <Tag size={12} /> {article.tags[0]}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base mb-2 group-hover:text-orange-500 transition-colors line-clamp-2">{article.title}</h3>
                    {article.excerpt && (
                      <p className={`text-sm leading-relaxed mb-4 flex-1 line-clamp-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{article.excerpt}</p>
                    )}
                    <div className={`flex items-center gap-1 text-xs font-semibold mt-auto pt-3 border-t ${dark ? 'border-gray-800 text-orange-400' : 'border-gray-200 text-orange-600'}`}>
                      Read More <ChevronRight size={12} />
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="text-center mt-10">
                <button onClick={() => navigate('/blog')}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    dark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}>
                  <BookOpen size={16} /> View All Articles
                </button>
              </div>
            </section>
          )}

          {/* Contact Section */}
          {show('contact') && (
                    <section id="contact" className="mt-16 pt-10 border-t border-gray-800/10 dark:border-gray-100/5">
              <div className="text-center mb-8">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 ${
                  dark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  Connect
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Get In Touch</h2>
                <p className={`text-xs mt-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Let's work together</p>
              </div>
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Contact Info */}
                <div className={`p-6 md:p-8 rounded-3xl ${glassClass}`}>
                  <h3 className={`text-base font-bold mb-5 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Contact Information</h3>
                  <div className="space-y-4">
                    {email && (
                      <a href={`mailto:${email}`} className={`flex items-center gap-4 p-3.5 rounded-2xl transition-colors ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                        <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
                          <Mail size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Email</p>
                          <p className={`text-sm font-medium truncate ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{email}</p>
                        </div>
                      </a>
                    )}
                    {phone && (
                      <div className={`flex items-center gap-4 p-3.5 rounded-2xl ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                        <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-white">
                          <Phone size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Phone</p>
                          <p className={`text-sm font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{phone}</p>
                        </div>
                      </div>
                    )}
                    {location && (
                      <div className={`flex items-center gap-4 p-3.5 rounded-2xl ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                        <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white">
                          <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Location</p>
                          <p className={`text-sm font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{location}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Form */}
                <div className={`p-6 md:p-8 rounded-3xl ${glassClass}`}>
                  <h3 className={`text-base font-bold mb-4 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Send a Message</h3>
                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3.5">
                      <input type="text" placeholder="Your Name" required value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                      <input type="email" placeholder="Your Email" required value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                    </div>
                    <input type="text" placeholder="Subject (optional)" value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                    <textarea placeholder="Your message..." required rows={4} value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm resize-none ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                    {formError && (
                      <p className="text-sm text-red-500">{formError}</p>
                    )}
                    <button type="submit" disabled={formStatus === 'sending'}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
                      {formStatus === 'sending' ? (
                        <><Loader2 size={16} className="animate-spin" /> Sending...</>
                      ) : formStatus === 'sent' ? (
                        <><CheckCircle size={16} /> Message Sent!</>
                      ) : (
                        <><Send size={16} /> Send Message</>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </section>
          )}

          {/* Quick Footer Message */}
          <footer className="mt-20 pt-8 border-t border-gray-800/10 dark:border-gray-100/5 text-center">
            <p className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
              &copy; {new Date().getFullYear()} {name || 'Mohammad Khalid'}. All rights reserved &middot; Built with React & Tailwind v4
            </p>
          </footer>

        </main>
      </div>

      {/* High-Fidelity Project Details Dialog Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`max-w-2xl w-full p-6 md:p-8 rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto ${
                dark ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
            >
              <div className="flex items-start justify-between mb-4 border-b border-gray-850/10 dark:border-gray-100/5 pb-3">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight">{selectedProject.name}</h3>
                  <p className={`text-xs mt-1 font-semibold ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    Role: {selectedProject.role} &middot; {selectedProject.startDate} - {selectedProject.endDate || 'Present'}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedProject(null)} 
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    dark ? 'hover:bg-gray-850 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <ArrowLeft size={16} />
                </button>
              </div>
              
              <div className="my-4">
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-650'}`}>
                  {selectedProject.description}
                </p>
              </div>

              <div className="my-4">
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Tech Stack Used</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProject.techStack?.map(t => (
                    <span key={t} className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                      dark ? 'bg-gray-950 text-cyan-400 border border-gray-800' : 'bg-gray-50 text-cyan-600 border border-gray-200'
                    }`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {selectedProject.bullets?.length > 0 && (
                <div className="my-4 pt-3.5 border-t border-gray-800/10 dark:border-gray-100/5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Key Highlights</p>
                  <ul className="space-y-2.5">
                    {selectedProject.bullets.map((b, i) => (
                      <li key={i} className={`text-xs leading-relaxed flex items-start gap-2.5 ${dark ? 'text-gray-300' : 'text-gray-650'}`}>
                        <CheckCircle2 size={13} className="text-cyan-500 mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
