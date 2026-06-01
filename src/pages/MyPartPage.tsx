import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import { CueModal, type CueWithPart } from '@/components/cue/CueModal'
import type { Part, CueItem, CheckItem } from '@/types'

// ─── 가로 드래그+클릭 롤링 날짜 피커 ──────────────────────
function DateRoller({ dates, selected, cues, onSelect }: {
  dates: string[]
  selected: string
  cues: CueItem[]
  onSelect: (date: string) => void
}) {
  const ITEM_W = 88
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startOffset = useRef(0)
  const animRef = useRef<number | null>(null)
  const currentOffset = useRef(0)
  const hasMoved = useRef(false)  // 실제 드래그 이동 여부

  const selIdx = dates.indexOf(selected)
  const baseOffset = -selIdx * ITEM_W
  const displayOffset = isDragging ? offsetX : baseOffset
  const centerIdx = Math.max(0, Math.min(dates.length - 1, Math.round(-displayOffset / ITEM_W)))

  // selected 외부 변경 시 애니메이션으로 이동
  useEffect(() => {
    if (isDragging) return
    const idx = dates.indexOf(selected)
    if (idx < 0) return
    const target = -idx * ITEM_W
    if (Math.abs(currentOffset.current - target) < 1) return
    snapTo(idx)
  }, [selected])

  function snapTo(idx: number) {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const target = -idx * ITEM_W
    const start = currentOffset.current
    const duration = 220
    const startTime = performance.now()
    function animate(now: number) {
      const t = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const cur = start + (target - start) * ease
      currentOffset.current = cur
      setOffsetX(cur)
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setIsDragging(false)
        onSelect(dates[idx])
      }
    }
    animRef.current = requestAnimationFrame(animate)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setIsDragging(true)
    hasMoved.current = false
    startX.current = e.clientX
    startOffset.current = isDragging ? offsetX : baseOffset
    currentOffset.current = startOffset.current
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging) return
    const delta = e.clientX - startX.current
    if (Math.abs(delta) > 4) hasMoved.current = true
    const newOffset = startOffset.current + delta
    const clamped = Math.max(-(dates.length - 1) * ITEM_W, Math.min(0, newOffset))
    currentOffset.current = clamped
    setOffsetX(clamped)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!isDragging) return
    if (!hasMoved.current) {
      // 클릭 - 눌린 아이템 인덱스 계산
      const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const clickX = e.clientX - containerRect.left
      const centerX = containerRect.width / 2
      const relativeX = clickX - centerX
      const clickedIdx = Math.max(0, Math.min(dates.length - 1,
        selIdx + Math.round(relativeX / ITEM_W)
      ))
      snapTo(clickedIdx)
    } else {
      // 드래그 종료 - 가장 가까운 항목으로 스냅
      const idx = Math.max(0, Math.min(dates.length - 1, Math.round(-currentOffset.current / ITEM_W)))
      snapTo(idx)
    }
  }

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ height: 76 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 가운데 하이라이트 */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10"
        style={{ left: `calc(50% - ${ITEM_W / 2}px)`, width: ITEM_W }}
      >
        <div
          className="w-full h-[56px] my-auto border-l-2 border-r-2 border-[#185FA5] rounded-[12px]"
          style={{ marginTop: 10, background: 'rgba(24,95,165,0.08)' }}
        ></div>
      </div>
      {/* 좌 페이드 */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
        style={{ background: 'linear-gradient(to right, #F4F6F9 60%, transparent)' }}
      ></div>
      {/* 우 페이드 */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
        style={{ background: 'linear-gradient(to left, #F4F6F9 60%, transparent)' }}
      ></div>

      {/* 아이템들 */}
      <div
        className="absolute inset-y-0 flex items-center"
        style={{
          left: `calc(50% - ${ITEM_W / 2}px)`,
          transform: `translateX(${displayOffset}px)`,
          transition: isDragging ? 'none' : undefined,
        }}
      >
        {dates.map((date, i) => {
          const label = date === '__today__' ? '당일' : date.slice(5).replace('-', '.')
          const count = cues.filter((c: CueItem) => (c.date || '__today__') === date).length
          const dist = Math.abs(i - centerIdx)
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.18
          const scale = dist === 0 ? 1 : dist === 1 ? 0.82 : 0.64
          const isCenter = i === centerIdx
          return (
            <div
              key={date}
              style={{
                width: ITEM_W,
                flexShrink: 0,
                opacity,
                transform: `scale(${scale})`,
                transition: 'opacity 0.08s, transform 0.08s',
              }}
              className="flex flex-col items-center justify-center gap-0.5"
            >
              <span className={`text-[16px] font-bold leading-tight ${isCenter ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>
                {label}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isCenter ? 'bg-[#185FA5] text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                {count}개
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 큐시트 추가 모달 ──────────────────────────────────────
function AddCueModal({ onClose, onSave, partId, projectId, order, allParts, isPlanner, currentPart }: {
  onClose: () => void
  onSave: (item: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>, checks: {title: string; category: string}[]) => Promise<void>
  partId: string; projectId: string; order: number
  allParts: Part[]; isPlanner: boolean; currentPart: Part | null
}) {
  const [tab, setTab] = useState<'info' | 'check' | 'memo'>('info')
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState('')
  const [cardColor, setCardColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [checks, setChecks] = useState<{title: string; category: string}[]>([])
  const [newCheck, setNewCheck] = useState('')
  const [targetPartId, setTargetPartId] = useState(partId)

  function addCheck() {
    if (!newCheck.trim()) return
    setChecks(prev => [...prev, { title: newCheck.trim(), category: 'prep' }])
    setNewCheck('')
  }

  function removeCheck(i: number) {
    setChecks(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!title.trim()) { setTab('info'); return }
    setSaving(true)
    await onSave({
      partId: targetPartId, projectId, order,
      title: title.trim(),
      startTime: startTime || '--:--',
      durationMin: Number(durationMin) || 0,
      memo: memo.trim() || undefined,
      ...(date ? { date } : {}),
      ...(cardColor ? { cardColor } : {}),
      status: 'pending',
    }, checks)
    setSaving(false)
  }

  const tabs = [
    { id: 'info', label: '기본정보' },
    { id: 'check', label: `체크리스트${checks.length > 0 ? ` (${checks.length})` : ''}` },
    { id: 'memo', label: '메모' },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-t-[20px] pb-8" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
          <div className="text-[16px] font-semibold">큐시트 항목 추가</div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]"></i></button>
        </div>
        {/* 파트 표시 */}
        <div className="px-5 pb-3 flex-shrink-0">
          {isPlanner ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#64748B]">추가할 파트:</span>
              <select
                value={targetPartId}
                onChange={e => setTargetPartId(e.target.value)}
                className="flex-1 h-[32px] border border-[#E2E8F0] rounded-[8px] px-2 text-[12px] font-semibold text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
              >
                {allParts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: currentPart?.color ?? '#185FA5' }}></span>
              <span className="text-[12px] font-semibold text-[#1A1A2E]">{currentPart?.name ?? ''}</span>
              <span className="text-[11px] text-[#A0AEC0]">에 추가</span>
            </div>
          )}
        </div>
        {/* 탭 */}
        <div className="flex border-b border-[#E2E8F0] px-5 flex-shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`mr-4 pb-2 text-[13px] font-semibold border-b-2 transition-colors ${tab === t.id ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-[#A0AEC0]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'info' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={lbl}>항목명 <span className="text-[#A32D2D]">*</span></label>
                <input className={inp} placeholder="예: 오프닝 영상 재생" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
              </div>
              <div>
                <label className={lbl}>날짜 <span className="text-[#A0AEC0] font-normal">(비워두면 행사 당일)</span></label>
                <input className={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              {/* 큐카드 색상 */}
              <div>
                <label className={lbl}>큐카드 색상 <span className="text-[#A0AEC0] font-normal">(선택 안 하면 파트 색상)</span></label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[
                    { color: '', label: '기본' },
                    { color: '#E24B4A', label: '빨강' },
                    { color: '#E8820C', label: '주황' },
                    { color: '#F5C518', label: '노랑' },
                    { color: '#3B6D11', label: '초록' },
                    { color: '#185FA5', label: '파랑' },
                    { color: '#534AB7', label: '보라' },
                    { color: '#C2185B', label: '분홍' },
                    { color: '#0F6E56', label: '청록' },
                    { color: '#64748B', label: '회색' },
                    { color: '#1A1A2E', label: '검정' },
                  ].map(({color, label}) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setCardColor(cardColor === color ? '' : color)}
                      title={label}
                      className={`relative flex items-center justify-center transition-all ${
                        color === ''
                          ? `w-auto px-3 h-8 rounded-full border-2 text-[11px] font-semibold ${cardColor === '' ? 'border-[#185FA5] bg-[#E6F1FB] text-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#185FA5]'}`
                          : `w-8 h-8 rounded-full border-2 ${cardColor === color ? 'border-[#1A1A2E] scale-110 shadow-md' : 'border-transparent hover:scale-105'}`
                      }`}
                      style={color ? { background: color } : {}}
                    >
                      {color === '' && '기본'}
                      {cardColor === color && color !== '' && (
                        <i className="ti ti-check text-white text-[12px]" />
                      )}
                    </button>
                  ))}
                </div>
                {cardColor && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-white/20 shadow-sm flex-shrink-0" style={{background: cardColor}}/>
                    <span className="text-[11px] text-[#64748B]">이 색상으로 큐카드가 표시돼요</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>시작 시간</label>
                  <input className={inp} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>소요 시간 (분)</label>
                  <input className={inp} type="number" min="0" placeholder="0" value={durationMin} onChange={e => setDurationMin(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {tab === 'check' && (
            <div className="flex flex-col gap-2">
              {checks.length === 0 && (
                <p className="text-[13px] text-[#A0AEC0] text-center py-4">체크리스트 항목을 추가해보세요</p>
              )}
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-[10px] border border-[#E2E8F0] bg-white">
                  <div className="w-4 h-4 rounded border-2 border-[#E2E8F0] flex-shrink-0"></div>
                  <span className="text-[13px] flex-1">{c.title}</span>
                  <button onClick={() => removeCheck(i)} className="text-[#E2E8F0] hover:text-[#E24B4A]">
                    <i className="ti ti-trash text-[14px]"></i>
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  className={inp + ' flex-1'}
                  placeholder="체크리스트 항목 추가..."
                  value={newCheck}
                  onChange={e => setNewCheck(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCheck() }}
                />
                <button onClick={addCheck}
                  className="w-10 h-10 bg-[#185FA5] text-white rounded-[10px] flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-plus text-[16px]"></i>
                </button>
              </div>
            </div>
          )}
          {tab === 'memo' && (
            <div>
              <label className={lbl}>메모</label>
              <textarea
                className="w-full border border-[#E2E8F0] rounded-[10px] p-3 text-[13px] text-[#1A1A2E] resize-none focus:outline-none focus:border-[#185FA5]"
                style={{ height: 160 }}
                placeholder="참고사항을 입력하세요..."
                value={memo}
                onChange={e => setMemo(e.target.value)}
              />
            </div>
          )}
        </div>
        {/* 하단 버튼 */}
        <div className="flex gap-2 px-5 flex-shrink-0">
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
  const [project, setProject] = useState<{ ownerId?: string } | null>(null)
  const [myMember, setMyMember] = useState<{ role: string; partId?: string; partName?: string } | null>(null)
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
  const [showMyRoleModal, setShowMyRoleModal] = useState(false)
  const [myNewPartId, setMyNewPartId] = useState('')

  const selectedPart = allParts.find(p => p.id === selectedPartId) ?? null
  const myPartName = allParts.find(p => p.id === myMember?.partId)?.name ?? myMember?.partName ?? ''
  const isPlannerRole = myMember?.role === 'planner' || myMember?.role === 'owner' || project?.ownerId === user?.uid
  const isParticipant = myMember?.role === 'participant'
  const hasPartAssigned = !!(myMember?.partId)
  const isPlanner = isPlannerRole && !hasPartAssigned
  const isMyPart = isPlanner || (!isParticipant && selectedPart?.id === myPart?.id)

  const dateList = Array.from(new Set(cues.map((c: CueItem) => c.date || '__today__'))).sort((a, b) => {
    if (a === '__today__') return 1
    if (b === '__today__') return -1
    return a.localeCompare(b)
  })

  const filteredCues = selectedDate
    ? cues.filter((c: CueItem) => (c.date || '__today__') === selectedDate)
    : cues

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  // 프로젝트 & 멤버 로딩
  useEffect(() => {
    if (!projectId || !user) return
    onValue(ref(db, `projects/${projectId}`), s => { if (s.exists()) setProject(s.val()) }, { onlyOnce: true })
    onValue(ref(db, `projectMembers/${projectId}/${user.uid}`), s => { if (s.exists()) setMyMember(s.val()) }, { onlyOnce: true })
    const u = onValue(ref(db, `parts/${projectId}`), s => {
      if (s.exists()) {
        const list: Part[] = Object.values(s.val())
        list.sort((a, b) => a.order - b.order)
        setAllParts(list)
        setLoading(false)
      } else setLoading(false)
    })
    return () => u()
  }, [projectId, user])

  // myMember 또는 allParts 바뀌면 myPart 업데이트
  useEffect(() => {
    if (!allParts.length) return
    const mine = allParts.find(p => p.id === myMember?.partId)
      ?? allParts.find(p => p.name === myMember?.partName)
      ?? null
    setMyPart(mine)
    if (!selectedPartId) setSelectedPartId(mine?.id ?? allParts[0]?.id ?? null)
  }, [myMember, allParts])

  // 선택된 파트의 큐/체크 로딩
  useEffect(() => {
    if (!projectId || !selectedPartId) return
    // 파트 변경 시 날짜 초기화
    setSelectedDate('')
    const u1 = onValue(ref(db, `cueItems/${projectId}/${selectedPartId}`), cs => {
      if (cs.exists()) {
        const l: CueItem[] = Object.values(cs.val())
        l.sort((a, b) => {
          if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date)
          return a.startTime.localeCompare(b.startTime)
        })
        setCues(l)
      } else {
        setCues([])
      }
    })
    const u2 = onValue(ref(db, `checkItems/${projectId}/${selectedPartId}`), ck => {
      if (ck.exists()) setChecks(Object.values(ck.val()))
      else setChecks([])
    })
    return () => { u1(); u2() }
  }, [projectId, selectedPartId])

  // cues 로드 후 첫 날짜 자동 선택
  useEffect(() => {
    if (cues.length === 0 || selectedDate) return
    const firstDate = Array.from(new Set(cues.map(c => c.date || '__today__'))).sort((a, b) => {
      if (a === '__today__') return 1
      if (b === '__today__') return -1
      return a.localeCompare(b)
    })[0]
    setSelectedDate(firstDate)
  }, [cues])

  function showReadOnly() {
    setReadOnlyToast(true)
  }

  async function setCueStatus(item: CueItem, status: CueItem['status']) {
    if (!projectId || !selectedPartId || !isMyPart) { showReadOnly(); return }
    await update(ref(db, `cueItems/${projectId}/${selectedPartId}/${item.id}`), { status, updatedAt: new Date().toISOString() })
  }

  async function saveMyRole(partId: string) {
    if (!projectId || !user) return
    const isReturningToPlanner = partId === '__planner__'
    const selectedPart2 = allParts.find(p => p.id === partId)
    await update(ref(db, `projectMembers/${projectId}/${user.uid}`), {
      partId: isReturningToPlanner ? '' : partId,
      partName: isReturningToPlanner ? '기획자' : (selectedPart2?.name ?? ''),
      role: isReturningToPlanner ? 'planner' : ((myMember?.role==='owner'||project?.ownerId===user.uid) ? 'planner' : 'staff'),
    })
    setMyMember(prev => prev ? {
      ...prev,
      partId: isReturningToPlanner ? '' : partId,
      partName: isReturningToPlanner ? '' : (selectedPart2?.name ?? ''),
      role: isReturningToPlanner ? 'planner' : ((prev.role==='owner'||project?.ownerId===user?.uid) ? 'planner' : 'staff'),
    } : prev)
    setMyNewPartId('')
    setShowMyRoleModal(false)
  }

  async function addCue(data: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>, checks: {title: string; category: string}[] = []) {
    if (!projectId || !isMyPart) return
    const savePartId = data.partId || selectedPartId!
    const newRef = push(ref(db, `cueItems/${projectId}/${savePartId}`))
    const cueId = newRef.key!
    const now = new Date().toISOString()
    await set(newRef, { ...data, id: cueId, partId: savePartId, createdAt: now, updatedAt: now })
    // 체크리스트 저장
    for (const check of checks) {
      const checkRef = push(ref(db, `checkItems/${projectId}/${savePartId}`))
      await set(checkRef, {
        id: checkRef.key, partId: savePartId, projectId,
        cueId, category: check.category, title: check.title,
        isDone: false, createdAt: now,
      })
    }
    const part = allParts.find(p => p.id === savePartId)
    const ar = push(ref(db, `cueAlerts/${projectId}`))
    await set(ar, {
      id: ar.key, projectId, partId: savePartId, partName: part?.name ?? '', partColor: part?.color ?? '#185FA5',
      cueId, cueTitle: data.title, changeType: 'new',
      detail: `큐 추가: "${data.title}" (${data.startTime})`,
      isChecked: false, createdAt: now
    })
    setShowAddCue(false)
  }

  function openCueModal(cue: CueItem) {
    if (!selectedPart) return
    setActiveCue({ ...cue, partName: selectedPart.name, partColor: selectedPart.color, partId: selectedPart.id })
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
                <button
                  key={part.id}
                  onClick={() => setSelectedPartId(part.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${selectedPartId === part.id ? 'text-white' : 'bg-[#F4F6F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                  style={selectedPartId === part.id ? { background: part.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedPartId === part.id ? 'rgba(255,255,255,0.6)' : part.color }}></span>
                  {part.name}
                  {part.id === myPart?.id && <span className="text-[9px] opacity-70">내팀</span>}
                  {isPlanner && part.id !== myPart?.id && <span className="text-[9px] opacity-50">기획자</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 콘텐츠 */}
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
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: selectedPart.color }}></span>
                    <span className="text-[18px] font-semibold text-[#1A1A2E]">{selectedPart.name}</span>
                    {!isMyPart && <span className="text-[10px] bg-[#F4F6F9] text-[#A0AEC0] px-2 py-0.5 rounded-full">열람 전용</span>}
                  </div>
                  <div className="text-[12px] text-[#64748B] mt-0.5">
                    <span>{isPlanner ? '기획자 · 전체 수정 가능' : isMyPart ? '내 파트' : isParticipant ? '참가자 · 열람만 가능' : '다른 팀 현황'}</span>
                    {isPlannerRole && (
                      <button onClick={() => setShowMyRoleModal(true)} className="ml-1 text-[#A0AEC0] hover:text-[#185FA5]">
                        <i className="ti ti-pencil text-[10px]"/>
                      </button>
                    )}
                  </div>
                </div>
                {isMyPart && (
                  <div className="flex gap-2">
                    <button className="h-8 px-3 border border-[#F09595] bg-[#FCEBEB] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1.5">
                      <i className="ti ti-alert-triangle text-[14px]"></i> 긴급 연락
                    </button>
                    <button className="h-8 px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center gap-1.5">
                      <i className="ti ti-message-circle text-[14px]"></i> 본부 메시지
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
                  <button onClick={() => setShowAddCue(true)} className="h-8 px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5">
                    <i className="ti ti-plus text-[13px]"></i> 추가
                  </button>
                )}
              </div>
            </div>

            {/* 날짜 롤러 */}
            {dateList.length > 1 && (
              <DateRoller dates={dateList} selected={selectedDate} cues={cues} onSelect={selectDate} />
            )}

            {/* 큐시트 목록 */}
            <div className="flex-1 overflow-y-auto px-5 pb-24">
              {cues.length === 0 ? (
                <div className="text-center py-12 text-[#A0AEC0]">
                  <i className="ti ti-list text-[36px] block mb-2 opacity-30"></i>
                  <p className="text-[13px] mb-4">큐시트 항목이 없어요</p>
                  {isMyPart && (
                    <button onClick={() => setShowAddCue(true)} className="h-[34px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 mx-auto">
                      <i className="ti ti-plus text-[13px]"></i> 큐시트 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 pt-2">
                  {filteredCues.map((cue) => {
                    const cc = checks.filter((c: CheckItem) => c.cueId === cue.id)
                    const dc = cc.filter((c: CheckItem) => c.isDone).length
                    return (
                      <div key={cue.id} className={`rounded-[12px] border bg-white overflow-hidden ${cue.status === 'ongoing' ? 'border-[#185FA5]' : 'border-[#E2E8F0]'}`}>
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
                            </div>
                          </div>
                          {cc.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#F4F6F9]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-[#64748B]">체크리스트</span>
                                <span className="text-[11px] font-semibold text-[#185FA5]">{dc}/{cc.length}</span>
                              </div>
                              <div className="w-full h-1 bg-[#F4F6F9] rounded-full overflow-hidden mb-2">
                                <div className="h-1 rounded-full" style={{ width: `${(dc / cc.length) * 100}%`, background: dc === cc.length ? '#3B6D11' : '#185FA5' }}></div>
                              </div>
                              <div className="flex flex-col gap-1">
                                {cc.slice(0, 3).map((c: CheckItem) => (
                                  <div key={c.id} className="flex items-center gap-2">
                                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 ${c.isDone ? 'bg-[#3B6D11] border-[#3B6D11]' : 'border-[#E2E8F0]'}`}>
                                      {c.isDone && <i className="ti ti-check text-white text-[8px]"></i>}
                                    </div>
                                    <span className={`text-[11px] truncate ${c.isDone ? 'line-through text-[#A0AEC0]' : 'text-[#64748B]'}`}>{c.title}</span>
                                  </div>
                                ))}
                                {cc.length > 3 && <span className="text-[10px] text-[#A0AEC0] ml-5">+{cc.length - 3}개 더보기</span>}
                              </div>
                            </div>
                          )}
                        </button>
                        <div className="flex border-t border-[#F4F6F9]">
                          {cue.status === 'pending' && (
                            <button onClick={() => setCueStatus(cue, 'ongoing')} className="flex-1 py-2 text-[12px] font-semibold text-[#185FA5] hover:bg-[#E6F1FB]">
                              {isMyPart ? '시작' : '👀 보기'}
                            </button>
                          )}
                          {cue.status === 'ongoing' && (
                            <button onClick={() => setCueStatus(cue, 'done')} className="flex-1 py-2 text-[12px] font-semibold text-[#3B6D11] hover:bg-[#EAF3DE]">
                              {isMyPart ? '완료' : '진행 중'}
                            </button>
                          )}
                          {cue.status === 'done' && (
                            <button onClick={() => isMyPart ? setCueStatus(cue, 'pending') : showReadOnly()} className="flex-1 py-2 text-[12px] text-[#A0AEC0] hover:bg-[#F4F6F9]">
                              {isMyPart ? '되돌리기' : '완료됨'}
                            </button>
                          )}
                          <div className="w-px bg-[#F4F6F9]"></div>
                          <button onClick={() => openCueModal(cue)} className="flex items-center gap-1 px-4 py-2 text-[12px] text-[#185FA5] font-semibold hover:bg-[#E6F1FB]">
                            <i className="ti ti-antenna text-[13px]"></i> 무전
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* 수정 권한 없음 모달 */}
      {readOnlyToast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <i className="ti ti-lock text-[#DC2626] text-[32px]"></i>
            </div>
            <div>
              {myPartName && (
                <div className="text-[13px] text-[#64748B] mb-1">
                  <span className="font-bold text-[#1A1A2E]">{myPartName}</span> 팀이십니다.
                </div>
              )}
              <div className="text-[17px] font-bold text-[#1A1A2E] mb-1">수정 권한이 없어요</div>
              <div className="text-[13px] text-[#64748B]">
                해당 팀에 문의해 주시길 바랍니다.
              </div>
            </div>
            <button onClick={() => setReadOnlyToast(false)} className="w-full h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-semibold">확인</button>
          </div>
        </div>
      )}

      {/* 내 파트 변경 모달 */}
      {showMyRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5" onClick={()=>setShowMyRoleModal(false)}>
          <div className="bg-white rounded-[20px] p-5 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold">내 파트 변경</div>
              <button onClick={()=>setShowMyRoleModal(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
            </div>
            <p className="text-[12px] text-[#64748B] mb-4">어느 파트로 보고 싶으신가요? 선택한 파트의 시각으로 확인할 수 있어요.</p>
            <div className="flex flex-col gap-2 mb-4 max-h-[300px] overflow-y-auto">
              {isPlannerRole && (
                <button onClick={()=>setMyNewPartId('__planner__')}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId==='__planner__'||(!myNewPartId&&!myMember?.partId)?'border-[#185FA5] bg-[#E6F1FB]':'border-[#E2E8F0]'}`}>
                  <div className="w-5 h-5 rounded-full bg-[#E6F1FB] flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-shield-check text-[#185FA5] text-[11px]"/>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-[#185FA5]">기획자 (전체 관리)</div>
                    <div className="text-[11px] text-[#64748B]">모든 팀 수정 가능</div>
                  </div>
                  {(myNewPartId==='__planner__'||(!myNewPartId&&!myMember?.partId))&&<i className="ti ti-check text-[#185FA5] text-[16px]"/>}
                </button>
              )}
              {allParts.filter(p=>!p.isParticipant).length>0&&(
                <div className="text-[11px] font-bold text-[#185FA5] mb-1 flex items-center gap-1">
                  <i className="ti ti-users text-[10px]"/> 행사진행
                </div>
              )}
              {allParts.filter(p=>!p.isParticipant).map(part=>(
                <button key={part.id} onClick={()=>setMyNewPartId(part.id)}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId===part.id||(!myNewPartId&&part.id===myMember?.partId)?'border-[#185FA5] bg-[#E6F1FB]':'border-[#E2E8F0]'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:part.color}}/>
                  <span className="text-[13px] font-semibold flex-1">{part.name}</span>
                  {(myNewPartId===part.id||(!myNewPartId&&part.id===myMember?.partId))&&<i className="ti ti-check text-[#185FA5] text-[16px]"/>}
                </button>
              ))}
              {allParts.filter(p=>p.isParticipant).length>0&&(
                <div className="text-[11px] font-bold text-[#854F0B] mt-2 mb-1 flex items-center gap-1">
                  <i className="ti ti-run text-[10px]"/> 참가자
                </div>
              )}
              {allParts.filter(p=>p.isParticipant).map(part=>(
                <button key={part.id} onClick={()=>setMyNewPartId(part.id)}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId===part.id||(!myNewPartId&&part.id===myMember?.partId)?'border-[#854F0B] bg-[#FFF8F0]':'border-[#E2E8F0]'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:part.color}}/>
                  <span className="text-[13px] font-semibold flex-1">{part.name}</span>
                  {(myNewPartId===part.id||(!myNewPartId&&part.id===myMember?.partId))&&<i className="ti ti-check text-[#854F0B] text-[16px]"/>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowMyRoleModal(false)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={()=>saveMyRole(myNewPartId||myMember?.partId||'__planner__')}
                className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold">저장</button>
            </div>
          </div>
        </div>
      )}
      <BottomTabBar />

      {showAddCue && selectedPartId && isMyPart && (
        <AddCueModal
          onClose={() => setShowAddCue(false)}
          onSave={addCue}
          partId={selectedPartId}
          projectId={projectId!}
          order={cues.length}
          allParts={allParts}
          isPlanner={isPlanner}
          currentPart={selectedPart}
        />
      )}

      {activeCue && (
        <CueModal
          cue={activeCue}
          projectId={projectId!}
          onClose={() => setActiveCue(null)}
          isReadOnly={(() => {
            if (isParticipant) return true
            if (isPlanner) return false
            return activeCue.partId !== myMember?.partId && activeCue.partName !== myMember?.partName
          })()}
          myPartName={myPartName}
        />
      )}
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
