import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { FIELD_TERMS, FIELD_LABELS } from '@/utils/fieldTerms'
import { generateJoinCode } from '@/utils/joinCode'
import type { FieldType, Project } from '@/types'

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const fieldType = (sessionStorage.getItem('oncue_field') ?? 'event') as FieldType
  const { label: fieldLabel } = FIELD_LABELS[fieldType]

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [venue, setVenue] = useState('')
  const [estimatedPeople, setEstimatedPeople] = useState('')
  const [overview, setOverview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name || !date || !startTime || !venue) {
      setError('프로젝트명, 날짜, 시작 시간, 장소는 필수예요')
      return
    }
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const projectRef = push(ref(db, 'projects'))
      const project: Project = {
        id: projectRef.key!,
        name,
        fieldType,
        fieldTerms: FIELD_TERMS[fieldType],
        date,
        startTime,
        endTime: endTime || '',
        venue,
        estimatedPeople: Number(estimatedPeople) || 0,
        overview,
        status: 'planning',
        ownerId: user.uid,
        joinCode: generateJoinCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await set(projectRef, project)

      // 멤버 등록
      await set(ref(db, `projectMembers/${project.id}/${user.uid}`), {
        uid: user.uid,
        projectId: project.id,
        role: 'owner',
        displayName: user.displayName,
        joinedAt: new Date().toISOString(),
      })

      sessionStorage.removeItem('oncue_field')
      sessionStorage.removeItem('oncue_terms')

      navigate(`/onboarding/parts/${project.id}`)
    } catch (e) {
      setError('프로젝트 생성 중 오류가 발생했어요. 다시 시도해주세요.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-oncue-bg">
      {/* 헤더 */}
      <header className="bg-primary text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <span className="font-bold text-lg">ThanQ</span>
      </header>

      {/* 스텝 바 */}
      <div className="bg-white border-b border-oncue-border px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <StepDot done label="계정" />
          <StepLine />
          <StepDot done label="분야" />
          <StepLine />
          <StepDot active label="프로젝트" />
          <StepLine />
          <StepDot label="파트 구성" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
        {/* 분야 배지 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="badge-ongoing">{fieldLabel}</span>
          <span className="text-oncue-muted text-xs">분야에 맞는 용어가 자동 적용돼요</span>
        </div>

        <h2 className="text-lg font-bold text-oncue-text mb-1">프로젝트 기본 정보</h2>
        <p className="text-oncue-muted text-sm mb-5">행사의 기본 정보를 입력하세요</p>

        <div className="space-y-4">
          {/* 프로젝트명 */}
          <div>
            <label className="text-xs font-semibold text-oncue-muted mb-1 block">
              프로젝트명 <span className="text-status-urgent">*</span>
            </label>
            <input
              className="input-field"
              placeholder="예: 2025 브랜드 론칭 행사"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* 날짜 */}
          <div>
            <label className="text-xs font-semibold text-oncue-muted mb-1 block">
              날짜 <span className="text-status-urgent">*</span>
            </label>
            <input
              className="input-field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-oncue-muted mb-1 block">
                시작 시간 <span className="text-status-urgent">*</span>
              </label>
              <input
                className="input-field"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-oncue-muted mb-1 block">종료 시간</label>
              <input
                className="input-field"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* 장소 */}
          <div>
            <label className="text-xs font-semibold text-oncue-muted mb-1 block">
              장소 <span className="text-status-urgent">*</span>
            </label>
            <input
              className="input-field"
              placeholder="예: 코엑스 그랜드볼룸"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
          </div>

          {/* 예상 인원 */}
          <div>
            <label className="text-xs font-semibold text-oncue-muted mb-1 block">예상 인원</label>
            <input
              className="input-field"
              type="number"
              placeholder="예: 500"
              value={estimatedPeople}
              onChange={(e) => setEstimatedPeople(e.target.value)}
            />
          </div>

          {/* 개요 */}
          <div>
            <label className="text-xs font-semibold text-oncue-muted mb-1 block">행사 개요</label>
            <textarea
              className="input-field resize-none h-24"
              placeholder="행사에 대한 간단한 설명을 입력하세요"
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-status-urgent text-sm mt-3">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="btn-primary w-full justify-center mt-6"
        >
          <i className="ti ti-arrow-right" />
          {loading ? '생성 중...' : '다음 — 파트 구성하기'}
        </button>
      </div>
    </div>
  )
}

function StepDot({ done, active, label }: { done?: boolean; active?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? 'bg-status-done text-white' : active ? 'bg-primary text-white' : 'bg-oncue-border text-oncue-muted'
      }`}>
        {done ? <i className="ti ti-check text-xs" /> : null}
      </div>
      <span className={`text-[10px] ${active ? 'text-primary font-semibold' : 'text-oncue-muted'}`}>{label}</span>
    </div>
  )
}

function StepLine() {
  return <div className="flex-1 h-px bg-oncue-border mt-[-10px]" />
}
