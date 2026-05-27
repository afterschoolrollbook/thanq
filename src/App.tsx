import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from '@/components/layout/AuthLayout'
import AppLayout from '@/components/layout/AppLayout'
import PrivateRoute from '@/components/auth/PrivateRoute'
import LoginPage from '@/pages/LoginPage'
import ProjectsPage from '@/pages/ProjectsPage'
import FieldSelectPage from '@/pages/FieldSelectPage'
import CreateProjectPage from '@/pages/CreateProjectPage'
import SetupPartsPage from '@/pages/SetupPartsPage'
import ProjectHomePage from '@/pages/ProjectHomePage'
import MyPartPage from '@/pages/MyPartPage'
import DashboardPage from '@/pages/DashboardPage'
import {
  TimelinePage,
  CommsPage,
} from '@/pages/placeholders'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 인증 라우트 */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* 온보딩 (로그인 후) */}
        <Route element={<PrivateRoute />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/onboarding/field" element={<FieldSelectPage />} />
          <Route path="/onboarding/create" element={<CreateProjectPage />} />
          <Route path="/onboarding/parts/:projectId" element={<SetupPartsPage />} />
        </Route>

        {/* 프로젝트 내부 (탭 네비게이션) */}
        <Route element={<PrivateRoute />}>
          <Route path="/p/:projectId" element={<AppLayout />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home"      element={<ProjectHomePage />} />
            <Route path="timeline"  element={<TimelinePage />} />
            <Route path="my-part"   element={<MyPartPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="comms"     element={<CommsPage />} />
          </Route>
        </Route>

        {/* 기본 리다이렉트 */}
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
