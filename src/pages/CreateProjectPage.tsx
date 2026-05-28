import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, push, set, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { FIELD_TERMS } from '@/utils/fieldTerms'
import { generateJoinCode } from '@/utils/joinCode'
import { applyTemplateToProject } from '@/utils/templateUtils'
import { Topbar, StepBar } from '@/components/ui/Common'
import type { FieldType, Project, TemplateFile } from '@/types'

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fieldType = (sessionStorage.getItem('oncue_field') ?? 'event') as FieldType

  // 템플릿으로 시작하는 경우 — FieldSelectPage에서 저장한 데이터
  const templateData: TemplateFile | null = (() => {
    try {
      const raw = sessionStorage.getItem('oncue_template')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  const [projectId, setProjectId] = useState<string | null>(null)
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
  const [initializing, setInitializing] = useState(true)
  const draftRef = useRef<string | null>(null)

  // 초기화: draft 프로젝트 있으면 불러오고, 없으면 새로 만들기
  useEffect(() => {
    if (!user) return
    const draftsRef = ref(db, `drafts/${user.uid}`)
    const unsub = onValue(draftsRef, (snap) => {
      if (snap.exists()) {
        const draft = snap.val()
        draftRef.current = draft.id
        setProjectId(draft.id)
        setName(draft.name ?? '')
        setDateType(draft.dateType ?? 'single')
        setDate(draft.date ?? '')
        setDateEnd(draft.dateEnd ?? '')
        setStartTime(draft.startTime ?? '')
        setEndTime(draft.endTime ?? '')
        setVenue(draft.venue ?? '')
        setPeople(draft.estimatedPeople ? String(draft.estimatedPeople) : '')
        setBudget(draft.budget ? String(draft.budget) : '')
        setOverview(draft.overview ?? '')
      } else {
        // 새 draft ID 생성
        const newRef = push(ref(db, 'projects'))
        draftRef.current = newRef.key
        setProjectId(newRef.key)
      }
      setInitializing(false)
    }, { onlyOnce: true })
    return () => unsub()
  }, [user])

  // 입력값 실시간 Firebase 저장
  function saveField(field: string, val: string | number) {
    if (!user || !projectId) return
    update(ref(db, `drafts/${user.uid}`), { id: projectId, [field]: val, fieldType })
  }

  function ch(field: string, val: string, setter: (v: string) => void) {
    setter(val)
    saveField(field, val)
  }

  async function handleNext() {
    if (!user || !projectId) return
    setLoading(true)
    try {
      const project: Project & { dateEnd?: string } = {
        id: projectId, name: name || '새 프로젝트',
        fieldType, fieldTerms: FIELD_TERMS[fieldType],
        date: date || new Date().toISOString().split('T')[0],
        startTime: startTime || '', endTime: endTime || '',
        venue: venue || '', estimatedPeople: Number(people) || 0,
        budget: Number(budget.replace(/,/g, '')) || 0,
        overview, status: 'planning',
        ownerId: user.uid, joinCode: generateJoinCode(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      if (dateType === 'range' && dateEnd) project.dateEnd = dateEnd
      await set(ref(db, `projects/${projectId}`), project)
      await set(ref(db, `projectMembers/${projectId}/${user.uid}`), {
        uid: user.uid, projectId, role: 'owner',
        displayName: user.displayName, joinedAt: new Date().toISOString(),
      })
      await set(ref(db, `drafts/${user.uid}`), null)
      sessionStorage.removeItem('oncue_field')

      if (templateData) {
        // 템플릿으로 시작 → 파트 자동 세팅 후 바로 프로젝트 홈으로
        await applyTemplateToProject(projectId, templateData)
        sessionStorage.removeItem('oncue_template')
        navigate(`/p/${projectId}/home`)
      } else {
        // 직접 입력 → 파트 구성 단계로
        navigate(`/onboarding/parts/${projectId}`)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (initializing) return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
      <div className="text-[13px] text-[#64748B]">불러오는 중...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={3} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">프로젝트 기본 정보</h2>
        <p className="text-[13px] text-[#64748B] mb-6">입력하는 즉시 저장돼요 — 언제든 이어서 작업 가능해요</p>

        {/* 템플릿 적용 중 배너 */}
        {templateData && (
          <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-[#E6F1FB] border border-[#185FA5] rounded-[12px]">
            <i className="ti ti-file-check text-[#185FA5] text-[20px] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[#185FA5]">템플릿 적용 예정</div>
              <div className="text-[11px] text-[#64748B] truncate">
                {templateData.name} · 파트 {templateData.parts.length}개가 자동 세팅돼요
              </div>
            </div>
            <button onClick={() => { sessionStorage.removeItem('oncue_template'); window.location.reload() }}
              className="text-[#A0AEC0] hover:text-[#E24B4A]">
              <i className="ti ti-x text-[16px]" />
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className={lbl}>행사명</label>
          <input className={inp} placeholder="2026 군포시 철쭉축제" value={name}
            onChange={(e) => ch('name', e.target.value, setName)} />
        </div>

        <div className="mb-4">
          <label className={lbl}>행사 일자</label>
          <div className="flex gap-2 mb-3">
            <button onClick={() => { setDateType('single'); saveField('dateType','single') }}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-colors ${dateType === 'single' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B] bg-white'}`}>
              단일 날짜
            </button>
            <button onClick={() => { setDateType('range'); saveField('dateType','range') }}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-colors ${dateType === 'range' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B] bg-white'}`}>
              기간 (여러 날)
            </button>
          </div>
          {dateType === 'single' ? (
            <div className="relative">
              <i className="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} type="date" value={date} onChange={(e) => ch('date', e.target.value, setDate)} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <i className="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
                <input className={`${inp} pl-9`} type="date" value={date} onChange={(e) => ch('date', e.target.value, setDate)} />
              </div>
              <span className="text-[#A0AEC0] font-medium">~</span>
              <div className="relative flex-1">
                <i className="ti ti-calendar absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
                <input className={`${inp} pl-9`} type="date" value={dateEnd} onChange={(e) => ch('dateEnd', e.target.value, setDateEnd)} />
              </div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className={lbl}>행사 시간</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <i className="ti ti-clock absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} type="time" value={startTime} onChange={(e) => ch('startTime', e.target.value, setStartTime)} />
            </div>
            <span className="text-[#A0AEC0] font-medium">~</span>
            <div className="relative flex-1">
              <i className="ti ti-clock absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} type="time" value={endTime} onChange={(e) => ch('endTime', e.target.value, setEndTime)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={lbl}>장소</label>
            <div className="relative">
              <i className="ti ti-map-pin absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} placeholder="학교 중앙 광장" value={venue} onChange={(e) => ch('venue', e.target.value, setVenue)} />
            </div>
          </div>
          <div>
            <label className={lbl}>예상 인원</label>
            <div className="relative">
              <i className="ti ti-users absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} placeholder="500명" value={people} onChange={(e) => ch('estimatedPeople', e.target.value, setPeople)} />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className={lbl}>예산</label>
          <div className="relative">
            <i className="ti ti-currency-won absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
            <input className={`${inp} pl-9`} placeholder="5,000,000원" value={budget} onChange={(e) => ch('budget', e.target.value, setBudget)} />
          </div>
        </div>

        <div className="mb-6">
          <label className={lbl}>행사 개요 / 특이사항</label>
          <textarea className={`${inp} h-[80px] resize-none`} placeholder="행사 목적, 주의사항 등 자유롭게..." value={overview} onChange={(e) => ch('overview', e.target.value, setOverview)} />
        </div>

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
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
