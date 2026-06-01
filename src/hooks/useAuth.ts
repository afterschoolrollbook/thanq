import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

export function useAuth() {
  // setUser, setLoading은 zustand가 stable reference를 보장하므로
  // 의존성 배열에 넣어도 무한루프 없음. 단, useEffect는 한 번만 실행되도록 [] 사용
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  // 반환용
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

    return () => unsubscribe()
  }, []) // ← 빈 배열: 마운트 시 딱 한 번만 구독, StrictMode 이중 실행 방어

  return { user, loading }
}
