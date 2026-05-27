import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import type { Project, Part } from '@/types'

export default function DashboardPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return

    const unsubProject = onValue(ref(db, `projects/${projectId}`), (snap) => {
      if (snap.exists()) setProject(snap.val())
      setLoading(false)
    })

    const unsubParts = onValue(ref(db, `parts/${projectId}`), (snap) => {
      if (snap.exists()) {
        const list: Part[] = Object.values(snap.val())
        list.sort((a, b) => a.order - b.order)
        setParts(list)
      }
    })

    return () => { unsubProject(); unsubParts() }
  }, [projectId])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-oncue-muted text-sm">불러오는 중...</p>
    </div>
  )

  const totalProgress = parts.length > 0
    ? Math.round(parts.reduce((sum, p) => sum + p.progress, 0) / parts.length)
    : 0

  const statusCount = {
    waiting: parts.filter((p) => p.status === 'waiting').length,
    ready:   parts.filter((p) => p.status === 'ready').length,
    ongoing: parts.filter((p) => p.status === 'ongoing').length,
    done:    parts.filter((p) => p.status === 'done').length,
    delay:   parts.filter((p) => p.status === 'delay').length,
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-4">

      {/* 타이틀 */}
      <div className="mb-4">
        <h2 className="font-bold text-lg text-oncue-text">{project?.name ?? '대시보드'}</h2>
        <p className="text-xs text-oncue-muted">본부 전체 현황</p>
      </div>

      {/* 전체 진행률 */}
      <div className="oncue-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-oncue-text">전체 준비율</span>
          <span className="text-xl font-black text-primary">{totalProgress}%</span>
        </div>
        <div className="h-3 bg-oncue-bg rounded-full">
          <div
            className="h-3 bg-primary rounded-full transition-all"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-oncue-muted">0%</span>
          <span className="text-xs text-oncue-muted">100%</span>
        </div>
      </div>

      {/* 상태별 요약 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[
          { key: 'waiting', label: '대기',    color: 'bg-status-wait-bg',   text: 'text-status-wait',   count: statusCount.waiting },
          { key: 'ready',   label: '준비',    color: 'bg-primary-light',    text: 'text-primary',       count: statusCount.ready },
          { key: 'ongoing', label: '진행',    color: 'bg-primary-light',    text: 'text-primary',       count: statusCount.ongoing },
          { key: 'done',    label: '완료',    color: 'bg-status-done-bg',   text: 'text-status-done',   count: statusCount.done },
          { key: 'delay',   label: '지연',    color: 'bg-status-delay-bg',  text: 'text-status-delay',  count: statusCount.delay },
        ].map(({ key, label, color, text, count }) => (
          <div key={key} className={`${color} rounded-card p-2 text-center`}>
            <div className={`text-lg font-black ${text}`}>{count}</div>
            <div className={`text-[10px] font-medium ${text}`}>{label}</div>
          </div>
        ))}
      </div>

      {/* 파트별 상세 현황 */}
      <div className="oncue-card p-4 mb-4">
        <h3 className="font-semibold text-sm text-oncue-text mb-3">파트별 현황</h3>
        {parts.length === 0 ? (
          <p className="text-xs text-oncue-muted text-center py-4">파트가 없어요</p>
        ) : (
          <div className="space-y-4">
            {parts.map((part) => (
              <PartDetailRow key={part.id} part={part} />
            ))}
          </div>
        )}
      </div>

      {/* 긴급 공지 버튼 */}
      <button className="w-full bg-status-urgent text-white rounded-card p-4 flex items-center justify-center gap-2 font-bold text-sm active:opacity-80 transition-opacity">
        <i className="ti ti-speakerphone text-lg" />
        전체 긴급 공지 보내기
      </button>
    </div>
  )
}

function PartDetailRow({ part }: { part: Part }) {
  const statusMap: Record<Part['status'], { label: string; cls: string }> = {
    waiting: { label: '대기',    cls: 'badge-wait' },
    ready:   { label: '준비완료', cls: 'badge-ongoing' },
    ongoing: { label: '진행중',  cls: 'badge-ongoing' },
    done:    { label: '완료',    cls: 'badge-done' },
    delay:   { label: '지연',    cls: 'badge-delay' },
  }
  const { label, cls } = statusMap[part.status]

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: part.color }} />
          <span className="text-sm font-medium text-oncue-text">{part.name}</span>
          {part.managerName && (
            <span className="text-xs text-oncue-muted">· {part.managerName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-oncue-muted">{part.progress}%</span>
          <span className={cls}>{label}</span>
        </div>
      </div>
      <div className="h-2 bg-oncue-bg rounded-full">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${part.progress}%`, backgroundColor: part.color }}
        />
      </div>
    </div>
  )
}
