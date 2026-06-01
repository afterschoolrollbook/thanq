import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

let isInitialized = false

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
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

    // cleanup: 구독만 해제, isInitialized는 리셋하지 않음
    // → 리셋하면 LandingPage 언마운트 시 구독이 끊겨 loading이 영원히 true가 됨
    return () => { unsubscribe() }
  }, [setUser, setLoading])

  return { user, loading }
}
