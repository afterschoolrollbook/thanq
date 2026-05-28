import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ref, push, set, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { PART_COLORS } from '@/utils/fieldTerms'
import { Topbar, StepBar } from '@/components/ui/Common'
import type { Part } from '@/types'

interface Manager { name: string; phone: string; email: string }

export default function SetupPartsPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [parts, setParts] = useState([{ name: '' }, { name: '' }])
  const [managers, setManagers] = useState<(Manager | null)[]>([null, null])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteIdx, setInviteIdx] = useState<number | null>(null)
  const [manager, setManager] = useState<Manager>({ name: '', phone: '', email: '' })
  const [initialized, setInitialized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const joinCode = projectId?.slice(-6).toUpperCase() ?? 'AB3X7F'
  const joinLink = `${window.location.origin}/join?code=${joinCode}`

  // Firebase에서 이전에 저장한 파트 불러오기
  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `draftParts/${projectId}`), (snap) => {
      if (snap.exists()) {
        const saved = snap.val() as Record<string, { name: string; manager?: Manager }>
        const arr = Object.values(saved)
        setParts(arr.map((p) => ({ name: p.name })))
        setManagers(arr.map((p) => p.manager ?? null))
      }
      setInitialized(true)
    }, { onlyOnce: true })
  }, [projectId])

  // 파트 변경시 Firebase에 저장
  async function saveDraft(newParts: { name: string }[], newManagers: (Manager | null)[]) {
    if (!projectId) return
    setSaveStatus('saving')
    try {
      const data: Record<string, { name: string; manager: Manager | null }> = {}
      newParts.forEach((p, i) => { data[String(i)] = { name: p.name, manager: newManagers[i] ?? null } })
      await set(ref(db, `draftParts/${projectId}`), data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (e) {
      console.error('draftParts 저장 오류:', e)
      setSaveStatus('idle')
    }
  }

  function updatePart(idx: number, name: string) {
    const newParts = parts.map((p, i) => i === idx ? { name } : p)
    setParts(newParts)
    saveDraft(newParts, managers)
  }

  function addPart() {
    const newParts = [...parts, { name: '' }]
    const newManagers = [...managers, null]
    setParts(newParts)
    setManagers(newManagers)
    saveDraft(newParts, newManagers)
  }

  function removePart(idx: number) {
    const newParts = parts.filter((_, i) => i !== idx)
    const newManagers = managers.filter((_, i) => i !== idx)
    setParts(newParts)
    setManagers(newManagers)
    saveDraft(newParts, newManagers)
  }

  function openInvite(idx: number) {
    setInviteIdx(idx)
    setManager(managers[idx] ?? { name: '', phone: '', email: '' })
  }

  function saveManager() {
    if (inviteIdx === null) return
    const newManagers = [...managers]
    newManagers[inviteIdx] = manager.name ? { ...manager } : null
    setManagers(newManagers)
    saveDraft(parts, newManagers)
    setInviteIdx(null)
  }

  function shareKakao() {
    const msg = `[ThanQ] ${manager.name || '담당자'}님을 초대합니다!\n참여 코드: ${joinCode}\n${joinLink}`
    if (navigator.share) navigator.share({ title: 'ThanQ 초대', text: msg, url: joinLink })
    else window.open(`https://story.kakao.com/share?url=${encodeURIComponent(joinLink)}`)
  }

  function shareSMS() {
    const msg = `[ThanQ] 현장 운영 앱에 초대합니다! 참여코드: ${joinCode} / ${joinLink}`
    const phone = manager.phone.replace(/-/g, '')
    window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`
  }

  function shareEmail() {
    const subject = '[ThanQ] 현장 운영 앱 초대'
    const body = `안녕하세요 ${manager.name || ''}님,\n\nThanQ 현장 운영 앱에 초대합니다.\n\n참여 코드: ${joinCode}\n접속 링크: ${joinLink}\n\n링크를 클릭하면 회원가입 후 바로 합류할 수 있어요.`
    window.location.href = `mailto:${manager.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function copyLink() {
    await navigator.clipboard.writeText(joinLink)
    alert('링크가 복사됐어요!')
  }

  async function handleSave() {
    const valid = parts.map((p, i) => ({ ...p, managerIdx: i })).filter((p) => p.name.trim())
    if (valid.length === 0) { setError('파트를 최소 1개 이상 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      // 파트를 순서대로 하나씩 set으로 저장 (push + update 대신 명시적 경로 사용)
      for (let idx = 0; idx < valid.length; idx++) {
        const p = valid[idx]
        const partRef = push(ref(db, `parts/${projectId}`))
        const partId = partRef.key!
        const part: Part = {
          id: partId,
          projectId: projectId!,
          name: p.name.trim(),
          color: PART_COLORS[idx % PART_COLORS.length],
          managerName: managers[p.managerIdx]?.name ?? undefined,
          status: 'waiting',
          progress: 0,
          order: idx,
          createdAt: new Date().toISOString(),
        }
        await set(ref(db, `parts/${projectId}/${partId}`), part)

        if (managers[p.managerIdx]?.name) {
          await set(ref(db, `partManagers/${projectId}/${partId}`), managers[p.managerIdx])
        }
      }
      // draft 삭제
      await set(ref(db, `draftParts/${projectId}`), null)
      navigate(`/p/${projectId}/home`)
    } catch (e) {
      console.error('파트 저장 오류:', e)
      const msg = e instanceof Error ? e.message : String(e)
      setError(`저장 중 오류가 발생했어요: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  if (!initialized) return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
      <div className="text-[13px] text-[#64748B]">불러오는 중...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={4} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[20px] font-semibold text-[#1A1A2E]">파트 구성 및 담당자 초대</h2>
          {saveStatus === 'saving' && <span className="text-[11px] text-[#A0AEC0]">저장 중...</span>}
          {saveStatus === 'saved'  && <span className="text-[11px] text-[#3B6D11]">저장됨 ✓</span>}
        </div>
        <p className="text-[13px] text-[#64748B] mb-6">입력하는 즉시 저장돼요 — 언제든 이어서 작업 가능해요</p>

        <div className="flex flex-col gap-2 mb-3">
          {parts.map((part, idx) => (
            <div key={idx} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[10px]">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PART_COLORS[idx % PART_COLORS.length] }} />
              <input className="flex-1 text-[13px] font-medium text-[#1A1A2E] outline-none bg-transparent placeholder-[#A0AEC0]"
                placeholder={`파트 ${idx + 1} 이름`} value={part.name} onChange={(e) => updatePart(idx, e.target.value)} />
              <button onClick={() => openInvite(idx)}
                className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-colors ${managers[idx]?.name ? 'border-[#185FA5] text-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] text-[#A0AEC0] hover:border-[#185FA5] hover:text-[#185FA5]'}`}>
                <i className="ti ti-user-plus text-[13px]" />
                {managers[idx]?.name ? managers[idx]!.name : '담당자 초대'}
              </button>
              {parts.length > 1 && <i className="ti ti-x text-[14px] text-[#A0AEC0] cursor-pointer hover:text-[#A32D2D]" onClick={() => removePart(idx)} />}
            </div>
          ))}
        </div>

        <button onClick={addPart} className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-[#E2E8F0] rounded-[10px] text-[13px] text-[#A0AEC0] w-full mb-5 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
          <i className="ti ti-plus text-[15px]" /> 파트 추가
        </button>

        <div className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[14px] p-4 mb-5">
          <div className="text-[12px] text-[#A0AEC0] text-center mb-1">참여 코드</div>
          <div className="text-[32px] font-bold tracking-[8px] text-[#185FA5] text-center my-2">{joinCode}</div>
          <div className="text-[12px] text-[#A0AEC0] text-center mb-3">이 코드를 공유하면 담당자가 바로 합류할 수 있어요</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copyLink} className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B] hover:border-[#185FA5]"><i className="ti ti-copy text-[14px]" /> 링크 복사</button>
            <button className="h-[36px] border border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] text-[#64748B] hover:border-[#185FA5]"><i className="ti ti-qrcode text-[14px]" /> QR 코드</button>
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

      {/* 담당자 초대 모달 */}
      {inviteIdx !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setInviteIdx(null)}>
          <div className="bg-white w-full max-w-2xl rounded-t-[20px] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold">담당자 초대</div>
              <button onClick={() => setInviteIdx(null)}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className={lbl}>이름</label>
                <input className={inp} placeholder="홍길동" value={manager.name} onChange={(e) => setManager({ ...manager, name: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>전화번호</label>
                <input className={inp} placeholder="010-1234-5678" type="tel" value={manager.phone} onChange={(e) => setManager({ ...manager, phone: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>이메일</label>
                <input className={inp} placeholder="example@email.com" type="email" value={manager.email} onChange={(e) => setManager({ ...manager, email: e.target.value })} />
              </div>
            </div>
            <div className="text-[12px] font-semibold text-[#64748B] mb-2">초대 방법</div>
            <div className="grid grid-cols-4 gap-2 mb-5">
              <button onClick={shareSMS} className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5] transition-colors">
                <i className="ti ti-message text-[20px] text-[#3B6D11]" />
                <span className="text-[11px] text-[#64748B]">문자</span>
              </button>
              <button onClick={shareKakao} className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5] transition-colors">
                <i className="ti ti-message-2 text-[20px]" style={{ color: '#3A1D1D' }} />
                <span className="text-[11px] text-[#64748B]">카카오톡</span>
              </button>
              <button onClick={shareEmail} className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5] transition-colors">
                <i className="ti ti-mail text-[20px] text-[#185FA5]" />
                <span className="text-[11px] text-[#64748B]">이메일</span>
              </button>
              <button onClick={copyLink} className="flex flex-col items-center gap-1.5 py-3 border border-[#E2E8F0] rounded-[10px] hover:border-[#185FA5] transition-colors">
                <i className="ti ti-link text-[20px] text-[#64748B]" />
                <span className="text-[11px] text-[#64748B]">링크 복사</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInviteIdx(null)} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={saveManager} className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
