import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

// 앱 전체에서 단 한 번만 구독 등록
let unsubscribeFn: (() => void) | null = null

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    // 이미 구독 중이면 재등록 안 함
    if (unsubscribeFn) return

    unsubscribeFn = onAuthStateChanged(auth, async (firebaseUser) => {
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

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? undefined,
          emailVerified: firebaseUser.emailVerified,
          createdAt: firebaseUser.metadata.creationTime ?? '',
          isPro,
        })
        setLoading(false)

        // DB 저장은 백그라운드 처리
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
  }, [])

  return { user, loading }
}
