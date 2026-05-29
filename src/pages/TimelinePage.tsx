import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes, minutesToTime } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Part, CueItem, Project } from '@/types'

interface CueWithPart extends CueItem { partName: string; partColor: string; partId: string }

// ── 달력 컴포넌트 ─────────────────────────────────────────
function MiniCalendar({
  selectedDate, onChange, eventDates
}: { selectedDate: string; onChange: (d: string) => void; eventDates: string[] }) {
  const [viewYear, setViewYear] = useState(() => new Date(selectedDate || Date.now()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate || Date.now()).getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)])

  function toStr(d: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const monthLabel = `${viewYear}년 ${viewMonth + 1}월`

  return (
    <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F4F6F9] text-[#64748B]">
          <i className="ti ti-chevron-left text-[15px]" />
        </button>
        <span className="text-[13px] font-bold text-[#1A1A2E]">{monthLabel}</span>
        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F4F6F9] text-[#64748B]">
          <i className="ti ti-chevron-right text-[15px]" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold pb-1 ${i === 0 ? 'text-[#E24B4A]' : i === 6 ? 'text-[#185FA5]' : 'text-[#A0AEC0]'}`}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((d, di) => {
            if (!d) return <div key={di} />
            const str = toStr(d)
            const isSelected = str === selectedDate
            const hasEvent = eventDates.includes(str)
            const isToday = str === new Date().toISOString().split('T')[0]
            return (
              <button key={di} onClick={() => onChange(str)}
                className={`relative h-8 w-full flex flex-col items-center justify-center rounded-full text-[12px] font-medium transition-colors
                  ${isSelected ? 'bg-[#185FA5] text-white' : isToday ? 'border border-[#185FA5] text-[#185FA5]' : di === 0 ? 'text-[#E24B4A]' : di === 6 ? 'text-[#185FA5]' : 'text-[#1A1A2E] hover:bg-[#F4F6F9]'}`}>
                {d}
                {hasEvent && !isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#185FA5]" />
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function TimelinePage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1) // 0.7 ~ 1.5
  const [now, setNow] = useState(new Date())
  const gridRef = useRef<HTMLDivElement>(null)

  // 핀치줌
  const lastPinchDist = useRef<number | null>(null)
  const lastZoom = useRef(1)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), (s) => {
      if (s.exists()) {
        const p = s.val() as Project
        setProject(p)
        setSelectedDate(p.date ?? new Date().toISOString().split('T')[0])
      }
    }, { onlyOnce: true })
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `parts/${projectId}`), (s) => {
      if (!s.exists()) return
      const list: Part[] = Object.values(s.val())
      list.sort((a, b) => a.order - b.order)
      setParts(list)

      const allMap: CueWithPart[] = []
      let loaded = 0
      list.forEach((part) => {
        onValue(ref(db, `cueItems/${projectId}/${part.id}`), (cs) => {
          loaded++
          if (cs.exists()) {
            const items: CueItem[] = Object.values(cs.val())
            items.forEach((i) => allMap.push({ ...i, partName: part.name, partColor: part.color, partId: part.id }))
          }
          if (loaded === list.length) {
            allMap.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            setAllCues([...allMap])
          }
        })
      })
    })
  }, [projectId])

  // 핀치줌 핸들러
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDist.current = Math.hypot(dx, dy)
      lastZoom.current = zoom
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastPinchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const scale = lastZoom.current * (dist / lastPinchDist.current)
      setZoom(Math.min(1.8, Math.max(0.5, scale)))
    }
  }
  function handleTouchEnd() { lastPinchDist.current = null }

  // 표시할 파트
  const visibleParts = selectedPartId ? parts.filter(p => p.id === selectedPartId) : parts

  // 필터된 큐
  const filteredCues = allCues.filter(c =>
    (!selectedPartId || c.partId === selectedPartId)
  )

  // 시간 범위 계산
  const timeSlots: string[] = []
  if (filteredCues.length > 0) {
    const mins = filteredCues.map(c => timeToMinutes(c.startTime)).filter(m => !isNaN(m))
    const endMins = filteredCues.map(c => timeToMinutes(c.startTime) + (c.durationMin || 30)).filter(m => !isNaN(m))
    const minTime = Math.floor(Math.min(...mins) / 30) * 30
    const maxTime = Math.ceil(Math.max(...endMins) / 30) * 30
    for (let m = minTime; m <= maxTime; m += 30) {
      timeSlots.push(minutesToTime(m))
    }
  }

  const ROW_H = Math.round(60 * zoom)  // 30분당 높이(px)
  const COL_W = Math.round(140 * zoom) // 파트 컬럼 너비
  const TIME_W = 52

  const nowMin = now.getHours() * 60 + now.getMinutes()

  // 큐 위치 계산
  function getCueStyle(cue: CueWithPart) {
    if (!timeSlots.length) return {}
    const baseMin = timeToMinutes(timeSlots[0])
    const startMin = timeToMinutes(cue.startTime)
    const top = ((startMin - baseMin) / 30) * ROW_H
    const height = Math.max(((cue.durationMin || 30) / 30) * ROW_H - 4, ROW_H * 0.6)
    return { top, height }
  }

  // 현재 시간 선 위치
  const nowLineTop = timeSlots.length
    ? ((nowMin - timeToMinutes(timeSlots[0])) / 30) * ROW_H
    : -1

  const eventDates = project ? [project.date, ...(project as any).dateEnd ? [(project as any).dateEnd] : []] : []

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      <Topbar projectName={project?.name} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 컨트롤 */}
        <div className="bg-white border-b border-[#E2E8F0] px-4 pt-3 pb-0">

          {/* 날짜 + 줌 컨트롤 */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setShowCalendar(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F4F6F9] transition-colors">
              <i className="ti ti-calendar text-[#185FA5] text-[15px]" />
              <span className="text-[13px] font-semibold text-[#1A1A2E]">{selectedDate}</span>
              <i className={`ti ti-chevron-${showCalendar ? 'up' : 'down'} text-[#A0AEC0] text-[12px]`} />
            </button>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]">
                <i className="ti ti-minus text-[14px]" />
              </button>
              <span className="text-[11px] text-[#A0AEC0] w-9 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(1.8, +(z + 0.15).toFixed(2)))}
                className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]">
                <i className="ti ti-plus text-[14px]" />
              </button>
              <button onClick={() => setZoom(1)}
                className="h-8 px-2.5 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#64748B] hover:bg-[#F4F6F9] ml-1">
                초기화
              </button>
            </div>
          </div>

          {/* 달력 (접기/펼치기) */}
          {showCalendar && (
            <MiniCalendar
              selectedDate={selectedDate}
              onChange={(d) => { setSelectedDate(d); setShowCalendar(false) }}
              eventDates={eventDates}
            />
          )}

          {/* 파트 필터 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setSelectedPartId(null)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors
                ${!selectedPartId ? 'bg-[#185FA5] text-white' : 'border border-[#E2E8F0] text-[#64748B] bg-white'}`}>
              전체
            </button>
            {parts.map(p => (
              <button key={p.id} onClick={() => setSelectedPartId(selectedPartId === p.id ? null : p.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors
                  ${selectedPartId === p.id ? 'text-white' : 'border-[#E2E8F0] text-[#64748B] bg-white'}`}
                style={selectedPartId === p.id ? { background: p.color, borderColor: p.color } : {}}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 그리드 영역 */}
        {filteredCues.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#A0AEC0]">
            <i className="ti ti-calendar-off text-[48px] opacity-30" />
            <p className="text-[13px]">이 날짜에 큐시트 항목이 없어요</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto"
            ref={gridRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}>

            <div style={{ minWidth: TIME_W + COL_W * visibleParts.length + 16 }}>

              {/* 파트 헤더 (고정처럼 보이게) */}
              <div className="sticky top-0 z-20 flex bg-white border-b-2 border-[#E2E8F0] shadow-sm">
                <div style={{ width: TIME_W, minWidth: TIME_W }} className="flex-shrink-0" />
                {visibleParts.map(p => (
                  <div key={p.id} style={{ width: COL_W, minWidth: COL_W }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2.5 border-l border-[#E2E8F0]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-[11px] font-bold text-[#1A1A2E] truncate">{p.name}</span>
                  </div>
                ))}
              </div>

              {/* 타임 그리드 */}
              <div className="relative flex">
                {/* 시간축 */}
                <div style={{ width: TIME_W, minWidth: TIME_W }} className="flex-shrink-0 relative">
                  {timeSlots.map((t, i) => (
                    <div key={t} style={{ height: ROW_H }}
                      className="flex items-start justify-end pr-2 pt-1">
                      <span className="text-[11px] font-bold text-[#A0AEC0]">{t}</span>
                    </div>
                  ))}
                </div>

                {/* 파트별 컬럼 */}
                {visibleParts.map(part => {
                  const partCues = filteredCues.filter(c => c.partId === part.id)
                  return (
                    <div key={part.id}
                      style={{ width: COL_W, minWidth: COL_W, height: ROW_H * timeSlots.length }}
                      className="flex-shrink-0 relative border-l border-[#E2E8F0]">

                      {/* 시간대 구분선 */}
                      {timeSlots.map((_, i) => (
                        <div key={i} style={{ top: i * ROW_H, height: ROW_H }}
                          className="absolute left-0 right-0 border-b border-[#F1F5F9]" />
                      ))}

                      {/* 큐 카드 */}
                      {partCues.map(cue => {
                        const { top, height } = getCueStyle(cue)
                        const startMin = timeToMinutes(cue.startTime)
                        const isPast = nowMin > startMin + (cue.durationMin || 30)
                        const isCurrent = nowMin >= startMin && nowMin < startMin + (cue.durationMin || 30)
                        return (
                          <div key={cue.id}
                            style={{
                              top: top + 2,
                              height: height,
                              left: 3,
                              right: 3,
                              background: isCurrent ? part.color : 'white',
                              borderColor: isCurrent ? part.color : '#E2E8F0',
                              opacity: isPast ? 0.45 : 1,
                            }}
                            className="absolute rounded-[8px] border px-2 py-1.5 overflow-hidden shadow-sm flex flex-col justify-between">
                            <div>
                              <div className={`text-[11px] font-bold leading-tight ${isCurrent ? 'text-white' : 'text-[#1A1A2E]'}`}
                                style={{ fontSize: Math.round(11 * zoom) + 'px' }}>
                                {cue.title}
                              </div>
                              {cue.durationMin > 0 && (
                                <div className={`text-[10px] mt-0.5 ${isCurrent ? 'text-white/80' : 'text-[#A0AEC0]'}`}
                                  style={{ fontSize: Math.round(9 * zoom) + 'px' }}>
                                  {cue.durationMin}분
                                </div>
                              )}
                            </div>
                            {height > ROW_H * 0.8 && (
                              <div style={{ transform: 'scale(' + Math.min(zoom, 1) + ')', transformOrigin: 'left bottom' }}>
                                <StatusBadge status={cue.status} />
                              </div>
                            )}
                            {isCurrent && (
                              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {/* 현재 시간 선 */}
                {nowLineTop >= 0 && nowLineTop <= ROW_H * timeSlots.length && (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                    style={{ top: nowLineTop }}>
                    <div style={{ width: TIME_W }} className="flex justify-end pr-1">
                      <span className="text-[10px] font-bold text-[#E24B4A] bg-white px-1 rounded">
                        {`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-[#E24B4A]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  )
}
