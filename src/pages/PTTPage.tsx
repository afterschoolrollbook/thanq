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
    } catch {
      setMicPermission('denied')
    }
  }

  async function requestMicPermission() {
    setRequestingMic(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicPermission('granted')
    } catch {
      setMicPermission('denied')
    } finally {
      setRequestingMic(false)
    }
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
    const targetLabel = selectedTarget?.label ?? '크루 전체'
    const r = push(ref(db, `pttHistory/${projectId}`))
    await set(r, { id: r.key!, senderName: user.displayName, senderColor: '#185FA5', target, targetLabel, duration, createdAt: new Date().toISOString() } as PTTRecord)
  }

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1) return '방금'; if (m < 60) return `${m}분 전`
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`; return `${Math.floor(m / 1440)}일 전`
  }

  // ─── 계층형 대상 목록 ─────────────────────────────────────
  const targetItems: TargetItem[] = [
    {
      id: 'owner',
      label: '총책임자',
      sublabel: project?.name ? `${project.name}` : '프로젝트 오너',
      icon: 'ti-crown',
      color: '#854F0B',
      tier: 'owner',
    },
    ...parts.map((p): TargetItem => ({
      id: p.id,
      label: p.managerName ?? `${p.name} 책임자`,
      sublabel: p.name,
      color: p.color,
      tier: 'manager',
    })),
    {
      id: 'crew-all',
      label: '크루 전체',
      sublabel: '모든 멤버',
      icon: 'ti-users',
      color: '#185FA5',
      tier: 'all',
    },
  ]

  const selectedTarget = targetItems.find((t) => t.id === target)

  // ─── 권한 배너 ────────────────────────────────────────────
  function MicBanner() {
    if (micPermission === 'granted') return null

    if (micPermission === 'denied') return (
      <div className="bg-[#FCEBEB] border border-[#F7C1C1] rounded-[14px] p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F7C1C1] flex items-center justify-center flex-shrink-0">
            <i className="ti ti-microphone-off text-[#A32D2D] text-[18px]" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[#A32D2D] mb-0.5">마이크 권한이 차단됨</div>
            <div className="text-[12px] text-[#854F0B] leading-relaxed">브라우저 설정에서 마이크 권한을 직접 허용해야 해요.</div>
          </div>
        </div>
        <div className="mt-3 bg-white/60 rounded-[10px] p-3">
          <div className="text-[12px] font-semibold text-[#64748B] mb-2">설정 방법</div>
          {[
            { icon: 'ti-lock',    text: '주소창 왼쪽 자물쇠 아이콘 클릭' },
            { icon: 'ti-settings',text: '사이트 설정 → 마이크 → 허용' },
            { icon: 'ti-refresh', text: '페이지 새로고침 후 사용' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <div className="w-5 h-5 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[10px] font-bold text-[#64748B] flex-shrink-0">{i + 1}</div>
              <i className={`ti ${step.icon} text-[13px] text-[#185FA5] flex-shrink-0`} />
              <span className="text-[12px] text-[#64748B]">{step.text}</span>
            </div>
          ))}
        </div>
        <button onClick={() => window.location.reload()}
          className="mt-3 w-full h-[38px] border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center justify-center gap-2 hover:bg-white/50 transition-colors">
          <i className="ti ti-refresh text-[14px]" /> 새로고침
        </button>
      </div>
    )

    return (
      <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-5 mb-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#E6F1FB] flex items-center justify-center mb-3">
          <i className="ti ti-microphone text-[#185FA5] text-[28px]" />
        </div>
        <div className="text-[14px] font-semibold text-[#1A1A2E] mb-1">마이크 권한이 필요해요</div>
        <div className="text-[12px] text-[#64748B] mb-4 leading-relaxed">
          무전 기능을 사용하려면 마이크 접근 권한이 필요해요.<br />
          버튼을 눌러 권한을 허용해주세요.
        </div>
        <button onClick={requestMicPermission} disabled={requestingMic}
          className="h-[42px] px-6 bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50 transition-opacity">
          {requestingMic
            ? <><i className="ti ti-loader-2 text-[16px] animate-spin" /> 권한 요청 중...</>
            : <><i className="ti ti-microphone text-[16px]" /> 마이크 권한 허용하기</>}
        </button>
        <p className="text-[11px] text-[#A0AEC0] mt-3">팝업이 뜨면 <span className="font-semibold text-[#185FA5]">허용</span>을 눌러주세요</p>
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
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            micPermission === 'granted' ? 'bg-[#EAF3DE] text-[#3B6D11]'
            : micPermission === 'denied' ? 'bg-[#FCEBEB] text-[#A32D2D]'
            : 'bg-[#F1EFE8] text-[#5F5E5A]'}`}>
            <i className={`ti text-[12px] ${micPermission === 'denied' ? 'ti-microphone-off' : 'ti-microphone'}`} />
            {micPermission === 'granted' ? '마이크 허용됨' : micPermission === 'denied' ? '마이크 차단됨' : '확인 중'}
          </div>
        </div>

        {/* 권한 배너 */}
        <MicBanner />

        {/* PTT 버튼 */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] p-6 mb-4 flex flex-col items-center transition-opacity ${micPermission !== 'granted' ? 'opacity-40 pointer-events-none' : ''}`}>
          <button
            onPointerDown={startPTT} onPointerUp={stopPTT} onPointerLeave={stopPTT}
            disabled={micPermission !== 'granted'}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all select-none touch-none ${
              pressing ? 'bg-[#E24B4A] shadow-[0_0_0_20px_rgba(226,75,74,0.2)]' : 'bg-[#185FA5] shadow-[0_0_0_16px_#E6F1FB]'
            }`}>
            <i className={`ti ti-microphone text-[36px] text-white ${pressing ? 'animate-pulse' : ''}`} />
            <span className="text-white text-[12px] font-semibold">{pressing ? '전송 중...' : '누르고 말하기'}</span>
          </button>
          {/* 현재 수신 대상 */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-[#F4F6F9] rounded-full">
            <i className="ti ti-send text-[12px] text-[#64748B]" />
            <span className="text-[12px] text-[#64748B]">수신:</span>
            <div className="flex items-center gap-1.5">
              {selectedTarget?.color && (
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: selectedTarget.color }} />
              )}
              <span className="text-[12px] font-semibold text-[#1A1A2E]">{selectedTarget?.label ?? '크루 전체'}</span>
            </div>
          </div>
          <p className="text-[11px] text-[#A0AEC0] mt-2">손 떼면 자동 전송</p>
        </div>

        {/* ─── 계층형 대상 선택 (가로 스크롤) ─── */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] p-4 mb-4 transition-opacity ${micPermission !== 'granted' ? 'opacity-40' : ''}`}>
          <div className="text-[13px] font-semibold mb-2">보낼 대상</div>

          {/* 계층 안내 */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="px-2 py-0.5 rounded-full bg-[#FAEEDA] text-[#854F0B] text-[11px] font-semibold">총책임자</span>
            <i className="ti ti-arrow-right text-[10px] text-[#A0AEC0]" />
            <span className="px-2 py-0.5 rounded-full bg-[#F4F6F9] text-[#64748B] text-[11px] font-semibold">파트 책임자</span>
            <i className="ti ti-arrow-right text-[10px] text-[#A0AEC0]" />
            <span className="px-2 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5] text-[11px] font-semibold">크루 전체</span>
          </div>

          {/* 가로 스크롤 카드 */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {targetItems.map((item) => {
              const isSelected = target === item.id
              const borderColor = isSelected
                ? (item.color ?? '#185FA5')
                : item.tier === 'owner' ? '#FAEEDA' : item.tier === 'all' ? '#B5D4F4' : '#E2E8F0'
              const bgColor = isSelected
                ? (item.tier === 'owner' ? '#FAEEDA' : item.tier === 'all' ? '#E6F1FB' : '#F4F6F9')
                : 'white'

              return (
                <button key={item.id} onClick={() => setTarget(item.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 py-3 px-3.5 rounded-[12px] border-2 transition-all min-w-[76px]"
                  style={{ borderColor, background: bgColor }}>
                  {item.icon ? (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: isSelected ? (item.color ?? '#185FA5') + '22' : '#F4F6F9' }}>
                      <i className={`ti ${item.icon} text-[18px]`} style={{ color: item.color }} />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: isSelected ? item.color : '#E2E8F0', background: (item.color ?? '#185FA5') + '22' }}>
                      <i className="ti ti-user text-[16px]" style={{ color: item.color }} />
                    </div>
                  )}
                  <div className="text-[11px] font-semibold text-center leading-tight max-w-[68px] truncate"
                    style={{ color: isSelected ? (item.color ?? '#185FA5') : '#1A1A2E' }}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#A0AEC0] truncate max-w-[68px] text-center">{item.sublabel}</div>
                  {item.tier === 'owner' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FAEEDA] text-[#854F0B]">총책임</span>}
                  {item.tier === 'all'   && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5]">전체</span>}
                </button>
              )
            })}
          </div>

          {/* 선택 대상 설명 */}
          {selectedTarget && (
            <div className="mt-3 pt-3 border-t border-[#F4F6F9] flex items-center gap-2 text-[12px] text-[#64748B]">
              <i className="ti ti-info-circle text-[14px] text-[#185FA5]" />
              {selectedTarget.tier === 'owner'   && '총책임자에게만 전송돼요'}
              {selectedTarget.tier === 'manager' && `${selectedTarget.sublabel} 파트 책임자에게만 전송돼요`}
              {selectedTarget.tier === 'all'     && '모든 크루 멤버에게 전송돼요'}
            </div>
          )}
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
    </div>
  )
}
