import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, TabBar } from '@/components/ui/Common'
import type { Part } from '@/types'

interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; duration: number; createdAt: string }

export default function PTTPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [parts, setParts] = useState<Part[]>([])
  const [target, setTarget] = useState<'all' | string>('all')
  const [history, setHistory] = useState<PTTRecord[]>([])
  const [pressing, setPressing] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [error, setError] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `parts/${projectId}`), (s) => { if (s.exists()) { const l: Part[] = Object.values(s.val()); l.sort((a,b)=>a.order-b.order); setParts(l) } })
    onValue(ref(db, `pttHistory/${projectId}`), (s) => {
      if (s.exists()) { const l: PTTRecord[] = Object.values(s.val()); l.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()); setHistory(l.slice(0,20)) }
    })
    // 마이크 권한 확인
    navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => { stream.getTracks().forEach((t) => t.stop()); setMediaReady(true) }).catch(() => setError('마이크 권한이 필요해요'))
  }, [projectId])

  async function startPTT() {
    if (!mediaReady || !user) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(); mediaRef.current = mr; startRef.current = Date.now(); setPressing(true)
    } catch { setError('마이크를 사용할 수 없어요') }
  }

  async function stopPTT() {
    if (!mediaRef.current || !user || !projectId) return
    setPressing(false)
    const duration = Math.round((Date.now() - startRef.current) / 1000)
    mediaRef.current.stop()
    mediaRef.current.stream.getTracks().forEach((t) => t.stop())
    // 히스토리 기록
    const targetPart = parts.find((p) => p.id === target)
    const targetLabel = target === 'all' ? '전체' : targetPart?.name ?? '알 수 없음'
    const r = push(ref(db, `pttHistory/${projectId}`))
    await set(r, { id: r.key!, senderName: user.displayName, senderColor: '#185FA5', target: targetLabel, duration, createdAt: new Date().toISOString() } as PTTRecord)
  }

  const timeAgo = (d: string) => { const m = Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<1)return'방금';if(m<60)return`${m}분 전`;if(m<1440)return`${Math.floor(m/60)}시간 전`;return`${Math.floor(m/1440)}일 전` }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <TabBar active="comms" />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-10">
        <div className="flex items-center justify-between mb-5">
          <div><div className="text-[18px] font-semibold">무전 채널</div><div className="text-[12px] text-[#64748B]">버튼을 누르는 동안 실시간 음성 전송</div></div>
        </div>

        {error && <div className="bg-[#FCEBEB] border border-[#F7C1C1] rounded-[10px] px-4 py-3 text-[13px] text-[#A32D2D] mb-4 flex items-center gap-2"><i className="ti ti-alert-triangle" /> {error}</div>}

        {/* PTT 버튼 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-6 mb-4 flex flex-col items-center">
          <button
            onPointerDown={startPTT} onPointerUp={stopPTT} onPointerLeave={stopPTT}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all select-none touch-none ${pressing ? 'bg-[#E24B4A] shadow-[0_0_0_20px_rgba(226,75,74,0.2)]' : 'bg-[#185FA5] shadow-[0_0_0_16px_#E6F1FB]'}`}>
            <i className={`ti ti-microphone text-[36px] text-white ${pressing ? 'animate-pulse' : ''}`} />
            <span className="text-white text-[12px] font-semibold">{pressing ? '전송 중...' : '누르고 말하기'}</span>
          </button>
          <p className="text-[12px] text-[#A0AEC0] mt-5">손 떼면 자동 전송</p>
        </div>

        {/* 대상 선택 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-4 mb-4">
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
          <div className="text-center py-8 text-[#A0AEC0]"><i className="ti ti-history text-[36px] block mb-2 opacity-30" /><p className="text-[13px]">무전 기록이 없어요</p></div>
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
    </div>
  )
}
