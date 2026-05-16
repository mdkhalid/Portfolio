import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Quote } from 'lucide-react'

export default function Summary({ profile }) {
  const { dark } = useTheme()

  if (!profile?.summary) return null

  return (
    <section id="summary" className={`py-20 ${dark ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative">
          <Quote className={`absolute -top-4 -left-2 ${dark ? 'text-gray-800' : 'text-gray-200'}`} size={48} />
          <div className={`pl-12 border-l-4 border-blue-500 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
            <p className="text-lg md:text-xl leading-relaxed italic">
              {profile.summary}
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="flex justify-center gap-8 mt-10">
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              {profile.experienceYears}+
            </div>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Years Experience</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              6+
            </div>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Companies</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
              15+
            </div>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Projects</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
