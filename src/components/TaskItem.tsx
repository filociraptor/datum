import { useState } from 'react'
import { Clock, ChevronRight, AlertCircle } from 'lucide-react'
import type { Task } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface TaskItemProps {
  task: Task
  onUpdate: (t: Task) => void
  onDelete: (id: string) => void
  onEdit: (t: Task) => void
  showProject?: boolean
}

function formatDue(date: string | null) {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true }
  if (diff === 0) return { label: 'Today', overdue: false }
  if (diff === 1) return { label: 'Tomorrow', overdue: false }
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), overdue: false }
}

export function TaskItem({ task, onUpdate, onEdit, showProject }: TaskItemProps) {
  const [toggling, setToggling] = useState(false)
  const due = formatDue(task.due_date)

  const toggle = async () => {
    setToggling(true)
    const { data, error } = await supabase
      .from('tasks')
      .update({ done: !task.done })
      .eq('id', task.id)
      .select()
      .single()
    setToggling(false)
    if (!error && data) onUpdate(data as Task)
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
        task.done
          ? 'border-gray-100 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white hover:border-amber-200 hover:shadow-sm'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={toggle}
        disabled={toggling}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          task.done
            ? 'border-amber-500 bg-amber-500'
            : 'border-gray-300 hover:border-amber-400'
        }`}
      >
        {task.done && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {showProject && task.project && (
            <span className="badge bg-gray-100 text-gray-500">{task.project.name}</span>
          )}
          {task.waiting_on && (
            <span className="badge bg-blue-50 text-blue-600">
              Waiting · {task.waiting_on.name}
            </span>
          )}
          {due && (
            <span className={`flex items-center gap-1 text-xs ${due.overdue ? 'text-red-500' : 'text-gray-400'}`}>
              {due.overdue && <AlertCircle size={11} />}
              {due.label}
            </span>
          )}
          {task.estimate_minutes != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              {task.estimate_minutes < 60
                ? `${task.estimate_minutes}m`
                : `${(task.estimate_minutes / 60).toFixed(1)}h`}
            </span>
          )}
          {task.bump_count > 0 && (
            <span className="badge bg-orange-50 text-orange-500">
              Bumped ×{task.bump_count}
            </span>
          )}
        </div>

        {task.notes && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">{task.notes}</p>
        )}
      </div>

      {/* Edit */}
      <button
        onClick={() => onEdit(task)}
        className="flex-shrink-0 rounded p-1 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Edit task"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
