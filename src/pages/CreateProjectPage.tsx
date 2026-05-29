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

function loadTemplate(): TemplateFile | null {
  try {
    const raw = sessionStorage.getItem('oncue_template')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function CreateProjectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fieldType = (sessionStorage.getItem('oncue_field') ?? 'event') as FieldType

  const [templateData, setTemplateData] = useState<TemplateFile | null>(loadTemplate)

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
  const [submitError, setSubmitError] = useState("")
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [initializing, setInitializing] = useState(true)

  // 행사명 미입력 시 안내 메시지
  const [nameError, setNameError] = useState(false)

  const draftRef = useRef<string | null>(null)

  // 템플릿 메타 정보 → 폼 자동 채우기 헬퍼
  function applyTemplateToForm(tmpl: TemplateFile) {
    const clean = (s: string) =>
      s.replace(/^\[예시\]\s*/, '')
       .replace(/\s*\(변경하세요\)/g, '')
       .replace(/\s*\(내용을 수정해주세요\)/g, '')
       .trim()

    if (tmpl.projectName) setName(clean(tmpl.projectName))
    if (tmpl.location)    setVenue(clean(tmpl.location))

    // description + contact 합쳐서 overview에
    const overviewParts: string[] = []
    if (tmpl.description) overviewParts.push(clean(tmpl.description))
    if (tmpl.contact)     overviewParts.push(clean(tmpl.contact))
    if (overviewParts.length) setOverview(overviewParts.join('\n'))

    // eventDate: "2025년 6월 15일" 형식 → YYYY-MM-DD 변환 시도
    if (tmpl.eventDate) {
      const raw = clean(tmpl.eventDate)
      const m = raw.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
      if (m) {
        const yyyy = m[1]
        const mm   = m[2].padStart(2, '0')
        const dd   = m[3].padStart(2, '0')
        setDate(`${yyyy}-${mm}-${dd}`)
      }
    }
  }

  useEffect(() => {
    if (!user) return
    const draftsRef = ref(db, `drafts/${user.uid}`)
    const unsub = onValue(draftsRef, (snap) => {
      // 1) 드래프트가 있으면 projectId 등 기본값 세팅
      if (snap.exists()) {
        const draft = snap.val()
        draftRef.current = draft.id
        setProjectId(draft.id)
        setDateType(draft.dateType ?? 'single')
        setDate(draft.date ?? '')
        setDateEnd(draft.dateEnd ?? '')
        setStartTime(draft.startTime ?? '')
        setEndTime(draft.endTime ?? '')
        setName(draft.name ?? '')
        setVenue(draft.venue ?? '')
        setPeople(draft.estimatedPeople ? String(draft.estimatedPeople) : '')
        setBudget(draft.budget ? String(draft.budget) : '')
        setOverview(draft.overview ?? '')
      } else {
        const newRef = push(ref(db, 'projects'))
        draftRef.current = newRef.key
        setProjectId(newRef.key)
      }

      // 2) 템플릿이 있으면 드래프트 값을 무조건 덮어써서 폼 채우기
      try {
        const raw = sessionStorage.getItem('oncue_template')
        if (raw) {
          const tmpl = JSON.parse(raw) as TemplateFile
          applyTemplateToForm(tmpl)
        }
      } catch { /* ignore */ }

      setInitializing(false)
    }, { onlyOnce: true })
    return () => unsub()
  }, [user])

  function saveField(field: string, val: string | number) {
    if (!user || !projectId) return
    update(ref(db, `drafts/${user.uid}`), { id: projectId, [field]: val, fieldType })
  }

  function ch(field: string, val: string, setter: (v: string) => void) {
    setter(val)
    saveField(field, val)
  }

  function removeTemplate() {
    sessionStorage.removeItem('oncue_template')
    setTemplateData(null)
  }

  async function handleNext() {
    if (!user || !projectId) return

    // 행사명 필수 검증
    if (!name.trim()) {
      setNameError(true)
      const el = document.getElementById('field-name')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus()
      return
    }
    setNameError(false)

    setLoading(true)
    try {
      const project: Project & { dateEnd?: string } = {
        id: projectId,
        name: name.trim(),
        fieldType,
        fieldTerms: FIELD_TERMS[fieldType],
        date: date || new Date().toISOString().split('T')[0],
        startTime: startTime || '',
        endTime: endTime || '',
        venue: venue || '',
        estimatedPeople: Number(people) || 0,
        budget: Number(budget.replace(/,/g, '')) || 0,
        overview,
        status: 'planning',
        ownerId: user.uid,
        joinCode: generateJoinCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        setApplyingTemplate(true)
        await applyTemplateToProject(projectId, templateData)
        sessionStorage.removeItem('oncue_template')
        navigate(`/p/${projectId}/home`)
      } else {
        navigate(`/onboarding/parts/${projectId}`)
      }
    } catch (e) {
      console.error(e)
      setApplyingTemplate(false)
      setSubmitError("프로젝트 저장 중 오류가 발생했어요. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  if (applyingTemplate) return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full bg-[#E6F1FB] flex items-center justify-center">
        <i className="ti ti-loader-2 animate-spin text-[#185FA5] text-[28px]" />
      </div>
      <div className="text-[15px] font-semibold text-[#1A1A2E]">템플릿 적용 중...</div>
      <div className="text-[12px] text-[#64748B]">{templateData?.parts.length}개 파트를 세팅하고 있어요</div>
    </div>
  )

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

        {/* 템플릿 적용 예정 배너 */}
        {templateData && (
          <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-[#E6F1FB] border border-[#185FA5] rounded-[12px]">
            <i className="ti ti-file-check text-[#185FA5] text-[20px] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[#185FA5]">템플릿 정보로 자동 채워졌어요</div>
              <div className="text-[11px] text-[#64748B] truncate">
                {templateData.name} · 파트 {templateData.parts.length}개 · 내용을 확인하고 수정해주세요
              </div>
            </div>
            <button onClick={removeTemplate} className="text-[#A0AEC0] hover:text-[#E24B4A] flex-shrink-0">
              <i className="ti ti-x text-[16px]" />
            </button>
          </div>
        )}

        {/* 행사명 — 필수 */}
        <div className="mb-4" id="field-name">
          <label className={lbl}>
            행사명
            <span className={reqBadge}>필수</span>
          </label>
          <input
            id="field-name-input"
            className={`${inp} ${nameError ? 'border-[#E24B4A] focus:border-[#E24B4A]' : ''}`}
            placeholder="예) 2026 군포시 철쭉축제"
            value={name}
            onChange={(e) => {
              ch('name', e.target.value, setName)
              if (e.target.value.trim()) setNameError(false)
            }}
          />
          {nameError && (
            <div className="flex items-center gap-1 mt-1.5">
              <i className="ti ti-alert-circle text-[#E24B4A] text-[13px]" />
              <span className="text-[12px] text-[#E24B4A]">행사명은 꼭 입력해주세요. 나머지는 나중에 채워도 돼요!</span>
            </div>
          )}
        </div>

        {/* 행사 일자 — 선택 */}
        <div className="mb-4">
          <label className={lbl}>
            행사 일자
            <span className={optBadge}>선택</span>
          </label>
          <div className="flex gap-2 mb-3">
            <button onClick={() => { setDateType('single'); saveField('dateType', 'single') }}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-colors ${dateType === 'single' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B] bg-white'}`}>
              단일 날짜
            </button>
            <button onClick={() => { setDateType('range'); saveField('dateType', 'range') }}
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

        {/* 행사 시간 — 선택 */}
        <div className="mb-4">
          <label className={lbl}>
            행사 시간
            <span className={optBadge}>선택</span>
          </label>
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

        {/* 장소 / 예상 인원 — 선택 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={lbl}>
              장소
              <span className={optBadge}>선택</span>
            </label>
            <div className="relative">
              <i className="ti ti-map-pin absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} placeholder="학교 중앙 광장" value={venue} onChange={(e) => ch('venue', e.target.value, setVenue)} />
            </div>
          </div>
          <div>
            <label className={lbl}>
              예상 인원
              <span className={optBadge}>선택</span>
            </label>
            <div className="relative">
              <i className="ti ti-users absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
              <input className={`${inp} pl-9`} placeholder="500명" value={people} onChange={(e) => ch('estimatedPeople', e.target.value, setPeople)} />
            </div>
          </div>
        </div>

        {/* 예산 — 선택 */}
        <div className="mb-4">
          <label className={lbl}>
            예산
            <span className={optBadge}>선택</span>
          </label>
          <div className="relative">
            <i className="ti ti-currency-won absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
            <input className={`${inp} pl-9`} placeholder="5,000,000원" value={budget} onChange={(e) => ch('budget', e.target.value, setBudget)} />
          </div>
        </div>

        {/* 행사 개요 — 선택 */}
        <div className="mb-6">
          <label className={lbl}>
            행사 개요 / 특이사항
            <span className={optBadge}>선택</span>
          </label>
          <textarea className={`${inp} h-[80px] resize-none`} placeholder="행사 목적, 주의사항 등 자유롭게..." value={overview} onChange={(e) => ch('overview', e.target.value, setOverview)} />
        </div>

        {submitError && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-[#FEE2E2] border border-[#E24B4A] rounded-[10px]">
            <i className="ti ti-alert-circle text-[#E24B4A] text-[15px]" />
            <span className="text-[12px] text-[#E24B4A]">{submitError}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-5 border-t border-[#E2E8F0]">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[13px] text-[#64748B]">
            <i className="ti ti-arrow-left text-[14px]" /> 이전
          </button>
          <button onClick={handleNext} disabled={loading}
            className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            {templateData
              ? <><i className="ti ti-rocket" /> {loading ? '적용 중...' : '프로젝트 시작'}</>
              : <><i className="ti ti-arrow-right" /> {loading ? '저장 중...' : '다음'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]'
const lbl = 'text-[12px] font-medium text-[#64748B] mb-1.5 flex items-center gap-1.5'
const reqBadge = 'inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626]'
const optBadge = 'inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold bg-[#F1F5F9] text-[#94A3B8]'
