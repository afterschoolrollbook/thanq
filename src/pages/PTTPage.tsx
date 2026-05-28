import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Part } from '@/types'

interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; duration: number; createdAt: string }

type MicPermission = 'unknown' | 'granted' | 'denied' | 'prompt'

export default function PTTPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [parts, setParts] = useState<Part[]>([])
  const [target, setTarget] = useState<'all' | string>('all')
  const [history, setHistory] = useState<PTTRecord[]>([])
  const [pressing, setPressing] = useState(false)
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown')
  const [requestingMic, setRequestingMic] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startRef = useRef<number>(0)

  // 권한 상태 조회 (Permissions API)
  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) { const l: Part[] = Object.values(s.val()); l.sort((a, b) => a.order - b.order); setParts(l) }
    })
    onValue(ref(db, `pttHistory/${projectId}`), (s) => {
      if (s.exists()) {
        const l: PTTRecord[] = Object.values(s.val())
        l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setHistory(l.slice(0, 20))
      }
    })

    // Permissions API로 현재 권한 상태 확인
    checkMicPermission()
  }, [projectId])

  async function checkMicPermission() {
    try {
      // Permissions API 지원 여부 확인
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setMicPermission(result.state as MicPermission)
        result.onchange = () => setMicPermission(result.state as MicPermission)
      } else {
        // Permissions API 미지원 시 직접 테스트
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
    const targetPart = parts.find((p) => p.id === target)
    const targetLabel = target === 'all' ? '전체' : targetPart?.name ?? '알 수 없음'
    const r = push(ref(db, `pttHistory/${projectId}`))
    await set(r, { id: r.key!, senderName: user.displayName, senderColor: '#185FA5', target: targetLabel, duration, createdAt: new Date().toISOString() } as PTTRecord)
  }

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1) return '방금'; if (m < 60) return `${m}분 전`
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`; return `${Math.floor(m / 1440)}일 전`
  }

  // ─── 권한 상태별 배너 ─────────────────────────────────────
  function MicBanner() {
    // 허용됨
    if (micPermission === 'granted') return null

    // 거부됨 (브라우저 설정에서만 변경 가능)
    if (micPermission === 'denied') return (
      <div className="bg-[#FCEBEB] border border-[#F7C1C1] rounded-[14px] p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F7C1C1] flex items-center justify-center flex-shrink-0">
            <i className="ti ti-microphone-off text-[#A32D2D] text-[18px]" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[#A32D2D] mb-0.5">마이크 권한이 차단됨</div>
            <div className="text-[12px] text-[#854F0B] leading-relaxed">
              브라우저 설정에서 마이크 권한을 직접 허용해야 해요.
            </div>
          </div>
        </div>
        <div className="mt-3 bg-white/60 rounded-[10px] p-3">
          <div className="text-[12px] font-semibold text-[#64748B] mb-2">설정 방법</div>
          <div className="flex flex-col gap-1.5">
            {[
              { icon: 'ti-lock', text: '주소창 왼쪽 자물쇠 아이콘 클릭' },
              { icon: 'ti-settings', text: '사이트 설정 → 마이크 → 허용' },
              { icon: 'ti-refresh', text: '페이지 새로고침 후 사용' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[10px] font-bold text-[#64748B] flex-shrink-0">{i + 1}</div>
                <i className={`ti ${step.icon} text-[13px] text-[#185FA5] flex-shrink-0`} />
                <span className="text-[12px] text-[#64748B]">{step.text}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 w-full h-[38px] border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center justify-center gap-2 hover:bg-white/50 transition-colors">
          <i className="ti ti-refresh text-[14px]" /> 새로고침
        </button>
      </div>
    )

    // 미허용 또는 unknown — 권한 요청 버튼
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
        <button
          onClick={requestMicPermission}
          disabled={requestingMic}
          className="h-[42px] px-6 bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50 transition-opacity">
          {requestingMic
            ? <><i className="ti ti-loader-2 text-[16px] animate-spin" /> 권한 요청 중...</>
            : <><i className="ti ti-microphone text-[16px]" /> 마이크 권한 허용하기</>
          }
        </button>
        <p className="text-[11px] text-[#A0AEC0] mt-3">팝업이 뜨면 <span className="font-semibold text-[#185FA5]">허용</span>을 눌러주세요</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-28">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[18px] font-semibold">무전 채널</div>
            <div className="text-[12px] text-[#64748B]">버튼을 누르는 동안 실시간 음성 전송</div>
          </div>
          {/* 권한 상태 아이콘 */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            micPermission === 'granted'
              ? 'bg-[#EAF3DE] text-[#3B6D11]'
              : micPermission === 'denied'
                ? 'bg-[#FCEBEB] text-[#A32D2D]'
                : 'bg-[#F1EFE8] text-[#5F5E5A]'
          }`}>
            <i className={`ti text-[12px] ${
              micPermission === 'granted' ? 'ti-microphone' :
              micPermission === 'denied'  ? 'ti-microphone-off' :
              'ti-microphone'
            }`} />
            {micPermission === 'granted' ? '마이크 허용됨' :
             micPermission === 'denied'  ? '마이크 차단됨' : '권한 확인 중'}
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
              pressing
                ? 'bg-[#E24B4A] shadow-[0_0_0_20px_rgba(226,75,74,0.2)]'
                : 'bg-[#185FA5] shadow-[0_0_0_16px_#E6F1FB]'
            }`}>
            <i className={`ti ti-microphone text-[36px] text-white ${pressing ? 'animate-pulse' : ''}`} />
            <span className="text-white text-[12px] font-semibold">{pressing ? '전송 중...' : '누르고 말하기'}</span>
          </button>
          <p className="text-[12px] text-[#A0AEC0] mt-5">손 떼면 자동 전송</p>
        </div>

        {/* 대상 선택 */}
        <div className={`bg-white border border-[#E2E8F0] rounded-[14px] p-4 mb-4 transition-opacity ${micPermission !== 'granted' ? 'opacity-40' : ''}`}>
          <div className="text-[13px] font-semibold mb-3">보낼 대상</div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setTarget('all')}
              className={`py-2.5 rounded-[10px] border-2 text-center transition-colors ${target === 'all' ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white'}`}>
              <i className={`ti ti-users text-[20px] block mb-1 ${target === 'all' ? 'text-[#185FA5]' : 'text-[#64748B]'}`} />
              <div className={`text-[12px] font-semibold ${target === 'all' ? 'text-[#185FA5]' : 'text-[#64748B]'}`}>전체</div>
            </button>
            {parts.slice(0, 4).map((part) => (
              <button key={part.id} onClick={() => setTarget(part.id)}
                className={`py-2.5 rounded-[10px] border-2 text-center transition-colors ${target === part.id ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white'}`}>
                <div className="w-5 h-5 rounded-full mx-auto mb-1" style={{ background: part.color }} />
                <div className={`text-[11px] font-semibold truncate px-1 ${target === part.id ? 'text-[#185FA5]' : 'text-[#64748B]'}`}>{part.name}</div>
              </button>
            ))}
          </div>
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
                  <div className="text-[11px] text-[#64748B]">{h.target} · {h.duration}초</div>
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
