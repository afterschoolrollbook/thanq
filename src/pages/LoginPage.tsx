import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return }
    if (isSignUp && !name) { setError('이름을 입력해주세요.'); return }
    if (isSignUp && !agreed) { setError('약관에 동의해주세요.'); return }

    setLoading(true)
    try {
      if (isSignUp) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(user, { displayName: name })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      navigate('/projects')
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else if (code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다.')
      } else if (code === 'auth/weak-password') {
        setError('비밀번호는 6자 이상이어야 합니다.')
      } else {
        setError('오류가 발생했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      navigate('/projects')
    } catch {
      setError('Google 로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold text-oncue-text mb-1">
        {isSignUp ? '회원가입' : '시작하기'}
      </h2>
      <p className="text-oncue-muted text-sm mb-5">
        {isSignUp ? '계정을 만들고 ThanQ를 시작하세요' : '이메일 또는 소셜 계정으로 로그인하세요'}
      </p>

      <div className="space-y-3">
        {isSignUp && (
          <div>
            <label className="text-xs font-semibold text-oncue-muted mb-1 block">이름</label>
            <input
              className="input-field"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-oncue-muted mb-1 block">이메일</label>
          <input
            className="input-field"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-oncue-muted mb-1 block">비밀번호</label>
          <input
            className="input-field"
            type="password"
            placeholder="8자 이상, 대소문자+숫자+특수문자"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-status-urgent text-sm mt-3">{error}</p>
      )}

      {isSignUp && (
        <label className="flex items-start gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span className="text-xs text-oncue-muted">
            가입 시{' '}
            <button className="text-primary underline">이용약관</button> 및{' '}
            <button className="text-primary underline">개인정보처리방침</button>에 동의합니다
          </span>
        </label>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary w-full justify-center mt-5"
      >
        <i className="ti ti-arrow-right" />
        {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-oncue-border" />
        <span className="text-xs text-oncue-muted">또는</span>
        <div className="flex-1 h-px bg-oncue-border" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleGoogle}
          className="btn-outline justify-center py-2.5 gap-1.5"
        >
          <i className="ti ti-brand-google text-base" />
          <span>Google</span>
        </button>
        <button className="btn-outline justify-center py-2.5 gap-1.5 opacity-40 cursor-not-allowed" disabled>
          <i className="ti ti-message-circle text-base" />
          <span>Kakao</span>
        </button>
        <button className="btn-outline justify-center py-2.5 gap-1.5 opacity-40 cursor-not-allowed" disabled>
          <i className="ti ti-brand-apple text-base" />
          <span>Apple</span>
        </button>
      </div>

      <p className="text-center text-xs text-oncue-muted mt-5">
        {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}{' '}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-primary font-semibold"
        >
          {isSignUp ? '로그인' : '회원가입'}
        </button>
      </p>
    </>
  )
}
