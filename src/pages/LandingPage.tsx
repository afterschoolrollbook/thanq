import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import type { Coupon } from '@/types'

const FEATURES = [
  { icon: 'ti-layout-list', title: '큐시트 실시간 공유', desc: '파트별 큐시트를 팀 전원이 동시에 보고 수정해요.', color: '#185FA5', bg: '#E6F1FB' },
  { icon: 'ti-radio', title: 'PTT 무전 통신', desc: '앱 하나로 파트 간 무전을 주고받아요.', color: '#0F6E56', bg: '#E1F5EE' },
  { icon: 'ti-file-export', title: '템플릿 파일 공유', desc: '완성한 행사 구성을 .thanq 파일로 공유해요.', color: '#854F0B', bg: '#FAEEDA' },
  { icon: 'ti-checkbox', title: '체크리스트 관리', desc: '파트별 준비 항목을 실시간으로 체크해요.', color: '#534AB7', bg: '#EEEDFE' },
  { icon: 'ti-chart-bar', title: '진행 현황 대시보드', desc: '전체 파트의 진행률을 한눈에 확인해요.', color: '#993C1D', bg: '#FAECE7' },
  { icon: 'ti-users', title: '분야별 자동 세팅', desc: '파티 호스트, 스터디 팀장, 행사 감독 — 분야에 맞는 용어로 자동 세팅돼요.', color: '#185FA5', bg: '#E6F1FB' },
  { icon: 'ti-player-play', title: '사전 시뮬레이션', desc: '행사 전 큐시트 충돌·지연을 미리 점검하고 문제를 찾아요.', color: '#534AB7', bg: '#EEEDFE' },
]

const USE_CASES = [
  { icon: '🎂', label: '기념일/파티' },
  { icon: '🍳', label: '요리/클래스' },
  { icon: '📚', label: '스터디/독서' },
  { icon: '✈️', label: '여행/캠핑' },
  { icon: '🍽️', label: '소셜다이닝/미팅' },
  { icon: '🏃', label: '모임/클럽' },
  { icon: '🎪', label: '행사/축제' },
  { icon: '🎵', label: '콘서트/공연' },
  { icon: '⚽', label: '스포츠/대회' },
  { icon: '🎬', label: '드라마/영화' },
  { icon: '📺', label: '방송/생방송' },
  { icon: '👗', label: '패션쇼' },
  { icon: '✏️', label: '직접 입력' },
]

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '무료',
    priceDesc: '영원히 무료',
    color: '#64748B',
    badgeBg: '#F4F6F9',
    highlight: false,
    features: [
      { text: '프로젝트 생성', ok: true },
      { text: '파트 직접 입력', ok: true },
      { text: '큐시트 · 체크리스트', ok: true },
      { text: '팀원 초대', ok: true },
      { text: '템플릿 저장 · 불러오기', ok: false },
      { text: 'AI 무전 (PTT)', ok: false },
    ],
    cta: '무료로 시작',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '₩9,900',
    priceDesc: '/ 월',
    color: '#185FA5',
    badgeBg: '#185FA5',
    highlight: true,
    features: [
      { text: '프로젝트 생성', ok: true },
      { text: '파트 직접 입력', ok: true },
      { text: '큐시트 · 체크리스트', ok: true },
      { text: '팀원 초대', ok: true },
      { text: '템플릿 저장 · 불러오기', ok: true },
      { text: 'AI 무전 (PTT)', ok: true },
    ],
    cta: 'Pro 시작하기',
  },
]

