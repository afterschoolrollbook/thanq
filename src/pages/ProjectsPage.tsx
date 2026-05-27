import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { getDday } from '@/utils/joinCode'
import type { Project } from '@/types'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    if (!user) return
    const unsub = onValue(ref(db, 'projects'), (snap) => {
      if (snap.exists()) {
        const all: Project[] = Object.values(snap.val())
        const mine = all.filter((p) => p.ownerId === user.uid)
        mine.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setProjects(mine)
      } else {
        setProjects([])
      }
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  const statusLabel: Record<Project['status'], string> = {
    planning: '기획 중',
    ready: '준비 중',
    live: '진행 중',
    done: '완료',
  }
  const statusStyle: Record<Project['status'], string> = {
    planning: 'bg-[#F1EFE8] text-[#5F5E5A]',
    ready: 'bg-[#E6F1FB] text-[#185FA5]',
    live: 'bg-[#EAF3DE] text-[#3B6D11]',
    done: 'bg-[#F1EFE8] text-[#A0AEC0]',
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* 탑바 */}
      <header className="bg-[#185FA5] px-5 py-3.5 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-[18px] tracking-tight">ThanQ</div>
          <div className="text-[#B5D4F4] text-[12px]">현장 운영 통합 플랫폼</div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[#B5D4F4] text-[12px]">{user?.displayName ?? user?.email}</span>
          <button onClick={handleLogout} className="text-[#B5D4F4] text-[11px] border border-[#B5D4F4] rounded px-2 py-1 hover:text-white hover:border-white transition-colors">
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 pb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#1A1A2E]">내 프로젝트</h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">진행 중이거나 예정된 행사를 관리하세요</p>
          </div>
          <button onClick={() => navigate('/onboarding/field')}
            className="h-[38px] px-4 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-1.5 text-[13px] font-semibold">
            <i className="ti ti-plus text-[14px]" /> 새 프로젝트
          </button>
        </div>

        {/* 참여 코드로 입장 */}
        <div className="mb-5">
          {!showJoinInput ? (
            <button onClick={() => setShowJoinInput(true)}
              className="w-full bg-white border border-[#E2E8F0] rounded-[12px] px-4 py-3.5 flex items-center gap-3 hover:border-[#185FA5] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#F4F6F9] flex items-center justify-center flex-shrink-0">
                <i className="ti ti-key text-[#64748B] text-[16px]" />
              </div>
              <div className="text-left flex-1">
                <div className="text-[13px] font-semibold text-[#1A1A2E]">참여 코드로 입장</div>
                <div className="text-[11px] text-[#64748B]">초대받은 프로젝트에 참여하기</div>
              </div>
              <i className="ti ti-chevron-right text-[#A0AEC0]" />
            </button>
          ) : (
            <div className="bg-white border-2 border-[#185FA5] rounded-[12px] px-4 py-3.5 flex items-center gap-2">
              <input className="flex-1 text-[14px] font-bold tracking-widest text-[#185FA5] outline-none placeholder-[#B5D4F4]"
                placeholder="참여 코드 입력 (예: AB3X7F)"
                value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6} autoFocus />
              <button onClick={() => setShowJoinInput(false)} className="text-[#A0AEC0] text-[12px]">취소</button>
              <button className="h-[32px] px-3 bg-[#185FA5] text-white rounded-[8px] text-[12px] font-semibold">입장</button>
            </div>
          )}
        </div>

        {/* 프로젝트 목록 */}
        {loading ? (
          <div className="text-center py-10 text-[#64748B] text-[13px]">불러오는 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-14">
            <i className="ti ti-folder-open text-[48px] text-[#A0AEC0] block mb-3 opacity-40" />
            <p className="text-[13px] text-[#64748B]">아직 프로젝트가 없어요</p>
            <p className="text-[12px] text-[#A0AEC0] mt-1">위에서 새 프로젝트를 만들어보세요</p>
            <button onClick={() => navigate('/onboarding/field')}
              className="mt-4 h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold inline-flex items-center gap-1.5">
              <i className="ti ti-plus" /> 새 프로젝트 만들기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {projects.map((project) => {
              const dday = getDday(project.date)
              const isLive = project.status === 'live'
              return (
                <button key={project.id} onClick={() => navigate(`/p/${project.id}/home`)}
                  className={`w-full text-left bg-white border rounded-[14px] p-4 hover:shadow-md transition-all ${isLive ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isLive && <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-[#E24B4A] px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" /> LIVE</span>}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle[project.status]}`}>{statusLabel[project.status]}</span>
                      </div>
                      <div className="text-[15px] font-semibold text-[#1A1A2E] truncate">{project.name}</div>
                      <div className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-1.5">
                        {project.venue && <><i className="ti ti-map-pin text-[12px]" />{project.venue}</>}
                        {project.venue && project.date && <span>·</span>}
                        {project.date && project.date.replace(/-/g, '.')}
                        {project.startTime && ` ${project.startTime}`}
                        {project.endTime && ` ~ ${project.endTime}`}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-[20px] font-black ${dday === 'D-DAY' ? 'text-[#E24B4A]' : 'text-[#185FA5]'}`}>{dday}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[12px] text-[#64748B]">
                      <i className="ti ti-key text-[13px]" />
                      <span className="font-mono font-bold tracking-widest text-[#185FA5]">{project.joinCode}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-[#185FA5] font-semibold">
                      이어서 작업하기 <i className="ti ti-arrow-right text-[13px]" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
