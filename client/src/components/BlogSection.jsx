import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'
import { Calendar, Tag, ChevronRight, BookOpen } from 'lucide-react'

export default function BlogSection() {
  const { dark } = useTheme()
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get('/api/articles', { params: { limit: 3, skip: 0 } })
        setArticles(data.items)
      } catch (err) {
        console.error('Failed to fetch articles:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const glassClass = dark
    ? 'bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 shadow-2xl hover:border-gray-700/60 transition-all duration-300'
    : 'bg-white/70 backdrop-blur-xl border border-gray-200/50 shadow-lg hover:border-gray-300/60 transition-all duration-300'

  if (loading) return null
  if (articles.length === 0) return null

  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 ${dark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
            Latest Articles
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Technical Insights</h2>
          <p className={`text-sm mt-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Thoughts on architecture, engineering, and technology</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {articles.map((article, i) => (
            <motion.article
              key={article._id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              onClick={() => navigate('/blog/' + article.slug)}
              className={`${glassClass} p-6 rounded-2xl cursor-pointer flex flex-col group`}
            >
              {article.coverImage && (
                <div className="mb-4 -mx-6 -mt-6 rounded-t-2xl overflow-hidden h-36">
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

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <button
            onClick={() => navigate('/blog')}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              dark
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
            }`}
          >
            <BookOpen size={16} /> View All Articles
          </button>
        </motion.div>
      </div>
    </section>
  )
}
