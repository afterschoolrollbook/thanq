import { useRef, useState } from 'react'
import { readTemplateFile, applyTemplateToProject, verifyPassword, verifyEmail, getTemplateLockType } from '@/utils/templateUtils'
import { useAuthStore } from '@/store/authStore'
import type { TemplateFile } from '@/types'

interface Props {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}

const FIELD_LABELS: Record<string, string> = {
  event: '행사/축제', film: '드라마/영화', concert: '콘서트/공연',
  fashion: '패션쇼', sports: '스포츠/대회', broadcast: '방송/생방송',
  club: '모임/클럽', custom: '직접 입력',
}

export default function TemplateImportModal({ projectId, onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const fileRef = useRef<HTMLInputElement>(null)

  // 단계: 'warning' → 파일 선택 → 미리보기 → 적용
  const [step, setStep] = useState<'warning' | 'import'>('warning')

  const [preview, setPreview] = useState<TemplateFile | null>(null)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)
  const [replaceMode, setReplaceMode] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // 잠금 해제 단계
  // 'email' | 'password' | 'both_email' | 'both_password' | null
  type LockStep = 'email' | 'password' | 'both_email' | 'both_password' | null
  const [lockStep, setLockStep] = useState<LockStep>(null)
  const [emailPassed, setEmailPassed] = useState(false)

  // 비밀번호
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [verifying, setVerifying] = useState(false)

  function reset() {
    setPreview(null)
    setLockStep(null)
    setEmailPassed(false)
    setPassword('')
    setPwError('')
    setError('')
  }

  async function handleFile(file: File) {
    reset()
    try {
      const tmpl = await readTemplateFile(file)
      const lockType = getTemplateLockType(tmpl)
      setPreview(tmpl)

      if (lockType === 'email') {
        // 이메일만 — 즉시 자동 검증
        if (!verifyEmail(user?.email, tmpl.allowedEmail!)) {
          setError(`이 파일은 ${tmpl.allowedEmail} 계정만 열 수 있어요`)
          setPreview(null)
        }
        // 통과 시 lockStep null → 바로 미리보기
      } else if (lockType === 'password') {
        setLockStep('password')
      } else if (lockType === 'both') {
        // 이메일 먼저 검증
        if (!verifyEmail(user?.email, tmpl.allowedEmail!)) {
          setError(`이 파일은 ${tmpl.allowedEmail} 계정만 열 수 있어요`)
          setPreview(null)
        } else {
          setEmailPassed(true)
          setLockStep('both_password') // 이메일 통과 → 비번 입력
        }
      }
      // lockType === null → 바로 미리보기
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  async function handleVerifyPassword() {
    if (!preview || !password) { setPwError('비밀번호를 입력해주세요'); return }
    setVerifying(true)
    setPwError('')
    const ok = await verifyPassword(password, preview.passwordHash!)
    setVerifying(false)
    if (ok) {
      setLockStep(null) // 통과 → 미리보기
    } else {
      setPwError('비밀번호가 올바르지 않아요')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleApply() {
    if (!preview) return
    setApplying(true)
    try {
      await applyTemplateToProject(projectId, preview, true)  // 항상 덮어쓰기
      onSuccess()
    } catch {
      setError('템플릿 적용 중 오류가 발생했어요')
    } finally {
      setApplying(false)
    }
  }

  const isLocked = lockStep !== null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[16px] font-bold text-[#1A1A2E]">
              {step === 'warning' ? '템플릿 불러오기 전 확인' : '템플릿 가져오기'}
            </div>
            <div className="text-[12px] text-[#64748B] mt-0.5">
              {step === 'warning' ? '반드시 읽어주세요' : '.thanq 파일을 불러와 파트를 자동으로 세팅해요'}
            </div>
          </div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>

        {/* ── 1단계: 경고 화면 ── */}
        {step === 'warning' && (
          <div>
            {/* 경고 아이콘 */}
            <div className="flex flex-col items-center py-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center mb-3">
                <i className="ti ti-alert-triangle text-[#DC2626] text-[32px]" />
              </div>
              <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">기존 작업이 모두 삭제됩니다</div>
              <div className="text-[12px] text-[#64748B] text-center leading-relaxed">
                템플릿을 불러오면 현재 프로젝트의<br />
                파트·큐시트·체크리스트가 <strong className="text-[#DC2626]">전부 삭제</strong>되고<br />
                템플릿 내용으로 교체됩니다.
              </div>
            </div>

            {/* 안내 목록 */}
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] p-4 mb-5 flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <i className="ti ti-x text-[#DC2626] text-[13px] mt-0.5 flex-shrink-0" />
                <span className="text-[12px] text-[#1A1A2E]">지금까지 추가한 <strong>파트, 큐시트, 체크리스트</strong>가 모두 사라져요</span>
              </div>
              <div className="flex items-start gap-2.5">
                <i className="ti ti-x text-[#DC2626] text-[13px] mt-0.5 flex-shrink-0" />
                <span className="text-[12px] text-[#1A1A2E]">삭제된 데이터는 <strong>복구할 수 없어요</strong></span>
              </div>
              <div className="flex items-start gap-2.5">
                <i className="ti ti-check text-[#16A34A] text-[13px] mt-0.5 flex-shrink-0" />
                <span className="text-[12px] text-[#1A1A2E]">완전히 새로 시작하거나 템플릿으로 교체할 때만 사용하세요</span>
              </div>
              <div className="flex items-start gap-2.5">
                <i className="ti ti-check text-[#16A34A] text-[13px] mt-0.5 flex-shrink-0" />
                <span className="text-[12px] text-[#1A1A2E]">기존 작업을 유지하려면 <strong>파트 세팅 화면</strong>에서 추가하세요</span>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 h-[46px] border border-[#E2E8F0] rounded-[12px] text-[13px] font-semibold text-[#64748B]">
                취소
              </button>
              <button onClick={() => setStep('import')}
                className="flex-1 h-[46px] bg-[#DC2626] text-white rounded-[12px] text-[13px] font-bold flex items-center justify-center gap-2">
                <i className="ti ti-alert-triangle text-[14px]" />
                이해했어요, 계속하기
              </button>
            </div>
          </div>
        )}

        {/* ── 2단계: 기존 파일 업로드 / 미리보기 / 적용 ── */}
        {step === 'import' && (<>

        {/* 파일 업로드 */}
        {!preview && !isLocked && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
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

        {/* 비밀번호 입력 단계 */}
        {preview && isLocked && (
          <div className="flex flex-col items-center py-4">
            {/* 이메일 통과 배지 (both 케이스) */}
            {emailPassed && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E1F5EE] rounded-full mb-4">
                <i className="ti ti-mail text-[#0F6E56] text-[12px]" />
                <span className="text-[12px] text-[#0F6E56] font-semibold">{user?.email} 확인됨</span>
                <i className="ti ti-check text-[#0F6E56] text-[12px]" />
              </div>
            )}
            <div className="w-14 h-14 rounded-full bg-[#FFF8E1] flex items-center justify-center mb-3">
              <i className="ti ti-lock text-[#B45309] text-[26px]" />
            </div>
            <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">{preview.name}</div>
            <div className="text-[12px] text-[#64748B] mb-4">이 파일은 비밀번호로 보호되어 있어요</div>

            <div className="w-full mb-3">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                  placeholder="비밀번호 입력"
                  className={`w-full h-[42px] border rounded-[10px] px-3 pr-10 text-[13px] focus:outline-none ${
                    pwError ? 'border-[#E24B4A]' : 'border-[#E2E8F0] focus:border-[#B45309]'
                  }`} />
                <button onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0AEC0]">
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} text-[16px]`} />
                </button>
              </div>
              {pwError && <p className="text-[11px] text-[#E24B4A] mt-1.5 pl-1">{pwError}</p>}
            </div>

            <div className="flex gap-2 w-full">
              <button onClick={reset}
                className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">
                다른 파일
              </button>
              <button onClick={handleVerifyPassword} disabled={verifying}
                className="flex-1 h-[42px] bg-[#B45309] text-white rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                <i className="ti ti-lock-open text-[14px]" />
                {verifying ? '확인 중...' : '잠금 해제'}
              </button>
            </div>
          </div>
        )}

        {/* 미리보기 */}
        {preview && !isLocked && (
          <div className="bg-[#F4F6F9] rounded-[14px] p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-[10px] bg-[#185FA5] flex items-center justify-center flex-shrink-0">
                <i className="ti ti-file-zip text-white text-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <div className="text-[14px] font-bold text-[#1A1A2E]">{preview.name}</div>
                  {/* 보호 배지 */}
                  {preview.allowedEmail && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[#E6F1FB] text-[#185FA5] rounded-full font-semibold">
                      <i className="ti ti-mail text-[10px]" /> 이메일 인증됨
                    </span>
                  )}
                  {preview.passwordHash && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[#FFF8E1] text-[#B45309] rounded-full font-semibold">
                      <i className="ti ti-lock text-[10px]" /> 잠금 해제됨
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[#64748B]">
                  {FIELD_LABELS[preview.fieldType] ?? preview.fieldType} · {preview.authorName}
                </div>
                {preview.description && (
                  <div className="text-[12px] text-[#64748B] mt-1 line-clamp-2">{preview.description}</div>
                )}
              </div>
            </div>

            <div className="text-[11px] font-semibold text-[#64748B] mb-2">포함된 파트 ({preview.parts.length}개)</div>
            <div className="flex flex-col gap-1.5">
              {preview.parts.map((p, i) => (
                <div key={i} className="bg-white rounded-[8px] px-3 py-2 flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#1A1A2E]">{p.name}</div>
                    <div className="text-[11px] text-[#A0AEC0]">
                      큐시트 {p.cueItems.length}개 · 체크 {p.checkItems.length}개
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={reset}
              className="mt-3 text-[12px] text-[#64748B] flex items-center gap-1 hover:text-[#185FA5]">
              <i className="ti ti-refresh text-[13px]" /> 다른 파일 선택
            </button>
          </div>
        )}

        {error && <p className="text-[12px] text-[#A32D2D] mb-3">{error}</p>}

        {preview && !isLocked && (
          <button onClick={handleApply} disabled={applying}
            className="w-full h-[46px] bg-[#DC2626] text-white rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <i className="ti ti-refresh text-[16px]" />
            {applying ? '교체 중...' : '기존 삭제 후 이 템플릿으로 교체'}
          </button>
        )}

        </>)}
      </div>
    </div>
  )
}
