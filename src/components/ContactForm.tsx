import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Contact, ContactInsert } from '@/types/database'

interface ContactFormProps {
  contact?: Contact | null
  onSave: (c: Contact) => void
  onDelete?: (id: string) => void
}

function deriveInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function ContactForm({ contact, onSave, onDelete }: ContactFormProps) {
  const [name, setName] = useState(contact?.name ?? '')
  const [role, setRole] = useState(contact?.role ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [initials, setInitials] = useState(contact?.initials ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleNameBlur = () => {
    if (!initials && name) setInitials(deriveInitials(name))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')

    const payload: Partial<ContactInsert> = {
      name: name.trim(),
      role: role.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      initials: initials.trim() || deriveInitials(name),
    }

    let result
    if (contact) {
      result = await supabase.from('contacts').update(payload).eq('id', contact.id).select().single()
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      result = await supabase.from('contacts').insert({ ...payload, user_id: user!.id }).select().single()
    }

    setSaving(false)
    if (result.error) { setError(result.error.message); return }
    onSave(result.data as Contact)
  }

  const handleDelete = async () => {
    if (!contact || !onDelete) return
    if (!confirm(`Remove ${contact.name}?`)) return
    await supabase.from('contacts').delete().eq('id', contact.id)
    onDelete(contact.id)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">Full name *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Jane Smith"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Initials</label>
          <input
            className="input"
            value={initials}
            onChange={(e) => setInitials(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="JS"
          />
        </div>
      </div>

      <div>
        <label className="label">Role / Organisation</label>
        <input
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Project Manager, City Engineer"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            type="tel"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        {contact && onDelete ? (
          <button type="button" onClick={handleDelete} className="btn-danger text-xs">
            Remove
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : contact ? 'Save changes' : 'Add contact'}
        </button>
      </div>
    </form>
  )
}
