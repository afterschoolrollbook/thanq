import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ref, push, set, update, onValue, get } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { PART_COLORS } from '@/utils/fieldTerms'
import { Topbar, StepBar, BottomTabBar } from '@/components/ui/Common'
import type { Part } from '@/types'

interface Manager { name: string; alias: string; phone: string; email: string }
interface PartDraft { name: string; manager: Manager | null; isParticipant: boolean }

const emptyManager = (): Manager => ({ name: '', alias: '', phone: '', email: '' })

export default function SetupPartsPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)

  // 행사진행 파트 / 참가자 파트 분리
  const [staffParts, setStaffParts] = useState<PartDraft[]>([
    { name: '', manager: null, isParticipant: false },
    { name: '', manager: null, isParticipant: false },
  ])
  const [participantParts, setParticipantParts] = useState<PartDraft[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteTarget, setInviteTarget] = useState<{ group: 'staff' | 'participant'; idx: number } | null>(null)
  const [manager, setManager] = useState<Manager>(emptyManager())
  const [initialized, setInitialized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showQR, setShowQR] = useState(false)
  const [showBulkInvite, setShowBulkInvite] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkPreview, setBulkPreview] = useState<{ type: 'sms' | 'kakao' | 'email'; msg: string; subject?: string } | null>(null)
  const [projectName, setProjectName] = useState('')

  const joinCode = projectId?.slice(-6).toUpperCase() ?? 'AB3X7F'
  const baseJoinLink = `${window.location.origin}/join?code=${joinCode}`
  // invitePartId는 현재 초대 중인 파트의 임시 ID (저장 전이라 없음 → 저장 후 공유)
  const [invitePartLink, setInvitePartLink] = useState('')
  const joinLink = invitePartLink || baseJoinLink

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}/name`), (s) => { if (s.exists()) setProjectName(s.val()) })
    onValue(ref(db, `draftParts/${projectId}`), (snap) => {
      if (snap.exists()) {
        const saved = snap.val() as Record<string, PartDraft>
        const all = Object.values(saved).map((p) => ({
          name: p.name,
          manager: p.manager ?? null,
          isParticipant: p.isParticipant ?? false,
        }))
        setStaffParts(all.filter((p) => !p.isParticipant))
        setParticipantParts(all.filter((p) => p.isParticipant))
      }
      setInitialized(true)
    }, { onlyOnce: true })
  }, [projectId])

  async function saveDraft(staff: PartDraft[], participants: PartDraft[]) {
    if (!projectId) return
    setSaveStatus('saving')
    try {
      const data: Record<string, PartDraft> = {}
      ;[...staff, ...participants].forEach((p, i) => { data[String(i)] = p })
      await set(ref(db, `draftParts/${projectId}`), data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch { setSaveStatus('idle') }
  }

  function updateName(group: 'staff' | 'participant', idx: number, name: string) {
    if (group === 'staff') {
      const next = staffParts.map((p, i) => i === idx ? { ...p, name } : p)
      setStaffParts(next); saveDraft(next, participantParts)
    } else {
      const next = participantParts.map((p, i) => i === idx ? { ...p, name } : p)
      setParticipantParts(next); saveDraft(staffParts, next)
    }
  }

  function addPart(group: 'staff' | 'participant') {
    if (group === 'staff') {
      const next = [...staffParts, { name: '', manager: null, isParticipant: false }]
      setStaffParts(next); saveDraft(next, participantParts)
    } else {
      const next = [...participantParts, { name: '', manager: null, isParticipant: true }]
      setParticipantParts(next); saveDraft(staffParts, next)
    }
  }

  function removePart(group: 'staff' | 'participant', idx: number) {
    if (group === 'staff') {
      const next = staffParts.filter((_, i) => i !== idx)
      setStaffParts(next); saveDraft(next, participantParts)
    } else {
      const next = participantParts.filter((_, i) => i !== idx)
      setParticipantParts(next); saveDraft(staffParts, next)
    }
  }

  function openInvite(group: 'staff' | 'participant', idx: number) {
    setInviteTarget({ group, idx })
    const part = group === 'staff' ? staffParts[idx] : participantParts[idx]
    setManager(part.manager ?? emptyManager())
    // 파트 역할 링크 생성 (partKey = group+idx 조합, 저장 시 실제 partId로 교체됨)
    const partKey = `${group}_${idx}`
    const role = group === 'participant' ? 'participant' : 'staff'
    setInvitePartLink(`${baseJoinLink}&partKey=${partKey}&role=${role}&partName=${encodeURIComponent(part.name || (group === 'staff' ? `운영팀 ${idx+1}` : `그룹 ${idx+1}`))}`)
  }

  function saveManager() {
    if (!inviteTarget) return
    const { group, idx } = inviteTarget
    const updatedManager = manager.name ? { ...manager } : null
    if (group === 'staff') {
      const next = staffParts.map((p, i) => i === idx ? { ...p, manager: updatedManager } : p)
      setStaffParts(next); saveDraft(next, participantParts)
    } else {
      const next = participantParts.map((p, i) => i === idx ? { ...p, manager: updatedManager } : p)
      setParticipantParts(next); saveDraft(staffParts, next)
    }
    setInviteTarget(null)
  }

  function shareKakao() {
    const msg = `[ThanQ] ${manager.name || '담당자'}님을 초대합니다!\n참여 코드: ${joinCode}\n${joinLink}`
    if (navigator.share) navigator.share({ title: 'ThanQ 초대', text: msg, url: joinLink })
    else window.open(`https://story.kakao.com/share?url=${encodeURIComponent(joinLink)}`)
  }
  function shareSMS() {
    window.location.href = `sms:${manager.phone.replace(/-/g, '')}?body=${encodeURIComponent(`[ThanQ] 현장 운영 앱에 초대합니다! 참여코드: ${joinCode} / ${joinLink}`)}`
  }
  function shareEmail() {
    if (!manager.email) { alert('이메일 주소를 먼저 입력해주세요'); return }
    const part = inviteTarget?.group === 'staff' ? staffParts[inviteTarget.idx] : participantParts[inviteTarget!.idx]
    const subject = `[ThanQ] ${projectName || '프로젝트'} 참여 초대`
    const body = `안녕하세요, ${manager.name || '담당자'}님!

${projectName || '프로젝트'}에 초대합니다.${part?.name ? `
담당 파트: ${part.name}` : ''}

참여 코드: ${joinCode}
참여 링크: ${joinLink}

위 링크를 클릭하거나 참여 코드를 입력하시면 바로 합류할 수 있어요.`
    window.location.href = `mailto:${manager.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  async function copyLink() { await navigator.clipboard.writeText(joinLink); alert('링크가 복사됐어요!') }

  function getSelectedParts() {
    return [...staffParts, ...participantParts].filter((_, i) => {
      const key = i < staffParts.length ? `staff_${i}` : `participant_${i - staffParts.length}`
      return bulkSelected.has(key)
    })
  }

  function bulkSendSMS() {
    if (bulkSelected.size === 0) { alert('담당자를 선택해주세요'); return }
    const msg = `[ThanQ] ${projectName || '프로젝트'} 현장 운영 앱에 초대합니다!
참여 코드: ${joinCode}
참여 링크: ${baseJoinLink}`
    setBulkPreview({ type: 'sms', msg })
  }

  function bulkSendKakao() {
    if (bulkSelected.size === 0) { alert('담당자를 선택해주세요'); return }
    const msg = `[ThanQ] ${projectName || '프로젝트'} 현장 운영 앱에 초대합니다!
참여 코드: ${joinCode}
참여 링크: ${baseJoinLink}`
    setBulkPreview({ type: 'kakao', msg })
  }

  function bulkSendEmail() {
    if (bulkSelected.size === 0) { alert('담당자를 선택해주세요'); return }
    const subject = `[ThanQ] ${projectName || '프로젝트'} 참여 초대`
    const msg = `안녕하세요!

${projectName || '프로젝트'} 현장 운영 앱에 초대합니다.

참여 코드: ${joinCode}
참여 링크: ${baseJoinLink}

위 링크를 클릭하거나 참여 코드를 입력하시면 바로 합류할 수 있어요.`
    setBulkPreview({ type: 'email', msg, subject })
  }

  function doSend() {
    if (!bulkPreview) return
    const targets = getSelectedParts()
    if (bulkPreview.type === 'sms') {
      const phones = targets.filter(p => p.manager?.phone).map(p => p.manager!.phone.replace(/-/g, '')).join(',')
      if (!phones) { alert('전화번호가 없어요'); return }
      window.location.href = `sms:${phones}?body=${encodeURIComponent(bulkPreview.msg)}`
    } else if (bulkPreview.type === 'kakao') {
      if (navigator.share) navigator.share({ title: 'ThanQ 초대', text: bulkPreview.msg, url: baseJoinLink })
      else window.open(`https://story.kakao.com/share?url=${encodeURIComponent(baseJoinLink)}`)
    } else if (bulkPreview.type === 'email') {
      const emails = targets.filter(p => p.manager?.email).map(p => p.manager!.email).join(',')
      if (!emails) { alert('이메일이 없어요'); return }
      window.location.href = `mailto:${emails}?subject=${encodeURIComponent(bulkPreview.subject || '')}&body=${encodeURIComponent(bulkPreview.msg)}`
    }
    setBulkPreview(null)
    setShowBulkInvite(false)
  }

  async function handleSave() {
    const allParts = [...staffParts, ...participantParts]
    const valid = allParts.filter((p) => p.name.trim())
    if (valid.length === 0) { setError('파트를 최소 1개 이상 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      const aliasMap: Record<string, string> = user
        ? ((await get(ref(db, `pttAliases/${projectId}/${user.uid}`))).val() ?? {})
        : {}

      for (let i = 0; i < valid.length; i++) {
        const p = valid[i]
        const partRef = push(ref(db, `parts/${projectId}`))
        const partId = partRef.key!
        const part: Part = {
          id: partId, projectId: projectId!, name: p.name.trim(),
          color: PART_COLORS[i % PART_COLORS.length],
          managerName: p.manager?.name ?? undefined,
          status: 'waiting', progress: 0, order: i,
          isParticipant: p.isParticipant,
          createdAt: new Date().toISOString(),
        }
        await set(ref(db, `parts/${projectId}/${partId}`), part)
        if (p.manager?.name) await set(ref(db, `partManagers/${projectId}/${partId}`), p.manager)
        if (p.manager?.alias?.trim() && user) {
          aliasMap[partId] = p.manager.alias.trim()
        }
        // 파트 role 저장
        const memberRole = p.isParticipant ? 'participant' : 'staff'
        // partKey → partId 매핑 저장 (JoinPage에서 참조)
        const groupName = p.isParticipant ? 'participant' : 'staff'
        const idxInGroup = p.isParticipant
          ? participantParts.filter(pp => pp.name.trim()).indexOf(p as any)
          : staffParts.filter(pp => pp.name.trim()).indexOf(p as any)
        const partKey = `${groupName}_${idxInGroup}`
        await set(ref(db, `partKeyMap/${projectId}/${partKey}`), { partId, partName: p.name.trim(), memberRole })
      }
      // 오너를 기획자로 등록
      if (user) {
        await update(ref(db, `projectMembers/${projectId}/${user.uid}`), {
          role: 'planner', partId: '', partName: '기획자'
        })
      }
      if (user && Object.keys(aliasMap).length > 0) {
        await set(ref(db, `pttAliases/${projectId}/${user.uid}`), aliasMap)
      }
      await set(ref(db, `draftParts/${projectId}`), null)
      navigate(`/p/${projectId}/home`)
    } catch (e) {
      setError(`저장 중 오류가 발생했어요: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setLoading(false) }
  }

  if (!initialized) return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
      <div className="text-[13px] text-[#64748B]">불러오는 중...</div>
    </div>
  )

  const allColorIdx = (group: 'staff' | 'participant', idx: number) =>
    group === 'staff' ? idx : staffParts.length + idx

  function PartRow({ group, part, idx }: { group: 'staff' | 'participant'; part: PartDraft; idx: number }) {
    const colorIdx = allColorIdx(group, idx)
    const list = group === 'staff' ? staffParts : participantParts
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[10px]">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PART_COLORS[colorIdx % PART_COLORS.length] }} />
        <input
          className="flex-1 text-[13px] font-medium text-[#1A1A2E] outline-none bg-transparent placeholder-[#A0AEC0]"
          placeholder={group === 'staff' ? `운영팀 ${idx + 1}` : `그룹 ${idx + 1}`}
          value={part.name}
          onChange={(e) => updateName(group, idx, e.target.value)}
        />
        <button
          onClick={() => openInvite(group, idx)}
          className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
            part.manager?.name
              ? 'border-[#185FA5] text-[#185FA5] bg-[#E6F1FB]'
              : 'border-[#E2E8F0] text-[#A0AEC0] hover:border-[#185FA5] hover:text-[#185FA5]'
          }`}>
          <i className="ti ti-user-plus text-[13px]" />
          {part.manager?.alias || part.manager?.name || '담당자 초대'}
        </button>
        {list.length > 1 && (
          <i className="ti ti-x text-[14px] text-[#A0AEC0] cursor-pointer hover:text-[#A32D2D]"
            onClick={() => removePart(group, idx)} />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={4} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-28">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[20px] font-semibold text-[#1A1A2E]">파트 구성 및 담당자 초대</h2>
          {saveStatus === 'saving' && <span className="text-[11px] text-[#A0AEC0]">저장 중...</span>}
          {saveStatus === 'saved'  && <span className="text-[11px] text-[#3B6D11]">저장됨 ✓</span>}
        </div>
        <p className="text-[13px] text-[#64748B] mb-6">입력하는 즉시 저장돼요 — 언제든 이어서 작업 가능해요</p>

        {/* ── 행사진행 파트 ── */}
        <div className="mb-1">
          <div className="flex items-center gap-2 mb-2">
            <i className="ti ti-users text-[#185FA5] text-[14px]" />
            <span className="text-[12px] font-bold text-[#185FA5]">행사진행</span>
            <span className="text-[11px] text-[#A0AEC0]">운영팀, 포토팀 등 행사를 진행하는 파트</span>
          </div>
          <div className="flex flex-col gap-2 mb-2">
            {staffParts.map((part, idx) => (
              <PartRow key={idx} group="staff" part={part} idx={idx} />
            ))}
          </div>
          <button onClick={() => addPart('staff')}
            className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-[#E2E8F0] rounded-[10px] text-[13px] text-[#A0AEC0] w-full hover:border-[#185FA5] hover:text-[#185FA5] transition-colors mb-4">
            <i className="ti ti-plus text-[15px]" /> 행사진행 파트 추가
          </button>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-[11px] text-[#A0AEC0] font-medium">참가자</span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        {/* ── 참가자 파트 ── */}
        <div className="mb-1">
          <div className="flex items-center gap-2 mb-2">
            <i className="ti ti-run text-[#854F0B] text-[14px]" />
            <span className="text-[12px] font-bold text-[#854F0B]">참가자</span>
            <span className="text-[11px] text-[#A0AEC0]">A그룹, B그룹 등 참가자 그룹</span>
          </div>
          <div className="flex flex-col gap-2 mb-2">
            {participantParts.map((part, idx) => (
              <PartRow key={idx} group="participant" part={part} idx={idx} />
            ))}
          </div>
          <button onClick={() => addPart('participant')}
            className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-[#E2E8F0] rounded-[10px] text-[13px] text-[#A0AEC0] w-full hover:border-[#854F0B] hover:text-[#854F0B] transition-colors mb-5">
            <i className="ti ti-plus text-[15px]" /> 참가자 그룹 추가
          </button>
        </div>

        {/* 참여 코드 */}
        <div className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[14px] p-4 mb-5">
          <div className="text-[12px] text-[#A0AEC0] text-center mb-1">참여 코드</div>
          <div className="text-[32px] font-bold tracking-[8px] text-[#185FA5] text-center my-2">{joinCode}</div>
          <div className="text-[12px] text-[#A0AEC0] text-center mb-3">이 코드를 공유하면 담당자가 바로 합류할 수 있어요</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={copyLink} className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B] hover:border-[#185FA5]">
              <i className="ti ti-copy text-[14px]" /> 링크 복사
            </button>
            <button onClick={() => setShowQR(true)} className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B] hover:border-[#185FA5]">
              <i className="ti ti-qrcode text-[14px]" /> QR 코드
            </button>
          </div>
          <button onClick={() => setShowBulkInvite(true)}
            className="w-full h-[38px] bg-[#185FA5] text-white rounded-[10px] flex items-center justify-center gap-2 text-[13px] font-semibold hover:bg-[#1450A3] transition-colors">
            <i className="ti ti-send text-[14px]" /> 전체 담당자 일괄 초대
          </button>
        </div>

        {error && (
          <div className="bg-[#FCEBEB] border border-[#F09595] rounded-[10px] px-4 py-3 mb-3 flex items-start gap-2">
            <i className="ti ti-alert-circle text-[#A32D2D] text-[15px] mt-0.5 flex-shrink-0" />
            <p className="text-[#A32D2D] text-[12px]">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-5 border-t border-[#E2E8F0]">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[13px] text-[#64748B]">
            <i className="ti ti-arrow-left text-[14px]" /> 이전
          </button>
          <button onClick={handleSave} disabled={loading}
            className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            <i className="ti ti-rocket" /> {loading ? '저장 중...' : '프로젝트 시작'}
          </button>
        </div>
      </div>

      <BottomTabBar />

      {/* 담당자 초대 모달 */}
      {inviteTarget !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setInviteTarget(null)}>
          <div className="bg-white w-full max-w-2xl rounded-t-[20px] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold">담당자 초대</div>
              <button onClick={() => setInviteTarget(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className={lbl}>이름</label>
                <input className={inp} placeholder="홍길동" value={manager.name}
                  onChange={(e) => setManager({ ...manager, name: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>
                  표시 이름 <span className="text-[#A0AEC0] font-normal">(나에게만 보이는 별칭, 비워두면 이름으로 표시)</span>
                </label>
                <input className={inp} placeholder={manager.name || '예: 음향팀장, 방PD'} value={manager.alias}
                  onChange={(e) => setManager({ ...manager, alias: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>전화번호</label>
                <input className={inp} placeholder="010-1234-5678" type="tel" value={manager.phone}
                  onChange={(e) => setManager({ ...manager, phone: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>이메일</label>
                <input className={inp} placeholder="example@email.com" type="email" value={manager.email}
                  onChange={(e) => setManager({ ...manager, email: e.target.value })} />
              </div>
            </div>

            <div className="text-[12px] font-semibold text-[#64748B] mb-2">초대 방법</div>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { fn: shareSMS,   icon: 'ti-message',   color: '#3B6D11', label: '문자' },
                { fn: shareKakao, icon: 'ti-message-2',  color: '#3A1D1D', label: '카카오톡' },
                { fn: shareEmail, icon: 'ti-mail', color: '#185FA5', label: '이메일' },
                { fn: copyLink,   icon: 'ti-link',       color: '#64748B', label: '링크 복사' },
              ].map((s) => (
                <button key={s.label} onClick={s.fn}
                  className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5]">
                  <i className={`ti ${s.icon} text-[20px]`} style={{ color: s.color }} />
                  <span className="text-[11px] text-[#64748B]">{s.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setInviteTarget(null)}
                className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={saveManager}
                className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 초대 모달 */}
      {showBulkInvite && (() => {
        const allParts = [
          ...staffParts.map((p, i) => ({ ...p, key: `staff_${i}`, group: '행사진행' })),
          ...participantParts.map((p, i) => ({ ...p, key: `participant_${i}`, group: '참가자' })),
        ]
        const allKeys = allParts.map(p => p.key)
        const staffKeys = staffParts.map((_, i) => `staff_${i}`)
        const participantKeys = participantParts.map((_, i) => `participant_${i}`)
        const isAllSelected = allKeys.every(k => bulkSelected.has(k))
        const isStaffSelected = staffKeys.every(k => bulkSelected.has(k))
        const isParticipantSelected = participantKeys.every(k => bulkSelected.has(k))

        const toggleKey = (key: string) => {
          const next = new Set(bulkSelected)
          next.has(key) ? next.delete(key) : next.add(key)
          setBulkSelected(next)
        }
        const toggleGroup = (keys: string[], allOn: boolean) => {
          const next = new Set(bulkSelected)
          keys.forEach(k => allOn ? next.delete(k) : next.add(k))
          setBulkSelected(next)
        }

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowBulkInvite(false)}>
            <div className="bg-white rounded-t-[20px] w-full max-w-2xl pb-8" onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F6F9]">
                <div className="text-[16px] font-semibold">일괄 초대</div>
                <button onClick={() => setShowBulkInvite(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
              </div>

              <div className="px-5 pt-4 pb-3">
                {/* 전체 선택 */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-[#1A1A2E]">받는 사람 선택</span>
                  <button onClick={() => toggleGroup(allKeys, isAllSelected)}
                    className={`text-[12px] font-semibold px-3 py-1 rounded-full transition-colors ${isAllSelected ? 'bg-[#185FA5] text-white' : 'bg-[#F4F6F9] text-[#64748B]'}`}>
                    전체 {isAllSelected ? '해제' : '선택'}
                  </button>
                </div>

                {/* 행사진행 그룹 */}
                {staffParts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <i className="ti ti-users text-[#185FA5] text-[11px]" />
                        <span className="text-[11px] font-bold text-[#185FA5]">행사진행</span>
                      </div>
                      <button onClick={() => toggleGroup(staffKeys, isStaffSelected)}
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors ${isStaffSelected ? 'bg-[#185FA5] text-white' : 'bg-[#E6F1FB] text-[#185FA5]'}`}>
                        {isStaffSelected ? '해제' : '전체선택'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {staffParts.map((part, i) => {
                        const key = `staff_${i}`
                        const checked = bulkSelected.has(key)
                        return (
                          <button key={key} onClick={() => toggleKey(key)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border transition-colors text-left ${checked ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white'}`}>
                            <div className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-[#185FA5] border-[#185FA5]' : 'border-[#D1D5DB]'}`}>
                              {checked && <i className="ti ti-check text-white text-[11px]" />}
                            </div>
                            <span className="text-[13px] font-medium flex-1">{part.name || `운영팀 ${i+1}`}</span>
                            <span className="text-[11px] text-[#A0AEC0]">{part.manager?.name || '담당자 없음'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 참가자 그룹 */}
                {participantParts.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <i className="ti ti-run text-[#854F0B] text-[11px]" />
                        <span className="text-[11px] font-bold text-[#854F0B]">참가자</span>
                      </div>
                      <button onClick={() => toggleGroup(participantKeys, isParticipantSelected)}
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors ${isParticipantSelected ? 'bg-[#854F0B] text-white' : 'bg-[#FEF3C7] text-[#854F0B]'}`}>
                        {isParticipantSelected ? '해제' : '전체선택'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {participantParts.map((part, i) => {
                        const key = `participant_${i}`
                        const checked = bulkSelected.has(key)
                        return (
                          <button key={key} onClick={() => toggleKey(key)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border transition-colors text-left ${checked ? 'border-[#854F0B] bg-[#FFF8F0]' : 'border-[#E2E8F0] bg-white'}`}>
                            <div className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-[#854F0B] border-[#854F0B]' : 'border-[#D1D5DB]'}`}>
                              {checked && <i className="ti ti-check text-white text-[11px]" />}
                            </div>
                            <span className="text-[13px] font-medium flex-1">{part.name || `그룹 ${i+1}`}</span>
                            <span className="text-[11px] text-[#A0AEC0]">{part.manager?.name || '담당자 없음'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 선택 인원 표시 */}
                <div className="text-[12px] text-[#64748B] mb-3">{bulkSelected.size}명 선택됨</div>

                {/* 발송 방법 버튼들 */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={bulkSendSMS}
                    className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[12px] hover:border-[#3B6D11] hover:bg-[#F0FDF4] transition-colors">
                    <i className="ti ti-message text-[#3B6D11] text-[20px]" />
                    <span className="text-[11px] text-[#64748B]">문자</span>
                  </button>
                  <button onClick={bulkSendKakao}
                    className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[12px] hover:border-[#854F0B] hover:bg-[#FFFBF0] transition-colors">
                    <i className="ti ti-message-2 text-[#854F0B] text-[20px]" />
                    <span className="text-[11px] text-[#64748B]">카카오톡</span>
                  </button>
                  <button onClick={bulkSendEmail}
                    className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[12px] hover:border-[#185FA5] hover:bg-[#E6F1FB] transition-colors">
                    <i className="ti ti-mail text-[#185FA5] text-[20px]" />
                    <span className="text-[11px] text-[#64748B]">이메일</span>
                  </button>
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
                  rows={7}
                  className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-[#185FA5] resize-none leading-relaxed" />
              </div>
              <div className="text-[11px] text-[#A0AEC0] mb-4">
                {bulkPreview.type === 'sms' && `전화번호 입력된 ${getSelectedParts().filter(p => p.manager?.phone).length}명에게 발송`}
                {bulkPreview.type === 'kakao' && '카카오톡 공유 창이 열려요'}
                {bulkPreview.type === 'email' && `이메일 입력된 ${getSelectedParts().filter(p => p.manager?.email).length}명에게 발송`}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setBulkPreview(null)}
                  className="flex-1 h-[44px] border border-[#E2E8F0] rounded-[12px] text-[13px] text-[#64748B]">취소</button>
                <button onClick={doSend}
                  className="flex-1 h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2">
                  <i className="ti ti-send text-[14px]" /> 이대로 보내기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR 코드 모달 */}
      {showQR && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-[320px] flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <div className="text-[16px] font-semibold">QR 코드</div>
              <button onClick={() => setShowQR(false)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
            </div>
            <p className="text-[12px] text-[#64748B] text-center">QR 코드를 스캔하면 바로 참여할 수 있어요</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinLink)}`}
              alt="QR 코드"
              className="w-[200px] h-[200px] rounded-[12px]"
            />
            <div className="text-[24px] font-bold tracking-[6px] text-[#185FA5]">{joinCode}</div>
            <button
              onClick={() => {
                const a = document.createElement('a')
                a.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinLink)}`
                a.download = `ThanQ_${joinCode}_QR.png`
                a.click()
              }}
              className="w-full h-[42px] bg-[#185FA5] text-white rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2">
              <i className="ti ti-download text-[14px]" /> QR 이미지 저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
