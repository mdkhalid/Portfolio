import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SpecialtyCarousel() {
  const specialties = [
    'Senior Solution Architect',
    'Enterprise .NET Core Expert',
    'Full-Stack Developer',
    'AI Solutions Integrator'
  ]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % specialties.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-8 overflow-hidden relative mt-1.5 flex items-center justify-center md:justify-start">
      <AnimatePresence mode="wait">
        <motion.p
          key={specialties[index]}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="text-lg md:text-xl font-semibold bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 bg-clip-text text-transparent"
        >
          {specialties[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
