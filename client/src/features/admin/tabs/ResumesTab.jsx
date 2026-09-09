import { Plus, Edit3, Trash2, Star, Upload, Loader2, Eye, EyeOff } from 'lucide-react'

export default function ResumesTab({ items = [], dark, masterUploading, onMasterFile, onEdit, onDelete, onToggleVisibility, onSetMaster, onAdd }) {
  const master = items.find(i => i.isMaster) || null
  const others = items.filter(i => !i.isMaster)
  return (
    <div className="space-y-6">
      {/* Master Resume */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Star size={16} className="text-emerald-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Master Resume</h3>
        </div>
        <p className={'text-xs mb-3 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
          The base resume used for every ATS-tailored resume and job application. Uploading here replaces it — formatting is preserved and JD keywords are added inside its Skills section.
        </p>
        {master ? (
          <div className={'p-4 rounded-xl border-2 border-emerald-500/60 ' + (dark ? 'bg-gray-800' : 'bg-emerald-50/40')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold flex items-center gap-2">
                  {master.label}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 border border-emerald-500/40">Master</span>
                </p>
                <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {master.fileUrl?.split('/').pop()}
                  <span className="ml-2 text-xs opacity-70">· Always hidden from public site</span>
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0 items-center">
                <label className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ' + (masterUploading ? 'opacity-50 pointer-events-none ' : '') + (dark ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')}>
                  {masterUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {masterUploading ? 'Uploading...' : 'Replace File'}
                  <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onMasterFile(f); e.target.value = '' }} />
                </label>
                <button onClick={() => onEdit({ collection: 'resumes', id: master._id, data: master })}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                <button onClick={() => onDelete('resumes', master._id)}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ) : (
          <label className={'flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ' + (dark ? 'border-gray-700 hover:border-emerald-500/60 hover:bg-gray-800/50' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/30')}>
            {masterUploading ? <Loader2 size={24} className="animate-spin text-emerald-500" /> : <Upload size={24} className="text-emerald-500" />}
            <span className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-600')}>
              {masterUploading ? 'Uploading...' : 'Upload Master Resume (PDF / DOCX)'}
            </span>
            <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>DOCX recommended — keywords are merged into its Skills section</span>
            <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onMasterFile(f); e.target.value = '' }} />
          </label>
        )}
      </div>

      {/* Other Resume Files */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Other Resume Files</h3>
        </div>
        <div className="space-y-3">
          {others.length === 0 && (
            <p className={'text-sm py-2 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No other resumes. Use the star on any resume to promote it to Master.</p>
          )}
          {others.map(item => (
            <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold flex items-center gap-2">
                    {item.label}
                    {item.showOnSite === false && (
                      <span className={'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ' + (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')}>Hidden</span>
                    )}
                  </p>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{item.fileUrl?.split('/').pop()}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => onToggleVisibility(item)} title={item.showOnSite === false ? 'Hidden from public site — click to show' : 'Visible on public site — click to hide'}
                    className={'p-2 rounded-lg cursor-pointer ' + (item.showOnSite === false ? (dark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-200 text-gray-400') : (dark ? 'hover:bg-gray-700 text-cyan-400' : 'hover:bg-gray-200 text-cyan-600'))}>
                    {item.showOnSite === false ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button onClick={() => onSetMaster(item._id)} title="Set as master resume"
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-gray-500 hover:text-emerald-400' : 'hover:bg-gray-200 text-gray-400 hover:text-emerald-600')}>
                    <Star size={16} />
                  </button>
                  <button onClick={() => onEdit({ collection: 'resumes', id: item._id, data: item })}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                  <button onClick={() => onDelete('resumes', item._id)}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
            <Plus size={16} /> Add Resume
          </button>
        </div>
      </div>
    </div>
  )
}
