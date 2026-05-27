import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { getDday } from '@/utils/joinCode'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import type { Project, Part } from '@/types'

export default function ProjectHomePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const u1 = onValue(ref(db, `projects/${projectId}`), (s) => { if (s.exists()) setProject(s.val()); setLoading(false) })
    const u2 = onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) { const l: Part[] = Object.values(s.val()); l.sort((a, b) => a.order - b.order); setParts(l) }
    })
    return () => { u1(); u2() }
  }, [projectId])

  if (loading) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">불러오는 중...</div>
  if (!project) return <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">프로젝트를 찾을 수 없어요</div>

  const dday = getDday(project.date)
  const progress = parts.length ? Math.round(parts.reduce((s, p) => s + p.progress, 0) / parts.length) : 0
  const partCount = parts.length
  

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar projectName={project.name} />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-24">

        {/* D-day 바 */}
        <div className="bg-[#E6F1FB] rounded-[10px] px-4 py-3 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#185FA5] text-white text-[12px] font-semibold px-2.5 py-1 rounded-full">{dday}</div>
            <div>
              <div className="text-[13px] font-semibold text-[#0C447C]">{project.name}</div>
              <div className="text-[11px] text-[#378ADD] mt-0.5">{project.date.replace(/-/g,'.')} &nbsp; {project.startTime}{project.endTime ? ` ~ ${project.endTime}` : ''} &nbsp; {project.venue}</div>
            </div>
          </div>
          <div className="text-[12px] text-[#378ADD] flex items-center gap-1"><i className="ti ti-calendar text-[13px]" /> {dday === 'D-DAY' ? '오늘!' : `${dday} 남음`}</div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          {[
            { label: '전체 진행률', value: `${progress}%`, sub: null, prog: progress },
            { label: '파트', value: `${partCount}개`, sub: null, prog: null },
            { label: '체크리스트', value: '—', sub: null, prog: null },
            { label: '미확인 공지', value: '0건', sub: null, prog: null },
          ].map(({ label, value, prog }, i) => (
            <div key={i} className="bg-[#FAFBFC] rounded-[10px] px-3.5 py-3">
              <div className="text-[11px] text-[#64748B] mb-1">{label}</div>
              <div className="text-[22px] font-bold text-[#1A1A2E]">{value}</div>
              {prog !== null && <div className="h-1 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden"><div className="h-1 bg-[#185FA5] rounded-full" style={{ width: `${prog}%` }} /></div>}
            </div>
          ))}
        </div>

        {/* 지금/다음 진행 + 파트별 현황 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5"><i className="ti ti-player-play text-[#185FA5]" /> 지금 / 다음 진행</div>
              <div className="text-[12px] text-[#185FA5]">전체 보기</div>
            </div>
            <div className="text-[12px] text-[#64748B] text-center py-4">큐시트 항목이 없어요</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5"><i className="ti ti-layout-grid text-[#185FA5]" /> 파트별 현황</div>
              <div className="text-[12px] text-[#185FA5]">대시보드</div>
            </div>
            {parts.length === 0 ? (
              <div className="text-center py-4">
              <p className="text-[12px] text-[#64748B] mb-3">파트가 없어요</p>
              <button onClick={() => navigate(`/onboarding/parts/${projectId}`)}
                className="h-[34px] px-4 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex items-center gap-1.5 mx-auto">
                <i className="ti ti-plus text-[13px]" /> 파트 추가하기
              </button>
            </div>
            ) : parts.map((part) => (
              <div key={part.id} className="flex items-center gap-2 py-1.5 border-b border-[#E2E8F0] last:border-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: part.color }} />
                <span className="text-[13px] flex-1">{part.name}</span>
                <StatusBadge status={part.status} />
                <span className="text-[12px] text-[#A0AEC0] w-8 text-right">{part.progress}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 내 할 일 + 최근 공지 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5"><i className="ti ti-checklist text-[#185FA5]" /> 내 할 일 (오늘)</div>
              <div className="text-[12px] text-[#185FA5]">내 파트 전체</div>
            </div>
            <div className="text-[12px] text-[#64748B] text-center py-4">체크리스트가 없어요</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold flex items-center gap-1.5"><i className="ti ti-bell text-[#185FA5]" /> 최근 공지</div>
              <div className="text-[12px] text-[#185FA5]">전체 보기</div>
            </div>
            <div className="text-[12px] text-[#64748B] text-center py-4">공지가 없어요</div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  )
}
