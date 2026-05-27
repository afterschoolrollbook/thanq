import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { getDday } from '@/utils/joinCode'
import type { Project, Part } from '@/types'

export default function ProjectHomePage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return

    const projectRef = ref(db, `projects/${projectId}`)
    const partsRef = ref(db, `parts/${projectId}`)

    const unsubProject = onValue(projectRef, (snap) => {
      if (snap.exists()) setProject(snap.val())
      setLoading(false)
    })

    const unsubParts = onValue(partsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val()
        const list: Part[] = Object.values(data)
        list.sort((a, b) => a.order - b.order)
        setParts(list)
      }
    })

    return () => { unsubProject(); unsubParts() }
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-oncue-muted text-sm">불러오는 중...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-oncue-muted text-sm">프로젝트를 찾을 수 없어요</div>
      </div>
    )
  }

  const dday = getDday(project.date)
  const isToday = dday === 'D-DAY'
  const totalProgress = parts.length > 0
    ? Math.round(parts.reduce((sum, p) => sum + p.progress, 0) / parts.length)
    : 0

  const doneParts = parts.filter((p) => p.status === 'done').length
  const delayParts = parts.filter((p) => p.status === 'delay').length

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-4">

      {/* D-day 헤더 카드 */}
      <div className={`rounded-card p-5 mb-4 ${isToday ? 'bg-primary' : 'bg-white shadow-card'}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className={`font-bold text-lg leading-tight ${isToday ? 'text-white' : 'text-oncue-text'}`}>
              {project.name}
            </h2>
            <p className={`text-sm mt-0.5 ${isToday ? 'text-primary-mid' : 'text-oncue-muted'}`}>
              {project.venue} · {project.startTime}{project.endTime ? ` ~ ${project.endTime}` : ''}
            </p>
          </div>
          <div className={`text-right`}>
            <span className={`text-2xl font-black ${isToday ? 'text-white' : 'text-primary'}`}>{dday}</span>
            <p className={`text-xs ${isToday ? 'text-primary-mid' : 'text-oncue-muted'}`}>
              {project.date.replace(/-/g, '.')}
            </p>
          </div>
        </div>

        {/* 전체 진행률 */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className={`text-xs font-semibold ${isToday ? 'text-primary-mid' : 'text-oncue-muted'}`}>
              전체 준비율
            </span>
            <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-primary'}`}>
              {totalProgress}%
            </span>
          </div>
          <div className={`h-2 rounded-full ${isToday ? 'bg-white/20' : 'bg-oncue-bg'}`}>
            <div
              className={`h-2 rounded-full transition-all ${isToday ? 'bg-white' : 'bg-primary'}`}
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 참여 코드 */}
      <div className="oncue-card p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-oncue-muted mb-0.5">참여 코드</p>
          <p className="text-xl font-black text-primary tracking-widest">{project.joinCode}</p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(project.joinCode)}
          className="btn-secondary py-2 px-4"
        >
          <i className="ti ti-copy text-sm" />
          복사
        </button>
      </div>

      {/* KPI 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiCard label="파트 수" value={parts.length} icon="ti-layout-grid" color="text-primary" />
        <KpiCard label="완료" value={doneParts} icon="ti-circle-check" color="text-status-done" />
        <KpiCard label="지연" value={delayParts} icon="ti-alert-triangle" color="text-status-delay" />
      </div>

      {/* 타임라인 미리보기 */}
      {project.startTime && (
        <div className="oncue-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-oncue-text">오늘 일정</h3>
            <span className="text-xs text-oncue-muted">{project.startTime} 시작</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm text-oncue-text font-medium">{project.startTime}</span>
            <span className="text-sm text-oncue-muted">{project.name} 시작</span>
          </div>
          {project.endTime && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-oncue-border" />
              <span className="text-sm text-oncue-text font-medium">{project.endTime}</span>
              <span className="text-sm text-oncue-muted">종료 예정</span>
            </div>
          )}
        </div>
      )}

      {/* 파트 현황 */}
      <div className="oncue-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-oncue-text">파트 현황</h3>
          <span className="text-xs text-oncue-muted">{parts.length}개 파트</span>
        </div>

        {parts.length === 0 ? (
          <div className="text-center py-6 text-oncue-muted">
            <i className="ti ti-layout-grid text-3xl block mb-2 opacity-30" />
            <p className="text-xs">파트가 없어요. 파트를 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {parts.map((part) => (
              <PartRow key={part.id} part={part} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PartRow({ part }: { part: Part }) {
  const statusMap: Record<Part['status'], { label: string; cls: string }> = {
    waiting:  { label: '대기',   cls: 'badge-wait' },
    ready:    { label: '준비완료', cls: 'badge-ongoing' },
    ongoing:  { label: '진행중', cls: 'badge-ongoing' },
    done:     { label: '완료',   cls: 'badge-done' },
    delay:    { label: '지연',   cls: 'badge-delay' },
  }
  const { label, cls } = statusMap[part.status]

  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: part.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-oncue-text truncate">{part.name}</span>
          <span className={`${cls} ml-2 flex-shrink-0`}>{label}</span>
        </div>
        <div className="h-1.5 bg-oncue-bg rounded-full">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${part.progress}%`, backgroundColor: part.color }}
          />
        </div>
      </div>
      <span className="text-xs text-oncue-muted w-8 text-right flex-shrink-0">{part.progress}%</span>
    </div>
  )
}

function KpiCard({ label, value, icon, color }: {
  label: string; value: number; icon: string; color: string
}) {
  return (
    <div className="oncue-card p-3 text-center">
      <i className={`ti ${icon} text-xl ${color} block mb-1`} />
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-xs text-oncue-muted">{label}</div>
    </div>
  )
}
