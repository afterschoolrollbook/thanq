import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { timeToMinutes } from '@/utils/joinCode'
import { StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Project, Part, CueItem } from '@/types'

interface CueWithPart extends CueItem { partName: string; partColor: string }

export default function LiveOpsPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueWithPart[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), (s) => { if (s.exists()) setProject(s.val()) })
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
  const startMin = project ? timeToMinutes(project.startTime) : 0
  const endMin = project ? timeToMinutes(project.endTime || '23:59') : 0
  const elapsed = Math.max(0, nowMin - startMin)
  const remaining = Math.max(0, endMin - nowMin)
  const fmtDuration = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}h ${String(m % 60).padStart(2,'0')}m`
  const currentCue = allCues.find((c) => { const s = timeToMinutes(c.startTime); return nowMin >= s && nowMin < s + (c.durationMin || 30) })
  const nextCues = allCues.filter((c) => timeToMinutes(c.startTime) > nowMin).slice(0, 3)
  const progress = parts.length ? Math.round(parts.reduce((s, p) => s + p.progress, 0) / parts.length) : 0

  return (
    <>
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* D-DAY 탑바 */}
      <header className="bg-[#185FA5] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-[17px]">ThanQ</span>
          <div className="flex items-center gap-1.5 bg-[#E24B4A]/25 border border-[#E24B4A]/50 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse inline-block" />
            <span className="text-white text-[12px] font-semibold">LIVE · D-DAY</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center relative">
            <i className="ti ti-bell text-white text-[16px]" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#E24B4A] border border-[#185FA5]" />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[12px] font-semibold">운영</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-5 pb-28">

        {/* 시각 3개 */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-[#185FA5] rounded-[14px] p-4 text-center">
            <div className="text-[11px] text-[#B5D4F4] font-medium mb-1">현재 시각</div>
            <div className="text-[26px] font-bold text-white tracking-wide">{nowStr}</div>
            <div className="text-[11px] text-[#B5D4F4] mt-1">{now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
          </div>
          <div className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[14px] p-4 text-center">
            <div className="text-[11px] text-[#64748B] font-medium mb-1">행사 경과</div>
            <div className="text-[26px] font-bold text-[#1A1A2E] tracking-wide">{fmtDuration(elapsed)}</div>
            <div className="text-[11px] text-[#A0AEC0] mt-1">{project?.startTime} 시작</div>
          </div>
          <div className="bg-[#EAF3DE] rounded-[14px] p-4 text-center">
            <div className="text-[11px] text-[#3B6D11] font-medium mb-1">행사 잔여</div>
            <div className="text-[26px] font-bold text-[#3B6D11] tracking-wide">{fmtDuration(remaining)}</div>
            <div className="text-[11px] text-[#3B6D11] mt-1">{project?.endTime} 종료</div>
          </div>
        </div>

        {/* 현재 진행 중 큐 */}
        {currentCue ? (
          <div className="bg-[#E6F1FB] border-2 border-[#185FA5] rounded-[14px] p-4 mb-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[11px] font-semibold text-[#185FA5] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse inline-block" /> 현재 진행 중</div>
              <div className="text-[13px] font-medium text-[#0C447C] bg-[#B5D4F4] px-2.5 py-0.5 rounded-full">진행 중</div>
            </div>
            <div className="text-[18px] font-bold text-[#0C447C] mb-1">{currentCue.title}</div>
            <div className="flex items-center gap-2 text-[12px] text-[#378ADD]">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: currentCue.partColor }} />
              {currentCue.partName} · {currentCue.startTime}
            </div>
          </div>
        ) : (
          <div className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[14px] p-4 mb-4 text-center text-[13px] text-[#A0AEC0]">
            현재 진행 중인 큐가 없어요
          </div>
        )}

        {/* 다음 예정 */}
        <div className="bg-[#FAFBFC] border border-[#E2E8F0] rounded-[14px] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold flex items-center gap-1.5"><i className="ti ti-clock text-[14px] text-[#64748B]" /> 다음 예정</div>
            {nextCues.length > 0 && <div className="text-[12px] text-[#185FA5] bg-[#E6F1FB] px-2 py-0.5 rounded-full">가장 빠른 항목 {nextCues[0] ? `${timeToMinutes(nextCues[0].startTime) - nowMin}분 후` : ''}</div>}
          </div>
          {nextCues.length === 0 ? (
            <div className="text-[12px] text-[#A0AEC0] text-center py-3">다음 예정 항목이 없어요</div>
          ) : (
            <div className="flex flex-col gap-2">
              {nextCues.map((cue, i) => {
                const diff = timeToMinutes(cue.startTime) - nowMin
                const urgent = diff <= 30
                return (
                  <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border ${urgent ? 'bg-[#FAEEDA] border-[#FAC775]' : 'bg-white border-[#E2E8F0]'}`}>
                    <span className={`text-[12px] font-semibold min-w-[40px] ${urgent ? 'text-[#854F0B]' : 'text-[#64748B]'}`}>{cue.startTime}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cue.partColor }} />
                    <span className={`text-[13px] flex-1 font-${urgent ? 'semibold' : 'normal'} ${urgent ? 'text-[#633806]' : 'text-[#1A1A2E]'}`}>{cue.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${urgent ? 'bg-[#FAEEDA] text-[#854F0B] border border-[#FAC775]' : 'bg-[#F1EFE8] text-[#5F5E5A]'}`}>{diff}분 후</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 파트 현황 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {parts.map((part) => (
            <div key={part.id} className={`bg-white border rounded-[14px] p-3.5 ${part.status === 'delay' ? 'border-[#FAC775] bg-[#FAEEDA]' : part.status === 'ongoing' && 'border-[#E2E8F0]'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold"><span className="w-2.5 h-2.5 rounded-full" style={{ background: part.color }} />{part.name}</div>
                <StatusBadge status={part.status} />
              </div>
              <div className="text-[12px] text-[#64748B] mb-2 flex items-center gap-1"><i className="ti ti-user text-[13px]" /> {part.managerName ?? '미배정'}</div>
              <div className="flex items-center gap-2"><div className="flex-1 h-1 bg-white/50 rounded-full overflow-hidden"><div className="h-1 rounded-full" style={{ width: `${part.progress}%`, background: part.color }} /></div><span className="text-[11px] text-[#64748B]">{part.progress}%</span></div>
            </div>
          ))}
        </div>

        {/* 전체 진행률 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-4 mb-5">
          <div className="flex justify-between mb-2"><span className="text-[13px] font-semibold">전체 진행률</span><span className="text-[13px] font-bold text-[#185FA5]">{progress}%</span></div>
          <div className="h-3 bg-[#F4F6F9] rounded-full overflow-hidden"><div className="h-3 bg-[#185FA5] rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2 flex-wrap">
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] bg-[#A32D2D] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"><i className="ti ti-alert-triangle text-[16px]" /> 비상 상황</button>
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] bg-[#185FA5] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"><i className="ti ti-speakerphone text-[16px]" /> 전체 공지</button>
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] border border-[#E2E8F0] bg-[#FAFBFC] text-[#1A1A2E] text-[13px] font-semibold flex items-center justify-center gap-1.5"><i className="ti ti-player-pause text-[16px]" /> 일시 중단</button>
        </div>
      </div>
    </div>
    <BottomTabBar />
    </>
  )
}
