import { useState } from 'react'
import { exportProjectAsTemplate } from '@/utils/templateUtils'
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
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    if (!name.trim()) { setError('템플릿 이름을 입력해주세요'); return }
    setExporting(true)
    try {
      await exportProjectAsTemplate(
        project.id,
        name.trim(),
        description.trim(),
        user?.displayName ?? '익명',
        project.fieldType
      )
      setDone(true)
    } catch {
      setError('내보내기 중 오류가 발생했어요')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8"
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
            <div className="text-[13px] text-[#64748B] mb-1">{name}.thanq 파일이 다운로드됐어요</div>
            <div className="text-[12px] text-[#A0AEC0]">블로그에 게시해서 다른 사람과 공유해보세요</div>
            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => window.open('/blog/write', '_blank')}
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
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-[12px] font-semibold text-[#64748B] mb-1 block">템플릿 이름</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#64748B] mb-1 block">설명 <span className="font-normal text-[#A0AEC0]">(선택)</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="어떤 행사에 적합한지, 파트 구성 특징 등을 적어주세요"
                  rows={3}
                  className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#185FA5] resize-none" />
              </div>
            </div>

            {/* 포함 내용 안내 */}
            <div className="bg-[#F4F6F9] rounded-[10px] p-3 mb-4 text-[12px] text-[#64748B]">
              <div className="font-semibold text-[#1A1A2E] mb-1.5 flex items-center gap-1.5">
                <i className="ti ti-info-circle text-[14px] text-[#185FA5]" /> 포함되는 내용
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56]" /> 파트 구성 및 색상</span>
                <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56]" /> 큐시트 항목 (시간 포함)</span>
                <span className="flex items-center gap-1.5"><i className="ti ti-check text-[#0F6E56]" /> 체크리스트 항목</span>
                <span className="flex items-center gap-1.5 text-[#A0AEC0]"><i className="ti ti-x text-[#E24B4A]" /> 개인 정보 (담당자 이름, 연락처) 제외</span>
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
