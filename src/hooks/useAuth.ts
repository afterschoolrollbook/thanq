import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

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

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? undefined,
          emailVerified: firebaseUser.emailVerified,
          createdAt: firebaseUser.metadata.creationTime ?? '',
          isPro,
        })
        // DB 쓰기와 무관하게 즉시 loading 해제
        setLoading(false)

        // 관리자 페이지 회원 목록 저장 — 백그라운드 처리 (로그인 흐름 차단 안 함)
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
          .catch(() => { /* 저장 실패해도 무관 */ })

      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}
