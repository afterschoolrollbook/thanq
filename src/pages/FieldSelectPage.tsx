import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { FIELD_TERMS } from '@/utils/fieldTerms'
import { Topbar, StepBar } from '@/components/ui/Common'
import { readTemplateFile } from '@/utils/templateUtils'
import { verifyPassword } from '@/utils/templateUtils'
import type { FieldType, TemplateFile } from '@/types'

const FIELDS = [
  { key: 'event' as FieldType,     name: '행사 / 축제',   desc: '대학 축제, 기업 행사, 박람회',  icon: 'ti-confetti',  bg: '#E6F1FB', color: '#185FA5' },
  { key: 'film' as FieldType,      name: '드라마 / 영화',  desc: '촬영 현장, 광고, MV',           icon: 'ti-video',     bg: '#EEEDFE', color: '#534AB7' },
  { key: 'concert' as FieldType,   name: '콘서트 / 공연',  desc: '콘서트, 뮤지컬, 연극',          icon: 'ti-music',     bg: '#E1F5EE', color: '#0F6E56' },
  { key: 'fashion' as FieldType,   name: '패션쇼',         desc: '런웨이, 브랜드 쇼케이스',       icon: 'ti-hanger',    bg: '#FBEAF0', color: '#993556' },
  { key: 'sports' as FieldType,    name: '스포츠 / 대회',  desc: '마라톤, 체육대회, e스포츠',     icon: 'ti-trophy',    bg: '#FAEEDA', color: '#854F0B' },
  { key: 'broadcast' as FieldType, name: '방송 / 생방송',  desc: 'TV, 유튜브 라이브',             icon: 'ti-broadcast',    bg: '#FAECE7', color: '#993C1D' },
  { key: 'club' as FieldType,      name: '모임 / 클럽',    desc: '드라이브, 라이딩, 러닝, 등산',  icon: 'ti-users-group',  bg: '#E8F5E9', color: '#2E7D32' },
]

const FIELD_LABELS: Record<string, string> = {
  event: '행사/축제', film: '드라마/영화', concert: '콘서트/공연',
  fashion: '패션쇼', sports: '스포츠/대회', broadcast: '방송/생방송',
  club: '모임/클럽', custom: '직접 입력',
}

