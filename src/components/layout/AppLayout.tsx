import { Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9]">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
