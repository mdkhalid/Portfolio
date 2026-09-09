import { RefreshCw, Loader2, Eye, Download, Trash2, FileStack } from 'lucide-react'

export default function GeneratedResumesTab({ items = [], loading, dark, onRefresh, onPreview, onDownload, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileStack size={16} className="text-violet-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Generated Resumes (ATS)</h3>
        </div>
        <button onClick={onRefresh} disabled={loading}
          className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
        Per-job ATS-tailored resumes created by the auto-apply pipeline or the "Generate Resume" button. The master resume lives in the Resumes tab.
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-violet-500" />
        </div>
      ) : items.length === 0 ? (
        <p className={'text-sm text-center py-8 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
          No generated resumes yet. Use "Generate Resume" on a job (or the bulk button in Job Applications) to create ATS-tailored resumes.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{item.pdfFilename || 'Generated Resume'}</p>
                  <p className={'text-sm mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {item.createdAt ? 'Generated ' + new Date(item.createdAt).toLocaleDateString() : ''}
                    {item.keywordsMatched?.length ? ' · ' + item.keywordsMatched.length + ' keywords matched' : ''}
                  </p>
                  {item.content && (
                    <p className={'text-xs mt-2 whitespace-pre-wrap line-clamp-2 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{item.content}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => onPreview(item._id)} title="View in browser"
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Eye size={16} /></button>
                  <button onClick={() => onDownload(item._id, item.pdfFilename)}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-emerald-400' : 'hover:bg-gray-200 text-emerald-600')}><Download size={16} /></button>
                  <button onClick={() => onDelete(item._id)}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
