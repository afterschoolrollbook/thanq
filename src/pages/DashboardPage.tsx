import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { Topbar, StatusBadge } from '@/components/ui/Common'
import type { Project, Part } from '@/types'

export default function DashboardPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), (s) => { if (s.exists()) setProject(s.val()) })
    onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) { const l: Part[] = Object.values(s.val()); l.sort((a, b) => a.order - b.order); setParts(l) }
    })
  }, [projectId])

  const progress = parts.length ? Math.round(parts.reduce((s, p) => s + p.progress, 0) / parts.length) : 0
  const counts = { waiting: 0, ready: 0, ongoing: 0, done: 0, delay: 0 }
  parts.forEach((p) => { if (p.status in counts) counts[p.status as keyof typeof counts]++ })

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar projectName={project?.name} />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-10">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div><div className="text-[18px] font-semibold text-[#1A1A2E]">본부 대시보드</div><div className="text-[12px] text-[#64748B]">전체 현황 모니터링</div></div>
        </div>

        {/* 전체 진행률 */}
        <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-[#1A1A2E]">전체 준비율</span>
            <span className="text-[22px] font-bold text-[#185FA5]">{progress}%</span>
          </div>
          <div className="h-2 bg-[#F4F6F9] rounded-full overflow-hidden"><div className="h-2 bg-[#185FA5] rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="flex justify-between mt-1.5"><span className="text-[10px] text-[#A0AEC0]">0%</span><span className="text-[10px] text-[#A0AEC0]">100%</span></div>
        </div>

        {/* 상태 요약 */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { key: 'waiting', label: '대기',  bg: '#F1EFE8', color: '#5F5E5A' },
            { key: 'ready',   label: '준비',  bg: '#E6F1FB', color: '#185FA5' },
            { key: 'ongoing', label: '진행',  bg: '#E6F1FB', color: '#185FA5' },
            { key: 'done',    label: '완료',  bg: '#EAF3DE', color: '#3B6D11' },
            { key: 'delay',   label: '지연',  bg: '#FAEEDA', color: '#854F0B' },
          ].map(({ key, label, bg, color }) => (
            <div key={key} className="rounded-[10px] p-2.5 text-center" style={{ background: bg }}>
              <div className="text-[18px] font-black" style={{ color }}>{counts[key as keyof typeof counts]}</div>
              <div className="text-[10px] font-semibold mt-0.5" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 이슈 / 알림 */}
        <div className="mb-4">
          <div className="text-[13px] font-semibold flex items-center gap-1.5 mb-3"><i className="ti ti-alert-circle text-[15px] text-[#E24B4A]" /> 이슈 / 알림</div>
          <div className="text-[12px] text-[#64748B] text-center py-4 bg-white rounded-[10px] border border-[#E2E8F0]">등록된 이슈가 없어요</div>
        </div>

        {/* 파트별 상세 현황 */}
        <div className="text-[13px] font-semibold flex items-center gap-1.5 mb-3"><i className="ti ti-layout-grid text-[15px] text-[#185FA5]" /> 파트별 상세 현황</div>
        {parts.length === 0 ? (
          <div className="text-[12px] text-[#64748B] text-center py-8">파트가 없어요</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {parts.map((part) => (
              <div key={part.id} className="bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden">
                <div className="px-3.5 py-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: part.color }} />{part.name}
                    </div>
                    <StatusBadge status={part.status} />
                  </div>
                  <div className="text-[12px] text-[#64748B] mb-2 flex items-center gap-1.5">
                    <i className="ti ti-user text-[13px]" /> {part.managerName ?? '담당자 미배정'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden"><div className="h-1.5 rounded-full" style={{ width: `${part.progress}%`, background: part.color }} /></div>
                    <span className="text-[11px] text-[#64748B]">{part.progress}%</span>
                  </div>
                </div>
                <div className="px-3.5 py-2.5">
                  <div className="text-[12px] text-[#A0AEC0]">큐시트 없음</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 flex-wrap">
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] bg-[#A32D2D] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"><i className="ti ti-alert-triangle text-[16px]" /> 비상 상황</button>
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] bg-[#185FA5] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"><i className="ti ti-speakerphone text-[16px]" /> 전체 공지</button>
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] border border-[#E2E8F0] bg-[#FAFBFC] text-[#1A1A2E] text-[13px] font-semibold flex items-center justify-center gap-1.5"><i className="ti ti-player-pause text-[16px]" /> 일시 중단</button>
        </div>
      </div>
    </div>
  )
}
