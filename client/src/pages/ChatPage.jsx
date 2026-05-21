import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Bot, User, Loader2, Sparkles, ChevronDown, ArrowUp, ArrowLeft, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import SEO from '../components/SEO'

const SUGGESTIONS = [
  "Summarize Mohammad's resume",
  "What are his top technical skills?",
  "Tell me about his work experience",
  "What projects has he built?",
  "What certifications does he hold?",
  "What is his education background?",
]

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
        <Bot size={18} className="text-white" />
      </div>
      <div className="flex items-center gap-1.5 px-5 py-3.5">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function MessageBubble({ role, content }) {
  const { dark } = useTheme()
  const isUser = role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
        isUser
          ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/20'
          : 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/20'
      }`}>
        {isUser ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
      </div>
      <div className={`px-5 py-3.5 rounded-2xl max-w-[80%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm'
          : dark
            ? 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700/50'
            : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200 shadow-sm'
      }`}>
        {content}
      </div>
    </motion.div>
  )
}

export default function ChatPage() {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "👋 Hi there! I'm an AI resume assistant for Mohammad Khalid. I have access to his full professional resume — including his work experience, technical skills, projects, education, and certifications. Ask me anything about his background!" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const messagesEndRef = useRef(null)
  const containerRef = useRef(null)

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onScroll = () => {
      const dist = container.scrollHeight - container.scrollTop - container.clientHeight
      setShowScrollBtn(dist > 200)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  const handleSend = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const { data } = await axios.post('/api/chat', { message: msg })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      const serverMsg = err.response?.data?.error
      const userMsg = serverMsg || 'The AI service is temporarily unavailable. Please try again later.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${userMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <SEO
        title="Chat with AI — Mohammad Khalid"
        description="Ask an AI resume assistant about Mohammad Khalid's professional experience, skills, projects, and certifications"
      />
      <div className={`min-h-screen flex flex-col ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${
          dark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200'
        }`}>
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => navigate('/')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Back to Home"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className={`font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>AI Resume Assistant</h1>
              <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>I have access to his full resume — ask me anything</p>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {/* Suggestions */}
            {messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-6"
              >
                <p className={`text-sm font-medium mb-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Try asking:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.04 }}
                      onClick={() => handleSend(s)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                        dark
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                          : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 shadow-sm'
                      }`}
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Message list */}
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} role={msg.role} content={msg.content} />
              ))}
            </AnimatePresence>

            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom()}
              className={`fixed bottom-24 right-6 z-20 p-2.5 rounded-full shadow-lg transition-all cursor-pointer ${
                dark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <ChevronDown size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className={`sticky bottom-0 z-30 border-t backdrop-blur-xl ${
          dark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200'
        }`}>
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className={`flex items-end gap-2 rounded-2xl border p-2 transition-all focus-within:ring-2 focus-within:ring-blue-500/30 ${
              dark
                ? 'bg-gray-800 border-gray-700 focus-within:border-blue-500'
                : 'bg-gray-50 border-gray-200 focus-within:border-blue-400'
            }`}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                rows={1}
                className={`flex-1 resize-none outline-none text-sm leading-relaxed py-2 px-3 max-h-32 ${
                  dark
                    ? 'bg-gray-800 text-white placeholder-gray-500'
                    : 'bg-gray-50 text-gray-900 placeholder-gray-400'
                }`}
                style={{ scrollbarWidth: 'thin' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-700 hover:to-cyan-600 shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
            <p className={`text-xs text-center mt-2 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
              Powered by OpenAI · Ask about Mohammad's resume
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
