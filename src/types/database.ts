export type LinkKind = 'url' | 'pdf' | 'dwg' | 'spec' | 'permit' | 'other'

export interface Contact {
  id: string
  user_id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  initials: string | null
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  client: string | null
  meta: Record<string, unknown> | null
  contact_id: string | null
  created_at: string
  // joined
  contact?: Contact | null
}

export interface ProjectLink {
  id: string
  project_id: string
  label: string
  kind: LinkKind
  url: string
  sort_order: number
}

export interface Task {
  id: string
  user_id: string
  project_id: string | null
  title: string
  notes: string | null
  due_date: string | null
  plan_for: string | null
  estimate_minutes: number | null
  bump_count: number
  waiting_on_contact_id: string | null
  nudge_on: string | null
  done: boolean
  created_at: string
  // joined
  project?: Pick<Project, 'id' | 'name'> | null
  waiting_on?: Pick<Contact, 'id' | 'name' | 'initials'> | null
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'bump_count' | 'project' | 'waiting_on'> & {
  bump_count?: number
}
export type TaskUpdate = Partial<TaskInsert>

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'contact'>
export type ProjectUpdate = Partial<ProjectInsert>

export type ContactInsert = Omit<Contact, 'id' | 'created_at'>
export type ContactUpdate = Partial<ContactInsert>

export type ProjectLinkInsert = Omit<ProjectLink, 'id'>
export type ProjectLinkUpdate = Partial<ProjectLinkInsert>
