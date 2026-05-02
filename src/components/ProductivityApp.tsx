import { useState, useMemo } from 'react'
import {
  Plus, Settings, ChevronRight, ChevronDown, ChevronLeft,
  Mail, Phone, FileText, ExternalLink, Inbox, Check,
  Pause, MoreHorizontal, Clock, Sunrise, RotateCw, LogOut,
  ArrowUpDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const addDays = (n: number, base: Date = TODAY): Date => {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

const DAY_TIERS = {
  overdue:  { bg: '#3A1010', fg: '#F87171', dot: '#EF4444' },
  today:    { bg: '#3A1010', fg: '#F87171', dot: '#EF4444' },
  tomorrow: { bg: '#3D2204', fg: '#FB923C', dot: '#EA580C' },
  thisWeek: { bg: '#2D2500', fg: '#FBBF24', dot: '#D97706' },
  beyond:   { bg: '#0B2038', fg: '#60A5FA', dot: '#3B82F6' },
  undated:  { bg: '#2a2a28', fg: '#888480', dot: '#555250' },
  paused:   { bg: '#2a2a28', fg: '#888480', dot: '#555250' },
} as const

type DayTierKey = keyof typeof DAY_TIERS
type SwipeAction = 'tomorrow' | 'monday' | 'someday'
type ViewTab = 'today' | 'upcoming' | 'projects'
type PlanChoice = 'today' | 'tomorrow' | 'monday' | 'someday'
type SortBy = 'date' | 'project'

interface ProjectLink { label: string; kind: string; url: string }
interface Project {
  id: string; name: string; client: string; meta: string
  contactId: string | null; links: ProjectLink[]
}
interface Contact {
  id: string; name: string; role: string
  email: string; phone: string; initials: string
}
interface Task {
  id: string; projectId: string; title: string
  dueDate: Date | null; estimateMin: number | null; bumpCount: number
  waitingOn: string | null; nudgeOn: Date | null; planFor: Date | null
  notes: string; done: boolean
}
interface ParseToken {
  type: 'text' | 'project' | 'project-unknown' | 'date' | 'estimate'
  text: string; value?: unknown
}
interface ParsedEntry {
  title: string; projectId: string | null
  dueDate: Date | null; estimateMin: number | null; tokens: ParseToken[]
}

// ─── Helpers ──────────────────────────────────────────────────

const sameDay = (a: Date | null, b: Date | null) =>
  !!(a && b && a.toDateString() === b.toDateString())

const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86400000)

function dayTier(date: Date | null, paused: boolean): DayTierKey {
  if (paused) return 'paused'
  if (!date) return 'undated'
  if (date < TODAY && !sameDay(date, TODAY)) return 'overdue'
  if (sameDay(date, TODAY)) return 'today'
  if (sameDay(date, addDays(1))) return 'tomorrow'
  if (daysBetween(TODAY, date) <= 7) return 'thisWeek'
  return 'beyond'
}

const fmtDateLabel = (d: Date | null, paused?: boolean): string => {
  if (paused) return 'paused'
  if (!d) return 'undated'
  if (sameDay(d, TODAY)) return 'today'
  if (sameDay(d, addDays(1))) return 'tomorrow'
  if (sameDay(d, addDays(-1))) return 'yesterday'
  if (d < TODAY) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (daysBetween(TODAY, d) <= 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const fmtFullDate = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

function fmtEstimate(min: number | null) {
  if (!min) return ''
  if (min < 60) return `${min}m`
  if (min % 60 === 0) return `${min / 60}h`
  return `${(min / 60).toFixed(1)}h`
}

// Date ↔ <input type="date"> value
const toInputDate = (d: Date | null): string => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const fromInputDate = (s: string): Date | null => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Parse "30m" / "1.5h" / "90" → minutes
function parseEstimate(s: string): number | null {
  const match = s.trim().match(/^(\d+(?:\.\d+)?)\s*(m|h)?$/i)
  if (!match) return null
  const n = parseFloat(match[1])
  return match[2]?.toLowerCase() === 'h' ? Math.round(n * 60) : Math.round(n)
}

const WEEKDAYS_SHORT = ['sun','mon','tue','wed','thu','fri','sat']
const WEEKDAYS_LONG  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

function nextWeekday(idx: number): Date {
  const d = new Date(TODAY)
  let diff = (idx - d.getDay() + 7) % 7
  if (diff === 0) diff = 7
  d.setDate(d.getDate() + diff)
  return d
}

function parseQuickEntry(text: string, projects: Project[]): ParsedEntry {
  const tokens: ParseToken[] = []
  const titleWords: string[] = []
  let projectId: string | null = null
  let dueDate: Date | null = null
  let estimateMin: number | null = null
  const words = text.split(/\s+/).filter(Boolean)

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const lower = word.toLowerCase()

    if (word.startsWith('#') && word.length > 1) {
      const q = word.slice(1).toLowerCase().replace(/\s+/g, '')
      const matched = projects.find(p => p.name.toLowerCase().replace(/\s+/g, '').startsWith(q))
      if (matched) { projectId = matched.id; tokens.push({ type: 'project', text: word, value: matched.id }) }
      else         { tokens.push({ type: 'project-unknown', text: word }) }
      continue
    }

    const est = word.match(/^~(\d+)(m|h)$/i)
    if (est) {
      const n = parseInt(est[1], 10)
      estimateMin = est[2].toLowerCase() === 'h' ? n * 60 : n
      tokens.push({ type: 'estimate', text: word, value: estimateMin })
      continue
    }

    if (lower === 'today')    { dueDate = new Date(TODAY); tokens.push({ type: 'date', text: word, value: dueDate }); continue }
    if (lower === 'tomorrow') { dueDate = addDays(1);      tokens.push({ type: 'date', text: word, value: dueDate }); continue }
    if (lower === 'next' && words[i + 1]?.toLowerCase() === 'week') {
      dueDate = addDays(7); tokens.push({ type: 'date', text: 'next week', value: dueDate }); i++; continue
    }

    const dayIdx = WEEKDAYS_LONG.indexOf(lower) >= 0 ? WEEKDAYS_LONG.indexOf(lower) : WEEKDAYS_SHORT.indexOf(lower)
    if (dayIdx >= 0) { dueDate = nextWeekday(dayIdx); tokens.push({ type: 'date', text: word, value: dueDate }); continue }

    tokens.push({ type: 'text', text: word })
    titleWords.push(word)
  }

  return { title: titleWords.join(' '), projectId, dueDate, estimateMin, tokens }
}

// ─── Mock data ────────────────────────────────────────────────

const PROJECTS: Project[] = [
  { id: 'p1', name: 'Sunset Ridge Subdivision',  client: 'DR Horton',          meta: '244 lots',    contactId: 'c1', links: [
    { label: 'Latest contract (rev. 3)', kind: 'PDF',   url: '#' },
    { label: 'Construction drawings',    kind: 'Drive', url: '#' },
    { label: 'City review comments',     kind: 'Word',  url: '#' },
  ]},
  { id: 'p2', name: 'Riverside Townhomes',        client: 'Cothran',            meta: '38 units',    contactId: 'c2', links: [] },
  { id: 'p3', name: 'Patewood Office Plaza',      client: 'Hughes Investments', meta: 'Phase 2',     contactId: 'c3', links: [] },
  { id: 'p4', name: 'Spartanburg Distribution',   client: 'Hillwood',           meta: '1.2M sqft',   contactId: 'c4', links: [] },
  { id: 'p5', name: 'Project Orchid',             client: 'NDA client',         meta: '96 MW',       contactId: null, links: [] },
  { id: 'p6', name: 'Barnwell Amphitheater',      client: 'Barnwell County',    meta: 'Park system', contactId: 'c5', links: [] },
  { id: 'p7', name: 'Upstate Hospital Expansion', client: 'Prisma Health',      meta: 'Tower B',     contactId: null, links: [] },
  { id: 'p8', name: 'City of Greer water main',   client: 'Greer CPW',          meta: '12″ DI',      contactId: null, links: [] },
]

const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Joe Tisdale',  role: "Owner's rep",      email: 'jtisdale@drhorton.com',  phone: '(864) 555-0117', initials: 'JT' },
  { id: 'c2', name: 'Sara Cothran', role: 'Developer',        email: 'sara@cothran.dev',       phone: '(864) 555-0140', initials: 'SC' },
  { id: 'c3', name: 'Marc Hughes',  role: 'Property manager', email: 'mhughes@hughesinv.com',  phone: '(864) 555-0162', initials: 'MH' },
  { id: 'c4', name: 'Erin Pruitt',  role: 'Site selector',    email: 'epruitt@hillwood.com',   phone: '(214) 555-0188', initials: 'EP' },
  { id: 'c5', name: 'Will Carter',  role: 'County engineer',  email: 'wcarter@barnwellsc.gov', phone: '(803) 555-0193', initials: 'WC' },
]

const INITIAL_TASKS: Task[] = [
  { id: 't1', projectId: 'p1', title: 'Mark up final plat — sheet C-3.0', dueDate: addDays(0),  estimateMin: 60,   bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: TODAY,      notes: '244-lot review',     done: false },
  { id: 't2', projectId: 'p3', title: 'Plan check return — Patewood',     dueDate: addDays(0),  estimateMin: 30,   bumpCount: 3, waitingOn: null, nudgeOn: null,       planFor: TODAY,      notes: '',                   done: false },
  { id: 't3', projectId: 'p6', title: 'Schedule hydrant flow test',       dueDate: addDays(0),  estimateMin: 120,  bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: TODAY,      notes: 'before loop design', done: false },
  { id: 't4', projectId: 'p6', title: 'City stagnation memo response',    dueDate: addDays(4),  estimateMin: 90,   bumpCount: 0, waitingOn: 'c5', nudgeOn: addDays(2), planFor: null,       notes: '',                   done: false },
  { id: 't5', projectId: 'p1', title: 'Email Joe re: ROW dedication',     dueDate: addDays(1),  estimateMin: 30,   bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: addDays(1), notes: 'from Outlook',       done: false },
  { id: 't6', projectId: 'p5', title: 'Geotech kickoff prep',             dueDate: addDays(5),  estimateMin: 90,   bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: null,       notes: 'NDA on file',        done: false },
  { id: 't7', projectId: 'p4', title: 'Permit re-submission',             dueDate: addDays(3),  estimateMin: 120,  bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: null,       notes: '',                   done: false },
  { id: 't8', projectId: 'p2', title: 'Alternate vendor research',        dueDate: null,        estimateMin: null, bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: null,       notes: 'someday',            done: false },
  { id: 't9', projectId: 'p3', title: 'Old Patewood quote follow-up',     dueDate: null,        estimateMin: null, bumpCount: 0, waitingOn: null, nudgeOn: null,       planFor: null,       notes: '',                   done: false },
]

const DAILY_CAPACITY_HRS = 8

// ─── Edit task bottom sheet ────────────────────────────────────

function EditTaskSheet({ task, projects, onSave, onClose }: {
  task: Task
  projects: Project[]
  onSave: (t: Task) => void
  onClose: () => void
}) {
  const [dueDate,     setDueDate]     = useState(toInputDate(task.dueDate))
  const [estimateStr, setEstimateStr] = useState(fmtEstimate(task.estimateMin))
  const [projectId,   setProjectId]   = useState(task.projectId)

  const save = () => {
    onSave({
      ...task,
      dueDate:     fromInputDate(dueDate),
      planFor:     fromInputDate(dueDate), // keep planFor in sync with due
      estimateMin: parseEstimate(estimateStr),
      projectId,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#222220] rounded-t-2xl border-t border-[#3a3a38] pb-safe">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#3a3a38]" />
        </div>

        {/* Task title */}
        <div className="px-5 pb-3 border-b border-[#2a2a28]">
          <p className="text-[13px] font-medium text-[#e0ddd8] leading-snug">{task.title}</p>
        </div>

        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Due date */}
          <div>
            <label className="block text-[10.5px] font-medium uppercase tracking-wider text-[#888480] mb-1.5">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-[#2a2a28] text-[#e0ddd8] rounded-lg px-3 py-2.5 text-[13px] border border-[#3a3a38] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 [color-scheme:dark]"
            />
          </div>

          {/* Effort */}
          <div>
            <label className="block text-[10.5px] font-medium uppercase tracking-wider text-[#888480] mb-1.5">
              Effort
            </label>
            <input
              type="text"
              value={estimateStr}
              onChange={e => setEstimateStr(e.target.value)}
              placeholder="e.g. 30m or 1.5h"
              className="w-full bg-[#2a2a28] text-[#e0ddd8] rounded-lg px-3 py-2.5 text-[13px] border border-[#3a3a38] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 placeholder:text-[#444240]"
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-[10.5px] font-medium uppercase tracking-wider text-[#888480] mb-1.5">
              Project
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full bg-[#2a2a28] text-[#e0ddd8] rounded-lg px-3 py-2.5 text-[13px] border border-[#3a3a38] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 [color-scheme:dark]"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={save}
            className="w-full py-2.5 rounded-xl bg-amber-500 text-[#1d1d1b] text-[13px] font-semibold hover:bg-amber-600 active:bg-amber-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────

function DueDatePill({ date, paused, bumpCount }: { date: Date | null; paused?: boolean; bumpCount?: number }) {
  const tier = dayTier(date, !!paused)
  const tone = DAY_TIERS[tier]
  const label = fmtDateLabel(date, paused)
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {paused
        ? <Pause size={9} strokeWidth={2.5} />
        : <span style={{ width: 5, height: 5, borderRadius: '50%', background: tone.dot, display: 'inline-block' }} />}
      {tier === 'overdue' ? `overdue · ${label}` : label}
      {(bumpCount ?? 0) >= 3 && <RotateCw size={9} strokeWidth={2.5} />}
    </span>
  )
}

function TaskRow({ task, project, onToggle, onSwipeAction, onEdit, showProject = false }: {
  task: Task; project: Project | undefined
  onToggle: (id: string) => void
  onSwipeAction: (id: string, action: SwipeAction) => void
  onEdit: (t: Task) => void
  showProject?: boolean
}) {
  const [swiped, setSwiped] = useState(false)
  const isWaiting = !!task.waitingOn

  return (
    <div className="relative overflow-hidden border-b border-[#2a2a28]">
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch z-0">
        <button onClick={() => { onSwipeAction(task.id, 'tomorrow'); setSwiped(false) }} className="px-3 text-[11px] font-medium text-white" style={{ background: '#C07818' }}>Tmrw</button>
        <button onClick={() => { onSwipeAction(task.id, 'monday');   setSwiped(false) }} className="px-3 text-[11px] font-medium text-[#d0cdc6] bg-[#3a3a38]">Mon</button>
        <button onClick={() => { onSwipeAction(task.id, 'someday');  setSwiped(false) }} className="px-3 text-[11px] font-medium text-[#888480] bg-[#2a2a28]">Later</button>
      </div>

      <div
        className={`relative transition-all duration-200 px-4 py-2.5 flex items-start gap-3 ${isWaiting ? 'bg-[#222220]' : 'bg-[#1d1d1b] hover:bg-[#222220]'}`}
        style={{ transform: swiped ? 'translateX(-180px)' : 'translateX(0)', zIndex: 1 }}
      >
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id)}
          className="mt-0.5 w-4 h-4 rounded-full border border-[#555250] hover:border-[#888480] flex items-center justify-center flex-shrink-0 transition-colors"
          style={task.done ? { background: '#555250', borderColor: '#555250' } : {}}
        >
          {task.done && <Check size={9} color="#1d1d1b" strokeWidth={3} />}
        </button>

        {/* Tappable content area — opens edit sheet */}
        <button
          onClick={() => onEdit(task)}
          className="flex-1 min-w-0 text-left"
        >
          <div className={`text-[13px] leading-snug ${task.done ? 'line-through text-[#555250]' : isWaiting ? 'text-[#888480]' : 'text-[#e0ddd8]'}`}>
            {task.title}
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <DueDatePill date={task.dueDate} paused={isWaiting} bumpCount={task.bumpCount} />
            {task.estimateMin && !isWaiting && (
              <span className="inline-flex items-center gap-0.5 text-[#66625e] font-mono text-[10px]">
                <Clock size={9} /> {fmtEstimate(task.estimateMin)}
              </span>
            )}
            {showProject && project && <span className="text-[11px] text-[#66625e] truncate">{project.name}</span>}
            {isWaiting && (() => {
              const c = CONTACTS.find(cc => cc.id === task.waitingOn)
              return <span className="text-[11px] text-[#888480] italic truncate">waiting on {c?.name}</span>
            })()}
          </div>
          {task.bumpCount >= 3 && !isWaiting && (
            <div className="text-[10.5px] mt-1 text-amber-400">
              bumped {task.bumpCount}× — break it down or drop?
            </div>
          )}
        </button>

        <button onClick={() => setSwiped(s => !s)} className="text-[#444240] hover:text-[#888480] flex-shrink-0 mt-0.5 transition-colors">
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Views ────────────────────────────────────────────────────

function CapacityBar({ minutesPlanned }: { minutesPlanned: number }) {
  const planned = minutesPlanned / 60
  const pct = Math.min(100, (planned / DAILY_CAPACITY_HRS) * 100)
  const over = planned > DAILY_CAPACITY_HRS
  const free = Math.max(0, DAILY_CAPACITY_HRS - planned)
  return (
    <div className="px-4 py-3 bg-[#222220] border-b border-[#2a2a28]">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#888480]">Capacity</span>
        <span className="text-[12px] font-medium text-[#e0ddd8]">{planned.toFixed(1)} of {DAILY_CAPACITY_HRS} hr</span>
      </div>
      <div className="h-1.5 bg-[#3a3a38] rounded-full overflow-hidden">
        <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${pct}%`, background: over ? '#EF4444' : '#f59e0b' }} />
      </div>
      <div className="text-[10.5px] text-[#888480] mt-1.5">
        {over
          ? <span className="text-red-400 font-medium">{(planned - DAILY_CAPACITY_HRS).toFixed(1)} hr over capacity</span>
          : <>{Math.round(pct)}% planned · {free.toFixed(1)} hr free</>}
      </div>
    </div>
  )
}

function TodayView({ tasks, projects, onToggle, onSwipeAction, onEdit }: {
  tasks: Task[]; projects: Project[]
  onToggle: (id: string) => void
  onSwipeAction: (id: string, a: SwipeAction) => void
  onEdit: (t: Task) => void
}) {
  const bucket  = tasks.filter(t => !t.done && (sameDay(t.planFor, TODAY) || (t.dueDate && t.dueDate < TODAY && !sameDay(t.dueDate, TODAY))))
  const active  = bucket.filter(t => !t.waitingOn)
  const waiting = bucket.filter(t => t.waitingOn)
  const minutesPlanned = active.reduce((s, t) => s + (t.estimateMin ?? 0), 0)
  return (
    <div>
      <CapacityBar minutesPlanned={minutesPlanned} />
      {bucket.length === 0
        ? <div className="px-4 py-12 text-center text-[13px] text-[#555250]">Nothing on the plan for today.</div>
        : <>
            {active.map(t => <TaskRow key={t.id} task={t} project={projects.find(p => p.id === t.projectId)} onToggle={onToggle} onSwipeAction={onSwipeAction} onEdit={onEdit} showProject />)}
            {waiting.length > 0 && <>
              <div className="px-4 pt-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[#555250]">Waiting on others</div>
              {waiting.map(t => <TaskRow key={t.id} task={t} project={projects.find(p => p.id === t.projectId)} onToggle={onToggle} onSwipeAction={onSwipeAction} onEdit={onEdit} showProject />)}
            </>}
          </>}
    </div>
  )
}

function UpcomingView({ tasks, projects, onToggle, onSwipeAction, onEdit }: {
  tasks: Task[]; projects: Project[]
  onToggle: (id: string) => void
  onSwipeAction: (id: string, a: SwipeAction) => void
  onEdit: (t: Task) => void
}) {
  const [sortBy, setSortBy] = useState<SortBy>('date')

  const upcoming = tasks
    .filter(t => !t.done && t.dueDate && t.dueDate >= TODAY)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())

  if (upcoming.length === 0) {
    return <div className="px-4 py-12 text-center text-[13px] text-[#555250]">Nothing scheduled.</div>
  }

  // Sort toggle bar
  const SortBar = (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a28] bg-[#1d1d1b]">
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#555250]">
        {upcoming.length} task{upcoming.length !== 1 ? 's' : ''}
      </span>
      <button
        onClick={() => setSortBy(s => s === 'date' ? 'project' : 'date')}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
          sortBy === 'project'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : 'border-[#3a3a38] text-[#888480] hover:text-[#b8b4ac] hover:bg-[#2a2a28]'
        }`}
      >
        <ArrowUpDown size={11} />
        {sortBy === 'date' ? 'By date' : 'By project'}
      </button>
    </div>
  )

  if (sortBy === 'project') {
    // Group by project
    const grouped = upcoming.reduce<Record<string, { project: Project | undefined; tasks: Task[] }>>((acc, t) => {
      const key = t.projectId
      if (!acc[key]) acc[key] = { project: projects.find(p => p.id === key), tasks: [] }
      acc[key].tasks.push(t)
      return acc
    }, {})
    const groups = Object.values(grouped).sort((a, b) =>
      (a.project?.name ?? '').localeCompare(b.project?.name ?? '')
    )
    return (
      <div>
        {SortBar}
        {groups.map(g => (
          <div key={g.project?.id ?? 'none'}>
            <div className="px-4 pt-3 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-[#555250]">
              {g.project?.name ?? 'No project'}
            </div>
            {g.tasks.map(t => (
              <TaskRow key={t.id} task={t} project={g.project} onToggle={onToggle} onSwipeAction={onSwipeAction} onEdit={onEdit} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Default: group by date
  const byDate = upcoming.reduce<Record<string, { date: Date; tasks: Task[] }>>((acc, t) => {
    const key = t.dueDate!.toDateString()
    if (!acc[key]) acc[key] = { date: t.dueDate!, tasks: [] }
    acc[key].tasks.push(t)
    return acc
  }, {})
  const days = Object.values(byDate)

  return (
    <div>
      {SortBar}
      {days.map(g => (
        <div key={g.date.toDateString()}>
          <div className="px-4 pt-3 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-[#555250]">{fmtFullDate(g.date)}</div>
          {g.tasks.map(t => (
            <TaskRow key={t.id} task={t} project={projects.find(p => p.id === t.projectId)} onToggle={onToggle} onSwipeAction={onSwipeAction} onEdit={onEdit} showProject />
          ))}
        </div>
      ))}
    </div>
  )
}

function ProjectsView({ projects, tasks, expanded, toggleExpanded, onSelectProject, onToggle, onSwipeAction, onEdit }: {
  projects: Project[]; tasks: Task[]; expanded: Set<string>
  toggleExpanded: (id: string) => void; onSelectProject: (id: string) => void
  onToggle: (id: string) => void
  onSwipeAction: (id: string, a: SwipeAction) => void
  onEdit: (t: Task) => void
}) {
  return (
    <div>
      {projects.map(p => {
        const projTasks = tasks.filter(t => t.projectId === p.id && !t.done)
        const isOpen = expanded.has(p.id)
        return (
          <div key={p.id}>
            <div className="flex items-stretch border-b border-[#2a2a28] hover:bg-[#222220] transition-colors">
              <button onClick={() => toggleExpanded(p.id)} className="px-2 flex items-center justify-center text-[#555250] hover:text-[#888480] transition-colors">
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              <button onClick={() => onSelectProject(p.id)} className="flex-1 px-2 py-2.5 flex items-center gap-2.5 text-left min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#e0ddd8] truncate">{p.name}</div>
                  <div className="text-[11px] text-[#888480] truncate">{p.client} · {p.meta}</div>
                </div>
                <span className="text-[11px] text-[#555250]">{projTasks.length}</span>
              </button>
            </div>
            {isOpen && projTasks.map(t => (
              <TaskRow key={t.id} task={t} project={p} onToggle={onToggle} onSwipeAction={onSwipeAction} onEdit={onEdit} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ProjectDetailView({ project, tasks, contact, onToggle, onSwipeAction, onEdit }: {
  project: Project; tasks: Task[]; contact: Contact | undefined
  onToggle: (id: string) => void
  onSwipeAction: (id: string, a: SwipeAction) => void
  onEdit: (t: Task) => void
}) {
  const projTasks = tasks.filter(t => t.projectId === project.id && !t.done)
  return (
    <div>
      {contact && (
        <>
          <div className="px-4 pt-4 pb-2 text-[10.5px] font-medium uppercase tracking-wider text-[#555250]">Primary contact</div>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-medium flex-shrink-0 bg-amber-500 text-[#1d1d1b]">{contact.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#e0ddd8] truncate">{contact.name}</div>
                <div className="text-[11px] text-[#888480] truncate">{contact.role}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <a href={`mailto:${contact.email}`} className="text-[11px] px-2.5 py-1 rounded-full bg-[#2a2a28] hover:bg-[#333331] text-[#b8b4ac] transition-colors flex items-center gap-1.5">
                <Mail size={11} /> {contact.email}
              </a>
              <a href={`tel:${contact.phone}`} className="text-[11px] px-2.5 py-1 rounded-full bg-[#2a2a28] hover:bg-[#333331] text-[#b8b4ac] transition-colors flex items-center gap-1.5">
                <Phone size={11} /> {contact.phone}
              </a>
            </div>
          </div>
        </>
      )}

      {project.links.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-2 text-[10.5px] font-medium uppercase tracking-wider text-[#555250] border-t border-[#2a2a28]">Pinned links</div>
          <div className="px-4 pb-4 flex flex-col gap-1.5">
            {project.links.map((l, idx) => (
              <a key={idx} href={l.url} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-[#222220] hover:bg-[#2a2a28] transition-colors">
                <FileText size={13} className="text-[#888480] flex-shrink-0" />
                <span className="text-[13px] flex-1 truncate text-[#e0ddd8]">{l.label}</span>
                <span className="text-[10px] text-[#555250]">{l.kind}</span>
                <ExternalLink size={11} className="text-[#555250]" />
              </a>
            ))}
          </div>
        </>
      )}

      <div className="px-4 pt-3 pb-2 text-[10.5px] font-medium uppercase tracking-wider text-[#555250] border-t border-[#2a2a28]">
        Tasks · {projTasks.length}
      </div>
      {projTasks.length === 0
        ? <div className="px-4 py-6 text-center text-[12px] text-[#555250]">No open tasks.</div>
        : projTasks.map(t => (
            <TaskRow key={t.id} task={t} project={project} onToggle={onToggle} onSwipeAction={onSwipeAction} onEdit={onEdit} />
          ))}
    </div>
  )
}

// ─── Daily plan ritual ────────────────────────────────────────

function DailyPlanRitual({ tasks, projects, onResolve, onSkip }: {
  tasks: Task[]; projects: Project[]
  onResolve: (d: Record<string, PlanChoice>) => void; onSkip: () => void
}) {
  const carryovers = useMemo(
    () => tasks.filter(t => !t.done && t.planFor && t.planFor < TODAY && !sameDay(t.planFor, TODAY)),
    [tasks],
  )
  const [decisions, setDecisions] = useState<Record<string, PlanChoice>>(() => {
    const m: Record<string, PlanChoice> = {}
    carryovers.forEach(t => { m[t.id] = 'today' })
    return m
  })
  const counts = useMemo(() => {
    const c: Record<PlanChoice, number> = { today: 0, tomorrow: 0, monday: 0, someday: 0 }
    Object.values(decisions).forEach(d => { c[d] = (c[d] ?? 0) + 1 })
    return c
  }, [decisions])

  if (carryovers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Sunrise size={32} className="text-[#555250] mb-3" strokeWidth={1.5} />
        <div className="text-[15px] font-medium text-[#e0ddd8]">Clean slate</div>
        <div className="text-[12px] text-[#888480] mt-1">Nothing carried over from yesterday.</div>
        <button onClick={onSkip} className="mt-5 text-[12px] px-4 py-1.5 rounded-full bg-amber-500 text-[#1d1d1b] font-medium hover:bg-amber-600 transition-colors">
          Start day →
        </button>
      </div>
    )
  }

  const setChoice = (id: string, choice: PlanChoice) => setDecisions(d => ({ ...d, [id]: choice }))
  const choices: { id: PlanChoice; label: string }[] = [
    { id: 'today', label: 'Today' }, { id: 'tomorrow', label: 'Tmrw' },
    { id: 'monday', label: 'Pick day' }, { id: 'someday', label: 'Later' },
  ]

  return (
    <div>
      <div className="px-5 pt-5 pb-3">
        <div className="text-[10.5px] font-medium uppercase tracking-wider text-[#888480]">Quick plan</div>
        <div className="text-[18px] font-semibold text-[#f0ede8] mt-0.5">
          {TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="text-[12px] text-[#888480] mt-1">
          {carryovers.length} {carryovers.length === 1 ? 'task' : 'tasks'} didn't finish yesterday. One tap each.
        </div>
      </div>

      <div className="border-t border-[#2a2a28]">
        {carryovers.map(t => {
          const proj = projects.find(p => p.id === t.projectId)
          return (
            <div key={t.id} className="px-5 py-3 border-b border-[#2a2a28]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] text-[#e0ddd8] flex-1 min-w-0 truncate">{t.title}</span>
                <span className="text-[11px] text-[#555250] truncate flex items-center gap-1.5">
                  {t.bumpCount >= 3 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded font-medium" style={{ background: '#2D1800', color: '#FBA040' }}>
                      <RotateCw size={9} />{t.bumpCount}
                    </span>
                  )}
                  {proj?.name}
                </span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {choices.map(c => {
                  const active = decisions[t.id] === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => setChoice(t.id, c.id)}
                      className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${active ? 'bg-amber-500 text-[#1d1d1b] font-medium' : 'text-[#888480] border border-[#3a3a38] hover:bg-[#2a2a28]'}`}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 py-3.5 bg-[#222220] flex items-center justify-between">
        <div className="text-[11px] text-[#888480]">
          {counts.today} today
          {counts.tomorrow > 0 && ` · ${counts.tomorrow} tmrw`}
          {counts.monday > 0   && ` · ${counts.monday} later`}
          {counts.someday > 0  && ` · ${counts.someday} someday`}
        </div>
        <button onClick={() => onResolve(decisions)} className="text-[12px] px-4 py-1.5 rounded-full bg-amber-500 text-[#1d1d1b] font-medium hover:bg-amber-600 transition-colors">
          Start day →
        </button>
      </div>
    </div>
  )
}

// ─── Quick entry ──────────────────────────────────────────────

function QuickEntry({ projects, onCommit }: { projects: Project[]; onCommit: (p: ParsedEntry) => void }) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseQuickEntry(text, projects), [text, projects])
  const showPreview = text.trim().length > 0 && (parsed.projectId || parsed.dueDate || parsed.estimateMin)

  const tokenStyle = (type: string): React.CSSProperties | null => {
    if (type === 'project')         return { background: '#1C2E10', color: '#86EFAC' }
    if (type === 'project-unknown') return { background: '#2a2a28', color: '#888480' }
    if (type === 'date')            return { background: '#0B2038', color: '#93C5FD' }
    if (type === 'estimate')        return { background: '#1E1430', color: '#C4B5FD' }
    return null
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && text.trim()) { onCommit(parsed); setText('') }
    else if (e.key === 'Escape')          { setText('') }
  }

  return (
    <div className="px-3 pt-2.5 pb-2 border-b border-[#2a2a28]">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type a task…  #project  tomorrow  ~30m"
        className="w-full bg-[#2a2a28] hover:bg-[#333331] focus:bg-[#333331] focus:outline-none focus:ring-1 focus:ring-[#555250] rounded-md px-3 py-2 text-[13px] text-[#e0ddd8] placeholder:text-[#444240] transition-colors"
      />
      {text.trim().length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap px-1">
          {parsed.tokens.map((t, i) => {
            const s = tokenStyle(t.type)
            if (!s) return <span key={i} className="text-[12px] text-[#b8b4ac]">{t.text}</span>
            return <span key={i} className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={s}>{t.text}</span>
          })}
        </div>
      )}
      {showPreview && (
        <div className="mt-2 flex items-start gap-2.5 px-2.5 py-2 bg-[#222220] rounded-md border border-[#333331]">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#e0ddd8] truncate">{parsed.title || '(no title yet)'}</div>
            <div className="text-[10.5px] text-[#888480] flex items-center gap-1.5 mt-1 flex-wrap">
              {parsed.dueDate && <DueDatePill date={parsed.dueDate} />}
              {parsed.projectId && <span>{projects.find(p => p.id === parsed.projectId)?.name}</span>}
              {parsed.estimateMin && <span className="font-mono text-[10px]">{fmtEstimate(parsed.estimateMin)}</span>}
            </div>
          </div>
          <span className="text-[10px] text-[#444240] flex-shrink-0 mt-0.5">↵ to add</span>
        </div>
      )}
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────

export function ProductivityApp() {
  const [view, setView]                       = useState<ViewTab>('today')
  const [tasks, setTasks]                     = useState<Task[]>(INITIAL_TASKS)
  const [projects]                            = useState<Project[]>(PROJECTS)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [expanded, setExpanded]               = useState<Set<string>>(new Set(['p1', 'p6']))
  const [showRitual, setShowRitual]           = useState(true)
  const [editingTask, setEditingTask]         = useState<Task | null>(null)

  const toggleTask = (id: string) =>
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))

  const saveEditedTask = (updated: Task) =>
    setTasks(ts => ts.map(t => t.id === updated.id ? updated : t))

  const toggleExpanded = (id: string) =>
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleSwipeAction = (id: string, action: SwipeAction) => {
    setTasks(ts => ts.map(t => {
      if (t.id !== id) return t
      let np = t.planFor, nd = t.dueDate
      if (action === 'tomorrow') { np = addDays(1); nd = addDays(1) }
      if (action === 'monday')   { const m = nextWeekday(1); np = m; nd = m }
      if (action === 'someday')  { np = null; nd = null }
      return { ...t, planFor: np, dueDate: nd, bumpCount: t.bumpCount + 1 }
    }))
  }

  const commitTask = (parsed: ParsedEntry) => {
    if (!parsed.title) return
    setTasks(ts => [{
      id: 't' + Math.random().toString(36).slice(2, 8),
      projectId:   parsed.projectId ?? projects[0].id,
      title:       parsed.title,
      dueDate:     parsed.dueDate,
      estimateMin: parsed.estimateMin,
      bumpCount:   0, waitingOn: null, nudgeOn: null,
      planFor:     parsed.dueDate && parsed.dueDate <= addDays(0) ? TODAY : parsed.dueDate,
      notes:       '', done: false,
    }, ...ts])
  }

  const resolveRitual = (decisions: Record<string, PlanChoice>) => {
    setTasks(ts => ts.map(t => {
      if (!(t.id in decisions)) return t
      const d = decisions[t.id]
      const bump = (np: Date | null): Task => ({ ...t, planFor: np, dueDate: np, bumpCount: t.bumpCount + 1 })
      if (d === 'today')    return bump(TODAY)
      if (d === 'tomorrow') return bump(addDays(1))
      if (d === 'monday')   return bump(nextWeekday(1))
      return { ...t, planFor: null, dueDate: null, bumpCount: t.bumpCount + 1 }
    }))
    setShowRitual(false)
  }

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null
  const activeContact = activeProject?.contactId ? CONTACTS.find(c => c.id === activeProject.contactId) : undefined

  const TABS: { id: ViewTab; label: string }[] = [
    { id: 'today',    label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'projects', label: 'Projects' },
  ]

  const todayLabel = TODAY.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div
      className="flex flex-col bg-[#1d1d1b] overflow-hidden"
      style={{ height: '100dvh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif' }}
    >
      {/* ── Top navigation bar ── */}
      <header className="flex-shrink-0 border-b border-[#2a2a28]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            {activeProject ? (
              <button onClick={() => setActiveProjectId(null)} className="text-[#888480] hover:text-[#e0ddd8] transition-colors mr-0.5">
                <ChevronLeft size={18} />
              </button>
            ) : (
              <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-[#1d1d1b]">D</span>
              </div>
            )}
            <div>
              <div className="text-[14px] font-semibold text-[#e0ddd8] leading-tight">
                {activeProject ? activeProject.name : 'Datum'}
              </div>
              <div className="text-[10px] text-[#666260]">
                {activeProject ? `${activeProject.client} · ${activeProject.meta}` : todayLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {!showRitual && !activeProject && (
              <button onClick={() => setShowRitual(true)} className="w-8 h-8 rounded-md hover:bg-[#2a2a28] flex items-center justify-center text-[#666260] hover:text-[#b8b4ac] transition-colors" title="Daily plan">
                <Sunrise size={15} />
              </button>
            )}
            {!activeProject && (
              <button className="w-8 h-8 rounded-md hover:bg-[#2a2a28] flex items-center justify-center text-[#666260] hover:text-[#b8b4ac] transition-colors">
                <Plus size={15} />
              </button>
            )}
            <button className="w-8 h-8 rounded-md hover:bg-[#2a2a28] flex items-center justify-center text-[#666260] hover:text-[#b8b4ac] transition-colors">
              <Settings size={15} />
            </button>
            <button onClick={() => supabase.auth.signOut()} className="w-8 h-8 rounded-md hover:bg-[#2a2a28] flex items-center justify-center text-[#666260] hover:text-[#b8b4ac] transition-colors" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {!showRitual && !activeProject && (
          <div className="flex gap-1 px-3 pb-2">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`text-[12px] px-3 py-1 rounded-full transition-colors ${view === t.id ? 'bg-amber-500 text-[#1d1d1b] font-semibold' : 'text-[#888480] hover:bg-[#2a2a28] hover:text-[#b8b4ac]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {!showRitual && !activeProject && (
        <QuickEntry projects={projects} onCommit={commitTask} />
      )}

      <main className="flex-1 overflow-y-auto overscroll-contain">
        {showRitual ? (
          <DailyPlanRitual tasks={tasks} projects={projects} onResolve={resolveRitual} onSkip={() => setShowRitual(false)} />
        ) : activeProject ? (
          <ProjectDetailView project={activeProject} tasks={tasks} contact={activeContact} onToggle={toggleTask} onSwipeAction={handleSwipeAction} onEdit={setEditingTask} />
        ) : (
          <>
            {view === 'today'    && <TodayView    tasks={tasks} projects={projects} onToggle={toggleTask} onSwipeAction={handleSwipeAction} onEdit={setEditingTask} />}
            {view === 'upcoming' && <UpcomingView tasks={tasks} projects={projects} onToggle={toggleTask} onSwipeAction={handleSwipeAction} onEdit={setEditingTask} />}
            {view === 'projects' && <ProjectsView projects={projects} tasks={tasks} expanded={expanded} toggleExpanded={toggleExpanded} onSelectProject={setActiveProjectId} onToggle={toggleTask} onSwipeAction={handleSwipeAction} onEdit={setEditingTask} />}
          </>
        )}
      </main>

      {!showRitual && !activeProject && (
        <footer className="flex-shrink-0 px-3 py-2.5 border-t border-[#2a2a28] flex items-center justify-center gap-2 text-[11px] text-[#444240] hover:bg-[#222220] hover:text-[#888480] transition-colors cursor-pointer">
          <Inbox size={12} />
          <span>Drop email here to add task</span>
        </footer>
      )}

      {/* ── Edit task bottom sheet ── */}
      {editingTask && (
        <EditTaskSheet
          task={editingTask}
          projects={projects}
          onSave={saveEditedTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
