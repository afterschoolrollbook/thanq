import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ref as dbRef, onValue, update, push, set } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { timeToMinutes, minutesToTime } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import { useAuthStore } from '@/store/authStore'
import type { Part, CueItem, CheckItem, Project, Notice } from '@/types'

interface CueWithPart extends CueItem { partName: string; partColor: string; partId: string }

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

// ── 인라인 PTT ────────────────────────────────────────────
function InlinePTT({ projectId, cue }: { projectId: string; cue: CueWithPart }) {
  const user = useAuthStore((s) => s.user)
  const [pressing, setPressing] = useState(false)
  const [micPermission, setMicPermission] = useState<'unknown'|'granted'|'denied'>('unknown')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    async function check() {
      try {
        if (navigator.permissions) {
          const r = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          setMicPermission(r.state as 'unknown'|'granted'|'denied')
          r.onchange = () => setMicPermission(r.state as 'unknown'|'granted'|'denied')
        } else {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true })
          s.getTracks().forEach(t => t.stop()); setMicPermission('granted')
        }
      } catch { setMicPermission('denied') }
    }
    check()
  }, [])

  async function requestMic() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach(t => t.stop()); setMicPermission('granted')
    } catch { setMicPermission('denied') }
  }

  async function startPTT() {
    if (micPermission !== 'granted' || !user) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mr = new MediaRecorder(stream)
      mr.start(); mediaRef.current = mr; startRef.current = Date.now(); setPressing(true)
    } catch { setMicPermission('denied') }
  }

  async function stopPTT() {
    if (!mediaRef.current || !user) return
    setPressing(false)
    const duration = Math.round((Date.now() - startRef.current) / 1000)
    mediaRef.current.stop(); mediaRef.current.stream.getTracks().forEach(t => t.stop())
    const r = push(dbRef(db, `pttHistory/${projectId}`))
    await set(r, {
      id: r.key, senderName: user.displayName ?? '익명', senderColor: '#185FA5',
      target: cue.partId, targetLabel: cue.partName, duration,
      createdAt: new Date().toISOString()
    })
  }

  const targetName = cue.assigneeName || cue.assignee || cue.partName

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* 수신 대상 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#F4F6F9] rounded-full">
        <span className="w-3 h-3 rounded-full" style={{background: cue.partColor}}/>
        <span className="text-[12px] font-semibold text-[#1A1A2E]">{targetName}</span>
        <span className="text-[11px] text-[#A0AEC0]">수신</span>
      </div>

      {/* 마이크 권한 없을 때 */}
      {micPermission !== 'granted' && (
        <div className={`w-full flex items-center gap-3 p-3 rounded-[12px] ${micPermission==='denied'?'bg-[#FCEBEB]':'bg-[#F4F6F9]'}`}>
          <i className={`ti ${micPermission==='denied'?'ti-microphone-off text-[#A32D2D]':'ti-microphone text-[#64748B]'} text-[20px]`}/>
          <div className="flex-1">
            <div className="text-[12px] font-semibold">{micPermission==='denied'?'마이크가 차단됐어요':'마이크 권한이 필요해요'}</div>
          </div>
          {micPermission !== 'denied' && (
            <button onClick={requestMic} className="px-3 py-1.5 bg-[#185FA5] text-white rounded-[8px] text-[11px] font-semibold">허용</button>
          )}
        </div>
      )}

      {/* PTT 버튼 */}
      <button
        onPointerDown={startPTT} onPointerUp={stopPTT} onPointerLeave={stopPTT}
        disabled={micPermission !== 'granted'}
        className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-2 transition-all select-none touch-none
          ${micPermission!=='granted' ? 'opacity-40 cursor-not-allowed bg-[#A0AEC0]' :
            pressing ? 'bg-[#E24B4A] shadow-[0_0_0_20px_rgba(226,75,74,0.2)]' :
            'shadow-[0_0_0_16px_#E6F1FB]'}`}
        style={micPermission==='granted' && !pressing ? {background: cue.partColor} : undefined}>
        <i className={`ti ti-microphone text-[32px] text-white ${pressing?'animate-pulse':''}`}/>
        <span className="text-white text-[11px] font-semibold">{pressing?'전송 중':'누르고 말하기'}</span>
      </button>

      <p className="text-[11px] text-[#A0AEC0]">손 떼면 자동 전송돼요</p>
    </div>
  )
}

// ── 큐 상세 모달 ──────────────────────────────────────────
function CueModal({ cue, projectId, onClose }: {
  cue: CueWithPart; projectId: string; onClose: () => void
}) {
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [tab, setTab] = useState<'radio'|'check'|'memo'|'photo'>('check')
  const [newCheckTitle, setNewCheckTitle] = useState('')
  const [editingCheckId, setEditingCheckId] = useState<string|null>(null)
  const [editingCheckTitle, setEditingCheckTitle] = useState('')
  const [memo, setMemo] = useState(cue.memo ?? '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(cue.title)
  const [savingMemo, setSavingMemo] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<{url:string;name:string;uploadedAt:string}[]>(
    cue.photos ? Object.values(cue.photos) : []
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 체크리스트 실시간
  useEffect(() => {
    const r = dbRef(db, `checkItems/${projectId}/${cue.partId}`)
    return onValue(r, (s) => {
      if (s.exists()) {
        const all: CheckItem[] = Object.values(s.val())
        setChecks(all.filter(c => c.cueId === cue.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt)))
      } else setChecks([])
    })
  }, [projectId, cue.partId, cue.id])

  // 사진 실시간
  useEffect(() => {
    const r = dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}/photos`)
    return onValue(r, (s) => {
      if (s.exists()) setPhotos(Object.values(s.val()))
      else setPhotos([])
    })
  }, [projectId, cue.partId, cue.id])

  async function toggleCheck(item: CheckItem) {
    await update(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), { isDone: !item.isDone })
  }
  async function addCheck() {
    if (!newCheckTitle.trim()) return
    const r = push(dbRef(db, `checkItems/${projectId}/${cue.partId}`))
    await set(r, { id: r.key, partId: cue.partId, projectId, cueId: cue.id, category: 'prep', title: newCheckTitle.trim(), isDone: false, createdAt: new Date().toISOString() })
    setNewCheckTitle('')
  }
  async function deleteCheck(item: CheckItem) {
    await set(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), null)
  }
  async function updateCheckTitle(item: CheckItem, title: string) {
    if (!title.trim()) return
    await update(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), { title: title.trim() })
    setEditingCheckId(null)
  }
  async function saveMemo() {
    setSavingMemo(true)
    await update(dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}`), { memo, updatedAt: new Date().toISOString() })
    setSavingMemo(false)
  }
  async function saveTitle() {
    if (!title.trim()) return
    await update(dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}`), { title: title.trim(), updatedAt: new Date().toISOString() })
    setEditingTitle(false)
  }
  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const path = `projects/${projectId}/cues/${cue.id}/${Date.now()}_${file.name}`
      const snap = await uploadBytes(storageRef(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      const r = push(dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}/photos`))
      await set(r, { url, name: file.name, uploadedAt: new Date().toISOString() })
    } finally { setUploading(false) }
  }

  const doneCount = checks.filter(c => c.isDone).length
  const allDone = checks.length > 0 && doneCount === checks.length
  const assignee = cue.assigneeName || cue.assignee || cue.partName

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-[20px] sm:rounded-[20px] flex flex-col max-h-[85vh]" onClick={e=>e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:cue.partColor}}/>
              <span className="text-[11px] text-[#64748B]">{cue.partName}</span>
              <span className="text-[11px] text-[#A0AEC0]">{cue.startTime} · {cue.durationMin}분</span>
              <span className="text-[11px] bg-[#F4F6F9] text-[#64748B] px-2 py-0.5 rounded-full flex items-center gap-1">
                <i className="ti ti-user text-[10px]"/>{assignee}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* 무전 버튼 */}
              <button onClick={()=>setTab('radio')}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#185FA5] text-white rounded-full text-[11px] font-semibold hover:bg-[#0C447C]">
                <i className="ti ti-antenna text-[12px]"/>무전
              </button>
              <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
            </div>
          </div>

          {/* 제목 편집 */}
          {editingTitle ? (
            <div className="flex gap-2">
              <input className="flex-1 text-[15px] font-bold border-b-2 border-[#185FA5] outline-none pb-0.5"
                value={title} onChange={e=>setTitle(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') saveTitle(); if(e.key==='Escape') setEditingTitle(false) }}
                autoFocus/>
              <button onClick={saveTitle} className="text-[#185FA5] text-[12px] font-semibold">저장</button>
              <button onClick={()=>setEditingTitle(false)} className="text-[#A0AEC0] text-[12px]">취소</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={()=>setEditingTitle(true)}>
              <div className="text-[15px] font-bold text-[#1A1A2E]">{title}</div>
              <i className="ti ti-pencil text-[#A0AEC0] text-[13px] opacity-0 group-hover:opacity-100 transition-opacity"/>
            </div>
          )}

          {/* 체크 진행률 */}
          {checks.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#64748B]">체크리스트 {doneCount}/{checks.length}</span>
                {allDone && <span className="text-[10px] font-bold text-[#3B6D11]">✓ 완료!</span>}
              </div>
              <div className="w-full h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{width:`${(doneCount/checks.length)*100}%`,background:allDone?'#3B6D11':'#185FA5'}}/>
              </div>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="flex border-b border-[#F1F5F9] px-5">
          {([['radio','무전',''],['check','체크리스트',`${checks.filter(c=>!c.isDone).length > 0 ? checks.filter(c=>!c.isDone).length+'개 남음' : checks.length > 0 ? '완료' : ''}`],['memo','메모',''],['photo','사진',`${photos.length > 0 ? photos.length+'장' : ''}`]] as [string,string,string][]).map(([t,label,badge])=>(
            <button key={t} onClick={()=>setTab(t as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${tab===t?'border-[#185FA5] text-[#185FA5]':'border-transparent text-[#A0AEC0]'}`}>
              {label}
              {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab===t?'bg-[#E6F1FB] text-[#185FA5]':'bg-[#F4F6F9] text-[#A0AEC0]'}`}>{badge}</span>}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* 체크리스트 탭 */}
          {tab === 'check' && (
            <div className="flex flex-col gap-2">
              {checks.length === 0 && (
                <div className="text-center py-6 text-[#A0AEC0]">
                  <i className="ti ti-checklist text-[32px] block mb-2 opacity-30"/>
                  <p className="text-[12px]">체크리스트를 추가해보세요</p>
                </div>
              )}
              {checks.map(item=>(
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-[10px] border ${item.isDone?'border-[#E2E8F0] bg-[#F8FBF8]':'border-[#E2E8F0] bg-white'}`}>
                  <button onClick={()=>toggleCheck(item)}
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${item.isDone?'bg-[#3B6D11] border-[#3B6D11]':'border-[#E2E8F0] hover:border-[#185FA5]'}`}>
                    {item.isDone&&<i className="ti ti-check text-white text-[11px]"/>}
                  </button>
                  {editingCheckId === item.id ? (
                    <input
                      className="flex-1 text-[13px] border-b border-[#185FA5] outline-none bg-transparent"
                      value={editingCheckTitle}
                      autoFocus
                      onChange={e=>setEditingCheckTitle(e.target.value)}
                      onBlur={()=>updateCheckTitle(item, editingCheckTitle)}
                      onKeyDown={e=>{if(e.key==='Enter')updateCheckTitle(item,editingCheckTitle);if(e.key==='Escape')setEditingCheckId(null)}}
                    />
                  ) : (
                    <span
                      className={`text-[13px] flex-1 ${item.isDone?'line-through text-[#A0AEC0]':'text-[#1A1A2E]'}`}
                      onDoubleClick={()=>{setEditingCheckId(item.id);setEditingCheckTitle(item.title)}}>
                      {item.title}
                    </span>
                  )}
                  <button onClick={()=>{setEditingCheckId(item.id);setEditingCheckTitle(item.title)}} className="text-[#E2E8F0] hover:text-[#185FA5]">
                    <i className="ti ti-pencil text-[13px]"/>
                  </button>
                  <button onClick={()=>deleteCheck(item)} className="text-[#E2E8F0] hover:text-[#E24B4A]">
                    <i className="ti ti-trash text-[14px]"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 메모 탭 */}
          {tab === 'memo' && (
            <div className="flex flex-col gap-3">
              <textarea
                className="w-full h-[180px] border border-[#E2E8F0] rounded-[10px] p-3 text-[13px] text-[#1A1A2E] resize-none focus:outline-none focus:border-[#185FA5]"
                placeholder="메모를 입력하세요..."
                value={memo}
                onChange={e=>setMemo(e.target.value)}
              />
              <button onClick={saveMemo} disabled={savingMemo}
                className="h-[40px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-40">
                {savingMemo ? '저장 중...' : '저장'}
              </button>
            </div>
          )}

          {/* 무전 탭 */}
          {tab === 'radio' && (
            <InlinePTT projectId={projectId} cue={cue}/>
          )}

          {/* 사진 탭 */}
          {tab === 'photo' && (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async e=>{ if(e.target.files) for(const f of Array.from(e.target.files)) await uploadPhoto(f) }}/>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photos.map((p,i)=>(
                  <div key={i} className="aspect-square rounded-[8px] overflow-hidden border border-[#E2E8F0]">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover"/>
                  </div>
                ))}
                <button onClick={()=>fileInputRef.current?.click()}
                  className="aspect-square rounded-[8px] border-2 border-dashed border-[#E2E8F0] flex flex-col items-center justify-center gap-1 hover:border-[#185FA5] hover:bg-[#F4F6F9] transition-colors">
                  {uploading
                    ? <i className="ti ti-loader-2 animate-spin text-[#185FA5] text-[20px]"/>
                    : <><i className="ti ti-camera-plus text-[#A0AEC0] text-[20px]"/><span className="text-[10px] text-[#A0AEC0]">추가</span></>
                  }
                </button>
              </div>
              <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
                className="w-full h-[40px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-2 text-[12px] text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] disabled:opacity-40">
                <i className="ti ti-upload text-[14px]"/>파일 / 사진 업로드
              </button>
            </div>
          )}
        </div>

        {/* 하단 입력 (체크리스트 탭만) */}
        {tab === 'check' && (
          <div className="px-5 pb-6 pt-3 border-t border-[#F1F5F9] flex gap-2">
            <input
              className="flex-1 h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]"
              placeholder="체크리스트 항목 추가..."
              value={newCheckTitle}
              onChange={e=>setNewCheckTitle(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addCheck()}
            />
            <button onClick={addCheck} disabled={!newCheckTitle.trim()}
              className="h-[40px] px-4 bg-[#185FA5] text-white rounded-[10px] disabled:opacity-40">
              <i className="ti ti-plus text-[14px]"/>
            </button>
          </div>
        )}
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
      if (s.exists()) { const p = s.val() as Project; setProject(p); setSelectedDate(p.date ?? new Date().toISOString().split('T')[0]) }
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
        <CueModal cue={activeCue} projectId={projectId} onClose={() => setActiveCue(null)}/>
      )}
    </div>
  )
}
