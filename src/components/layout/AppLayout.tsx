import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Project } from '@/types'

const NAV_ITEMS = [
  { to: 'home',      icon: 'ti-home',             label: '홈' },
  { to: 'timeline',  icon: 'ti-timeline',         label: '타임라인' },
  { to: 'my-part',   icon: 'ti-checklist',        label: '내 파트' },
  { to: 'dashboard', icon: 'ti-layout-dashboard', label: '대시보드' },
  { to: 'comms',     icon: 'ti-message-circle',   label: '소통' },
] as const

export default function AppLayout() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    if (!projectId) return
    const unsub = onValue(ref(db, `projects/${projectId}`), (s) => { if (s.exists()) setProject(s.val()) })
    return () => unsub()
  }, [projectId])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  const currentPath = window.location.pathname.split('/').pop() ?? 'home'
  const initial = user?.displayName?.charAt(0) ?? '?'

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9]">
      {/* 탑바 */}
      <header className="sticky top-0 z-30 bg-[#185FA5] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* 메인 대시보드로 이동 */}
          <button onClick={() => navigate('/dashboard')} className="text-white font-bold text-[17px] tracking-tight hover:opacity-80 transition-opacity">
            ThanQ
          </button>
          {project && (
            <div className="flex items-center gap-1 text-[#B5D4F4] text-[13px]">
              <i className="ti ti-chevron-right text-[12px]" />
              <span className="truncate max-w-[140px]">{project.name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 알림 */}
          <button className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center relative">
            <i className="ti ti-bell text-white text-[16px]" />
          </button>
          {/* 프로필 + 드롭다운 */}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[12px] font-semibold">
              {initial}
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white rounded-[12px] shadow-lg border border-[#E2E8F0] py-1.5 min-w-[140px] z-50">
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

      {/* 메인 */}
      <main className="flex-1 overflow-y-auto pb-20" onClick={() => setShowMenu(false)}>
        <Outlet />
      </main>

      {/* 하단 탭 */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E2E8F0]">
        <div className="flex max-w-lg mx-auto">
          {NAV_ITEMS.map(({ to, icon, label }) => {
            const isActive = currentPath === to
            return (
              <button key={to} onClick={() => navigate(`/p/${projectId}/${to}`)}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-medium transition-colors ${isActive ? 'text-[#185FA5]' : 'text-[#A0AEC0]'}`}>
                <i className={`ti ${icon} text-[20px]`} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
