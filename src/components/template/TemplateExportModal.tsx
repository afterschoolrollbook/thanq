import { useState } from 'react'
import { exportProjectAsTemplateJson } from '@/utils/templateUtils'
import { useAuthStore } from '@/store/authStore'
import type { Project } from '@/types'

interface Props {
  project: Project
  onClose: () => void
}

export default function TemplateExportModal({ project, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const [name, setName] = useState(project.name + ' 템플릿')
  const [description, setDescription] = useState('')

  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [useEmail, setUseEmail] = useState(false)
  const [allowedEmail, setAllowedEmail] = useState('')

  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    if (!name.trim()) { setError('템플릿 이름을 입력해주세요'); return }
    if (usePassword) {
      if (!password) { setError('비밀번호를 입력해주세요'); return }
      if (password.length < 4) { setError('비밀번호는 4자 이상이어야 해요'); return }
      if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않아요'); return }
    }
    if (useEmail && !allowedEmail.trim()) { setError('이메일을 입력해주세요'); return }
    if (useEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedEmail.trim())) {
      setError('올바른 이메일 형식을 입력해주세요'); return
    }
    setExporting(true)
    setError('')
    try {
      const exportedJson = await exportProjectAsTemplateJson(
        project.id,
        name.trim(),
        description.trim(),
        user?.displayName ?? '익명',
        project.fieldType,
        usePassword ? password : undefined,
        useEmail ? allowedEmail.trim() : undefined,
      )
      const blob = new Blob([exportedJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${name.trim()}.thanq`; a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch {
      setError('내보내기 중 오류가 발생했어요')
    } finally {
      setExporting(false)
    }
  }

  function Toggle({ on }: { on: boolean }) {
    return (
      <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${on ? 'bg-[#185FA5]' : 'bg-[#E2E8F0]'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[16px] font-bold text-[#1A1A2E]">템플릿으로 내보내기</div>
            <div className="text-[12px] text-[#64748B] mt-0.5">파트·큐시트·체크리스트를 .thanq 파일로 저장해요</div>
          </div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-3">
              <i className="ti ti-check text-[#0F6E56] text-[28px]" />
            </div>
            <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">내보내기 완료!</div>
            <div className="text-[13px] text-[#64748B] mb-4">{name}.thanq 파일이 다운로드됐어요</div>
            <div className="flex flex-col items-center gap-1.5 mb-5">
              {useEmail && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E6F1FB] rounded-full">
                  <i className="ti ti-mail text-[#185FA5] text-[12px]" />
                  <span className="text-[12px] text-[#185FA5] font-semibold">{allowedEmail} 전용 파일</span>
                </div>
              )}
              {usePassword && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF8E1] rounded-full">
                  <i className="ti ti-lock text-[#B45309] text-[12px]" />
                  <span className="text-[12px] text-[#B45309] font-semibold">비밀번호 보호 설정됨</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => window.open('/blog/write', '_blank')}
                className="w-full h-[44px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-2">
                <i className="ti ti-edit text-[15px]" /> 블로그에 공유하기
              </button>
              <button onClick={onClose}
                className="w-full h-[44px] bg-[#F4F6F9] text-[#64748B] rounded-[10px] text-[13px] font-semibold">
                닫기
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 자동 제외 안내 */}
            <div className="flex items-start gap-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] px-3 py-2.5 mb-4">
              <i className="ti ti-shield-check text-[#16A34A] text-[15px] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-[#166534]">
                담당자 배정·연락처 정보는 <strong>자동으로 제외</strong>돼요. 메모·체크리스트에 직접 입력한 연락처는 포함될 수 있으니 확인해주세요.
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-4">

              {/* 이름 */}
              <div>
                <label className={lbl}>템플릿 이름</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
              </div>

              {/* 설명 */}
              <div>
                <label className={lbl}>설명 <span className="font-normal text-[#A0AEC0]">(선택)</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="어떤 행사에 적합한지, 파트 구성 특징 등을 적어주세요"
                  rows={3}
                  className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#185FA5] resize-none" />
              </div>

              {/* 이메일 제한 */}
              <div className="border border-[#E2E8F0] rounded-[12px] overflow-hidden">
                <button
                  onClick={() => { setUseEmail(!useEmail); setAllowedEmail('') }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FBFF] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${useEmail ? 'bg-[#E6F1FB]' : 'bg-[#F4F6F9]'}`}>
                      <i className={`ti ti-mail text-[16px] ${useEmail ? 'text-[#185FA5]' : 'text-[#A0AEC0]'}`} />
                    </div>
                    <div className="text-left">
                      <div className="text-[13px] font-semibold text-[#1A1A2E]">이메일 제한</div>
                      <div className="text-[11px] text-[#A0AEC0]">지정한 ThanQ 계정만 파일을 열 수 있어요</div>
                    </div>
                  </div>
                  <Toggle on={useEmail} />
                </button>
                {useEmail && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#F4F6F9]">
                    <label className="text-[11px] font-semibold text-[#64748B] mb-1 block">
                      파일을 전달받을 사람의 ThanQ 로그인 이메일
                    </label>
                    <input type="email" value={allowedEmail}
                      onChange={(e) => setAllowedEmail(e.target.value)}
                      placeholder="받는 사람의 ThanQ 이메일 입력"
                      className="w-full h-[38px] border border-[#E2E8F0] rounded-[8px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]" />
                    <div className="flex items-start gap-1.5 text-[11px] text-[#185FA5] bg-[#E6F1FB] rounded-[8px] px-3 py-2 mt-2">
                      <i className="ti ti-info-circle text-[12px] mt-0.5 flex-shrink-0" />
                      파일을 열 때 ThanQ에 로그인한 이메일과 비교해요. 이메일이 다르면 파일을 열 수 없으니 정확히 입력해주세요.
                    </div>
                  </div>
                )}
              </div>

              {/* 비밀번호 설정 */}
              <div className="border border-[#E2E8F0] rounded-[12px] overflow-hidden">
                <button
                  onClick={() => { setUsePassword(!usePassword); setPassword(''); setPasswordConfirm('') }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FBFF] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${usePassword ? 'bg-[#FFF8E1]' : 'bg-[#F4F6F9]'}`}>
                      <i className={`ti ti-lock text-[16px] ${usePassword ? 'text-[#B45309]' : 'text-[#A0AEC0]'}`} />
                    </div>
                    <div className="text-left">
                      <div className="text-[13px] font-semibold text-[#1A1A2E]">비밀번호 설정</div>
                      <div className="text-[11px] text-[#A0AEC0]">파일을 열 때 비밀번호를 입력해야 해요</div>
                    </div>
                  </div>
                  <Toggle on={usePassword} />
                </button>
                {usePassword && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#F4F6F9] flex flex-col gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#64748B] mb-1 block">비밀번호</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="4자 이상 입력"
                          className="w-full h-[38px] border border-[#E2E8F0] rounded-[8px] px-3 pr-9 text-[13px] focus:outline-none focus:border-[#B45309]" />
                        <button onClick={() => setShowPw(!showPw)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0AEC0]">
                          <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} text-[15px]`} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#64748B] mb-1 block">비밀번호 확인</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="동일하게 입력"
                          className={`w-full h-[38px] border rounded-[8px] px-3 pr-9 text-[13px] focus:outline-none ${
                            passwordConfirm && password !== passwordConfirm
                              ? 'border-[#E24B4A]'
                              : passwordConfirm && password === passwordConfirm
                              ? 'border-[#0F6E56]'
                              : 'border-[#E2E8F0] focus:border-[#B45309]'
                          }`} />
                        {passwordConfirm && (
                          <i className={`ti ${password === passwordConfirm ? 'ti-check text-[#0F6E56]' : 'ti-x text-[#E24B4A]'} absolute right-2.5 top-1/2 -translate-y-1/2 text-[14px]`} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 text-[11px] text-[#B45309] bg-[#FFF8E1] rounded-[8px] px-3 py-2">
                      <i className="ti ti-alert-triangle text-[12px] mt-0.5 flex-shrink-0" />
                      비밀번호를 잊으면 복구할 수 없어요. 파일 전달 시 받는 사람에게 비밀번호를 따로 알려주세요.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-[12px] text-[#A32D2D] mb-3">{error}</p>}

            <button onClick={handleExport} disabled={exporting}
              className="w-full h-[46px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <i className="ti ti-download text-[16px]" />
              {exporting ? '내보내는 중...' : '.thanq 파일로 내보내기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const inp = 'w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]'
const lbl = 'text-[12px] font-semibold text-[#64748B] mb-1 block'
