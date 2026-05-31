import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import { CueModal, type CueWithPart } from '@/components/cue/CueModal'
import type { Part, CueItem, CheckItem } from '@/types'


// ─── 가로 드럼롤 날짜 피커 ────────────────────────────────
function DateRoller({ dates, selected, cues, onSelect }: {
  dates: string[]
  selected: string
  cues: CueItem[]
  onSelect: (date: string) => void
}) {
  const ITEM_W = 88
  const containerRef = useRef<HTMLDivElement>(null)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [centerIdx, setCenterIdx] = useState(() => dates.indexOf(selected))

  // 외부 selected 변경 시 스크롤
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const idx = dates.indexOf(selected)
    el.scrollTo({ left: idx * ITEM_W, behavior: 'smooth' })
    setCenterIdx(idx)
  }, [selected])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    // 실시간으로 가운데 인덱스 계산 → 즉시 opacity/scale 업데이트
    const rawIdx = el.scrollLeft / ITEM_W
    const cur = Math.round(rawIdx)
    setCenterIdx(Math.max(0, Math.min(dates.length - 1, cur)))

    // 스크롤 멈추면 스냅
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollLeft / ITEM_W)
      const clamped = Math.max(0, Math.min(dates.length - 1, idx))
      el.scrollTo({ left: clamped * ITEM_W, behavior: 'smooth' })
      setCenterIdx(clamped)
      onSelect(dates[clamped])
    }, 100)
  }

  return (
    <div className="relative flex-shrink-0" style={{ height: 76 }}>
      {/* 가운데 하이라이트 */}
      <div className="pointer-events-none absolute inset-y-0 z-10"
        style={{ left: `calc(50% - ${ITEM_W/2}px)`, width: ITEM_W }}>
        <div className="w-full h-full border-l-2 border-r-2 border-[#185FA5] bg-[#185FA5]/8 rounded-[12px]"></div>
      </div>
      {/* 좌우 페이드 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#F4F6F9] to-transparent"></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#F4F6F9] to-transparent"></div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 flex overflow-x-auto"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* 왼쪽 패딩 */}
        <div style={{ minWidth: `calc(50% - ${ITEM_W/2}px)`, flexShrink: 0 }}></div>
        {dates.map((date, i) => {
          const label = date === '__today__' ? '당일' : date.slice(5).replace('-', '.')
          const count = cues.filter((c: CueItem) => (c.date || '__today__') === date).length
          const dist = Math.abs(i - centerIdx)
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.4 : 0.15
          const scale = dist === 0 ? 1 : dist === 1 ? 0.82 : 0.65
          const isCenter = i === centerIdx
          return (
            <div key={date}
              onClick={() => { onSelect(date); setCenterIdx(i); containerRef.current?.scrollTo({ left: i * ITEM_W, behavior: 'smooth' }) }}
              style={{ minWidth: ITEM_W, flexShrink: 0, scrollSnapAlign: 'center', opacity, transform: `scale(${scale})`, transition: 'opacity 0.1s, transform 0.1s' }}
              className="flex flex-col items-center justify-center cursor-pointer select-none gap-0.5">
              <span className={`text-[16px] font-bold leading-tight ${isCenter ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{label}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isCenter ? 'bg-[#185FA5] text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>{count}개</span>
            </div>
          )
        })}
        {/* 오른쪽 패딩 */}
        <div style={{ minWidth: `calc(50% - ${ITEM_W/2}px)`, flexShrink: 0 }}></div>
      </div>
    </div>
  )
}

// ─── 큐시트 추가 모달 ──────────────────────────────────────
function AddCueModal({ onClose, onSave, partId, projectId, order }: {
  onClose: () => void
  onSave: (item: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  partId: string; projectId: string; order: number
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      partId, projectId, order,
      title: title.trim(),
      startTime: startTime || '--:--',
      durationMin: Number(durationMin) || 0,
      memo: memo.trim() || undefined,
      ...(date ? { date } : {}),
      status: 'pending',
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-t-[20px] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[16px] font-semibold">큐시트 항목 추가</div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className={lbl}>항목명 <span className="text-[#A32D2D]">*</span></label>
            <input className={inp} placeholder="예: 오프닝 영상 재생" value={title}
              onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={lbl}>날짜 <span className="text-[#A0AEC0] font-normal">(준비일 등, 비워두면 행사 당일)</span></label>
            <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>시작 시간</label>
              <input className={inp} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>소요 시간 (분)</label>
              <input className={inp} type="number" min="0" placeholder="0" value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>메모 (선택)</label>
            <input className={inp} placeholder="참고사항을 입력하세요" value={memo}
              onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-40">
            {saving ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────
export default function MyPartPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<{ownerId?: string} | null>(null)
  const [myMember, setMyMember] = useState<{role: string; partId?: string} | null>(null)
  const [allParts, setAllParts] = useState<Part[]>([])
  const [myPart, setMyPart] = useState<Part | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [cues, setCues] = useState<CueItem[]>([])
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCue, setShowAddCue] = useState(false)
  const [activeCue, setActiveCue] = useState<CueWithPart | null>(null)
  const [readOnlyToast, setReadOnlyToast] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const dateScrollRef = useRef<HTMLDivElement>(null)
  const dateButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const selectedPart = allParts.find(p => p.id === selectedPartId) ?? null

  // 날짜 목록 (cues에서 추출, 정렬)
  const dateList = Array.from(new Set(cues.map((c: CueItem) => c.date || '__today__'))).sort((a, b) => {
    if (a === '__today__') return 1
    if (b === '__today__') return -1
    return a.localeCompare(b)
  })

  // 선택된 날짜의 큐 필터
  const filteredCues = selectedDate
    ? cues.filter((c: CueItem) => (c.date || '__today__') === selectedDate)
    : cues

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date)
    setTimeout(() => {
      const btn = dateButtonRefs.current[date]
      if (btn && dateScrollRef.current) {
        const container = dateScrollRef.current
        container.scrollTo({ left: btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' })
      }
    }, 50)
  }, [])
  const myPartName = allParts.find(p => p.id === myMember?.partId)?.name ?? ''
  const isPlannerRole = myMember?.role === 'planner' || myMember?.role === 'owner' || project?.ownerId === user?.uid
  const isParticipant = myMember?.role === 'participant'
  const hasPartAssigned = !!(myMember?.partId)  // 특정 파트에 배정됐는지
  // 기획자이면서 파트 미배정 → 모든 팀 수정 가능
  // 기획자이면서 파트 배정됨 → 그 파트만 수정 (스태프처럼)
  // 스태프 → 내 파트만
  // 참가자 → 읽기만
  const isPlanner = isPlannerRole && !hasPartAssigned
  const isMyPart = isPlanner || (!isParticipant && selectedPart?.id === myPart?.id)

  useEffect(() => {
    if (!projectId || !user) return
    onValue(ref(db, `projects/${projectId}`), (s) => {
      if (s.exists()) setProject(s.val())
    }, { onlyOnce: true })
    onValue(ref(db, `projectMembers/${projectId}/${user.uid}`), (s) => {
      if (s.exists()) setMyMember(s.val())
    }, { onlyOnce: true })
    const u = onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) {
        const list: Part[] = Object.values(s.val())
        list.sort((a, b) => a.order - b.order)
        setAllParts(list)
        setLoading(false)
      } else setLoading(false)
    })
    return () => u()
  }, [projectId, user])

  // myMember 또는 allParts 바뀔 때마다 myPart 업데이트
  useEffect(() => {
    if (!allParts.length) return
    const mine = allParts.find(p => p.id === myMember?.partId) ?? null
    setMyPart(mine)
    if (!selectedPartId) setSelectedPartId(mine?.id ?? allParts[0]?.id ?? null)
  }, [myMember, allParts])

  useEffect(() => {
    if (!projectId || !selectedPartId) return
    const u1 = onValue(ref(db, `cueItems/${projectId}/${selectedPartId}`), (cs) => {
      if (cs.exists()) {
        const l: CueItem[] = Object.values(cs.val())
        l.sort((a, b) => {
          if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date)
          return a.startTime.localeCompare(b.startTime)
        })
        setCues(l)
        if (l.length > 0) {
          const firstDate = [...new Set(l.map((c: CueItem) => c.date || '__today__'))].sort((a: string, b: string) => {
            if (a==='__today__') return 1; if (b==='__today__') return -1; return a.localeCompare(b)
          })[0]
          setSelectedDate((prev: string) => prev || firstDate)
        }
      } else setCues([])
    })
    const u2 = onValue(ref(db, `checkItems/${projectId}/${selectedPartId}`), (ck) => {
      if (ck.exists()) setChecks(Object.values(ck.val()))
      else setChecks([])
    })
    return () => { u1(); u2() }
  }, [projectId, selectedPartId])

  function showReadOnly() {
    setReadOnlyToast(true)
    setTimeout(() => setReadOnlyToast(false), 2500)
  }

  async function setCueStatus(item: CueItem, status: CueItem['status']) {
    if (!projectId || !selectedPartId || !isMyPart) { showReadOnly(); return }
    await update(ref(db, `cueItems/${projectId}/${selectedPartId}/${item.id}`), {
      status, updatedAt: new Date().toISOString(),
    })
  }

  async function addCue(data: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!projectId || !selectedPartId || !isMyPart) return
    const newRef = push(ref(db, `cueItems/${projectId}/${selectedPartId}`))
    const now = new Date().toISOString()
    await set(newRef, { ...data, id: newRef.key!, createdAt: now, updatedAt: now })
    setShowAddCue(false)
  }

  function openCueModal(cue: CueItem) {
    if (!selectedPart) return
    setActiveCue({
      ...cue,
      partName: selectedPart.name,
      partColor: selectedPart.color,
      partId: selectedPart.id,
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>
  )

                  return (
    <div className="h-screen flex flex-col bg-[#F4F6F9] overflow-hidden">
      <Topbar />

      {/* 파트 탭 */}
      {allParts.length > 1 && (
        <div className="bg-white border-b border-[#E2E8F0] flex-shrink-0">
          <div className="max-w-2xl mx-auto px-5 overflow-x-auto">
            <div className="flex gap-1 py-2 min-w-max">
              {allParts.map(part => (
                <button key={part.id} onClick={() => setSelectedPartId(part.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${selectedPartId === part.id ? 'text-white' : 'bg-[#F4F6F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                  style={selectedPartId === part.id ? { background: part.color } : {}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedPartId === part.id ? 'rgba(255,255,255,0.6)' : part.color }} />
                  {part.name}
                  {part.id === myPart?.id && <span className="text-[9px] opacity-70">내팀</span>}
                  {isPlanner && part.id !== myPart?.id && <span className="text-[9px] opacity-50">기획자</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedPart ? (
        <div className="flex-1 flex items-center justify-center text-[#64748B] text-[13px]">배정된 파트가 없어요</div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto">

          {/* 파트 헤더 고정 */}
          <div className="flex-shrink-0 px-5 pt-4 pb-2">
            <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: selectedPart.color }} />
                  <span className="text-[18px] font-semibold text-[#1A1A2E]">{selectedPart.name}</span>
                  {!isMyPart && <span className="text-[10px] bg-[#F4F6F9] text-[#A0AEC0] px-2 py-0.5 rounded-full">열람 전용</span>}
                </div>
                <div className="text-[12px] text-[#64748B] mt-0.5">
                  {isPlanner ? '기획자 · 전체 수정 가능' : isMyPart ? '내 파트' : isParticipant ? '참가자 · 열람만 가능' : isPlannerRole ? '다른 팀 현황 (열람)' : '다른 팀 현황'}
                </div>
              </div>
              {isMyPart && (
                <div className="flex gap-2">
                  <button className="h-8 px-3 border border-[#F09595] bg-[#FCEBEB] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1.5">
                    <i className="ti ti-alert-triangle text-[14px]" /> 긴급 연락
                  </button>
                  <button className="h-8 px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center gap-1.5">
                    <i className="ti ti-message-circle text-[14px]" /> 본부 메시지
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] text-[#64748B]">진행률</span>
              <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden">
                <div className="h-1.5 bg-[#185FA5] rounded-full" style={{ width: `${selectedPart.progress}%` }}></div>
              </div>
              <span className="text-[12px] text-[#64748B]">{selectedPart.progress}%</span>
            </div>
          </div>

          {/* 날짜 롤러 + 헤더 고정 */}
          <div className="flex-shrink-0 px-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-bold text-[#1A1A2E]">큐시트 ({cues.length})</span>
              {isMyPart && (
                <button onClick={() => setShowAddCue(true)}
                  className="h-8 px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5">
                  <i className="ti ti-plus text-[13px]" /> 추가
                </button>
              )}
            </div>
          </div>
          {dateList.length > 1 && (
            <DateRoller dates={dateList} selected={selectedDate} cues={cues} onSelect={selectDate} />
          )}

          {/* 큐시트 세로 스크롤 */}
          <div className="flex-1 overflow-y-auto px-5 pb-24">
            {cues.length === 0 ? (
              <div className="text-center py-12 text-[#A0AEC0]">
                <i className="ti ti-list text-[36px] block mb-2 opacity-30" />
                <p className="text-[13px] mb-4">큐시트 항목이 없어요</p>
                {isMyPart && (
                  <button onClick={() => setShowAddCue(true)}
                    className="h-[34px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 mx-auto">
                    <i className="ti ti-plus text-[13px]" /> 큐시트 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-2">
                {filteredCues.map((cue) => {
                  const cueChecks = checks.filter((c: CheckItem) => c.cueId === cue.id)
                  const doneChecks = cueChecks.filter((c: CheckItem) => c.isDone).length
                  return (
    <div className="h-screen flex flex-col bg-[#F4F6F9] overflow-hidden">
      <Topbar />

      {/* 파트 탭 */}
      {allParts.length > 1 && (
        <div className="bg-white border-b border-[#E2E8F0] flex-shrink-0">
          <div className="max-w-2xl mx-auto px-5 overflow-x-auto">
            <div className="flex gap-1 py-2 min-w-max">
              {allParts.map(part => (
                <button key={part.id} onClick={() => setSelectedPartId(part.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${selectedPartId === part.id ? 'text-white' : 'bg-[#F4F6F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                  style={selectedPartId === part.id ? { background: part.color } : {}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedPartId === part.id ? 'rgba(255,255,255,0.6)' : part.color }} />
                  {part.name}
                  {part.id === myPart?.id && <span className="text-[9px] opacity-70">내팀</span>}
                  {isPlanner && part.id !== myPart?.id && <span className="text-[9px] opacity-50">기획자</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto">
        {!selectedPart ? (
          <div className="flex-1 flex items-center justify-center text-[#64748B] text-[13px]">배정된 파트가 없어요</div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* 파트 헤더 */}
            <div className="flex-shrink-0 px-5 pt-4 pb-2">
              <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: selectedPart.color }} />
                    <span className="text-[18px] font-semibold text-[#1A1A2E]">{selectedPart.name}</span>
                    {!isMyPart && <span className="text-[10px] bg-[#F4F6F9] text-[#A0AEC0] px-2 py-0.5 rounded-full">열람 전용</span>}
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-0.5">
                    {isPlanner ? '기획자 · 전체 수정 가능' : isMyPart ? '내 파트' : isParticipant ? '참가자 · 열람만 가능' : '다른 팀 현황'}
                  </div>
                </div>
                {isMyPart && (
                  <div className="flex gap-2">
                    <button className="h-8 px-3 border border-[#F09595] bg-[#FCEBEB] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1.5">
                      <i className="ti ti-alert-triangle text-[14px]" /> 긴급 연락
                    </button>
                    <button className="h-8 px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center gap-1.5">
                      <i className="ti ti-message-circle text-[14px]" /> 본부 메시지
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] text-[#64748B]">진행률</span>
                <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden">
                  <div className="h-1.5 bg-[#185FA5] rounded-full" style={{ width: `${selectedPart.progress}%` }}></div>
                </div>
                <span className="text-[12px] text-[#64748B]">{selectedPart.progress}%</span>
              </div>
            </div>

            {/* 큐시트 헤더 */}
            <div className="flex-shrink-0 px-5 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#1A1A2E]">큐시트 ({cues.length})</span>
                {isMyPart && (
                  <button onClick={() => setShowAddCue(true)}
                    className="h-8 px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5">
                    <i className="ti ti-plus text-[13px]" /> 추가
                  </button>
                )}
              </div>
            </div>

            {/* 날짜 롤러 */}
            {dateList.length > 1 && (
              <DateRoller dates={dateList} selected={selectedDate} cues={cues} onSelect={selectDate} />
            )}

            {/* 큐시트 목록 - 세로 스크롤 */}
            <div className="flex-1 overflow-y-auto px-5 pb-24">
              {cues.length === 0 ? (
                <div className="text-center py-12 text-[#A0AEC0]">
                  <i className="ti ti-list text-[36px] block mb-2 opacity-30" />
                  <p className="text-[13px] mb-4">큐시트 항목이 없어요</p>
                  {isMyPart && (
                    <button onClick={() => setShowAddCue(true)}
                      className="h-[34px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 mx-auto">
                      <i className="ti ti-plus text-[13px]" /> 큐시트 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 pt-2">
                  {filteredCues.map((cue) => {
                    const cueChecks = checks.filter((c: CheckItem) => c.cueId === cue.id)
                    const doneChecks = cueChecks.filter((c: CheckItem) => c.isDone).length
                    return (
                      <div key={cue.id}
                        className={`rounded-[12px] border bg-white overflow-hidden ${cue.status === 'ongoing' ? 'border-[#185FA5]' : 'border-[#E2E8F0]'}`}>
                        <button className="w-full text-left p-4" onClick={() => openCueModal(cue)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {cue.date && (
                                  <span className="text-[10px] bg-[#FFF8F0] text-[#E8820C] border border-[#F4D7A8] px-2 py-0.5 rounded-full font-semibold">
                                    {cue.date.replace(/-/g, '.')}
                                  </span>
                                )}
                                <span className="text-[12px] font-bold text-[#185FA5]">{cue.startTime}</span>
                                {cue.durationMin > 0 && <span className="text-[11px] text-[#A0AEC0]">{cue.durationMin}분</span>}
                              </div>
                              <div className="text-[14px] font-semibold text-[#1A1A2E]">{cue.title}</div>
                              {cue.memo && <div className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{cue.memo}</div>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <StatusBadge status={cue.status} />
                              <i className="ti ti-chevron-right text-[#A0AEC0] text-[13px]" />
                            </div>
                          </div>
                          {cueChecks.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#F4F6F9]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-[#64748B]">체크리스트</span>
                                <span className="text-[11px] font-semibold text-[#185FA5]">{doneChecks}/{cueChecks.length}</span>
                              </div>
                              <div className="w-full h-1 bg-[#F4F6F9] rounded-full overflow-hidden mb-2">
                                <div className="h-1 rounded-full transition-all"
                                  style={{ width: `${(doneChecks/cueChecks.length)*100}%`, background: doneChecks===cueChecks.length?'#3B6D11':'#185FA5' }} />
                              </div>
                              <div className="flex flex-col gap-1">
                                {cueChecks.slice(0,3).map((c: CheckItem) => (
                                  <div key={c.id} className="flex items-center gap-2">
                                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 ${c.isDone?'bg-[#3B6D11] border-[#3B6D11]':'border-[#E2E8F0]'}`}>
                                      {c.isDone && <i className="ti ti-check text-white text-[8px]" />}
                                    </div>
                                    <span className={`text-[11px] truncate ${c.isDone?'line-through text-[#A0AEC0]':'text-[#64748B]'}`}>{c.title}</span>
                                  </div>
                                ))}
                                {cueChecks.length > 3 && <span className="text-[10px] text-[#A0AEC0] ml-5">+{cueChecks.length-3}개 더보기</span>}
                              </div>
                            </div>
                          )}
                        </button>
                        <div className="flex border-t border-[#F4F6F9]">
                          {cue.status==='pending' && (
                            <button onClick={()=>setCueStatus(cue,'ongoing')}
                              className="flex-1 py-2 text-[12px] font-semibold text-[#185FA5] hover:bg-[#E6F1FB]">
                              {isMyPart?'시작':'👀 보기'}
                            </button>
                          )}
                          {cue.status==='ongoing' && (
                            <button onClick={()=>setCueStatus(cue,'done')}
                              className="flex-1 py-2 text-[12px] font-semibold text-[#3B6D11] hover:bg-[#EAF3DE]">
                              {isMyPart?'완료':'진행 중'}
                            </button>
                          )}
                          {cue.status==='done' && (
                            <button onClick={()=>isMyPart?setCueStatus(cue,'pending'):showReadOnly()}
                              className="flex-1 py-2 text-[12px] text-[#A0AEC0] hover:bg-[#F4F6F9]">
                              {isMyPart?'되돌리기':'완료됨'}
                            </button>
                          )}
                          <div className="w-px bg-[#F4F6F9]"></div>
                          <button onClick={()=>openCueModal(cue)}
                            className="flex items-center gap-1 px-4 py-2 text-[12px] text-[#185FA5] font-semibold hover:bg-[#E6F1FB]">
                            <i className="ti ti-antenna text-[13px]" /> 무전
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {checks.filter((c:CheckItem)=>!c.cueId).length > 0 && (
                    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 mt-2 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] font-bold text-[#1A1A2E]">파트 체크리스트</span>
                        <span className="text-[12px] text-[#185FA5] font-semibold">
                          {checks.filter((c:CheckItem)=>!c.cueId&&c.isDone).length}/{checks.filter((c:CheckItem)=>!c.cueId).length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {checks.filter((c:CheckItem)=>!c.cueId).map((item:CheckItem)=>(
                          <div key={item.id} className="flex items-center gap-3">
                            <button
                              onClick={()=>{if(!isMyPart){showReadOnly();return}update(ref(db,`checkItems/${projectId}/${selectedPart!.id}/${item.id}`),{isDone:!item.isDone})}}
                              className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${item.isDone?'bg-[#3B6D11] border-[#3B6D11]':'border-[#E2E8F0]'}`}>
                              {item.isDone && <i className="ti ti-check text-white text-[11px]" />}
                            </button>
                            <span className={`text-[13px] flex-1 ${item.isDone?'line-through text-[#A0AEC0]':'text-[#1A1A2E]'}`}>{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {readOnlyToast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6" onClick={()=>setReadOnlyToast(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm flex flex-col items-center text-center gap-4" onClick={e=>e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <i className="ti ti-lock text-[#DC2626] text-[32px]"/>
            </div>
            <div>
              <div className="text-[17px] font-bold text-[#1A1A2E] mb-1">수정 권한이 없어요</div>
              <div className="text-[13px] text-[#64748B]">해당 팀에 요청해주세요!</div>
            </div>
            <button onClick={()=>setReadOnlyToast(false)}
              className="w-full h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-semibold">확인</button>
          </div>
        </div>
      )}
      <BottomTabBar />

      {showAddCue && selectedPartId && isMyPart && (
        <AddCueModal
          onClose={()=>setShowAddCue(false)}
          onSave={addCue}
          partId={selectedPartId}
          projectId={projectId!}
          order={cues.length}
        />
      )}

      {activeCue && (
        <CueModal
          cue={activeCue}
          projectId={projectId!}
          onClose={()=>setActiveCue(null)}
          isReadOnly={(() => {
            if (isParticipant) return true
            if (isPlanner) return false
            return activeCue.partId !== myMember?.partId
          })()}
          myPartName={myPartName}
        />
      )}
      </div>{/* flex-1 overflow-y-auto */}
      </div>{/* flex-1 flex-col */}
      </div>{/* max-w-2xl */}
      )}
      </div>{/* flex-1 content */}
      </div>{/* max-w-2xl outer */}
    </div>{/* h-screen */}
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
