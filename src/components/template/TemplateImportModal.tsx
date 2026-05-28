import { useRef, useState } from 'react'
import { readTemplateFile, applyTemplateToProject } from '@/utils/templateUtils'
import type { TemplateFile } from '@/types'

interface Props {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}

export default function TemplateImportModal({ projectId, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<TemplateFile | null>(null)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    setError('')
    setPreview(null)
    try {
      const tmpl = await readTemplateFile(file)
      setPreview(tmpl)
    } catch (e: unknown) {
      setError((e as Error).message)
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
      await applyTemplateToProject(projectId, preview)
      onSuccess()
    } catch {
      setError('템플릿 적용 중 오류가 발생했어요')
    } finally {
      setApplying(false)
    }
  }

  const FIELD_LABELS: Record<string, string> = {
    event: '행사/축제', film: '드라마/영화', concert: '콘서트/공연',
    fashion: '패션쇼', sports: '스포츠/대회', broadcast: '방송/생방송',
    club: '모임/클럽', custom: '직접 입력',
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[16px] font-bold text-[#1A1A2E]">템플릿 가져오기</div>
            <div className="text-[12px] text-[#64748B] mt-0.5">.thanq 파일을 불러와 파트를 자동으로 세팅해요</div>
          </div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>

        {!preview ? (
          /* 파일 업로드 영역 */
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
        ) : (
          /* 미리보기 */
          <div className="bg-[#F4F6F9] rounded-[14px] p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-[10px] bg-[#185FA5] flex items-center justify-center flex-shrink-0">
                <i className="ti ti-file-zip text-white text-[18px]" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#1A1A2E]">{preview.name}</div>
                <div className="text-[12px] text-[#64748B] mt-0.5">
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

            <button onClick={() => setPreview(null)}
              className="mt-3 text-[12px] text-[#64748B] flex items-center gap-1 hover:text-[#185FA5]">
              <i className="ti ti-refresh text-[13px]" /> 다른 파일 선택
            </button>
          </div>
        )}

        {error && <p className="text-[12px] text-[#A32D2D] mb-3">{error}</p>}

        {preview && (
          <button onClick={handleApply} disabled={applying}
            className="w-full h-[46px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <i className="ti ti-check text-[16px]" />
            {applying ? '적용 중...' : `이 템플릿으로 파트 세팅하기`}
          </button>
        )}
      </div>
    </div>
  )
}