// ── 업그레이드 모달 (export해서 다른 곳에서도 사용) ──────────
export function UpgradeModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [couponCode, setCouponCode] = useState('')
  const [couponMsg, setCouponMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [applying, setApplying] = useState(false)

  async function applyCoupon() {
    if (!couponCode.trim() || !user) return
    setApplying(true)
    setCouponMsg(null)
    try {
      // Firebase에서 쿠폰 조회
      const snap = await new Promise<any>((resolve) => {
        onValue(ref(db, `coupons/${couponCode.trim().toUpperCase()}`), resolve, { onlyOnce: true })
      })
      if (!snap.exists()) {
        setCouponMsg({ type: 'err', text: '존재하지 않는 쿠폰이에요' })
        setApplying(false)
        return
      }
      const coupon = snap.val() as Coupon
      // 만료 확인
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        setCouponMsg({ type: 'err', text: '만료된 쿠폰이에요' })
        setApplying(false)
        return
      }
      // 사용 횟수 확인
      if (coupon.maxUses && (coupon.usedCount ?? 0) >= coupon.maxUses) {
        setCouponMsg({ type: 'err', text: '이미 소진된 쿠폰이에요' })
        setApplying(false)
        return
      }
      // 이미 사용한 유저인지 확인
      if (coupon.usedBy?.[user.uid]) {
        setCouponMsg({ type: 'err', text: '이미 사용한 쿠폰이에요' })
        setApplying(false)
        return
      }

      // 적용 — Firebase 업데이트는 Cloud Function에서 처리하는 게 이상적이지만
      // 여기서는 클라이언트에서 직접 처리 (간단 구현)
      const { set: fbSet, update: fbUpdate } = await import('firebase/database')
      // isPro 활성화
      await fbSet(ref(db, `users/${user.uid}/isPro`), true)
      // Pro 만료일 설정 (기간 쿠폰인 경우)
      if (coupon.durationDays) {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + coupon.durationDays)
        await fbSet(ref(db, `users/${user.uid}/proExpiresAt`), expiry.toISOString())
      }
      // 쿠폰 사용 기록
      await fbUpdate(ref(db, `coupons/${couponCode.trim().toUpperCase()}`), {
        usedCount: (coupon.usedCount ?? 0) + 1,
        [`usedBy/${user.uid}`]: new Date().toISOString(),
      })

      const msg = coupon.durationDays
        ? `${coupon.durationDays}일 무료 Pro가 활성화됐어요!`
        : 'Pro가 활성화됐어요!'
      setCouponMsg({ type: 'ok', text: msg })
      setTimeout(() => { onClose(); window.location.reload() }, 2000)
    } catch {
      setCouponMsg({ type: 'err', text: '오류가 발생했어요. 다시 시도해주세요' })
    }
    setApplying(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center px-0 sm:px-4"
      onClick={onClose}>
      <div className="bg-[#0A0F1E] w-full sm:max-w-2xl rounded-t-[24px] sm:rounded-[24px] border border-white/10 overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <div className="text-[20px] font-black text-white">ThanQ 요금제</div>
            <div className="text-[13px] text-white/50 mt-0.5">현장 운영팀을 위한 플랜을 선택하세요</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <i className="ti ti-x text-white text-[16px]" />
          </button>
        </div>

        {/* 플랜 카드 */}
        <div className="px-6 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((plan) => (
            <div key={plan.key}
              className={`rounded-[16px] p-5 border ${plan.highlight ? 'border-[#185FA5] bg-[#0D1829]' : 'border-white/10 bg-white/4'}`}>
              {plan.highlight && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#185FA5] text-white text-[10px] font-bold mb-3">
                  <i className="ti ti-crown text-[10px]" /> 추천
                </div>
              )}
              <div className="text-[14px] font-bold mb-1" style={{ color: plan.highlight ? '#3B9EE8' : '#94A3B8' }}>{plan.name}</div>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-[28px] font-black text-white">{plan.price}</span>
                <span className="text-[13px] text-white/40 mb-1">{plan.priceDesc}</span>
              </div>
              <div className="flex flex-col gap-2 mb-5">
                {plan.features.map((f) => (
                  <div key={f.text} className={`flex items-center gap-2 text-[12px] ${f.ok ? 'text-white/80' : 'text-white/25'}`}>
                    <i className={`ti ${f.ok ? 'ti-check text-[#4ADE80]' : 'ti-x text-white/20'} text-[12px] flex-shrink-0`} />
                    {f.text}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { onClose(); navigate(user ? '/onboarding/field' : '/login') }}
                className={`w-full h-[42px] rounded-[10px] text-[13px] font-bold transition-colors ${
                  plan.highlight
                    ? 'bg-[#185FA5] hover:bg-[#1470BE] text-white'
                    : 'bg-white/8 hover:bg-white/12 text-white border border-white/10'
                }`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* 쿠폰 입력 */}
        <div className="px-6 py-5 border-t border-white/8 mt-2">
          <div className="text-[13px] font-semibold text-white/70 mb-3 flex items-center gap-2">
            <i className="ti ti-ticket text-[#3B9EE8] text-[15px]" /> 쿠폰 코드 입력
          </div>
          {couponMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-[8px] mb-2 text-[12px] font-semibold ${
              couponMsg.type === 'ok' ? 'bg-[#0A2010] text-[#4ADE80]' : 'bg-[#2A0A0A] text-[#F87171]'
            }`}>
              <i className={`ti ${couponMsg.type === 'ok' ? 'ti-check' : 'ti-alert-circle'} text-[13px]`} />
              {couponMsg.text}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
              placeholder="쿠폰 코드를 입력하세요"
              className="flex-1 h-[42px] bg-white/6 border border-white/15 rounded-[10px] px-4 text-[13px] text-white placeholder-white/30 outline-none focus:border-[#185FA5]"
            />
            <button onClick={applyCoupon} disabled={applying || !couponCode.trim() || !user}
              className="h-[42px] px-5 bg-[#185FA5] hover:bg-[#1470BE] text-white rounded-[10px] text-[13px] font-bold disabled:opacity-40 flex items-center gap-2">
              {applying ? <i className="ti ti-loader-2 animate-spin text-[14px]" /> : '적용'}
            </button>
          </div>
          {!user && <p className="text-[11px] text-white/30 mt-2">쿠폰 적용은 로그인 후 가능해요</p>}
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  // LandingPage는 PrivateRoute 밖 → 여기서 직접 useAuth() 호출해 인증 상태 초기화
  const { user, loading: authLoading } = useAuth()
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    onValue(ref(db, `admins/${user.uid}`), (s) => {
      setIsAdmin(s.exists() && s.val() === true)
    }, { onlyOnce: true })
  }, [user])

  function handleStart() {
    if (user) navigate('/dashboard')
    else navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white overflow-x-hidden">

      {/* ── 네비게이션 ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrollY > 40 ? 'bg-[#0A0F1E]/95 backdrop-blur-md border-b border-white/10' : ''
      }`}>
        <div className="max-w-5xl mx-auto px-5 h-[60px] flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-[7px] bg-[#185FA5] flex items-center justify-center">
              <i className="ti ti-bolt text-white text-[14px]" />
            </div>
            <span className="text-[16px] font-bold tracking-tight">ThanQ</span>
          </button>
          <div className="hidden sm:flex items-center gap-1">
            <button onClick={() => navigate('/blog')}
              className="px-4 py-2 text-[13px] text-white/70 hover:text-white transition-colors rounded-[8px] hover:bg-white/5">
              블로그
            </button>
            <button onClick={() => navigate('/templates')}
              className="px-4 py-2 text-[13px] text-white/70 hover:text-white transition-colors rounded-[8px] hover:bg-white/5">
              템플릿
            </button>
            <button onClick={() => setShowUpgrade(true)}
              className="px-4 py-2 text-[13px] text-white/70 hover:text-white transition-colors rounded-[8px] hover:bg-white/5">
              요금제
            </button>
            {authLoading ? (
              // Firebase 인증 확인 중 — 깜빡임 방지용 스켈레톤
              <div className="ml-2 w-24 h-8 rounded-[8px] bg-white/10 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2 ml-2">
                {isAdmin && (
                  <button onClick={() => navigate('/admin')}
                    className="px-3 py-2 rounded-[8px] text-[12px] font-semibold border border-[#FAEEDA]/40 text-[#FAEEDA] hover:bg-[#FAEEDA]/10 transition-colors flex items-center gap-1">
                    <i className="ti ti-shield text-[13px]" /> 관리자
                  </button>
                )}
                <button onClick={() => navigate('/my')}
                  className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="마이페이지">
                  <i className="ti ti-user text-white text-[14px]" />
                </button>
                <button onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-[#185FA5] rounded-[8px] text-[13px] font-semibold hover:bg-[#1470BE] transition-colors">
                  대시보드
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')}
                className="ml-2 px-4 py-2 bg-[#185FA5] rounded-[8px] text-[13px] font-semibold hover:bg-[#1470BE] transition-colors">
                로그인
              </button>
            )}
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-[8px] bg-white/8 border border-white/15">
            <i className={`ti ${mobileMenuOpen ? 'ti-x' : 'ti-menu-2'} text-white text-[16px]`} />
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden bg-[#0D1829]/98 backdrop-blur-md border-b border-white/10 px-5 py-4 flex flex-col gap-2">
            <button onClick={() => { navigate('/blog'); setMobileMenuOpen(false) }}
              className="flex items-center gap-3 px-3 py-3 rounded-[10px] text-[14px] text-white/70 hover:text-white hover:bg-white/8 transition-colors text-left">
              <i className="ti ti-news text-[16px] text-[#185FA5]" /> 블로그
            </button>
            <button onClick={() => { navigate('/templates'); setMobileMenuOpen(false) }}
              className="flex items-center gap-3 px-3 py-3 rounded-[10px] text-[14px] text-white/70 hover:text-white hover:bg-white/8 transition-colors text-left">
              <i className="ti ti-file-export text-[16px] text-[#854F0B]" /> 템플릿 공유
            </button>
            <button onClick={() => { setShowUpgrade(true); setMobileMenuOpen(false) }}
              className="flex items-center gap-3 px-3 py-3 rounded-[10px] text-[14px] text-white/70 hover:text-white hover:bg-white/8 transition-colors text-left">
              <i className="ti ti-credit-card text-[16px] text-[#3B9EE8]" /> 요금제
            </button>
            <div className="h-px bg-white/10 my-1" />
            {authLoading ? (
              <div className="w-full h-[44px] rounded-[10px] bg-white/10 animate-pulse" />
            ) : user ? (
              <div className="flex flex-col gap-2">
                {isAdmin && (
                  <button onClick={() => { navigate('/admin'); setMobileMenuOpen(false) }}
                    className="w-full h-[44px] border border-[#FAEEDA]/40 rounded-[10px] text-[14px] font-bold flex items-center justify-center gap-2 text-[#FAEEDA]">
                    <i className="ti ti-shield text-[15px]" /> 관리자 콘솔
                  </button>
                )}
                <button onClick={() => { navigate('/my'); setMobileMenuOpen(false) }}
                  className="w-full h-[44px] bg-white/8 border border-white/15 rounded-[10px] text-[14px] font-bold flex items-center justify-center gap-2 text-white/80">
                  <i className="ti ti-user text-[15px]" /> 마이페이지
                </button>
                <button onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false) }}
                  className="w-full h-[44px] bg-[#185FA5] rounded-[10px] text-[14px] font-bold flex items-center justify-center gap-2">
                  <i className="ti ti-layout-dashboard text-[15px]" /> 대시보드
                </button>
              </div>
            ) : (
              <button onClick={() => { navigate('/login'); setMobileMenuOpen(false) }}
                className="w-full h-[44px] bg-[#185FA5] rounded-[10px] text-[14px] font-bold flex items-center justify-center gap-2">
                <i className="ti ti-login text-[15px]" /> 로그인
              </button>
            )}
          </div>
        )}
      </nav>

      {/* ── 히어로 ── */}
      <div ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-[60px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(24,95,165,0.15) 0%, transparent 70%)' }} />
          <div className="absolute top-[30%] right-[5%] w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(15,110,86,0.1) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
        <div className="relative z-10 text-center max-w-2xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 text-[12px] text-white/70 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            생일, 설날, 소풍, 콘서트… 사람이 모이는 모든 곳에서
          </div>
          <h1 className="text-[38px] sm:text-[56px] font-black leading-[1.1] tracking-tight mb-5">
            사람이 모이는<br />
            <span style={{ background: 'linear-gradient(135deg, #3B9EE8, #4ADE80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              모든 순간에
            </span>
          </h1>
          <p className="text-[15px] sm:text-[16px] text-white/60 leading-relaxed mb-8 max-w-lg mx-auto px-2">
            생일, 설날, 추석, 여행, 소풍, 콘서트까지
            사람이 모이면 ThanQ 하나로 준비부터 마무리까지.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 sm:px-0">
            <button onClick={handleStart}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#185FA5] hover:bg-[#1470BE] rounded-[12px] text-[15px] font-bold transition-colors flex items-center justify-center gap-2">
              <i className="ti ti-rocket text-[16px]" /> 무료로 시작하기
            </button>
            <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={() => setShowUpgrade(true)}
                className="flex-1 sm:flex-none px-5 py-3.5 bg-white/8 hover:bg-white/12 border border-white/15 rounded-[12px] text-[14px] font-semibold transition-colors flex items-center justify-center gap-2">
                <i className="ti ti-crown text-[15px] text-[#3B9EE8]" /> 요금제
              </button>
              <button onClick={() => navigate('/templates')}
                className="flex-1 sm:flex-none px-5 py-3.5 bg-white/8 hover:bg-white/12 border border-white/15 rounded-[12px] text-[14px] font-semibold transition-colors flex items-center justify-center gap-2">
                <i className="ti ti-file-export text-[15px]" /> 템플릿
              </button>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {USE_CASES.map((u) => (
              <span key={u.label} className="px-3 py-1.5 rounded-full bg-white/6 border border-white/10 text-[12px] text-white/60">
                {u.icon} {u.label}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/30">
          <span className="text-[11px]">스크롤</span>
          <i className="ti ti-chevrons-down text-[16px] animate-bounce" />
        </div>
      </div>

      {/* ── 기능 소개 ── */}
      <section className="px-5 py-16 sm:py-20 max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="text-[11px] font-semibold text-[#3B9EE8] uppercase tracking-widest mb-3">Features</div>
          <h2 className="text-[26px] sm:text-[36px] font-black tracking-tight">모임의 모든 순간을 함께</h2>
          <p className="text-[13px] sm:text-[14px] text-white/50 mt-3 max-w-md mx-auto">두 명이 모이든, 2000명이 모이든 — 필요한 기능을 한곳에 모았어요</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {FEATURES.map((f) => (
            <div key={f.title}
              className="bg-white/4 border border-white/8 rounded-[16px] p-5 hover:bg-white/7 hover:border-white/15 transition-all">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4"
                style={{ background: f.bg + '22', border: `1px solid ${f.color}44` }}>
                <i className={`ti ${f.icon} text-[18px]`} style={{ color: f.color }} />
              </div>
              <div className="text-[15px] font-bold mb-2">{f.title}</div>
              <div className="text-[13px] text-white/50 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 가격 섹션 ── */}
      <section id="pricing" className="px-5 py-16 sm:py-20 bg-white/3 border-y border-white/8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold text-[#3B9EE8] uppercase tracking-widest mb-3">Pricing</div>
            <h2 className="text-[26px] sm:text-[36px] font-black tracking-tight mb-3">심플한 요금제</h2>
            <p className="text-[13px] text-white/50">무료로 시작하고, 필요할 때 업그레이드하세요</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {PLANS.map((plan) => (
              <div key={plan.key}
                className={`rounded-[20px] p-6 border relative ${plan.highlight ? 'border-[#185FA5] bg-[#0D1829]' : 'border-white/10 bg-white/4'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#185FA5] rounded-full text-[11px] font-bold text-white flex items-center gap-1">
                    <i className="ti ti-crown text-[11px]" /> 추천 플랜
                  </div>
                )}
                <div className="text-[14px] font-bold mb-1" style={{ color: plan.highlight ? '#3B9EE8' : '#94A3B8' }}>{plan.name}</div>
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-[32px] font-black text-white">{plan.price}</span>
                  <span className="text-[13px] text-white/40 mb-1.5">{plan.priceDesc}</span>
                </div>
                <div className="flex flex-col gap-2.5 mb-6">
                  {plan.features.map((f) => (
                    <div key={f.text} className={`flex items-center gap-2.5 text-[13px] ${f.ok ? 'text-white/80' : 'text-white/25'}`}>
                      <i className={`ti ${f.ok ? 'ti-check text-[#4ADE80]' : 'ti-x text-white/20'} text-[13px] flex-shrink-0`} />
                      {f.text}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => plan.highlight ? setShowUpgrade(true) : handleStart()}
                  className={`w-full h-[46px] rounded-[12px] text-[14px] font-bold transition-colors ${
                    plan.highlight
                      ? 'bg-[#185FA5] hover:bg-[#1470BE] text-white'
                      : 'bg-white/8 hover:bg-white/12 text-white border border-white/10'
                  }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* 쿠폰 안내 */}
          <div className="flex items-center justify-center gap-2 text-[13px] text-white/40">
            <i className="ti ti-ticket text-[#3B9EE8] text-[15px]" />
            쿠폰 코드가 있으신가요?
            <button onClick={() => setShowUpgrade(true)} className="text-[#3B9EE8] font-semibold hover:underline">
              여기서 입력하세요
            </button>
          </div>
        </div>
      </section>

      {/* ── 사용 흐름 ── */}
      <section className="px-5 py-14 sm:py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="text-[11px] font-semibold text-[#4ADE80] uppercase tracking-widest mb-3">How it works</div>
          <h2 className="text-[26px] sm:text-[30px] font-black tracking-tight">3분이면 준비 끝</h2>
        </div>
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
          {[
            { step: '01', icon: 'ti-plus', title: '모임 만들기', desc: '생일파티, 설날 가족 모임, 여행, 행사 등 분야를 고르면 모든 게 자동으로 세팅돼요.', color: '#3B9EE8' },
            { step: '02', icon: 'ti-users-plus', title: '같이 할 사람 초대', desc: '링크 하나 보내면 끝! 가족, 친구, 동료가 각자 역할을 맡아요.', color: '#4ADE80' },
            { step: '03', icon: 'ti-player-play', title: '같이 즐기기', desc: '할 일 확인, 준비물 체크, 실시간 소통까지 — 앱 하나로 걱정 없이 즐겨요.', color: '#FBBF24' },
          ].map((s) => (
            <div key={s.step} className="text-center flex sm:flex-col items-center sm:items-center gap-5 sm:gap-0">
              <div className="w-14 h-14 sm:mb-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: s.color + '60', background: s.color + '15' }}>
                <i className={`ti ${s.icon} text-[22px]`} style={{ color: s.color }} />
              </div>
              <div className="text-left sm:text-center">
                <div className="text-[11px] font-bold tracking-widest mb-1 sm:mb-2" style={{ color: s.color }}>STEP {s.step}</div>
                <div className="text-[16px] font-bold mb-1 sm:mb-2">{s.title}</div>
                <div className="text-[13px] text-white/50 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 블로그 + 템플릿 CTA ── */}
      <section className="px-5 py-14 sm:py-16 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-[#185FA5]/30 to-[#185FA5]/10 border border-white/10 rounded-[20px] p-6 sm:p-8 flex flex-col">
            <i className="ti ti-news text-[28px] text-[#3B9EE8] mb-4" />
            <h3 className="text-[18px] sm:text-[20px] font-black mb-2">블로그</h3>
            <p className="text-[13px] text-white/55 mb-5 leading-relaxed flex-1">파티 기획 노하우, 행사 운영 후기, 다양한 사용 사례를 확인해요.</p>
            <button onClick={() => navigate('/blog')}
              className="w-full h-[42px] bg-[#185FA5] hover:bg-[#1470BE] rounded-[10px] text-[13px] font-bold transition-colors flex items-center justify-center gap-2">
              <i className="ti ti-arrow-right text-[14px]" /> 블로그 바로가기
            </button>
          </div>
          <div className="bg-gradient-to-br from-[#854F0B]/30 to-[#854F0B]/10 border border-white/10 rounded-[20px] p-6 sm:p-8 flex flex-col">
            <i className="ti ti-file-export text-[28px] text-[#F59E0B] mb-4" />
            <h3 className="text-[18px] sm:text-[20px] font-black mb-2">템플릿 공유</h3>
            <p className="text-[13px] text-white/55 mb-5 leading-relaxed flex-1">다른 사람의 행사 구성을 .thanq 파일로 받아 바로 적용해요.</p>
            <button onClick={() => navigate('/templates')}
              className="w-full h-[42px] bg-[#854F0B] hover:bg-[#6B3E08] rounded-[10px] text-[13px] font-bold transition-colors flex items-center justify-center gap-2">
              <i className="ti ti-arrow-right text-[14px]" /> 템플릿 보러가기
            </button>
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ── */}
      <section className="px-5 py-16 sm:py-20 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="text-[28px] sm:text-[40px] font-black tracking-tight mb-4">다음 모임, ThanQ로 시작해요</h2>
          <p className="text-[13px] sm:text-[14px] text-white/50 mb-8">생일이든, 설날이든, 번개 모임이든 — 무료로 바로 시작해요.</p>
          <button onClick={handleStart}
            className="w-full sm:w-auto px-8 py-4 bg-[#185FA5] hover:bg-[#1470BE] rounded-[14px] text-[16px] font-black transition-colors inline-flex items-center justify-center gap-2">
            <i className="ti ti-rocket text-[17px]" /> 무료로 시작하기
          </button>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-white/8 px-5 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-[6px] bg-[#185FA5] flex items-center justify-center">
              <i className="ti ti-bolt text-white text-[11px]" />
            </div>
            <span className="text-[13px] font-bold">ThanQ</span>
          </button>
          <div className="flex items-center gap-5">
            <button onClick={() => navigate('/blog')} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">블로그</button>
            <button onClick={() => navigate('/templates')} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">템플릿</button>
            <button onClick={() => setShowUpgrade(true)} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">요금제</button>
            <button onClick={handleStart} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">시작하기</button>
          </div>
          <div className="text-[12px] text-white/25">© 2026 ThanQ. All rights reserved.</div>
        </div>
      </footer>

      {/* 업그레이드 모달 */}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
