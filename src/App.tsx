import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'
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
import SiteAdminPage from '@/pages/SiteAdminPage'
import AdminPage from '@/pages/AdminPage'
import BlogPage from '@/pages/BlogPage'
import BlogPostPage from '@/pages/BlogPostPage'
import BlogWritePage from '@/pages/BlogWritePage'
import LandingPage from '@/pages/LandingPage'
import JoinPage from '@/pages/JoinPage'
import TemplatePage from '@/pages/TemplatePage'
import MyPage from '@/pages/MyPage'

// 앱 최상단에서 딱 한 번 Firebase auth 구독
// PrivateRoute 마운트 타이밍과 무관하게 항상 동작
function AuthProvider() {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let isPro = false
        try {
          const [proSnap, adminSnap] = await Promise.all([
            get(ref(db, `users/${firebaseUser.uid}/isPro`)),
            get(ref(db, `admins/${firebaseUser.uid}`)),
          ])
          const isAdmin = adminSnap.exists() && adminSnap.val() === true
          isPro = isAdmin || (proSnap.exists() ? Boolean(proSnap.val()) : false)
        } catch { /* 조회 실패 시 false */ }

        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? undefined,
          emailVerified: firebaseUser.emailVerified,
          createdAt: firebaseUser.metadata.creationTime ?? '',
          isPro,
        }
        setUser(user)
        setLoading(false)

        // DB 저장 백그라운드
        get(ref(db, `users/${firebaseUser.uid}/createdAt`))
          .then((existingSnap) =>
            update(ref(db, `users/${firebaseUser.uid}`), {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              displayName: firebaseUser.displayName ?? '',
              photoURL: firebaseUser.photoURL ?? null,
              createdAt: existingSnap.exists()
                ? existingSnap.val()
                : (firebaseUser.metadata.creationTime ?? new Date().toISOString()),
              lastLoginAt: new Date().toISOString(),
            })
          )
          .catch(() => {})
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:postId" element={<BlogPostPage />} />
        <Route path="/templates" element={<TemplatePage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/my" element={<MyPage />} />
        </Route>
        <Route element={<PrivateRoute />}>
          <Route path="/blog/write" element={<BlogWritePage />} />
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
            <Route path="admin"      element={<AdminPage />} />
          </Route>
        </Route>
        <Route path="/admin" element={<SiteAdminPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
