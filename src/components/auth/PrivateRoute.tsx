import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function PrivateRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-oncue-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary mb-2">OnCue</div>
          <div className="text-oncue-muted text-sm">로딩 중...</div>
        </div>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
