import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // isPro, isAdmin 동시 조회
        let isPro = false
        try {
          const [proSnap, adminSnap] = await Promise.all([
            get(ref(db, `users/${firebaseUser.uid}/isPro`)),
            get(ref(db, `admins/${firebaseUser.uid}`)),
          ])
          const isAdmin = adminSnap.exists() && adminSnap.val() === true
          // 관리자는 자동으로 Pro 처리
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
        // (createdAt은 최초 1회만 기록, 이후엔 덮어쓰지 않음)
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
  }, [setUser, setLoading])

  return { user, loading }
}
