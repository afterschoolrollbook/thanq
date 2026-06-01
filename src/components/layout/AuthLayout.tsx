import { useNavigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#185FA5] to-[#0d3f6e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 — 클릭 시 메인으로 */}
        <button
          onClick={() => navigate('/')}
          className="w-full text-center mb-8 hover:opacity-80 transition-opacity"
        >
          <h1 className="text-3xl font-bold text-white tracking-tight">ThanQ</h1>
          <p className="text-[#B5D4F4] text-sm mt-1">현장 운영 통합 플랫폼</p>
        </button>

        {/* 카드 */}
        <div className="bg-white rounded-[14px] p-6 shadow-xl">
          <Outlet />
        </div>

        {/* 메인으로 돌아가기 */}
        <div className="text-center mt-5">
          <button
            onClick={() => navigate('/')}
            className="text-[13px] text-[#B5D4F4]/70 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
          >
            <i className="ti ti-arrow-left text-[13px]" />
            메인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
