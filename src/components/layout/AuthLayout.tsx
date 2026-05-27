import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-[#0d3f6e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">OnCue</h1>
          <p className="text-primary-mid text-sm mt-1">현장 운영 통합 플랫폼</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-card p-6 shadow-card-hover">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
