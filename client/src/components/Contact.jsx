import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Mail, MapPin, Phone, Send, CheckCircle, Loader2 } from 'lucide-react'
import axios from 'axios'

export default function Contact({ profile }) {
  const { dark } = useTheme()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    setError('')
    try {
      await axios.post('/api/contact', form)
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setStatus('idle'), 5000)
    } catch (err) {
      setStatus('idle')
      setError(err.response?.data?.error || 'Failed to send message')
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${
    dark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
  }`

  return (
    <section id="contact" className={`py-20 ${dark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
              Get In Touch
            </span>
          </h2>
          <p className={`text-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Let's work together</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Contact Info */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className={`p-8 rounded-2xl border ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
            <h3 className={`text-lg font-bold mb-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Contact Information</h3>
            <div className="space-y-5">
              {profile?.email && (
                <a href={`mailto:${profile.email}`}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                  <div className="p-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Email</p>
                    <p className={`font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{profile.email}</p>
                  </div>
                </a>
              )}
              {profile?.phone && (
                <div className={`flex items-center gap-4 p-4 rounded-xl ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                  <div className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 text-white">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Phone</p>
                    <p className={`font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{profile.phone}</p>
                  </div>
                </div>
              )}
              {profile?.location && (
                <div className={`flex items-center gap-4 p-4 rounded-xl ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                  <div className="p-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-500 text-white">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Location</p>
                    <p className={`font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{profile.location}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <form onSubmit={handleSubmit}
              className={`p-8 rounded-2xl border ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} shadow-sm space-y-4`}>
              <h3 className={`text-lg font-bold mb-2 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Send a Message</h3>

              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Your Name" required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
                <input type="email" placeholder="Your Email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>

              <input type="text" placeholder="Subject (optional)" value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} className={inputClass} />

              <textarea placeholder="Your message..." required rows={5} value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })} className={inputClass} />

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button type="submit" disabled={status === 'sending'}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50">
                {status === 'sending' ? (
                  <><Loader2 size={18} className="animate-spin" /> Sending...</>
                ) : status === 'sent' ? (
                  <><CheckCircle size={18} /> Message Sent!</>
                ) : (
                  <><Send size={18} /> Send Message</>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className={`text-center mt-12 text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          &copy; {new Date().getFullYear()} Mohammad Khalid. All rights reserved.
        </motion.div>
      </div>
    </section>
  )
}
