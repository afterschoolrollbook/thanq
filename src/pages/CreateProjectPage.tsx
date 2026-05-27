import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { FIELD_TERMS } from '@/utils/fieldTerms'
import { generateJoinCode } from '@/utils/joinCode'
import { Topbar, StepBar } from '@/components/ui/Common'
import type { FieldType, Project } from '@/types'

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fieldType = (sessionStorage.getItem('oncue_field') ?? 'event') as FieldType

  const [name, setName] = useState('')
  const [dateType, setDateType] = useState<'single' | 'range'>('single')
  const [date, setDate] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [venue, setVenue] = useState('')
  const [people, setPeople] = useState('')
  const [budget, setBudget] = useState('')
  const [overview, setOverview] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleNext() {
    if (!user) return
    setLoading(true)
    try {
      const projectRef = push(ref(db, 'projects'))
      const project: Project = {
        id: projectRef.key!, name: name || '새 프로젝트',
        fieldType, fieldTerms: FIELD_TERMS[fieldType],
        date: date || new Date().toISOString().split('T')[0],
        startTime: startTime || '',
        endTime: endTime || '',
        venue: venue || '',
        estimatedPeople: Number(people) || 0,
        budget: Number(budget.replace(/,/g, '')) || 0,
        overview, status: 'planning',
        ownerId: user.uid, joinCode: generateJoinCode(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      // 기간 행사면 dateEnd 추가
      if (dateType === 'range' && dateEnd) {
        (project as Record<string, unknown>)['dateEnd'] = dateEnd
      }
      await set(projectRef, project)
      await set(ref(db, `projectMembers/${project.id}/${user.uid}`), {
        uid: user.uid, projectId: project.id, role: 'owner',
        displayName: user.displayName, joinedAt: new Date().toISOString(),
      })
      sessionStorage.removeItem('oncue_field')
      navigate(`/onboarding/parts/${project.id}`)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={3} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">프로젝트 기본 정보</h2>
        <p className="text-[13px] text-[#64748B] mb-6">나중에 언제든 수정할 수 있어요</p>

        {/* 행사명 */}
        <div className="mb-4">
          <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">행사명</label>
          <input className={inp} placeholder="2026 군포시 철쭉축제" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* 날짜 타입 토글 */}
        <div className="mb-3">
          <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">행사 일자</label>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setDateType('single')}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold border-2 transition-colors ${dateType === 'single' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
              단일 날짜
            </button>
            <button onClick={() => setDateType('range')}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold border-2 transition-colors ${dateType === 'range' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
              기간 (여러 날)
            </button>
          </div>

          {dateType === 'single' ? (
            <div className="relative">
              <i className="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <i className="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
                <input className={`${inp} pl-9`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <span className="text-[#A0AEC0] font-medium">~</span>
              <div className="relative flex-1">
                <i className="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
                <input className={`${inp} pl-9`} type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* 행사 시간 */}
        <div className="mb-4">
          <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">행사 시간</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <i className="ti ti-clock absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <span className="text-[#A0AEC0] font-medium">~</span>
            <div className="relative flex-1">
              <i className="ti ti-clock absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 장소 + 예상인원 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">장소</label>
            <div className="relative">
              <i className="ti ti-map-pin absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} placeholder="학교 중앙 광장" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">예상 인원</label>
            <div className="relative">
              <i className="ti ti-users absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} placeholder="500명" value={people} onChange={(e) => setPeople(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 예산 */}
        <div className="mb-4">
          <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">예산</label>
          <div className="relative">
            <i className="ti ti-currency-won absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
            <input className={`${inp} pl-9`} placeholder="5,000,000원" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
        </div>

        {/* 행사 개요 */}
        <div className="mb-6">
          <label className="text-[12px] font-medium text-[#64748B] mb-1.5 block">행사 개요 / 특이사항</label>
          <textarea className={`${inp} h-[80px] resize-none`} placeholder="행사 목적, 주의사항 등 자유롭게..." value={overview} onChange={(e) => setOverview(e.target.value)} />
        </div>

        {/* 네비 */}
        <div className="flex items-center justify-between pt-5 border-t border-[#E2E8F0]">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[13px] text-[#64748B]">
            <i className="ti ti-arrow-left text-[14px]" /> 이전
          </button>
          <button onClick={handleNext} disabled={loading}
            className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            <i className="ti ti-arrow-right" /> {loading ? '저장 중...' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
