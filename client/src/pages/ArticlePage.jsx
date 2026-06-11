import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import api from '../lib/api'
import ReactMarkdown from 'react-markdown'
import MermaidDiagram from '../components/MermaidDiagram'
import { ArrowLeft, Sun, Moon, Calendar, Tag, Clock, Link2, Check } from 'lucide-react'
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
        const { data } = await api.get('/api/articles/' + slug)
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

  const [copied, setCopied] = useState(false)
  const [showFloatingShare, setShowFloatingShare] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(article?.title || '')

  const calculateReadingTime = (content) => {
    const wordsPerMinute = 200
    const words = content.trim().split(/\s+/).length
    return Math.ceil(words / wordsPerMinute)
  }

  const readingTime = article ? calculateReadingTime(article.content) : 0

  const ShareIcon = ({ type, className }) => {
    if (type === 'linkedin') return <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    if (type === 'x') return <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    if (type === 'facebook') return <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  }

  const shareLinks = [
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, type: 'linkedin', color: 'bg-[#0A66C2] hover:bg-[#0A66C2]/90' },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, type: 'x', color: 'bg-[#000000] hover:bg-[#000000]/90 dark:bg-[#e2e8f0] dark:text-gray-900 dark:hover:bg-[#e2e8f0]/90' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, type: 'facebook', color: 'bg-[#1877F2] hover:bg-[#1877F2]/90' },
  ]

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.warn('Failed to copy link')
    }
  }

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
      setShowFloatingShare(scrollTop > 300 && scrollTop < docHeight - 200)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-800">
            <div className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
          </div>
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
                <img src={article.coverImage} alt={article.title} loading="lazy" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm mb-6">
              <span className={`flex items-center gap-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Calendar size={14} /> {formatDate(article.createdAt)}
              </span>
              <span className={`flex items-center gap-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Clock size={14} /> {article.readingTime || readingTime} min read
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
              <p className={`text-lg leading-relaxed mb-6 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{article.excerpt}</p>
            )}

            {/* Top Share Bar */}
            <div className={`flex items-center gap-2 mb-8 pb-6 border-b ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
              <span className={`text-xs font-medium mr-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Share:</span>
              {shareLinks.map(link => (
                  <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-all ${link.color} shadow-sm`}
                  >
                    <ShareIcon type={link.type} />
                  </a>
              ))}
              <button onClick={copyLink}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shadow-sm ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : dark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {copied ? <Check size={13} /> : <Link2 size={13} />}
              </button>
            </div>

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

            {/* Share Bar */}
            <div className={`mt-12 pt-8 border-t ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button onClick={() => navigate('/blog')} className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  <ArrowLeft size={16} /> Back to Blog
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium mr-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Share:</span>
                  {shareLinks.map(link => (
                      <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-all ${link.color} shadow-sm`}
                      >
                        <ShareIcon type={link.type} /> <span className="hidden sm:inline">{link.name}</span>
                      </a>
                  ))}
                  <button onClick={copyLink}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer shadow-sm ${
                      copied
                        ? 'bg-emerald-500 text-white'
                        : dark
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {copied ? <Check size={14} /> : <Link2 size={14} />}
                    <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </main>

        {/* Floating Share Button (Mobile) */}
        <AnimatePresence>
          {showFloatingShare && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3"
            >
              <button onClick={copyLink} title="Copy link"
                className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full shadow-lg transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : dark
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {copied ? <Check size={18} /> : <Link2 size={18} />}
              </button>
              {shareLinks.slice(0, 2).map(link => (
                  <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" title={link.name}
                    className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full shadow-lg text-white transition-all ${link.color}`}
                  >
                    <ShareIcon type={link.type} className="w-5 h-5" />
                  </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
