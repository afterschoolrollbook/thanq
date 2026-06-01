import { onAuthStateChanged } from 'firebase/auth'
import { ref, get, update } from 'firebase/database'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

// ── 앱 전체에서 단 한 번만 onAuthStateChanged 등록 ──
// 모듈 레벨 변수: 컴포넌트 마운트/언마운트에 영향받지 않음
let _unsubscribe: (() => void) | null = null

function initAuth() {
  if (_unsubscribe) return // 이미 등록됨 → 재등록 방지

  _unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
      useAuthStore.getState().setUser(user)

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
      useAuthStore.getState().setUser(null)
    }
    useAuthStore.getState().setLoading(false)
  })
}

// 앱 시작 시 즉시 초기화 (모듈 로드 시점)
initAuth()

// useAuth: store에서 상태만 읽어옴 — 구독은 위에서 이미 완료
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  return { user, loading }
}
