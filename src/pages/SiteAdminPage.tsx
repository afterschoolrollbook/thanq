/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, set, push, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Project, Part, Coupon } from '@/types'

// ─── 타입 ─────────────────────────────────────────────────
interface SiteUser {
  uid: string; email: string; displayName: string
  plan: 'free' | 'pro' | 'enterprise'; createdAt: string
  projectCount?: number; isPro?: boolean; proExpiresAt?: string
}
interface PTTRecord { id: string; senderName: string; senderColor: string; target: string; targetLabel: string; duration: number; createdAt: string }
interface TargetItem { id: string; label: string; sublabel: string; icon?: string; color?: string; tier: 'owner' | 'manager' | 'all'; shortcutNum: number }
type ListenState = 'idle' | 'listening' | 'processing' | 'connected'
type AdminTab = 'dashboard' | 'users' | 'ptt' | 'coupons' | 'plans' | 'notice' | 'email'


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

  // 쿠폰
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponForm, setCouponForm] = useState({
    code: '', type: 'duration' as 'duration' | 'permanent',
    durationDays: '30', maxUses: '0',
    expiresAt: '', memo: '',
  })
  const [couponSaving, setCouponSaving] = useState(false)
  const [couponMsg, setCouponMsg] = useState('')
  const [couponError, setCouponError] = useState('')

  // 공지
  const [noticeText, setNoticeText] = useState('')
  const [noticeSent, setNoticeSent] = useState(false)

  // 이메일 설정
  const [emailApiKey, setEmailApiKey] = useState('')
  const [emailFrom, setEmailFrom] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

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
    onValue(ref(db, 'users'), (s) => {
      if (!s.exists()) return
      const list: SiteUser[] = Object.entries(s.val()).map(([uid, v]: any) => ({ uid, ...v, plan: v.isPro ? 'pro' : (v.plan ?? 'free') }))
      setUsers(list)
      setStats((prev) => ({ ...prev, users: list.length }))
    })
    onValue(ref(db, 'projects'), (s) => {
      if (!s.exists()) return
      const list: Project[] = Object.values(s.val())
      setPttProjects(list)
      setStats((prev) => ({ ...prev, projects: list.length }))
    })
    onValue(ref(db, 'coupons'), (s) => {
      if (!s.exists()) { setCoupons([]); return }
      const list: Coupon[] = Object.values(s.val())
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setCoupons(list)
    })
  }, [isAdmin])

  // 이메일 설정 불러오기
  useEffect(() => {
    if (!isAdmin) return
    onValue(ref(db, 'siteSettings/email'), (s) => {
      if (s.exists()) {
        const d = s.val()
        setEmailApiKey(d.apiKey ?? '')
        setEmailFrom(d.from ?? '')
        setEmailEnabled(d.enabled ?? false)
      }
    })
  }, [isAdmin])

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

  // ─── 쿠폰 발행 ───────────────────────────────────────────
  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-'
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    setCouponForm((prev) => ({ ...prev, code }))
  }

  async function saveCoupon() {
    setCouponError('')
    if (!couponForm.code.trim()) { setCouponError('코드를 입력하거나 자동 생성하세요'); return }
    if (couponForm.type === 'duration' && (!couponForm.durationDays || Number(couponForm.durationDays) < 1)) {
      setCouponError('기간은 1일 이상이어야 해요'); return
    }
    setCouponSaving(true)
    const code = couponForm.code.trim().toUpperCase()
    const coupon: Coupon = {
      code,
      type: couponForm.type,
      durationDays: couponForm.type === 'duration' ? Number(couponForm.durationDays) : undefined,
      maxUses: Number(couponForm.maxUses) || 0,
      usedCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: couponForm.expiresAt || undefined,
      memo: couponForm.memo,
      active: true,
    }
    await set(ref(db, `coupons/${code}`), coupon)
    setCouponMsg(`✓ 쿠폰 "${code}" 발행 완료!`)
    setCouponForm({ code: '', type: 'duration', durationDays: '30', maxUses: '0', expiresAt: '', memo: '' })
    setCouponSaving(false)
    setTimeout(() => setCouponMsg(''), 3000)
  }

  async function toggleCoupon(code: string, active: boolean) {
    await update(ref(db, `coupons/${code}`), { active })
  }

  async function deleteCoupon(code: string) {
    if (!confirm(`쿠폰 "${code}"를 삭제할까요?`)) return
    await set(ref(db, `coupons/${code}`), null)
  }

  // ─── PTT AI ──────────────────────────────────────────────
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
    await set(ref(db, `users/${uid}/isPro`), plan === 'pro' || plan === 'enterprise')
    await set(ref(db, `users/${uid}/plan`), plan)
  }


  async function saveEmailSettings() {
    setEmailError(''); setEmailMsg('')
    if (emailEnabled && !emailApiKey.trim()) { setEmailError('API Key를 입력해주세요'); return }
    if (emailEnabled && !emailFrom.trim()) { setEmailError('발신 이메일을 입력해주세요'); return }
    if (emailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFrom.trim())) { setEmailError('올바른 이메일 형식이 아니에요'); return }
    setEmailSaving(true)
    try {
      await set(ref(db, 'siteSettings/email'), { apiKey: emailApiKey.trim(), from: emailFrom.trim(), enabled: emailEnabled, updatedAt: new Date().toISOString() })
      setEmailMsg('저장됐어요!')
      setTimeout(() => setEmailMsg(''), 3000)
    } catch { setEmailError('저장 중 오류가 발생했어요') }
    setEmailSaving(false)
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
    { key: 'coupons',   icon: 'ti-ticket',            label: '쿠폰 발행' },
    { key: 'plans',     icon: 'ti-credit-card',       label: '요금제' },
    { key: 'notice',    icon: 'ti-speakerphone',      label: '공지' },
    { key: 'email',     icon: 'ti-mail',              label: '이메일' },
  ]

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1E293B] border border-[#334155] rounded-[12px] p-4">
                  <div className="text-[13px] font-semibold mb-3">요금제 분포</div>
                  <div className="flex gap-4">
                    {[
                      { label: 'Free', count: users.filter(u => !u.isPro).length, color: '#64748B' },
                      { label: 'Pro', count: users.filter(u => u.isPro).length, color: '#185FA5' },
                    ].map((p) => (
                      <div key={p.label} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                        <span className="text-[13px] text-[#94A3B8]">{p.label}</span>
                        <span className="text-[13px] font-bold text-white">{p.count}명</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1E293B] border border-[#334155] rounded-[12px] p-4">
                  <div className="text-[13px] font-semibold mb-3">쿠폰 현황</div>
                  <div className="flex gap-4">
                    {[
                      { label: '발행', count: coupons.length, color: '#3B9EE8' },
                      { label: '활성', count: coupons.filter(c => c.active).length, color: '#4ADE80' },
                      { label: '사용됨', count: coupons.reduce((s, c) => s + (c.usedCount ?? 0), 0), color: '#F59E0B' },
                    ].map((p) => (
                      <div key={p.label} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                        <span className="text-[13px] text-[#94A3B8]">{p.label}</span>
                        <span className="text-[13px] font-bold text-white">{p.count}</span>
                      </div>
                    ))}
                  </div>
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
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-semibold truncate">{u.displayName ?? '이름 없음'}</div>
                        {u.isPro && <span className="text-[10px] px-1.5 py-0.5 bg-[#185FA5] text-white rounded-full font-bold">PRO</span>}
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">{u.email}</div>
                      {u.proExpiresAt && (
                        <div className="text-[10px] text-[#F59E0B]">Pro 만료: {new Date(u.proExpiresAt).toLocaleDateString('ko-KR')}</div>
                      )}
                    </div>
                    <select value={u.isPro ? 'pro' : 'free'}
                      onChange={(e) => changePlan(u.uid, e.target.value as SiteUser['plan'])}
                      className="bg-[#0F172A] border border-[#334155] text-[12px] text-white rounded-[6px] px-2 py-1 outline-none">
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
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
                  </div>
                  <div className="bg-[#1E293B] border border-[#334155] rounded-[14px] overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-[#334155] text-[13px] font-semibold">채널 목록</div>
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

          {/* ─── 쿠폰 발행 ─── */}
          {tab === 'coupons' && (
            <div>
              <div className="text-[18px] font-bold mb-1">쿠폰 발행</div>
              <div className="text-[12px] text-[#64748B] mb-5">마케팅용 무료 Pro 쿠폰을 발행해요</div>

              {/* 발행 폼 */}
              <div className="bg-[#1E293B] border border-[#334155] rounded-[14px] p-5 mb-6">
                <div className="text-[14px] font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ti ti-ticket text-[#3B9EE8]" /> 새 쿠폰 만들기
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* 쿠폰 코드 */}
                  <div>
                    <label className={lbl}>쿠폰 코드</label>
                    <div className="flex gap-2">
                      <input
                        value={couponForm.code}
                        onChange={(e) => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                        placeholder="예: SUMMER-2026"
                        className={inp}
                      />
                      <button onClick={generateCode}
                        className="flex-shrink-0 h-[38px] px-3 bg-[#334155] hover:bg-[#475569] text-white text-[11px] font-semibold rounded-[8px] transition-colors whitespace-nowrap">
                        자동 생성
                      </button>
                    </div>
                  </div>

                  {/* 쿠폰 타입 */}
                  <div>
                    <label className={lbl}>쿠폰 종류</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'duration', label: '기간 무료' },
                        { value: 'permanent', label: '영구 Pro' },
                      ].map((t) => (
                        <button key={t.value}
                          onClick={() => setCouponForm(p => ({ ...p, type: t.value as any }))}
                          className={`flex-1 h-[38px] rounded-[8px] text-[12px] font-semibold border transition-colors ${
                            couponForm.type === t.value
                              ? 'bg-[#185FA5] border-[#185FA5] text-white'
                              : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:border-[#475569]'
                          }`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 기간 (duration 선택 시) */}
                  {couponForm.type === 'duration' && (
                    <div>
                      <label className={lbl}>무료 기간 (일)</label>
                      <div className="flex gap-2">
                        {['7', '14', '30', '90'].map((d) => (
                          <button key={d}
                            onClick={() => setCouponForm(p => ({ ...p, durationDays: d }))}
                            className={`flex-1 h-[38px] rounded-[8px] text-[12px] font-bold border transition-colors ${
                              couponForm.durationDays === d
                                ? 'bg-[#185FA5] border-[#185FA5] text-white'
                                : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:border-[#475569]'
                            }`}>
                            {d}일
                          </button>
                        ))}
                        <input
                          type="number"
                          value={couponForm.durationDays}
                          onChange={(e) => setCouponForm(p => ({ ...p, durationDays: e.target.value }))}
                          placeholder="직접"
                          className="w-16 h-[38px] bg-[#0F172A] border border-[#334155] rounded-[8px] px-2 text-[12px] text-white text-center outline-none focus:border-[#185FA5]"
                        />
                      </div>
                    </div>
                  )}

                  {/* 최대 사용 횟수 */}
                  <div>
                    <label className={lbl}>최대 사용 횟수 <span className="text-[#475569] font-normal">(0 = 무제한)</span></label>
                    <div className="flex gap-2">
                      {['0', '1', '10', '50', '100'].map((n) => (
                        <button key={n}
                          onClick={() => setCouponForm(p => ({ ...p, maxUses: n }))}
                          className={`flex-1 h-[38px] rounded-[8px] text-[12px] font-bold border transition-colors ${
                            couponForm.maxUses === n
                              ? 'bg-[#185FA5] border-[#185FA5] text-white'
                              : 'bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:border-[#475569]'
                          }`}>
                            {n === '0' ? '무제한' : n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 쿠폰 만료일 */}
                  <div>
                    <label className={lbl}>쿠폰 만료일 <span className="text-[#475569] font-normal">(선택)</span></label>
                    <input
                      type="date"
                      value={couponForm.expiresAt}
                      onChange={(e) => setCouponForm(p => ({ ...p, expiresAt: e.target.value }))}
                      className={inp}
                    />
                  </div>

                  {/* 메모 */}
                  <div>
                    <label className={lbl}>관리자 메모 <span className="text-[#475569] font-normal">(선택)</span></label>
                    <input
                      value={couponForm.memo}
                      onChange={(e) => setCouponForm(p => ({ ...p, memo: e.target.value }))}
                      placeholder="예: 2026 여름 SNS 이벤트"
                      className={inp}
                    />
                  </div>
                </div>

                {couponError && (
                  <div className="flex items-center gap-2 text-[12px] text-[#F87171] mb-3">
                    <i className="ti ti-alert-circle text-[13px]" /> {couponError}
                  </div>
                )}
                {couponMsg && (
                  <div className="flex items-center gap-2 text-[12px] text-[#4ADE80] mb-3">
                    <i className="ti ti-check text-[13px]" /> {couponMsg}
                  </div>
                )}

                <button onClick={saveCoupon} disabled={couponSaving}
                  className="h-[42px] px-6 bg-[#185FA5] hover:bg-[#1470BE] text-white rounded-[10px] text-[13px] font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
                  <i className="ti ti-ticket text-[15px]" />
                  {couponSaving ? '발행 중...' : '쿠폰 발행'}
                </button>
              </div>

              {/* 발행된 쿠폰 목록 */}
              <div className="text-[14px] font-bold text-white mb-3">발행된 쿠폰 ({coupons.length}개)</div>
              {coupons.length === 0 ? (
                <div className="text-center py-10 text-[#475569] text-[13px]">발행된 쿠폰이 없어요</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {coupons.map((c) => {
                    const isExpired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false
                    const isFull = c.maxUses > 0 && c.usedCount >= c.maxUses
                    return (
                      <div key={c.code} className={`bg-[#1E293B] border rounded-[12px] px-4 py-3 flex items-center gap-3 ${
                        !c.active || isExpired || isFull ? 'border-[#334155] opacity-60' : 'border-[#334155]'
                      }`}>
                        {/* 코드 */}
                        <div className="font-mono text-[14px] font-bold text-white tracking-widest min-w-[120px]">{c.code}</div>

                        {/* 배지 */}
                        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            c.type === 'duration' ? 'bg-[#0F2744] text-[#3B9EE8]' : 'bg-[#1A0A40] text-[#A78BFA]'
                          }`}>
                            {c.type === 'duration' ? `${c.durationDays}일 무료` : '영구 Pro'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0F172A] text-[#64748B] font-semibold">
                            {c.usedCount}/{c.maxUses === 0 ? '∞' : c.maxUses}회
                          </span>
                          {isExpired && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A0A0A] text-[#F87171] font-semibold">만료됨</span>}
                          {isFull && !isExpired && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A1500] text-[#F59E0B] font-semibold">소진됨</span>}
                          {c.memo && <span className="text-[10px] text-[#475569] truncate max-w-[160px]">{c.memo}</span>}
                        </div>

                        {/* 활성/비활성 토글 */}
                        <button onClick={() => toggleCoupon(c.code, !c.active)}
                          className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${c.active ? 'bg-[#185FA5]' : 'bg-[#334155]'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${c.active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>

                        {/* 삭제 */}
                        <button onClick={() => deleteCoupon(c.code)}
                          className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-[#2A0A0A] text-[#475569] hover:text-[#F87171] transition-colors flex-shrink-0">
                          <i className="ti ti-trash text-[14px]" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── 요금제 ─── */}
          {tab === 'plans' && (
            <div>
              <div className="text-[18px] font-bold mb-5">요금제 현황</div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { plan: 'Free', price: '무료', color: '#64748B', features: ['프로젝트 생성', '파트 직접 입력', '큐시트 · 체크리스트', '팀원 초대'] },
                  { plan: 'Pro', price: '월 9,900원', color: '#185FA5', features: ['Free 전체 포함', '템플릿 저장 · 불러오기', 'AI 무전 (PTT)', '우선 지원'] },
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
              <div className="mt-4 bg-[#1E293B] border border-[#334155] rounded-[14px] p-4">
                <div className="text-[13px] font-semibold mb-2 flex items-center gap-2">
                  <i className="ti ti-info-circle text-[#3B9EE8]" /> 결제 연동 안내
                </div>
                <div className="text-[12px] text-[#64748B] leading-relaxed">
                  현재는 쿠폰으로만 Pro 활성화가 가능해요. 카드 결제 기능은 PG사(토스페이먼츠, 아임포트 등) 연동 후 추가될 예정이에요.
                </div>
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

          {/* ─── 이메일 설정 ─── */}
          {tab === 'email' && (
            <div>
              <div className="text-[18px] font-bold mb-5">이메일 발송 (Resend)</div>
              <p className="text-[12px] text-[#64748B] mb-5">팀원 · 참가자 초대 이메일 발송에 사용됩니다. 무료로 사용 가능합니다.</p>
              <div className="bg-[#1E293B] border border-[#334155] rounded-[14px] p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#334155] rounded-[10px] flex items-center justify-center">
                      <i className="ti ti-mail text-[18px] text-[#94A3B8]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold">Resend</div>
                      <div className="text-[11px] text-[#64748B]">월 3,000건 무료</div>
                    </div>
                  </div>
                  <button onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${emailEnabled ? 'bg-[#185FA5]' : 'bg-[#334155]'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                <div className="mb-4">
                  <label className={lbl}>API Key</label>
                  <div className="relative">
                    <input type={showApiKey ? 'text' : 'password'} value={emailApiKey}
                      onChange={(e) => setEmailApiKey(e.target.value)}
                      placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                      className={inp + ' pr-10'} />
                    <button onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white">
                      <i className={`ti ${showApiKey ? 'ti-eye-off' : 'ti-eye'} text-[14px]`} />
                    </button>
                  </div>
                  <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer"
                    className="mt-1.5 text-[11px] text-[#3B9EE8] flex items-center gap-1 hover:underline">
                    <i className="ti ti-external-link text-[11px]" /> Resend API 키 발급 방법 보기
                  </a>
                </div>
                <div className="mb-5">
                  <label className={lbl}>발신 이메일</label>
                  <input type="email" value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder="noreply@yourdomain.com"
                    className={inp} />
                </div>
                {emailError && <div className="mb-3 text-[12px] text-red-400">{emailError}</div>}
                {emailMsg && <div className="mb-3 text-[12px] text-[#3B6D11]">✓ {emailMsg}</div>}
                <button onClick={saveEmailSettings} disabled={emailSaving}
                  className="h-[40px] px-5 bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-40">
                  <i className="ti ti-device-floppy" /> {emailSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

const inp = 'w-full h-[38px] bg-[#0F172A] border border-[#334155] rounded-[8px] px-3 text-[12px] text-white placeholder-[#475569] outline-none focus:border-[#185FA5]'
const lbl = 'text-[11px] font-semibold text-[#94A3B8] block mb-1.5'
