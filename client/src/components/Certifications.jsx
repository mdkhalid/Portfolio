import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Award } from 'lucide-react'

export default function Certifications({ certifications }) {
  const { dark } = useTheme()

  if (!certifications?.length) return null

  return (
    <section id="certifications" className={`py-20 ${dark ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
              Certifications
            </span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certifications.map((c, i) => (
            <motion.div key={c._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`p-5 rounded-2xl border flex items-start gap-4 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} shadow-sm`}>
              <div className={'p-2.5 rounded-lg flex-shrink-0 bg-blue-500/10'}>
                <Award size={22} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm leading-snug ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{c.name}</h3>
                <p className={`text-xs mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{c.issuer} · {c.date}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
