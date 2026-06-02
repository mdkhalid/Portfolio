import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'

const STORAGE_KEY = 'cookie-consent'

const readConsent = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const writeConsent = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore
  }
}

export default function CookieConsent() {
  const { dark } = useTheme()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const existing = readConsent()
    if (!existing) {
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  const accept = () => {
    writeConsent('accepted')
    setVisible(false)
  }
  const reject = () => {
    writeConsent('rejected')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
          className={`fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-50 p-4 rounded-2xl border shadow-xl backdrop-blur-md ${
            dark
              ? 'bg-gray-900/90 border-gray-700 text-gray-100'
              : 'bg-white/90 border-gray-200 text-gray-900'
          }`}
        >
          <p className="text-sm leading-relaxed mb-3">
            This site stores a small amount of data in your browser (theme, login, consent) to make the
            experience work. No tracking cookies are set. See the
            {' '}
            <a href="/privacy" className="underline underline-offset-2">privacy notes</a>
            {' '}for details.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={reject}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Decline
            </button>
            <button
              onClick={accept}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all"
            >
              Accept
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
