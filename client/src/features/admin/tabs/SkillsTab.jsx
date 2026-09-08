import { Plus, Edit3, Trash2 } from 'lucide-react'

export default function SkillsTab({ items = [], dark, onEdit, onDelete, onAdd }) {
  return (
    <div className="space-y-3">
      {items.map(cat => (
        <div key={cat._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">{cat.category}</h4>
            <div className="flex gap-1">
              <button onClick={() => onEdit({ collection: 'skills', id: cat._id, data: cat })}
                className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={14} /></button>
              <button onClick={() => onDelete('skills', cat._id)}
                className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cat.items?.map(s => (
              <span key={s.name} className={'px-2.5 py-1 rounded-lg text-xs font-medium ' + (dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}>
                {s.name} ({s.level}%)
              </span>
            ))}
          </div>
        </div>
      ))}
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
        <Plus size={16} /> Add Category
      </button>
    </div>
  )
}
