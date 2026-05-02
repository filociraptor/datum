import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskInsert, Contact, Project } from '@/types/database'

interface TaskFormProps {
  task?: Task | null
  defaultProjectId?: string
  onSave: (t: Task) => void
  onDelete?: (id: string) => void
}

export function TaskForm({ task, defaultProjectId, onSave, onDelete }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [planFor, setPlanFor] = useState(task?.plan_for ?? '')
  const [estimate, setEstimate] = useState(task?.estimate_minutes?.toString() ?? '')
  const [projectId, setProjectId] = useState(task?.project_id ?? defaultProjectId ?? '')
  const [waitingOnId, setWaitingOnId] = useState(task?.waiting_on_contact_id ?? '')
  const [nudgeOn, setNudgeOn] = useState(task?.nudge_on ?? '')
  const [projects, setProjects] = useState<Project[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('projects').select('id, name').order('name').then(({ data }) => {
      if (data) setProjects(data as Project[])
    })
    supabase.from('contacts').select('id, name').order('name').then(({ data }) => {
      if (data) setContacts(data as Contact[])
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const payload: Partial<TaskInsert> = {
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      plan_for: planFor || null,
      estimate_minutes: estimate ? parseInt(estimate, 10) : null,
      project_id: projectId || null,
      waiting_on_contact_id: waitingOnId || null,
      nudge_on: nudgeOn || null,
    }

    let result
    if (task) {
      result = await supabase.from('tasks').update(payload).eq('id', task.id).select(`
        *, project:projects(id, name), waiting_on:contacts!waiting_on_contact_id(id, name, initials)
      `).single()
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      result = await supabase.from('tasks').insert({ ...payload, user_id: user!.id }).select(`
        *, project:projects(id, name), waiting_on:contacts!waiting_on_contact_id(id, name, initials)
      `).single()
    }

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSave(result.data as Task)
  }

  const handleDelete = async () => {
    if (!task || !onDelete) return
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', task.id)
    onDelete(task.id)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Review grading plan set"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Due date</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Plan for</label>
          <input type="date" className="input" value={planFor} onChange={(e) => setPlanFor(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estimate (minutes)</label>
          <input
            type="number"
            className="input"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="30"
            min={1}
          />
        </div>
        <div>
          <label className="label">Nudge on</label>
          <input type="date" className="input" value={nudgeOn} onChange={(e) => setNudgeOn(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Project</label>
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— No project —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Waiting on</label>
        <select className="input" value={waitingOnId} onChange={(e) => setWaitingOnId(e.target.value)}>
          <option value="">— Not waiting —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context…"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        {task && onDelete ? (
          <button type="button" onClick={handleDelete} className="btn-danger text-xs">
            Delete
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  )
}
