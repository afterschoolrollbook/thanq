import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Part, Project } from '@/types'

interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; targetLabel: string; duration: number; createdAt: string }
type MicPermission = 'unknown' | 'granted' | 'denied' | 'prompt'
type TargetId = 'crew-all' | 'owner' | string
type AliasMap = Record<string, string>
type ShortcutMap = Record<string, number>

interface TargetItem {
  id: TargetId; label: string; sublabel: string
  icon?: string; color?: string; tier: 'owner' | 'manager' | 'all'
}

export default function PTTPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [target, setTarget] = useState<TargetId>('crew-all')
  const [history, setHistory] = useState<PTTRecord[]>([])
  const [pressing, setPressing] = useState(false)
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown')
  const [requestingMic, setRequestingMic] = useState(false)
  const [showMicModal, setShowMicModal] = useState(false)
  const [favorites, setFavorites] = useState<TargetId[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ owner: true, manager: true, all: true })
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [shortcutMap, setShortcutMap] = useState<ShortcutMap>({})
  const [aliasMap, setAliasMap] = useState<AliasMap>({})
  // 모달 상태
  const [shortcutModalTarget, setShortcutModalTarget] = useState<TargetItem | null>(null)
  const [shortcutInput, setShortcutInput] = useState('')
  const [shortcutError, setShortcutError] = useState('')
  const [detailTarget, setDetailTarget] = useState<TargetItem | null>(null)
  const [aliasInput, setAliasInput] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), (s) => { if (s.exists()) setProject(s.val()) })
    onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) { const l: Part[] = Object.values(s.val()); l.sort((a, b) => a.order - b.order); setParts(l) }
    })
    onValue(ref(db, `pttHistory/${projectId}`), (s) => {
      if (s.exists()) {
        const l: PTTRecord[] = Object.values(s.val())
        l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setHistory(l.slice(0, 30))
      }
    })
    checkMicPermission()
    if (!user) return
    onValue(ref(db, `pttFavorites/${projectId}/${user.uid}`), (s) => { if (s.exists()) setFavorites(s.val() ?? []) })
    onValue(ref(db, `pttShortcuts/${projectId}/${user.uid}`), (s) => { if (s.exists()) setShortcutMap(s.val() ?? {}) })
    onValue(ref(db, `pttAliases/${projectId}/${user.uid}`), (s) => { if (s.exists()) setAliasMap(s.val() ?? {}) })
  }, [projectId, user])

  async function checkMicPermission() {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setMicPermission(result.state as MicPermission)
        result.onchange = () => setMicPermission(result.state as MicPermission)
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop()); setMicPermission('granted')
      }
    } catch { setMicPermission('denied') }
  }

  async function requestMicPermission() {
    setRequestingMic(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop()); setMicPermission('granted'); setShowMicModal(false)
      await loadAudioDevices()
    } catch { setMicPermission('denied') } finally { setRequestingMic(false) }
  }

  async function loadAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((d) => d.kind === 'audioinput')
      setAudioDevices(inputs)
      if (!selectedDeviceId && inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (micPermission !== 'granted') return
    loadAudioDevices()
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices)
  }, [micPermission])

  async function startPTT() {
    if (micPermission !== 'granted' || !user) return
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(); mediaRef.current = mr; startRef.current = Date.now(); setPressing(true)
    } catch { setMicPermission('denied') }
  }

  async function stopPTT() {
    if (!mediaRef.current || !user || !projectId) return
    setPressing(false)
    const duration = Math.round((Date.now() - startRef.current) / 1000)
    mediaRef.current.stop(); mediaRef.current.stream.getTracks().forEach((t) => t.stop())
    const sel = targetItems.find((t) => t.id === target)
    const r = push(ref(db, `pttHistory/${projectId}`))
    await set(r, { id: r.key!, senderName: user.displayName, senderColor: '#185FA5', target, targetLabel: getDisplayName(sel), duration, createdAt: new Date().toISOString() } as PTTRecord)
  }

  // ─── 별칭 표시 이름 ───────────────────────────────────────
  function getDisplayName(item?: TargetItem): string {
    if (!item) return ''
    return aliasMap[item.id] || item.label
  }

  // ─── 별칭 저장 ────────────────────────────────────────────
  async function saveAlias(itemId: string, alias: string) {
    if (!user || !projectId) return
    const next = { ...aliasMap }
    if (alias.trim()) next[itemId] = alias.trim()
    else delete next[itemId]
    setAliasMap(next)
    await set(ref(db, `pttAliases/${projectId}/${user.uid}`), next)
  }

  function toggleFavorite(id: TargetId) {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]
    setFavorites(next)
    if (user && projectId) set(ref(db, `pttFavorites/${projectId}/${user.uid}`), next)
  }

  function toggleGroup(tier: string) { setOpenGroups((prev) => ({ ...prev, [tier]: !prev[tier] })) }

  function openShortcutModal(item: TargetItem) {
    setShortcutModalTarget(item); setShortcutInput(shortcutMap[item.id] ? String(shortcutMap[item.id]) : ''); setShortcutError('')
  }

  function saveShortcut() {
    if (!shortcutModalTarget) return
    const num = parseInt(shortcutInput)
    if (!shortcutInput) {
      const next = { ...shortcutMap }; delete next[shortcutModalTarget.id]
      setShortcutMap(next)
      if (user && projectId) set(ref(db, `pttShortcuts/${projectId}/${user.uid}`), next)
      setShortcutModalTarget(null); return
    }
    if (isNaN(num) || num < 1 || num > 20) { setShortcutError('1~20 사이의 숫자를 입력해주세요'); return }
    const conflict = Object.entries(shortcutMap).find(([id, n]) => n === num && id !== shortcutModalTarget.id)
    if (conflict) {
      const ci = targetItems.find((t) => t.id === conflict[0])
      setShortcutError(`${num}번은 이미 "${getDisplayName(ci)}"에 지정되어 있어요`); return
    }
    const next = { ...shortcutMap, [shortcutModalTarget.id]: num }
    setShortcutMap(next)
    if (user && projectId) set(ref(db, `pttShortcuts/${projectId}/${user.uid}`), next)
    setShortcutModalTarget(null)
  }

  function removeShortcut(id: TargetId) {
    const next = { ...shortcutMap }; delete next[id]
    setShortcutMap(next)
    if (user && projectId) set(ref(db, `pttShortcuts/${projectId}/${user.uid}`), next)
  }

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1) return '방금'; if (m < 60) return `${m}분 전`
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`; return `${Math.floor(m / 1440)}일 전`
  }

  const targetItems: TargetItem[] = [
    { id: 'owner', label: '총책임자', sublabel: project?.name ?? '프로젝트 오너', icon: 'ti-crown', color: '#854F0B', tier: 'owner' },
    ...parts.map((p): TargetItem => ({ id: p.id, label: p.managerName ?? `${p.name} 책임자`, sublabel: p.name, color: p.color, tier: 'manager' })),
    { id: 'crew-all', label: '크루 전체', sublabel: '모든 멤버', icon: 'ti-users', color: '#185FA5', tier: 'all' },
  ]

  const selectedTarget = targetItems.find((t) => t.id === target)
  const favoriteItems = targetItems.filter((t) => favorites.includes(t.id))
  const selectedDevice = audioDevices.find((d) => d.deviceId === selectedDeviceId)
  const isBluetooth = (selectedDevice?.label ?? '').toLowerCase().includes('bluetooth')
  const shortcutItems = Object.entries(shortcutMap).sort(([, a], [, b]) => a - b)
    .map(([id, num]) => ({ item: targetItems.find((t) => t.id === id), num }))
    .filter((s) => s.item !== undefined) as { item: TargetItem; num: number }[]

  const groups: { tier: TargetItem['tier']; label: string; badgeBg: string; badgeColor: string }[] = [
    { tier: 'owner',   label: '총책임자',   badgeBg: '#FAEEDA', badgeColor: '#854F0B' },
    { tier: 'manager', label: '파트 책임자', badgeBg: '#F4F6F9', badgeColor: '#64748B' },
    { tier: 'all',     label: '크루 전체',   badgeBg: '#E6F1FB', badgeColor: '#185FA5' },
  ]

  // ─── 대상 카드 ────────────────────────────────────────────
  function TargetCard({ item, compact = false }: { item: TargetItem; compact?: boolean }) {
    const isSelected = target === item.id
    const isFav = favorites.includes(item.id)
    const shortcutNum = shortcutMap[item.id]
    const hasAlias = !!aliasMap[item.id]
    const displayName = getDisplayName(item)

    return (
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border-2 cursor-pointer transition-all ${
        isSelected ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white hover:border-[#B5D4F4]'
      }`} onClick={() => setTarget(item.id)}>
        {item.icon ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: (item.color ?? '#185FA5') + '22' }}>
            <i className={`ti ${item.icon} text-[16px]`} style={{ color: item.color }} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: item.color, background: (item.color ?? '#185FA5') + '22' }}>
            <i className="ti ti-user text-[14px]" style={{ color: item.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{displayName}</span>
            <button onClick={(e) => { e.stopPropagation(); setDetailTarget(item); setAliasInput(aliasMap[item.id] ?? '') }}
              className="flex-shrink-0 p-0.5 text-[#A0AEC0] hover:text-[#185FA5] transition-colors">
              <i className="ti ti-pencil text-[11px]" />
            </button>
          </div>
          {!compact && <div className="text-[11px] text-[#A0AEC0] truncate">{hasAlias ? <span className="text-[#185FA5]">{item.label}</span> : item.sublabel}</div>}
        </div>



        {/* 단축번호 뱃지 */}
        <button onClick={(e) => { e.stopPropagation(); openShortcutModal(item) }}
          className={`flex-shrink-0 w-7 h-7 rounded-[7px] flex items-center justify-center text-[11px] font-bold border transition-colors ${
            shortcutNum ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-[#F4F6F9] text-[#A0AEC0] border-[#E2E8F0] hover:border-[#185FA5] hover:text-[#185FA5]'
          }`}>
          {shortcutNum ? shortcutNum : <i className="ti ti-hash text-[12px]" />}
        </button>

        {/* 즐겨찾기 */}
        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }} className="p-1 flex-shrink-0">
          <i className={`ti text-[15px] ${isFav ? 'ti-star-filled text-[#F59E0B]' : 'ti-star text-[#E2E8F0] hover:text-[#F59E0B]'}`} />
        </button>

        {isSelected && <div className="w-4 h-4 rounded-full bg-[#185FA5] flex items-center justify-center flex-shrink-0"><i className="ti ti-check text-white text-[9px]" /></div>}
      </div>
    )
  }

  // ─── 상세보기 + 별칭 편집 모달 ───────────────────────────
  function DetailModal() {
    if (!detailTarget) return null
    const item = detailTarget
    const hasAlias = !!aliasMap[item.id]

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-5" onClick={() => setDetailTarget(null)}>
        <div className="bg-white w-full max-w-sm rounded-[20px] p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-semibold">별칭 설정</div>
            <button onClick={() => setDetailTarget(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
          </div>

          {/* 아이콘 + 이름 */}
          <div className="flex items-center gap-3 p-3 bg-[#F4F6F9] rounded-[12px] mb-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: (item.color ?? '#185FA5') + '22' }}>
              <i className={`ti ${item.icon ?? 'ti-user'} text-[20px]`} style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              {/* 표시 이름 (별칭 or 기본) */}
              <div className="text-[15px] font-bold text-[#1A1A2E] truncate">{getDisplayName(item)}</div>
              {/* 기본명 (별칭과 다를 때만 표시) */}
              {hasAlias && (
                <div className="text-[11px] text-[#A0AEC0] mt-0.5 flex items-center gap-1">
                  <i className="ti ti-tag text-[10px]" /> 기본명: {item.label}
                </div>
              )}
              <div className="text-[11px] text-[#64748B] mt-0.5">{item.sublabel}</div>
            </div>
          </div>

          {/* 별칭 설정 */}
          <div className="mb-4">
            <label className="text-[12px] font-semibold text-[#64748B] block mb-1.5">
              커스텀 별칭 <span className="text-[#A0AEC0] font-normal">(나에게만 표시)</span>
            </label>
            <input
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder={item.label}
              className="w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#185FA5]"
            />
            <p className="text-[11px] text-[#A0AEC0] mt-1">비워두면 기본 이름으로 표시돼요</p>
          </div>

          {/* 단축번호 확인 */}
          {shortcutMap[item.id] && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#E6F1FB] rounded-[10px] mb-4">
              <div className="w-6 h-6 rounded-[6px] bg-[#185FA5] flex items-center justify-center text-white text-[11px] font-bold">{shortcutMap[item.id]}</div>
              <span className="text-[12px] text-[#185FA5] font-medium">단축번호 {shortcutMap[item.id]}번으로 지정됨</span>
              <button onClick={() => { removeShortcut(item.id) }} className="ml-auto text-[11px] text-[#A0AEC0] hover:text-[#A32D2D]">해제</button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setDetailTarget(null)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
            <button onClick={async () => { await saveAlias(item.id, aliasInput); setDetailTarget(null) }}
              className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold">저장</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── 단축번호 모달 ────────────────────────────────────────
  function ShortcutModal() {
    if (!shortcutModalTarget) return null
    const item = shortcutModalTarget
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-5" onClick={() => setShortcutModalTarget(null)}>
        <div className="bg-white w-full max-w-xs rounded-[20px] p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-semibold">단축번호 지정</div>
            <button onClick={() => setShortcutModalTarget(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#F4F6F9] rounded-[12px] mb-4">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: (item.color ?? '#185FA5') + '22' }}>
              <i className={`ti ${item.icon ?? 'ti-user'} text-[17px]`} style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{getDisplayName(item)}</div>
              <div className="text-[11px] text-[#A0AEC0]">{item.sublabel}</div>
            </div>
            {shortcutMap[item.id] && <div className="w-8 h-8 rounded-[8px] bg-[#185FA5] flex items-center justify-center text-white text-[13px] font-bold">{shortcutMap[item.id]}</div>}
          </div>
          <div className="mb-2">
            <label className="text-[12px] font-medium text-[#64748B] block mb-1.5">번호 입력 <span className="text-[#A0AEC0] font-normal">(1~20)</span></label>
            <input type="number" min="1" max="20" value={shortcutInput} onChange={(e) => { setShortcutInput(e.target.value); setShortcutError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') saveShortcut() }} placeholder="예: 3" autoFocus
              className="w-full h-[46px] border-2 border-[#E2E8F0] rounded-[12px] px-4 text-[18px] font-bold text-center focus:outline-none focus:border-[#185FA5]" />
          </div>
          {shortcutError && <div className="text-[11px] text-[#A32D2D] mb-3 flex items-center gap-1"><i className="ti ti-alert-circle text-[12px]" /> {shortcutError}</div>}
          {shortcutItems.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {shortcutItems.map(({ item: si, num }) => (
                <div key={si.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${si.id === item.id ? 'bg-[#185FA5] text-white' : 'bg-[#F4F6F9] text-[#64748B]'}`}>
                  <span>{num}번</span><span className="opacity-70">{getDisplayName(si)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {shortcutMap[item.id] && <button onClick={() => { removeShortcut(item.id); setShortcutModalTarget(null) }} className="h-[42px] px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1"><i className="ti ti-trash text-[13px]" /> 삭제</button>}
            <button onClick={() => setShortcutModalTarget(null)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
            <button onClick={saveShortcut} className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold">저장</button>
          </div>
        </div>
      </div>
    )
  }

  function MicModal() {
    if (!showMicModal) return null
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-5" onClick={() => setShowMicModal(false)}>
        <div className="bg-white w-full max-w-sm rounded-[20px] p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-semibold">마이크 설정</div>
            <button onClick={() => setShowMicModal(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-[12px] mb-4 ${micPermission === 'granted' ? 'bg-[#EAF3DE]' : micPermission === 'denied' ? 'bg-[#FCEBEB]' : 'bg-[#F4F6F9]'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${micPermission === 'granted' ? 'bg-[#C6E6A0]' : micPermission === 'denied' ? 'bg-[#F7C1C1]' : 'bg-[#E2E8F0]'}`}>
              <i className={`ti text-[20px] ${micPermission === 'granted' ? 'ti-microphone text-[#3B6D11]' : micPermission === 'denied' ? 'ti-microphone-off text-[#A32D2D]' : 'ti-microphone text-[#64748B]'}`} />
            </div>
            <div>
              <div className={`text-[13px] font-semibold ${micPermission === 'granted' ? 'text-[#3B6D11]' : micPermission === 'denied' ? 'text-[#A32D2D]' : 'text-[#64748B]'}`}>
                {micPermission === 'granted' ? '마이크 사용 가능' : micPermission === 'denied' ? '마이크 차단됨' : '권한 필요'}
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">블루투스 포함 모든 장치 지원</div>
            </div>
          </div>
          {micPermission === 'granted' && audioDevices.length > 0 && (
            <div className="mb-4">
              <div className="text-[12px] font-semibold text-[#64748B] mb-2">입력 장치 선택</div>
              <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                {audioDevices.map((d) => {
                  const isBt = d.label.toLowerCase().includes('bluetooth') || d.label.toLowerCase().includes('bt')
                  const isSel = d.deviceId === selectedDeviceId
                  return (
                    <button key={d.deviceId} onClick={() => setSelectedDeviceId(d.deviceId)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] border-2 text-left ${isSel ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] hover:border-[#B5D4F4]'}`}>
                      <i className={`ti text-[16px] ${isBt ? 'ti-bluetooth' : 'ti-microphone'} ${isSel ? 'text-[#185FA5]' : 'text-[#64748B]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-medium truncate ${isSel ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{d.label || `마이크 ${audioDevices.indexOf(d) + 1}`}</div>
                        {isBt && <div className="text-[10px] text-[#3B6D11] font-semibold">블루투스</div>}
                      </div>
                      {isSel && <i className="ti ti-check text-[#185FA5] text-[14px]" />}
                    </button>
                  )
                })}
              </div>
              <button onClick={loadAudioDevices} className="mt-2 w-full text-[11px] text-[#185FA5] flex items-center justify-center gap-1 py-1"><i className="ti ti-refresh text-[12px]" /> 장치 목록 새로고침</button>
            </div>
          )}
          {micPermission !== 'granted' && micPermission !== 'denied' && (
            <button onClick={requestMicPermission} disabled={requestingMic} className="w-full h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 mb-3">
              {requestingMic ? <><i className="ti ti-loader-2 animate-spin" /> 요청 중...</> : <><i className="ti ti-microphone" /> 마이크 권한 허용하기</>}
            </button>
          )}
          {micPermission === 'denied' && (
            <div className="bg-[#F4F6F9] rounded-[10px] p-3 mb-3">
              {[{ icon: 'ti-lock', text: '주소창 왼쪽 자물쇠 클릭' }, { icon: 'ti-settings', text: '사이트 설정 → 마이크 → 허용' }, { icon: 'ti-refresh', text: '페이지 새로고침' }].map((s, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  <div className="w-4 h-4 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[9px] font-bold text-[#64748B]">{i + 1}</div>
                  <i className={`ti ${s.icon} text-[12px] text-[#185FA5]`} /><span className="text-[11px] text-[#64748B]">{s.text}</span>
                </div>
              ))}
            </div>
          )}
          {micPermission === 'denied' && <button onClick={() => window.location.reload()} className="w-full h-[38px] border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center justify-center gap-2"><i className="ti ti-refresh text-[13px]" /> 새로고침</button>}
          {micPermission === 'granted' && <button onClick={() => setShowMicModal(false)} className="w-full h-[38px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold">확인</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-28">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[18px] font-semibold">무전 채널</div>
            <div className="text-[12px] text-[#64748B]">버튼을 누르는 동안 실시간 음성 전송</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/p/${projectId}/admin`)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-[#F4F6F9] text-[#64748B] border border-[#E2E8F0] hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              <i className="ti ti-settings text-[13px]" /> 관리자
            </button>
            <button onClick={() => setShowMicModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border ${micPermission === 'granted' ? 'bg-[#EAF3DE] text-[#3B6D11] border-[#C6E6A0]' : micPermission === 'denied' ? 'bg-[#FCEBEB] text-[#A32D2D] border-[#F7C1C1]' : 'bg-[#F4F6F9] text-[#64748B] border-[#E2E8F0]'}`}>
              <i className={`ti text-[13px] ${isBluetooth ? 'ti-bluetooth' : micPermission === 'denied' ? 'ti-microphone-off' : 'ti-microphone'}`} />
              <span>{micPermission === 'granted' ? (isBluetooth ? 'BT 연결' : '마이크 ON') : micPermission === 'denied' ? '차단됨' : '권한 필요'}</span>
              <i className="ti ti-chevron-down text-[10px] opacity-60" />
            </button>
          </div>
        </div>

        {/* 단축번호 빠른 선택 */}
        {shortcutItems.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] px-3 py-3 mb-4">
            <div className="text-[11px] font-semibold text-[#64748B] mb-2 flex items-center gap-1.5"><i className="ti ti-hash text-[12px]" /> 단축번호 빠른 선택</div>
            <div className="flex gap-2 flex-wrap">
              {shortcutItems.map(({ item, num }) => (
                <button key={item.id} onClick={() => setTarget(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border-2 transition-all ${target === item.id ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white hover:border-[#B5D4F4]'}`}>
                  <div className={`w-5 h-5 rounded-[5px] flex items-center justify-center text-[10px] font-bold ${target === item.id ? 'bg-[#185FA5] text-white' : 'bg-[#F4F6F9] text-[#64748B]'}`}>{num}</div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color ?? '#185FA5' }} />
                  <span className={`text-[12px] font-semibold ${target === item.id ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{getDisplayName(item)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PTT 버튼 */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] p-6 mb-4 flex flex-col items-center transition-opacity ${micPermission !== 'granted' ? 'opacity-50 pointer-events-none' : ''}`}>
          <button onPointerDown={startPTT} onPointerUp={stopPTT} onPointerLeave={stopPTT} disabled={micPermission !== 'granted'}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all select-none touch-none ${pressing ? 'bg-[#E24B4A] shadow-[0_0_0_20px_rgba(226,75,74,0.2)]' : 'bg-[#185FA5] shadow-[0_0_0_16px_#E6F1FB]'}`}>
            <i className={`ti ti-microphone text-[36px] text-white ${pressing ? 'animate-pulse' : ''}`} />
            <span className="text-white text-[12px] font-semibold">{pressing ? '전송 중...' : '누르고 말하기'}</span>
          </button>
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-[#F4F6F9] rounded-full">
            <i className="ti ti-send text-[12px] text-[#64748B]" />
            <span className="text-[12px] text-[#64748B]">수신:</span>
            <div className="flex items-center gap-1.5">
              {selectedTarget?.color && <div className="w-3 h-3 rounded-full" style={{ background: selectedTarget.color }} />}
              <span className="text-[12px] font-semibold text-[#1A1A2E]">{getDisplayName(selectedTarget)}</span>
              {shortcutMap[target] && <span className="text-[10px] bg-[#185FA5] text-white px-1.5 py-0.5 rounded-full font-bold">{shortcutMap[target]}번</span>}
            </div>
          </div>
          <p className="text-[11px] text-[#A0AEC0] mt-2">손 떼면 자동 전송 · {isBluetooth ? <span className="text-[#3B6D11] font-semibold">블루투스 연결됨</span> : '이어폰/헤드셋 자동 연동'}</p>
        </div>

        {/* 보낼 대상 */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden mb-4 transition-opacity ${micPermission !== 'granted' ? 'opacity-50' : ''}`}>
          <div className="px-4 py-3 border-b border-[#F4F6F9] flex items-center justify-between">
            <div className="text-[13px] font-semibold">보낼 대상</div>
            <div className="text-[11px] text-[#A0AEC0] flex items-center gap-2">
              <span className="flex items-center gap-1"><i className="ti ti-pencil text-[11px]" /> 이름 옆 ✏️ = 별칭</span>
            </div>
          </div>

          {favoriteItems.length > 0 && (
            <div className="px-4 py-3 border-b border-[#F4F6F9]">
              <div className="flex items-center gap-1.5 mb-2"><i className="ti ti-star-filled text-[#F59E0B] text-[12px]" /><span className="text-[11px] font-semibold text-[#64748B]">즐겨찾기</span></div>
              <div className="flex flex-col gap-2">{favoriteItems.map((item) => <TargetCard key={`fav-${item.id}`} item={item} compact />)}</div>
            </div>
          )}

          {groups.map(({ tier, label, badgeBg, badgeColor }) => {
            const items = targetItems.filter((t) => t.tier === tier)
            const isOpen = openGroups[tier]
            return (
              <div key={tier} className="border-b border-[#F4F6F9] last:border-0">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAFBFC]" onClick={() => toggleGroup(tier)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>{label}</span>
                    <span className="text-[11px] text-[#A0AEC0]">{items.length}명</span>
                  </div>
                  <i className={`ti text-[14px] text-[#A0AEC0] ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
                </button>
                {isOpen && <div className="px-4 pb-3 flex flex-col gap-2">{items.map((item) => <TargetCard key={item.id} item={item} />)}</div>}
              </div>
            )
          })}
        </div>

        {/* 히스토리 */}
        <div className="text-[13px] font-semibold mb-3">무전 히스토리</div>
        {history.length === 0 ? (
          <div className="text-center py-8 text-[#A0AEC0]"><i className="ti ti-history text-[36px] block mb-2 opacity-30" /><p className="text-[13px]">무전 기록이 없어요</p></div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-3.5 py-3 bg-white border border-[#E2E8F0] rounded-[10px]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: h.senderColor }}>{h.senderName.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{h.senderName}</div>
                  <div className="text-[11px] text-[#64748B]">→ {h.targetLabel} · {h.duration}초</div>
                </div>
                <div className="text-[11px] text-[#A0AEC0]">{timeAgo(h.createdAt)}</div>
                <i className="ti ti-volume text-[16px] text-[#185FA5] cursor-pointer" />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar />
      <DetailModal />
      <ShortcutModal />
      <MicModal />
    </div>
  )
}
