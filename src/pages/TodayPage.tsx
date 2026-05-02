import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'
import { TaskItem } from '@/components/TaskItem'
import { TaskForm } from '@/components/TaskForm'
import { Modal } from '@/components/Modal'

const TASK_SELECT = `
  *,
  project:projects(id, name),
  waiting_on:contacts!waiting_on_contact_id(id, name, initials)
`

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function isoInDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function TodayPage() {
  const [overdue, setOverdue] = useState<Task[]>([])
  const [today, setToday] = useState<Task[]>([])
  const [upcoming, setUpcoming] = useState<Task[]>([])
  const [done, setDone] = useState<Task[]>([])
  const [showDone, setShowDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)

  const load = async () => {
    const todayStr = isoToday()
    const weekStr = isoInDays(7)

    const { data } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (!data) { setLoading(false); return }

    const tasks = data as Task[]
    setOverdue(tasks.filter((t) => !t.done && t.due_date && t.due_date < todayStr))
    setToday(tasks.filter((t) => !t.done && t.due_date === todayStr))
    setUpcoming(tasks.filter((t) => !t.done && t.due_date && t.due_date > todayStr && t.due_date <= weekStr))
    setDone(tasks.filter((t) => t.done && t.due_date && t.due_date >= isoInDays(-7)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const upsert = (updated: Task) => {
    const replace = (list: Task[]) => list.map((t) => (t.id === updated.id ? updated : t))
    const remove = (list: Task[]) => list.filter((t) => t.id !== updated.id)

    if (updated.done) {
      setOverdue(remove)
      setToday(remove)
      setUpcoming(remove)
      setDone((prev) => [updated, ...remove(prev)])
    } else {
      setDone(remove)
      const d = updated.due_date
      const todayStr = isoToday()
      const weekStr = isoInDays(7)
      if (d && d < todayStr) { setOverdue((p) => [updated, ...remove(p)]); setToday(remove); setUpcoming(remove) }
      else if (d === todayStr) { setToday((p) => [updated, ...remove(p)]); setOverdue(remove); setUpcoming(remove) }
      else if (d && d <= weekStr) { setUpcoming((p) => [...remove(p), updated]); setOverdue(remove); setToday(remove) }
      else { replace(overdue); replace(today); replace(upcoming) }
    }
  }

  const addTask = (_t: Task) => {
    load()
    setModal(null)
  }

  const saveEdit = (t: Task) => {
    upsert(t)
    setEditing(null)
  }

  const deleteTask = (id: string) => {
    const rm = (list: Task[]) => list.filter((t) => t.id !== id)
    setOverdue(rm); setToday(rm); setUpcoming(rm); setDone(rm)
    setEditing(null)
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-amber-500">Today</p>
            <h1 className="mt-0.5 text-2xl font-bold text-gray-900">{dateLabel}</h1>
          </div>
          <button onClick={() => setModal('add')} className="btn-primary">
            <Plus size={16} />
            Add task
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Overdue" count={overdue.length} accent="red">
              {overdue.map((t) => (
                <TaskItem key={t.id} task={t} onUpdate={upsert} onDelete={deleteTask} onEdit={setEditing} showProject />
              ))}
            </Section>

            <Section title="Due today" count={today.length} accent="amber">
              {today.map((t) => (
                <TaskItem key={t.id} task={t} onUpdate={upsert} onDelete={deleteTask} onEdit={setEditing} showProject />
              ))}
              {today.length === 0 && (
                <p className="py-3 text-sm text-gray-400">Nothing due today.</p>
              )}
            </Section>

            <Section title="Upcoming (7 days)" count={upcoming.length} accent="gray">
              {upcoming.map((t) => (
                <TaskItem key={t.id} task={t} onUpdate={upsert} onDelete={deleteTask} onEdit={setEditing} showProject />
              ))}
            </Section>

            {done.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-600"
                >
                  <span className={`transition-transform ${showDone ? 'rotate-90' : ''}`}>▶</span>
                  Completed recently ({done.length})
                </button>
                {showDone && (
                  <div className="space-y-2">
                    {done.map((t) => (
                      <TaskItem key={t.id} task={t} onUpdate={upsert} onDelete={deleteTask} onEdit={setEditing} showProject />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {modal === 'add' && (
        <Modal title="New task" onClose={() => setModal(null)}>
          <TaskForm onSave={addTask} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit task" onClose={() => setEditing(null)}>
          <TaskForm task={editing} onSave={saveEdit} onDelete={deleteTask} />
        </Modal>
      )}
    </div>
  )
}

function Section({
  title, count, accent, children,
}: {
  title: string
  count: number
  accent: 'red' | 'amber' | 'gray'
  children: React.ReactNode
}) {
  const dot = { red: 'bg-red-500', amber: 'bg-amber-400', gray: 'bg-gray-300' }[accent]
  if (count === 0 && accent !== 'amber') return null
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
        {count > 0 && (
          <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
