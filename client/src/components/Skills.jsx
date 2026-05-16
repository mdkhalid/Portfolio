import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { Code2, Cloud, Database, Bot } from 'lucide-react'

const iconMap = { 'Programming & Frameworks': Code2, 'Cloud & DevOps': Cloud, 'Database & API': Database, 'AI & Generative AI': Bot }

export default function Skills({ skills }) {
  const { dark } = useTheme()

  if (!skills?.length) return null

  return (
    <section id="skills" className={`py-20 ${dark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
      <div className="max-w-6xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
              Skills & Expertise
            </span>
          </h2>
          <p className={`text-lg ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Technologies I work with daily</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {skills.map((cat, i) => {
            const Icon = iconMap[cat.category] || Code2
            return (
              <motion.div key={cat._id}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`p-6 rounded-2xl border ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`p-2.5 rounded-lg ${dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className={`font-semibold text-lg ${dark ? 'text-gray-100' : 'text-gray-900'}`}>{cat.category}</h3>
                </div>
                <div className="space-y-3">
                  {cat.items?.map((skill) => (
                    <div key={skill.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={dark ? 'text-gray-300' : 'text-gray-600'}>{skill.name}</span>
                        <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{skill.level}%</span>
                      </div>
                      <div className={`h-2 rounded-full ${dark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                        <motion.div
                          initial={{ width: 0 }} whileInView={{ width: `${skill.level}%` }} viewport={{ once: true }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
