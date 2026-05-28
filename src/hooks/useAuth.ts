import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase DB에서 isPro 여부 조회
        let isPro = false
        try {
          const snap = await get(ref(db, `users/${firebaseUser.uid}/isPro`))
          isPro = snap.exists() ? Boolean(snap.val()) : false
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
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setLoading])

  return { user, loading }
}
