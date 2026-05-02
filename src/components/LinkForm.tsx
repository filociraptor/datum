import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProjectLink, ProjectLinkInsert, LinkKind } from '@/types/database'

interface LinkFormProps {
  link?: ProjectLink | null
  projectId: string
  sortOrder?: number
  onSave: (l: ProjectLink) => void
  onDelete?: (id: string) => void
}

const KINDS: { value: LinkKind; label: string }[] = [
  { value: 'url', label: 'Website / URL' },
  { value: 'pdf', label: 'PDF document' },
  { value: 'dwg', label: 'Drawing / DWG' },
  { value: 'spec', label: 'Specification' },
  { value: 'permit', label: 'Permit' },
  { value: 'other', label: 'Other' },
]

export function LinkForm({ link, projectId, sortOrder = 0, onSave, onDelete }: LinkFormProps) {
  const [label, setLabel] = useState(link?.label ?? '')
  const [kind, setKind] = useState<LinkKind>(link?.kind ?? 'url')
  const [url, setUrl] = useState(link?.url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !url.trim()) { setError('Label and URL are required'); return }
    setSaving(true)
    setError('')

    const payload: Partial<ProjectLinkInsert> = {
      label: label.trim(),
      kind,
      url: url.trim(),
      sort_order: link?.sort_order ?? sortOrder,
    }

    let result
    if (link) {
      result = await supabase.from('project_links').update(payload).eq('id', link.id).select().single()
    } else {
      result = await supabase
        .from('project_links')
        .insert({ ...payload, project_id: projectId })
        .select()
        .single()
    }

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSave(result.data as ProjectLink)
  }

  const handleDelete = async () => {
    if (!link || !onDelete) return
    if (!confirm('Remove this link?')) return
    await supabase.from('project_links').delete().eq('id', link.id)
    onDelete(link.id)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Label *</label>
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Grading Plan Set Rev 3"
          autoFocus
        />
      </div>

      <div>
        <label className="label">Type</label>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as LinkKind)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">URL *</label>
        <input
          type="url"
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        {link && onDelete ? (
          <button type="button" onClick={handleDelete} className="btn-danger text-xs">
            Remove
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : link ? 'Save' : 'Add link'}
        </button>
      </div>
    </form>
  )
}
