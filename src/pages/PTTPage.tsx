import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Part, Project } from '@/types'

interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; targetLabel: string; duration: number; createdAt: string }

type MicPermission = 'unknown' | 'granted' | 'denied' | 'prompt'
type TargetId = 'crew-all' | 'owner' | string

interface TargetItem {
  id: TargetId
  label: string
  sublabel: string
  icon?: string
  color?: string
  tier: 'owner' | 'manager' | 'all'
}

export default function PTTPage() {
  const { projectId } = useParams()
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
    const saved = localStorage.getItem(`ptt-favs-${projectId}`)
    if (saved) setFavorites(JSON.parse(saved))
  }, [projectId])

  async function checkMicPermission() {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setMicPermission(result.state as MicPermission)
        result.onchange = () => setMicPermission(result.state as MicPermission)
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
        setMicPermission('granted')
      }
    } catch { setMicPermission('denied') }
  }

  async function requestMicPermission() {
    setRequestingMic(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicPermission('granted')
      setShowMicModal(false)
    } catch { setMicPermission('denied') }
    finally { setRequestingMic(false) }
  }

  async function startPTT() {
    if (micPermission !== 'granted' || !user) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
    mediaRef.current.stop()
    mediaRef.current.stream.getTracks().forEach((t) => t.stop())
    const selectedTarget = targetItems.find((t) => t.id === target)
    const r = push(ref(db, `pttHistory/${projectId}`))
    await set(r, { id: r.key!, senderName: user.displayName, senderColor: '#185FA5', target, targetLabel: selectedTarget?.label ?? '크루 전체', duration, createdAt: new Date().toISOString() } as PTTRecord)
  }

  function toggleFavorite(id: TargetId) {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]
    setFavorites(next)
    localStorage.setItem(`ptt-favs-${projectId}`, JSON.stringify(next))
  }

  function toggleGroup(tier: string) {
    setOpenGroups((prev) => ({ ...prev, [tier]: !prev[tier] }))
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

  const groups: { tier: TargetItem['tier']; label: string; badgeBg: string; badgeColor: string }[] = [
    { tier: 'owner',   label: '총책임자',   badgeBg: '#FAEEDA', badgeColor: '#854F0B' },
    { tier: 'manager', label: '파트 책임자', badgeBg: '#F4F6F9', badgeColor: '#64748B' },
    { tier: 'all',     label: '크루 전체',   badgeBg: '#E6F1FB', badgeColor: '#185FA5' },
  ]

  function TargetCard({ item, compact = false }: { item: TargetItem; compact?: boolean }) {
    const isSelected = target === item.id
    const isFav = favorites.includes(item.id)
    return (
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border-2 cursor-pointer transition-all ${
        isSelected ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white hover:border-[#B5D4F4]'
      }`} onClick={() => setTarget(item.id)}>
        {item.icon ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: (item.color ?? '#185FA5') + '22' }}>
            <i className={`ti ${item.icon} text-[16px]`} style={{ color: item.color }} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            style={{ borderColor: item.color, background: (item.color ?? '#185FA5') + '22' }}>
            <i className="ti ti-user text-[14px]" style={{ color: item.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{item.label}</div>
          {!compact && <div className="text-[11px] text-[#A0AEC0] truncate">{item.sublabel}</div>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }} className="p-1 flex-shrink-0">
          <i className={`ti text-[15px] transition-colors ${isFav ? 'ti-star-filled text-[#F59E0B]' : 'ti-star text-[#E2E8F0] hover:text-[#F59E0B]'}`} />
        </button>
        {isSelected && (
          <div className="w-4 h-4 rounded-full bg-[#185FA5] flex items-center justify-center flex-shrink-0">
            <i className="ti ti-check text-white text-[9px]" />
          </div>
        )}
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
          <div className={`flex items-center gap-3 p-3 rounded-[12px] mb-4 ${
            micPermission === 'granted' ? 'bg-[#EAF3DE]' : micPermission === 'denied' ? 'bg-[#FCEBEB]' : 'bg-[#F4F6F9]'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              micPermission === 'granted' ? 'bg-[#C6E6A0]' : micPermission === 'denied' ? 'bg-[#F7C1C1]' : 'bg-[#E2E8F0]'
            }`}>
              <i className={`ti text-[20px] ${
                micPermission === 'granted' ? 'ti-microphone text-[#3B6D11]' : micPermission === 'denied' ? 'ti-microphone-off text-[#A32D2D]' : 'ti-microphone text-[#64748B]'
              }`} />
            </div>
            <div>
              <div className={`text-[13px] font-semibold ${
                micPermission === 'granted' ? 'text-[#3B6D11]' : micPermission === 'denied' ? 'text-[#A32D2D]' : 'text-[#64748B]'
              }`}>
                {micPermission === 'granted' ? '마이크 사용 가능' : micPermission === 'denied' ? '마이크 차단됨' : '권한 필요'}
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">
                {micPermission === 'granted' ? '이어폰/헤드셋 연결 시 자동으로 연동돼요' : micPermission === 'denied' ? '브라우저 설정에서 허용해야 해요' : '아래 버튼을 눌러 권한을 허용해주세요'}
              </div>
            </div>
          </div>
          {micPermission !== 'granted' && micPermission !== 'denied' && (
            <button onClick={requestMicPermission} disabled={requestingMic}
              className="w-full h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 mb-3">
              {requestingMic
                ? <><i className="ti ti-loader-2 text-[15px] animate-spin" /> 요청 중...</>
                : <><i className="ti ti-microphone text-[15px]" /> 마이크 권한 허용하기</>}
            </button>
          )}
          {micPermission === 'denied' && (
            <>
              <div className="bg-[#F4F6F9] rounded-[10px] p-3 mb-3">
                <div className="text-[11px] font-semibold text-[#64748B] mb-2">브라우저에서 직접 허용하는 방법</div>
                {[
                  { icon: 'ti-lock',    text: '주소창 왼쪽 자물쇠 클릭' },
                  { icon: 'ti-settings',text: '사이트 설정 → 마이크 → 허용' },
                  { icon: 'ti-refresh', text: '페이지 새로고침' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                    <div className="w-4 h-4 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[9px] font-bold text-[#64748B]">{i + 1}</div>
                    <i className={`ti ${s.icon} text-[12px] text-[#185FA5]`} />
                    <span className="text-[11px] text-[#64748B]">{s.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.reload()}
                className="w-full h-[38px] border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center justify-center gap-2">
                <i className="ti ti-refresh text-[13px]" /> 새로고침
              </button>
            </>
          )}
          {micPermission === 'granted' && (
            <button onClick={() => setShowMicModal(false)}
              className="w-full h-[38px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold">
              확인
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-28">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[18px] font-semibold">무전 채널</div>
            <div className="text-[12px] text-[#64748B]">버튼을 누르는 동안 실시간 음성 전송</div>
          </div>
          {/* 마이크 상태 토글 버튼 */}
          <button onClick={() => setShowMicModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
              micPermission === 'granted' ? 'bg-[#EAF3DE] text-[#3B6D11] border-[#C6E6A0]'
              : micPermission === 'denied'  ? 'bg-[#FCEBEB] text-[#A32D2D] border-[#F7C1C1]'
              : 'bg-[#F4F6F9] text-[#64748B] border-[#E2E8F0]'
            }`}>
            <i className={`ti text-[13px] ${micPermission === 'denied' ? 'ti-microphone-off' : 'ti-microphone'}`} />
            <span>{micPermission === 'granted' ? '마이크 ON' : micPermission === 'denied' ? '차단됨' : '권한 필요'}</span>
            <i className="ti ti-chevron-down text-[10px] opacity-60" />
          </button>
        </div>

        {/* PTT 버튼 */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] p-6 mb-4 flex flex-col items-center transition-opacity ${micPermission !== 'granted' ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            onPointerDown={startPTT} onPointerUp={stopPTT} onPointerLeave={stopPTT}
            disabled={micPermission !== 'granted'}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all select-none touch-none ${
              pressing ? 'bg-[#E24B4A] shadow-[0_0_0_20px_rgba(226,75,74,0.2)]' : 'bg-[#185FA5] shadow-[0_0_0_16px_#E6F1FB]'
            }`}>
            <i className={`ti ti-microphone text-[36px] text-white ${pressing ? 'animate-pulse' : ''}`} />
            <span className="text-white text-[12px] font-semibold">{pressing ? '전송 중...' : '누르고 말하기'}</span>
          </button>
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-[#F4F6F9] rounded-full">
            <i className="ti ti-send text-[12px] text-[#64748B]" />
            <span className="text-[12px] text-[#64748B]">수신:</span>
            <div className="flex items-center gap-1.5">
              {selectedTarget?.color && <div className="w-3 h-3 rounded-full" style={{ background: selectedTarget.color }} />}
              <span className="text-[12px] font-semibold text-[#1A1A2E]">{selectedTarget?.label ?? '크루 전체'}</span>
            </div>
          </div>
          <p className="text-[11px] text-[#A0AEC0] mt-2">손 떼면 자동 전송 · 이어폰/헤드셋 자동 연동</p>
        </div>

        {/* 보낼 대상 */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden mb-4 transition-opacity ${micPermission !== 'granted' ? 'opacity-50' : ''}`}>
          <div className="px-4 py-3 border-b border-[#F4F6F9]">
            <div className="text-[13px] font-semibold">보낼 대상</div>
          </div>

          {/* 즐겨찾기 */}
          {favoriteItems.length > 0 && (
            <div className="px-4 py-3 border-b border-[#F4F6F9]">
              <div className="flex items-center gap-1.5 mb-2">
                <i className="ti ti-star-filled text-[#F59E0B] text-[12px]" />
                <span className="text-[11px] font-semibold text-[#64748B]">즐겨찾기</span>
              </div>
              <div className="flex flex-col gap-2">
                {favoriteItems.map((item) => <TargetCard key={`fav-${item.id}`} item={item} compact />)}
              </div>
            </div>
          )}

          {/* 계층 그룹 */}
          {groups.map(({ tier, label, badgeBg, badgeColor }) => {
            const items = targetItems.filter((t) => t.tier === tier)
            const isOpen = openGroups[tier]
            return (
              <div key={tier} className="border-b border-[#F4F6F9] last:border-0">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAFBFC] transition-colors"
                  onClick={() => toggleGroup(tier)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: badgeBg, color: badgeColor }}>{label}</span>
                    <span className="text-[11px] text-[#A0AEC0]">{items.length}명</span>
                  </div>
                  <i className={`ti text-[14px] text-[#A0AEC0] transition-transform duration-200 ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 flex flex-col gap-2">
                    {items.map((item) => <TargetCard key={item.id} item={item} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 무전 히스토리 */}
        <div className="text-[13px] font-semibold mb-3">무전 히스토리</div>
        {history.length === 0 ? (
          <div className="text-center py-8 text-[#A0AEC0]">
            <i className="ti ti-history text-[36px] block mb-2 opacity-30" />
            <p className="text-[13px]">무전 기록이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-3.5 py-3 bg-white border border-[#E2E8F0] rounded-[10px]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: h.senderColor }}>
                  {h.senderName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{h.senderName}</div>
                  <div className="text-[11px] text-[#64748B]">→ {h.targetLabel ?? h.target} · {h.duration}초</div>
                </div>
                <div className="text-[11px] text-[#A0AEC0]">{timeAgo(h.createdAt)}</div>
                <i className="ti ti-volume text-[16px] text-[#185FA5] cursor-pointer" />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar />
      <MicModal />
    </div>
  )
}
