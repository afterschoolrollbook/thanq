import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import { CueModal, type CueWithPart } from '@/components/cue/CueModal'
import type { Part, CueItem, CheckItem } from '@/types'

// ─── 큐시트 추가 모달 ──────────────────────────────────────
function AddCueModal({ onClose, onSave, partId, projectId, order }: {
  onClose: () => void
  onSave: (item: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  partId: string; projectId: string; order: number
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      partId, projectId, order,
      title: title.trim(),
      startTime: startTime || '--:--',
      durationMin: Number(durationMin) || 0,
      memo: memo.trim() || undefined,
      ...(date ? { date } : {}),
      status: 'pending',
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-t-[20px] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[16px] font-semibold">큐시트 항목 추가</div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className={lbl}>항목명 <span className="text-[#A32D2D]">*</span></label>
            <input className={inp} placeholder="예: 오프닝 영상 재생" value={title}
              onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={lbl}>날짜 <span className="text-[#A0AEC0] font-normal">(준비일 등, 비워두면 행사 당일)</span></label>
            <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>시작 시간</label>
              <input className={inp} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>소요 시간 (분)</label>
              <input className={inp} type="number" min="0" placeholder="0" value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={lbl}>메모 (선택)</label>
            <input className={inp} placeholder="참고사항을 입력하세요" value={memo}
              onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-[42px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="flex-1 h-[42px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-40">
            {saving ? '저장 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────
export default function MyPartPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<{ownerId?: string} | null>(null)
  const [myMember, setMyMember] = useState<{role: string; partId?: string} | null>(null)
  const [allParts, setAllParts] = useState<Part[]>([])
  const [myPart, setMyPart] = useState<Part | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [cues, setCues] = useState<CueItem[]>([])
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCue, setShowAddCue] = useState(false)
  const [activeCue, setActiveCue] = useState<CueWithPart | null>(null)
  const [readOnlyToast, setReadOnlyToast] = useState(false)

  const selectedPart = allParts.find(p => p.id === selectedPartId) ?? null
  const isPlannerRole = myMember?.role === 'planner' || myMember?.role === 'owner' || project?.ownerId === user?.uid
  const isParticipant = myMember?.role === 'participant'
  const hasPartAssigned = !!(myMember?.partId)  // 특정 파트에 배정됐는지
  // 기획자이면서 파트 미배정 → 모든 팀 수정 가능
  // 기획자이면서 파트 배정됨 → 그 파트만 수정 (스태프처럼)
  // 스태프 → 내 파트만
  // 참가자 → 읽기만
  const isPlanner = isPlannerRole && !hasPartAssigned
  const isMyPart = isPlanner || (!isParticipant && selectedPart?.id === myPart?.id)

  useEffect(() => {
    if (!projectId || !user) return
    onValue(ref(db, `projects/${projectId}`), (s) => {
      if (s.exists()) setProject(s.val())
    }, { onlyOnce: true })
    onValue(ref(db, `projectMembers/${projectId}/${user.uid}`), (s) => {
      if (s.exists()) setMyMember(s.val())
    }, { onlyOnce: true })
    const u = onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) {
        const list: Part[] = Object.values(s.val())
        list.sort((a, b) => a.order - b.order)
        const mine = list.find((p) => p.id === myMember?.partId) ?? null
        setAllParts(list)
        setMyPart(mine ?? null)
        if (!selectedPartId) setSelectedPartId(mine?.id ?? list[0]?.id ?? null)  // 탭 초기 선택은 내 파트, 없으면 첫번째
        setLoading(false)
      } else setLoading(false)
    })
    return () => u()
  }, [projectId, user])

  useEffect(() => {
    if (!projectId || !selectedPartId) return
    const u1 = onValue(ref(db, `cueItems/${projectId}/${selectedPartId}`), (cs) => {
      if (cs.exists()) {
        const l: CueItem[] = Object.values(cs.val())
        l.sort((a, b) => {
          if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date)
          return a.startTime.localeCompare(b.startTime)
        })
        setCues(l)
      } else setCues([])
    })
    const u2 = onValue(ref(db, `checkItems/${projectId}/${selectedPartId}`), (ck) => {
      if (ck.exists()) setChecks(Object.values(ck.val()))
      else setChecks([])
    })
    return () => { u1(); u2() }
  }, [projectId, selectedPartId])

  function showReadOnly() {
    setReadOnlyToast(true)
    setTimeout(() => setReadOnlyToast(false), 2500)
  }

  async function setCueStatus(item: CueItem, status: CueItem['status']) {
    if (!projectId || !selectedPartId || !isMyPart) { showReadOnly(); return }
    await update(ref(db, `cueItems/${projectId}/${selectedPartId}/${item.id}`), {
      status, updatedAt: new Date().toISOString(),
    })
  }

  async function addCue(data: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!projectId || !selectedPartId || !isMyPart) return
    const newRef = push(ref(db, `cueItems/${projectId}/${selectedPartId}`))
    const now = new Date().toISOString()
    await set(newRef, { ...data, id: newRef.key!, createdAt: now, updatedAt: now })
    setShowAddCue(false)
  }

  function openCueModal(cue: CueItem) {
    if (!selectedPart) return
    setActiveCue({
      ...cue,
      partName: selectedPart.name,
      partColor: selectedPart.color,
      partId: selectedPart.id,
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />

      {/* 파트 탭 */}
      {allParts.length > 1 && (
        <div className="bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
          <div className="max-w-2xl mx-auto px-5 overflow-x-auto">
            <div className="flex gap-1 py-2 min-w-max">
              {allParts.map(part => (
                <button key={part.id} onClick={() => setSelectedPartId(part.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
                    selectedPartId === part.id
                      ? 'text-white'
                      : 'bg-[#F4F6F9] text-[#64748B] hover:bg-[#E2E8F0]'
                  }`}
                  style={selectedPartId === part.id ? { background: part.color } : {}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedPartId === part.id ? 'rgba(255,255,255,0.6)' : part.color }} />
                  {part.name}
                  {part.id === myPart?.id && <span className="text-[9px] opacity-70">내팀</span>}
                  {isPlanner && part.id !== myPart?.id && <span className="text-[9px] opacity-50">기획자</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-5 pt-5 pb-24">
        {!selectedPart ? (
          <div className="text-center py-20 text-[#64748B] text-[13px]">배정된 파트가 없어요</div>
        ) : (
          <>
            {/* 파트 헤더 */}
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: selectedPart.color }} />
                  <span className="text-[18px] font-semibold text-[#1A1A2E]">{selectedPart.name}</span>
                  {!isMyPart && (
                    <span className="text-[10px] bg-[#F4F6F9] text-[#A0AEC0] px-2 py-0.5 rounded-full">열람 전용</span>
                  )}
                </div>
                <div className="text-[12px] text-[#64748B] mt-0.5">
                  {isPlanner ? '기획자 · 전체 수정 가능' : isMyPart ? '내 파트' : isParticipant ? '참가자 · 열람만 가능' : isPlannerRole ? '다른 팀 현황 (열람)' : '다른 팀 현황'}
                </div>
              </div>
              {isMyPart && (
                <div className="flex gap-2">
                  <button className="h-8 px-3 border border-[#F09595] bg-[#FCEBEB] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1.5">
                    <i className="ti ti-alert-triangle text-[14px]" /> 긴급 연락
                  </button>
                  <button className="h-8 px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center gap-1.5">
                    <i className="ti ti-message-circle text-[14px]" /> 본부 메시지
                  </button>
                </div>
              )}
            </div>

            {/* 진행률 */}
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-[12px] text-[#64748B]">파트 진행률</span>
              <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden">
                <div className="h-1.5 bg-[#185FA5] rounded-full" style={{ width: `${selectedPart.progress}%` }} />
              </div>
              <span className="text-[12px] text-[#64748B] whitespace-nowrap">{selectedPart.progress}%</span>
            </div>

            {/* 큐시트 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold text-[#1A1A2E]">큐시트 ({cues.length})</span>
              {isMyPart && (
                <button onClick={() => setShowAddCue(true)}
                  className="h-8 px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5">
                  <i className="ti ti-plus text-[13px]" /> 추가
                </button>
              )}
            </div>

            {/* 큐시트 카드 목록 */}
            {cues.length === 0 ? (
              <div className="text-center py-12 text-[#A0AEC0]">
                <i className="ti ti-list text-[36px] block mb-2 opacity-30" />
                <p className="text-[13px] mb-4">큐시트 항목이 없어요</p>
                <button onClick={() => setShowAddCue(true)}
                  className="h-[34px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 mx-auto">
                  <i className="ti ti-plus text-[13px]" /> 큐시트 추가
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {cues.map((cue) => {
                  const cueChecks = checks.filter(c => c.cueId === cue.id)
                  const doneChecks = cueChecks.filter(c => c.isDone).length

                  return (
                    <div key={cue.id}
                      className={`rounded-[12px] border bg-white overflow-hidden ${cue.status === 'ongoing' ? 'border-[#185FA5]' : 'border-[#E2E8F0]'}`}>

                      {/* 카드 상단 - 클릭 시 모달 */}
                      <button className="w-full text-left p-4" onClick={() => openCueModal(cue)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {cue.date && (
                                <span className="text-[10px] bg-[#FFF8F0] text-[#E8820C] border border-[#F4D7A8] px-2 py-0.5 rounded-full font-semibold">
                                  {cue.date.replace(/-/g, '.')}
                                </span>
                              )}
                              <span className="text-[12px] font-bold text-[#185FA5]">{cue.startTime}</span>
                              {cue.durationMin > 0 && (
                                <span className="text-[11px] text-[#A0AEC0]">{cue.durationMin}분</span>
                              )}
                            </div>
                            <div className="text-[14px] font-semibold text-[#1A1A2E]">{cue.title}</div>
                            {cue.memo && <div className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{cue.memo}</div>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <StatusBadge status={cue.status} />
                            <i className="ti ti-chevron-right text-[#A0AEC0] text-[13px]" />
                          </div>
                        </div>

                        {/* 체크리스트 미리보기 */}
                        {cueChecks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#F4F6F9]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] text-[#64748B]">체크리스트</span>
                              <span className="text-[11px] font-semibold text-[#185FA5]">{doneChecks}/{cueChecks.length}</span>
                            </div>
                            <div className="w-full h-1 bg-[#F4F6F9] rounded-full overflow-hidden mb-2">
                              <div className="h-1 rounded-full transition-all"
                                style={{ width: `${(doneChecks / cueChecks.length) * 100}%`, background: doneChecks === cueChecks.length ? '#3B6D11' : '#185FA5' }} />
                            </div>
                            <div className="flex flex-col gap-1">
                              {cueChecks.slice(0, 3).map(c => (
                                <div key={c.id} className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 ${c.isDone ? 'bg-[#3B6D11] border-[#3B6D11]' : 'border-[#E2E8F0]'}`}>
                                    {c.isDone && <i className="ti ti-check text-white text-[8px]" />}
                                  </div>
                                  <span className={`text-[11px] truncate ${c.isDone ? 'line-through text-[#A0AEC0]' : 'text-[#64748B]'}`}>{c.title}</span>
                                </div>
                              ))}
                              {cueChecks.length > 3 && (
                                <span className="text-[10px] text-[#A0AEC0] ml-5">+{cueChecks.length - 3}개 더보기</span>
                              )}
                            </div>
                          </div>
                        )}
                      </button>

                      {/* 상태 버튼 */}
                      <div className="flex border-t border-[#F4F6F9]">
                        {cue.status === 'pending' && (
                          <button onClick={() => setCueStatus(cue, 'ongoing')}
                            className="flex-1 py-2 text-[12px] font-semibold text-[#185FA5] hover:bg-[#E6F1FB] transition-colors">
                            {isMyPart ? '시작' : '👀 보기'}
                          </button>
                        )}
                        {cue.status === 'ongoing' && (
                          <button onClick={() => setCueStatus(cue, 'done')}
                            className="flex-1 py-2 text-[12px] font-semibold text-[#3B6D11] hover:bg-[#EAF3DE] transition-colors">
                            {isMyPart ? '완료' : '진행 중'}
                          </button>
                        )}
                        {cue.status === 'done' && (
                          <button onClick={() => isMyPart ? setCueStatus(cue, 'pending') : showReadOnly()}
                            className="flex-1 py-2 text-[12px] text-[#A0AEC0] hover:bg-[#F4F6F9] transition-colors">
                            {isMyPart ? '되돌리기' : '완료됨'}
                          </button>
                        )}
                        <div className="w-px bg-[#F4F6F9]" />
                        <button onClick={() => openCueModal(cue)}
                          className="flex items-center gap-1 px-4 py-2 text-[12px] text-[#185FA5] font-semibold hover:bg-[#E6F1FB] transition-colors">
                          <i className="ti ti-antenna text-[13px]" /> 무전
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* 파트 레벨 체크리스트 (큐 미연결) */}
                {checks.filter((c: CheckItem) => !c.cueId).length > 0 && (
                  <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-bold text-[#1A1A2E]">파트 체크리스트</span>
                      <span className="text-[12px] text-[#185FA5] font-semibold">
                        {checks.filter((c: CheckItem) => !c.cueId && c.isDone).length}/{checks.filter((c: CheckItem) => !c.cueId).length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {checks.filter((c: CheckItem) => !c.cueId).map((item: CheckItem) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <button
                            onClick={() => { if(!isMyPart){showReadOnly();return} update(ref(db, `checkItems/${projectId}/${selectedPart!.id}/${item.id}`), { isDone: !item.isDone }) }}
                            className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${item.isDone ? 'bg-[#3B6D11] border-[#3B6D11]' : 'border-[#E2E8F0]'}`}>
                            {item.isDone && <i className="ti ti-check text-white text-[11px]" />}
                          </button>
                          <span className={`text-[13px] flex-1 ${item.isDone ? 'line-through text-[#A0AEC0]' : 'text-[#1A1A2E]'}`}>{item.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {readOnlyToast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6" onClick={() => setReadOnlyToast(false)}>
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm flex flex-col items-center text-center gap-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <i className="ti ti-lock text-[#DC2626] text-[32px]"/>
            </div>
            <div>
              <div className="text-[17px] font-bold text-[#1A1A2E] mb-1">수정 권한이 없어요</div>
              <div className="text-[13px] text-[#64748B]">해당 팀에 요청해주세요!</div>
            </div>
            <button onClick={() => setReadOnlyToast(false)}
              className="w-full h-[44px] bg-[#185FA5] text-white rounded-[12px] text-[14px] font-semibold">
              확인
            </button>
          </div>
        </div>
      )}
      <BottomTabBar />

      {showAddCue && selectedPartId && isMyPart && (
        <AddCueModal
          onClose={() => setShowAddCue(false)}
          onSave={addCue}
          partId={selectedPartId}
          projectId={projectId!}
          order={cues.length}
        />
      )}

      {activeCue && (
        <CueModal
          cue={activeCue}
          projectId={projectId!}
          onClose={() => setActiveCue(null)}
          isReadOnly={!isMyPart}
        />
      )}
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
