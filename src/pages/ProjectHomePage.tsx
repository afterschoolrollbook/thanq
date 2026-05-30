import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { getDday } from '@/utils/joinCode'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar, StatusBadge } from '@/components/ui/Common'
import TemplateExportModal from '@/components/template/TemplateExportModal'
import TemplateImportModal from '@/components/template/TemplateImportModal'
import type { Project, Part, CheckItem } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  owner: '운영자', admin: '관리자', member: '팀원', viewer: '참관', guest: '게스트'
}

export default function ProjectHomePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [myRole, setMyRole] = useState<string>('')
  const [myPartName, setMyPartName] = useState<string>('')
  const [myChecks, setMyChecks] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // 기본정보 접기/펼치기 + 수정
  const [showInfo, setShowInfo] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPrepDate, setEditPrepDate] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDateEnd, setEditDateEnd] = useState('')
  const [editDateType, setEditDateType] = useState<'single'|'range'>('single')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editPeople, setEditPeople] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editOverview, setEditOverview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!projectId || !user) return
    const u1 = onValue(ref(db, `projects/${projectId}`), (s) => {
      if (s.exists()) setProject(s.val())
      setLoading(false)
    })
    const u2 = onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) {
        const l: Part[] = Object.values(s.val())
        l.sort((a, b) => a.order - b.order)
        setParts(l)
      } else setParts([])
    })
    onValue(ref(db, `projectMembers/${projectId}/${user.uid}`), (s) => {
      if (s.exists()) {
        const m = s.val()
        setMyRole(m.role ?? '')
        setMyPartName(m.partName ?? '')
      }
    }, { onlyOnce: true })
    return () => { u1(); u2() }
  }, [projectId, user])

  useEffect(() => {
    if (!user || parts.length === 0 || myPartName) return
    const myPart = parts.find(p => p.managerId === user.uid)
    if (myPart) setMyPartName(myPart.name)
  }, [parts, user, myPartName])

  useEffect(() => {
    if (!projectId || parts.length === 0) return
    const checks: CheckItem[] = []
    let loaded = 0
    parts.forEach((part) => {
      onValue(ref(db, `checkItems/${projectId}/${part.id}`), (s) => {
        loaded++
        if (s.exists()) {
          const items: CheckItem[] = Object.values(s.val())
          items.forEach(i => checks.push(i))
        }
        if (loaded === parts.length) setMyChecks([...checks])
      }, { onlyOnce: true })
    })
  }, [projectId, parts])

  function startEdit() {
    if (!project) return
    const p = project as any
    setEditName(project.name)
    setEditPrepDate(p.prepDate ?? '')
    setEditDate(project.date)
    setEditDateEnd(p.dateEnd ?? '')
    setEditDateType(p.dateEnd ? 'range' : 'single')
    setEditStartTime(project.startTime ?? '')
    setEditEndTime(project.endTime ?? '')
    setEditVenue(project.venue ?? '')
    setEditPeople(project.estimatedPeople ? String(project.estimatedPeople) : '')
    setEditBudget(project.budget ? String(project.budget) : '')
    setEditOverview(project.overview ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!projectId || !project) return
    setSaving(true)
    const updates: any = {
      name: editName.trim() || project.name,
      prepDate: editPrepDate || null,
      date: editDate || project.date,
      dateEnd: editDateType === 'range' && editDateEnd ? editDateEnd : null,
      startTime: editStartTime,
      endTime: editEndTime,
      venue: editVenue,
      estimatedPeople: Number(editPeople) || 0,
      budget: Number(editBudget.replace(/,/g,'')) || 0,
      overview: editOverview,
      updatedAt: new Date().toISOString(),
    }
    await update(ref(db, `projects/${projectId}`), updates)
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>
  if (!project) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">프로젝트를 찾을 수 없어요</div>

  const p = project as any
  const dday = getDday(project.date)
  const progress = parts.length ? Math.round(parts.reduce((s, p) => s + p.progress, 0) / parts.length) : 0
  const isOwner = myRole === 'owner' || project.ownerId === user?.uid
  const roleLabel = isOwner ? '운영자' : (ROLE_LABEL[myRole] ?? '팀원')
  const todoChecks = myChecks.filter(c => !c.isDone).slice(0, 5)

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar projectName={project.name} />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-24">

        {/* ── 프로젝트 기본정보 (접기/펼치기) ── */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] mb-4 overflow-hidden">
          <button
            onClick={() => { setShowInfo(v => !v); if (!showInfo) setEditing(false) }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FBFF] transition-colors">
            <div className="flex items-center gap-2">
              <i className="ti ti-info-circle text-[#185FA5] text-[15px]" />
              <span className="text-[13px] font-semibold text-[#1A1A2E]">프로젝트 기본정보</span>
              {/* 준비기간 ~ 행사일 요약 */}
              {!showInfo && (
                <span className="text-[11px] text-[#64748B] ml-1">
                  {p.prepDate ? `${p.prepDate.replace(/-/g,'.')} ~ ` : ''}{project.date.replace(/-/g,'.')}
                  {p.dateEnd ? ` ~ ${p.dateEnd.replace(/-/g,'.')}` : ''}
                  {project.venue ? ` · ${project.venue}` : ''}
                </span>
              )}
            </div>
            <i className={`ti ti-chevron-${showInfo ? 'up' : 'down'} text-[#A0AEC0] text-[14px]`} />
          </button>

          {showInfo && (
            <div className="border-t border-[#F4F6F9] px-4 py-4">
              {!editing ? (
                <>
                  {/* 보기 모드 */}
                  <div className="flex flex-col gap-2.5 text-[13px]">
                    <div className="flex items-start gap-2">
                      <span className="text-[#A0AEC0] w-20 flex-shrink-0">행사명</span>
                      <span className="font-semibold text-[#1A1A2E]">{project.name}</span>
                    </div>
                    {p.prepDate && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">준비 시작일</span>
                        <span>{p.prepDate.replace(/-/g,'.')}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-[#A0AEC0] w-20 flex-shrink-0">{p.dateEnd ? '행사 시작일' : '행사일'}</span>
                      <span className="font-semibold text-[#185FA5]">
                        {project.date.replace(/-/g,'.')}
                        {project.startTime && ` ${project.startTime}`}
                        {project.endTime && ` ~ ${project.endTime}`}
                      </span>
                    </div>
                    {p.dateEnd && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">행사 종료일</span>
                        <span>{p.dateEnd.replace(/-/g,'.')}</span>
                      </div>
                    )}
                    {project.venue && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">장소</span>
                        <span>{project.venue}</span>
                      </div>
                    )}
                    {project.estimatedPeople > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">예상 인원</span>
                        <span>{project.estimatedPeople.toLocaleString()}명</span>
                      </div>
                    )}
                    {project.budget > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">예산</span>
                        <span>{project.budget.toLocaleString()}원</span>
                      </div>
                    )}
                    {project.overview && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">개요</span>
                        <span className="text-[#64748B] leading-relaxed whitespace-pre-wrap">{project.overview}</span>
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <button onClick={startEdit}
                      className="mt-4 w-full h-[36px] border border-[#E2E8F0] rounded-[8px] text-[12px] font-semibold text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] flex items-center justify-center gap-1.5 transition-colors">
                      <i className="ti ti-pencil text-[13px]" /> 수정하기
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* 수정 모드 */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className={lbl}>행사명</label>
                      <input className={inp} value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>

                    {/* 행사 유형 */}
                    <div>
                      <label className={lbl}>행사 유형</label>
                      <div className="flex gap-2">
                        <button onClick={() => setEditDateType('single')}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-colors ${editDateType==='single' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                          단일 행사
                        </button>
                        <button onClick={() => setEditDateType('range')}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-colors ${editDateType==='range' ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                          여러 날 행사
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={lbl}>준비 시작일</label>
                      <input className={inp} type="date" value={editPrepDate} onChange={e => setEditPrepDate(e.target.value)} />
                    </div>
                    <div>
                      <label className={`${lbl} text-[#185FA5]`}>{editDateType === 'range' ? '행사 시작일 (D-day)' : '행사일 (D-day)'}</label>
                      <input className={`${inp} border-[#185FA5]`} type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                    </div>
                    {editDateType === 'range' && (
                      <div>
                        <label className={lbl}>행사 종료일</label>
                        <input className={inp} type="date" value={editDateEnd} onChange={e => setEditDateEnd(e.target.value)} />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={lbl}>시작 시간</label>
                        <input className={inp} type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>종료 시간</label>
                        <input className={inp} type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>장소</label>
                      <input className={inp} value={editVenue} onChange={e => setEditVenue(e.target.value)} placeholder="장소 입력" />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={lbl}>예상 인원</label>
                        <input className={inp} value={editPeople} onChange={e => setEditPeople(e.target.value)} placeholder="명" />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>예산</label>
                        <input className={inp} value={editBudget} onChange={e => setEditBudget(e.target.value)} placeholder="원" />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>개요</label>
                      <textarea className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#185FA5] resize-none"
                        rows={3} value={editOverview} onChange={e => setEditOverview(e.target.value)} placeholder="행사 목적, 주의사항 등" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setEditing(false)}
                      className="flex-1 h-[38px] border border-[#E2E8F0] rounded-[8px] text-[12px] font-semibold text-[#64748B]">
                      취소
                    </button>
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 h-[38px] bg-[#185FA5] text-white rounded-[8px] text-[12px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <i className="ti ti-check text-[13px]" />
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* D-day 바 */}
        <div className="bg-[#E6F1FB] rounded-[10px] px-4 py-3 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#185FA5] text-white text-[12px] font-semibold px-2.5 py-1 rounded-full">{dday}</div>
            <div>
              <div className="text-[13px] font-semibold text-[#0C447C]">{project.name}</div>
              <div className="text-[11px] text-[#378ADD] mt-0.5">
                {project.date.replace(/-/g,'.')}
                {project.startTime && ` · ${project.startTime}`}
                {project.endTime && ` ~ ${project.endTime}`}
                {project.venue && ` · ${project.venue}`}
              </div>
            </div>
          </div>
          <button onClick={() => navigate(`/p/${projectId}/timeline`)}
            className="text-[12px] text-[#185FA5] font-semibold flex items-center gap-1">
            오늘 <i className="ti ti-calendar text-[13px]" />
          </button>
        </div>

        {/* 내 정보 배지 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-[12px] font-semibold text-[#1A1A2E]">
            <i className={`ti ${isOwner ? 'ti-shield-check text-[#185FA5]' : 'ti-user text-[#64748B]'} text-[13px]`} />
            {roleLabel}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-full text-[12px] font-semibold text-[#1A1A2E]">
            <i className="ti ti-puzzle text-[#64748B] text-[13px]" />
            {myPartName || (isOwner ? '전체 파트 관리' : '파트 미배정')}
          </span>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3 text-center">
            <div className="text-[11px] text-[#64748B] mb-1">전체 진행률</div>
            <div className="text-[18px] font-bold text-[#185FA5]">{progress}%</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3 text-center">
            <div className="text-[11px] text-[#64748B] mb-1">파트</div>
            <div className="text-[18px] font-bold text-[#1A1A2E]">{parts.length}개</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3 text-center">
            <div className="text-[11px] text-[#64748B] mb-1">체크리스트</div>
            <div className="text-[18px] font-bold text-[#1A1A2E]">{myChecks.length > 0 ? `${myChecks.filter(c => c.isDone).length}/${myChecks.length}` : '—'}</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3 text-center">
            <div className="text-[11px] text-[#64748B] mb-1">미확인 공지</div>
            <div className="text-[18px] font-bold text-[#1A1A2E]">0건</div>
          </div>
        </div>

        {/* 일정표 + 파트별 현황 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5">
                <i className="ti ti-calendar-event text-[#185FA5]" /> 일정표
              </div>
              <button onClick={() => navigate(`/p/${projectId}/timeline`)} className="text-[12px] text-[#185FA5]">전체 보기</button>
            </div>
            <button onClick={() => navigate(`/p/${projectId}/timeline`)}
              className="w-full h-[72px] bg-[#F4F6F9] rounded-[10px] flex flex-col items-center justify-center gap-1 hover:bg-[#E6F1FB] transition-colors">
              <i className="ti ti-layout-columns text-[#185FA5] text-[22px]" />
              <span className="text-[11px] text-[#185FA5] font-semibold">타임라인 열기</span>
            </button>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5">
                <i className="ti ti-layout-grid text-[#185FA5]" /> 파트별 현황
              </div>
              <button onClick={() => navigate(`/p/${projectId}/dashboard`)} className="text-[12px] text-[#185FA5]">대시보드</button>
            </div>
            {parts.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-[12px] text-[#64748B] mb-2.5">파트가 없어요</p>
                <button onClick={() => navigate(`/onboarding/parts/${projectId}`)}
                  className="h-[32px] px-3 bg-[#185FA5] text-white rounded-[8px] text-[12px] font-semibold flex items-center gap-1 mx-auto">
                  <i className="ti ti-plus text-[12px]" /> 파트 추가
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {parts.map((part) => (
                  <div key={part.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: part.color }} />
                    <span className="text-[12px] flex-1 truncate">{part.name}</span>
                    <StatusBadge status={part.status} />
                    <span className="text-[11px] text-[#A0AEC0]">{part.progress}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 내 할 일 + 최근 공지 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5">
                <i className="ti ti-checklist text-[#185FA5]" /> 내 할 일
              </div>
              <button onClick={() => navigate(`/p/${projectId}/my-part`)} className="text-[12px] text-[#185FA5]">전체 보기</button>
            </div>
            {todoChecks.length === 0 ? (
              <div className="text-[12px] text-[#64748B] text-center py-4">
                {myChecks.length > 0 ? '✓ 모두 완료!' : '체크리스트가 없어요'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {todoChecks.map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded border border-[#E2E8F0] flex-shrink-0 mt-0.5" />
                    <span className="text-[12px] text-[#1A1A2E] leading-tight">{c.title}</span>
                  </div>
                ))}
                {myChecks.filter(c => !c.isDone).length > 5 && (
                  <div className="text-[11px] text-[#A0AEC0] text-center">+{myChecks.filter(c => !c.isDone).length - 5}개 더</div>
                )}
              </div>
            )}
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5">
                <i className="ti ti-bell text-[#185FA5]" /> 최근 공지
              </div>
              <button onClick={() => navigate(`/p/${projectId}/comms`)} className="text-[12px] text-[#185FA5]">전체 보기</button>
            </div>
            <div className="text-[12px] text-[#64748B] text-center py-4">공지가 없어요</div>
          </div>
        </div>

        {/* 템플릿 불러오기 / 저장 */}
        {(isOwner || user?.isPro) && (
          <div className="mt-4 flex gap-2">
            <button onClick={() => setShowImport(true)}
              className="flex-1 h-[40px] bg-white border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              <i className="ti ti-file-import text-[14px]" /> 템플릿 불러오기
            </button>
            <button onClick={() => setShowExport(true)}
              className="flex-1 h-[40px] bg-white border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              <i className="ti ti-file-export text-[14px]" /> 템플릿으로 저장
            </button>
          </div>
        )}
      </div>

      <BottomTabBar />
      {showExport && project && (
        <TemplateExportModal project={project} onClose={() => setShowExport(false)} />
      )}
      {showImport && projectId && (
        <TemplateImportModal
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); window.location.reload() }}
        />
      )}
    </div>
  )
}

const inp = 'w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]'
const lbl = 'text-[12px] font-semibold text-[#64748B] mb-1 block'
