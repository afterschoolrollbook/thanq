import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes } from '@/utils/joinCode'
import { Topbar, TabBar, StatusBadge } from '@/components/ui/Common'
import type { Part, CueItem } from '@/types'

interface CueWithPart extends CueItem { partName: string; partColor: string }

export default function TimelinePage() {
  const { projectId } = useParams()
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `parts/${projectId}`), (s) => {
      if (!s.exists()) return
      const list: Part[] = Object.values(s.val()); list.sort((a, b) => a.order - b.order); setParts(list)
      const allMap: CueWithPart[] = []
      let loaded = 0
      list.forEach((part) => {
        onValue(ref(db, `cueItems/${projectId}/${part.id}`), (cs) => {
          loaded++
          if (cs.exists()) { const items: CueItem[] = Object.values(cs.val()); items.forEach((i) => allMap.push({ ...i, partName: part.name, partColor: part.color })) }
          if (loaded === list.length) { allMap.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)); setAllCues([...allMap]) }
        })
      })
    })
  }, [projectId])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const currentCue = allCues.find((c) => { const s = timeToMinutes(c.startTime); return nowMin >= s && nowMin < s + (c.durationMin || 30) })
  const filtered = selectedPart ? allCues.filter((c) => c.partName === selectedPart) : allCues

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <TabBar active="timeline" />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-10">

        {/* 현재 시각 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] px-4 py-3.5 flex items-center justify-between mb-4">
          <div><div className="text-[11px] text-[#64748B] mb-0.5">현재 시각</div><div className="text-[26px] font-bold text-[#185FA5] tracking-wide">{nowStr}</div></div>
          {currentCue ? (
            <div className="text-right"><div className="text-[11px] text-[#64748B] mb-0.5">지금 진행 중</div><div className="text-[13px] font-semibold text-[#1A1A2E]">{currentCue.title}</div><div className="text-[12px] mt-0.5" style={{ color: currentCue.partColor }}>{currentCue.partName}</div></div>
          ) : <div className="text-[12px] text-[#A0AEC0]">진행 중인 큐 없음</div>}
        </div>

        {/* 파트 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button onClick={() => setSelectedPart(null)} className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold ${!selectedPart ? 'bg-[#185FA5] text-white' : 'border border-[#E2E8F0] text-[#64748B]'}`}>전체</button>
          {parts.map((p) => (
            <button key={p.id} onClick={() => setSelectedPart(p.name === selectedPart ? null : p.name)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${selectedPart === p.name ? 'border-[#185FA5] text-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
              {p.name}
            </button>
          ))}
        </div>

        {/* 타임라인 */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#A0AEC0]"><i className="ti ti-timeline text-[40px] block mb-3 opacity-30" /><p className="text-[13px]">큐시트 항목이 없어요</p></div>
        ) : (
          <div className="relative">
            <div className="absolute left-[52px] top-0 bottom-0 w-px bg-[#E2E8F0]" />
            <div className="flex flex-col gap-1">
              {filtered.map((cue, i) => {
                const start = timeToMinutes(cue.startTime)
                const isPast = nowMin > start + (cue.durationMin || 30)
                const isCurrent = nowMin >= start && nowMin < start + (cue.durationMin || 30)
                return (
                  <div key={`${cue.id}-${i}`} className={`flex items-start gap-3 ${isPast ? 'opacity-50' : ''}`}>
                    <div className="w-12 text-right pt-3 flex-shrink-0">
                      <span className={`text-[12px] font-bold ${isCurrent ? 'text-[#185FA5]' : 'text-[#A0AEC0]'}`}>{cue.startTime}</span>
                    </div>
                    <div className="pt-3.5 flex-shrink-0 z-10">
                      <div className={`w-3 h-3 rounded-full border-2 ${isCurrent ? 'bg-[#185FA5] border-[#185FA5]' : 'bg-white'}`} style={isCurrent ? {} : { borderColor: cue.partColor }} />
                    </div>
                    <div className={`flex-1 mb-2 rounded-[10px] p-3 border ${isCurrent ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={`text-[13px] font-semibold ${isCurrent ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{cue.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[12px] font-medium" style={{ color: cue.partColor }}>{cue.partName}</span>
                            {cue.durationMin > 0 && <span className="text-[11px] text-[#A0AEC0]">{cue.durationMin}분</span>}
                          </div>
                        </div>
                        <StatusBadge status={cue.status} />
                      </div>
                      {isCurrent && <div className="mt-2 pt-2 border-t border-[#B5D4F4] text-[12px] text-[#185FA5] font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] inline-block animate-pulse" /> 지금 진행 중</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
