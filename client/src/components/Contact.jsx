import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Mail, MapPin, Phone } from 'lucide-react'

export default function Contact({ profile }) {
  const { dark } = useTheme()

  return (
    <section id="contact" className={`py-20 ${dark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
              Get In Touch
            </span>
          </h2>
          <p className={`text-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Let's work together</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className={`max-w-lg mx-auto p-8 rounded-2xl border ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
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

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className={`text-center mt-8 text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          © {new Date().getFullYear()} Mohammad Khalid. All rights reserved.
        </motion.div>
      </div>
    </section>
  )
}
