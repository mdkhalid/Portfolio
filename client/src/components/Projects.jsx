import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { ExternalLink, X, ChevronRight, Filter } from 'lucide-react'

export default function Projects({ projects }) {
  const { dark } = useTheme()
  const [selected, setSelected] = useState(null)
  const [activeTag, setActiveTag] = useState(null)

  const allTags = useMemo(() => {
    if (!projects?.length) return []
    const tagSet = new Set()
    projects.forEach(p => p.techStack?.forEach(t => tagSet.add(t)))
    return [...tagSet].sort()
  }, [projects])

  const filtered = useMemo(() => {
    if (!activeTag) return projects
    return projects.filter(p => p.techStack?.includes(activeTag))
  }, [projects, activeTag])

  if (!projects?.length) return null

  return (
    <section id="projects" className={`py-20 ${dark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
              Projects
            </span>
          </h2>
          <p className={`text-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Featured work</p>
        </motion.div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <button onClick={() => setActiveTag(null)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                !activeTag
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                  : dark ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700' : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}>
              All
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeTag === tag
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                    : dark ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700' : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                }`}>
                {tag}
              </button>
            ))}
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((p, i) => (
              <motion.div key={p._id}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(p)}
                className={`p-6 rounded-2xl border cursor-pointer transition-all ${dark ? 'bg-gray-900 border-gray-700 hover:border-blue-500/50' : 'bg-white border-gray-200 hover:border-blue-400/50'} shadow-sm hover:shadow-lg group`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className={`text-lg font-bold group-hover:text-blue-500 transition-colors ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{p.name}</h3>
                  <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 flex-shrink-0 mt-1" />
                </div>
                <p className={`text-sm mb-3 line-clamp-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{p.description}</p>
                <div className="flex flex-wrap gap-2">
                  {p.techStack?.slice(0, 5).map(t => (
                    <span key={t} onClick={(e) => { e.stopPropagation(); setActiveTag(t === activeTag ? null : t) }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        activeTag === t
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}>
                      {t}
                    </span>
                  ))}
                  {p.techStack?.length > 5 && (
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${dark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-400'}`}>
                      +{p.techStack.length - 5}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <p className={`text-center py-12 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            No projects match this filter.
          </p>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`max-w-2xl w-full p-8 rounded-2xl ${dark ? 'bg-gray-900 border border-gray-700' : 'bg-white'} shadow-2xl max-h-[80vh] overflow-y-auto`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className={`text-2xl font-bold ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{selected.name}</h3>
                  <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selected.role} &middot; {selected.startDate} - {selected.endDate || 'Present'}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className={`p-1.5 rounded-lg cursor-pointer ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
                  <X size={20} />
                </button>
              </div>
              <p className={`mb-4 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{selected.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {selected.techStack?.map(t => (
                  <span key={t} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>{t}</span>
                ))}
              </div>
              {selected.bullets?.length > 0 && (
                <ul className={`space-y-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {selected.bullets.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-500 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {b}
                  </li>)}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
