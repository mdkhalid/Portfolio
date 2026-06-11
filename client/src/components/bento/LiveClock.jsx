import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

export default function LiveClock({ dark }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const options = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }
      const formatter = new Intl.DateTimeFormat([], options)
      setTime(formatter.format(new Date()))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className={`p-1.5 rounded-full ${dark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}
        >
          <Clock size={16} />
        </motion.div>
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
        </span>
      </div>
      <div>
        <p className={`text-xs font-semibold ${dark ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-widest`}>
          Local Time (Delhi)
        </p>
        <p className={`text-sm font-bold font-mono tracking-tight ${dark ? 'text-white' : 'text-gray-800'}`}>
          {time || 'Loading...'}
        </p>
      </div>
    </div>
  )
}
