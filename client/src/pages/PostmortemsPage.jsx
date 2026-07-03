import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { ArrowLeft, Sun, Moon, Calendar, AlertTriangle, ChevronRight, Search, X, Clock } from 'lucide-react'
import SEO from '../components/SEO'

const SEVERITY_STYLES = {
  SEV1: { dot: 'bg-red-500', text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Critical' },
  SEV2: { dot: 'bg-orange-500', text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Major' },
  SEV3: { dot: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Minor' },
}

const STATUS_STYLES = {
  resolved:    { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'Resolved' },
  mitigated:   { dot: 'bg-cyan-500',    text: 'text-cyan-500',    label: 'Mitigated' },
  monitoring:  { dot: 'bg-blue-500',    text: 'text-blue-500',    label: 'Monitoring' },
  ongoing:     { dot: 'bg-red-500',     text: 'text-red-500',     label: 'Ongoing' },
}

const formatDuration = (mins) => {
  if (!mins || mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

export default function PostmortemsPage() {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [activeSeverity, setActiveSeverity] = useState(null)
  const [activeStatus, setActiveStatus] = useState(null)
  const [search, setSearch] = useState('')
  const limit = 12

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const skip = page * limit
        const params = { limit, skip }
        if (activeSeverity) params.severity = activeSeverity
        if (activeStatus) params.status = activeStatus
        if (search.trim()) params.q = search.trim()
        const { data } = await api.get('/api/postmortems', { params })
        if (page === 0) setItems(data.items)
        else setItems(prev => [...prev, ...data.items])
        setTotal(data.total)
        setHasMore(data.hasMore)
      } catch (err) {
        console.error('Failed to fetch postmortems:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [page, activeSeverity, activeStatus, search])


  const glassClass = dark
    ? 'bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 shadow-2xl hover:border-gray-700/60 transition-all duration-300'
    : 'bg-white/70 backdrop-blur-xl border border-gray-200/50 shadow-lg hover:border-gray-300/60 transition-all duration-300'

  return (
    <>
      <SEO title="Failure Log — Mohammad Khalid" description="Honest, blameless postmortems from real production incidents. What broke, why, and what I learned." />
      <div className={`min-h-screen ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={() => navigate('/')} className={`p-2 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20 flex-shrink-0">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className={`font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Failure Log</h1>
              <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Blameless postmortems from production</p>
            </div>
            <button onClick={toggle} className={`p-2 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-600 dark:text-red-400 border border-red-500/20`}>
              <AlertTriangle size={14} /> What Broke & What I Learned
            </div>
            <h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
              The <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">Failure Log</span>
            </h2>
            <p className={`text-sm max-w-2xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              Honest, blameless postmortems from production incidents I worked on. Every system breaks eventually. The mark of a senior engineer is not the absence of failures — it is the speed and depth of the learning afterwards.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-2xl mx-auto mb-6">
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
              <Search size={16} className={dark ? 'text-gray-500' : 'text-gray-400'} />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); setItems([]) }}
                placeholder="Search by title, system, or impact…"
                className={`flex-1 bg-transparent text-sm outline-none ${dark ? 'text-white placeholder:text-gray-600' : 'text-gray-900 placeholder:text-gray-400'}`}
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(0); setItems([]) }} className={`p-1 rounded ${dark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                  <X size={14} />
                </button>
              )}
            </div>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Severity:</span>
              {['SEV1', 'SEV2', 'SEV3'].map(sev => {
                const s = SEVERITY_STYLES[sev]
                const active = activeSeverity === sev
                return (
                  <button key={sev} onClick={() => { setActiveSeverity(active ? null : sev); setPage(0); setItems([]) }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${active
                      ? `${s.bg} ${s.text} ${s.border} border`
                      : dark ? 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm'
                    }`}>
                    {active && <X size={11} />}
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {sev}
                  </button>
                )
              })}
            </div>

            <div className={`w-px h-5 ${dark ? 'bg-gray-800' : 'bg-gray-200'}`} />

            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Status:</span>
              {Object.entries(STATUS_STYLES).map(([key, s]) => {
                const active = activeStatus === key
                return (
                  <button key={key} onClick={() => { setActiveStatus(active ? null : key); setPage(0); setItems([]) }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${active
                      ? `${s.text} border ${dark ? 'border-current' : 'border-current'} bg-current/10`
                      : dark ? 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <AlertTriangle size={48} className={`mx-auto mb-4 ${dark ? 'text-gray-700' : 'text-gray-300'}`} />
              <p className={`text-lg font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>No postmortems found</p>
              <p className={`text-sm mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {search || activeSeverity || activeStatus ? 'Try clearing your filters' : 'No incidents have been published yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((pm, i) => {
                  const sev = SEVERITY_STYLES[pm.severity] || SEVERITY_STYLES.SEV3
                  const st = STATUS_STYLES[pm.status] || STATUS_STYLES.resolved
                  return (
                    <motion.article
                      key={pm._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate('/postmortems/' + pm.slug)}
                      className={`${glassClass} p-6 rounded-2xl cursor-pointer flex flex-col group relative overflow-hidden`}
                    >
                      <div className={`absolute top-0 left-0 right-0 h-1 ${sev.dot}`} />

                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${sev.bg} ${sev.text} ${sev.border} border`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                          {pm.severity}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${st.text} ${dark ? 'bg-gray-800/60' : 'bg-gray-100'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>

                      <h3 className="font-bold text-base mb-2 group-hover:text-red-500 transition-colors line-clamp-2">{pm.title}</h3>
                      {pm.excerpt && (
                        <p className={`text-sm leading-relaxed mb-4 flex-1 line-clamp-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{pm.excerpt}</p>
                      )}

                      {pm.systemsAffected?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {pm.systemsAffected.slice(0, 3).map(s => (
                            <span key={s} className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${dark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                              {s}
                            </span>
                          ))}
                          {pm.systemsAffected.length > 3 && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${dark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                              +{pm.systemsAffected.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className={`flex items-center justify-between text-xs mt-auto pt-3 border-t ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
                        <span className={`flex items-center gap-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Calendar size={11} /> {formatDate(pm.incidentDate)}
                        </span>
                        <span className={`flex items-center gap-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Clock size={11} /> {formatDuration(pm.durationMinutes)}
                        </span>
                        <span className={`flex items-center gap-1 text-red-500 font-semibold`}>
                          Read <ChevronRight size={11} />
                        </span>
                      </div>
                    </motion.article>
                  )
                })}
              </div>

              {hasMore && (
                <div className="text-center mt-10">
                  <button onClick={() => setPage(p => p + 1)} disabled={loading}
                    className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'}`}>
                    {loading ? 'Loading...' : `Load More (${items.length}/${total})`}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-gray-800/10 dark:border-gray-100/5 text-center">
          <p className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            &copy; {new Date().getFullYear()} Mohammad Khalid. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  )
}