export default function FieldSelectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [selected, setSelected] = useState<FieldType | null>(null)
  const [custom, setCustom] = useState('')

  // 템플릿 관련 state
  const fileRef = useRef<HTMLInputElement>(null)
  const [showProGate, setShowProGate] = useState(false)
  const [tmplPreview, setTmplPreview] = useState<TemplateFile | null>(null)
  const [tmplNeedPw, setTmplNeedPw] = useState(false)
  const [tmplPw, setTmplPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [tmplError, setTmplError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showTmplModal, setShowTmplModal] = useState(false)

  // Firebase에서 이전에 선택한 분야 불러오기
  useEffect(() => {
    if (!user) return
    onValue(ref(db, `drafts/${user.uid}/fieldType`), (snap) => {
      if (snap.exists()) {
        const val = snap.val() as FieldType
        if (val === 'custom') return
        setSelected(val)
      }
    }, { onlyOnce: true })
  }, [user])

  function handleSelect(field: FieldType) {
    setSelected(field)
    setCustom('')
    if (user) update(ref(db, `drafts/${user.uid}`), { fieldType: field })
  }

  function handleCustom(val: string) {
    setCustom(val)
    setSelected(null)
    if (user) update(ref(db, `drafts/${user.uid}`), { fieldType: 'custom', customField: val })
  }

  function handleNext() {
    const field = selected ?? 'custom'
    sessionStorage.setItem('oncue_field', field)
    sessionStorage.setItem('oncue_terms', JSON.stringify(FIELD_TERMS[field]))
    navigate('/onboarding/create')
  }

  // 템플릿 버튼 클릭
  function handleTmplClick() {
    if (!user?.isPro) { setShowProGate(true); return }
    setShowTmplModal(true)
  }

  // 파일 처리
  async function handleFile(file: File) {
    setTmplError('')
    setTmplPreview(null)
    setTmplNeedPw(false)
    setTmplPw('')
    setPwError('')
    try {
      const tmpl = await readTemplateFile(file)
      if (tmpl.passwordHash) {
        setTmplPreview(tmpl)
        setTmplNeedPw(true)
      } else {
        setTmplPreview(tmpl)
      }
    } catch (e: unknown) {
      setTmplError((e as Error).message)
    }
  }

  async function handleVerifyPw() {
    if (!tmplPreview || !tmplPw) { setPwError('비밀번호를 입력해주세요'); return }
    setVerifying(true)
    setPwError('')
    const ok = await verifyPassword(tmplPw, tmplPreview.passwordHash!)
    setVerifying(false)
    if (ok) setTmplNeedPw(false)
    else setPwError('비밀번호가 올바르지 않아요')
  }

  // 템플릿으로 바로 프로젝트 만들기 진행
  function handleTmplApply() {
    if (!tmplPreview) return
    // 템플릿 데이터를 sessionStorage에 저장 → CreateProjectPage에서 읽어서 자동 세팅
    sessionStorage.setItem('oncue_field', tmplPreview.fieldType)
    sessionStorage.setItem('oncue_terms', JSON.stringify(FIELD_TERMS[tmplPreview.fieldType] ?? FIELD_TERMS['event']))
    sessionStorage.setItem('oncue_template', JSON.stringify(tmplPreview))
    navigate('/onboarding/create')
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={2} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">어떤 현장에서 사용하실 건가요?</h2>
        <p className="text-[13px] text-[#64748B] mb-5 leading-relaxed">선택한 분야에 맞는 용어와 템플릿이 자동으로 세팅됩니다. 나중에 언제든 변경 가능해요.</p>

        {/* 템플릿으로 시작하기 버튼 */}
        <button
          onClick={handleTmplClick}
          className="w-full flex items-center gap-3 px-4 py-3.5 mb-5 bg-white border-2 border-[#185FA5] rounded-[14px] hover:bg-[#E6F1FB] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[#E6F1FB] flex items-center justify-center flex-shrink-0">
            <i className="ti ti-file-import text-[#185FA5] text-[20px]" />
          </div>
          <div className="text-left flex-1">
            <div className="text-[14px] font-bold text-[#185FA5]">템플릿으로 바로 시작하기</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">.thanq 파일 불러오면 분야·파트가 자동 세팅돼요</div>
          </div>
          {!user?.isPro
            ? <span className="px-2 py-0.5 bg-[#185FA5] text-white text-[10px] font-bold rounded-full">PRO</span>
            : <i className="ti ti-arrow-right text-[#185FA5] text-[16px]" />
          }
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-[11px] text-[#A0AEC0] font-medium">또는 분야를 직접 선택</span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {FIELDS.map(({ key, name, desc, icon, bg, color }) => (
            <button key={key} onClick={() => handleSelect(key)}
              className={`text-left p-3.5 rounded-[14px] border-2 transition-all ${selected === key ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white hover:border-[#185FA5]'}`}>
              <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-2" style={{ background: bg }}>
                <i className={`ti ${icon} text-[18px]`} style={{ color }} />
              </div>
              <div className="text-[13px] font-semibold text-[#1A1A2E]">{name}</div>
              <div className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{desc}</div>
              {selected === key && (
                <div className="inline-flex items-center gap-1 mt-1.5 bg-[#185FA5] text-white text-[10px] px-2 py-0.5 rounded-full">
                  <i className="ti ti-check text-[10px]" /> 선택됨
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3.5 py-3 border border-dashed border-[#E2E8F0] rounded-[10px] mb-6">
          <i className="ti ti-pencil text-[16px] text-[#A0AEC0]" />
          <input className="flex-1 bg-transparent outline-none text-[13px] text-[#1A1A2E] placeholder-[#A0AEC0]"
            placeholder="직접 입력 — 다른 현장이라면 여기에 입력하세요"
            value={custom} onChange={(e) => handleCustom(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button onClick={handleNext} disabled={!selected && !custom.trim()}
            className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            <i className="ti ti-arrow-right" /> 다음
          </button>
        </div>
      </div>

      {/* ── Pro 게이트 모달 ── */}
      {showProGate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setShowProGate(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-6 pb-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-[#E6F1FB] flex items-center justify-center mb-3">
                <i className="ti ti-crown text-[#185FA5] text-[32px]" />
              </div>
              <div className="text-[18px] font-bold text-[#1A1A2E] mb-1">Pro 버전 전용 기능이에요</div>
              <div className="text-[13px] text-[#64748B] leading-relaxed">
                템플릿 불러오기는 <span className="font-semibold text-[#185FA5]">ThanQ Pro</span> 플랜에서만<br />
                사용할 수 있어요. 무료 플랜에서는<br />분야와 파트를 직접 입력해야 해요.
              </div>
            </div>
            <div className="flex gap-2 mb-5">
              <div className="flex-1 bg-[#F4F6F9] rounded-[12px] p-3">
                <div className="text-[11px] font-bold text-[#A0AEC0] mb-2">무료</div>
                <div className="flex flex-col gap-1.5 text-[12px] text-[#64748B]">
                  <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 분야 직접 선택</span>
                  <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 파트 직접 입력</span>
                  <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 템플릿 저장(.thanq)</span>
                  <span className="flex items-center gap-1.5 text-[#A0AEC0]"><i className="ti ti-x text-[#E24B4A] text-[12px]" /> 템플릿 불러오기</span>
                </div>
              </div>
              <div className="flex-1 bg-[#EBF4FF] border-2 border-[#185FA5] rounded-[12px] p-3">
                <div className="text-[11px] font-bold text-[#185FA5] mb-2">PRO ✦</div>
                <div className="flex flex-col gap-1.5 text-[12px] text-[#1A1A2E]">
                  <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 분야 직접 선택</span>
                  <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 파트 직접 입력</span>
                  <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 템플릿 저장(.thanq)</span>
                  <span className="flex items-center gap-1.5 font-semibold"><i className="ti ti-check text-[#0F6E56] text-[12px]" /> 템플릿 불러오기</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowProGate(false); navigate('/upgrade') }}
                className="w-full h-[48px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2">
                <i className="ti ti-crown text-[16px]" /> Pro로 업그레이드
              </button>
              <button onClick={() => setShowProGate(false)}
                className="w-full h-[42px] text-[#64748B] text-[13px]">
                직접 입력할게요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 템플릿 불러오기 모달 (Pro) ── */}
      {showTmplModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
          onClick={() => { setShowTmplModal(false); setTmplPreview(null); setTmplNeedPw(false) }}>
          <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8"
            onClick={(e) => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[16px] font-bold text-[#1A1A2E]">템플릿으로 시작하기</div>
                <div className="text-[12px] text-[#64748B] mt-0.5">.thanq 파일을 불러오면 분야·파트가 자동 세팅돼요</div>
              </div>
              <button onClick={() => { setShowTmplModal(false); setTmplPreview(null); setTmplNeedPw(false) }}>
                <i className="ti ti-x text-[18px] text-[#A0AEC0]" />
              </button>
            </div>

            {/* 파일 업로드 영역 */}
            {!tmplPreview && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileRef.current?.click()}
                className={`w-full min-h-[160px] border-2 border-dashed rounded-[14px] flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                  dragOver ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] hover:border-[#185FA5] hover:bg-[#F8FBFF]'
                }`}>
                <div className="w-12 h-12 rounded-full bg-[#E6F1FB] flex items-center justify-center">
                  <i className="ti ti-file-import text-[#185FA5] text-[22px]" />
                </div>
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-[#1A1A2E]">파일을 여기에 드래그하거나 클릭하세요</div>
                  <div className="text-[12px] text-[#A0AEC0] mt-1">.thanq 파일만 지원돼요</div>
                </div>
                <input ref={fileRef} type="file" accept=".thanq" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            )}

            {/* 비밀번호 입력 */}
            {tmplPreview && tmplNeedPw && (
              <div className="flex flex-col items-center py-4">
                <div className="w-14 h-14 rounded-full bg-[#FFF8E1] flex items-center justify-center mb-3">
                  <i className="ti ti-lock text-[#B45309] text-[26px]" />
                </div>
                <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">{tmplPreview.name}</div>
                <div className="text-[12px] text-[#64748B] mb-4">이 파일은 비밀번호로 보호되어 있어요</div>
                <div className="w-full mb-3">
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={tmplPw}
                      onChange={(e) => { setTmplPw(e.target.value); setPwError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyPw()}
                      placeholder="비밀번호 입력"
                      className={`w-full h-[42px] border rounded-[10px] px-3 pr-10 text-[13px] focus:outline-none ${pwError ? 'border-[#E24B4A]' : 'border-[#E2E8F0] focus:border-[#B45309]'}`} />
                    <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0AEC0]">
                      <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} text-[16px]`} />
                    </button>
                  </div>
                  {pwError && <p className="text-[11px] text-[#E24B4A] mt-1.5 pl-1">{pwError}</p>}
                </div>
                <div className="flex gap-2 w-full">
                  <button onClick={() => { setTmplPreview(null); setTmplNeedPw(false) }}
                    className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">다른 파일</button>
                  <button onClick={handleVerifyPw} disabled={verifying}
                    className="flex-1 h-[42px] bg-[#B45309] text-white rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <i className="ti ti-lock-open text-[14px]" />
                    {verifying ? '확인 중...' : '잠금 해제'}
                  </button>
                </div>
              </div>
            )}

            {/* 미리보기 */}
            {tmplPreview && !tmplNeedPw && (
              <div className="bg-[#F4F6F9] rounded-[14px] p-4 mb-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#185FA5] flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-file-zip text-white text-[18px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-[14px] font-bold text-[#1A1A2E]">{tmplPreview.name}</div>
                      {tmplPreview.passwordHash && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[#FFF8E1] text-[#B45309] rounded-full font-semibold">
                          <i className="ti ti-lock text-[10px]" /> 해제됨
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#64748B] mt-0.5">
                      {FIELD_LABELS[tmplPreview.fieldType] ?? tmplPreview.fieldType} · {tmplPreview.authorName}
                    </div>
                    {tmplPreview.description && (
                      <div className="text-[12px] text-[#64748B] mt-1 line-clamp-2">{tmplPreview.description}</div>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-[#64748B] mb-2">포함된 파트 ({tmplPreview.parts.length}개)</div>
                <div className="flex flex-col gap-1.5">
                  {tmplPreview.parts.map((p, i) => (
                    <div key={i} className="bg-white rounded-[8px] px-3 py-2 flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-[#1A1A2E]">{p.name}</div>
                        <div className="text-[11px] text-[#A0AEC0]">큐시트 {p.cueItems.length}개 · 체크 {p.checkItems.length}개</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTmplPreview(null)}
                  className="mt-3 text-[12px] text-[#64748B] flex items-center gap-1 hover:text-[#185FA5]">
                  <i className="ti ti-refresh text-[13px]" /> 다른 파일 선택
                </button>
              </div>
            )}

            {tmplError && <p className="text-[12px] text-[#A32D2D] mb-3">{tmplError}</p>}

            {tmplPreview && !tmplNeedPw && (
              <button onClick={handleTmplApply}
                className="w-full h-[46px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2">
                <i className="ti ti-rocket text-[16px]" /> 이 템플릿으로 프로젝트 시작
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
