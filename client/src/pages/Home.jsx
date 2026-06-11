import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Summary from '../components/Summary'
import Skills from '../components/Skills'
import Timeline from '../components/Timeline'
import Projects from '../components/Projects'
import Certifications from '../components/Certifications'
import Contact from '../components/Contact'
import BlogSection from '../components/BlogSection'
import SEO from '../components/SEO'
import BentoHome from './BentoHome'

export default function Home() {
  const [data, setData] = useState({ profile: {}, skills: [], experiences: [], education: [], certifications: [], projects: [], resumes: [] })
  const [loading, setLoading] = useState(true)
  const [layoutOverride, setLayoutOverride] = useState(null) // null = db default, 'classic', 'bento'
  const tracked = useRef(false)

  useEffect(() => {
    if (!tracked.current && !localStorage.getItem('token')) {
      tracked.current = true
      api.post('/api/analytics/track').catch(() => {})
    }
    const fetchData = async () => {
      try {
        const [profile, skills, experiences, education, certifications, projects, resumes] = await Promise.all([
          api.get('/api/profile'), api.get('/api/skills'),
          api.get('/api/experiences'), api.get('/api/education'),
          api.get('/api/certifications'), api.get('/api/projects'),
          api.get('/api/resumes'),
        ])
        setData({
          profile: profile.data,
          skills: skills.data,
          experiences: experiences.data,
          education: education.data,
          certifications: certifications.data,
          projects: projects.data,
          resumes: resumes.data,
        })
      } catch (err) {
        console.error('Failed to fetch:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const useBento = layoutOverride !== null ? layoutOverride === 'bento' : data.profile?.useBentoTheme
  const currentLayout = useBento ? 'bento' : 'classic'

  const { visibleSections = {} } = data.profile || {}
  const show = (key) => visibleSections[key] !== false

  return (
    <div>
      <SEO
        title={`${data.profile?.name || 'Mohammad Khalid'} - ${data.profile?.title || 'Portfolio'}`}
        description={data.profile?.summary || 'Software Developer Portfolio showcasing projects, skills, and experience'}
        image={data.profile?.avatar}
      />
      <Navbar resumes={data.resumes} currentLayout={currentLayout} onToggleLayout={() => setLayoutOverride(useBento ? 'classic' : 'bento')} />
      {useBento ? (
        <BentoHome onToggleLayout={() => setLayoutOverride('classic')} />
      ) : (
        <>
          {show('hero') && <Hero profile={data.profile} resumes={data.resumes} />}
          {show('summary') && <Summary profile={data.profile} />}
          {show('skills') && <Skills skills={data.skills} />}
          {(show('experience') || show('education')) && <Timeline
            experiences={show('experience') ? data.experiences : []}
            education={show('education') ? data.education : []}
          />}
          {show('projects') && <Projects projects={data.projects} />}
          {show('certifications') && <Certifications certifications={data.certifications} />}
          {show('blog') && <BlogSection />}
          {show('contact') && <Contact profile={data.profile} />}
        </>
      )}
    </div>
  )
}
