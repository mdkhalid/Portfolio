import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Plus, Upload, X } from 'lucide-react'

export default function EditModal({ API, dark, editing, saveItem, saving, setData, setEditing, setSaving }) {
  const { collection, id, data: editData } = editing || {}
  const [form, setForm] = useState(editData || {})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(editData || {})
  }, [editData])

  if (!editing) return null

  const fields = collection === 'skills'
    ? [{ key: 'category', label: 'Category Name', type: 'text' }]
    : collection === 'experiences'
      ? [{ key: 'company', label: 'Company', type: 'text' }, { key: 'role', label: 'Role', type: 'text' }, { key: 'location', label: 'Location', type: 'text' }, { key: 'startDate', label: 'Start Date', type: 'text' }, { key: 'endDate', label: 'End Date', type: 'text' }, { key: 'bullets', label: 'Bullets (one per line)', type: 'textarea' }]
      : collection === 'education'
        ? [{ key: 'degree', label: 'Degree', type: 'text' }, { key: 'field', label: 'Field', type: 'text' }, { key: 'institution', label: 'Institution', type: 'text' }, { key: 'location', label: 'Location', type: 'text' }, { key: 'startDate', label: 'Start Date', type: 'text' }, { key: 'endDate', label: 'End Date', type: 'text' }]
          : collection === 'certifications'
            ? [{ key: 'name', label: 'Name', type: 'text' }, { key: 'issuer', label: 'Issuer', type: 'text' }, { key: 'date', label: 'Date', type: 'text' }, { key: 'link', label: 'Link', type: 'text' }]
          : collection === 'projects'
            ? [{ key: 'name', label: 'Project Name', type: 'text' }, { key: 'role', label: 'Role', type: 'text' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'startDate', label: 'Start Date', type: 'text' }, { key: 'endDate', label: 'End Date', type: 'text' }, { key: 'techStack', label: 'Tech Stack (comma separated)', type: 'text' }, { key: 'bullets', label: 'Bullets (one per line)', type: 'textarea' }]
            : collection === 'resumes'
              ? [{ key: 'label', label: 'Label', type: 'text' }]
              : collection === 'articles'
                ? [{ key: 'title', label: 'Title', type: 'text' }, { key: 'excerpt', label: 'Excerpt', type: 'text' }, { key: 'tags', label: 'Tags (comma separated)', type: 'text' }, { key: 'coverImage', label: 'Cover Image URL', type: 'text' }, { key: 'content', label: 'Content (Markdown)', type: 'textarea' }, { key: 'published', label: 'Published', type: 'select' }]
                : []

  const handleSave = () => {
    if (collection === 'resumes') {
      const fd = new FormData()
      fd.append('label', form.label || '')
      if (form._newFile) fd.append('file', form._newFile)
      setSaving(true)
      ;(async () => {
        try {
          const { data: result } = id
            ? await API.put('/api/resume-files/' + id, fd)
            : await API.post('/api/resume-files', fd)
          setData(prev => ({
            ...prev,
            resumes: id
              ? prev.resumes.map(i => i._id === id ? result : i)
              : [...(prev.resumes || []), result],
          }))
          setEditing(null)
        } catch (err) { console.error(err) }
        finally { setSaving(false) }
      })()
      return
    }
    let payload = { ...form }
    if (payload.bullets && typeof payload.bullets === 'string') payload.bullets = payload.bullets.split('\n').filter(Boolean)
    if (payload.techStack && typeof payload.techStack === 'string') payload.techStack = payload.techStack.split(',').map(s => s.trim()).filter(Boolean)
    if (collection === 'articles' && typeof payload.tags === 'string') payload.tags = payload.tags.split(',').map(s => s.trim()).filter(Boolean)
    saveItem(collection, payload, id)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
        className={'w-full max-w-lg p-6 rounded-2xl max-h-[80vh] overflow-y-auto ' + (dark ? 'bg-gray-900 border border-gray-700' : 'bg-white')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{id ? 'Edit' : 'Add'} {collection}</h3>
          <button onClick={() => setEditing(null)} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className={'block text-sm font-medium mb-1 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea value={Array.isArray(form[f.key]) ? form[f.key].join('\n') : (form[f.key] || '')}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })} rows={collection === 'articles' && f.key === 'content' ? 12 : 3}
                  className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
              ) : f.type === 'select' ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm({ ...form, published: form.published !== false })}
                    className={'relative w-12 h-6 rounded-full transition-colors ' + (form.published !== false ? 'bg-emerald-500' : (dark ? 'bg-gray-600' : 'bg-gray-300'))}>
                    <div className={'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (form.published !== false ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                  <span className={'text-sm ' + (form.published !== false ? 'text-emerald-500 font-medium' : (dark ? 'text-gray-400' : 'text-gray-500'))}>
                    {form.published !== false ? 'Published' : 'Draft'}
                  </span>
                </div>
              ) : (
                <input value={collection === 'articles' && f.key === 'tags' ? (Array.isArray(form[f.key]) ? form[f.key].join(', ') : (form[f.key] || '')) : (form[f.key] || '')}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
              )}
            </div>
          ))}
          {collection === 'skills' && (
            <div>
              <label className={'block text-sm font-medium mb-2 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Skill Items</label>
              {(form.items || []).map((item, i) => (
                <div key={i} className="flex gap-2 items-center mb-2">
                  <input value={item.name} onChange={e => {
                    const items = [...(form.items || [])]
                    items[i] = { ...items[i], name: e.target.value }
                    setForm({ ...form, items })
                  }} placeholder="Skill name"
                    className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400')} />
                  <input type="number" min="0" max="100" value={item.level} onChange={e => {
                    const items = [...(form.items || [])]
                    items[i] = { ...items[i], level: Number(e.target.value) }
                    setForm({ ...form, items })
                  }}
                    className={'w-20 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
                  <button onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><X size={14} /></button>
                </div>
              ))}
              <button onClick={() => setForm({ ...form, items: [...(form.items || []), { name: '', level: 50 }] })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
                <Plus size={14} /> Add Skill
              </button>
            </div>
          )}
          {collection === 'resumes' && (
            <div>
              <label className={'block text-sm font-medium mb-2 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Resume File</label>
              {form.fileUrl && (
                <div className={'flex items-center gap-2 mb-2 p-2 rounded-lg text-sm ' + (dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                  <FileText size={14} />
                  {form.fileUrl.split('/').pop()}
                </div>
              )}
              <label className={'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all ' + (dark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100')}>
                <Upload size={16} />
                {form._newFile ? form._newFile.name : 'Choose File'}
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) setForm({ ...form, _newFile: file })
                }} className="hidden" />
              </label>
              <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Allowed: PDF, DOC, DOCX, TXT (max 10MB)</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setEditing(null)} className={'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
