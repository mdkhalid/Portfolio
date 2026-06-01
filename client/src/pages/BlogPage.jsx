import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Sun, Moon, Calendar, Tag, Clock, FileText, ChevronRight, Sparkles, Search, X } from 'lucide-react'
import SEO from '../components/SEO'

export default function BlogPage() {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [activeTag, setActiveTag] = useState(null)
  const limit = 12

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true)
      try {
        const skip = page * limit
        const params = { limit, skip }
        if (activeTag) params.tag = activeTag
        const { data } = await axios.get('/api/articles', { params })
        if (page === 0) {
          setArticles(data.items)
        } else {
          setArticles(prev => [...prev, ...data.items])
        }
        setTotal(data.total)
        setHasMore(data.hasMore)
      } catch (err) {
        console.error('Failed to fetch articles:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchArticles()
  }, [page, activeTag])

  const allTags = useMemo(() => {
    const tagSet = new Set()
    articles.forEach(a => a.tags?.forEach(t => tagSet.add(t)))
    return [...tagSet].sort()
  }, [articles])

  const handleTagFilter = (tag) => {
    setActiveTag(tag === activeTag ? null : tag)
    setPage(0)
    setArticles([])
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const glassClass = dark
    ? 'bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 shadow-2xl hover:border-gray-700/60 transition-all duration-300'
    : 'bg-white/70 backdrop-blur-xl border border-gray-200/50 shadow-lg hover:border-gray-300/60 transition-all duration-300'

  return (
    <>
      <SEO title="Blog — Mohammad Khalid" description="Technical articles and insights on software architecture, .NET, AI, and more" />
      <div className={`min-h-screen ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={() => navigate('/')} className={`p-2 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
              <FileText size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className={`font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Technical Blog</h1>
              <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Articles on architecture, .NET, AI, and engineering</p>
            </div>
            <button onClick={toggle} className={`p-2 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4 bg-gradient-to-r from-orange-500/10 to-rose-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20`}>
              <Sparkles size={14} /> Insights & Architectures
            </div>
            <h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Thoughts on <span className="bg-gradient-to-r from-orange-500 to-rose-400 bg-clip-text text-transparent">Software Engineering</span>
            </h2>
            <p className={`text-sm max-w-xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              Deep dives into solution architecture, enterprise development, AI integration, and engineering best practices.
            </p>
          </motion.div>

          {allTags.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap justify-center gap-2 mb-10">
              {allTags.map(tag => (
                <button key={tag} onClick={() => handleTagFilter(tag)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${tag === activeTag
                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20'
                    : dark ? 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm'
                  }`}>
                  {tag === activeTag && <X size={12} className="inline mr-1" />}
                  {tag}
                </button>
              ))}
            </motion.div>
          )}

          {loading && articles.length === 0 ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20">
              <FileText size={48} className={`mx-auto mb-4 ${dark ? 'text-gray-700' : 'text-gray-300'}`} />
              <p className={`text-lg font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>No articles yet</p>
              <p className={`text-sm mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Check back soon for new content</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article, i) => (
                  <motion.article
                    key={article._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate('/blog/' + article.slug)}
                    className={`${glassClass} p-6 rounded-2xl cursor-pointer flex flex-col group`}
                  >
                    {article.coverImage && (
                      <div className="mb-4 -mx-6 -mt-6 rounded-t-2xl overflow-hidden h-40">
                        <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs mb-3">
                      <span className={`flex items-center gap-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Calendar size={12} /> {formatDate(article.createdAt)}
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
                  </motion.article>
                ))}
              </div>

              {hasMore && (
                <div className="text-center mt-10">
                  <button onClick={() => setPage(p => p + 1)} disabled={loading}
                    className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'}`}>
                    {loading ? 'Loading...' : `Load More Articles (${articles.length}/${total})`}
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
