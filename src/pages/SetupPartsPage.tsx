import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ref, push, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { PART_COLORS } from '@/utils/fieldTerms'
import { Topbar, StepBar } from '@/components/ui/Common'
import type { Part } from '@/types'

export default function SetupPartsPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [parts, setParts] = useState([{ name: '' }, { name: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update_(idx: number, name: string) { setParts(parts.map((p, i) => i === idx ? { name } : p)) }
  function add() { setParts([...parts, { name: '' }]) }
  function remove(idx: number) { setParts(parts.filter((_, i) => i !== idx)) }

  async function handleSave() {
    const valid = parts.filter((p) => p.name.trim())
    if (valid.length === 0) { setError('파트를 최소 1개 이상 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      const updates: Record<string, unknown> = {}
      valid.forEach((p, idx) => {
        const partRef = push(ref(db, `parts/${projectId}`))
        const part: Part = {
          id: partRef.key!, projectId: projectId!, name: p.name.trim(),
          color: PART_COLORS[idx % PART_COLORS.length], status: 'waiting',
          progress: 0, order: idx, createdAt: new Date().toISOString(),
        }
        updates[`parts/${projectId}/${part.id}`] = part
      })
      await update(ref(db), updates)
      navigate(`/p/${projectId}/home`)
    } catch { setError('저장 중 오류가 발생했어요') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={4} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">파트 구성 및 담당자 초대</h2>
        <p className="text-[13px] text-[#64748B] mb-6">행사 분야에 맞게 파트가 자동 세팅됐어요. 이름을 바꾸거나 파트를 추가할 수 있어요.</p>

        <div className="flex flex-col gap-2 mb-3">
          {parts.map((part, idx) => (
            <div key={idx} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[10px]">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PART_COLORS[idx % PART_COLORS.length] }} />
              <input className="flex-1 text-[13px] font-medium text-[#1A1A2E] outline-none bg-transparent placeholder-[#A0AEC0]"
                placeholder={`파트 ${idx + 1} 이름`} value={part.name} onChange={(e) => update_(idx, e.target.value)} />
              <div className="flex items-center gap-1.5 text-[#A0AEC0]">
                <i className="ti ti-user-plus text-[14px] cursor-pointer hover:text-[#185FA5]" />
                <span className="text-[12px]">담당자 초대</span>
              </div>
              <i className="ti ti-pencil text-[15px] text-[#A0AEC0] cursor-pointer hover:text-[#185FA5]" />
              {parts.length > 1 && <i className="ti ti-x text-[14px] text-[#A0AEC0] cursor-pointer hover:text-[#A32D2D]" onClick={() => remove(idx)} />}
            </div>
          ))}
        </div>

        <button onClick={add} className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-[#E2E8F0] rounded-[10px] text-[13px] text-[#A0AEC0] w-full mb-5 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
          <i className="ti ti-plus text-[15px]" /> 파트 추가
        </button>

        {/* 참여 코드 박스 */}
        <div className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[14px] p-4 mb-5">
          <div className="text-[12px] text-[#A0AEC0] text-center mb-1">참여 코드</div>
          <div className="text-[32px] font-bold tracking-[8px] text-[#185FA5] text-center my-2">ON-2847</div>
          <div className="text-[12px] text-[#A0AEC0] text-center mb-3">이 코드를 공유하면 담당자가 바로 합류할 수 있어요</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B]"><i className="ti ti-copy text-[14px]" /> 코드 복사</button>
            <button className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B]"><i className="ti ti-qrcode text-[14px]" /> QR 코드</button>
          </div>
        </div>

        {error && <p className="text-[#A32D2D] text-[12px] mb-3">{error}</p>}
        <div className="flex items-center justify-between pt-5 border-t border-[#E2E8F0]">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[13px] text-[#64748B]"><i className="ti ti-arrow-left text-[14px]" /> 이전</button>
          <button onClick={handleSave} disabled={loading} className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            <i className="ti ti-rocket" /> {loading ? '저장 중...' : '프로젝트 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}
