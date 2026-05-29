import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes, minutesToTime } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Part, CueItem, Project } from '@/types'

interface CueWithPart extends CueItem { partName: string; partColor: string; partId: string }

// ── 달력 드롭다운 ─────────────────────────────────────────
function MiniCalendar({ selectedDate, onChange, eventDates, onClose }: {
  selectedDate: string; onChange: (d: string) => void; eventDates: string[]; onClose: () => void
}) {
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
  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-[12px] border border-[#E2E8F0] shadow-lg p-3 w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F4F6F9]"><i className="ti ti-chevron-left text-[13px]" /></button>
        <span className="text-[12px] font-bold text-[#1A1A2E]">{viewYear}년 {viewMonth + 1}월</span>
        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F4F6F9]"><i className="ti ti-chevron-right text-[13px]" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold pb-1 ${i===0?'text-[#E24B4A]':i===6?'text-[#185FA5]':'text-[#A0AEC0]'}`}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((d, di) => {
            if (!d) return <div key={di} />
            const str = toStr(d)
            const isSel = str === selectedDate
            const hasEv = eventDates.includes(str)
            const isToday = str === new Date().toISOString().split('T')[0]
            return (
              <button key={di} onClick={() => { onChange(str); onClose() }}
                className={`relative h-7 w-full flex flex-col items-center justify-center rounded-full text-[11px] font-medium
                  ${isSel?'bg-[#185FA5] text-white':isToday?'border border-[#185FA5] text-[#185FA5]':di===0?'text-[#E24B4A]':di===6?'text-[#185FA5]':'text-[#1A1A2E] hover:bg-[#F4F6F9]'}`}>
                {d}
                {hasEv && !isSel && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#185FA5]" />}
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
  const [zoom, setZoom] = useState(1)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setShowCalendar(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), (s) => {
      if (s.exists()) { const p = s.val() as Project; setProject(p); setSelectedDate(p.date ?? new Date().toISOString().split('T')[0]) }
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
          if (cs.exists()) Object.values(cs.val() as CueItem[]).forEach((i: CueItem) => allMap.push({ ...i, partName: part.name, partColor: part.color, partId: part.id }))
          if (loaded === list.length) { allMap.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)); setAllCues([...allMap]) }
        })
      })
    })
  }, [projectId])

  // 핀치줌
  const lastPinchDist = useRef<number | null>(null)
  const lastZoom = useRef(1)
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastPinchDist.current = Math.hypot(dx, dy); lastZoom.current = zoom }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastPinchDist.current) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.hypot(dx, dy); setZoom(Math.min(2, Math.max(0.5, lastZoom.current * (dist / lastPinchDist.current)))) }
  }
  function handleTouchEnd() { lastPinchDist.current = null }

  const visibleParts = selectedPartId ? parts.filter(p => p.id === selectedPartId) : parts
  const filteredCues = allCues.filter(c => !selectedPartId || c.partId === selectedPartId)

  // 시간 슬롯 (30분 단위)
  const timeSlots: string[] = []
  if (filteredCues.length > 0) {
    const starts = filteredCues.map(c => timeToMinutes(c.startTime)).filter(m => !isNaN(m))
    const ends = filteredCues.map(c => timeToMinutes(c.startTime) + (c.durationMin || 30)).filter(m => !isNaN(m))
    const minT = Math.floor(Math.min(...starts) / 30) * 30
    const maxT = Math.ceil(Math.max(...ends) / 30) * 30
    for (let m = minT; m <= maxT; m += 30) timeSlots.push(minutesToTime(m))
  }

  // 파트 × 슬롯 별 큐 목록 (세로로 쌓기)
  // key: `${partId}__${slot}`
  const partSlotCues = new Map<string, CueWithPart[]>()
  for (const cue of filteredCues) {
    const slotMin = Math.floor(timeToMinutes(cue.startTime) / 30) * 30
    const key = `${cue.partId}__${minutesToTime(slotMin)}`
    if (!partSlotCues.has(key)) partSlotCues.set(key, [])
    partSlotCues.get(key)!.push(cue)
  }

  // 슬롯별 최대 큐 수 (어느 파트든) → 행 높이 결정
  const CUE_H = Math.round(80 * zoom)
  const PAD = Math.round(10 * zoom)
  const MIN_ROW_H = Math.round(50 * zoom)

  function getSlotMaxCount(slot: string): number {
    let max = 0
    for (const part of visibleParts) {
      const cues = partSlotCues.get(`${part.id}__${slot}`) ?? []
      max = Math.max(max, cues.length)
    }
    return max
  }

  function getSlotH(slot: string): number {
    const count = getSlotMaxCount(slot)
    return Math.max(MIN_ROW_H, count * CUE_H + PAD)
  }

  // 슬롯 누적 top
  const slotTops = new Map<string, number>()
  let accTop = 0
  for (const slot of timeSlots) { slotTops.set(slot, accTop); accTop += getSlotH(slot) }
  const totalH = accTop

  const COL_W = Math.round(160 * zoom)
  const TIME_W = 56
  const eventDates = project ? [project.date] : []

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      <Topbar projectName={project?.name} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 컨트롤 */}
        <div className="bg-white border-b border-[#E2E8F0] px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            {/* 날짜 드롭다운 */}
            <div className="relative" ref={calendarRef}>
              <button onClick={() => setShowCalendar(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F4F6F9]">
                <i className="ti ti-calendar text-[#185FA5] text-[14px]" />
                <span className="text-[13px] font-semibold text-[#1A1A2E]">{selectedDate}</span>
                <i className={`ti ti-chevron-${showCalendar ? 'up' : 'down'} text-[#A0AEC0] text-[11px]`} />
              </button>
              {showCalendar && <MiniCalendar selectedDate={selectedDate} onChange={setSelectedDate} eventDates={eventDates} onClose={() => setShowCalendar(false)} />}
            </div>
            {/* 줌 */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-minus text-[13px]" /></button>
              <span className="text-[11px] text-[#A0AEC0] w-9 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-plus text-[13px]" /></button>
              <button onClick={() => setZoom(1)} className="h-7 px-2 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#64748B] hover:bg-[#F4F6F9] ml-1">초기화</button>
            </div>
          </div>

          {/* 파트 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setSelectedPartId(null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold ${!selectedPartId ? 'bg-[#185FA5] text-white' : 'border border-[#E2E8F0] text-[#64748B] bg-white'}`}>전체</button>
            {parts.map(p => (
              <button key={p.id} onClick={() => setSelectedPartId(selectedPartId === p.id ? null : p.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border ${selectedPartId === p.id ? 'text-white' : 'border-[#E2E8F0] text-[#64748B] bg-white'}`}
                style={selectedPartId === p.id ? { background: p.color, borderColor: p.color } : {}}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />{p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 그리드 */}
        {filteredCues.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#A0AEC0]">
            <i className="ti ti-calendar-off text-[48px] opacity-30" /><p className="text-[13px]">큐시트 항목이 없어요</p>
          </div>
        ) : (
          <div className="flex-1" style={{ overflow: 'scroll' }}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div style={{ minWidth: TIME_W + COL_W * visibleParts.length }}>

              {/* 파트 헤더 sticky */}
              <div className="sticky top-0 z-20 flex bg-white border-b-2 border-[#E2E8F0] shadow-sm">
                <div style={{ width: TIME_W, minWidth: TIME_W }} className="flex-shrink-0" />
                {visibleParts.map(p => (
                  <div key={p.id} style={{ width: COL_W, minWidth: COL_W }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2 border-l border-[#E2E8F0]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-[11px] font-bold text-[#1A1A2E] truncate">{p.name}</span>
                  </div>
                ))}
              </div>

              {/* 슬롯 행들 */}
              <div className="flex">
                {/* 시간축 */}
                <div style={{ width: TIME_W, minWidth: TIME_W }} className="flex-shrink-0">
                  {timeSlots.map(slot => (
                    <div key={slot} style={{ height: getSlotH(slot) }}
                      className="flex items-start justify-end pr-2 pt-2 border-b border-[#F1F5F9]">
                      <span className="text-[11px] font-bold text-[#A0AEC0]">{slot}</span>
                    </div>
                  ))}
                </div>

                {/* 파트별 컬럼 */}
                {visibleParts.map(part => (
                  <div key={part.id} style={{ width: COL_W, minWidth: COL_W, height: totalH }}
                    className="flex-shrink-0 relative border-l border-[#E2E8F0]">

                    {/* 슬롯 구분선 */}
                    {timeSlots.map(slot => (
                      <div key={slot} style={{ top: slotTops.get(slot) ?? 0, height: getSlotH(slot) }}
                        className="absolute left-0 right-0 border-b border-[#F1F5F9]" />
                    ))}

                    {/* 큐 카드 - 세로로 쌓기 */}
                    {timeSlots.map(slot => {
                      const cues = (partSlotCues.get(`${part.id}__${slot}`) ?? [])
                        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                      const slotTop = slotTops.get(slot) ?? 0
                      return cues.map((cue, idx) => (
                        <div key={cue.id}
                          style={{
                            position: 'absolute',
                            top: slotTop + PAD / 2 + idx * CUE_H,
                            height: CUE_H - 4,
                            left: 3,
                            right: 3,
                          }}
                          className="rounded-[8px] border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-center px-2 py-1.5 overflow-hidden">
                          <div className="font-bold leading-tight text-[#1A1A2E] truncate"
                            style={{ fontSize: Math.max(9, Math.round(11 * zoom)) + 'px' }}>
                            {cue.title}
                          </div>
                          {cue.durationMin > 0 && (
                            <div className="text-[#A0AEC0] mt-0.5"
                              style={{ fontSize: Math.max(8, Math.round(9 * zoom)) + 'px' }}>
                              {cue.durationMin}분
                            </div>
                          )}
                          <div className="mt-1"><StatusBadge status={cue.status} /></div>
                        </div>
                      ))
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
