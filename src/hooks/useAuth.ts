import { useAuthStore } from '@/store/authStore'

// onAuthStateChanged는 App.tsx의 AuthProvider에서 관리
// 이 훅은 authStore 값만 반환
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  return { user, loading }
}
