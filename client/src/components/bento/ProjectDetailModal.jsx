import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ProjectDetailModal({ project, dark, onClose }) {
  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className={`max-w-2xl w-full p-6 md:p-8 rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto ${
              dark ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white text-gray-900'
            }`}
          >
            <div className="flex items-start justify-between mb-4 border-b border-gray-850/10 dark:border-gray-100/5 pb-3">
              <div>
                <h3 className="text-xl md:text-2xl font-bold tracking-tight">{project.name}</h3>
                <p className={`text-xs mt-1 font-semibold ${dark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  Role: {project.role} &middot; {project.startDate} - {project.endDate || 'Present'}
                </p>
              </div>
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  dark ? 'hover:bg-gray-850 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowLeft size={16} />
              </button>
            </div>

            <div className="my-4">
              <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-650'}`}>
                {project.description}
              </p>
            </div>

            <div className="my-4">
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Tech Stack Used</p>
              <div className="flex flex-wrap gap-1.5">
                {project.techStack?.map(t => (
                  <span key={t} className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                    dark ? 'bg-gray-950 text-cyan-400 border border-gray-800' : 'bg-gray-50 text-cyan-600 border border-gray-200'
                  }`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {project.bullets?.length > 0 && (
              <div className="my-4 pt-3.5 border-t border-gray-800/10 dark:border-gray-100/5">
                <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Key Highlights</p>
                <ul className="space-y-2.5">
                  {project.bullets.map((b, i) => (
                    <li key={i} className={`text-xs leading-relaxed flex items-start gap-2.5 ${dark ? 'text-gray-300' : 'text-gray-650'}`}>
                      <CheckCircle2 size={13} className="text-cyan-500 mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
