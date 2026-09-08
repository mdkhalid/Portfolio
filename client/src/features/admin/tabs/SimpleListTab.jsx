import { Plus, Edit3, Trash2 } from 'lucide-react'

export default function SimpleListTab({ items = [], titleField, collection, dark, onEdit, onDelete, onAdd }) {
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{item[titleField] || 'Untitled'}</p>
              <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                {item.company || item.institution || item.issuer || item.role || ''}
                {item.startDate ? ' | ' + item.startDate + ' - ' + (item.endDate || 'Present') : ''}
              </p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onEdit({ collection, id: item._id, data: item })}
                className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
              <button onClick={() => onDelete(collection, item._id)}
                className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
        <Plus size={16} /> Add New
      </button>
    </div>
  )
}
