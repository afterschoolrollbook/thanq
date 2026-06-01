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
const [emailSending, setEmailSending] = useState(false)

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

  const joinCode = projectId?.slice(-6).toUpperCase() ?? 'AB3X7F'
  const [projectName, setProjectName] = useState('')
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
  async function shareEmail() {
    if (!manager.email) { alert('이메일 주소를 먼저 입력해주세요'); return }
    const part = inviteTarget?.group === 'staff' ? staffParts[inviteTarget.idx] : participantParts[inviteTarget!.idx]
    setEmailSending(true)
    try {
      // Firebase에서 이메일 설정 불러오기
      const { get, ref: dbRef } = await import('firebase/database')
      const snap = await get(dbRef(db, 'siteSettings/email'))
      if (!snap.exists() || !snap.val().enabled) {
        alert('이메일 설정이 되어있지 않아요. 관리자 페이지에서 설정해주세요.'); return
      }
      const { apiKey, from } = snap.val()

      const html = `
        <div style="max-width:480px;margin:40px auto;font-family:sans-serif;">
          <div style="background:#185FA5;padding:28px 32px;border-radius:16px 16px 0 0;">
            <div style="color:#fff;font-size:22px;font-weight:700;">ThanQ</div>
            <div style="color:#A8C8F0;font-size:13px;">현장 운영 플랫폼</div>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 8px;color:#64748B;font-size:13px;">안녕하세요, <strong>${manager.name || '담당자'}님</strong></p>
            <h2 style="margin:0 0 24px;color:#1A1A2E;font-size:20px;font-weight:700;">${projectName || 'ThanQ 프로젝트'}에 초대받으셨어요! 🎉</h2>
            ${part?.name ? `<div style="background:#F4F6F9;border-radius:12px;padding:16px;margin-bottom:24px;"><div style="font-size:11px;color:#64748B;margin-bottom:4px;">배정된 파트</div><div style="font-size:15px;font-weight:600;">${part.name}</div></div>` : ''}
            <div style="background:#EAF3DE;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
              <div style="font-size:11px;color:#3B6D11;font-weight:600;margin-bottom:8px;">참여 코드</div>
              <div style="font-size:28px;font-weight:800;color:#3B6D11;letter-spacing:6px;">${joinCode}</div>
            </div>
            <a href="${joinLink}" style="display:block;background:#185FA5;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-size:15px;font-weight:600;margin-bottom:16px;">🚀 지금 바로 참여하기</a>
            <p style="color:#A0AEC0;font-size:11px;">${joinLink}</p>
          </div>
        </div>`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from,
          to: manager.email,
          subject: `[ThanQ] ${projectName || 'ThanQ 프로젝트'} 참여 초대`,
          html,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || '발송 실패') }
      alert(`✅ ${manager.name || manager.email}님께 초대 이메일을 보냈어요!`)
    } catch (e: any) {
      alert(`❌ 이메일 발송 실패: ${e.message}`)
    } finally {
      setEmailSending(false)
    }
  }
  async function copyLink() { await navigator.clipboard.writeText(joinLink); alert('링크가 복사됐어요!') }

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
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copyLink} className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B] hover:border-[#185FA5]">
              <i className="ti ti-copy text-[14px]" /> 링크 복사
            </button>
            <button className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B] hover:border-[#185FA5]">
              <i className="ti ti-qrcode text-[14px]" /> QR 코드
            </button>
          </div>
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
                { fn: copyLink,   icon: 'ti-link',       color: '#64748B', label: '링크 복사' },
              ].map((s) => (
                <button key={s.label} onClick={s.fn}
                  className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5]">
                  <i className={`ti ${s.icon} text-[20px]`} style={{ color: s.color }} />
                  <span className="text-[11px] text-[#64748B]">{s.label}</span>
                </button>
              ))}
              <button onClick={shareEmail} disabled={emailSending}
                className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5] disabled:opacity-50">
                <i className={`ti ${emailSending ? 'ti-loader-2 animate-spin' : 'ti-mail'} text-[20px] text-[#185FA5]`} />
                <span className="text-[11px] text-[#64748B]">{emailSending ? '발송 중' : '이메일'}</span>
              </button>
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
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
