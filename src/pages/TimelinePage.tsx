import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes, minutesToTime } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Part, CueItem, CheckItem, Project } from '@/types'

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

// ── 큐 체크리스트 모달 ────────────────────────────────────
function CueCheckModal({ cue, projectId, onClose }: {
  cue: CueWithPart; projectId: string; onClose: () => void
}) {
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  // 실시간 구독
  useEffect(() => {
    const r = ref(db, `checkItems/${projectId}/${cue.partId}`)
    const unsub = onValue(r, (s) => {
      if (s.exists()) {
        const all: CheckItem[] = Object.values(s.val())
        // 이 큐에 연결된 것 + cueId 없는 것 중 파트 전체 항목 모두 표시
        // cueId가 이 큐인 것만 표시
        setChecks(all.filter(c => c.cueId === cue.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
      } else {
        setChecks([])
      }
    })
    return () => unsub()
  }, [projectId, cue.partId, cue.id])

  async function toggleCheck(item: CheckItem) {
    await update(ref(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), { isDone: !item.isDone })
  }

  async function addCheck() {
    if (!newTitle.trim()) return
    setAdding(true)
    const newRef = push(ref(db, `checkItems/${projectId}/${cue.partId}`))
    await set(newRef, {
      id: newRef.key,
      partId: cue.partId,
      projectId,
      cueId: cue.id,
      category: 'prep' as const,
      title: newTitle.trim(),
      isDone: false,
      createdAt: new Date().toISOString(),
    })
    setNewTitle('')
    setAdding(false)
  }

  async function deleteCheck(item: CheckItem) {
    await set(ref(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), null)
  }

  const doneCount = checks.filter(c => c.isDone).length
  const allDone = checks.length > 0 && doneCount === checks.length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cue.partColor }} />
              <span className="text-[11px] text-[#64748B]">{cue.partName}</span>
              <span className="text-[11px] text-[#A0AEC0]">{cue.startTime} · {cue.durationMin}분</span>
            </div>
            <div className="text-[16px] font-bold text-[#1A1A2E] truncate">{cue.title}</div>
          </div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>

        {/* 진행률 */}
        {checks.length > 0 && (
          <div className="mt-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#64748B]">체크리스트</span>
              <span className={`text-[11px] font-bold ${allDone ? 'text-[#3B6D11]' : 'text-[#185FA5]'}`}>
                {allDone ? '✓ 완료!' : `${doneCount}/${checks.length}`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${checks.length ? (doneCount / checks.length) * 100 : 0}%`,
                background: allDone ? '#3B6D11' : '#185FA5'
              }} />
            </div>
          </div>
        )}

        {/* 체크리스트 */}
        <div className="flex-1 overflow-y-auto">
          {checks.length === 0 ? (
            <div className="text-center py-6 text-[#A0AEC0]">
              <i className="ti ti-checklist text-[32px] block mb-2 opacity-30" />
              <p className="text-[12px]">이 큐에 연결된 체크리스트가 없어요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {checks.map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-[10px] border transition-colors ${item.isDone ? 'border-[#E2E8F0] bg-[#F8FBF8]' : 'border-[#E2E8F0] bg-white'}`}>
                  <button onClick={() => toggleCheck(item)}
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${item.isDone ? 'bg-[#3B6D11] border-[#3B6D11]' : 'border-[#E2E8F0] hover:border-[#185FA5]'}`}>
                    {item.isDone && <i className="ti ti-check text-white text-[11px]" />}
                  </button>
                  <span className={`text-[13px] flex-1 ${item.isDone ? 'line-through text-[#A0AEC0]' : 'text-[#1A1A2E]'}`}>{item.title}</span>
                  <button onClick={() => deleteCheck(item)} className="text-[#E2E8F0] hover:text-[#E24B4A] transition-colors">
                    <i className="ti ti-trash text-[14px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 추가 입력 */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-[#F1F5F9]">
          <input
            className="flex-1 h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]"
            placeholder="체크리스트 항목 추가..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCheck()}
          />
          <button onClick={addCheck} disabled={!newTitle.trim() || adding}
            className="h-[40px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-40 flex items-center gap-1">
            <i className="ti ti-plus text-[14px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function TimelinePage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [allChecks, setAllChecks] = useState<CheckItem[]>([])  // 전체 체크 (카드 배지용)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [activeCue, setActiveCue] = useState<CueWithPart | null>(null)
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
      const allCheckMap: CheckItem[] = []
      let loadedCue = 0
      let loadedCheck = 0
      list.forEach((part) => {
        onValue(ref(db, `cueItems/${projectId}/${part.id}`), (cs) => {
          loadedCue++
          if (cs.exists()) Object.values(cs.val() as CueItem[]).forEach((i: CueItem) => allMap.push({ ...i, partName: part.name, partColor: part.color, partId: part.id }))
          if (loadedCue === list.length) { allMap.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)); setAllCues([...allMap]) }
        })
        onValue(ref(db, `checkItems/${projectId}/${part.id}`), (cs) => {
          loadedCheck++
          if (cs.exists()) Object.values(cs.val() as CheckItem[]).forEach((i: CheckItem) => allCheckMap.push(i))
          if (loadedCheck === list.length) setAllChecks([...allCheckMap])
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
    if (e.touches.length === 2 && lastPinchDist.current) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; setZoom(Math.min(2, Math.max(0.5, lastZoom.current * (Math.hypot(dx, dy) / lastPinchDist.current)))) }
  }
  function handleTouchEnd() { lastPinchDist.current = null }

  const visibleParts = selectedPartId ? parts.filter(p => p.id === selectedPartId) : parts
  const filteredCues = allCues.filter(c => !selectedPartId || c.partId === selectedPartId)

  // 시간 슬롯
  const timeSlots: string[] = []
  if (filteredCues.length > 0) {
    const starts = filteredCues.map(c => timeToMinutes(c.startTime)).filter(m => !isNaN(m))
    const ends = filteredCues.map(c => timeToMinutes(c.startTime) + (c.durationMin || 30)).filter(m => !isNaN(m))
    const minT = Math.floor(Math.min(...starts) / 30) * 30
    const maxT = Math.ceil(Math.max(...ends) / 30) * 30
    for (let m = minT; m <= maxT; m += 30) timeSlots.push(minutesToTime(m))
  }

  // 파트 × 슬롯 큐 맵
  const partSlotCues = new Map<string, CueWithPart[]>()
  for (const cue of filteredCues) {
    const slotMin = Math.floor(timeToMinutes(cue.startTime) / 30) * 30
    const key = `${cue.partId}__${minutesToTime(slotMin)}`
    if (!partSlotCues.has(key)) partSlotCues.set(key, [])
    partSlotCues.get(key)!.push(cue)
  }

  // 큐별 체크 개수 (배지용)
  function getCueChecks(cueId: string) {
    const linked = allChecks.filter(c => c.cueId === cueId)
    return { total: linked.length, done: linked.filter(c => c.isDone).length }
  }

  const CUE_H = Math.round(90 * zoom)
  const PAD = Math.round(10 * zoom)
  const MIN_ROW_H = Math.round(50 * zoom)
  const COL_W = Math.round(160 * zoom)
  const TIME_W = 56

  function getSlotH(slot: string): number {
    let max = 0
    for (const part of visibleParts) {
      const cues = partSlotCues.get(`${part.id}__${slot}`) ?? []
      max = Math.max(max, cues.length)
    }
    return Math.max(MIN_ROW_H, max * CUE_H + PAD)
  }

  const slotTops = new Map<string, number>()
  let accTop = 0
  for (const slot of timeSlots) { slotTops.set(slot, accTop); accTop += getSlotH(slot) }
  const totalH = accTop
  const eventDates = project ? [project.date] : []

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      <Topbar projectName={project?.name} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 컨트롤 */}
        <div className="bg-white border-b border-[#E2E8F0] pt-3 pb-0">
          <div className="max-w-2xl mx-auto px-5">
            <div className="flex items-center justify-between mb-3">
              <div className="relative" ref={calendarRef}>
                <button onClick={() => setShowCalendar(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F4F6F9]">
                  <i className="ti ti-calendar text-[#185FA5] text-[14px]" />
                  <span className="text-[13px] font-semibold text-[#1A1A2E]">{selectedDate}</span>
                  <i className={`ti ti-chevron-${showCalendar ? 'up' : 'down'} text-[#A0AEC0] text-[11px]`} />
                </button>
                {showCalendar && <MiniCalendar selectedDate={selectedDate} onChange={setSelectedDate} eventDates={eventDates} onClose={() => setShowCalendar(false)} />}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-minus text-[13px]" /></button>
                <span className="text-[11px] text-[#A0AEC0] w-9 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-plus text-[13px]" /></button>
                <button onClick={() => setZoom(1)} className="h-7 px-2 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#64748B] hover:bg-[#F4F6F9] ml-1">초기화</button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
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

              {/* 파트 헤더 */}
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

              {/* 슬롯 */}
              <div className="flex">
                <div style={{ width: TIME_W, minWidth: TIME_W }} className="flex-shrink-0">
                  {timeSlots.map(slot => (
                    <div key={slot} style={{ height: getSlotH(slot) }}
                      className="flex items-start justify-end pr-2 pt-2 border-b border-[#F1F5F9]">
                      <span className="text-[11px] font-bold text-[#A0AEC0]">{slot}</span>
                    </div>
                  ))}
                </div>

                {visibleParts.map(part => (
                  <div key={part.id} style={{ width: COL_W, minWidth: COL_W, height: totalH }}
                    className="flex-shrink-0 relative border-l border-[#E2E8F0]">
                    {timeSlots.map(slot => (
                      <div key={slot} style={{ top: slotTops.get(slot) ?? 0, height: getSlotH(slot) }}
                        className="absolute left-0 right-0 border-b border-[#F1F5F9]" />
                    ))}

                    {timeSlots.map(slot => {
                      const cues = (partSlotCues.get(`${part.id}__${slot}`) ?? [])
                        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                      const slotTop = slotTops.get(slot) ?? 0
                      return cues.map((cue, idx) => {
                        const { total, done } = getCueChecks(cue.id)
                        const allDone = total > 0 && done === total
                        return (
                          <div key={cue.id}
                            onClick={() => setActiveCue(cue)}
                            style={{ position: 'absolute', top: slotTop + PAD / 2 + idx * CUE_H, height: CUE_H - 4, left: 3, right: 3 }}
                            className="rounded-[8px] border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between px-2 py-1.5 overflow-hidden cursor-pointer hover:border-[#185FA5] hover:shadow-md transition-all">
                            <div>
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
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <StatusBadge status={cue.status} />
                              {total > 0 && (
                                <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${allDone ? 'bg-[#E1F5EE] text-[#3B6D11]' : 'bg-[#E6F1FB] text-[#185FA5]'}`}>
                                  <i className={`ti ${allDone ? 'ti-check' : 'ti-checklist'} text-[10px]`} />
                                  {done}/{total}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomTabBar />

      {activeCue && projectId && (
        <CueCheckModal cue={activeCue} projectId={projectId} onClose={() => setActiveCue(null)} />
      )}
    </div>
  )
}
