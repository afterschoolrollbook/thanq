import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Part, CueItem, CheckItem } from '@/types'

// ─── 큐시트 추가 모달 ──────────────────────────────────────
interface AddCueModalProps {
  onClose: () => void
  onSave: (item: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  partId: string
  projectId: string
  order: number
}
function AddCueModal({ onClose, onSave, partId, projectId, order }: AddCueModalProps) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [memo, setMemo] = useState('')
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

// ─── 체크리스트 추가 모달 ─────────────────────────────────
interface AddCheckModalProps {
  onClose: () => void
  onSave: (item: Omit<CheckItem, 'id' | 'createdAt'>) => Promise<void>
  partId: string
  projectId: string
}
function AddCheckModal({ onClose, onSave, partId, projectId }: AddCheckModalProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CheckItem['category']>('prep')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const categories: { value: CheckItem['category']; label: string }[] = [
    { value: 'prep',    label: '준비' },
    { value: 'contact', label: '연락' },
    { value: 'setup',   label: '설치' },
    { value: 'custom',  label: '기타' },
  ]

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      partId, projectId, category,
      title: title.trim(),
      isDone: false,
      dueDate: dueDate || undefined,
      assignee: undefined,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-t-[20px] p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[16px] font-semibold">체크리스트 추가</div>
          <button onClick={onClose}><i className="ti ti-x text-[18px] text-[#A0AEC0]" /></button>
        </div>
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className={lbl}>항목명 <span className="text-[#A32D2D]">*</span></label>
            <input className={inp} placeholder="예: 음향 장비 점검" value={title}
              onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={lbl}>카테고리</label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((c) => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                    category === c.value
                      ? 'bg-[#185FA5] text-white border-[#185FA5]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#185FA5]'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>기한 (선택)</label>
            <input className={inp} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
  const [myPart, setMyPart] = useState<Part | null>(null)
  const [cues, setCues] = useState<CueItem[]>([])
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [tab, setTab] = useState<'cue' | 'check' | 'issue'>('cue')
  const [loading, setLoading] = useState(true)
  const [showAddCue, setShowAddCue] = useState(false)
  const [showAddCheck, setShowAddCheck] = useState(false)

  useEffect(() => {
    if (!projectId || !user) return
    const u = onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) {
        const list: Part[] = Object.values(s.val())
        const mine = list.find((p) => p.managerId === user.uid) ?? list[0]
        setMyPart(mine ?? null)
        setLoading(false)
        if (mine) {
          onValue(ref(db, `cueItems/${projectId}/${mine.id}`), (cs) => {
            if (cs.exists()) {
              const l: CueItem[] = Object.values(cs.val())
              l.sort((a, b) => a.order - b.order)
              setCues(l)
            } else setCues([])
          })
          onValue(ref(db, `checkItems/${projectId}/${mine.id}`), (ck) => {
            if (ck.exists()) setChecks(Object.values(ck.val()))
            else setChecks([])
          })
        }
      } else setLoading(false)
    })
    return () => u()
  }, [projectId, user])

  async function toggleCheck(item: CheckItem) {
    if (!projectId || !myPart) return
    await update(ref(db, `checkItems/${projectId}/${myPart.id}/${item.id}`), { isDone: !item.isDone })
  }

  async function setCueStatus(item: CueItem, status: CueItem['status']) {
    if (!projectId || !myPart) return
    await update(ref(db, `cueItems/${projectId}/${myPart.id}/${item.id}`), {
      status,
      updatedAt: new Date().toISOString(),
    })
  }

  async function addCue(data: Omit<CueItem, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!projectId || !myPart) return
    const newRef = push(ref(db, `cueItems/${projectId}/${myPart.id}`))
    const now = new Date().toISOString()
    await set(newRef, { ...data, id: newRef.key!, createdAt: now, updatedAt: now })
    setShowAddCue(false)
  }

  async function addCheck(data: Omit<CheckItem, 'id' | 'createdAt'>) {
    if (!projectId || !myPart) return
    const newRef = push(ref(db, `checkItems/${projectId}/${myPart.id}`))
    await set(newRef, { ...data, id: newRef.key!, createdAt: new Date().toISOString() })
    setShowAddCheck(false)
  }

  async function deleteCue(cue: CueItem) {
    if (!projectId || !myPart) return
    await set(ref(db, `cueItems/${projectId}/${myPart.id}/${cue.id}`), null)
  }

  async function deleteCheck(item: CheckItem) {
    if (!projectId || !myPart) return
    await set(ref(db, `checkItems/${projectId}/${myPart.id}/${item.id}`), null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-24">
        {!myPart ? (
          <div className="text-center py-20 text-[#64748B] text-[13px]">배정된 파트가 없어요</div>
        ) : (
          <>
            {/* 파트 헤더 */}
            <div className="flex items-flex-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: myPart.color }} />
                  <span className="text-[18px] font-semibold text-[#1A1A2E]">{myPart.name}</span>
                </div>
                <div className="text-[12px] text-[#64748B] mt-0.5">내 파트</div>
              </div>
              <div className="flex gap-2">
                <button className="h-8 px-3 border border-[#F09595] bg-[#FCEBEB] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1.5">
                  <i className="ti ti-alert-triangle text-[14px]" /> 긴급 연락
                </button>
                <button className="h-8 px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center gap-1.5">
                  <i className="ti ti-message-circle text-[14px]" /> 본부 메시지
                </button>
              </div>
            </div>

            {/* 진행률 */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-[12px] text-[#64748B]">파트 진행률</span>
              <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden">
                <div className="h-1.5 bg-[#185FA5] rounded-full" style={{ width: `${myPart.progress}%` }} />
              </div>
              <span className="text-[12px] text-[#64748B] whitespace-nowrap">{myPart.progress}%</span>
            </div>

            {/* 탭 + 추가 버튼 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1.5">
                {(['cue', 'check', 'issue'] as const).map((t) => {
                  const labels = { cue: '큐시트', check: '체크리스트', issue: '이슈' }
                  return (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                        tab === t ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'
                      }`}>
                      {labels[t]}
                      {t === 'cue'   && cues.length   > 0 && <span className="ml-1 opacity-70">({cues.length})</span>}
                      {t === 'check' && checks.length > 0 && <span className="ml-1 opacity-70">({checks.filter(c => !c.isDone).length}/{checks.length})</span>}
                    </button>
                  )
                })}
              </div>
              {tab === 'cue' && (
                <button onClick={() => setShowAddCue(true)}
                  className="h-8 px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5">
                  <i className="ti ti-plus text-[13px]" /> 추가
                </button>
              )}
              {tab === 'check' && (
                <button onClick={() => setShowAddCheck(true)}
                  className="h-8 px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5">
                  <i className="ti ti-plus text-[13px]" /> 추가
                </button>
              )}
            </div>

            {/* 큐시트 */}
            {tab === 'cue' && (
              cues.length === 0
                ? <Empty icon="ti-list" text="큐시트 항목이 없어요" onAdd={() => setShowAddCue(true)} addLabel="큐시트 추가" />
                : <div className="flex flex-col gap-2">
                    {cues.map((cue) => (
                      <div key={cue.id} className={`p-3 rounded-[10px] border ${cue.status === 'ongoing' ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[12px] font-bold text-[#185FA5]">{cue.startTime}</span>
                              {cue.durationMin > 0 && <span className="text-[11px] text-[#A0AEC0]">{cue.durationMin}분</span>}
                            </div>
                            <div className="text-[13px] font-semibold text-[#1A1A2E]">{cue.title}</div>
                            {cue.memo && <div className="text-[11px] text-[#64748B] mt-0.5">{cue.memo}</div>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <StatusBadge status={cue.status} />
                            {cue.status === 'pending'  && <button onClick={() => setCueStatus(cue, 'ongoing')} className="text-[11px] text-[#185FA5] font-semibold">시작</button>}
                            {cue.status === 'ongoing'  && <button onClick={() => setCueStatus(cue, 'done')}    className="text-[11px] text-[#3B6D11] font-semibold">완료</button>}
                            <button onClick={() => deleteCue(cue)} className="text-[11px] text-[#A0AEC0] hover:text-[#A32D2D]">삭제</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {/* 체크리스트 */}
            {tab === 'check' && (
              checks.length === 0
                ? <Empty icon="ti-checklist" text="체크리스트가 없어요" onAdd={() => setShowAddCheck(true)} addLabel="항목 추가" />
                : <div className="flex flex-col gap-2">
                    {checks.map((item) => (
                      <div key={item.id} className={`flex items-center gap-3 p-3 rounded-[10px] border border-[#E2E8F0] bg-white ${item.isDone ? 'opacity-60' : ''}`}>
                        <button onClick={() => toggleCheck(item)}
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${item.isDone ? 'bg-[#3B6D11] border-[#3B6D11]' : 'border-[#E2E8F0] hover:border-[#185FA5]'}`}>
                          {item.isDone && <i className="ti ti-check text-white text-[11px]" />}
                        </button>
                        <span className={`text-[13px] flex-1 ${item.isDone ? 'line-through text-[#A0AEC0]' : 'text-[#1A1A2E]'}`}>{item.title}</span>
                        {item.dueDate && <span className="text-[11px] text-[#A0AEC0]">{item.dueDate}</span>}
                        <button onClick={() => deleteCheck(item)} className="text-[#A0AEC0] hover:text-[#A32D2D] p-1">
                          <i className="ti ti-x text-[13px]" />
                        </button>
                      </div>
                    ))}
                    {/* 완료 현황 요약 */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-1 bg-[#F4F6F9] rounded-full overflow-hidden">
                        <div className="h-1 bg-[#3B6D11] rounded-full transition-all"
                          style={{ width: `${checks.length ? (checks.filter(c => c.isDone).length / checks.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[11px] text-[#64748B] whitespace-nowrap">
                        {checks.filter(c => c.isDone).length}/{checks.length} 완료
                      </span>
                    </div>
                  </div>
            )}

            {/* 이슈 */}
            {tab === 'issue' && <Empty icon="ti-alert-circle" text="등록된 이슈가 없어요" />}
          </>
        )}
      </div>
      <BottomTabBar />

      {showAddCue && myPart && (
        <AddCueModal
          onClose={() => setShowAddCue(false)}
          onSave={addCue}
          partId={myPart.id}
          projectId={projectId!}
          order={cues.length}
        />
      )}
      {showAddCheck && myPart && (
        <AddCheckModal
          onClose={() => setShowAddCheck(false)}
          onSave={addCheck}
          partId={myPart.id}
          projectId={projectId!}
        />
      )}
    </div>
  )
}

function Empty({ icon, text, onAdd, addLabel }: { icon: string; text: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="text-center py-12 text-[#A0AEC0]">
      <i className={`ti ${icon} text-[36px] block mb-2 opacity-30`} />
      <p className="text-[13px] mb-4">{text}</p>
      {onAdd && addLabel && (
        <button onClick={onAdd}
          className="h-[34px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 mx-auto">
          <i className="ti ti-plus text-[13px]" /> {addLabel}
        </button>
      )}
    </div>
  )
}

const inp = "w-full h-[40px] border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] text-[#1A1A2E] bg-white focus:outline-none focus:border-[#185FA5]"
const lbl = "text-[12px] font-medium text-[#64748B] mb-1.5 block"
