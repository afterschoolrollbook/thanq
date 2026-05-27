import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '@/lib/firebase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function goNext(uid: string) {
    const snap = await get(ref(db, 'projects'))
    if (snap.exists()) {
      // 내 프로젝트가 있는지 확인
      const projects = Object.values(snap.val()) as { ownerId: string }[]
      const mine = projects.find((p) => p.ownerId === uid)
      if (mine) { navigate('/dashboard'); return }
    }
    navigate('/dashboard')
  }

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
        await goNext(user.uid)
      } else {
        const { user } = await signInWithEmailAndPassword(auth, email, password)
        await goNext(user.uid)
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/wrong-password' || code === 'auth/user-not-found') setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      else if (code === 'auth/email-already-in-use') setError('이미 사용 중인 이메일입니다.')
      else if (code === 'auth/weak-password') setError('비밀번호는 6자 이상이어야 합니다.')
      else setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
      await goNext(user.uid)
    } catch { setError('Google 로그인에 실패했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#185FA5] to-[#0d3f6e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">ThanQ</h1>
          <p className="text-[#B5D4F4] text-sm mt-1">현장 운영 통합 플랫폼</p>
        </div>
        <div className="bg-white rounded-[14px] p-6 shadow-xl">
          <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">{isSignUp ? '회원가입' : '시작하기'}</h2>
          <p className="text-[13px] text-[#64748B] mb-5">{isSignUp ? '계정을 만들고 ThanQ를 시작하세요' : '이메일 또는 소셜 계정으로 로그인하세요'}</p>
          <div className="space-y-3">
            {isSignUp && (
              <div>
                <label className="text-[12px] font-medium text-[#64748B] mb-1 block">이름</label>
                <input className={inp} placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="text-[12px] font-medium text-[#64748B] mb-1 block">이메일</label>
              <input className={inp} type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#64748B] mb-1 block">비밀번호</label>
              <input className={inp} type="password" placeholder="8자 이상, 대소문자+숫자+특수문자" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-[#A32D2D] text-[12px] mt-3">{error}</p>}
          {isSignUp && (
            <label className="flex items-start gap-2 mt-4 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[#185FA5]" />
              <span className="text-[12px] text-[#64748B]">가입 시 <button className="text-[#185FA5] underline">이용약관</button> 및 <button className="text-[#185FA5] underline">개인정보처리방침</button>에 동의합니다</span>
            </label>
          )}
          <button onClick={handleSubmit} disabled={loading}
            className="w-full h-[42px] bg-[#185FA5] text-white rounded-[10px] flex items-center justify-center gap-2 text-[14px] font-semibold mt-5 disabled:opacity-50">
            <i className="ti ti-arrow-right" /> {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인 / 회원가입'}
          </button>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#E2E8F0]" /><span className="text-[12px] text-[#A0AEC0]">또는</span><div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleGoogle} className="h-[40px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B]"><i className="ti ti-brand-google text-[15px]" /> Google</button>
            <button disabled className="h-[40px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#A0AEC0] opacity-40"><i className="ti ti-message-circle text-[15px]" /> Kakao</button>
            <button disabled className="h-[40px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#A0AEC0] opacity-40"><i className="ti ti-brand-apple text-[15px]" /> Apple</button>
          </div>
          <div className="flex items-start gap-2 mt-4">
            <div className="w-[17px] h-[17px] rounded bg-[#185FA5] flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ti ti-check text-white text-[11px]" />
            </div>
            <span className="text-[12px] text-[#64748B]">가입 시 <span className="text-[#185FA5]">이용약관</span> 및 <span className="text-[#185FA5]">개인정보처리방침</span>에 동의합니다</span>
          </div>
          <p className="text-center text-[12px] text-[#64748B] mt-5">
            {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}{' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-[#185FA5] font-semibold">{isSignUp ? '로그인' : '회원가입'}</button>
          </p>
        </div>
      </div>
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
