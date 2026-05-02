import { useEffect, useState } from 'react'
import { Plus, Mail, Phone, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Contact } from '@/types/database'
import { ContactForm } from '@/components/ContactForm'
import { Modal } from '@/components/Modal'

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  const load = async () => {
    const { data } = await supabase.from('contacts').select('*').order('name')
    if (data) setContacts(data as Contact[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onSave = (c: Contact) => {
    setContacts((prev) => {
      const exists = prev.some((x) => x.id === c.id)
      return exists
        ? prev.map((x) => (x.id === c.id ? c : x))
        : [...prev, c].sort((a, b) => a.name.localeCompare(b.name))
    })
    setShowAdd(false)
    setEditing(null)
  }

  const onDelete = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    setEditing(null)
  }

  // Group by first letter
  const grouped = contacts.reduce<Record<string, Contact[]>>((acc, c) => {
    const key = c.name[0]?.toUpperCase() ?? '#'
    acc[key] = [...(acc[key] ?? []), c]
    return acc
  }, {})

  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-amber-500">Directory</p>
            <h1 className="mt-0.5 text-2xl font-bold text-gray-900">Contacts</h1>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} />
            Add contact
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="space-y-6">
            {Object.keys(grouped)
              .sort()
              .map((letter) => (
                <div key={letter}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">{letter}</span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  <div className="space-y-2">
                    {grouped[letter].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setEditing(c)}
                        className="card flex w-full items-center gap-4 px-5 py-3.5 text-left transition-shadow hover:shadow-md"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-surface">
                          {c.initials ?? c.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.role && (
                            <p className="mt-0.5 text-xs text-gray-500 truncate">{c.role}</p>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          {c.email && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Mail size={11} />
                              <span className="hidden sm:inline truncate max-w-[180px]">{c.email}</span>
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Phone size={11} />
                              {c.phone}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add contact" onClose={() => setShowAdd(false)}>
          <ContactForm onSave={onSave} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit contact" onClose={() => setEditing(null)}>
          <ContactForm contact={editing} onSave={onSave} onDelete={onDelete} />
        </Modal>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
      <Users size={40} className="mb-3 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">No contacts yet</p>
      <p className="mt-1 text-xs text-gray-400">
        Add clients, inspectors, and project managers here.
      </p>
      <button onClick={onAdd} className="btn-primary mt-4">
        <Plus size={14} />
        Add contact
      </button>
    </div>
  )
}
