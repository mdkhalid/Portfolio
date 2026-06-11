import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Bot, User, Loader2, Clock } from 'lucide-react'

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('name') // name | joined
  const [name, setName] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState(null)
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const joined = step === 'joined'

  useEffect(() => {
    if (!open) return
    if (socketRef.current?.connected) return

    const socket = io(window.location.origin, {
      query: { role: 'visitor', visitorId: localStorage.getItem('visitorId') || crypto.randomUUID() },
    })
    socketRef.current = socket

    if (!localStorage.getItem('visitorId')) {
      localStorage.setItem('visitorId', socket.id)
    }

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('chat:status', (data) => { setStatus(data); setStep('joined') })
    socket.on('chat:history', (history) => setMessages(history || []))
    socket.on('chat:message', (msg) => setMessages((p) => [...p, msg]))
    socket.on('chat:closed', (data) => {
      setMessages((p) => [...p, { role: 'system', content: data?.reason === 'ended_by_admin' ? 'Chat ended by support agent.' : 'Chat ended.', timestamp: new Date() }])
      setStatus((p) => ({ ...p, status: 'closed' }))
    })
    socket.on('chat:error', (data) => {
      setMessages((p) => [...p, { role: 'system', content: data.message, timestamp: new Date() }])
    })

    return () => {
      // don't disconnect on close, reuse socket
    }
  }, [open])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleJoin = () => {
    if (!name.trim() || !connected) return
    socketRef.current?.emit('visitor:join', { name: name.trim() })
  }

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || status?.status !== 'active') return
    setInput('')
    setMessages((p) => [...p, { role: 'visitor', name, content: msg, timestamp: new Date() }])
    socketRef.current?.emit('visitor:message', { content: msg })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!joined) handleJoin(); else handleSend() }
  }

  const resetAndClose = () => {
    setOpen(false)
    setStep('name')
    setName('')
    setMessages([])
    setInput('')
    setStatus(null)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all cursor-pointer">
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={resetAndClose} />
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl overflow-hidden shadow-2xl border flex flex-col bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <MessageCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">Live Chat</p>
                  <p className="text-xs text-white/70 truncate">
                    {!connected ? 'Connecting...' : status?.status === 'active' ? 'Connected' : status?.status === 'waiting' ? 'In queue' : status?.status === 'closed' ? 'Ended' : 'Start a conversation'}
                  </p>
                </div>
                <button onClick={resetAndClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {status?.status === 'waiting' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
                    <Clock size={16} className="flex-shrink-0" />
                    <span>You're #{status.queuePosition} in queue. An agent will connect shortly.</span>
                  </div>
                )}

                {!joined ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                      <MessageCircle size={24} className="text-white" />
                    </div>
                    <p className="font-bold text-base mb-1 text-gray-900 dark:text-white">Start a Live Chat</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Chat with me in real-time</p>
                    <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder="Your name" maxLength={50}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 mb-3" />
                    <button onClick={handleJoin} disabled={!name.trim() || !connected}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 cursor-pointer">
                      {!connected ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                      {!connected ? 'Connecting...' : 'Start Chat'}
                    </button>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex items-start gap-2 ${msg.role === 'visitor' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'visitor' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : msg.role === 'admin' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gray-400/30'
                        }`}>
                          {msg.role === 'visitor' ? <User size={14} className="text-white" /> : msg.role === 'admin' ? <Bot size={14} className="text-white" /> : <Clock size={14} className="text-gray-500" />}
                        </div>
                        <div className={`px-3 py-2 rounded-xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'visitor' ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm' : msg.role === 'admin' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-tl-sm' : 'text-center w-full text-xs italic text-gray-500 dark:text-gray-400'
                        }`}>
                          {msg.role === 'admin' && <p className="text-xs font-semibold text-emerald-500 mb-0.5">Support Agent</p>}
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              {status?.status === 'active' && (
                <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-end gap-2 rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 focus-within:border-emerald-500 bg-gray-50 dark:bg-gray-800">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder="Type a message..." rows={1}
                      className="flex-1 resize-none outline-none text-sm py-1.5 px-2 max-h-20 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" />
                    <button onClick={handleSend} disabled={!input.trim()}
                      className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all cursor-pointer">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
