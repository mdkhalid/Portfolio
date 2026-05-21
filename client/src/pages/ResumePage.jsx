import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTheme } from '../context/ThemeContext'
import { Download, Printer, ArrowLeft } from 'lucide-react'
import axios from 'axios'

export default function ResumePage() {
  const { dark } = useTheme()
  const [data, setData] = useState({ profile: {}, experiences: [], education: [], skills: [], projects: [], resumes: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profile, experiences, education, skills, projects, resumes] = await Promise.all([
          axios.get('/api/profile'),
          axios.get('/api/experiences'),
          axios.get('/api/education'),
          axios.get('/api/skills'),
          axios.get('/api/projects'),
          axios.get('/api/resumes'),
        ])
        setData({
          profile: profile.data,
          experiences: experiences.data,
          education: education.data,
          skills: skills.data,
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

  const handlePrint = () => {
    window.print()
  }

  const skillsData = data.skills || []
  const allSkills = skillsData.flatMap(skill => (skill.items || []).map(item => item.name || item))
  const skillCategories = skillsData.map(skill => skill.category)

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-800' : 'bg-gray-100'} transition-colors duration-300`}>
      <Helmet>
        <title>Resume - {data.profile?.name || 'Mohammad Khalid'}</title>
        <meta name="description" content={`${data.profile?.name || 'Mohammad Khalid'} - Professional Resume`} />
      </Helmet>

      {/* Action Bar */}
      <div className={`sticky top-0 z-10 ${dark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-sm border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <button 
            onClick={() => window.history.back()} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${dark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex gap-3">
            {data.resumes?.length > 0 && data.resumes.map(r => (
              <a
                key={r._id}
                href={`/api/download-resume/${r.fileUrl.split('/').pop()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Download size={16} /> {r.label || 'Download'}
              </a>
            ))}
            <button
              onClick={handlePrint}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* W3Schools CV Template */}
      <div className="max-w-6xl mx-auto p-4 md:py-8 print:p-0">
        <div className="bg-white shadow-xl print:shadow-none">
          <div className="flex flex-col md:flex-row">
            {/* Left Sidebar */}
            <div className={`md:w-1/3 p-6 md:p-8 ${dark ? 'bg-gray-700' : 'bg-gray-800'} text-white`}>
              {/* Avatar */}
              {data.profile?.avatar && (
                <div className="mb-6">
                  <img
                    src={data.profile.avatar}
                    alt={data.profile.name}
                    className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-white/30"
                  />
                </div>
              )}

              {/* Name & Title */}
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{data.profile?.name || 'Mohammad Khalid'}</h1>
                <p className="text-lg text-white/80">{data.profile?.title || 'Senior Solution Architect'}</p>
              </div>

              {/* Contact Info */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4 border-b border-white/30 pb-2">Contact</h3>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <span>📧</span> {data.profile?.email || 'khalid_bib@yahoo.com'}
                  </p>
                  <p className="flex items-center gap-2">
                    <span>📱</span> {data.profile?.phone || '9811291878'}
                  </p>
                  <p className="flex items-center gap-2">
                    <span>📍</span> {data.profile?.location || 'Delhi, India'}
                  </p>
                  {data.profile?.linkedIn && (
                    <p className="flex items-center gap-2">
                      <span>🔗</span> 
                      <a href={data.profile.linkedIn} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-300">
                        LinkedIn
                      </a>
                    </p>
                  )}
                  {data.profile?.github && (
                    <p className="flex items-center gap-2">
                      <span>💻</span> 
                      <a href={data.profile.github} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-300">
                        GitHub
                      </a>
                    </p>
                  )}
                </div>
              </div>

              {/* Skills */}
              {allSkills.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4 border-b border-white/30 pb-2">Skills</h3>
                  <div className="space-y-3">
                    {allSkills.slice(0, 10).map((skill, index) => (
                      <div key={index}>
                        <p className="text-sm mb-1">{skill}</p>
                        <div className="w-full bg-white/20 rounded-full h-2">
                          <div 
                            className="bg-white h-2 rounded-full" 
                            style={{ width: `${85 - (index * 5)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Languages (Extra Skills) */}
              {skillCategories.length > 1 && (
                <div>
                  <h3 className="text-lg font-bold mb-4 border-b border-white/30 pb-2">Expertise</h3>
                  <div className="space-y-2">
                    {skillCategories.slice(0, 5).map((category, index) => (
                      <p key={index} className="text-sm">{category}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Content */}
            <div className={`md:w-2/3 p-6 md:p-8 ${dark ? 'bg-gray-800' : 'bg-white'}`}>
              {/* Summary */}
              {data.profile?.summary && (
                <div className="mb-8">
                  <h2 className={`text-2xl font-bold mb-4 ${dark ? 'text-white' : 'text-gray-800'} border-b-2 border-blue-500 pb-2`}>
                    Profile
                  </h2>
                  <p className={`${dark ? 'text-gray-300' : 'text-gray-600'} leading-relaxed`}>
                    {data.profile.summary}
                  </p>
                </div>
              )}

              {/* Experience */}
              {data.experiences?.length > 0 && (
                <div className="mb-8">
                  <h2 className={`text-2xl font-bold mb-6 ${dark ? 'text-white' : 'text-gray-800'} border-b-2 border-blue-500 pb-2`}>
                    Work Experience
                  </h2>
                  <div className="space-y-6">
                    {data.experiences.map((exp, index) => (
                      <div key={index}>
                        <h3 className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>
                          {exp.role}
                        </h3>
                        <p className="text-blue-600 font-medium mb-2">{exp.company}</p>
                        <p className={`text-sm mb-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {exp.startDate} - {exp.endDate || 'Present'}
                        </p>
                        {exp.description && (
                          <p className={`${dark ? 'text-gray-300' : 'text-gray-600'} mb-3`}>
                            {exp.description}
                          </p>
                        )}
                        {exp.bullets && exp.bullets.length > 0 && (
                          <ul className={`space-y-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {exp.bullets.map((bullet, bulletIndex) => (
                              <li key={bulletIndex} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {data.education?.length > 0 && (
                <div className="mb-8">
                  <h2 className={`text-2xl font-bold mb-6 ${dark ? 'text-white' : 'text-gray-800'} border-b-2 border-blue-500 pb-2`}>
                    Education
                  </h2>
                  <div className="space-y-6">
                    {data.education.map((edu, index) => (
                      <div key={index}>
                        <h3 className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>
                          {edu.degree}
                        </h3>
                        <p className="text-blue-600 font-medium mb-2">{edu.institution}</p>
                        <p className={`text-sm mb-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {edu.startDate} - {edu.endDate}
                        </p>
                        {edu.description && (
                          <p className={`${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {edu.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {data.projects?.length > 0 && (
                <div>
                  <h2 className={`text-2xl font-bold mb-6 ${dark ? 'text-white' : 'text-gray-800'} border-b-2 border-blue-500 pb-2`}>
                    Key Projects
                  </h2>
                  <div className="space-y-6">
                    {data.projects.slice(0, 3).map((project, index) => (
                      <div key={index}>
                        <h3 className={`text-xl font-bold ${dark ? 'text-white' : 'text-gray-800'}`}>
                          {project.name}
                        </h3>
                        <p className={`text-sm mb-3 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {project.startDate} - {project.endDate || 'Present'}
                        </p>
                        <p className={`${dark ? 'text-gray-300' : 'text-gray-600'} mb-3`}>
                          {project.description}
                        </p>
                        {project.techStack && project.techStack.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {project.techStack.map((tech, techIndex) => (
                              <span
                                key={techIndex}
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, .sticky:first-child, button { display: none !important; }
          .shadow-xl { box-shadow: none !important; }
          .bg-gray-800, .bg-gray-700 { background: #1a1a1a !important; }
          .bg-gray-100 { background: white !important; }
          .text-white { color: #1a1a1a !important; }
          .text-gray-300, .text-gray-400 { color: #444 !important; }
        }
      `}</style>
    </div>
  )
}