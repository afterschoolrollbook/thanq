import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ref as dbRef, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes, minutesToTime } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Part, CueItem, CheckItem, Project, Notice } from '@/types'
import { CueModal, type CueWithPart } from '@/components/cue/CueModal'
import { useAuthStore } from '@/store/authStore'


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
  const [myMember, setMyMember] = useState<{role: string; partId?: string} | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [allChecks, setAllChecks] = useState<CheckItem[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showCalendar, setShowCalendar] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [activeCue, setActiveCue] = useState<CueWithPart | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const calendarRef = useRef<HTMLDivElement>(null)

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
          onValue(dbRef(db, `projectMembers/${projectId}/${user.uid}`), (ms) => {
            if (ms.exists()) setMyMember(ms.val())
          }, { onlyOnce: true })
        }
      }
    }, { onlyOnce: true })
  }, [projectId])

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
        // 행사진행 먼저, 참가자 나중
        if (!!a.isParticipant !== !!b.isParticipant) return a.isParticipant ? 1 : -1
        return a.order - b.order
      })
      setParts(list)
      const cueMap: CueWithPart[] = [], checkMap: CheckItem[] = []
      let lc = 0, lck = 0
      list.forEach(part => {
        onValue(dbRef(db, `cueItems/${projectId}/${part.id}`), cs => {
          lc++
          if (cs.exists()) Object.values(cs.val() as CueItem[]).forEach((i:CueItem) => cueMap.push({...i, partName:part.name, partColor:part.color, partId:part.id}))
          if (lc === list.length) { cueMap.sort((a,b) => timeToMinutes(a.startTime)-timeToMinutes(b.startTime)); setAllCues([...cueMap]) }
        })
        onValue(dbRef(db, `checkItems/${projectId}/${part.id}`), cs => {
          lck++
          if (cs.exists()) Object.values(cs.val() as CheckItem[]).forEach((i:CheckItem) => checkMap.push(i))
          if (lck === list.length) setAllChecks([...checkMap])
        })
      })
    })
  }, [projectId])

  // 핀치줌
  const lpd = useRef<number|null>(null), lz = useRef(1)
  function onTS(e:React.TouchEvent) { if(e.touches.length===2){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;lpd.current=Math.hypot(dx,dy);lz.current=zoom} }
  function onTM(e:React.TouchEvent) { if(e.touches.length===2&&lpd.current){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;setZoom(Math.min(2,Math.max(0.5,lz.current*(Math.hypot(dx,dy)/lpd.current))))} }
  function onTE() { lpd.current=null }

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
          <div className="max-w-2xl mx-auto px-5">
            <div className="flex items-center justify-between mb-3">
              <div className="relative" ref={calendarRef}>
                <button onClick={()=>setShowCalendar(v=>!v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-[#F4F6F9]">
                  <i className="ti ti-calendar text-[#185FA5] text-[14px]"/>
                  <span className="text-[13px] font-semibold">{selectedDate}</span>
                  <i className={`ti ti-chevron-${showCalendar?'up':'down'} text-[#A0AEC0] text-[11px]`}/>
                </button>
                {showCalendar && <MiniCalendar selectedDate={selectedDate} onChange={setSelectedDate} eventDates={eventDates} prepDates={prepDates} onClose={()=>setShowCalendar(false)}/>}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={()=>setZoom(z=>Math.max(0.5,+(z-0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-minus text-[13px]"/></button>
                <span className="text-[11px] text-[#A0AEC0] w-9 text-center">{Math.round(zoom*100)}%</span>
                <button onClick={()=>setZoom(z=>Math.min(2,+(z+0.15).toFixed(2)))} className="w-7 h-7 rounded-full border border-[#E2E8F0] bg-white flex items-center justify-center text-[#64748B] hover:bg-[#F4F6F9]"><i className="ti ti-plus text-[13px]"/></button>
                <button onClick={()=>setZoom(1)} className="h-7 px-2 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#64748B] hover:bg-[#F4F6F9] ml-1">초기화</button>
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
            <div style={{minWidth: totalGridW, width: totalGridW}}>

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
                            style={{position:'absolute',top:slotTop+PAD/2+idx*CUE_H,height:CUE_H-4,left:3,right:3}}
                            className="rounded-[8px] border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between px-2 py-1.5 overflow-hidden cursor-pointer hover:border-[#185FA5] hover:shadow-md transition-all">
                            <div>
                              <div className="font-bold leading-tight text-[#1A1A2E] truncate" style={{fontSize:Math.max(9,Math.round(11*zoom))+'px'}}>{cue.title}</div>
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
                            {/* 미완료 체크 있으면 왼쪽 테두리 강조 */}
                            {hasPending && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-[8px]" style={{background:part.color}}/>}
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

      <BottomTabBar/>
      {activeCue && projectId && (
        <CueModal
          cue={activeCue}
          projectId={projectId}
          onClose={() => setActiveCue(null)}
          isReadOnly={(() => {
            if (!user) return true
            // 참가자 → 항상 읽기 전용
            if (myMember?.role === 'participant') return true
            // 기획자이면서 파트 미배정 → 모두 수정 가능
            const isPlannerRole = myMember?.role === 'planner' || myMember?.role === 'owner' || project?.ownerId === user.uid
            const hasPartAssigned = !!(myMember?.partId)
            if (isPlannerRole && !hasPartAssigned) return false
            // 기획자 파트 배정됨 or 스태프 → 내 파트만
            return activeCue.partId !== myMember?.partId
          })()}
        />
      )}
    </div>
  )
}
