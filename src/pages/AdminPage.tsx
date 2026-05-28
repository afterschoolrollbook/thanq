/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Part, Project } from '@/types'

interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; targetLabel: string; duration: number; createdAt: string }
type TargetId = 'crew-all' | 'owner' | string
interface TargetItem { id: TargetId; label: string; sublabel: string; icon?: string; color?: string; tier: 'owner' | 'manager' | 'all'; shortcutNum: number }
type ListenState = 'idle' | 'listening' | 'processing' | 'connected'

export default function AdminPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [listenState, setListenState] = useState<ListenState>('idle')
  const [transcript, setTranscript] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [connectedTarget, setConnectedTarget] = useState<TargetItem | null>(null)
  const [history, setHistory] = useState<PTTRecord[]>([])
  const recognitionRef = useRef<any>(null)

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
        setHistory(l.slice(0, 20))
      }
    })
  }, [projectId])

  const targetItems: TargetItem[] = [
    { id: 'owner', label: '총책임자', sublabel: project?.name ?? '프로젝트 오너', icon: 'ti-crown', color: '#854F0B', tier: 'owner', shortcutNum: 1 },
    ...parts.map((p, i): TargetItem => ({ id: p.id, label: p.managerName ?? `${p.name} 책임자`, sublabel: p.name, color: p.color, tier: 'manager', shortcutNum: i + 2 })),
    { id: 'crew-all', label: '크루 전체', sublabel: '모든 멤버', icon: 'ti-users', color: '#185FA5', tier: 'all', shortcutNum: parts.length + 2 },
  ]

  function speak(text: string) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'; u.rate = 0.95
    window.speechSynthesis.speak(u)
  }

  async function parseVoiceCommand(text: string): Promise<TargetItem | null> {
    const n = text.replace(/\s/g, '').toLowerCase()
    // N번 연결 패턴
    const numMatch = n.match(/(\d+)번/)
    if (numMatch) { const found = targetItems.find((t) => t.shortcutNum === parseInt(numMatch[1])); if (found) return found }
    // 파트명/이름 직접 매칭
    for (const item of targetItems) {
      if (n.includes(item.label.toLowerCase().replace(/\s/g, '')) || n.includes(item.sublabel.toLowerCase().replace(/\s/g, ''))) return item
    }
    if (n.includes('전체') || n.includes('크루')) return targetItems.find((t) => t.id === 'crew-all') ?? null
    if (n.includes('총책임') || n.includes('본부') || n.includes('총괄')) return targetItems.find((t) => t.id === 'owner') ?? null
    // AI 파싱
    try {
      const targetList = targetItems.map((t) => `${t.shortcutNum}번: ${t.label} (${t.sublabel})`).join('\n')
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 50,
          system: `무전 채널 연결 시스템입니다. 음성 명령을 분석하여 연결할 대상의 번호만 숫자로 답하세요. 없으면 0.\n\n대상:\n${targetList}`,
          messages: [{ role: 'user', content: text }],
        }),
      })
      const data = await res.json()
      const aiNum = parseInt(data.content?.[0]?.text?.trim() ?? '0')
      if (aiNum > 0) return targetItems.find((t) => t.shortcutNum === aiNum) ?? null
    } catch { /* ignore */ }
    return null
  }

  async function connectTo(item: TargetItem) {
    setConnectedTarget(item)
    setListenState('connected')
    const msg = `${item.shortcutNum}번, ${item.label}에게 연결이 되었습니다.`
    setStatusMsg(msg)
    speak(msg)
    if (projectId && user) {
      const r = push(ref(db, `pttHistory/${projectId}`))
      await set(r, { id: r.key!, senderName: `[관리자] ${user.displayName}`, senderColor: '#854F0B', target: item.id, targetLabel: item.label, duration: 0, createdAt: new Date().toISOString() } as PTTRecord)
    }
    setTimeout(() => { setListenState('idle'); setConnectedTarget(null) }, 4000)
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setStatusMsg('이 브라우저는 음성 인식을 지원하지 않아요 (Chrome 권장)'); return }
    const recognition = new SR()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onstart = () => { setListenState('listening'); setStatusMsg('음성 명령 대기 중...'); setTranscript('') }
    recognition.onresult = async (event: any) => {
      const last = event.results[event.results.length - 1]
      const text: string = last[0].transcript
      setTranscript(text)
      if (last.isFinal) {
        setListenState('processing')
        setStatusMsg(`"${text}" 분석 중...`)
        const found = await parseVoiceCommand(text)
        if (found) { recognition.stop(); await connectTo(found) }
        else { setStatusMsg(`"${text}" — 인식된 채널이 없어요. 다시 말씀해주세요.`); speak('인식된 채널이 없습니다. 다시 말씀해주세요.'); setListenState('listening') }
      }
    }
    recognition.onerror = () => { setListenState('idle'); setStatusMsg('음성 인식 오류가 발생했어요') }
    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() { recognitionRef.current?.stop(); setListenState('idle'); setStatusMsg(''); setTranscript('') }

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1) return '방금'; if (m < 60) return `${m}분 전`
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`; return `${Math.floor(m / 1440)}일 전`
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar projectName={project?.name} />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-28">

        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#FAEEDA] flex items-center justify-center">
                <i className="ti ti-crown text-[#854F0B] text-[14px]" />
              </div>
              <div className="text-[18px] font-semibold">관리자 채널</div>
            </div>
            <div className="text-[12px] text-[#64748B] mt-0.5">AI 음성 명령으로 채널 연결</div>
          </div>
          <button onClick={() => navigate(`/p/${projectId}/ptt`)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded-full text-[12px] text-[#64748B] hover:border-[#185FA5]">
            <i className="ti ti-radio text-[13px]" /> 무전으로
          </button>
        </div>

        {/* AI 음성 명령 패널 */}
        <div className={`rounded-[16px] p-5 mb-4 border-2 transition-all ${
          listenState === 'listening'  ? 'bg-[#E6F1FB] border-[#185FA5]'
          : listenState === 'processing' ? 'bg-[#FAEEDA] border-[#854F0B]'
          : listenState === 'connected'  ? 'bg-[#EAF3DE] border-[#3B6D11]'
          : 'bg-white border-[#E2E8F0]'
        }`}>
          <div className="flex flex-col items-center mb-4">
            <button onClick={listenState === 'idle' ? startListening : stopListening}
              className={`w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1.5 transition-all ${
                listenState === 'listening'  ? 'bg-[#185FA5] shadow-[0_0_0_16px_rgba(24,95,165,0.15)]'
                : listenState === 'processing' ? 'bg-[#854F0B] shadow-[0_0_0_16px_rgba(133,79,11,0.15)]'
                : listenState === 'connected'  ? 'bg-[#3B6D11] shadow-[0_0_0_16px_rgba(59,109,17,0.15)]'
                : 'bg-[#185FA5] shadow-[0_0_0_16px_#E6F1FB] hover:shadow-[0_0_0_20px_#E6F1FB]'
              }`}>
              <i className={`ti text-[28px] text-white ${
                listenState === 'listening'  ? 'ti-microphone animate-pulse'
                : listenState === 'processing' ? 'ti-loader-2 animate-spin'
                : listenState === 'connected'  ? 'ti-check'
                : 'ti-microphone'
              }`} />
              <span className="text-white text-[10px] font-semibold">
                {listenState === 'idle' ? 'AI 명령' : listenState === 'listening' ? '듣는 중' : listenState === 'processing' ? '분석 중' : '연결됨'}
              </span>
            </button>
          </div>

          <div className="text-center mb-3">
            {statusMsg
              ? <div className={`text-[13px] font-semibold ${listenState === 'connected' ? 'text-[#3B6D11]' : listenState === 'processing' ? 'text-[#854F0B]' : 'text-[#185FA5]'}`}>{statusMsg}</div>
              : <div className="text-[12px] text-[#A0AEC0]">버튼을 누르고 채널 이름 또는 번호를 말하세요</div>}
            {transcript && <div className="mt-1 text-[11px] text-[#64748B] bg-white/60 px-3 py-1 rounded-full inline-block">"{transcript}"</div>}
          </div>

          {listenState === 'idle' && (
            <div className="bg-white/70 rounded-[10px] p-3">
              <div className="text-[11px] font-semibold text-[#64748B] mb-2">음성 명령 예시</div>
              <div className="grid grid-cols-2 gap-1.5">
                {['"1번 연결"', '"3번 연결"', '"음향팀 연결"', '"총책임자 연결"', '"전체 연결"', '"2번 채널"'].map((ex) => (
                  <div key={ex} className="text-[11px] text-[#185FA5] bg-[#E6F1FB] px-2 py-1 rounded-[6px] text-center">{ex}</div>
                ))}
              </div>
            </div>
          )}

          {listenState === 'connected' && connectedTarget && (
            <div className="flex items-center justify-center gap-3 bg-white/70 rounded-[10px] p-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: (connectedTarget.color ?? '#185FA5') + '22' }}>
                <i className={`ti ${connectedTarget.icon ?? 'ti-user'} text-[20px]`} style={{ color: connectedTarget.color }} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#3B6D11]">{connectedTarget.label}</div>
                <div className="text-[11px] text-[#64748B]">{connectedTarget.sublabel}</div>
              </div>
            </div>
          )}
        </div>

        {/* 채널 목록 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#F4F6F9] flex items-center justify-between">
            <div className="text-[13px] font-semibold">채널 목록</div>
            <div className="text-[11px] text-[#A0AEC0]">탭하면 바로 연결</div>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {targetItems.map((item) => {
              const isConnected = connectedTarget?.id === item.id && listenState === 'connected'
              return (
                <button key={item.id} onClick={() => connectTo(item)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-[10px] border-2 text-left transition-all ${isConnected ? 'border-[#3B6D11] bg-[#EAF3DE]' : 'border-[#E2E8F0] bg-white hover:border-[#185FA5] hover:bg-[#E6F1FB]'}`}>
                  <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${isConnected ? 'bg-[#3B6D11] text-white' : 'bg-[#F4F6F9] text-[#64748B]'}`}>{item.shortcutNum}</div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: (item.color ?? '#185FA5') + '22' }}>
                    <i className={`ti ${item.icon ?? 'ti-user'} text-[18px]`} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-semibold ${isConnected ? 'text-[#3B6D11]' : 'text-[#1A1A2E]'}`}>{item.label}</div>
                    <div className="text-[11px] text-[#A0AEC0]">{item.sublabel}</div>
                  </div>
                  {isConnected
                    ? <div className="flex items-center gap-1 text-[11px] text-[#3B6D11] font-semibold"><i className="ti ti-radio text-[13px] animate-pulse" /> 연결됨</div>
                    : <i className="ti ti-plug text-[14px] text-[#A0AEC0]" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 히스토리 */}
        <div className="text-[13px] font-semibold mb-3">최근 연결 기록</div>
        {history.length === 0 ? (
          <div className="text-center py-8 text-[#A0AEC0]"><i className="ti ti-history text-[36px] block mb-2 opacity-30" /><p className="text-[13px]">기록이 없어요</p></div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-3.5 py-3 bg-white border border-[#E2E8F0] rounded-[10px]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: h.senderColor }}>{h.senderName.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{h.senderName}</div>
                  <div className="text-[11px] text-[#64748B]">→ {h.targetLabel} {h.duration > 0 ? `· ${h.duration}초` : ''}</div>
                </div>
                <div className="text-[11px] text-[#A0AEC0]">{timeAgo(h.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
