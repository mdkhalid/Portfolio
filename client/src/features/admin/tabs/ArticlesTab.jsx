import { Plus, Edit3, Trash2 } from 'lucide-react'

export default function ArticlesTab({ items = [], dark, onEdit, onDelete, onAdd }) {
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{item.title}</p>
                {!item.published && (
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')}>
                    Draft
                  </span>
                )}
              </div>
              <p className={'text-sm mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                {item.tags?.join(', ')} {item.createdAt ? '| ' + new Date(item.createdAt).toLocaleDateString() : ''}
              </p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onEdit({ collection: 'articles', id: item._id, data: item })}
                className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
              <button onClick={() => onDelete('articles', item._id)}
                className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 transition-all cursor-pointer">
        <Plus size={16} /> New Article
      </button>
    </div>
  )
}
