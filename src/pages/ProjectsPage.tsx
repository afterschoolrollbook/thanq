import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-oncue-bg">
      {/* 헤더 */}
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">OnCue</span>
        <div className="flex items-center gap-2">
          <span className="text-primary-mid text-sm">{user?.displayName ?? user?.email}</span>
          <button onClick={handleLogout} className="text-primary-mid text-xs border border-primary-mid rounded px-2 py-1 hover:text-white hover:border-white transition-colors">
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-4">
        <h2 className="text-xl font-bold text-oncue-text mb-1">내 프로젝트</h2>
        <p className="text-oncue-muted text-sm mb-6">진행 중이거나 예정된 행사를 관리하세요</p>

        {/* 새 프로젝트 만들기 */}
        <button
          onClick={() => navigate('/onboarding/field')}
          className="w-full border-2 border-dashed border-primary-mid rounded-card p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary-light transition-colors mb-4"
        >
          <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
            <i className="ti ti-plus text-primary text-xl" />
          </div>
          <span className="text-primary font-semibold">새 프로젝트 만들기</span>
          <span className="text-oncue-muted text-xs">행사, 촬영, 공연 등 새 현장을 시작하세요</span>
        </button>

        {/* 참여 코드로 입장 */}
        <button className="w-full border border-oncue-border rounded-card p-4 flex items-center gap-3 hover:border-primary hover:bg-primary-light transition-colors bg-white">
          <div className="w-10 h-10 rounded-full bg-oncue-bg flex items-center justify-center">
            <i className="ti ti-key text-oncue-muted text-lg" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm text-oncue-text">참여 코드로 입장</div>
            <div className="text-oncue-muted text-xs">초대받은 프로젝트에 참여하기</div>
          </div>
          <i className="ti ti-chevron-right text-oncue-muted ml-auto" />
        </button>

        {/* 빈 상태 */}
        <div className="mt-8 text-center py-12 text-oncue-muted">
          <i className="ti ti-folder-open text-4xl mb-3 block opacity-40" />
          <p className="text-sm">아직 프로젝트가 없어요</p>
          <p className="text-xs mt-1 opacity-70">위에서 새 프로젝트를 만들어보세요</p>
        </div>
      </div>
    </div>
  )
}
