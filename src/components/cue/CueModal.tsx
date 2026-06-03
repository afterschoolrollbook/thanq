import { useEffect, useState, useRef } from 'react'
import { ref as dbRef, onValue, update, push, set, get } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { CueItem, CheckItem } from '@/types'

export interface CueWithPart extends CueItem {
  partName: string
  partColor: string
  partId: string
}

// ── 인라인 PTT ────────────────────────────────────────────
export function InlinePTT({ projectId, cue }: { projectId: string; cue: CueWithPart }) {
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
export function CueModal({ cue, projectId, onClose, isReadOnly = false, myPartName = '' }: {
  cue: CueWithPart; projectId: string; onClose: () => void; isReadOnly?: boolean; myPartName?: string
}) {
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [tab, setTab] = useState<'radio'|'check'|'memo'|'photo'>('check')
  const [newCheckTitle, setNewCheckTitle] = useState('')
  const [memo, setMemo] = useState(cue.memo ?? '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(cue.title)
  const [cardColor, setCardColor] = useState(cue.cardColor ?? '')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [savingMemo, setSavingMemo] = useState(false)
  const [editingCheckId, setEditingCheckId] = useState<string|null>(null)
  const [editingCheckTitle, setEditingCheckTitle] = useState('')
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<CheckItem | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<{url:string;name:string;uploadedAt:string}[]>(
    cue.photos ? Object.values(cue.photos) : []
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [partnersId, setPartnersId] = useState('')
  const COMPANY_PARTNERS_ID = 'thanqapp-20'

  // 프로젝트 오너의 파트너스 ID 로드
  useEffect(() => {
    get(dbRef(db, `projects/${projectId}/ownerId`)).then((snap) => {
      if (!snap.exists()) return
      const ownerId = snap.val()
      get(dbRef(db, `users/${ownerId}/partnersId`)).then((pSnap) => {
        setPartnersId(pSnap.exists() ? pSnap.val() : COMPANY_PARTNERS_ID)
      })
    })
  }, [projectId])

  function getCoupangLink(keyword: string) {
    const pid = partnersId || COMPANY_PARTNERS_ID
    const q = encodeURIComponent(keyword.replace(/(완료|준비|계량|체크|확인).*$/,'').trim())
    return `https://www.coupang.com/np/search?q=${q}&partnersCls=A&partnersTag=${pid}&subId=thanq`
  }

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

  async function writeCueAlert(changeType: 'new'|'edited'|'deleted', detail: string) {
    const r = push(dbRef(db, `cueAlerts/${projectId}`))
    await set(r, {
      id: r.key, projectId, partId: cue.partId, partName: cue.partName, partColor: cue.partColor,
      cueId: cue.id, cueTitle: cue.title, changeType, detail,
      isChecked: false, createdAt: new Date().toISOString()
    })
  }
    async function toggleCheck(item: CheckItem) {
    if (isReadOnly) { showReadOnlyToast(); return }
    const newDone = !item.isDone
    await update(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), { isDone: newDone })
    await writeCueAlert('edited', `체크리스트 ${newDone ? '완료' : '취소'}: "${item.title}" — "${cue.title}"`)
  }
  async function addCheck() {
    if (!newCheckTitle.trim()) return
    const r = push(dbRef(db, `checkItems/${projectId}/${cue.partId}`))
    await set(r, { id: r.key, partId: cue.partId, projectId, cueId: cue.id, category: 'prep', title: newCheckTitle.trim(), isDone: false, createdAt: new Date().toISOString() })
    setNewCheckTitle('')
  }
  function showReadOnlyToast() {
    setToast(cue.partName || '해당 팀')
  }

  async function updateCheckTitle(item: CheckItem, title: string) {
    if (isReadOnly) { showReadOnlyToast(); return }
    if (!title.trim()) { setEditingCheckId(null); return }
    await update(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}`), { title: title.trim() })
    await writeCueAlert('edited', `체크리스트 수정: "${item.title}" → "${title.trim()}" — "${cue.title}"`)
    setEditingCheckId(null)
  }

  async function deleteCheck(item: CheckItem) {
    if (isReadOnly) { showReadOnlyToast(); return }
    setConfirmDelete(item)
  }

  async function confirmDeleteCheck() {
    if (!confirmDelete) return
    await set(dbRef(db, `checkItems/${projectId}/${cue.partId}/${confirmDelete.id}`), null)
    await writeCueAlert('deleted', `체크리스트 삭제: "${confirmDelete.title}" — "${cue.title}"`)
    setConfirmDelete(null)
  }
    async function saveMemo() {
    if (isReadOnly) { showReadOnlyToast(); return }
    setSavingMemo(true)
    await update(dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}`), { memo, updatedAt: new Date().toISOString() })
    await writeCueAlert('edited', `메모 수정: "${cue.title}"`) 
    setSavingMemo(false)
  }
  async function saveTitle() {
    if (isReadOnly) { showReadOnlyToast(); return }
    if (!title.trim()) return
    await update(dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}`), { title: title.trim(), updatedAt: new Date().toISOString() })
    await writeCueAlert('edited', `제목 변경: "${cue.title}" → "${title.trim()}"`)
    setEditingTitle(false)
  }
  async function saveCardColor(color: string) {
    if (isReadOnly) { showReadOnlyToast(); return }
    setCardColor(color)
    setShowColorPicker(false)
    await update(dbRef(db, `cueItems/${projectId}/${cue.partId}/${cue.id}`), {
      cardColor: color || null,
      updatedAt: new Date().toISOString()
    })
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

  async function uploadCheckPhoto(file: File, item: CheckItem) {
    setUploading(true)
    try {
      const path = `projects/${projectId}/checks/${item.id}/${Date.now()}_${file.name}`
      const snap = await uploadBytes(storageRef(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      const r = push(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}/photos`))
      await set(r, { url, name: file.name, uploadedAt: new Date().toISOString() })
    } finally { setUploading(false) }
  }

  async function deleteCheckPhoto(item: CheckItem, photoKey: string) {
    await set(dbRef(db, `checkItems/${projectId}/${cue.partId}/${item.id}/photos/${photoKey}`), null)
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
              {/* 큐카드 색상 표시 + 변경 */}
              {!isReadOnly && (
                <div className="relative">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#E2E8F0] hover:border-[#185FA5] transition-colors"
                    title="큐카드 색상 변경">
                    <span className="w-3 h-3 rounded-full border border-white/30"
                      style={{background: cardColor || cue.partColor}}/>
                    <span className="text-[10px] text-[#64748B]">색상</span>
                    <i className="ti ti-chevron-down text-[10px] text-[#A0AEC0]"/>
                  </button>
                  {showColorPicker && (
                    <div className="absolute left-0 top-7 z-10 bg-white rounded-[14px] shadow-xl border border-[#E2E8F0] p-3 w-[220px]">
                      <div className="text-[11px] font-semibold text-[#64748B] mb-2">큐카드 색상</div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { color: '', label: '기본 (파트색)' },
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
                          <button key={label} onClick={() => saveCardColor(color)} title={label}
                            className={`relative flex items-center justify-center transition-all ${
                              color === ''
                                ? `w-auto px-2.5 h-7 rounded-full border-2 text-[10px] font-semibold ${!cardColor ? 'border-[#185FA5] bg-[#E6F1FB] text-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#185FA5]'}`
                                : `w-7 h-7 rounded-full border-2 ${cardColor === color ? 'border-[#1A1A2E] scale-110 shadow-md' : 'border-transparent hover:scale-105'}`
                            }`}
                            style={color ? {background: color} : {}}>
                            {color === '' && '기본'}
                            {cardColor === color && color !== '' && <i className="ti ti-check text-white text-[11px]"/>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
              <textarea className="flex-1 text-[15px] font-bold border-b-2 border-[#185FA5] outline-none pb-0.5 resize-none bg-transparent"
                value={title} onChange={e=>setTitle(e.target.value)} rows={3}
                onKeyDown={e=>{ if(e.key==='Enter'&&e.shiftKey){ return } if(e.key==='Enter'){e.preventDefault();saveTitle()} if(e.key==='Escape') setEditingTitle(false) }}
                autoFocus/>
              <button onClick={saveTitle} className="text-[#185FA5] text-[12px] font-semibold">저장</button>
              <button onClick={()=>setEditingTitle(false)} className="text-[#A0AEC0] text-[12px]">취소</button>
            </div>
          ) : (
            <div className="flex items-start gap-2 group cursor-pointer" onClick={()=>{ if(isReadOnly){showReadOnlyToast();return} setEditingTitle(true)}}>
              <div className="text-[15px] font-bold text-[#1A1A2E] whitespace-pre-wrap flex-1">{title}</div>
              <i className="ti ti-pencil text-[#A0AEC0] text-[13px] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0"/>
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
              <div className="flex flex-col gap-2">
              {checks.length === 0 && (
                <div className="text-center py-6 text-[#A0AEC0]">
                  <i className="ti ti-checklist text-[32px] block mb-2 opacity-30"/>
                  <p className="text-[12px]">체크리스트를 추가해보세요</p>
                </div>
              )}
              {checks.map(item=>{
                const checkPhotos = item.photos ? Object.entries(item.photos) : []
                const checkPhotoInputId = `check-photo-${item.id}`
                return (
                <div key={item.id} className={`flex flex-col rounded-[10px] border ${item.isDone?'border-[#E2E8F0] bg-[#F8FBF8]':'border-[#E2E8F0] bg-white'}`}>
                  {/* 체크항목 행 */}
                  <div className="flex items-center gap-3 p-3">
                    <button onClick={()=>toggleCheck(item)}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${item.isDone?'bg-[#3B6D11] border-[#3B6D11]':'border-[#E2E8F0] hover:border-[#185FA5]'}`}>
                      {item.isDone&&<i className="ti ti-check text-white text-[11px]"/>}
                    </button>
                    {editingCheckId === item.id ? (
                      <textarea
                        className="flex-1 text-[13px] border-b border-[#185FA5] outline-none bg-transparent resize-none"
                        value={editingCheckTitle} autoFocus rows={2}
                        onChange={e=>setEditingCheckTitle(e.target.value)}
                        onBlur={()=>updateCheckTitle(item, editingCheckTitle)}
                        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();updateCheckTitle(item,editingCheckTitle)}if(e.key==='Escape')setEditingCheckId(null)}}
                      />
                    ) : (
                      <span className={`text-[13px] flex-1 whitespace-pre-wrap ${item.isDone?'line-through text-[#A0AEC0]':'text-[#1A1A2E]'}`}
                        onDoubleClick={()=>{if(!isReadOnly){setEditingCheckId(item.id);setEditingCheckTitle(item.title)}}}>
                        {item.title}
                      </span>
                    )}
                    {/* 재료 카테고리면 재료 구매 버튼 */}
                    {(item.category === 'prep' || item.category === 'setup') && (
                      <a href={getCoupangLink(item.title)} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[#A0AEC0] hover:text-[#E24B4A] transition-colors"
                        title="재료 구매 (쿠팡)">
                        <i className="ti ti-shopping-cart text-[15px]"/>
                      </a>
                    )}
                    {/* 사진 추가 버튼 */}
                    {!isReadOnly && (
                      <label htmlFor={checkPhotoInputId} className="cursor-pointer text-[#E2E8F0] hover:text-[#185FA5]">
                        <i className="ti ti-camera text-[13px]"/>
                      </label>
                    )}
                    <input id={checkPhotoInputId} type="file" accept="image/*" className="hidden"
                      onChange={async e=>{ if(e.target.files?.[0]) await uploadCheckPhoto(e.target.files[0], item) }}/>
                    <button onClick={()=>{if(isReadOnly){showReadOnlyToast();return}setEditingCheckId(item.id);setEditingCheckTitle(item.title)}}
                      className="text-[#E2E8F0] hover:text-[#185FA5]">
                      <i className="ti ti-pencil text-[13px]"/>
                    </button>
                    <button onClick={()=>deleteCheck(item)} className="text-[#E2E8F0] hover:text-[#E24B4A]">
                      <i className="ti ti-trash text-[14px]"/>
                    </button>
                  </div>
                  {/* 사진 영역 (사진 있을 때만) */}
                  {checkPhotos.length > 0 && (
                    <div className="flex gap-2 px-3 pb-3 flex-wrap">
                      {checkPhotos.map(([key, p])=>(
                        <div key={key} className="relative w-[72px] h-[72px] rounded-[6px] overflow-hidden border border-[#E2E8F0] group">
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover"/>
                          {!isReadOnly && (
                            <button onClick={()=>deleteCheckPhoto(item, key)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/50 rounded-full hidden group-hover:flex items-center justify-center">
                              <i className="ti ti-x text-white text-[9px]"/>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )
              })}
              </div>
            </div>
          )}

          {/* 메모 탭 */}
          {tab === 'memo' && (
            <div className="flex flex-col gap-3">
              <textarea
                className="w-full h-[180px] border border-[#E2E8F0] rounded-[10px] p-3 text-[13px] text-[#1A1A2E] resize-none focus:outline-none focus:border-[#185FA5]"
                placeholder="메모를 입력하세요..."
                value={memo}
                readOnly={isReadOnly}
                onChange={e => setMemo(e.target.value)}
                onClick={() => { if (isReadOnly) showReadOnlyToast() }}
              />
              {!isReadOnly && (
                <button onClick={saveMemo} disabled={savingMemo}
                  className="h-[40px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-40">
                  {savingMemo ? '저장 중...' : '저장'}
                </button>
              )}
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

        {/* 삭제 확인 모달 */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center px-6">
            <div className="bg-white rounded-[20px] p-6 w-full max-w-sm flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
                <i className="ti ti-trash text-[#DC2626] text-[32px]"/>
              </div>
              <div>
                <div className="text-[17px] font-bold text-[#1A1A2E] mb-1">정말 삭제할까요?</div>
                <div className="text-[13px] text-[#64748B]">
                  <span className="font-bold text-[#1A1A2E]">{confirmDelete.title}</span> 항목이 삭제됩니다.
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 h-[44px] border border-[#E2E8F0] text-[#64748B] rounded-[12px] text-[14px] font-semibold">
                  취소
                </button>
                <button onClick={confirmDeleteCheck}
                  className="flex-1 h-[44px] bg-[#DC2626] text-white rounded-[12px] text-[14px] font-semibold">
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 읽기전용 경고 모달 */}
        {toast && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center px-6">
            <div className="bg-white rounded-[20px] p-6 w-full max-w-sm flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
                <i className="ti ti-lock text-[#DC2626] text-[32px]"/>
              </div>
              <div>
                {myPartName && (
                  <div className="text-[13px] text-[#64748B] mb-1">
                    <span className="font-bold text-[#1A1A2E]">{myPartName}</span> 팀이십니다.
                  </div>
                )}
                <div className="text-[17px] font-bold text-[#1A1A2E] mb-1">수정 권한이 없어요</div>
                <div className="text-[13px] text-[#64748B]">
                  <span className="font-bold text-[#1A1A2E]">{cue.partName}</span> 팀에 문의해 주시길 바랍니다.
                </div>
              </div>
              <button onClick={() => setToast('')}
                className="w-full h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-semibold">
                확인
              </button>
            </div>
          </div>
        )}

        {/* 하단 입력 (체크리스트 탭만) */}
        {tab === 'check' && !isReadOnly && (
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
