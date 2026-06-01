import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, update, push, set, remove } from 'firebase/database'
import { db } from '@/lib/firebase'
import { getDday } from '@/utils/joinCode'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar, StatusBadge } from '@/components/ui/Common'
import { PART_COLORS } from '@/utils/fieldTerms'
import TemplateExportModal from '@/components/template/TemplateExportModal'
import TemplateImportModal from '@/components/template/TemplateImportModal'
import SimulationModal from '@/components/simulation/SimulationModal'
import type { Project, Part, CheckItem, CueItem } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  owner: '기획자', planner: '기획자', admin: '관리자', staff: '스태프', member: '팀원', participant: '참가자', viewer: '참관', guest: '게스트'
}
const ROLE_COLOR: Record<string, string> = {
  owner: '#185FA5', planner: '#185FA5', admin: '#3B6D11', staff: '#E8820C', member: '#64748B', participant: '#854F0B', viewer: '#A0AEC0', guest: '#A0AEC0'
}
const ROLE_BG: Record<string, string> = {
  owner: '#E6F1FB', planner: '#E6F1FB', admin: '#EAF3DE', staff: '#FFF8F0', member: '#F4F6F9', participant: '#FFF8F0', viewer: '#F4F6F9', guest: '#F4F6F9'
}

export default function ProjectHomePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [myRole, setMyRole] = useState<string>('')
  const [myPartId, setMyPartId] = useState<string>('')
  const [myPartName, setMyPartName] = useState<string>('')
  const [roleChangeTarget, setRoleChangeTarget] = useState<Part | null>(null)
  const [roleChangeRole, setRoleChangeRole] = useState<string>('staff')
  const [showInviteModal, setShowInviteModal] = useState<Part | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showBulkInvite, setShowBulkInvite] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkPreview, setBulkPreview] = useState<{ type: 'sms' | 'kakao' | 'email'; msg: string; subject?: string } | null>(null)
  const [individualPreview, setIndividualPreview] = useState<{ type: 'sms' | 'kakao' | 'email'; msg: string; subject?: string; phone?: string; email?: string; inviteLink?: string } | null>(null)
  const [myChecks, setMyChecks] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSimulation, setShowSimulation] = useState(false)
  const [cuesByPart, setCuesByPart] = useState<Record<string, CueItem[]>>({})

  // 기본정보 접기/펼치기 + 수정
  const [showInfo, setShowInfo] = useState(true)
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

  // 파트 편집 상태 - 파트별현황(상단)과 파트구성(하단) 분리
  const [editingPartsBottom, setEditingPartsBottom] = useState(false)
  const [showNoPermission, setShowNoPermission] = useState('')
  const [showMyRoleModal, setShowMyRoleModal] = useState(false)
  const [myNewPartId, setMyNewPartId] = useState('')
  const [showParts, setShowParts] = useState(true)
  const [partManagers, setPartManagers] = useState<Record<string, any>>({})
  const [editPartName, setEditPartName] = useState('')
  const [showPartEditModal, setShowPartEditModal] = useState(false)
  const [editingPart, setEditingPart] = useState<any>(null)
  const [editManagerName, setEditManagerName] = useState('')
  const [editManagerAlias, setEditManagerAlias] = useState('')
  const [editManagerPhone, setEditManagerPhone] = useState('')
  const [editManagerEmail, setEditManagerEmail] = useState('')
  const [partEditSaving, setPartEditSaving] = useState(false)
  const [showMoveDate, setShowMoveDate] = useState(false)
  const [moveTargetDate, setMoveTargetDate] = useState('')
  const [moving, setMoving] = useState(false)

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
        setMyPartId(m.partId ?? '')
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

  // 큐 데이터 로드 (시뮬레이션용)
  useEffect(() => {
    if (!projectId || parts.length === 0) return
    const map: Record<string, CueItem[]> = {}
    let loaded = 0
    parts.forEach((part) => {
      onValue(ref(db, `cueItems/${projectId}/${part.id}`), (s) => {
        loaded++
        map[part.id] = s.exists() ? Object.values(s.val() as CueItem[]) : []
        if (loaded === parts.length) setCuesByPart({ ...map })
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


  // 프로젝트 운영 상태 변경
  async function updateProjectPhase(phase: 'planning' | 'testing' | 'live') {
    if (!projectId) return
    await update(ref(db, `projects/${projectId}`), { phase, updatedAt: new Date().toISOString() })
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

  useEffect(() => {
    if (!projectId || parts.length === 0) return
    parts.forEach((part) => {
      onValue(ref(db, `partManagers/${projectId}/${part.id}`), (s) => {
        if (s.exists()) setPartManagers(prev => ({ ...prev, [part.id]: s.val() }))
      }, { onlyOnce: true })
    })
  }, [projectId, parts])

  function getInviteLink(part: Part, role: string = 'staff') {
    const partKey = `${part.isParticipant ? 'participant' : 'staff'}_${parts.filter(p => !!(p as any).isParticipant === !!(part as any).isParticipant).indexOf(part)}`
    const base = `${window.location.origin}/join?code=${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}`
    return `${base}&partKey=${partKey}&role=${role}&partName=${encodeURIComponent(part.name)}`
  }

  async function copyInviteLink(part: Part, role: string = 'staff') {
    await navigator.clipboard.writeText(getInviteLink(part, role))
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function saveMyRole(partId: string) {
    if (!projectId || !user) return
    const isReturningToPlanner = partId === '__planner__'
    const selectedPart = parts.find(p => p.id === partId)
    await update(ref(db, `projectMembers/${projectId}/${user.uid}`), {
      partId: isReturningToPlanner ? '' : partId,
      partName: isReturningToPlanner ? '기획자' : (selectedPart?.name ?? ''),
      role: isReturningToPlanner ? 'planner' : (isOwner ? 'planner' : 'staff'),
    })
    setMyPartId(isReturningToPlanner ? '' : partId)
    setMyPartName(isReturningToPlanner ? '' : (selectedPart?.name ?? ''))
    setMyNewPartId('')
    setShowMyRoleModal(false)
  }

  async function moveEventDate() {
    if (!projectId || !project || !moveTargetDate) return
    setMoving(true)
    const oldDate = project.date
    const diff = (new Date(moveTargetDate).getTime() - new Date(oldDate).getTime()) / 86400000
    // 1. 프로젝트 날짜 업데이트
    const updates: Record<string, any> = {}
    updates[`projects/${projectId}/date`] = moveTargetDate
    if ((project as any).dateEnd) {
      const newEnd = new Date((project as any).dateEnd)
      newEnd.setDate(newEnd.getDate() + diff)
      updates[`projects/${projectId}/dateEnd`] = newEnd.toISOString().split('T')[0]
    }
    if ((project as any).prepDate) {
      const newPrep = new Date((project as any).prepDate)
      newPrep.setDate(newPrep.getDate() + diff)
      updates[`projects/${projectId}/prepDate`] = newPrep.toISOString().split('T')[0]
    }
    // 2. 모든 파트의 모든 큐 날짜 이동
    await new Promise<void>(resolve => {
      onValue(ref(db, `parts/${projectId}`), async (snap) => {
        if (snap.exists()) {
          const partIds = Object.keys(snap.val())
          for (const partId of partIds) {
            await new Promise<void>(res2 => {
              onValue(ref(db, `cueItems/${projectId}/${partId}`), async (csnap) => {
                if (csnap.exists()) {
                  for (const [cueId, cue] of Object.entries(csnap.val() as Record<string, any>)) {
                    if (cue.date) {
                      const newD = new Date(cue.date)
                      newD.setDate(newD.getDate() + diff)
                      updates[`cueItems/${projectId}/${partId}/${cueId}/date`] = newD.toISOString().split('T')[0]
                    }
                  }
                }
                res2()
              }, { onlyOnce: true })
            })
          }
        }
        resolve()
      }, { onlyOnce: true })
    })
    await update(ref(db), updates)
    setMoving(false)
    setShowMoveDate(false)
    setMoveTargetDate('')
  }

  async function saveMemberRole(part: Part, role: string) {
    if (!projectId || !user) return
    // 해당 파트의 담당자 uid 찾기 - partManagers에서
    const memberSnap = await new Promise<any>((res) => {
      const r = ref(db, `projectMembers/${projectId}`)
      onValue(r, res, { onlyOnce: true })
    })
    if (memberSnap.exists()) {
      const members = Object.values(memberSnap.val()) as any[]
      const partMember = members.find((m: any) => m.partId === part.id)
      if (partMember) {
        await update(ref(db, `projectMembers/${projectId}/${partMember.uid}`), { role, partId: part.id, partName: part.name })
      }
    }
    // parts에도 role 메타 저장
    await update(ref(db, `parts/${projectId}/${part.id}`), { memberRole: role })
    setRoleChangeTarget(null)
  }

  async function addPart() {
    if (!projectId) return
    const newRef = push(ref(db, `parts/${projectId}`))
    await set(newRef, {
      id: newRef.key, projectId, name: '새 파트',
      color: PART_COLORS[parts.length % PART_COLORS.length],
      status: 'waiting', progress: 0, order: parts.length,
      createdAt: new Date().toISOString(),
    })
  }


  function getBulkSelectedParts() {
    return parts.filter(p => bulkSelected.has(p.id))
  }

  function bulkSendSMS() {
    if (bulkSelected.size === 0) { alert('담당자를 선택해주세요'); return }
    const joinLink = `${window.location.origin}/join?code=${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}`
    const msg = `[ThanQ] ${project?.name || '프로젝트'} 현장 운영 앱에 초대합니다!\n참여 코드: ${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}\n참여 링크: ${joinLink}`
    setBulkPreview({ type: 'sms', msg })
  }
  function bulkSendKakao() {
    if (bulkSelected.size === 0) { alert('담당자를 선택해주세요'); return }
    const joinLink = `${window.location.origin}/join?code=${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}`
    const msg = `[ThanQ] ${project?.name || '프로젝트'} 현장 운영 앱에 초대합니다!\n참여 코드: ${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}\n참여 링크: ${joinLink}`
    setBulkPreview({ type: 'kakao', msg })
  }
  function bulkSendEmail() {
    if (bulkSelected.size === 0) { alert('담당자를 선택해주세요'); return }
    const joinLink = `${window.location.origin}/join?code=${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}`
    const subject = `[ThanQ] ${project?.name || '프로젝트'} 참여 초대`
    const msg = `안녕하세요!\n\n${project?.name || '프로젝트'} 현장 운영 앱에 초대합니다.\n\n참여 코드: ${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}\n참여 링크: ${joinLink}\n\n위 링크를 클릭하거나 참여 코드를 입력하시면 바로 합류할 수 있어요.`
    setBulkPreview({ type: 'email', msg, subject })
  }
  function doBulkSend() {
    if (!bulkPreview) return
    const joinLink = `${window.location.origin}/join?code=${project?.joinCode ?? projectId?.slice(-6).toUpperCase()}`
    const targets = getBulkSelectedParts()
    if (bulkPreview.type === 'sms') {
      const phones = targets.filter(p => partManagers[p.id]?.phone).map(p => partManagers[p.id].phone.replace(/-/g, '')).join(',')
      if (!phones) { setBulkPreview({ ...bulkPreview!, _error: '선택한 담당자 중 전화번호가 없어요' } as any); return }
      window.location.href = `sms:${phones}?body=${encodeURIComponent(bulkPreview.msg)}`
    } else if (bulkPreview.type === 'kakao') {
      if (navigator.share) navigator.share({ title: 'ThanQ 초대', text: bulkPreview.msg, url: joinLink })
      else window.open(`https://story.kakao.com/share?url=${encodeURIComponent(joinLink)}`)
    } else if (bulkPreview.type === 'email') {
      const emails = targets.filter(p => partManagers[p.id]?.email).map(p => partManagers[p.id].email).join(',')
      if (!emails) { setBulkPreview({ ...bulkPreview!, _error: '선택한 담당자 중 이메일이 없어요' } as any); return }
      window.location.href = `mailto:${emails}?subject=${encodeURIComponent(bulkPreview.subject || '')}&body=${encodeURIComponent(bulkPreview.msg)}`
    }
    setBulkPreview(null)
    setShowBulkInvite(false)
  }

  async function openPartEditModal(part: any) {
    setEditingPart(part)
    setEditPartName(part.name)
    const mgr = partManagers[part.id] || {}
    setEditManagerName(mgr.name ?? part.managerName ?? '')
    setEditManagerAlias(mgr.alias ?? '')
    setEditManagerPhone(mgr.phone ?? '')
    setEditManagerEmail(mgr.email ?? '')
    setShowPartEditModal(true)
  }

  async function savePartEdit() {
    if (!projectId || !editingPart) return
    setPartEditSaving(true)
    try {
      await update(ref(db, `parts/${projectId}/${editingPart.id}`), { name: editPartName.trim() || editingPart.name })
      await set(ref(db, `partManagers/${projectId}/${editingPart.id}`), {
        name: editManagerName.trim(),
        alias: editManagerAlias.trim(),
        phone: editManagerPhone.trim(),
        email: editManagerEmail.trim(),
      })
      setShowPartEditModal(false)
    } catch { alert('저장 중 오류가 발생했어요') }
    setPartEditSaving(false)
  }

  async function deletePart(partId: string) {
    if (!projectId) return
    await remove(ref(db, `parts/${projectId}/${partId}`))
    await remove(ref(db, `cueItems/${projectId}/${partId}`))
    await remove(ref(db, `checkItems/${projectId}/${partId}`))
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>
  if (!project) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">프로젝트를 찾을 수 없어요</div>

  const p = project as any
  const dday = getDday(project.date)
  const progress = parts.length ? Math.round(parts.reduce((s, p) => s + p.progress, 0) / parts.length) : 0
  const isOwner = myRole === 'owner' || myRole === 'planner' || project.ownerId === user?.uid
  const roleLabel = ROLE_LABEL[myRole] || (isOwner ? '기획자' : '팀원')
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
                      </span>
                    </div>
                    {(project.startTime || project.endTime) && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">행사 시간</span>
                        <span className="font-semibold text-[#185FA5]">
                          {project.startTime ?? ''}{project.endTime ? ` ~ ${project.endTime}` : ''}
                        </span>
                      </div>
                    )}
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
                    {(project.estimatedPeople ?? 0) > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">예상 인원</span>
                        <span>{(project.estimatedPeople ?? 0).toLocaleString()}명</span>
                      </div>
                    )}
                    {(project.budget ?? 0) > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[#A0AEC0] w-20 flex-shrink-0">예산</span>
                        <span>{(project.budget ?? 0).toLocaleString()}원</span>
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
                    <div className="mt-4 flex gap-2">
                      <button onClick={startEdit}
                        className="flex-1 h-[36px] border border-[#E2E8F0] rounded-[8px] text-[12px] font-semibold text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] flex items-center justify-center gap-1.5 transition-colors">
                        <i className="ti ti-pencil text-[13px]" /> 수정하기
                      </button>
                      <button onClick={()=>{setMoveTargetDate(project.date);setShowMoveDate(true)}}
                        className="flex-1 h-[36px] border border-[#E2E8F0] rounded-[8px] text-[12px] font-semibold text-[#64748B] hover:border-[#F59E0B] hover:text-[#F59E0B] flex items-center justify-center gap-1.5 transition-colors">
                        <i className="ti ti-calendar-event text-[13px]" /> 행사일 이동
                      </button>
                    </div>
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
            <button onClick={() => setShowMyRoleModal(true)}
              className="ml-1 text-[#A0AEC0] hover:text-[#185FA5]">
              <i className="ti ti-pencil text-[11px]"/>
            </button>
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

        {/* 일정표 미리보기 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold flex items-center gap-1.5">
              <i className="ti ti-calendar-event text-[#185FA5]" /> 일정표
            </div>
            <button onClick={() => navigate(`/p/${projectId}/timeline`)} className="text-[12px] text-[#185FA5]">전체 보기</button>
          </div>
          {(() => {
            const allCues = Object.values(cuesByPart).flat()
            if (allCues.length === 0) return (
              <div className="flex flex-col items-center justify-center py-5 gap-2">
                <i className="ti ti-calendar-off text-[#A0AEC0] text-[28px]" />
                <p className="text-[12px] text-[#A0AEC0] text-center leading-relaxed">
                  타임라인으로 가셔서<br/>일정을 추가해 주세요 😊
                </p>
                <button onClick={() => navigate(`/p/${projectId}/timeline`)}
                  className="mt-1 h-[32px] px-4 bg-[#E6F1FB] text-[#185FA5] rounded-[8px] text-[12px] font-semibold hover:bg-[#185FA5] hover:text-white transition-colors">
                  타임라인 열기
                </button>
              </div>
            )

            // 시간대 추출
            const times = [...new Set(allCues.map(c => c.startTime))].sort()
            const previewTimes = times.length > 0 ? times.slice(0, 6) : []
            const previewParts = parts.slice(0, 5)
            return (
              <button onClick={() => navigate(`/p/${projectId}/timeline`)}
                className="w-full text-left" style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 0 }}>
                  {/* 헤더 — 시간 */}
                  <div className="flex mb-1">
                    <div className="w-[56px] flex-shrink-0" />
                    {previewTimes.map(t => (
                      <div key={t} className="flex-1 text-[10px] text-[#A0AEC0] text-center font-mono">{t}</div>
                    ))}
                  </div>
                  {/* 파트별 행 */}
                  {previewParts.map(part => {
                    const partCues = (cuesByPart[part.id] ?? []).filter(c => previewTimes.includes(c.startTime))
                    return (
                      <div key={part.id} className="flex items-center mb-1">
                        <div className="w-[56px] flex-shrink-0 flex items-center gap-1 pr-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: part.color }} />
                          <span className="text-[10px] text-[#64748B] truncate">{part.name}</span>
                        </div>
                        {previewTimes.map(t => {
                          const cue = partCues.find(c => c.startTime === t)
                          return (
                            <div key={t} className="flex-1 px-0.5">
                              {cue ? (
                                <div className="h-[22px] rounded-[4px] flex items-center px-1.5 overflow-hidden"
                                  style={{ background: part.color + '33', border: `1px solid ${part.color}88` }}>
                                  <span className="text-[9px] truncate font-medium" style={{ color: part.color }}>{cue.title}</span>
                                </div>
                              ) : (
                                <div className="h-[22px]" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })()}
        </div>

        {/* 파트 구성 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] mb-4 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => { setShowParts(v => !v); if (showParts) setEditingPartsBottom(false) }}>
            <div className="flex items-center gap-2">
              <i className="ti ti-puzzle text-[#185FA5] text-[15px]" />
              <span className="text-[13px] font-semibold text-[#1A1A2E]">파트 구성</span>
              <span className="text-[11px] text-[#A0AEC0]">{parts.filter(p => !(p as any).isParticipant).length}개 진행팀 · {parts.filter(p => (p as any).isParticipant).length}개 참가자</span>
            </div>
            <i className={`ti ti-chevron-${showParts ? 'up' : 'down'} text-[#A0AEC0] text-[14px]`} />
          </button>

          {showParts && (
            <div className="border-t border-[#F4F6F9] px-4 py-4">
              {/* 행사진행 */}
              {parts.filter(p => !(p as any).isParticipant).length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <i className="ti ti-users text-[#185FA5] text-[11px]" />
                    <span className="text-[11px] font-bold text-[#185FA5]">행사진행</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {parts.filter(p => !(p as any).isParticipant).map(part => (
                      <div key={part.id} className="flex items-center px-3 py-2.5 rounded-[10px] hover:bg-[#F4F6F9] transition-colors">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: part.color }} />
                        <span className="text-[13px] font-medium text-[#1A1A2E] flex-1 ml-2.5">{part.name}</span>
                        {part.id === myPartId && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5] mr-1">나</span>}
                        {(part as any).memberRole && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mr-2"
                            style={{ background: ROLE_BG[(part as any).memberRole] ?? '#F4F6F9', color: ROLE_COLOR[(part as any).memberRole] ?? '#64748B' }}>
                            {ROLE_LABEL[(part as any).memberRole] ?? (part as any).memberRole}
                          </span>
                        )}
                        <span className="w-[44px] flex-shrink-0 flex justify-center"><StatusBadge status={part.status} /></span>
                        <span className="text-[12px] text-[#A0AEC0] w-[32px] flex-shrink-0 text-center">{part.progress}%</span>
                        <span className="text-[12px] text-[#64748B] w-[72px] flex-shrink-0 text-right truncate">{partManagers[part.id]?.name ?? part.managerName ?? '담당자 없음'}</span>
                        {!editingPartsBottom && (isOwner || part.id === myPartId) && (
                          <button onClick={() => setShowInviteModal(part)} className="ml-2 text-[#A0AEC0] hover:text-[#185FA5] flex-shrink-0">
                            <i className="ti ti-user-plus text-[14px]"/>
                          </button>
                        )}
                        {editingPartsBottom && (
                          <div className="flex gap-2 ml-2 flex-shrink-0">
                            <button onClick={() => isOwner ? (setRoleChangeTarget(part), setRoleChangeRole((part as any).memberRole ?? 'staff')) : setShowNoPermission(part.name)} className="text-[#A0AEC0] hover:text-[#E8820C]"><i className="ti ti-shield text-[14px]"/></button>
                            <button onClick={(e) => { e.stopPropagation(); (isOwner || part.id === myPartId) ? openPartEditModal(part) : setShowNoPermission(part.name) }} className="text-[#A0AEC0] hover:text-[#185FA5]"><i className="ti ti-pencil text-[14px]"/></button>
                            <button onClick={() => (isOwner || part.id === myPartId) ? deletePart(part.id) : setShowNoPermission(part.name)} className="text-[#A0AEC0] hover:text-[#E24B4A]"><i className="ti ti-trash text-[14px]"/></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 참가자 */}
              {parts.filter(p => (p as any).isParticipant).length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <i className="ti ti-run text-[#854F0B] text-[11px]" />
                    <span className="text-[11px] font-bold text-[#854F0B]">참가자</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {parts.filter(p => (p as any).isParticipant).map(part => (
                      <div key={part.id} className="flex items-center px-3 py-2.5 rounded-[10px] hover:bg-[#F4F6F9] transition-colors">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: part.color }} />
                        <span className="text-[13px] font-medium text-[#1A1A2E] flex-1 ml-2.5">{part.name}</span>
                        {part.id === myPartId && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF8F0] text-[#854F0B] mr-1">나</span>}
                        <span className="w-[44px] flex-shrink-0 flex justify-center"><StatusBadge status={part.status} /></span>
                        <span className="text-[12px] text-[#A0AEC0] w-[32px] flex-shrink-0 text-center">{part.progress}%</span>
                        <span className="text-[12px] text-[#64748B] w-[72px] flex-shrink-0 text-right truncate">{partManagers[part.id]?.name ?? part.managerName ?? '담당자 없음'}</span>
                        {!editingPartsBottom && (isOwner || part.id === myPartId) && (
                          <button onClick={() => setShowInviteModal(part)} className="ml-2 text-[#A0AEC0] hover:text-[#185FA5] flex-shrink-0">
                            <i className="ti ti-user-plus text-[14px]"/>
                          </button>
                        )}
                        {editingPartsBottom && (
                          <div className="flex gap-2 ml-2 flex-shrink-0">
                            <button onClick={() => isOwner ? (setRoleChangeTarget(part), setRoleChangeRole((part as any).memberRole ?? 'participant')) : setShowNoPermission(part.name)} className="text-[#A0AEC0] hover:text-[#E8820C]"><i className="ti ti-shield text-[14px]"/></button>
                            <button onClick={() => (isOwner || part.id === myPartId) ? openPartEditModal(part) : setShowNoPermission(part.name)} className="text-[#A0AEC0] hover:text-[#185FA5]"><i className="ti ti-pencil text-[14px]"/></button>
                            <button onClick={() => (isOwner || part.id === myPartId) ? deletePart(part.id) : setShowNoPermission(part.name)} className="text-[#A0AEC0] hover:text-[#E24B4A]"><i className="ti ti-trash text-[13px]"/></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parts.length === 0 && (
                <p className="text-[12px] text-[#A0AEC0] text-center py-2">파트가 없어요</p>
              )}

              <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-[#F4F6F9]">
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingPartsBottom(v => !v)}
                    className={`flex-1 h-[32px] rounded-[8px] text-[12px] font-semibold border transition-colors ${editingPartsBottom ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                    {editingPartsBottom ? '편집 완료' : '파트 편집'}
                  </button>
                  {editingPartsBottom && isOwner && (
                    <button onClick={addPart}
                      className="flex-1 h-[32px] rounded-[8px] text-[12px] font-semibold border border-dashed border-[#E2E8F0] text-[#A0AEC0] hover:border-[#185FA5] hover:text-[#185FA5] transition-colors flex items-center justify-center gap-1">
                      <i className="ti ti-plus text-[12px]" /> 파트 추가
                    </button>
                  )}
                </div>
                {isOwner && (
                  <button onClick={() => { setBulkSelected(new Set()); setShowBulkInvite(true) }}
                    className="w-full h-[32px] border border-[#E2E8F0] rounded-[8px] text-[12px] font-semibold text-[#185FA5] flex items-center justify-center gap-1.5 hover:bg-[#E6F1FB] transition-colors">
                    <i className="ti ti-send text-[12px]" /> 단체 초대
                  </button>
                )}
              </div>
            </div>
          )}
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


        {/* ── 프로젝트 운영 단계 + AI 시뮬레이션 ── */}
        {isOwner && (
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] mb-4 overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-[#F4F6F9]">
              <i className="ti ti-flag text-[#185FA5] text-[15px]" />
              <span className="text-[13px] font-semibold text-[#1A1A2E]">운영 단계</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex gap-2 mb-3">
                {([
                  { value: 'planning', label: '기획중', icon: 'ti-pencil', color: '#64748B', bg: '#F4F6F9', activeBg: '#1A1A2E', activeText: 'white' },
                  { value: 'testing', label: '테스트중', icon: 'ti-player-play', color: '#185FA5', bg: '#E6F1FB', activeBg: '#185FA5', activeText: 'white' },
                  { value: 'live', label: '진행', icon: 'ti-broadcast', color: '#A32D2D', bg: '#FCEBEB', activeBg: '#A32D2D', activeText: 'white' },
                ] as const).map(ph => {
                  const current = (project as any).phase ?? 'planning'
                  const isActive = current === ph.value
                  return (
                    <button key={ph.value}
                      onClick={() => updateProjectPhase(ph.value)}
                      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-[10px] border-2 transition-all"
                      style={{
                        background: isActive ? ph.activeBg : ph.bg,
                        borderColor: isActive ? ph.activeBg : 'transparent',
                        color: isActive ? ph.activeText : ph.color,
                      }}>
                      <i className={`ti ${ph.icon} text-[16px]`} />
                      <span className="text-[11px] font-semibold">{ph.label}</span>
                    </button>
                  )
                })}
              </div>
              {/* 테스트중일 때만 시뮬레이션 버튼 표시 */}
              {((project as any).phase === 'testing' || !(project as any).phase && false) && (
                <button
                  onClick={() => navigate(`/p/${projectId}/timeline`)}
                  className="w-full h-[42px] bg-[#E6F1FB] border-2 border-[#185FA5] rounded-[12px] text-[13px] font-semibold text-[#185FA5] flex items-center justify-center gap-2 hover:bg-[#185FA5] hover:text-white transition-all group">
                  <i className="ti ti-player-play text-[15px]" />
                  AI 시뮬레이션 실행
                  <span className="text-[10px] bg-[#185FA5] text-white px-1.5 py-0.5 rounded-full group-hover:bg-white group-hover:text-[#185FA5] transition-all">BETA</span>
                </button>
              )}
              {(project as any).phase === 'live' && (
                <div className="flex items-center gap-2 bg-[#FCEBEB] rounded-[10px] px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-[#E24B4A] animate-pulse flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-[#A32D2D]">현재 진행 중인 행사입니다</span>
                </div>
              )}
            </div>
          </div>
        )}

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

      {/* 내 역할/파트 변경 모달 */}
      {showMyRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5" onClick={() => setShowMyRoleModal(false)}>
          <div className="bg-white rounded-[20px] p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold">내 파트 변경</div>
              <button onClick={() => setShowMyRoleModal(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
            </div>
            <p className="text-[12px] text-[#64748B] mb-4">어느 파트로 보고 싶으신가요? 선택한 파트의 시각으로 확인할 수 있어요.</p>
            <div className="flex flex-col gap-2 mb-4 max-h-[300px] overflow-y-auto">
              {/* 기획자(전체) 옵션 - 오너/플래너만 */}
              {(myRole === 'planner' || myRole === 'owner' || project?.ownerId === user?.uid) && (
                <button onClick={() => setMyNewPartId('__planner__')}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId === '__planner__' || (!myNewPartId && !myPartId) ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
                  <div className="w-5 h-5 rounded-full bg-[#E6F1FB] flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-shield-check text-[#185FA5] text-[11px]"/>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-[#185FA5]">기획자 (전체 관리)</div>
                    <div className="text-[11px] text-[#64748B]">모든 팀 수정 가능</div>
                  </div>
                  {(myNewPartId === '__planner__' || (!myNewPartId && !myPartId)) && <i className="ti ti-check text-[#185FA5] text-[16px]"/>}
                </button>
              )}
              {parts.filter(p => !(p as any).isParticipant).length > 0 && (
                <div className="text-[11px] font-bold text-[#185FA5] mb-1 flex items-center gap-1">
                  <i className="ti ti-users text-[10px]"/> 행사진행
                </div>
              )}
              {parts.filter(p => !(p as any).isParticipant).map(part => (
                <button key={part.id} onClick={() => setMyNewPartId(part.id)}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId === part.id || (!myNewPartId && part.id === myPartId) ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: part.color }}/>
                  <span className="text-[13px] font-semibold flex-1">{part.name}</span>
                  {(myNewPartId === part.id || (!myNewPartId && part.id === myPartId)) && <i className="ti ti-check text-[#185FA5] text-[16px]"/>}
                </button>
              ))}
              {parts.filter(p => (p as any).isParticipant).length > 0 && (
                <div className="text-[11px] font-bold text-[#854F0B] mt-2 mb-1 flex items-center gap-1">
                  <i className="ti ti-run text-[10px]"/> 참가자
                </div>
              )}
              {parts.filter(p => (p as any).isParticipant).map(part => (
                <button key={part.id} onClick={() => setMyNewPartId(part.id)}
                  className={`flex items-center gap-3 p-3 rounded-[10px] border-2 text-left transition-colors ${myNewPartId === part.id || (!myNewPartId && part.id === myPartId) ? 'border-[#854F0B] bg-[#FFF8F0]' : 'border-[#E2E8F0]'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: part.color }}/>
                  <span className="text-[13px] font-semibold flex-1">{part.name}</span>
                  {(myNewPartId === part.id || (!myNewPartId && part.id === myPartId)) && <i className="ti ti-check text-[#854F0B] text-[16px]"/>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowMyRoleModal(false)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={() => saveMyRole(myNewPartId || myPartId)}
                className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold">저장</button>
            </div>
          </div>
        </div>
      )}


      {/* 단체 초대 모달 */}
      {showBulkInvite && (() => {
        const staffParts = parts.filter(p => !(p as any).isParticipant)
        const participantParts = parts.filter(p => (p as any).isParticipant)
        const allIds = parts.map(p => p.id)
        const staffIds = staffParts.map(p => p.id)
        const participantIds = participantParts.map(p => p.id)
        const isAllSelected = allIds.every(id => bulkSelected.has(id))
        const isStaffSelected = staffIds.length > 0 && staffIds.every(id => bulkSelected.has(id))
        const isParticipantSelected = participantIds.length > 0 && participantIds.every(id => bulkSelected.has(id))
        const toggleId = (id: string) => {
          const next = new Set(bulkSelected); next.has(id) ? next.delete(id) : next.add(id); setBulkSelected(next)
        }
        const toggleGroup = (ids: string[], allOn: boolean) => {
          const next = new Set(bulkSelected); ids.forEach(id => allOn ? next.delete(id) : next.add(id)); setBulkSelected(next)
        }
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowBulkInvite(false)}>
            <div className="bg-white rounded-t-[20px] w-full max-w-2xl pb-8" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F6F9]">
                <div className="text-[16px] font-semibold">단체 초대</div>
                <button onClick={() => setShowBulkInvite(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
              </div>
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold">받는 사람 선택</span>
                  <button onClick={() => toggleGroup(allIds, isAllSelected)}
                    className={`text-[12px] font-semibold px-3 py-1 rounded-full ${isAllSelected ? 'bg-[#185FA5] text-white' : 'bg-[#F4F6F9] text-[#64748B]'}`}>
                    전체 {isAllSelected ? '해제' : '선택'}
                  </button>
                </div>

                {staffParts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5"><i className="ti ti-users text-[#185FA5] text-[11px]" /><span className="text-[11px] font-bold text-[#185FA5]">행사진행</span></div>
                      <button onClick={() => toggleGroup(staffIds, isStaffSelected)}
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isStaffSelected ? 'bg-[#185FA5] text-white' : 'bg-[#E6F1FB] text-[#185FA5]'}`}>
                        {isStaffSelected ? '해제' : '전체선택'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {staffParts.map(part => {
                        const checked = bulkSelected.has(part.id)
                        return (
                          <button key={part.id} onClick={() => toggleId(part.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border transition-colors text-left ${checked ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
                            <div className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#185FA5] border-[#185FA5]' : 'border-[#D1D5DB]'}`}>
                              {checked && <i className="ti ti-check text-white text-[11px]" />}
                            </div>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: part.color }} />
                            <span className="text-[13px] font-medium flex-1">{part.name}</span>
                            <span className="text-[11px] text-[#A0AEC0]">{partManagers[part.id]?.name || '담당자 없음'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {participantParts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5"><i className="ti ti-run text-[#854F0B] text-[11px]" /><span className="text-[11px] font-bold text-[#854F0B]">참가자</span></div>
                      <button onClick={() => toggleGroup(participantIds, isParticipantSelected)}
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isParticipantSelected ? 'bg-[#854F0B] text-white' : 'bg-[#FEF3C7] text-[#854F0B]'}`}>
                        {isParticipantSelected ? '해제' : '전체선택'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {participantParts.map(part => {
                        const checked = bulkSelected.has(part.id)
                        return (
                          <button key={part.id} onClick={() => toggleId(part.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border transition-colors text-left ${checked ? 'border-[#854F0B] bg-[#FFF8F0]' : 'border-[#E2E8F0]'}`}>
                            <div className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-[#854F0B] border-[#854F0B]' : 'border-[#D1D5DB]'}`}>
                              {checked && <i className="ti ti-check text-white text-[11px]" />}
                            </div>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: part.color }} />
                            <span className="text-[13px] font-medium flex-1">{part.name}</span>
                            <span className="text-[11px] text-[#A0AEC0]">{partManagers[part.id]?.name || '담당자 없음'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="text-[12px] text-[#64748B] mb-3">{bulkSelected.size}명 선택됨</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { fn: bulkSendSMS,   icon: 'ti-message',   color: '#3B6D11', label: '문자' },
                    { fn: bulkSendKakao, icon: 'ti-message-2', color: '#854F0B', label: '카카오톡' },
                    { fn: bulkSendEmail, icon: 'ti-mail',      color: '#185FA5', label: '이메일' },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.fn}
                      className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[12px] hover:bg-[#F4F6F9] transition-colors">
                      <i className={`ti ${btn.icon} text-[20px]`} style={{ color: btn.color }} />
                      <span className="text-[11px] text-[#64748B]">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 메시지 미리보기 모달 */}
      {bulkPreview && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center" onClick={() => setBulkPreview(null)}>
          <div className="bg-white rounded-t-[20px] w-full max-w-2xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F6F9]">
              <div className="flex items-center gap-2">
                <i className={`ti ${bulkPreview.type === 'sms' ? 'ti-message' : bulkPreview.type === 'kakao' ? 'ti-message-2' : 'ti-mail'} text-[16px] text-[#185FA5]`} />
                <div className="text-[16px] font-semibold">
                  {bulkPreview.type === 'sms' ? '문자 미리보기' : bulkPreview.type === 'kakao' ? '카카오톡 미리보기' : '이메일 미리보기'}
                </div>
              </div>
              <button onClick={() => setBulkPreview(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
            </div>
            <div className="px-5 pt-4">
              {bulkPreview.type === 'email' && (
                <div className="mb-3">
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">제목</label>
                  <input value={bulkPreview.subject} onChange={e => setBulkPreview({ ...bulkPreview, subject: e.target.value })}
                    className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
                </div>
              )}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">내용 (수정 가능)</label>
                <textarea value={bulkPreview.msg} onChange={e => setBulkPreview({ ...bulkPreview, msg: e.target.value })}
                  rows={7} className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-[#185FA5] resize-none leading-relaxed" />
              </div>
              {(bulkPreview as any)?._error && (
                <div className="mb-3 px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-[10px] text-[12px] text-[#B91C1C]">
                  ⚠️ {(bulkPreview as any)._error}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setBulkPreview(null)} className="flex-1 h-[44px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
                <button onClick={doBulkSend} className="flex-1 h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2">
                  <i className="ti ti-send text-[14px]" /> 이대로 보내기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 팀원 초대 모달 */}
      {showInviteModal && (() => {
        const role = (showInviteModal as any).isParticipant ? 'participant' : 'staff'
        const inviteLink = getInviteLink(showInviteModal, role)
        const mgr = partManagers[showInviteModal.id] ?? {}
        const joinCode = project?.joinCode ?? projectId?.slice(-6).toUpperCase() ?? ''
        const subject = `[ThanQ] ${project?.name || '프로젝트'} 참여 초대`
        const msgBody = `안녕하세요, ${mgr.name || '담당자'}님!

${project?.name || '프로젝트'}에 초대합니다.
담당 파트: ${showInviteModal.name}

참여 코드: ${joinCode}
참여 링크: ${inviteLink}

위 링크를 클릭하거나 참여 코드를 입력하시면 바로 합류할 수 있어요.`
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowInviteModal(null)}>
            <div className="bg-white rounded-t-[20px] w-full max-w-2xl pb-8" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F6F9]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: showInviteModal.color }}/>
                  <div className="text-[16px] font-semibold">{showInviteModal.name} 초대</div>
                </div>
                <button onClick={() => setShowInviteModal(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
              </div>
              <div className="px-5 pt-4">
                {/* 초대 링크 */}
                <div className="bg-[#F4F6F9] rounded-[10px] p-3 mb-4 flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B] flex-1 truncate">{inviteLink}</span>
                  <button onClick={() => copyInviteLink(showInviteModal, role)}
                    className="text-[11px] font-semibold text-[#185FA5] flex-shrink-0">
                    {inviteCopied ? '✓ 복사됨' : '복사'}
                  </button>
                </div>
                {/* 초대 방법 */}
                <div className="text-[12px] font-semibold text-[#64748B] mb-2">초대 방법</div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: '문자', icon: 'ti-message', color: '#3B6D11',
                      fn: () => setIndividualPreview({ type: 'sms', msg: msgBody, phone: mgr.phone?.replace(/-/g, '') ?? '', inviteLink })
                    },
                    { label: '카카오톡', icon: 'ti-message-2', color: '#854F0B',
                      fn: () => {
                        setIndividualPreview({ type: 'kakao', msg: msgBody, inviteLink })
                      }
                    },
                    { label: '이메일', icon: 'ti-mail', color: '#185FA5',
                      fn: () => setIndividualPreview({ type: 'email', msg: msgBody, subject, email: mgr.email ?? '', inviteLink })
                    },
                    { label: '링크 복사', icon: 'ti-link', color: '#64748B',
                      fn: () => { copyInviteLink(showInviteModal, role); }
                    },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.fn}
                      className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[12px] hover:bg-[#F4F6F9] transition-colors">
                      <i className={`ti ${btn.icon} text-[20px]`} style={{ color: btn.color }} />
                      <span className="text-[11px] text-[#64748B]">{btn.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowInviteModal(null)}
                  className="w-full h-[44px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">닫기</button>
              </div>
            </div>
          </div>
        )
      })()}


      {/* 개별 초대 미리보기 모달 */}
      {individualPreview && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end justify-center" onClick={() => setIndividualPreview(null)}>
          <div className="bg-white rounded-t-[20px] w-full max-w-2xl pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F6F9]">
              <div className="flex items-center gap-2">
                <i className={`ti ${individualPreview.type === 'sms' ? 'ti-message' : individualPreview.type === 'kakao' ? 'ti-message-2' : 'ti-mail'} text-[16px] text-[#185FA5]`} />
                <div className="text-[16px] font-semibold">
                  {individualPreview.type === 'sms' ? '문자 미리보기' : individualPreview.type === 'kakao' ? '카카오톡 미리보기' : '이메일 미리보기'}
                </div>
              </div>
              <button onClick={() => setIndividualPreview(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
            </div>
            <div className="px-5 pt-4">
              {individualPreview.type === 'email' && (
                <div className="mb-3">
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">제목</label>
                  <input value={individualPreview.subject} onChange={e => setIndividualPreview({ ...individualPreview, subject: e.target.value })}
                    className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
                </div>
              )}
              <div className="mb-4">
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">내용 (수정 가능)</label>
                <textarea value={individualPreview.msg} onChange={e => setIndividualPreview({ ...individualPreview, msg: e.target.value })}
                  rows={7} className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-[#185FA5] resize-none leading-relaxed" />
              </div>
              {(individualPreview as any)?._error && (
                <div className="mb-3 px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-[10px] text-[12px] text-[#B91C1C]">
                  ⚠️ {(individualPreview as any)._error}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setIndividualPreview(null)}
                  className="flex-1 h-[44px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
                <button onClick={() => {
                  if (individualPreview.type === 'sms') {
                    if (!individualPreview.phone) { setIndividualPreview({ ...individualPreview, _error: '전화번호가 없어요. 담당자 수정에서 입력해주세요.' } as any); return }
                    window.location.href = `sms:${individualPreview.phone}?body=${encodeURIComponent(individualPreview.msg)}`
                  } else if (individualPreview.type === 'kakao') {
                    if (navigator.share) navigator.share({ title: 'ThanQ 초대', text: individualPreview.msg, url: individualPreview.inviteLink || '' })
                    else window.open(`https://story.kakao.com/share?url=${encodeURIComponent(individualPreview.inviteLink || '')}`)
                  } else if (individualPreview.type === 'email') {
                    if (!individualPreview.email) { setIndividualPreview({ ...individualPreview, _error: '이메일이 없어요. 담당자 수정에서 입력해주세요.' } as any); return }
                    window.location.href = `mailto:${individualPreview.email}?subject=${encodeURIComponent(individualPreview.subject || '')}&body=${encodeURIComponent(individualPreview.msg)}`
                  }
                  setIndividualPreview(null)
                  setShowInviteModal(null)
                }} className="flex-1 h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2">
                  <i className="ti ti-send text-[14px]" /> 이대로 보내기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 역할 변경 모달 */}
      {showNoPermission && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <i className="ti ti-lock text-[#DC2626] text-[32px]"/>
            </div>
            <div>
              {myPartName && (
                <div className="text-[13px] text-[#64748B] mb-1">
                  <span className="font-bold text-[#1A1A2E]">{myPartName}</span> 팀이십니다.
                </div>
              )}
              <div className="text-[17px] font-bold text-[#1A1A2E] mb-1">수정 권한이 없어요</div>
              <div className="text-[13px] text-[#64748B]">
                <span className="font-bold text-[#1A1A2E]">{showNoPermission}</span> 팀에 문의해 주시길 바랍니다.
              </div>
            </div>
            <button onClick={() => setShowNoPermission('')} className="w-full h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-semibold">확인</button>
          </div>
        </div>
      )}

      {roleChangeTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5" onClick={() => setRoleChangeTarget(null)}>
          <div className="bg-white rounded-[20px] p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold">역할 변경</div>
              <button onClick={() => setRoleChangeTarget(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
            </div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-[#F4F6F9] rounded-[10px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: roleChangeTarget.color }}/>
              <span className="text-[13px] font-semibold">{roleChangeTarget.name}</span>
            </div>
            <div className="flex flex-col gap-2 mb-5">
              {[
                { value: 'planner', label: '기획자', desc: '모든 팀 수정 가능', icon: 'ti-shield-check', color: '#185FA5' },
                { value: 'staff',   label: '스태프',  desc: '내 팀만 수정 가능', icon: 'ti-user-check', color: '#E8820C' },
                { value: 'participant', label: '참가자', desc: '보기만 가능', icon: 'ti-eye', color: '#854F0B' },
              ].map(r => (
                <button key={r.value} onClick={() => setRoleChangeRole(r.value)}
                  className={`flex items-center gap-3 p-3 rounded-[12px] border-2 transition-colors text-left ${roleChangeRole === r.value ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: r.color + '20' }}>
                    <i className={`ti ${r.icon} text-[16px]`} style={{ color: r.color }}/>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1A1A2E]">{r.label}</div>
                    <div className="text-[11px] text-[#64748B]">{r.desc}</div>
                  </div>
                  {roleChangeRole === r.value && <i className="ti ti-check text-[#185FA5] ml-auto text-[16px]"/>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRoleChangeTarget(null)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={() => saveMemberRole(roleChangeTarget, roleChangeRole)} className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold">저장</button>
            </div>
          </div>
        </div>
      )}
      {/* 행사일 이동 모달 */}
      {showMoveDate && project && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5" onClick={()=>setShowMoveDate(false)}>
          <div className="bg-white rounded-[20px] p-5 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold">행사일 이동</div>
              <button onClick={()=>setShowMoveDate(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]"/></button>
            </div>
            <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-[#FCEBEB] border border-[#F7C1C1] rounded-[10px]">
              <i className="ti ti-alert-triangle text-[#A32D2D] text-[14px] mt-0.5 flex-shrink-0"/>
              <p className="text-[12px] text-[#A32D2D] font-medium leading-relaxed">
                새 행사일을 선택하면 준비 시작일, 종료일, 모든 큐시트 날짜가 같은 일수만큼 자동으로 이동됩니다.
              </p>
            </div>
            <div className="mb-2">
              <div className="text-[11px] text-[#A0AEC0] mb-1">현재 행사일</div>
              <div className="text-[14px] font-bold text-[#1A1A2E]">{project.date}</div>
            </div>
            <div className="mb-4">
              <div className="text-[11px] text-[#A0AEC0] mb-1">새 행사일</div>
              <input type="date" value={moveTargetDate} onChange={e=>setMoveTargetDate(e.target.value)}
                className="w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]"/>
            </div>
            {moveTargetDate && moveTargetDate !== project.date && (
              <div className="mb-4 px-3 py-2 bg-[#FFF8E6] border border-[#FAC775] rounded-[10px] text-[12px] text-[#854F0B]">
                <i className="ti ti-arrow-right text-[12px] mr-1"/>
                {Math.abs((new Date(moveTargetDate).getTime()-new Date(project.date).getTime())/86400000)}일
                {new Date(moveTargetDate)>new Date(project.date)?'뒤':'앞'}으로 전체 이동
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={()=>setShowMoveDate(false)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={moveEventDate} disabled={!moveTargetDate||moveTargetDate===project.date||moving}
                className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold disabled:opacity-40">
                {moving ? '이동 중...' : '이동하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomTabBar />
      {showSimulation && project && (
        <SimulationModal
          project={project}
          parts={parts}
          cuesByPart={cuesByPart}
          onClose={() => setShowSimulation(false)}
        />
      )}
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
      {/* 파트 수정 모달 */}
      {showPartEditModal && editingPart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setShowPartEditModal(false)}>
          <div className="bg-white rounded-[20px] w-full max-w-[400px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-[16px] font-semibold">파트 수정</div>
              <button onClick={() => setShowPartEditModal(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">파트명</label>
                <input value={editPartName} onChange={e => setEditPartName(e.target.value)}
                  className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
              </div>
              <div className="border-t border-[#F4F6F9] pt-3">
                <div className="text-[12px] font-semibold text-[#64748B] mb-3">담당자 정보</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">이름</label>
                    <input value={editManagerName} onChange={e => setEditManagerName(e.target.value)} placeholder="담당자 이름"
                      className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">호칭</label>
                    <input value={editManagerAlias} onChange={e => setEditManagerAlias(e.target.value)} placeholder="예: 홍팀장"
                      className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">전화번호</label>
                    <input value={editManagerPhone} onChange={e => setEditManagerPhone(e.target.value)} placeholder="010-0000-0000" type="tel"
                      className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">이메일</label>
                    <input value={editManagerEmail} onChange={e => setEditManagerEmail(e.target.value)} placeholder="example@email.com" type="email"
                      className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] outline-none focus:border-[#185FA5]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowPartEditModal(false)}
                className="flex-1 h-[44px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={savePartEdit} disabled={partEditSaving}
                className="flex-1 h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold disabled:opacity-50">
                {partEditSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = 'w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] focus:outline-none focus:border-[#185FA5]'
const lbl = 'text-[12px] font-semibold text-[#64748B] mb-1 block'
