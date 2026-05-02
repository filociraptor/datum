import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, ProjectInsert, Contact } from '@/types/database'

interface ProjectFormProps {
  project?: Project | null
  onSave: (p: Project) => void
  onDelete?: (id: string) => void
}

export function ProjectForm({ project, onSave, onDelete }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [client, setClient] = useState(project?.client ?? '')
  const [contactId, setContactId] = useState(project?.contact_id ?? '')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('contacts').select('id, name').order('name').then(({ data }) => {
      if (data) setContacts(data as Contact[])
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')

    const payload: Partial<ProjectInsert> = {
      name: name.trim(),
      client: client.trim() || null,
      contact_id: contactId || null,
    }

    let result
    if (project) {
      result = await supabase
        .from('projects')
        .update(payload)
        .eq('id', project.id)
        .select('*, contact:contacts(id, name, role, email, phone, initials, user_id, created_at)')
        .single()
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      result = await supabase
        .from('projects')
        .insert({ ...payload, user_id: user!.id })
        .select('*, contact:contacts(id, name, role, email, phone, initials, user_id, created_at)')
        .single()
    }

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSave(result.data as Project)
  }

  const handleDelete = async () => {
    if (!project || !onDelete) return
    if (!confirm(`Delete "${project.name}"? All tasks and links will be deleted.`)) return
    await supabase.from('projects').delete().eq('id', project.id)
    onDelete(project.id)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Project name *</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverside Park Grading"
          autoFocus
        />
      </div>

      <div>
        <label className="label">Client / Owner</label>
        <input
          className="input"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="e.g. City of Springfield"
        />
      </div>

      <div>
        <label className="label">Primary contact</label>
        <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">— None —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        {project && onDelete ? (
          <button type="button" onClick={handleDelete} className="btn-danger text-xs">
            Delete project
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </button>
      </div>
    </form>
  )
}
