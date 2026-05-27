import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const NAV_ITEMS = [
  { to: 'home',       icon: 'ti-home',             label: '홈' },
  { to: 'timeline',   icon: 'ti-timeline',         label: '타임라인' },
  { to: 'my-part',    icon: 'ti-checklist',        label: '내 파트' },
  { to: 'dashboard',  icon: 'ti-layout-dashboard', label: '대시보드' },
  { to: 'comms',      icon: 'ti-message-circle',   label: '소통' },
]

export default function AppLayout() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex flex-col min-h-screen bg-oncue-bg">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-primary text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight">OnCue</span>
          {projectId && (
            <span className="text-primary-mid text-sm flex items-center gap-1">
              <i className="ti ti-chevron-right text-xs" />
              프로젝트
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 알림 버튼 */}
          <button className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center relative">
            <i className="ti ti-bell text-base" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-status-urgent border-2 border-primary" />
          </button>
          {/* 프로필 아바타 */}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
            {user?.displayName?.charAt(0) ?? '?'}
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-oncue-border">
        <div className="flex max-w-lg mx-auto">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-oncue-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`ti ${icon} text-xl ${isActive ? 'text-primary' : ''}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
