import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, StatusBadge } from '@/components/ui/Common'
import type { Part, CueItem, CheckItem } from '@/types'

export default function MyPartPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [myPart, setMyPart] = useState<Part | null>(null)
  const [cues, setCues] = useState<CueItem[]>([])
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [tab, setTab] = useState<'cue' | 'check' | 'issue'>('cue')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId || !user) return
    const u = onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) {
        const list: Part[] = Object.values(s.val())
        const mine = list.find((p) => p.managerId === user.uid) ?? list[0]
        setMyPart(mine ?? null); setLoading(false)
        if (mine) {
          onValue(ref(db, `cueItems/${projectId}/${mine.id}`), (cs) => {
            if (cs.exists()) { const l: CueItem[] = Object.values(cs.val()); l.sort((a, b) => a.order - b.order); setCues(l) } else setCues([])
          })
          onValue(ref(db, `checkItems/${projectId}/${mine.id}`), (ck) => {
            if (ck.exists()) setChecks(Object.values(ck.val())); else setChecks([])
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
    await update(ref(db, `cueItems/${projectId}/${myPart.id}/${item.id}`), { status, updatedAt: new Date().toISOString() })
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-10">
        {!myPart ? (
          <div className="text-center py-20 text-[#64748B] text-[13px]">배정된 파트가 없어요</div>
        ) : (
          <>
            {/* 파트 헤더 */}
            <div className="flex items-flex-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: myPart.color }} /><span className="text-[18px] font-semibold text-[#1A1A2E]">{myPart.name}</span></div>
                <div className="text-[12px] text-[#64748B] mt-0.5">내 파트</div>
              </div>
              <div className="flex gap-2">
                <button className="h-8 px-3 border border-[#F09595] bg-[#FCEBEB] rounded-[10px] text-[12px] text-[#A32D2D] flex items-center gap-1.5"><i className="ti ti-alert-triangle text-[14px]" /> 긴급 연락</button>
                <button className="h-8 px-3 border border-[#E2E8F0] rounded-[10px] text-[12px] text-[#64748B] flex items-center gap-1.5"><i className="ti ti-message-circle text-[14px]" /> 본부 메시지</button>
              </div>
            </div>

            {/* 진행률 */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-[12px] text-[#64748B]">파트 진행률</span>
              <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden"><div className="h-1.5 bg-[#185FA5] rounded-full" style={{ width: `${myPart.progress}%` }} /></div>
              <span className="text-[12px] text-[#64748B] whitespace-nowrap">{myPart.progress}%</span>
            </div>

            {/* 탭 */}
            <div className="flex gap-1.5 mb-4">
              {(['cue', 'check', 'issue'] as const).map((t) => {
                const labels = { cue: '큐시트', check: '체크리스트', issue: '이슈' }
                return (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${tab === t ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                    {labels[t]}
                  </button>
                )
              })}
            </div>

            {/* 큐시트 */}
            {tab === 'cue' && (
              cues.length === 0 ? <Empty icon="ti-list" text="큐시트 항목이 없어요" /> :
              <div className="flex flex-col gap-2">
                {cues.map((cue) => (
                  <div key={cue.id} className={`p-3 rounded-[10px] border ${cue.status === 'ongoing' ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1"><span className="text-[12px] font-bold text-[#185FA5]">{cue.startTime}</span>{cue.durationMin > 0 && <span className="text-[11px] text-[#A0AEC0]">{cue.durationMin}분</span>}</div>
                        <div className="text-[13px] font-semibold text-[#1A1A2E]">{cue.title}</div>
                        {cue.memo && <div className="text-[11px] text-[#64748B] mt-0.5">{cue.memo}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={cue.status} />
                        {cue.status === 'pending' && <button onClick={() => setCueStatus(cue, 'ongoing')} className="text-[11px] text-[#185FA5] font-semibold">시작</button>}
                        {cue.status === 'ongoing' && <button onClick={() => setCueStatus(cue, 'done')} className="text-[11px] text-[#3B6D11] font-semibold">완료</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 체크리스트 */}
            {tab === 'check' && (
              checks.length === 0 ? <Empty icon="ti-checklist" text="체크리스트가 없어요" /> :
              <div className="flex flex-col gap-2">
                {checks.map((item) => (
                  <button key={item.id} onClick={() => toggleCheck(item)}
                    className={`flex items-center gap-3 p-3 rounded-[10px] border border-[#E2E8F0] bg-white text-left transition-opacity ${item.isDone ? 'opacity-60' : ''}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${item.isDone ? 'bg-[#3B6D11] border-[#3B6D11]' : 'border-[#E2E8F0]'}`}>
                      {item.isDone && <i className="ti ti-check text-white text-[11px]" />}
                    </div>
                    <span className={`text-[13px] ${item.isDone ? 'line-through text-[#A0AEC0]' : 'text-[#1A1A2E]'}`}>{item.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 이슈 */}
            {tab === 'issue' && <Empty icon="ti-alert-circle" text="등록된 이슈가 없어요" />}
          </>
        )}
      </div>
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-12 text-[#A0AEC0]">
      <i className={`ti ${icon} text-[36px] block mb-2 opacity-30`} />
      <p className="text-[13px]">{text}</p>
    </div>
  )
}
