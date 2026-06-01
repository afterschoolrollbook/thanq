import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ref as dbRef, onValue, push, set, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes, minutesToTime } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Part, CueItem, CheckItem, Project, Notice } from '@/types'
import { CueModal, type CueWithPart } from '@/components/cue/CueModal'
import { useAuthStore } from '@/store/authStore'

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"

// ── 큐 추가 모달 ──────────────────────────────────────────
function AddCueModal({ onClose, onSave, partId, projectId, order, allParts, isPlanner, currentPart }: {
  onClose: () => void
  onSave: (item: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>, checks: {title: string; category: string}[]) => Promise<void>
  partId: string; projectId: string; order: number
  allParts: Part[]; isPlanner: boolean; currentPart: Part | null
}) {
  const [tab, setTab] = useState<'info'|'check'|'memo'>('info')
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState('')
  const [cardColor, setCardColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [checks, setChecks] = useState<{title:string;category:string}[]>([])
  const [newCheck, setNewCheck] = useState('')
  const [targetPartId, setTargetPartId] = useState(partId)

  function addCheck() {
    if (!newCheck.trim()) return
    setChecks(prev => [...prev, { title: newCheck.trim(), category: 'prep' }])
    setNewCheck('')
  }
  function removeCheck(i: number) { setChecks(prev => prev.filter((_,idx)=>idx!==i)) }

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
    { id: 'check', label: `체크리스트${checks.length>0?` (${checks.length})`:''}` },
    { id: 'memo', label: '메모' },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-t-[20px] pb-8" style={{maxHeight:'90vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
          <div className="text-[16px] font-semibold">큐시트 항목 추가</div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
        </div>
        <div className="px-5 pb-3 flex-shrink-0">
          {isPlanner ? (
            <div className="flex items-center gap-2">
              <span className={lbl} style={{margin:0}}>추가할 파트:</span>
              <select value={targetPartId} onChange={e=>setTargetPartId(e.target.value)}
                className="flex-1 h-[32px] border border-[#E2E8F0] rounded-[8px] px-2 text-[12px] font-semibold text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]">
                {allParts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:currentPart?.color??'#185FA5'}}/>
              <span className="text-[12px] font-semibold text-[#1A1A2E]">{currentPart?.name??''}</span>
              <span className="text-[11px] text-[#A0AEC0]">에 추가</span>
            </div>
          )}
        </div>
        <div className="flex border-b border-[#E2E8F0] px-5 flex-shrink-0">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`mr-4 pb-2 text-[13px] font-semibold border-b-2 transition-colors ${tab===t.id?'border-[#185FA5] text-[#185FA5]':'border-transparent text-[#A0AEC0]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab==='info' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={lbl}>항목명 <span className="text-[#A32D2D]">*</span></label>
                <input className={inp} placeholder="예: 오프닝 영상 재생" value={title} onChange={e=>setTitle(e.target.value)} autoFocus/>
              </div>
              <div>
                <label className={lbl}>날짜 <span className="text-[#A0AEC0] font-normal">(비워두면 행사 당일)</span></label>
                <input className={inp} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
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
                  <input className={inp} type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/>
                </div>
                <div>
                  <label className={lbl}>소요 시간 (분)</label>
                  <input className={inp} type="number" min="0" placeholder="0" value={durationMin} onChange={e=>setDurationMin(e.target.value)}/>
                </div>
              </div>
            </div>
          )}
          {tab==='check' && (
            <div className="flex flex-col gap-2">
              {checks.length===0 && <p className="text-[13px] text-[#A0AEC0] text-center py-4">체크리스트 항목을 추가해보세요</p>}
              {checks.map((c,i)=>(
                <div key={i} className="flex items-center gap-3 p-3 rounded-[10px] border border-[#E2E8F0] bg-white">
                  <div className="w-4 h-4 rounded border-2 border-[#E2E8F0] flex-shrink-0"/>
                  <span className="text-[13px] flex-1">{c.title}</span>
                  <button onClick={()=>removeCheck(i)} className="text-[#E2E8F0] hover:text-[#E24B4A]"><i className="ti ti-trash text-[14px]"/></button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input className={inp+' flex-1'} placeholder="체크리스트 항목 추가..." value={newCheck}
                  onChange={e=>setNewCheck(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCheck()}}/>
                <button onClick={addCheck} className="w-10 h-10 bg-[#185FA5] text-white rounded-[10px] flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-plus text-[16px]"/>
                </button>
              </div>
            </div>
          )}
          {tab==='memo' && (
            <div>
              <label className={lbl}>메모</label>
              <textarea className="w-full border border-[#E2E8F0] rounded-[10px] p-3 text-[13px] text-[#1A1A2E] resize-none focus:outline-none focus:border-[#185FA5]"
                style={{height:160}} placeholder="참고사항을 입력하세요..." value={memo} onChange={e=>setMemo(e.target.value)}/>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 flex-shrink-0">
          <button onClick={onClose} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
          <button onClick={handleSave} disabled={!title.trim()||saving}
            className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-40">
            {saving?'저장 중...':'추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 시뮬레이션 타입 ───────────────────────────────────────
type SimSeverity = 'conflict' | 'warning' | 'info'
interface SimIssue {
  id: string
  severity: SimSeverity
  time?: string
  title: string
  detail: string
  cueIds: string[]
}

function runSim(parts: Part[], allCues: CueWithPart[], selectedDate: string, project: Project): SimIssue[] {
  const issues: SimIssue[] = []
  let idx = 0
  const dayCues = allCues.filter(c => !c.date || c.date === selectedDate)

  for (const part of parts) {
    const pc = dayCues.filter(c => c.partId === part.id).sort((a,b) => timeToMinutes(a.startTime)-timeToMinutes(b.startTime))
    for (let i = 0; i < pc.length - 1; i++) {
      const cur = pc[i], next = pc[i+1]
      const curEnd = timeToMinutes(cur.startTime) + (cur.durationMin||0)
      const nextStart = timeToMinutes(next.startTime)
      if (curEnd > nextStart) {
        issues.push({ id:`i${idx++}`, severity:'conflict', time: cur.startTime,
          title: `[${part.name}] 시간 겹침: "${cur.title}" ↔ "${next.title}"`,
          detail: `"${cur.title}" 종료 ${minutesToTime(curEnd)} → "${next.title}" 시작 ${next.startTime} (${curEnd-nextStart}분 충돌)`,
          cueIds:[cur.id, next.id] })
      } else if (curEnd === nextStart && (cur.durationMin||0) > 0) {
        issues.push({ id:`i${idx++}`, severity:'info', time: cur.startTime,
          title: `[${part.name}] 전환 여유 없음: "${cur.title}" → "${next.title}"`,
          detail: `두 큐 사이 여유 시간 0분 — 준비/이동 시간이 필요할 수 있어요`,
          cueIds:[cur.id, next.id] })
      }
    }
    // 과밀
    const slots: Record<string, CueWithPart[]> = {}
    for (const c of pc) {
      const k = minutesToTime(Math.floor(timeToMinutes(c.startTime)/30)*30)
      if (!slots[k]) slots[k] = []
      slots[k].push(c)
    }
    for (const [t, cs] of Object.entries(slots)) {
      if (cs.length >= 3) issues.push({ id:`i${idx++}`, severity:'warning', time: t,
        title: `[${part.name}] ${t} 전후 과밀 배치 (${cs.length}개)`,
        detail: `30분 내에 큐 ${cs.length}개 집중 — 여유 없이 진행될 수 있어요`,
        cueIds: cs.map(c=>c.id) })
    }
    // 소요시간 미설정
    for (const c of pc) {
      if (!c.durationMin || c.durationMin === 0)
        issues.push({ id:`i${idx++}`, severity:'info', time: c.startTime,
          title: `[${part.name}] 소요 시간 미설정: "${c.title}"`,
          detail: `소요 시간이 0분이에요 — 실제 시간을 입력하면 더 정확하게 분석돼요`,
          cueIds:[c.id] })
    }
  }
  // 행사 범위 초과
  if (project.startTime && project.endTime) {
    const evEnd = timeToMinutes(project.endTime)
    for (const c of dayCues) {
      const cEnd = timeToMinutes(c.startTime) + (c.durationMin||0)
      if (cEnd > evEnd + 10)
        issues.push({ id:`i${idx++}`, severity:'warning', time: c.startTime,
          title: `[${c.partName}] 행사 종료 후 초과: "${c.title}"`,
          detail: `큐 종료 예정 ${minutesToTime(cEnd)} — 행사 종료 ${project.endTime} 초과`,
          cueIds:[c.id] })
    }
  }
  return issues
}


// ── 분석결과 플로팅 패널 ──────────────────────────────────
function SimResultPanel({ issues, simFilter, setSimFilter, onClose }: {
  issues: SimIssue[]
  simFilter: SimSeverity | 'all'
  setSimFilter: (v: SimSeverity | 'all') => void
  onClose: () => void
}) {
  const [pos, setPos] = useState({ x: 16, y: 100 })
  const [minimized, setMinimized] = useState(false)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    e.preventDefault()
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: dragStart.current.px + e.clientX - dragStart.current.mx,
        y: dragStart.current.py + e.clientY - dragStart.current.my,
      })
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const conflictCount = issues.filter(i => i.severity === 'conflict').length
  const warningCount  = issues.filter(i => i.severity === 'warning').length
  const filtered = issues.filter(i => simFilter === 'all' || i.severity === simFilter)

  return (
    <div style={{ position:'fixed', left: pos.x, top: pos.y, zIndex: 200, width: 320, userSelect:'none' }}
      className="bg-white rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-[#E2E8F0] overflow-hidden">
      {/* 헤더 — 드래그 핸들 */}
      <div onMouseDown={onMouseDown}
        className="flex items-center justify-between px-3 py-2.5 bg-[#185FA5] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2">
          <i className="ti ti-sparkles text-white text-[13px]"/>
          <span className="text-[12px] font-semibold text-white">분석 결과</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${conflictCount>0?'bg-[#FCEBEB] text-[#A32D2D]':'bg-white/20 text-white'}`}>
            충돌 {conflictCount}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${warningCount>0?'bg-[#FAEEDA] text-[#854F0B]':'bg-white/20 text-white'}`}>
            주의 {warningCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e)=>{e.stopPropagation();setMinimized(v=>!v)}}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 text-white">
            <i className={`ti ${minimized?'ti-chevron-down':'ti-chevron-up'} text-[12px]`}/>
          </button>
          <button onClick={(e)=>{e.stopPropagation();onClose()}}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 text-white">
            <i className="ti ti-x text-[12px]"/>
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* 필터 */}
          <div className="flex gap-1 px-3 py-2 border-b border-[#F1F5F9]">
            {(['all','conflict','warning','info'] as const).map(sv=>(
              <button key={sv} onClick={(e)=>{e.stopPropagation();setSimFilter(sv)}}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${simFilter===sv?'bg-[#185FA5] text-white':'bg-[#F4F6F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
                {sv==='all'?`전체 ${issues.length}`:sv==='conflict'?`충돌 ${conflictCount}`:sv==='warning'?`주의 ${warningCount}`:`참고 ${issues.filter(i=>i.severity==='info').length}`}
              </button>
            ))}
          </div>
          {/* 이슈 목록 */}
          <div style={{ maxHeight: 320, overflowY:'auto' }} className="px-2 py-2 flex flex-col gap-1.5">
            {issues.length === 0 ? (
              <div className="flex flex-col items-center py-5 gap-1">
                <i className="ti ti-circle-check text-[#3B6D11] text-[24px]"/>
                <span className="text-[12px] font-semibold text-[#3B6D11]">문제 없음! 큐시트가 깔끔해요 👍</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-4 text-[11px] text-[#A0AEC0]">해당 항목이 없어요</div>
            ) : filtered.map(issue=>(
              <div key={issue.id}
                className={`rounded-[10px] px-2.5 py-2 border ${
                  issue.severity==='conflict' ? 'bg-[#FCEBEB] border-[#F7C1C1]'
                  : issue.severity==='warning' ? 'bg-[#FAEEDA] border-[#FAC775]'
                  : 'bg-[#E6F1FB] border-[#B5D4F4]'
                }`}>
                <div className="flex items-start gap-1.5">
                  <i className={`ti ${issue.severity==='conflict'?'ti-alert-triangle':issue.severity==='warning'?'ti-alert-circle':'ti-info-circle'} text-[12px] mt-0.5 flex-shrink-0 ${issue.severity==='conflict'?'text-[#A32D2D]':issue.severity==='warning'?'text-[#854F0B]':'text-[#185FA5]'}`}/>
                  <div>
                    {issue.time && <span className="text-[10px] font-semibold text-[#64748B] mr-1">{issue.time}</span>}
                    <span className="text-[11px] font-semibold text-[#1A1A2E]">{issue.title}</span>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">{issue.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── 달력 ──────────────────────────────────────────────────
function MiniCalendar({ selectedDate, onChange, eventDates, prepDates, onClose }: {
  selectedDate: string; onChange: (d: string) => void; eventDates: string[]; prepDates: string[]; onClose: () => void
}) {
  const [vY, setVY] = useState(() => new Date(selectedDate || Date.now()).getFullYear())
  const [vM, setVM] = useState(() => new Date(selectedDate || Date.now()).getMonth())
  const firstDay = new Date(vY, vM, 1).getDay()
  const dim = new Date(vY, vM + 1, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= dim; d++) { week.push(d); if (week.length === 7) { weeks.push(week); week = [] } }
  if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)])
  const toStr = (d: number) => `${vY}-${String(vM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-[12px] border border-[#E2E8F0] shadow-lg p-3 w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => { if (vM===0){setVM(11);setVY(y=>y-1)}else setVM(m=>m-1) }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F4F6F9]"><i className="ti ti-chevron-left text-[13px]"/></button>
        <span className="text-[12px] font-bold">{vY}년 {vM+1}월</span>
        <button onClick={() => { if (vM===11){setVM(0);setVY(y=>y+1)}else setVM(m=>m+1) }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F4F6F9]"><i className="ti ti-chevron-right text-[13px]"/></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((d,i)=><div key={d} className={`text-center text-[10px] font-semibold pb-1 ${i===0?'text-[#E24B4A]':i===6?'text-[#185FA5]':'text-[#A0AEC0]'}`}>{d}</div>)}
      </div>
      {weeks.map((wk,wi)=>(
        <div key={wi} className="grid grid-cols-7">
          {wk.map((d,di)=>{
            if(!d) return <div key={di}/>
            const str=toStr(d), isSel=str===selectedDate, isEv=eventDates.includes(str), isPrep=prepDates.includes(str), isToday=str===new Date().toISOString().split('T')[0]
            const dc=di===0?'text-[#E24B4A]':di===6?'text-[#185FA5]':'text-[#1A1A2E]'
            const bc=isSel?'bg-[#185FA5] text-white':isEv?`border-2 border-[#DC2626] text-[#DC2626] font-bold`:`${dc} hover:bg-[#F4F6F9]`
            return <button key={di} onClick={()=>{onChange(str);onClose()}} className={`relative h-7 w-full flex flex-col items-center justify-center rounded-full text-[11px] font-medium ${bc}`}>
              {d}
              {isPrep&&!isSel&&!isEv&&<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#DC2626]"/>}
              {isToday&&<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-[#185FA5]"/>}
            </button>
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
  const user = useAuthStore((s) => s.user)
  const [myMember, setMyMember] = useState<{role: string; partId?: string; partName?: string} | null>(null)
  const [showMyRoleModal, setShowMyRoleModal] = useState(false)
  const [myNewPartId, setMyNewPartId] = useState('')
  const [parts, setParts] = useState<Part[]>([])
  const myPartName = parts.find(p => p.id === myMember?.partId)?.name ?? myMember?.partName ?? ''
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [allChecks, setAllChecks] = useState<CheckItem[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalendar, setShowCalendar] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [activeCue, setActiveCue] = useState<CueWithPart | null>(null)
  const [showAddCue, setShowAddCue] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const calendarRef = useRef<HTMLDivElement>(null)
  // ── 시뮬레이션 ──
  const [simState, setSimState] = useState<'idle'|'scanning'|'done'>('idle')
  const [simIssues, setSimIssues] = useState<SimIssue[]>([])
  const [scanY, setScanY] = useState(0)
  const [_scanDir, setScanDir] = useState(1)
  const [_scanPass, setScanPass] = useState(0)
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [simFilter, setSimFilter] = useState<SimSeverity|'all'>('all')
  const gridRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {} }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!projectId) return
    onValue(dbRef(db, `projects/${projectId}`), s => {
      if (s.exists()) {
        const p = s.val() as Project
        setProject(p)
        setSelectedDate(p.date ?? new Date().toISOString().split('T')[0])
        if (user) {
          // parts 로딩과 별도로 myMember 로딩 (순서 무관하게 myPartName 계산됨)
          onValue(dbRef(db, `projectMembers/${projectId}/${user.uid}`), (ms) => {
            if (ms.exists()) setMyMember(ms.val())
          })
        }
      }
    }, { onlyOnce: true })
  }, [projectId])

  // myMember 또는 parts 바뀔 때 myPartName 자동 갱신 (이미 파생값으로 계산되므로 별도 처리 불필요)
  // → myPartName = parts.find(p => p.id === myMember?.partId)?.name ?? '' 가 렌더마다 재계산됨 ✓

  // 공지 실시간 로딩
  useEffect(() => {
    if (!projectId) return
    return onValue(dbRef(db, `notices/${projectId}`), s => {
      if (s.exists()) {
        const l: Notice[] = Object.values(s.val())
        l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setNotices(l)
      } else setNotices([])
    })
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    onValue(dbRef(db, `parts/${projectId}`), s => {
      if (!s.exists()) return
      const list: Part[] = Object.values(s.val())
      list.sort((a,b) => {
        if (!!a.isParticipant !== !!b.isParticipant) return a.isParticipant ? 1 : -1
        return a.order - b.order
      })
      setParts(list)

      // 큐 - 파트별 독립 리스너 (실시간 반영)
      const cuesByPart = new Map<string, CueWithPart[]>()
      list.forEach(part => {
        onValue(dbRef(db, `cueItems/${projectId}/${part.id}`), cs => {
          const partCues: CueWithPart[] = cs.exists()
            ? Object.values(cs.val() as CueItem[]).map((i:CueItem) => ({...i, partName:part.name, partColor:part.color, partId:part.id}))
            : []
          cuesByPart.set(part.id, partCues)
          const merged: CueWithPart[] = []
          list.forEach(p => (cuesByPart.get(p.id) ?? []).forEach(c => merged.push(c)))
          merged.sort((a,b) => timeToMinutes(a.startTime)-timeToMinutes(b.startTime))
          setAllCues([...merged])
        })
      })

      // 체크 - 파트별 독립 리스너 (실시간 반영)
      const checksByPart = new Map<string, CheckItem[]>()
      list.forEach(part => {
        onValue(dbRef(db, `checkItems/${projectId}/${part.id}`), cs => {
          checksByPart.set(part.id, cs.exists() ? Object.values(cs.val() as CheckItem[]) : [])
          const merged: CheckItem[] = []
          list.forEach(p => (checksByPart.get(p.id) ?? []).forEach(c => merged.push(c)))
          setAllChecks([...merged])
        })
      })
    })
  }, [projectId])

  // 핀치줌
  const lpd = useRef<number|null>(null), lz = useRef(1)
  function onTS(e:React.TouchEvent) { if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;lpd.current=Math.hypot(dx,dy);lz.current=zoom} }
  function onTM(e:React.TouchEvent) { if(e.touches.length===2&&lpd.current){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;setZoom(Math.min(2,Math.max(0.5,lz.current*(Math.hypot(dx,dy)/lpd.current))))} }
  function onTE() { lpd.current=null }

  // ── 시뮬레이션 실행 ──────────────────────────────────────
  const startSimulation = useCallback(() => {
    if (!project || simState === 'scanning') return
    setSimState('scanning')
    setSimIssues([])
    setHighlightIds(new Set())
    setScanY(0)
    setScanDir(1)
    setScanPass(0)
    const gridEl = gridRef.current
    const maxH = gridEl ? gridEl.scrollHeight : 600
    const SCAN_H = Math.round(maxH * 0.15) // 스캔 박스 세로 (전체의 15% ≈ 1시간분)
    const TOTAL_PASSES = 3 // 왕복 3회
    let y = 0
    let dir = 1
    let pass = 0
    const speed = Math.max(1, maxH / 300) // 느리게 (약 5초/패스)
    if (scanRef.current) clearInterval(scanRef.current)
    scanRef.current = setInterval(() => {
      y += speed * dir
      if (dir === 1 && y + SCAN_H >= maxH) {
        y = maxH - SCAN_H
        dir = -1
        pass++
        setScanPass(pass)
      } else if (dir === -1 && y <= 0) {
        y = 0
        dir = 1
        pass++
        setScanPass(pass)
      }
      setScanY(y)
      setScanDir(dir)
      if (pass >= TOTAL_PASSES * 2) {
        clearInterval(scanRef.current!)
        const issues = runSim(parts, allCues, selectedDate, project)
        setSimIssues(issues)
        setHighlightIds(new Set(issues.flatMap(i => i.cueIds)))
        setSimState('done')
      }
    }, 16)
  }, [project, parts, allCues, selectedDate, simState])

  function resetSim() {
    if (scanRef.current) clearInterval(scanRef.current)
    setSimState('idle')
    setSimIssues([])
    setHighlightIds(new Set())
    setScanY(0)
    setScanDir(1)
    setScanPass(0)
  }

  async function saveMyRole(partId: string) {
    if (!projectId || !user) return
    const isReturningToPlanner = partId === '__planner__'
    const selectedPart = parts.find(p => p.id === partId)
    await update(dbRef(db, `projectMembers/${projectId}/${user.uid}`), {
      partId: isReturningToPlanner ? '' : partId,
      partName: isReturningToPlanner ? '기획자' : (selectedPart?.name ?? ''),
      role: isReturningToPlanner ? 'planner' : ((myMember?.role==='owner'||project?.ownerId===user.uid) ? 'planner' : 'staff'),
    })
    setMyMember(prev => prev ? {
      ...prev,
      partId: isReturningToPlanner ? '' : partId,
      partName: isReturningToPlanner ? '' : (selectedPart?.name ?? ''),
      role: isReturningToPlanner ? 'planner' : ((prev.role==='owner'||project?.ownerId===user.uid) ? 'planner' : 'staff'),
    } : prev)
    setMyNewPartId('')
    setShowMyRoleModal(false)
  }

  async function addCue(data: Omit<CueItem, 'id'|'createdAt'|'updatedAt'>, checks: {title:string;category:string}[] = []) {
    if (!projectId) return
    const savePartId = data.partId
    const newRef = push(dbRef(db, `cueItems/${projectId}/${savePartId}`))
    const cueId = newRef.key!
    const now = new Date().toISOString()
    await set(newRef, { ...data, id: cueId, partId: savePartId, createdAt: now, updatedAt: now })
    for (const check of checks) {
      const checkRef = push(dbRef(db, `checkItems/${projectId}/${savePartId}`))
      await set(checkRef, { id: checkRef.key, partId: savePartId, projectId, cueId, category: check.category, title: check.title, isDone: false, createdAt: now })
    }
    const part = parts.find(p => p.id === savePartId)
    const ar = push(dbRef(db, `cueAlerts/${projectId}`))
    await set(ar, {
      id: ar.key, projectId, partId: savePartId, partName: part?.name ?? '', partColor: part?.color ?? '#185FA5',
      cueId, cueTitle: data.title, changeType: 'new',
      detail: `큐 추가: "${data.title}" (${data.startTime})`,
      isChecked: false, createdAt: now
    })
    setShowAddCue(false)
  }

  const visibleParts = selectedPartId ? parts.filter(p=>p.id===selectedPartId) : parts
  // date 필드 있는 큐는 selectedDate와 일치할 때만 표시, 없으면 항상 표시
  const filteredCues = allCues.filter(c=>
    (!selectedPartId || c.partId===selectedPartId) &&
    (!c.date || c.date === selectedDate)
  )

  const timeSlots: string[] = []
  if (filteredCues.length > 0) {
    const starts = filteredCues.map(c=>timeToMinutes(c.startTime)).filter(m=>!isNaN(m))
    const ends = filteredCues.map(c=>timeToMinutes(c.startTime)+(c.durationMin||30)).filter(m=>!isNaN(m))
    const minT = Math.floor(Math.min(...starts)/30)*30, maxT = Math.ceil(Math.max(...ends)/30)*30
    for (let m=minT; m<=maxT; m+=30) timeSlots.push(minutesToTime(m))
  }

  const partSlotCues = new Map<string, CueWithPart[]>()
  for (const cue of filteredCues) {
    const k = `${cue.partId}__${minutesToTime(Math.floor(timeToMinutes(cue.startTime)/30)*30)}`
    if (!partSlotCues.has(k)) partSlotCues.set(k, [])
    partSlotCues.get(k)!.push(cue)
  }

  function getCueChecks(cueId: string) {
    const linked = allChecks.filter(c=>c.cueId===cueId)
    return { total: linked.length, done: linked.filter(c=>c.isDone).length }
  }

  const CUE_H = Math.round(90*zoom), PAD = Math.round(10*zoom), MIN_ROW_H = Math.round(50*zoom)
  const COL_W = Math.round(160*zoom), TIME_W = 56

  function getSlotH(slot: string) {
    let max = 0
    for (const p of visibleParts) max = Math.max(max, (partSlotCues.get(`${p.id}__${slot}`)??[]).length)
    return Math.max(MIN_ROW_H, max*CUE_H+PAD)
  }

  const slotTops = new Map<string,number>()
  let acc = 0
  for (const slot of timeSlots) { slotTops.set(slot,acc); acc+=getSlotH(slot) }
  const totalH = acc
  const totalGridW = TIME_W + COL_W * visibleParts.length
  // 준비시작일~행사종료일 사이 날짜 전체를 캘린더에 표시
  // 행사일: date ~ dateEnd
  const eventDates = (() => {
    if (!project) return []
    const dates: string[] = []
    const start = new Date(project.date)
    const end = new Date((project as any).dateEnd || project.date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  })()

  // 준비일: prepDate ~ date 전날
  const prepDates = (() => {
    if (!project || !(project as any).prepDate) return []
    const dates: string[] = []
    const start = new Date((project as any).prepDate)
    const end = new Date(project.date)
    end.setDate(end.getDate() - 1)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  })()

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      <Topbar projectName={project?.name}/>
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 컨트롤 — 중앙 정렬 */}
        <div className="bg-white border-b border-[#E2E8F0] pt-3 pb-0">
          <div className="max-w-4xl mx-auto px-5">
            <div className="flex items-center justify-between mb-3 flex-nowrap gap-2">
              <button onClick={()=>window.open(window.location.href,'timeline_'+projectId,'width=1280,height=900')}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-[6px] border border-[#E2E8F0] text-[11px] text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                <i className="ti ti-external-link text-[11px]"/> 새 창
              </button>
              <div className="flex items-center gap-2">
                <div className="relative" ref={calendarRef}>
                  <button onClick={()=>setShowCalendar(v=>!v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F4F6F9]">
                    <i className="ti ti-calendar text-[#185FA5] text-[14px]"/>
                    <span className="text-[13px] font-semibold">{selectedDate}</span>
                    <i className={`ti ti-chevron-${showCalendar?'up':'down'} text-[#A0AEC0] text-[11px]`}/>
                  </button>
                  {showCalendar && <MiniCalendar selectedDate={selectedDate} onChange={setSelectedDate} eventDates={eventDates} prepDates={prepDates} onClose={()=>setShowCalendar(false)}/>}
                </div>
                {/* 내 위치/등급 배지 */}
                {myMember && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-white border border-[#E2E8F0]">
                    <i className={`ti ${myMember.role==='owner'||myMember.role==='planner' ? 'ti-shield-check text-[#185FA5]' : 'ti-user text-[#64748B]'} text-[11px]`}/>
                    <span className="text-[#1A1A2E]">
                      {myMember.role==='owner'||myMember.role==='planner' ? '기획자' : myMember.role==='admin' ? '관리자' : myMember.role==='participant' ? '참가자' : '스태프'}
                    </span>
                    {myPartName && <><span className="text-[#E2E8F0]">·</span><span className="text-[#64748B]">{myPartName}</span></>}
                    <button onClick={()=>setShowMyRoleModal(true)} className="ml-0.5 text-[#A0AEC0] hover:text-[#185FA5]">
                      <i className="ti ti-pencil text-[10px]"/>
                    </button>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* 큐 추가 버튼 — 기획자/스태프만 */}
                {myMember && myMember.role !== 'participant' && (
                  <button onClick={()=>setShowAddCue(true)}
                    className="h-7 px-2.5 rounded-full bg-white border border-[#E2E8F0] text-[11px] font-semibold text-[#1A1A2E] flex items-center gap-1 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                    <i className="ti ti-plus text-[12px]"/>큐 추가
                  </button>
                )}
                <button onClick={()=>setZoom(z=>Math.max(0.5,+(z-0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-minus text-[13px]"/></button>
                <span className="text-[11px] text-[#A0AEC0] w-9 text-center">{Math.round(zoom*100)}%</span>
                <button onClick={()=>setZoom(z=>Math.min(2,+(z+0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-plus text-[13px]"/></button>
                <button onClick={()=>setZoom(1)} className="h-7 px-2 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#64748B] hover:bg-[#F4F6F9] ml-1">초기화</button>
                {/* 운영 단계 배지 — 초기화 오른쪽 */}
                {(project as any)?.phase && (
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ml-1 ${
                    (project as any).phase==='live'     ? 'bg-[#FCEBEB] text-[#A32D2D]' :
                    (project as any).phase==='testing'  ? 'bg-[#E6F1FB] text-[#185FA5]' :
                    'bg-[#F4F6F9] text-[#64748B]'
                  }`}>
                    {(project as any).phase==='live'    && <><span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/> 진행</>}
                    {(project as any).phase==='testing' && <><i className="ti ti-player-play text-[10px]"/> 테스트중</>}
                    {(project as any).phase==='planning'&& <><i className="ti ti-pencil text-[10px]"/> 기획중</>}
                  </span>
                )}
                {/* 시뮬레이션 버튼 — 테스트중일 때만 */}
                {(project as any)?.phase === 'testing' && (
                  <button onClick={simState==='scanning' ? undefined : simState==='done' ? resetSim : startSimulation}
                    className={`ml-1 h-7 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all ${
                      simState==='scanning' ? 'bg-[#185FA5] text-white opacity-70 cursor-not-allowed'
                      : simState==='done'   ? 'bg-[#EAF3DE] text-[#3B6D11] border border-[#C0DD97] hover:bg-[#D4EDBA]'
                      : 'bg-[#185FA5] text-white hover:bg-[#0C447C]'
                    }`}>
                    <i className={`ti ${simState==='scanning' ? 'ti-loader-2' : simState==='done' ? 'ti-refresh' : 'ti-player-play'} text-[11px] ${simState==='scanning' ? 'animate-spin' : ''}`}/>
                    {simState==='scanning' ? '스캔 중' : simState==='done' ? '다시' : 'AI 분석'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5" >
              <button onClick={()=>setSelectedPartId(null)} className={`flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-semibold ${!selectedPartId?'bg-[#185FA5] text-white':'border border-[#E2E8F0] text-[#64748B] bg-white'}`}>전체</button>
              {parts.map(p=>(
                <button key={p.id} onClick={()=>setSelectedPartId(selectedPartId===p.id?null:p.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border ${selectedPartId===p.id?'text-white':'border-[#E2E8F0] text-[#64748B] bg-white'}`}
                  style={selectedPartId===p.id?{background:p.color,borderColor:p.color}:{}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:p.color}}/>{p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 그리드 — 중앙 정렬 + 스크롤 */}
        {filteredCues.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#A0AEC0]">
            <i className="ti ti-calendar-off text-[48px] opacity-30"/><p className="text-[13px]">큐시트 항목이 없어요</p>
          </div>
        ) : (
          <div className="flex-1 flex justify-center" style={{overflow:'scroll'}} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
            <div style={{minWidth: totalGridW, width: totalGridW}} ref={gridRef} className="relative">

              {/* 스캔 박스 오버레이 */}
              {simState === 'scanning' && (() => {
                const gridEl = gridRef.current
                const maxH = gridEl ? gridEl.scrollHeight : 600
                const SCAN_H = Math.round(maxH * 0.15)
                return (
                  <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
                    {/* 스캔 박스 */}
                    <div style={{
                      position: 'absolute',
                      top: scanY,
                      left: TIME_W,
                      right: 0,
                      height: SCAN_H,
                      border: '2px solid #185FA5',
                      borderRadius: 8,
                      background: 'rgba(24,95,165,0.04)',
                      boxShadow: '0 0 0 1px #185FA522, 0 0 20px 4px #185FA533',
                    }}>
                      {/* 상단 글로우 라인 */}
                      <div style={{position:'absolute', top:-1, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,#378ADD,#185FA5,#378ADD,transparent)', borderRadius:'8px 8px 0 0'}}/>
                      {/* 하단 글로우 라인 */}
                      <div style={{position:'absolute', bottom:-1, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,#378ADD,#185FA5,#378ADD,transparent)', borderRadius:'0 0 8px 8px'}}/>
                      {/* 스캔 레이블 */}
                      <div style={{position:'absolute', top:6, right:8, display:'flex', alignItems:'center', gap:4}}>
                        <span style={{fontSize:9, fontWeight:700, color:'#185FA5', background:'#E6F1FB', padding:'1px 6px', borderRadius:20, opacity:0.9}}>SCANNING</span>
                      </div>
                    </div>
                    {/* 위아래 어두운 오버레이 */}
                    <div style={{position:'absolute', top:0, left:TIME_W, right:0, height: Math.max(0, scanY), background:'rgba(244,246,249,0.5)'}}/>
                    <div style={{position:'absolute', top: scanY + SCAN_H, left:TIME_W, right:0, bottom:0, background:'rgba(244,246,249,0.5)'}}/>
                  </div>
                )
              })()}

              {/* 파트 헤더 sticky */}
              <div className="sticky top-0 z-20 bg-white border-b-2 border-[#E2E8F0] shadow-sm">
                {/* 구분 레이블 행 */}
                {visibleParts.some(p => p.isParticipant) && (
                  <div className="flex border-b border-[#F1F5F9]">
                    <div style={{width:TIME_W,minWidth:TIME_W}} className="flex-shrink-0"/>
                    {(() => {
                      const staffCount = visibleParts.filter(p => !p.isParticipant).length
                      const partCount = visibleParts.filter(p => p.isParticipant).length
                      return <>
                        {staffCount > 0 && (
                          <div style={{width: COL_W * staffCount, minWidth: COL_W * staffCount}}
                            className="flex items-center justify-center gap-1 py-1 border-l border-[#E2E8F0] bg-[#F0F7FF]">
                            <i className="ti ti-users text-[#185FA5] text-[10px]"/>
                            <span className="text-[10px] font-bold text-[#185FA5]">행사진행</span>
                          </div>
                        )}
                        {partCount > 0 && (
                          <div style={{width: COL_W * partCount, minWidth: COL_W * partCount}}
                            className="flex items-center justify-center gap-1 py-1 border-l border-[#E2E8F0] bg-[#FFF8F0]">
                            <i className="ti ti-run text-[#854F0B] text-[10px]"/>
                            <span className="text-[10px] font-bold text-[#854F0B]">참가자</span>
                          </div>
                        )}
                      </>
                    })()}
                  </div>
                )}
                {/* 파트 이름 행 */}
                <div className="flex">
                  <div style={{width:TIME_W,minWidth:TIME_W}} className="flex-shrink-0"/>
                  {visibleParts.map(p=>(
                    <div key={p.id} style={{width:COL_W,minWidth:COL_W}}
                      className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2 border-l border-[#E2E8F0]">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:p.color}}/>
                      <span className="text-[11px] font-bold text-[#1A1A2E] truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 슬롯 */}
              <div className="flex">
                <div style={{width:TIME_W,minWidth:TIME_W}} className="flex-shrink-0">
                  {timeSlots.map(slot=>(
                    <div key={slot} style={{height:getSlotH(slot)}} className={`flex items-start justify-end pr-2 pt-2 ${slot.endsWith(':00') ? 'border-b-2 border-[#CBD5E1]' : 'border-b border-[#F1F5F9]'}`}>
                      <span className={`text-[11px] font-bold ${slot.endsWith(':00') ? 'text-[#64748B]' : 'text-[#A0AEC0]'}`}>{slot}</span>
                    </div>
                  ))}
                </div>

                {visibleParts.map(part=>(
                  <div key={part.id} style={{width:COL_W,minWidth:COL_W,height:totalH}} className="flex-shrink-0 relative border-l border-[#E2E8F0]">
                    {timeSlots.map(slot=>(
                      <div key={slot} style={{top:slotTops.get(slot)??0,height:getSlotH(slot)}} className={`absolute left-0 right-0 ${slot.endsWith(':00') ? 'border-b-2 border-[#CBD5E1]' : 'border-b border-[#F1F5F9]'}`}/>
                    ))}
                    {timeSlots.map(slot=>{
                      const cues = (partSlotCues.get(`${part.id}__${slot}`)??[]).sort((a,b)=>timeToMinutes(a.startTime)-timeToMinutes(b.startTime))
                      const slotTop = slotTops.get(slot)??0
                      return cues.map((cue,idx)=>{
                        const {total,done} = getCueChecks(cue.id)
                        const allDone = total>0 && done===total
                        const hasPending = total>0 && done<total
                        return (
                          <div key={cue.id} onClick={()=>setActiveCue(cue)}
                            style={{
                              position:'absolute',top:slotTop+PAD/2+idx*CUE_H,height:CUE_H-4,left:3,right:3,
                              // cardColor가 있으면 배경을 해당 색상의 연한 버전으로
                              ...(cue.cardColor ? {
                                background: cue.cardColor + '18',
                                borderColor: cue.cardColor + '66',
                              } : {})
                            }}
                            className={`rounded-[8px] border bg-white shadow-sm flex flex-col justify-between px-2 py-1.5 overflow-hidden cursor-pointer transition-all ${
                              highlightIds.has(cue.id)
                                ? 'border-[#E24B4A] shadow-[0_0_0_2px_#E24B4A44]'
                                : cue.cardColor ? 'hover:shadow-md' : 'border-[#E2E8F0] hover:border-[#185FA5] hover:shadow-md'
                            }`}>
                            <div>
                              <div className="font-bold leading-tight truncate"
                                style={{
                                  fontSize:Math.max(9,Math.round(11*zoom))+'px',
                                  color: cue.cardColor ?? '#1A1A2E'
                                }}>{cue.title}</div>
                              {cue.durationMin>0 && <div className="text-[#A0AEC0] mt-0.5" style={{fontSize:Math.max(8,Math.round(9*zoom))+'px'}}>{cue.durationMin}분</div>}
                            </div>
                            <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
                              <StatusBadge status={cue.status}/>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* 메모 */}
                                <i className={`ti ti-notes text-[12px] ${cue.memo ? 'text-[#185FA5]' : 'text-[#E2E8F0]'}`}/>
                                {/* 체크리스트 */}
                                {total > 0 ? (
                                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded-full ${allDone?'bg-[#E1F5EE] text-[#3B6D11]':'bg-[#FEF3C7] text-[#92400E]'}`}>
                                    <i className={`ti ${allDone?'ti-check':'ti-checklist'} text-[10px]`}/>{done}/{total}
                                  </span>
                                ) : (
                                  <i className="ti ti-checklist text-[12px] text-[#E2E8F0]"/>
                                )}
                                {/* 공지 */}
                                <i className={`ti ti-bell text-[12px] ${notices.length > 0 ? 'text-[#F59E0B]' : 'text-[#E2E8F0]'}`}/>
                              </div>
                            </div>
                            {/* 왼쪽 강조선: cardColor 있으면 그 색, 없으면 파트 색 (미완료 시) */}
                            {(cue.cardColor || hasPending) && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[8px]"
                                style={{background: cue.cardColor ?? part.color}}/>
                            )}
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

      {/* 분석결과 플로팅 패널 */}
      {simState === 'done' && (
        <SimResultPanel
          issues={simIssues}
          simFilter={simFilter}
          setSimFilter={setSimFilter}
          onClose={resetSim}
        />
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
              {(myMember?.role==='planner'||myMember?.role==='owner'||project?.ownerId===user?.uid) && (
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
              {parts.filter(p=>!p.isParticipant).length>0&&(
                <div className="text-[11px] font-bold text-[#185FA5] mb-1 flex items-center gap-1">
                  <i className="ti ti-users text-[10px]"/> 행사진행
                </div>
              )}
              {parts.filter(p=>!p.isParticipant).map(part=>(
                <button key={part.id} onClick={()=>setMyNewPartId(part.id)}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId===part.id||(!myNewPartId&&part.id===myMember?.partId)?'border-[#185FA5] bg-[#E6F1FB]':'border-[#E2E8F0]'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:part.color}}/>
                  <span className="text-[13px] font-semibold flex-1">{part.name}</span>
                  {(myNewPartId===part.id||(!myNewPartId&&part.id===myMember?.partId))&&<i className="ti ti-check text-[#185FA5] text-[16px]"/>}
                </button>
              ))}
              {parts.filter(p=>p.isParticipant).length>0&&(
                <div className="text-[11px] font-bold text-[#854F0B] mt-2 mb-1 flex items-center gap-1">
                  <i className="ti ti-run text-[10px]"/> 참가자
                </div>
              )}
              {parts.filter(p=>p.isParticipant).map(part=>(
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
      <BottomTabBar/>
      {showAddCue && projectId && (
        <AddCueModal
          onClose={()=>setShowAddCue(false)}
          onSave={addCue}
          partId={myMember?.partId ?? parts[0]?.id ?? ''}
          projectId={projectId}
          order={allCues.length}
          allParts={parts}
          isPlanner={(myMember?.role==='owner'||myMember?.role==='planner'||project?.ownerId===user?.uid)&&!(myMember?.partId)}
          currentPart={parts.find(p=>p.id===myMember?.partId)??null}
        />
      )}
      {activeCue && projectId && (
        <CueModal
          cue={activeCue}
          projectId={projectId}
          onClose={() => setActiveCue(null)}
          myPartName={myPartName}
          isReadOnly={(() => {
            if (!user) return true
            // 참가자 → 항상 읽기 전용
            if (myMember?.role === 'participant') return true
            // 기획자이면서 파트 미배정 → 모두 수정 가능
            const isPlannerRole = myMember?.role === 'planner' || myMember?.role === 'owner' || project?.ownerId === user.uid
            const hasPartAssigned = !!(myMember?.partId)
            if (isPlannerRole && !hasPartAssigned) return false
            // 기획자 파트 배정됨 or 스태프 → 내 파트만
            return activeCue.partId !== myMember?.partId && activeCue.partName !== myMember?.partName
          })()}
        />
      )}
    </div>
  )
}
