import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { getDday } from '@/utils/joinCode'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Project } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  owner: '운영자', admin: '관리자', member: '팀원', viewer: '참관', guest: '게스트'
}
const ROLE_STYLE: Record<string, string> = {
  owner:  'bg-[#E6F1FB] text-[#185FA5]',
  admin:  'bg-[#EAF3DE] text-[#3B6D11]',
  member: 'bg-[#F1EFE8] text-[#5F5E5A]',
  viewer: 'bg-[#F1EFE8] text-[#A0AEC0]',
  guest:  'bg-[#F1EFE8] text-[#A0AEC0]',
}

export default function MainDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [projects, setProjects] = useState<Project[]>([])
  const [myRoles, setMyRoles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsub = onValue(ref(db, 'projects'), (snap) => {
      if (snap.exists()) {
        const all: Project[] = Object.values(snap.val())
        const mine = all.filter((p) => p.ownerId === user.uid)
        mine.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setProjects(mine)
        // 역할 로딩
        mine.forEach(p => {
          onValue(ref(db, `projectMembers/${p.id}/${user.uid}`), (s) => {
            if (s.exists()) {
              setMyRoles(prev => ({ ...prev, [p.id]: s.val().role ?? 'member' }))
            } else {
              // ownerId === user.uid 이면 owner
              setMyRoles(prev => ({ ...prev, [p.id]: 'owner' }))
            }
          }, { onlyOnce: true })
        })
      } else {
        setProjects([])
      }
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  const live     = projects.filter((p) => p.status === 'live')
  const upcoming = projects.filter((p) => p.status !== 'live' && p.status !== 'done')
  const done     = projects.filter((p) => p.status === 'done')

  const statusStyle: Record<Project['status'], string> = {
    planning: 'bg-[#F1EFE8] text-[#5F5E5A]',
    ready:    'bg-[#E6F1FB] text-[#185FA5]',
    live:     'bg-[#EAF3DE] text-[#3B6D11]',
    done:     'bg-[#F1EFE8] text-[#A0AEC0]',
  }
  const statusLabel: Record<Project['status'], string> = {
    planning: '기획 중', ready: '준비 중', live: '진행 중', done: '완료',
  }

  function ProjectCard({ project }: { project: Project }) {
    const dday = getDday(project.date)
    const isLive = project.status === 'live'
    const role = myRoles[project.id] ?? 'owner'
    return (
      <button onClick={() => navigate(`/p/${project.id}/home`)}
        className={`w-full text-left bg-white border rounded-[14px] p-4 hover:shadow-md transition-all ${isLive ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {isLive && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-[#E24B4A] px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" /> LIVE
                </span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle[project.status]}`}>
                {statusLabel[project.status]}
              </span>
              {/* 내 역할 배지 */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${ROLE_STYLE[role] ?? ROLE_STYLE['member']}`}>
                <i className={`ti ${role === 'owner' ? 'ti-shield-check' : 'ti-user'} text-[10px]`}/>
                {ROLE_LABEL[role] ?? role}
              </span>
            </div>
            <div className="text-[15px] font-semibold text-[#1A1A2E] truncate">{project.name}</div>
            <div className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-1.5 flex-wrap">
              {project.venue && <span className="flex items-center gap-1"><i className="ti ti-map-pin text-[12px]" />{project.venue}</span>}
              {project.date && <span>{project.date.replace(/-/g,'.')}</span>}
              {project.startTime && <span>{project.startTime}{project.endTime ? ` ~ ${project.endTime}` : ''}</span>}
            </div>
          </div>
          <div className={`text-[22px] font-black flex-shrink-0 ${dday === 'D-DAY' ? 'text-[#E24B4A]' : 'text-[#185FA5]'}`}>{dday}</div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold tracking-widest text-[#185FA5]">{project.joinCode}</span>
          <span className="text-[12px] text-[#185FA5] font-semibold flex items-center gap-1">
            이어서 작업하기 <i className="ti ti-arrow-right text-[13px]" />
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#1A1A2E]">홈 (전체 대시보드)</h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">내 모든 프로젝트를 한눈에</p>
          </div>
          <button onClick={() => navigate('/onboarding/field')}
            className="flex items-center gap-1.5 h-[36px] px-3 bg-[#185FA5] text-white rounded-[10px] text-[12px] font-semibold flex-shrink-0 hover:bg-[#0C447C] transition-colors">
            <i className="ti ti-plus text-[14px]"/> 프로젝트 만들기
          </button>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3.5 text-center">
            <div className="text-[22px] font-black text-[#E24B4A]">{live.length}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">진행 중</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3.5 text-center">
            <div className="text-[22px] font-black text-[#185FA5]">{upcoming.length}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">예정</div>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3.5 text-center">
            <div className="text-[22px] font-black text-[#A0AEC0]">{done.length}</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">완료</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-[#64748B] text-[13px]">불러오는 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-14">
            <i className="ti ti-folder-open text-[48px] text-[#A0AEC0] block mb-3 opacity-40" />
            <p className="text-[13px] text-[#64748B]">아직 프로젝트가 없어요</p>
            <p className="text-[12px] text-[#A0AEC0] mt-1">하단 프로젝트 탭에서 새 프로젝트를 만들어보세요</p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <div className="mb-4">
                <div className="text-[12px] font-semibold text-[#E24B4A] mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse inline-block" /> 지금 진행 중
                </div>
                <div className="flex flex-col gap-3">{live.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="mb-4">
                <div className="text-[12px] font-semibold text-[#64748B] mb-2">예정된 프로젝트</div>
                <div className="flex flex-col gap-3">{upcoming.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
              </div>
            )}
            {done.length > 0 && (
              <div className="mb-4">
                <div className="text-[12px] font-semibold text-[#A0AEC0] mb-2">완료된 프로젝트</div>
                <div className="flex flex-col gap-3 opacity-60">{done.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
