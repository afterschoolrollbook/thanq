import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthLayout from '@/components/layout/AuthLayout'
import AppLayout from '@/components/layout/AppLayout'
import PrivateRoute from '@/components/auth/PrivateRoute'
import LoginPage from '@/pages/LoginPage'
import MainDashboardPage from '@/pages/MainDashboardPage'
import ProjectsPage from '@/pages/ProjectsPage'
import FieldSelectPage from '@/pages/FieldSelectPage'
import CreateProjectPage from '@/pages/CreateProjectPage'
import SetupPartsPage from '@/pages/SetupPartsPage'
import ProjectHomePage from '@/pages/ProjectHomePage'
import MyPartPage from '@/pages/MyPartPage'
import DashboardPage from '@/pages/DashboardPage'
import TimelinePage from '@/pages/TimelinePage'
import CommsPage from '@/pages/CommsPage'
import LiveOpsPage from '@/pages/LiveOpsPage'
import PTTPage from '@/pages/PTTPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<MainDashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/onboarding/field" element={<FieldSelectPage />} />
          <Route path="/onboarding/create" element={<CreateProjectPage />} />
          <Route path="/onboarding/parts/:projectId" element={<SetupPartsPage />} />
        </Route>
        <Route element={<PrivateRoute />}>
          <Route path="/p/:projectId" element={<AppLayout />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home"       element={<ProjectHomePage />} />
            <Route path="timeline"   element={<TimelinePage />} />
            <Route path="my-part"    element={<MyPartPage />} />
            <Route path="dashboard"  element={<DashboardPage />} />
            <Route path="comms"      element={<CommsPage />} />
            <Route path="live"       element={<LiveOpsPage />} />
            <Route path="ptt"        element={<PTTPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
