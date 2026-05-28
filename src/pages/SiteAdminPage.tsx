/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, set, push } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Project, Part } from '@/types'

// ─── 타입 ─────────────────────────────────────────────────
interface SiteUser {
  uid: string; email: string; displayName: string
  plan: 'free' | 'pro' | 'enterprise'; createdAt: string
  projectCount?: number
}
interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; targetLabel: string; duration: number; createdAt: string }
interface TargetItem { id: string; label: string; sublabel: string; icon?: string; color?: string; tier: 'owner' | 'manager' | 'all'; shortcutNum: number }
type ListenState = 'idle' | 'listening' | 'processing' | 'connected'
type AdminTab = 'dashboard' | 'users' | 'ptt' | 'plans' | 'notice'

export default function SiteAdminPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<AdminTab>('dashboard')

  // 대시보드 통계
  const [stats, setStats] = useState({ users: 0, projects: 0, activeToday: 0, pttCalls: 0 })

  // 회원 관리
  const [users, setUsers] = useState<SiteUser[]>([])
  const [userSearch, setUserSearch] = useState('')

  // PTT AI
  const [pttProjects, setPttProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [parts, setParts] = useState<Part[]>([])
  const [listenState, setListenState] = useState<ListenState>('idle')
  const [transcript, setTranscript] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [connectedTarget, setConnectedTarget] = useState<TargetItem | null>(null)
  const [pttHistory, setPttHistory] = useState<PTTRecord[]>([])
  const recognitionRef = useRef<any>(null)

  // 공지
  const [noticeText, setNoticeText] = useState('')
  const [noticeSent, setNoticeSent] = useState(false)

  // ─── 관리자 권한 확인 ─────────────────────────────────────
  useEffect(() => {
    if (!user) { setChecking(false); return }
    onValue(ref(db, `admins/${user.uid}`), (s) => {
      setIsAdmin(s.exists() && s.val() === true)
      setChecking(false)
    }, { onlyOnce: true })
  }, [user])

  // ─── 데이터 로드 ──────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return

    // 회원 목록
    onValue(ref(db, 'users'), (s) => {
      if (!s.exists()) return
      const list: SiteUser[] = Object.entries(s.val()).map(([uid, v]: any) => ({ uid, ...v, plan: v.plan ?? 'free' }))
      setUsers(list)
      setStats((prev) => ({ ...prev, users: list.length }))
    })

    // 전체 프로젝트
    onValue(ref(db, 'projects'), (s) => {
      if (!s.exists()) return
      const list: Project[] = Object.values(s.val())
      setPttProjects(list)
      setStats((prev) => ({ ...prev, projects: list.length }))
    })
  }, [isAdmin])

  // 선택된 프로젝트의 파트 로드
  useEffect(() => {
    if (!selectedProject) return
    onValue(ref(db, `parts/${selectedProject}`), (s) => {
      if (s.exists()) { const l: Part[] = Object.values(s.val()); l.sort((a, b) => a.order - b.order); setParts(l) }
      else setParts([])
    })
    onValue(ref(db, `pttHistory/${selectedProject}`), (s) => {
      if (s.exists()) {
        const l: PTTRecord[] = Object.values(s.val())
        l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setPttHistory(l.slice(0, 20))
      } else setPttHistory([])
    })
  }, [selectedProject])

  // ─── PTT AI 음성명령 ──────────────────────────────────────
  const targetItems: TargetItem[] = selectedProject ? [
    { id: 'owner', label: '총책임자', sublabel: pttProjects.find(p => p.id === selectedProject)?.name ?? '', icon: 'ti-crown', color: '#854F0B', tier: 'owner', shortcutNum: 1 },
    ...parts.map((p, i): TargetItem => ({ id: p.id, label: p.managerName ?? `${p.name} 책임자`, sublabel: p.name, color: p.color, tier: 'manager', shortcutNum: i + 2 })),
    { id: 'crew-all', label: '크루 전체', sublabel: '모든 멤버', icon: 'ti-users', color: '#185FA5', tier: 'all', shortcutNum: parts.length + 2 },
  ] : []

  function speak(text: string) {
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'; u.rate = 0.95
    window.speechSynthesis?.speak(u)
  }

  async function parseVoiceCommand(text: string): Promise<TargetItem | null> {
    const n = text.replace(/\s/g, '').toLowerCase()
    const numMatch = n.match(/(\d+)번/)
    if (numMatch) { const found = targetItems.find((t) => t.shortcutNum === parseInt(numMatch[1])); if (found) return found }
    for (const item of targetItems) {
      if (n.includes(item.label.toLowerCase().replace(/\s/g, '')) || n.includes(item.sublabel.toLowerCase().replace(/\s/g, ''))) return item
    }
    if (n.includes('전체') || n.includes('크루')) return targetItems.find((t) => t.id === 'crew-all') ?? null
    if (n.includes('총책임') || n.includes('본부')) return targetItems.find((t) => t.id === 'owner') ?? null
    try {
      const targetList = targetItems.map((t) => `${t.shortcutNum}번: ${t.label} (${t.sublabel})`).join('\n')
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 50,
          system: `무전 채널 연결 시스템. 음성 명령을 분석해 대상 번호만 숫자로 답하세요. 없으면 0.\n\n대상:\n${targetList}`,
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
    setConnectedTarget(item); setListenState('connected')
    const msg = `${item.shortcutNum}번, ${item.label}에게 연결이 되었습니다.`
    setStatusMsg(msg); speak(msg)
    if (selectedProject && user) {
      const r = push(ref(db, `pttHistory/${selectedProject}`))
      await set(r, { id: r.key!, senderName: `[관리자] ${user.displayName}`, senderColor: '#854F0B', target: item.id, targetLabel: item.label, duration: 0, createdAt: new Date().toISOString() } as PTTRecord)
    }
    setTimeout(() => { setListenState('idle'); setConnectedTarget(null) }, 4000)
  }

  function startListening() {
    if (!selectedProject) { setStatusMsg('먼저 프로젝트를 선택해주세요'); return }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setStatusMsg('Chrome 브라우저에서만 음성 인식이 가능해요'); return }
    const recognition = new SR()
    recognition.lang = 'ko-KR'; recognition.continuous = true; recognition.interimResults = true
    recognition.onstart = () => { setListenState('listening'); setStatusMsg('음성 명령 대기 중...'); setTranscript('') }
    recognition.onresult = async (event: any) => {
      const last = event.results[event.results.length - 1]
      const text: string = last[0].transcript
      setTranscript(text)
      if (last.isFinal) {
        setListenState('processing'); setStatusMsg(`"${text}" 분석 중...`)
        const found = await parseVoiceCommand(text)
        if (found) { recognition.stop(); await connectTo(found) }
        else { setStatusMsg(`"${text}" — 인식된 채널 없음`); setListenState('listening') }
      }
    }
    recognition.onerror = () => { setListenState('idle'); setStatusMsg('음성 인식 오류') }
    recognitionRef.current = recognition; recognition.start()
  }

  function stopListening() { recognitionRef.current?.stop(); setListenState('idle'); setStatusMsg(''); setTranscript('') }

  async function changePlan(uid: string, plan: SiteUser['plan']) {
    await set(ref(db, `users/${uid}/plan`), plan)
  }

  async function sendNotice() {
    if (!noticeText.trim()) return
    const r = push(ref(db, 'siteNotices'))
    await set(r, { id: r.key!, content: noticeText.trim(), authorId: user?.uid, createdAt: new Date().toISOString() })
    setNoticeText(''); setNoticeSent(true)
    setTimeout(() => setNoticeSent(false), 3000)
  }

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1) return '방금'; if (m < 60) return `${m}분 전`
    if (m < 1440) return `${Math.floor(m / 60)}시간 전`; return `${Math.floor(m / 1440)}일 전`
  }

  const filteredUsers = users.filter((u) =>
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  // ─── 로딩 / 권한 없음 ─────────────────────────────────────
  if (checking) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="text-[#64748B] text-[13px]">확인 중...</div>
    </div>
  )

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center gap-4">
      <i className="ti ti-lock text-[48px] text-[#334155]" />
      <div className="text-white text-[16px] font-semibold">접근 권한이 없어요</div>
      <button onClick={() => navigate('/dashboard')} className="text-[#185FA5] text-[13px]">← 대시보드로</button>
    </div>
  )

  const tabs: { key: AdminTab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: 'ti-layout-dashboard', label: '대시보드' },
    { key: 'users',     icon: 'ti-users',             label: '회원 관리' },
    { key: 'ptt',       icon: 'ti-radio',             label: 'PTT AI' },
    { key: 'plans',     icon: 'ti-credit-card',       label: '요금제' },
    { key: 'notice',    icon: 'ti-speakerphone',      label: '공지' },
  ]

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* 어드민 헤더 */}
      <header className="bg-[#1E293B] border-b border-[#334155] px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-[#185FA5] flex items-center justify-center">
            <i className="ti ti-shield text-white text-[16px]" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-white">ThanQ 관리자</div>
            <div className="text-[11px] text-[#64748B]">Site Admin Console</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#334155] text-[12px] text-[#94A3B8] hover:text-white hover:border-[#475569] transition-colors">
            <i className="ti ti-home text-[13px]" /> 메인
          </button>
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#334155] text-[12px] text-[#94A3B8] hover:text-white hover:border-[#475569] transition-colors">
            <i className="ti ti-layout-dashboard text-[13px]" /> 대시보드
          </button>
        </div>
      </header>

      <div className="flex">
        {/* 사이드 탭 */}
        <nav className="w-48 min-h-[calc(100vh-64px)] bg-[#1E293B] border-r border-[#334155] pt-4 flex flex-col gap-1 px-3">
          {tabs.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors text-left ${
                tab === key ? 'bg-[#185FA5] text-white' : 'text-[#94A3B8] hover:bg-[#334155] hover:text-white'
              }`}>
              <i className={`ti ${icon} text-[16px]`} />
              {label}
            </button>
          ))}
        </nav>

        {/* 콘텐츠 */}
        <main className="flex-1 p-6 overflow-auto">

          {/* ─── 대시보드 ─── */}
          {tab === 'dashboard' && (
            <div>
              <div className="text-[18px] font-bold mb-5">서비스 현황</div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: '전체 회원', value: stats.users, icon: 'ti-users', color: '#185FA5' },
                  { label: '전체 프로젝트', value: stats.projects, icon: 'ti-folder', color: '#0F6E56' },
                  { label: '오늘 활성', value: stats.activeToday, icon: 'ti-activity', color: '#854F0B' },
                  { label: 'PTT 호출', value: stats.pttCalls, icon: 'ti-radio', color: '#6B3FA0' },
                ].map((s) => (
                  <div key={s.label} className="bg-[#1E293B] border border-[#334155] rounded-[12px] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] text-[#64748B]">{s.label}</div>
                      <i className={`ti ${s.icon} text-[18px]`} style={{ color: s.color }} />
                    </div>
                    <div className="text-[28px] font-bold text-white">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-[#1E293B] border border-[#334155] rounded-[12px] p-4">
                <div className="text-[13px] font-semibold mb-3">요금제 분포</div>
                <div className="flex gap-4">
                  {[
                    { label: 'Free', count: users.filter(u => u.plan === 'free').length, color: '#64748B' },
                    { label: 'Pro', count: users.filter(u => u.plan === 'pro').length, color: '#185FA5' },
                    { label: 'Enterprise', count: users.filter(u => u.plan === 'enterprise').length, color: '#854F0B' },
                  ].map((p) => (
                    <div key={p.label} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                      <span className="text-[13px] text-[#94A3B8]">{p.label}</span>
                      <span className="text-[13px] font-bold text-white">{p.count}명</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── 회원 관리 ─── */}
          {tab === 'users' && (
            <div>
              <div className="text-[18px] font-bold mb-5">회원 관리</div>
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                placeholder="이름 또는 이메일 검색..."
                className="w-full h-[40px] bg-[#1E293B] border border-[#334155] rounded-[10px] px-4 text-[13px] text-white placeholder-[#475569] outline-none focus:border-[#185FA5] mb-4" />
              <div className="flex flex-col gap-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-10 text-[#475569]">회원이 없어요</div>
                ) : filteredUsers.map((u) => (
                  <div key={u.uid} className="bg-[#1E293B] border border-[#334155] rounded-[12px] px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#185FA5] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                      {u.displayName?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{u.displayName ?? '이름 없음'}</div>
                      <div className="text-[11px] text-[#64748B] truncate">{u.email}</div>
                    </div>
                    <select value={u.plan}
                      onChange={(e) => changePlan(u.uid, e.target.value as SiteUser['plan'])}
                      className="bg-[#0F172A] border border-[#334155] text-[12px] text-white rounded-[6px] px-2 py-1 outline-none">
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── PTT AI ─── */}
          {tab === 'ptt' && (
            <div>
              <div className="text-[18px] font-bold mb-1">PTT AI 채널 관리</div>
              <div className="text-[12px] text-[#64748B] mb-5">음성 명령으로 프로젝트 채널에 연결해요</div>

              {/* 프로젝트 선택 */}
              <div className="mb-4">
                <label className="text-[12px] text-[#94A3B8] block mb-1.5">프로젝트 선택</label>
                <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full h-[40px] bg-[#1E293B] border border-[#334155] rounded-[10px] px-3 text-[13px] text-white outline-none focus:border-[#185FA5]">
                  <option value="">— 프로젝트를 선택하세요 —</option>
                  {pttProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {selectedProject && (
                <>
                  {/* 음성 명령 패널 */}
                  <div className={`rounded-[14px] p-5 mb-4 border transition-all ${
                    listenState === 'listening'  ? 'bg-[#0F2744] border-[#185FA5]'
                    : listenState === 'processing' ? 'bg-[#2A1500] border-[#854F0B]'
                    : listenState === 'connected'  ? 'bg-[#0A2010] border-[#3B6D11]'
                    : 'bg-[#1E293B] border-[#334155]'
                  }`}>
                    <div className="flex flex-col items-center mb-4">
                      <button onClick={listenState === 'idle' ? startListening : stopListening}
                        className={`w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 transition-all ${
                          listenState === 'listening'  ? 'bg-[#185FA5] shadow-[0_0_0_14px_rgba(24,95,165,0.2)]'
                          : listenState === 'processing' ? 'bg-[#854F0B]'
                          : listenState === 'connected'  ? 'bg-[#3B6D11]'
                          : 'bg-[#185FA5] hover:shadow-[0_0_0_14px_rgba(24,95,165,0.15)]'
                        }`}>
                        <i className={`ti text-[24px] text-white ${
                          listenState === 'listening'  ? 'ti-microphone animate-pulse'
                          : listenState === 'processing' ? 'ti-loader-2 animate-spin'
                          : listenState === 'connected'  ? 'ti-check'
                          : 'ti-microphone'
                        }`} />
                        <span className="text-white text-[9px] font-semibold">
                          {listenState === 'idle' ? 'AI 명령' : listenState === 'listening' ? '듣는 중' : listenState === 'processing' ? '분석 중' : '연결됨'}
                        </span>
                      </button>
                    </div>
                    <div className="text-center">
                      {statusMsg
                        ? <div className="text-[13px] font-semibold text-white">{statusMsg}</div>
                        : <div className="text-[12px] text-[#475569]">버튼 누르고 채널 번호나 이름을 말하세요</div>}
                      {transcript && <div className="mt-1 text-[11px] text-[#64748B]">"{transcript}"</div>}
                    </div>
                    {listenState === 'idle' && (
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {['"1번 연결"', '"음향팀 연결"', '"총책임자"', '"전체 연결"', '"2번 채널"', '"크루 전체"'].map((ex) => (
                          <div key={ex} className="text-[10px] text-[#185FA5] bg-[#0F2744] px-2 py-1 rounded-[6px] text-center">{ex}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 채널 목록 */}
                  <div className="bg-[#1E293B] border border-[#334155] rounded-[14px] overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between">
                      <div className="text-[13px] font-semibold">채널 목록</div>
                      <div className="text-[11px] text-[#475569]">탭하면 바로 연결</div>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {targetItems.map((item) => {
                        const isConn = connectedTarget?.id === item.id && listenState === 'connected'
                        return (
                          <button key={item.id} onClick={() => connectTo(item)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-left transition-all ${isConn ? 'border-[#3B6D11] bg-[#0A2010]' : 'border-[#334155] hover:border-[#185FA5]'}`}>
                            <div className={`w-6 h-6 rounded-[6px] flex items-center justify-center text-[11px] font-bold ${isConn ? 'bg-[#3B6D11] text-white' : 'bg-[#0F172A] text-[#64748B]'}`}>{item.shortcutNum}</div>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: (item.color ?? '#185FA5') + '22' }}>
                              <i className={`ti ${item.icon ?? 'ti-user'} text-[16px]`} style={{ color: item.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-white truncate">{item.label}</div>
                              <div className="text-[11px] text-[#475569]">{item.sublabel}</div>
                            </div>
                            {isConn && <div className="flex items-center gap-1 text-[11px] text-[#3B6D11] font-semibold"><i className="ti ti-radio animate-pulse" /> 연결됨</div>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* PTT 히스토리 */}
                  {pttHistory.length > 0 && (
                    <div className="bg-[#1E293B] border border-[#334155] rounded-[14px] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#334155] text-[13px] font-semibold">최근 연결 기록</div>
                      <div className="p-3 flex flex-col gap-2">
                        {pttHistory.map((h) => (
                          <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-[8px] bg-[#0F172A]">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: h.senderColor }}>{h.senderName.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-semibold truncate text-white">{h.senderName}</div>
                              <div className="text-[10px] text-[#475569]">→ {h.targetLabel} {h.duration > 0 ? `· ${h.duration}초` : ''}</div>
                            </div>
                            <div className="text-[10px] text-[#475569]">{timeAgo(h.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── 요금제 ─── */}
          {tab === 'plans' && (
            <div>
              <div className="text-[18px] font-bold mb-5">요금제 관리</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { plan: 'Free', price: '무료', color: '#64748B', features: ['프로젝트 3개', '멤버 10명', '기본 PTT', '큐시트/체크리스트', '광고 표시'] },
                  { plan: 'Pro', price: '월 9,900원', color: '#185FA5', features: ['프로젝트 무제한', '멤버 무제한', 'AI 큐시트 생성', 'AI 음성 명령', '광고 없음', '고급 분석'] },
                  { plan: 'Enterprise', price: '협의', color: '#854F0B', features: ['Pro 전체 포함', '전용 서버 PTT', '화이트라벨', 'API 연동', '전담 지원'] },
                ].map((p) => (
                  <div key={p.plan} className="bg-[#1E293B] border border-[#334155] rounded-[14px] p-4">
                    <div className="text-[14px] font-bold mb-1" style={{ color: p.color }}>{p.plan}</div>
                    <div className="text-[20px] font-bold text-white mb-3">{p.price}</div>
                    <div className="flex flex-col gap-1.5">
                      {p.features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
                          <i className="ti ti-check text-[12px]" style={{ color: p.color }} /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 공지 ─── */}
          {tab === 'notice' && (
            <div>
              <div className="text-[18px] font-bold mb-5">전체 공지 발송</div>
              <div className="bg-[#1E293B] border border-[#334155] rounded-[14px] p-4">
                <label className="text-[12px] text-[#94A3B8] block mb-2">공지 내용</label>
                <textarea value={noticeText} onChange={(e) => setNoticeText(e.target.value)}
                  placeholder="모든 사용자에게 표시될 공지를 입력하세요"
                  className="w-full h-[120px] bg-[#0F172A] border border-[#334155] rounded-[10px] px-3 py-2.5 text-[13px] text-white placeholder-[#475569] outline-none focus:border-[#185FA5] resize-none mb-3" />
                <button onClick={sendNotice} disabled={!noticeText.trim()}
                  className="h-[40px] px-5 bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-40">
                  <i className="ti ti-speakerphone" /> 전체 발송
                </button>
                {noticeSent && <div className="mt-2 text-[12px] text-[#3B6D11]">✓ 공지가 발송되었어요</div>}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
