import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Summary from '../components/Summary'
import Skills from '../components/Skills'
import Timeline from '../components/Timeline'
import Projects from '../components/Projects'
import Certifications from '../components/Certifications'
import Contact from '../components/Contact'
import SEO from '../components/SEO'

export default function Home() {
  const [data, setData] = useState({ profile: {}, skills: [], experiences: [], education: [], certifications: [], projects: [], resumes: [] })
  const [loading, setLoading] = useState(true)
  const tracked = useRef(false)

  useEffect(() => {
    if (!tracked.current && !localStorage.getItem('token')) {
      tracked.current = true
      axios.post('/api/analytics/track').catch(() => {})
    }
    const fetchData = async () => {
      try {
        const [profile, skills, experiences, education, certifications, projects, resumes] = await Promise.all([
          axios.get('/api/profile'), axios.get('/api/skills'),
          axios.get('/api/experiences'), axios.get('/api/education'),
          axios.get('/api/certifications'), axios.get('/api/projects'),
          axios.get('/api/resumes'),
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

  return (
    <div>
      <SEO
        title={`${data.profile?.name || 'Mohammad Khalid'} - ${data.profile?.title || 'Portfolio'}`}
        description={data.profile?.summary || 'Software Developer Portfolio showcasing projects, skills, and experience'}
        image={data.profile?.avatar}
      />
      <Navbar resumes={data.resumes} />
      <Hero profile={data.profile} resumes={data.resumes} />
      <Summary profile={data.profile} />
      <Skills skills={data.skills} />
      <Timeline experiences={data.experiences} education={data.education} />
      <Projects projects={data.projects} />
      <Certifications certifications={data.certifications} />
      <Contact profile={data.profile} />
    </div>
  )
}
