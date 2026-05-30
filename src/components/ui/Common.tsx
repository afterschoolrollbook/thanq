import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

// ─── 탑바 ─────────────────────────────────────────────────
export function Topbar({ projectName }: { projectName?: string }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [showMenu, setShowMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const initial = user?.displayName?.charAt(0) ?? '?'

  useEffect(() => {
    if (!user) return
    onValue(ref(db, `admins/${user.uid}`), (s) => {
      setIsAdmin(s.exists() && s.val() === true)
    }, { onlyOnce: true })
  }, [user])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-[#185FA5] px-5 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate('/')} className="text-white font-bold text-[18px] tracking-tight hover:opacity-80">
          ThanQ
        </button>
        {projectName && (
          <span className="text-[#B5D4F4] text-[13px] flex items-center gap-1">
            <i className="ti ti-chevron-right text-[12px]" />
            <span className="truncate max-w-[160px]">{projectName}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {isAdmin && (
              <button onClick={() => navigate('/admin')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAEEDA]/20 border border-[#FAEEDA]/30 text-[11px] font-semibold text-[#FAEEDA] hover:bg-[#FAEEDA]/30 transition-colors">
                <i className="ti ti-shield text-[12px]" /> 관리자
              </button>
            )}
            <button className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <i className="ti ti-bell text-white text-[16px]" />
            </button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[12px] font-semibold">
                {initial}
              </button>
              {showMenu && (
                <div className="absolute right-0 top-10 bg-white rounded-[12px] shadow-lg border border-[#E2E8F0] py-1.5 min-w-[160px] z-50">
                  <button onClick={() => { navigate('/my'); setShowMenu(false) }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[#1A1A2E] flex items-center gap-2 hover:bg-[#F4F6F9]">
                    <i className="ti ti-user text-[15px] text-[#185FA5]" /> 마이페이지
                  </button>
                  <button onClick={() => { navigate('/dashboard'); setShowMenu(false) }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[#1A1A2E] flex items-center gap-2 hover:bg-[#F4F6F9]">
                    <i className="ti ti-layout-dashboard text-[15px] text-[#185FA5]" /> 대시보드
                  </button>
                  <button onClick={() => { navigate('/blog'); setShowMenu(false) }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[#1A1A2E] flex items-center gap-2 hover:bg-[#F4F6F9]">
                    <i className="ti ti-news text-[15px] text-[#185FA5]" /> 블로그
                  </button>
                  <button onClick={() => { navigate('/templates'); setShowMenu(false) }}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[#1A1A2E] flex items-center gap-2 hover:bg-[#F4F6F9]">
                    <i className="ti ti-file-export text-[15px] text-[#185FA5]" /> 템플릿
                  </button>
                  <div className="h-px bg-[#E2E8F0] my-1" />
                  <button onClick={handleLogout}
                    className="w-full px-4 py-2.5 text-left text-[13px] text-[#A32D2D] flex items-center gap-2 hover:bg-[#F4F6F9]">
                    <i className="ti ti-logout text-[15px]" /> 로그아웃
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button onClick={() => navigate('/login')}
            className="px-4 py-1.5 bg-white/15 border border-white/25 rounded-[8px] text-[13px] font-semibold text-white hover:bg-white/25 transition-colors flex items-center gap-1.5">
            <i className="ti ti-login text-[14px]" /> 로그인
          </button>
        )}
      </div>
    </header>
  )
}

// ─── 하단 탭바 ────────────────────────────────────────────
export function BottomTabBar() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { key: 'timeline',  icon: 'ti-timeline',         label: '타임라인' },
    { key: 'my-part',   icon: 'ti-checklist',        label: '내 파트' },
    { key: 'dashboard', icon: 'ti-layout-dashboard', label: '대시보드' },
    { key: 'comms',     icon: 'ti-message-circle',   label: '소통' },
    { key: 'ptt',       icon: 'ti-radio',            label: '무전' },
  ] as const

  function handleTab(key: string) {
    if (projectId) {
      navigate(`/p/${projectId}/${key}`)
    } else if (location.pathname === '/projects') {
      // 이미 프로젝트 선택 페이지 → next 파라미터만 변경
      navigate(`/projects?next=${key}`, { replace: true })
    } else {
      navigate(`/projects?next=${key}`)
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E2E8F0]">
      <div className="flex">
        {/* 홈 */}
        <button onClick={() => navigate('/dashboard')}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-medium transition-all relative ${
            location.pathname === '/dashboard'
              ? 'text-[#185FA5] bg-[#E6F1FB]'
              : 'text-[#A0AEC0] hover:text-[#185FA5]'
          }`}>
          {location.pathname === '/dashboard' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#185FA5] rounded-b"/>}
          <i className="ti ti-home text-[20px]" />
          <span>홈(전체)</span>
        </button>
        {/* 프로젝트 */}
        <button onClick={() => navigate('/projects')}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-medium transition-all relative ${
            location.pathname === '/projects' || /^\/p\/[^/]+\/home$/.test(location.pathname)
              ? 'text-[#185FA5] bg-[#E6F1FB]'
              : 'text-[#A0AEC0] hover:text-[#185FA5]'
          }`}>
          {(location.pathname === '/projects' || /^\/p\/[^/]+\/home$/.test(location.pathname)) && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#185FA5] rounded-b"/>}
          <i className="ti ti-folder text-[20px]" />
          <span>프로젝트</span>
        </button>
        {/* 나머지 탭 */}
        {tabs.map(({ key, icon, label }) => {
          const nextParam = new URLSearchParams(location.search).get('next')
          const isActive = (!!projectId && location.pathname.includes(`/${key}`))
                        || (!projectId && nextParam === key)
          return (
            <button key={key} onClick={() => handleTab(key)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-medium transition-all relative ${
                isActive ? 'text-[#185FA5] bg-[#E6F1FB]' : 'text-[#A0AEC0] hover:text-[#185FA5]'
              }`}>
              {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#185FA5] rounded-b"/>}
              <i className={`ti ${icon} text-[20px]`} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
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
