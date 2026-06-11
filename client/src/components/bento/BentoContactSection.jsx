import { useState } from 'react'
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle } from 'lucide-react'
import api from '../../lib/api'

export default function BentoContactSection({ dark, profile }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [formStatus, setFormStatus] = useState('idle')
  const [formError, setFormError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormStatus('sending')
    setFormError('')
    try {
      await api.post('/api/contact', form)
      setFormStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setFormStatus('idle'), 5000)
    } catch (err) {
      setFormStatus('idle')
      setFormError(err.response?.data?.error || 'Failed to send message')
    }
  }

  const glassClass = dark
    ? 'bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 shadow-2xl hover:border-gray-700/60 transition-all duration-300'
    : 'bg-white/70 backdrop-blur-xl border border-gray-200/50 shadow-lg hover:border-gray-300/60 transition-all duration-300'

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
      <div className={`p-6 md:p-8 rounded-3xl ${glassClass}`}>
        <h3 className={`text-base font-bold mb-5 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Contact Information</h3>
        <div className="space-y-4">
          {profile.email && (
            <a href={`mailto:${profile.email}`} className={`flex items-center gap-4 p-3.5 rounded-2xl transition-colors ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Email</p>
                <p className={`text-sm font-medium truncate ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{profile.email}</p>
              </div>
            </a>
          )}
          {profile.phone && (
            <div className={`flex items-center gap-4 p-3.5 rounded-2xl ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-white">
                <Phone size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Phone</p>
                <p className={`text-sm font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{profile.phone}</p>
              </div>
            </div>
          )}
          {profile.location && (
            <div className={`flex items-center gap-4 p-3.5 rounded-2xl ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Location</p>
                <p className={`text-sm font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{profile.location}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`p-6 md:p-8 rounded-3xl ${glassClass}`}>
        <h3 className={`text-base font-bold mb-4 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>Send a Message</h3>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3.5">
            <input type="text" placeholder="Your Name" required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            <input type="email" placeholder="Your Email" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
          </div>
          <input type="text" placeholder="Subject (optional)" value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
          <textarea placeholder="Your message..." required rows={4} value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm resize-none ${dark ? 'bg-gray-800/60 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <button type="submit" disabled={formStatus === 'sending'}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
            {formStatus === 'sending' ? (
              <><Loader2 size={16} className="animate-spin" /> Sending...</>
            ) : formStatus === 'sent' ? (
              <><CheckCircle size={16} /> Message Sent!</>
            ) : (
              <><Send size={16} /> Send Message</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
