import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

// 앱 전체에서 onAuthStateChanged는 딱 한 번만 등록
// useAuth()를 여러 컴포넌트(LandingPage, PrivateRoute 등)에서 호출해도 중복 구독 없음
let isInitialized = false

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    // 이미 초기화된 경우 재구독하지 않음
    if (isInitialized) return
    isInitialized = true

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

        // 관리자 페이지 회원 목록을 위해 DB에 유저 정보 저장/갱신
        try {
          const existingSnap = await get(ref(db, `users/${firebaseUser.uid}/createdAt`))
          await update(ref(db, `users/${firebaseUser.uid}`), {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? '',
            photoURL: firebaseUser.photoURL ?? null,
            createdAt: existingSnap.exists()
              ? existingSnap.val()
              : (firebaseUser.metadata.creationTime ?? new Date().toISOString()),
            lastLoginAt: new Date().toISOString(),
          })
        } catch { /* DB 저장 실패해도 로그인은 계속 */ }

      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // 앱이 언마운트되면 구독 해제 + 플래그 리셋
    return () => {
      unsubscribe()
      isInitialized = false
    }
  }, [])

  return { user, loading }
}
