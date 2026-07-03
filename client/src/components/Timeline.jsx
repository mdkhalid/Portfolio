import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Briefcase, GraduationCap, Calendar, MapPin } from 'lucide-react'

const Section = ({ title, items, type, dark }) => {
  if (!items.length) return null
  const isWork = type === 'work'

  return (
    <div className="mb-16 last:mb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="flex items-center gap-3 mb-8">
        <div className={`p-2.5 rounded-xl ${isWork ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
          {isWork ? <Briefcase size={22} className="text-blue-500" /> : <GraduationCap size={22} className="text-emerald-500" />}
        </div>
        <h3 className={`text-2xl font-bold ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h3>
        <div className={`flex-1 h-px ${dark ? 'bg-gray-800' : 'bg-gray-200'}`} />
      </motion.div>

      <div className="space-y-6">
        {items.map((item, i) => (
          <motion.div key={item._id || i}
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={`group p-6 rounded-2xl border transition-all ${dark
              ? 'bg-gray-800/50 border-gray-700 hover:border-blue-500/30 hover:bg-gray-800'
              : 'bg-white border-gray-200 hover:border-blue-400/30 hover:shadow-lg hover:shadow-blue-500/5'}`}>

            <div className="flex items-start gap-4">
              <div className={`hidden sm:flex w-12 h-12 rounded-xl flex-shrink-0 items-center justify-center text-lg font-bold text-white ${isWork ? 'bg-gradient-to-br from-blue-500 to-cyan-400' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                {isWork ? item.company?.charAt(0) || 'W' : item.institution?.charAt(0) || 'E'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isWork
                    ? (dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-500/10 text-blue-600')
                    : (dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-500/10 text-emerald-600')}`}>
                    <Calendar size={12} />
                    {item.startDate} - {item.current ? 'Present' : item.endDate}
                  </span>
                  {item.current && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
                      Current
                    </span>
                  )}
                </div>

                <h4 className={`text-lg font-bold mt-1 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{item.role || item.degree}{item.field ? ` in ${item.field}` : ''}</h4>
                <div className={`flex flex-wrap items-center gap-x-3 text-sm mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className="font-medium">{item.company || item.institution}</span>
                  {item.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {item.location}
                    </span>
                  )}
                </div>

                {item.bullets && item.bullets.length > 0 && (
                  <ul className={`mt-4 space-y-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {item.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm">
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${isWork ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function Timeline({ experiences = [], education = [] }) {
  const { dark } = useTheme()

  const workItems = [...experiences].sort((a, b) => {
    return (b.startDate?.match(/\d{4}/)?.[0] || '0') - (a.startDate?.match(/\d{4}/)?.[0] || '0')
  })
  const eduItems = [...education].sort((a, b) => {
    return (b.startDate?.match(/\d{4}/)?.[0] || '0') - (a.startDate?.match(/\d{4}/)?.[0] || '0')
  })

  if (!workItems.length && !eduItems.length) return null

  return (
    <section id="experience" className={`py-20 ${dark ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
              Experience & Education
            </span>
          </h2>
          <p className={`text-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}>My professional journey</p>
        </motion.div>

        <Section title="Work Experience" items={workItems} type="work" dark={dark} />
        <Section title="Education" items={eduItems} type="education" dark={dark} />
      </div>
    </section>
  )
}
