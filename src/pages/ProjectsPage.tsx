import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { getDday } from '@/utils/joinCode'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Project } from '@/types'

// ── 타임라인 테마 ─────────────────────────────────────────
function TimelineHeader() {
  return (
    <div className="mb-5 bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="ti ti-timeline text-[#185FA5] text-[18px]"/>
          <span className="text-[15px] font-bold text-[#1A1A2E]">일정표</span>
        </div>
        <p className="text-[12px] text-[#64748B] mb-3">팀별·시간대별 당일 운영 일정을 한눈에 확인하고 체크리스트를 관리해요</p>
        {/* 미니 그리드 시각화 */}
        <div className="flex gap-1.5 rounded-[10px] border border-[#E2E8F0] p-2 bg-[#F8FAFC] overflow-hidden">
          <div className="flex flex-col gap-1 flex-shrink-0">
            {['07:00','07:30','08:00','08:30'].map(t => (
              <div key={t} className="h-7 flex items-center justify-end pr-1">
                <span className="text-[9px] font-bold text-[#A0AEC0]">{t}</span>
              </div>
            ))}
          </div>
          {[
            { color:'#185FA5', items:['집결지 오픈','','워밍업',''] },
            { color:'#E24B4A', items:['','','A그룹 출발','반환점'] },
            { color:'#F59E0B', items:['','','B그룹 출발','반환점'] },
            { color:'#3B6D11', items:['','','C그룹 출발',''] },
            { color:'#7C3AED', items:['집결지 촬영','도착 촬영','',''] },
          ].map((col, ci) => (
            <div key={ci} className="flex-1 flex flex-col gap-1">
              {col.items.map((item, ii) => (
                <div key={ii} className="h-7 rounded-[4px] flex items-center px-1"
                  style={{ background: item ? col.color+'22' : 'transparent', border: item ? `1px solid ${col.color}44` : 'none' }}>
                  {item && <span className="text-[8px] font-semibold truncate" style={{ color: col.color }}>{item}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-2 bg-[#E6F1FB] text-[11px] font-semibold text-[#185FA5] flex items-center gap-1.5">
        <i className="ti ti-hand-click text-[12px]"/>아래에서 프로젝트를 선택하면 일정표가 열려요
      </div>
    </div>
  )
}

// ── 내 파트 테마 ──────────────────────────────────────────
function MyPartHeader() {
  return (
    <div className="mb-5 bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="ti ti-checklist text-[#3B6D11] text-[18px]"/>
          <span className="text-[15px] font-bold text-[#1A1A2E]">내 할 일</span>
        </div>
        <p className="text-[12px] text-[#64748B] mb-3">내가 담당한 파트의 체크리스트와 준비사항을 확인해요</p>
        <div className="flex flex-col gap-1.5">
          {[
            { done:true,  text:'집결지 사용 허가 확인' },
            { done:true,  text:'코스 사전 답사 완료' },
            { done:false, text:'브런치 식당 예약 — 인원 재확인' },
            { done:false, text:'페이서 3명 섭외 및 역할 분담' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-[8px]"
              style={{ background: item.done ? '#F0FAF4' : '#F4F6F9' }}>
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#3B6D11]' : 'border-2 border-[#E2E8F0]'}`}>
                {item.done && <i className="ti ti-check text-white text-[9px]"/>}
              </div>
              <span className={`text-[11px] ${item.done ? 'line-through text-[#A0AEC0]' : 'text-[#1A1A2E]'}`}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-2 bg-[#EAF3DE] text-[11px] font-semibold text-[#3B6D11] flex items-center gap-1.5">
        <i className="ti ti-hand-click text-[12px]"/>아래에서 프로젝트를 선택하면 내 할 일이 열려요
      </div>
    </div>
  )
}

// ── 대시보드 테마 ─────────────────────────────────────────
function DashboardHeader() {
  return (
    <div className="mb-5 bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="ti ti-layout-dashboard text-[#854F0B] text-[18px]"/>
          <span className="text-[15px] font-bold text-[#1A1A2E]">본부 현황판</span>
        </div>
        <p className="text-[12px] text-[#64748B] mb-3">전체 준비율, 파트별 진행 상태, 이슈를 실시간으로 모니터링해요</p>
        <div className="flex gap-2 mb-2">
          {[{label:'전체 준비율',value:'68%',color:'#185FA5'},{label:'진행 중',value:'3',color:'#3B6D11'},{label:'지연',value:'1',color:'#E24B4A'}].map(s => (
            <div key={s.label} className="flex-1 bg-[#F4F6F9] rounded-[8px] p-2 text-center">
              <div className="text-[14px] font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] text-[#64748B] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="h-2 bg-[#F4F6F9] rounded-full overflow-hidden">
          <div className="h-full bg-[#185FA5] rounded-full" style={{ width:'68%' }}/>
        </div>
      </div>
      <div className="px-4 py-2 bg-[#FAEEDA] text-[11px] font-semibold text-[#854F0B] flex items-center gap-1.5">
        <i className="ti ti-hand-click text-[12px]"/>아래에서 프로젝트를 선택하면 현황판이 열려요
      </div>
    </div>
  )
}

// ── 소통 테마 ─────────────────────────────────────────────
function CommsHeader() {
  return (
    <div className="mb-5 bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="relative flex-shrink-0 mt-1">
          <div className="w-12 h-12 rounded-full bg-[#7C3AED] flex items-center justify-center">
            <i className="ti ti-speakerphone text-white text-[22px]"/>
          </div>
          {[1,2,3].map(i => (
            <div key={i} className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-[#7C3AED] animate-ping"
              style={{ right:-4*i, width:12+8*i, height:12+8*i, opacity:0.2, animationDelay:`${i*0.3}s`, animationDuration:'1.5s' }}/>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">공지 · 연락</div>
          <p className="text-[12px] text-[#64748B] mb-2">팀 전체에 공지를 보내거나 긴급 연락, 미팅 안내를 작성해요</p>
          <div className="flex flex-col gap-1">
            {[{type:'긴급',color:'#E24B4A',text:'A그룹 집결지 변경 안내'},{type:'일반',color:'#185FA5',text:'준비물 최종 점검 완료'}].map((n,i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#F4F6F9] rounded-[6px]">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ background:n.color }}>{n.type}</span>
                <span className="text-[10px] text-[#64748B] truncate">{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-2 bg-[#7C3AED] text-[11px] font-semibold text-white flex items-center gap-1.5">
        <i className="ti ti-hand-click text-[12px]"/>아래에서 프로젝트를 선택하면 공지 채널이 열려요
      </div>
    </div>
  )
}

// ── 무전 테마 ─────────────────────────────────────────────
function PTTHeader() {
  return (
    <div className="mb-5 bg-[#1A1A2E] rounded-[16px] overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-20 bg-[#2D2D44] rounded-[10px] border-2 border-[#3D3D5C] flex flex-col items-center justify-between py-2 px-1.5">
            <div className="w-full h-5 bg-[#0A0A1A] rounded-[4px] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
            </div>
            <div className="w-8 h-8 rounded-full border-4 border-[#E24B4A] flex items-center justify-center">
              <i className="ti ti-microphone text-[14px] text-white"/>
            </div>
            <div className="w-full flex gap-1">
              <div className="flex-1 h-1.5 bg-[#3D3D5C] rounded-full"/>
              <div className="flex-1 h-1.5 bg-[#3D3D5C] rounded-full"/>
            </div>
          </div>
          <div className="absolute -right-1 top-3 w-1.5 h-6 bg-[#E24B4A] rounded-r-full"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-white mb-1">무전</div>
          <p className="text-[11px] text-[#A0AEC0] leading-relaxed mb-2">버튼을 누르고 말하면 담당자에게 즉시 음성이 전달돼요. 프로젝트를 선택하면 해당 팀으로 바로 연결해요</p>
          <div className="flex items-center gap-1.5">
            {['운영팀','포토팀','안전팀'].map(t => (
              <span key={t} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#2D2D44] text-[#A0AEC0]">{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-2 bg-[#E24B4A] text-[11px] font-semibold text-white flex items-center gap-1.5">
        <i className="ti ti-hand-click text-[12px]"/>아래에서 프로젝트를 선택하면 무전이 연결돼요
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function ProjectsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  const nextTab = new URLSearchParams(location.search).get('next')

  function goToProject(projectId: string) {
    navigate(`/p/${projectId}/${nextTab ?? 'home'}`)
  }

  useEffect(() => {
    if (!user) return
    const unsub = onValue(ref(db, 'projects'), (snap) => {
      if (snap.exists()) {
        const all: Project[] = Object.values(snap.val())
        setProjects(all.filter(p => p.ownerId === user.uid).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      } else setProjects([])
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  const statusLabel: Record<Project['status'], string> = { planning:'기획 중', ready:'준비 중', live:'진행 중', done:'완료' }
  const statusStyle: Record<Project['status'], string> = {
    planning:'bg-[#F1EFE8] text-[#5F5E5A]', ready:'bg-[#E6F1FB] text-[#185FA5]',
    live:'bg-[#EAF3DE] text-[#3B6D11]', done:'bg-[#F1EFE8] text-[#A0AEC0]',
  }
  const btnColor: Record<string, string> = {
    timeline:'#185FA5', 'my-part':'#3B6D11', dashboard:'#854F0B', comms:'#7C3AED', ptt:'#E24B4A'
  }
  const arrowColor = nextTab ? (btnColor[nextTab] ?? '#185FA5') : '#185FA5'

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">

        {/* 탭별 테마 헤더 */}
        {nextTab === 'timeline'  && <TimelineHeader />}
        {nextTab === 'my-part'   && <MyPartHeader />}
        {nextTab === 'dashboard' && <DashboardHeader />}
        {nextTab === 'comms'     && <CommsHeader />}
        {nextTab === 'ptt'       && <PTTHeader />}

        {/* 기본 헤더 (프로젝트 탭 직접 진입) */}
        {!nextTab && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#1A1A2E]">내 프로젝트</h2>
                <p className="text-[13px] text-[#64748B] mt-0.5">진행 중이거나 예정된 행사를 관리하세요</p>
              </div>
              <button onClick={() => navigate('/onboarding/field')}
                className="h-[38px] px-4 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-1.5 text-[13px] font-semibold">
                <i className="ti ti-plus text-[14px]" /> 새 프로젝트
              </button>
            </div>
            {/* 참여 코드 */}
            <div className="mb-4">
              {!showJoinInput ? (
                <button onClick={() => setShowJoinInput(true)}
                  className="w-full bg-white border border-[#E2E8F0] rounded-[12px] px-4 py-3 flex items-center gap-3 hover:border-[#185FA5] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#F4F6F9] flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-key text-[#64748B] text-[16px]" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-[13px] font-semibold">참여 코드로 입장</div>
                    <div className="text-[11px] text-[#64748B]">초대받은 프로젝트에 참여하기</div>
                  </div>
                  <i className="ti ti-chevron-right text-[#A0AEC0]" />
                </button>
              ) : (
                <div className="bg-white border-2 border-[#185FA5] rounded-[12px] px-4 py-3 flex items-center gap-2">
                  <input className="flex-1 text-[14px] font-bold tracking-widest text-[#185FA5] outline-none placeholder-[#B5D4F4]"
                    placeholder="참여 코드 6자리" value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} autoFocus />
                  <button onClick={() => setShowJoinInput(false)} className="text-[#A0AEC0] text-[12px]">취소</button>
                  <button className="h-[32px] px-3 bg-[#185FA5] text-white rounded-[8px] text-[12px] font-semibold">입장</button>
                </div>
              )}
            </div>
          </>
        )}

        {loading ? (
          <div className="text-center py-10 text-[#64748B] text-[13px]">불러오는 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-14">
            <i className="ti ti-folder-open text-[48px] text-[#A0AEC0] block mb-3 opacity-40" />
            <p className="text-[13px] text-[#64748B]">아직 프로젝트가 없어요</p>
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
                <button key={project.id} onClick={() => goToProject(project.id)}
                  className={`w-full text-left bg-white border rounded-[14px] p-4 hover:shadow-md transition-all ${isLive ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {isLive && <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-[#E24B4A] px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block"/>LIVE</span>}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle[project.status]}`}>{statusLabel[project.status]}</span>
                      </div>
                      <div className="text-[15px] font-semibold text-[#1A1A2E] truncate">{project.name}</div>
                      <div className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {project.venue && <span className="flex items-center gap-1"><i className="ti ti-map-pin text-[12px]"/>{project.venue}</span>}
                        {project.date && <span>{project.date.replace(/-/g,'.')}</span>}
                        {project.startTime && <span>{project.startTime}{project.endTime?` ~ ${project.endTime}`:''}</span>}
                      </div>
                    </div>
                    <div className={`text-[22px] font-black flex-shrink-0 ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#185FA5]'}`}>{dday}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold tracking-widest text-[#185FA5]">{project.joinCode}</span>
                    <span className="text-[12px] font-semibold flex items-center gap-1" style={{ color: arrowColor }}>
                      {nextTab ? '선택하기' : '이어서 작업하기'} <i className="ti ti-arrow-right text-[13px]"/>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
