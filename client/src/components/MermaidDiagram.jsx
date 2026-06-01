import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '../context/ThemeContext'

export default function MermaidDiagram({ chart }) {
  const ref = useRef(null)
  const { dark } = useTheme()

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'base',
      themeVariables: dark ? {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#3b82f6',
        lineColor: '#06b6d4',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        fontSize: '14px',
      } : {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#3b82f6',
        lineColor: '#0891b2',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#f8fafc',
        fontSize: '14px',
      },
    })
  }, [dark])

  useEffect(() => {
    if (ref.current) {
      ref.current.removeAttribute('data-processed')
      mermaid.run({ nodes: [ref.current] })
    }
  }, [chart, dark])

  return (
    <div className="my-8 flex justify-center">
      <div className={`w-full overflow-x-auto rounded-xl border p-6 ${dark ? 'border-gray-800/60 bg-gray-950/50' : 'border-gray-200 bg-white/50'}`}>
        <div ref={ref} className="mermaid text-center">
          {chart}
        </div>
      </div>
    </div>
  )
}
