import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, ArrowLeft, Pencil, Link as LinkIcon,
  FileText, Layers, BookOpen, ShieldCheck, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Task, ProjectLink, LinkKind } from '@/types/database'
import { TaskItem } from '@/components/TaskItem'
import { TaskForm } from '@/components/TaskForm'
import { ProjectForm } from '@/components/ProjectForm'
import { LinkForm } from '@/components/LinkForm'
import { Modal } from '@/components/Modal'

const TASK_SELECT = `
  *,
  project:projects(id, name),
  waiting_on:contacts!waiting_on_contact_id(id, name, initials)
`

const KIND_ICON: Record<LinkKind, React.ElementType> = {
  url: LinkIcon,
  pdf: FileText,
  dwg: Layers,
  spec: BookOpen,
  permit: ShieldCheck,
  other: LinkIcon,
}

const KIND_COLOR: Record<LinkKind, string> = {
  url: 'bg-blue-50 text-blue-600',
  pdf: 'bg-red-50 text-red-600',
  dwg: 'bg-purple-50 text-purple-600',
  spec: 'bg-green-50 text-green-600',
  permit: 'bg-amber-50 text-amber-600',
  other: 'bg-gray-100 text-gray-600',
}

type ModalState = 'edit-project' | 'add-task' | 'edit-task' | 'add-link' | 'edit-link' | null

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingLink, setEditingLink] = useState<ProjectLink | null>(null)
  const [showDone, setShowDone] = useState(false)

  const load = async () => {
    if (!id) return
    const [{ data: proj }, { data: taskData }, { data: linkData }] = await Promise.all([
      supabase
        .from('projects')
        .select('*, contact:contacts(id, name, role, email, phone, initials, user_id, created_at)')
        .eq('id', id)
        .single(),
      supabase.from('tasks').select(TASK_SELECT).eq('project_id', id).order('created_at'),
      supabase.from('project_links').select('*').eq('project_id', id).order('sort_order'),
    ])

    if (!proj) { navigate('/projects'); return }
    setProject(proj as Project)
    setTasks((taskData ?? []) as Task[])
    setLinks((linkData ?? []) as ProjectLink[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const openTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)

  const upsertTask = (updated: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updated.id)
      return exists ? prev.map((t) => (t.id === updated.id ? updated : t)) : [updated, ...prev]
    })
    setModal(null)
    setEditingTask(null)
  }

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setModal(null)
    setEditingTask(null)
  }

  const upsertLink = (updated: ProjectLink) => {
    setLinks((prev) => {
      const exists = prev.some((l) => l.id === updated.id)
      return exists ? prev.map((l) => (l.id === updated.id ? updated : l)) : [...prev, updated]
    })
    setModal(null)
    setEditingLink(null)
  }

  const deleteLink = (linkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId))
    setModal(null)
    setEditingLink(null)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        {/* Back */}
        <button
          onClick={() => navigate('/projects')}
          className="btn-ghost mb-4 -ml-2 text-xs text-gray-500"
        >
          <ArrowLeft size={14} />
          Projects
        </button>

        {/* Project header */}
        <div className="card mb-6 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
              {project.client && (
                <p className="mt-0.5 text-sm text-gray-500">{project.client}</p>
              )}
            </div>
            <button
              onClick={() => setModal('edit-project')}
              className="btn-ghost flex-shrink-0 text-xs"
            >
              <Pencil size={13} />
              Edit
            </button>
          </div>

          {project.contact && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-surface">
                {project.contact.initials ?? '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{project.contact.name}</p>
                {project.contact.role && (
                  <p className="text-xs text-gray-500">{project.contact.role}</p>
                )}
              </div>
              <div className="ml-auto flex gap-3 text-xs text-gray-500">
                {project.contact.email && (
                  <a href={`mailto:${project.contact.email}`} className="hover:text-amber-600">
                    {project.contact.email}
                  </a>
                )}
                {project.contact.phone && (
                  <a href={`tel:${project.contact.phone}`} className="hover:text-amber-600">
                    {project.contact.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tasks */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Tasks
              {openTasks.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  {openTasks.length} open
                </span>
              )}
            </h2>
            <button
              onClick={() => setModal('add-task')}
              className="btn-ghost text-xs"
            >
              <Plus size={13} />
              Add task
            </button>
          </div>

          <div className="space-y-2">
            {openTasks.length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                No open tasks
              </p>
            )}
            {openTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onUpdate={upsertTask}
                onDelete={deleteTask}
                onEdit={(task) => { setEditingTask(task); setModal('edit-task') }}
              />
            ))}
          </div>

          {doneTasks.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600"
              >
                <span className={`transition-transform ${showDone ? 'rotate-90' : ''}`}>▶</span>
                {doneTasks.length} completed
              </button>
              {showDone && (
                <div className="mt-2 space-y-2">
                  {doneTasks.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      onUpdate={upsertTask}
                      onDelete={deleteTask}
                      onEdit={(task) => { setEditingTask(task); setModal('edit-task') }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Links */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Project links</h2>
            <button
              onClick={() => setModal('add-link')}
              className="btn-ghost text-xs"
            >
              <Plus size={13} />
              Add link
            </button>
          </div>

          {links.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
              No links yet — add drawings, specs, permits…
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {links.map((l) => {
                const Icon = KIND_ICON[l.kind]
                return (
                  <div
                    key={l.id}
                    className="card flex items-center gap-3 px-4 py-3"
                  >
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm ${KIND_COLOR[l.kind]}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{l.label}</p>
                      <p className="truncate text-xs text-gray-400">{l.kind}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1.5 text-gray-400 hover:text-amber-500"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        onClick={() => { setEditingLink(l); setModal('edit-link') }}
                        className="rounded p-1.5 text-gray-400 hover:text-gray-600"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {modal === 'edit-project' && (
        <Modal title="Edit project" onClose={() => setModal(null)}>
          <ProjectForm
            project={project}
            onSave={(p) => { setProject(p); setModal(null) }}
            onDelete={() => navigate('/projects')}
          />
        </Modal>
      )}
      {modal === 'add-task' && (
        <Modal title="New task" onClose={() => setModal(null)}>
          <TaskForm defaultProjectId={id} onSave={upsertTask} />
        </Modal>
      )}
      {modal === 'edit-task' && editingTask && (
        <Modal title="Edit task" onClose={() => { setModal(null); setEditingTask(null) }}>
          <TaskForm task={editingTask} onSave={upsertTask} onDelete={deleteTask} />
        </Modal>
      )}
      {modal === 'add-link' && (
        <Modal title="Add link" onClose={() => setModal(null)} size="sm">
          <LinkForm projectId={id!} sortOrder={links.length} onSave={upsertLink} />
        </Modal>
      )}
      {modal === 'edit-link' && editingLink && (
        <Modal title="Edit link" onClose={() => { setModal(null); setEditingLink(null) }} size="sm">
          <LinkForm link={editingLink} projectId={id!} onSave={upsertLink} onDelete={deleteLink} />
        </Modal>
      )}
    </div>
  )
}
