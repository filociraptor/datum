import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'
import { ProjectForm } from '@/components/ProjectForm'
import { Modal } from '@/components/Modal'

interface ProjectWithCount extends Project {
  open_task_count: number
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    // Fetch projects with a count of open tasks
    const { data: projs } = await supabase
      .from('projects')
      .select('*, contact:contacts(id, name, role, email, phone, initials, user_id, created_at)')
      .order('created_at', { ascending: false })

    if (!projs) { setLoading(false); return }

    // Get open task counts
    const { data: counts } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('done', false)
      .not('project_id', 'is', null)

    const countMap: Record<string, number> = {}
    counts?.forEach((r) => {
      if (r.project_id) countMap[r.project_id] = (countMap[r.project_id] ?? 0) + 1
    })

    setProjects(
      projs.map((p) => ({ ...p, open_task_count: countMap[p.id] ?? 0 }) as ProjectWithCount),
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onAdd = (p: Project) => {
    setProjects((prev) => [{ ...p, open_task_count: 0 }, ...prev])
    setShowAdd(false)
    navigate(`/projects/${p.id}`)
  }

  return (
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-amber-500">All projects</p>
            <h1 className="mt-0.5 text-2xl font-bold text-gray-900">Projects</h1>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} />
            New project
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="card flex w-full items-center gap-4 px-5 py-4 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <FolderOpen size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  {p.client && (
                    <p className="mt-0.5 text-sm text-gray-500 truncate">{p.client}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {p.open_task_count > 0 && (
                    <span className="badge bg-amber-50 text-amber-700">
                      {p.open_task_count} open
                    </span>
                  )}
                  {p.contact && (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
                      title={p.contact.name ?? undefined}
                    >
                      {p.contact.initials ?? '?'}
                    </div>
                  )}
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="New project" onClose={() => setShowAdd(false)}>
          <ProjectForm onSave={onAdd} />
        </Modal>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
      <FolderOpen size={40} className="mb-3 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">No projects yet</p>
      <p className="mt-1 text-xs text-gray-400">Create your first project to start tracking tasks.</p>
      <button onClick={onAdd} className="btn-primary mt-4">
        <Plus size={14} />
        Create project
      </button>
    </div>
  )
}
