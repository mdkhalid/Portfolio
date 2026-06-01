import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import MermaidDiagram from '../components/MermaidDiagram'
import { ArrowLeft, Sun, Moon, Calendar, Tag, Clock, Share2 } from 'lucide-react'
import SEO from '../components/SEO'

export default function ArticlePage() {
  const { slug } = useParams()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await axios.get('/api/articles/' + slug)
        setArticle(data)
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Article not found')
        } else {
          setError('Failed to load article. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    if (slug) fetch()
  }, [slug])

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <p className="text-lg font-medium mb-2">{error || 'Article not found'}</p>
        <button onClick={() => navigate('/blog')} className="text-sm text-orange-500 hover:underline cursor-pointer">Back to Blog</button>
      </div>
    )
  }

  return (
    <>
      <SEO title={`${article.title} — Mohammad Khalid`} description={article.excerpt || article.title} image={article.coverImage} />
      <div className={`min-h-screen ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={() => navigate('/blog')} className={`p-2 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{article.title}</p>
            </div>
            <button onClick={toggle} className={`p-2 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {article.coverImage && (
              <div className="mb-8 rounded-2xl overflow-hidden max-h-80">
                <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm mb-6">
              <span className={`flex items-center gap-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Calendar size={14} /> {formatDate(article.createdAt)}
              </span>
              {article.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {article.tags.map(tag => (
                    <span key={tag} className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium ${dark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                      <Tag size={10} /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 leading-tight">{article.title}</h1>

            {article.excerpt && (
              <p className={`text-lg leading-relaxed mb-8 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{article.excerpt}</p>
            )}

            <div className={`prose prose-sm max-w-none ${dark ? 'prose-invert' : ''} 
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:leading-relaxed prose-p:my-4
              prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline
              prose-strong:font-bold
              prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm
              ${dark ? 'prose-code:bg-gray-800 prose-code:text-orange-300' : 'prose-code:bg-gray-100 prose-code:text-orange-700'}
              prose-pre:rounded-xl prose-pre:border prose-pre:p-4
              ${dark ? 'prose-pre:bg-gray-800 prose-pre:border-gray-700' : 'prose-pre:bg-gray-50 prose-pre:border-gray-200'}
              prose-img:rounded-xl prose-img:my-6 prose-img:mx-auto
              prose-blockquote:border-l-orange-500 prose-blockquote:not-italic
              prose-li:my-1
            `}>
              <ReactMarkdown components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  if (match && match[1] === 'mermaid') {
                    return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
                  }
                  if (match) {
                    return (
                      <pre className={`rounded-xl border p-4 text-sm overflow-x-auto ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                        <code className={className} {...props}>{children}</code>
                      </pre>
                    )
                  }
                  return <code className={className} {...props}>{children}</code>
                }
              }}>
                {article.content}
              </ReactMarkdown>
            </div>

            <div className={`mt-12 pt-8 border-t flex items-center justify-between ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button onClick={() => navigate('/blog')} className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <ArrowLeft size={16} /> Back to Blog
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(window.location.href) }} className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <Share2 size={16} /> Share
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  )
}
