import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

export default function ProjectCard({ project, dark, onClick }) {
  return (
    <motion.div
      layout
      onClick={() => onClick(project)}
      className={`p-5 rounded-2xl cursor-pointer transition-all border group relative flex flex-col justify-between min-h-[170px] ${
        dark
          ? 'bg-gray-950/40 border-gray-900 hover:border-blue-500/50'
          : 'bg-white border-gray-200 hover:border-blue-400/50 hover:shadow-md'
      }`}
    >
      <div>
        <div className="flex items-start justify-between mb-2">
          <h3 className={`font-bold group-hover:text-blue-500 text-base transition-colors ${dark ? 'text-gray-100' : 'text-gray-850'}`}>
            {project.name}
          </h3>
          <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
        </div>
        <p className={`text-sm leading-relaxed line-clamp-3 mb-4 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
          {project.description}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {project.techStack?.slice(0, 3).map(badge => (
          <span key={badge} className={`px-2 py-0.5 rounded-md text-xs font-bold ${
            dark ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-600'
          }`}>
            {badge}
          </span>
        ))}
        {project.techStack?.length > 3 && (
          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${dark ? 'bg-gray-900 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
            +{project.techStack.length - 3}
          </span>
        )}
      </div>
    </motion.div>
  )
}
