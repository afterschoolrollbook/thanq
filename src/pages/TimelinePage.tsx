import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes } from '@/utils/joinCode'
import type { Part, CueItem } from '@/types'

interface CueWithPart extends CueItem {
  partName: string
  partColor: string
}

export default function TimelinePage() {
  const { projectId } = useParams()
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [now, setNow] = useState(new Date())
  const [loading, setLoading] = useState(true)

  // 현재 시간 1분마다 업데이트
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!projectId) return

    const unsubParts = onValue(ref(db, `parts/${projectId}`), (snap) => {
      if (!snap.exists()) { setLoading(false); return }

      const partList: Part[] = Object.values(snap.val())
      partList.sort((a, b) => a.order - b.order)
      setParts(partList)
      setLoading(false)

      const cueMap: CueWithPart[] = []
      let loaded = 0

      partList.forEach((part) => {
        onValue(ref(db, `cueItems/${projectId}/${part.id}`), (cSnap) => {
          loaded++
          if (cSnap.exists()) {
            const items: CueItem[] = Object.values(cSnap.val())
            items.forEach((item) => {
              cueMap.push({ ...item, partName: part.name, partColor: part.color })
            })
          }
          if (loaded === partList.length) {
            cueMap.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            setAllCues([...cueMap])
          }
        })
      })
    })

    return () => unsubParts()
  }, [projectId])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // 현재 진행 중인 큐
  const currentCue = allCues.find((c) => {
    const start = timeToMinutes(c.startTime)
    const end = start + (c.durationMin || 30)
    return nowMinutes >= start && nowMinutes < end
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-oncue-muted text-sm">불러오는 중...</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-4">

      {/* 현재 시간 헤더 */}
      <div className="oncue-card p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-oncue-muted mb-0.5">현재 시각</p>
          <p className="text-2xl font-black text-primary">{nowTimeStr}</p>
        </div>
        {currentCue ? (
          <div className="text-right">
            <p className="text-xs text-oncue-muted mb-0.5">지금 진행 중</p>
            <p className="text-sm font-bold text-oncue-text">{currentCue.title}</p>
            <p className="text-xs" style={{ color: currentCue.partColor }}>{currentCue.partName}</p>
          </div>
        ) : (
          <div className="text-right">
            <p className="text-xs text-oncue-muted">진행 중인 큐 없음</p>
          </div>
        )}
      </div>

      {/* 파트 필터 */}
      {parts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-white">
            전체
          </button>
          {parts.map((part) => (
            <button
              key={part.id}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-oncue-border text-oncue-muted"
              style={{}}
            >
              {part.name}
            </button>
          ))}
        </div>
      )}

      {/* 타임라인 */}
      {allCues.length === 0 ? (
        <div className="text-center py-12 text-oncue-muted">
          <i className="ti ti-timeline text-4xl block mb-2 opacity-30" />
          <p className="text-sm">큐시트 항목이 없어요</p>
        </div>
      ) : (
        <div className="relative">
          {/* 세로 선 */}
          <div className="absolute left-[52px] top-0 bottom-0 w-px bg-oncue-border" />

          <div className="space-y-1">
            {allCues.map((cue, idx) => {
              const startMin = timeToMinutes(cue.startTime)
              const endMin = startMin + (cue.durationMin || 30)
              const isPast = nowMinutes > endMin
              const isCurrent = nowMinutes >= startMin && nowMinutes < endMin
              return (
                <div key={`${cue.id}-${idx}`} className={`flex items-start gap-3 ${isPast ? 'opacity-50' : ''}`}>
                  {/* 시간 */}
                  <div className="w-12 text-right flex-shrink-0 pt-3">
                    <span className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-oncue-muted'}`}>
                      {cue.startTime}
                    </span>
                  </div>

                  {/* 타임라인 점 */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-3">
                    <div className={`w-3 h-3 rounded-full border-2 z-10 ${
                      isCurrent
                        ? 'border-primary bg-primary'
                        : isPast
                        ? 'border-oncue-border bg-white'
                        : 'border-oncue-border bg-white'
                    }`}
                      style={isCurrent ? {} : { borderColor: cue.partColor }}
                    />
                  </div>

                  {/* 큐 카드 */}
                  <div className={`flex-1 mb-2 rounded-card p-3 border ${
                    isCurrent
                      ? 'border-primary bg-primary-light shadow-card'
                      : 'border-oncue-border bg-white'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-oncue-text'}`}>
                          {cue.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-medium" style={{ color: cue.partColor }}>
                            {cue.partName}
                          </span>
                          {cue.durationMin > 0 && (
                            <span className="text-xs text-oncue-muted">{cue.durationMin}분</span>
                          )}
                        </div>
                      </div>
                      <CueStatusBadge status={cue.status} />
                    </div>
                    {isCurrent && (
                      <div className="mt-2 pt-2 border-t border-primary-mid">
                        <p className="text-xs text-primary font-semibold">🔴 지금 진행 중</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CueStatusBadge({ status }: { status: CueItem['status'] }) {
  const map: Record<CueItem['status'], { label: string; cls: string }> = {
    pending: { label: '대기',   cls: 'badge-wait' },
    ongoing: { label: '진행중', cls: 'badge-ongoing' },
    done:    { label: '완료',   cls: 'badge-done' },
    delay:   { label: '지연',   cls: 'badge-delay' },
  }
  const { label, cls } = map[status]
  return <span className={cls}>{label}</span>
}
