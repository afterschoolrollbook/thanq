import { useState } from 'react'
import { useNavigate, useParams, NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

// ─── 앱 탑바 ─────────────────────────────────────────────
export function Topbar({ projectName }: { projectName?: string }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [showMenu, setShowMenu] = useState(false)
  const initial = user?.displayName?.charAt(0) ?? '?'

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-[#185FA5] px-5 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate('/dashboard')} className="text-white font-bold text-[18px] tracking-tight hover:opacity-80">
          ThanQ
        </button>
        {projectName && (
          <span className="text-[#B5D4F4] text-[13px] flex items-center gap-1">
            <i className="ti ti-chevron-right text-[12px]" />
            <span className="truncate max-w-[140px]">{projectName}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
          <i className="ti ti-bell text-white text-[16px]" />
        </button>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[12px] font-semibold">
            {initial}
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white rounded-[12px] shadow-lg border border-[#E2E8F0] py-1.5 min-w-[150px] z-50">
              <button onClick={() => { navigate('/dashboard'); setShowMenu(false) }}
                className="w-full px-4 py-2.5 text-left text-[13px] text-[#1A1A2E] flex items-center gap-2 hover:bg-[#F4F6F9]">
                <i className="ti ti-layout-dashboard text-[15px] text-[#185FA5]" /> 전체 대시보드
              </button>
              <div className="h-px bg-[#E2E8F0] my-1" />
              <button onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-[13px] text-[#A32D2D] flex items-center gap-2 hover:bg-[#F4F6F9]">
                <i className="ti ti-logout text-[15px]" /> 로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── 스텝바 ──────────────────────────────────────────────
export function StepBar({ step }: { step: number }) {
  const steps = ['계정', '분야 선택', '프로젝트', '파트 구성']
  return (
    <div className="bg-white border-b border-[#E2E8F0] px-5 py-3.5 flex items-center">
      {steps.map((label, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${done ? 'bg-[#185FA5] text-white' : active ? 'bg-[#185FA5] text-white outline outline-[3px] outline-[#B5D4F4] outline-offset-1' : 'bg-white border border-[#E2E8F0] text-[#A0AEC0]'}`}>
                {done ? <i className="ti ti-check text-[11px]" /> : null}
              </div>
              <span className={`text-[12px] whitespace-nowrap ${active ? 'text-[#185FA5] font-medium' : 'text-[#64748B]'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-[#E2E8F0] mx-2.5" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── 앱 탭바 ─────────────────────────────────────────────
export function TabBar({ active }: { active: 'home' | 'timeline' | 'my-part' | 'dashboard' | 'comms' }) {
  const { projectId } = useParams()
  const tabs = [
    { key: 'home',      icon: 'ti-home',             label: '홈' },
    { key: 'timeline',  icon: 'ti-timeline',         label: '타임라인' },
    { key: 'my-part',   icon: 'ti-checklist',        label: '내 파트' },
    { key: 'dashboard', icon: 'ti-layout-dashboard', label: '대시보드' },
    { key: 'comms',     icon: 'ti-message-circle',   label: '소통' },
  ] as const
  return (
    <div className="flex gap-0 border-b border-[#E2E8F0] bg-white overflow-x-auto">
      {tabs.map(({ key, icon, label }) => (
        <NavLink key={key} to={`/p/${projectId}/${key}`}
          className={`px-3.5 py-[11px] text-[13px] border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${active === key ? 'text-[#185FA5] border-[#185FA5] font-semibold' : 'text-[#64748B] border-transparent hover:text-[#1A1A2E]'}`}>
          <i className={`ti ${icon}`} /> {label}
        </NavLink>
      ))}
    </div>
  )
}

// ─── 상태 뱃지 ────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    waiting:  { label: '대기',    bg: '#F1EFE8', color: '#5F5E5A' },
    ready:    { label: '준비완료', bg: '#EAF3DE', color: '#3B6D11' },
    ongoing:  { label: '진행중',  bg: '#E6F1FB', color: '#185FA5' },
    done:     { label: '완료',    bg: '#EAF3DE', color: '#3B6D11' },
    delay:    { label: '지연',    bg: '#FAEEDA', color: '#854F0B' },
    issue:    { label: '이슈',    bg: '#FCEBEB', color: '#A32D2D' },
    pending:  { label: '대기',    bg: '#F1EFE8', color: '#5F5E5A' },
  }
  const s = map[status] ?? map['waiting']
  return (
    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
