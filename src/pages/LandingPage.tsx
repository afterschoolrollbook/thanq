import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const FEATURES = [
  { icon: 'ti-layout-list', title: '큐시트 실시간 공유', desc: '파트별 큐시트를 팀 전원이 동시에 보고 수정해요.', color: '#185FA5', bg: '#E6F1FB' },
  { icon: 'ti-radio', title: 'PTT 무전 통신', desc: '앱 하나로 파트 간 무전을 주고받아요.', color: '#0F6E56', bg: '#E1F5EE' },
  { icon: 'ti-file-export', title: '템플릿 파일 공유', desc: '완성한 행사 구성을 .thanq 파일로 공유해요.', color: '#854F0B', bg: '#FAEEDA' },
  { icon: 'ti-checkbox', title: '체크리스트 관리', desc: '파트별 준비 항목을 실시간으로 체크해요.', color: '#534AB7', bg: '#EEEDFE' },
  { icon: 'ti-chart-bar', title: '진행 현황 대시보드', desc: '전체 파트의 진행률을 한눈에 확인해요.', color: '#993C1D', bg: '#FAECE7' },
  { icon: 'ti-users', title: '분야별 자동 세팅', desc: '분야를 선택하면 용어와 구성이 자동으로 맞춰져요.', color: '#185FA5', bg: '#E6F1FB' },
]

