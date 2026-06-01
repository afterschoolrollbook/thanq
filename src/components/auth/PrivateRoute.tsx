import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// PrivateRoute가 useAuth()의 유일한 호출 지점입니다.
// onAuthStateChanged 구독은 여기서 딱 한 번만 시작됩니다.
export default function PrivateRoute() {
  const { user, loading } = useAuth()

  // Firebase가 로컬 캐시에서 인증 상태를 복원하는 동안 대기
  // → 이 가드 없이 바로 판단하면 로그인 직후에도 user=null 순간에 /login으로 튕김
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-[#185FA5] mb-2">ThanQ</div>
          <div className="text-[#64748B] text-sm">로딩 중...</div>
        </div>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
