import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Bot, User, Loader2, ArrowLeft, Sun, Moon, Send, Clock, MessageCircle } from 'lucide-react'
import SEO from '../components/SEO'

let socket = null

export default function LiveChatPage() {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [status, setStatus] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    socket = io(window.location.origin, {
      query: { role: 'visitor', visitorId: localStorage.getItem('visitorId') || crypto.randomUUID() },
    })

    if (!localStorage.getItem('visitorId')) {
      localStorage.setItem('visitorId', socket.auth?.visitorId || socket.id)
    }

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('chat:status', (data) => {
      setStatus(data)
      setJoined(true)
    })

    socket.on('chat:history', (history) => {
      setMessages(history || [])
    })

    socket.on('chat:message', (msg) => {
      setMessages((prev) => [...prev, msg])
    })

    socket.on('chat:closed', (data) => {
      setMessages((prev) => [...prev, {
        role: 'system',
        content: data?.reason === 'ended_by_admin' ? 'Chat ended by support agent.' : 'Chat ended.',
        timestamp: new Date(),
      }])
      setStatus((prev) => ({ ...prev, status: 'closed' }))
    })

    socket.on('chat:error', (data) => {
      setMessages((prev) => [...prev, { role: 'system', content: data.message, timestamp: new Date() }])
    })

    return () => {
      socket?.disconnect()
    }
  }, [])

  const handleJoin = () => {
    if (!name.trim()) return
    socket.emit('visitor:join', { name: name.trim() })
  }

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || status?.status !== 'active') return
    setInput('')
    setMessages((prev) => [...prev, { role: 'visitor', name, content: msg, timestamp: new Date() }])
    socket.emit('visitor:message', { content: msg })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!joined) handleJoin()
      else handleSend()
    }
  }

  if (!joined) {
    return (
      <>
        <SEO title="Live Chat — Mohammad Khalid" description="Chat with me in real-time" />
        <div className={`min-h-screen flex flex-col ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
          <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
            <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
              <button onClick={() => navigate('/')} className={`p-2 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
                <ArrowLeft size={20} />
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="font-bold text-base">Live Chat</h1>
                <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Chat with me in real-time</p>
              </div>
              <button onClick={toggle} className={`p-2 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
              <div className={`p-8 rounded-3xl text-center ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200 shadow-lg'}`}>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                  <MessageCircle size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-extrabold mb-2">Start a Live Chat</h2>
                <p className={`text-sm mb-6 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Enter your name to start a real-time conversation.
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your name"
                  maxLength={50}
                  className={`w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all mb-4 ${
                    dark ? 'bg-gray-800 border-gray-700 text-white focus:border-emerald-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500'
                  }`}
                />
                <button onClick={handleJoin} disabled={!name.trim() || !connected}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md disabled:opacity-50 cursor-pointer">
                  {!connected ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                  {!connected ? 'Connecting...' : 'Start Chat'}
                </button>
              </div>
            </motion.div>
          </main>
        </div>
      </>
    )
  }

  return (
    <>
      <SEO title="Live Chat — Mohammad Khalid" description="Chat with me in real-time" />
      <div className={`min-h-screen flex flex-col ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={() => navigate('/')} className={`p-2 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base">Live Chat</h1>
                {status?.status === 'waiting' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Clock size={12} /> Queue #{status.queuePosition}
                  </span>
                )}
                {status?.status === 'active' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Connected
                  </span>
                )}
                {status?.status === 'closed' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                    Ended
                  </span>
                )}
              </div>
              <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {status?.status === 'waiting' ? 'Please wait, an agent will be with you shortly...' : ''}
                {status?.status === 'active' ? 'You are connected with a support agent' : ''}
                {status?.status === 'closed' ? 'This chat session has ended' : ''}
              </p>
            </div>
            <button onClick={toggle} className={`p-2 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {status?.status === 'waiting' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-6 rounded-2xl text-center ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <Clock size={40} className="mx-auto mb-3 text-amber-500" />
                <h3 className="text-lg font-bold mb-1">You're in Queue</h3>
                <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Position: <strong className="text-amber-500">#{status.queuePosition}</strong>
                </p>
                <p className={`text-xs mt-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                  An agent will connect with you shortly. Please stay on this page.
                </p>
              </motion.div>
            )}

            <div className="space-y-4">
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-3 ${msg.role === 'visitor' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                    msg.role === 'visitor'
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/20'
                      : msg.role === 'admin'
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/20'
                        : 'bg-gray-500/20'
                  }`}>
                    {msg.role === 'visitor' ? <User size={18} className="text-white" /> : msg.role === 'admin' ? <Bot size={18} className="text-white" /> : <Clock size={18} className="text-gray-400" />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'visitor'
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm'
                      : msg.role === 'admin'
                        ? dark
                          ? 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700/50'
                          : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200 shadow-sm'
                        : dark
                          ? 'bg-gray-900 text-gray-400 italic border border-gray-800'
                          : 'bg-gray-100 text-gray-500 italic border border-gray-200'
                  }`}>
                    {msg.role === 'admin' && <p className="text-xs font-semibold text-emerald-500 mb-1">Support Agent</p>}
                    {msg.role === 'visitor' && <p className="text-xs font-semibold text-purple-300 mb-1">{name}</p>}
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {status?.status === 'active' && (
          <div className={`sticky bottom-0 z-30 border-t backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className={`flex items-end gap-2 rounded-2xl border p-2 transition-all focus-within:ring-2 focus-within:ring-emerald-500/30 ${
                dark ? 'bg-gray-900 border-gray-700 focus-within:border-emerald-500' : 'bg-gray-50 border-gray-200 focus-within:border-emerald-400'
              }`}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className={`flex-1 resize-none outline-none text-sm leading-relaxed py-2 px-3 max-h-32 ${
                    dark ? 'bg-gray-900 text-white placeholder-gray-500' : 'bg-gray-50 text-gray-900 placeholder-gray-400'
                  }`}
                />
                <button onClick={handleSend} disabled={!input.trim()}
                  className="p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-md disabled:opacity-50">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