const USE_CASES = [
  { icon: '🎪', label: '행사/축제' },
  { icon: '🎬', label: '드라마/영화' },
  { icon: '🎵', label: '콘서트/공연' },
  { icon: '👗', label: '패션쇼' },
  { icon: '⚽', label: '스포츠/대회' },
  { icon: '📺', label: '방송/생방송' },
  { icon: '🏔', label: '등산/모임' },
  { icon: '✏️', label: '직접 설정' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
          {/* 로고 */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-[7px] bg-[#185FA5] flex items-center justify-center">
              <i className="ti ti-bolt text-white text-[14px]" />
            </div>
            <span className="text-[16px] font-bold tracking-tight">ThanQ</span>
          </button>

          {/* PC 메뉴 */}
          <div className="hidden sm:flex items-center gap-1">
            <button onClick={() => navigate('/blog')}
              className="px-4 py-2 text-[13px] text-white/70 hover:text-white transition-colors rounded-[8px] hover:bg-white/5">
              블로그
            </button>
            <button onClick={() => navigate('/templates')}
              className="px-4 py-2 text-[13px] text-white/70 hover:text-white transition-colors rounded-[8px] hover:bg-white/5">
              템플릿
            </button>
            {user ? (
              <button onClick={() => navigate('/dashboard')}
                className="ml-2 px-4 py-2 bg-[#185FA5] rounded-[8px] text-[13px] font-semibold hover:bg-[#1470BE] transition-colors">
                대시보드
              </button>
            ) : (
              <button onClick={() => navigate('/login')}
                className="ml-2 px-4 py-2 bg-[#185FA5] rounded-[8px] text-[13px] font-semibold hover:bg-[#1470BE] transition-colors">
                로그인
              </button>
            )}
          </div>

          {/* 모바일 햄버거 */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-[8px] bg-white/8 border border-white/15">
            <i className={`ti ${mobileMenuOpen ? 'ti-x' : 'ti-menu-2'} text-white text-[16px]`} />
          </button>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
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
            <div className="h-px bg-white/10 my-1" />
            {user ? (
              <button onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false) }}
                className="w-full h-[44px] bg-[#185FA5] rounded-[10px] text-[14px] font-bold flex items-center justify-center gap-2">
                <i className="ti ti-layout-dashboard text-[15px]" /> 대시보드
              </button>
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
        {/* 배경 */}
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
            현장 운영팀을 위한 실시간 협업 도구
          </div>

          <h1 className="text-[38px] sm:text-[56px] font-black leading-[1.1] tracking-tight mb-5">
            현장을 하나로<br />
            <span style={{ background: 'linear-gradient(135deg, #3B9EE8, #4ADE80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              연결하세요
            </span>
          </h1>

          <p className="text-[15px] sm:text-[16px] text-white/60 leading-relaxed mb-8 max-w-lg mx-auto px-2">
            행사, 공연, 촬영 현장에서 팀 전체가 큐시트를 실시간으로 공유하고,
            파트 간 소통을 앱 하나로 해결해요.
          </p>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 sm:px-0">
            <button onClick={handleStart}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#185FA5] hover:bg-[#1470BE] rounded-[12px] text-[15px] font-bold transition-colors flex items-center justify-center gap-2">
              <i className="ti ti-rocket text-[16px]" />
              무료로 시작하기
            </button>
            <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={() => navigate('/blog')}
                className="flex-1 sm:flex-none px-5 py-3.5 bg-white/8 hover:bg-white/12 border border-white/15 rounded-[12px] text-[14px] font-semibold transition-colors flex items-center justify-center gap-2">
                <i className="ti ti-news text-[15px]" />
                블로그
              </button>
              <button onClick={() => navigate('/templates')}
                className="flex-1 sm:flex-none px-5 py-3.5 bg-white/8 hover:bg-white/12 border border-white/15 rounded-[12px] text-[14px] font-semibold transition-colors flex items-center justify-center gap-2">
                <i className="ti ti-file-export text-[15px]" />
                템플릿
              </button>
            </div>
          </div>

          {/* 분야 태그 */}
          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {USE_CASES.map((u) => (
              <span key={u.label}
                className="px-3 py-1.5 rounded-full bg-white/6 border border-white/10 text-[12px] text-white/60">
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
          <h2 className="text-[26px] sm:text-[36px] font-black tracking-tight">현장 운영의 모든 것</h2>
          <p className="text-[13px] sm:text-[14px] text-white/50 mt-3 max-w-md mx-auto">분야에 상관없이 운영팀이 필요한 기능을 한곳에 모았어요</p>
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

      {/* ── 사용 흐름 ── */}
      <section className="px-5 py-14 sm:py-16 bg-white/3 border-y border-white/8">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="text-[11px] font-semibold text-[#4ADE80] uppercase tracking-widest mb-3">How it works</div>
          <h2 className="text-[26px] sm:text-[30px] font-black tracking-tight">3분이면 시작해요</h2>
        </div>
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
          {[
            { step: '01', icon: 'ti-plus', title: '프로젝트 생성', desc: '분야를 선택하고 행사를 만들어요. 용어와 구성이 자동으로 세팅돼요.', color: '#3B9EE8' },
            { step: '02', icon: 'ti-users-plus', title: '팀원 초대', desc: '초대 코드를 공유해요. 팀원이 파트에 참여하면 바로 협업이 시작돼요.', color: '#4ADE80' },
            { step: '03', icon: 'ti-player-play', title: '현장 운영', desc: '큐시트 확인, 체크리스트 체크, 실시간 소통까지 앱 하나로 해결해요.', color: '#FBBF24' },
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
          {/* 블로그 */}
          <div className="bg-gradient-to-br from-[#185FA5]/30 to-[#185FA5]/10 border border-white/10 rounded-[20px] p-6 sm:p-8 flex flex-col">
            <i className="ti ti-news text-[28px] text-[#3B9EE8] mb-4" />
            <h3 className="text-[18px] sm:text-[20px] font-black mb-2">블로그</h3>
            <p className="text-[13px] text-white/55 mb-5 leading-relaxed flex-1">
              사용자들의 노하우, 운영 후기, 공지사항을 확인해요.
            </p>
            <button onClick={() => navigate('/blog')}
              className="w-full h-[42px] bg-[#185FA5] hover:bg-[#1470BE] rounded-[10px] text-[13px] font-bold transition-colors flex items-center justify-center gap-2">
              <i className="ti ti-arrow-right text-[14px]" /> 블로그 바로가기
            </button>
          </div>
          {/* 템플릿 */}
          <div className="bg-gradient-to-br from-[#854F0B]/30 to-[#854F0B]/10 border border-white/10 rounded-[20px] p-6 sm:p-8 flex flex-col">
            <i className="ti ti-file-export text-[28px] text-[#F59E0B] mb-4" />
            <h3 className="text-[18px] sm:text-[20px] font-black mb-2">템플릿 공유</h3>
            <p className="text-[13px] text-white/55 mb-5 leading-relaxed flex-1">
              다른 사람의 행사 구성을 .thanq 파일로 받아 바로 적용해요.
            </p>
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
          <h2 className="text-[28px] sm:text-[40px] font-black tracking-tight mb-4">지금 바로 시작해요</h2>
          <p className="text-[13px] sm:text-[14px] text-white/50 mb-8">무료로 사용할 수 있어요. 카드 등록 불필요.</p>
          <button onClick={handleStart}
            className="w-full sm:w-auto px-8 py-4 bg-[#185FA5] hover:bg-[#1470BE] rounded-[14px] text-[16px] font-black transition-colors inline-flex items-center justify-center gap-2">
            <i className="ti ti-rocket text-[17px]" />
            무료로 시작하기
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
            <button onClick={handleStart} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">시작하기</button>
          </div>
          <div className="text-[12px] text-white/25">© 2026 ThanQ. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
