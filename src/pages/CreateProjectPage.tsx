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
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [venue, setVenue] = useState('')
  const [people, setPeople] = useState('')
  const [budget, setBudget] = useState('')
  const [overview, setOverview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleNext() {
    if (!name || !date || !startTime || !venue) { setError('행사명, 날짜, 시간, 장소는 필수예요'); return }
    if (!user) return
    setLoading(true); setError('')
    try {
      const projectRef = push(ref(db, 'projects'))
      const project: Project = {
        id: projectRef.key!, name, fieldType,
        fieldTerms: FIELD_TERMS[fieldType],
        date, startTime, endTime: endTime || '',
        venue, estimatedPeople: Number(people) || 0,
        budget: Number(budget.replace(/,/g, '')) || 0,
        overview, status: 'planning',
        ownerId: user.uid, joinCode: generateJoinCode(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      await set(projectRef, project)
      await set(ref(db, `projectMembers/${project.id}/${user.uid}`), {
        uid: user.uid, projectId: project.id, role: 'owner',
        displayName: user.displayName, joinedAt: new Date().toISOString(),
      })
      sessionStorage.removeItem('oncue_field')
      navigate(`/onboarding/parts/${project.id}`)
    } catch { setError('오류가 발생했어요. 다시 시도해주세요.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={3} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">프로젝트 기본 정보</h2>
        <p className="text-[13px] text-[#64748B] mb-6">행사의 기본 정보를 입력해주세요</p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="col-span-2">
            <Field label="행사명" required><input className={inp} placeholder="2025 봄 대학 축제" value={name} onChange={(e)=>setName(e.target.value)} /></Field>
          </div>
          <Field label="행사 일자" required icon="ti-calendar"><input className={inp} type="date" value={date} onChange={(e)=>setDate(e.target.value)} /></Field>
          <Field label="행사 시간" required icon="ti-clock">
            <div className="flex items-center gap-2">
              <input className={`${inp} flex-1`} type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} />
              <span className="text-[#A0AEC0] text-sm">~</span>
              <input className={`${inp} flex-1`} type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} />
            </div>
          </Field>
          <Field label="장소" required icon="ti-map-pin"><input className={inp} placeholder="학교 중앙 광장" value={venue} onChange={(e)=>setVenue(e.target.value)} /></Field>
          <Field label="예상 인원" icon="ti-users"><input className={inp} placeholder="500명" value={people} onChange={(e)=>setPeople(e.target.value)} /></Field>
          <Field label="예산" icon="ti-currency-won"><input className={inp} placeholder="5,000,000원" value={budget} onChange={(e)=>setBudget(e.target.value)} /></Field>
          <div className="col-span-2">
            <Field label="행사 개요 / 특이사항"><textarea className={`${inp} h-[70px] resize-none`} placeholder="행사 목적, 주의사항 등 자유롭게..." value={overview} onChange={(e)=>setOverview(e.target.value)} /></Field>
          </div>
        </div>
        {error && <p className="text-[#A32D2D] text-[12px] mb-3">{error}</p>}
        <div className="flex items-center justify-between pt-5 border-t border-[#E2E8F0] mt-3">
          <button onClick={()=>navigate(-1)} className="flex items-center gap-1 text-[13px] text-[#64748B]"><i className="ti ti-arrow-left text-[14px]" /> 이전</button>
          <button onClick={handleNext} disabled={loading} className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            <i className="ti ti-arrow-right" /> {loading ? '저장 중...' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"

function Field({ label, required, icon, children }: { label: string; required?: boolean; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] text-[#64748B] font-medium mb-1.5">{label}{required && <span className="text-[#A32D2D] ml-0.5">*</span>}</div>
      {icon ? (
        <div className="relative">
          <i className={`ti ${icon} absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]`} />
          <div className="pl-9">{children}</div>
        </div>
      ) : children}
    </div>
  )
}
