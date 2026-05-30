import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { getDday } from '@/utils/joinCode'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Project } from '@/types'

// ── 탭별 헤더 (임팩트 있게) ──────────────────────────────
function TimelineHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#185FA5] px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-[12px] bg-white/20 flex items-center justify-center">
            <i className="ti ti-timeline text-white text-[20px]"/>
          </div>
          <div>
            <div className="text-white text-[17px] font-black">일정표</div>
            <div className="text-[#B5D4F4] text-[11px]">팀별 · 시간대별 운영 일정</div>
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-hidden rounded-[10px] bg-white/10 p-2">
          <div className="flex flex-col gap-1 flex-shrink-0 mr-1">
            {['07:00','07:30','08:00','08:30'].map(t => (
              <div key={t} className="h-6 flex items-center"><span className="text-[9px] font-bold text-white/60">{t}</span></div>
            ))}
          </div>
          {[
            { c:'#93C5FD', items:['집결지','','워밍업',''] },
            { c:'#FCA5A5', items:['','','A출발','반환점'] },
            { c:'#FCD34D', items:['','','B출발','반환점'] },
            { c:'#6EE7B7', items:['','','C출발',''] },
            { c:'#C4B5FD', items:['촬영','도착','',''] },
          ].map((col, ci) => (
            <div key={ci} className="flex-1 flex flex-col gap-1">
              {col.items.map((item, ii) => (
                <div key={ii} className="h-6 rounded-[3px] flex items-center px-1"
                  style={{ background: item ? col.c+'44' : 'transparent', border: item ? `1px solid ${col.c}66` : 'none' }}>
                  {item && <span className="text-[8px] font-bold truncate" style={{ color: col.c }}>{item}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#0C447C] px-5 py-2.5 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 일정표가 열려요</span>
      </div>
    </div>
  )
}

function MyPartHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#3B6D11] px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-[12px] bg-white/20 flex items-center justify-center">
            <i className="ti ti-checklist text-white text-[20px]"/>
          </div>
          <div>
            <div className="text-white text-[17px] font-black">내 할 일</div>
            <div className="text-[#BBF7D0] text-[11px]">내가 담당한 파트의 체크리스트</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 bg-white/10 rounded-[10px] p-3">
          {[{done:true,text:'집결지 사용 허가 확인'},{done:true,text:'코스 사전 답사 완료'},{done:false,text:'브런치 식당 예약 — 인원 재확인'},{done:false,text:'페이서 3명 섭외 및 역할 분담'}].map((item,i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${item.done?'bg-white':'border border-white/40'}`}>
                {item.done && <i className="ti ti-check text-[#3B6D11] text-[9px]"/>}
              </div>
              <span className={`text-[11px] ${item.done?'line-through text-white/50':'text-white'}`}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#2D5209] px-5 py-2.5 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 내 할 일이 열려요</span>
      </div>
    </div>
  )
}

function DashboardHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#854F0B] px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-[12px] bg-white/20 flex items-center justify-center">
            <i className="ti ti-layout-dashboard text-white text-[20px]"/>
          </div>
          <div>
            <div className="text-white text-[17px] font-black">본부 현황판</div>
            <div className="text-[#FDE68A] text-[11px]">전체 준비율 · 파트별 진행 상태</div>
          </div>
        </div>
        <div className="bg-white/10 rounded-[10px] p-3">
          <div className="flex gap-3 mb-2">
            {[{label:'전체 준비율',value:'68%',color:'#FDE68A'},{label:'진행 중',value:'3팀',color:'#6EE7B7'},{label:'지연',value:'1팀',color:'#FCA5A5'}].map(s => (
              <div key={s.label} className="flex-1 text-center">
                <div className="text-[16px] font-black" style={{color:s.color}}>{s.value}</div>
                <div className="text-[9px] text-white/60 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-[#FDE68A] rounded-full" style={{width:'68%'}}/>
          </div>
        </div>
      </div>
      <div className="bg-[#6B3F09] px-5 py-2.5 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 현황판이 열려요</span>
      </div>
    </div>
  )
}

function CommsHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#7C3AED] px-5 pt-5 pb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-speakerphone text-white text-[20px]"/>
          </div>
          <div>
            <div className="text-white text-[17px] font-black">공지 · 연락</div>
            <div className="text-[#DDD6FE] text-[11px]">팀 전체에 공지 · 긴급 연락 · 미팅 안내</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 bg-white/10 rounded-[10px] p-3">
          {[{type:'긴급',color:'#FCA5A5',text:'A그룹 집결지 변경 안내'},{type:'일반',color:'#93C5FD',text:'준비물 최종 점검 완료'}].map((n,i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{background:n.color+'33',color:n.color}}>{n.type}</span>
              <span className="text-[11px] text-white truncate">{n.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#5B21B6] px-5 py-2.5 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 공지 채널이 열려요</span>
      </div>
    </div>
  )
}

function PTTHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#1A1A2E] px-5 pt-5 pb-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-16 h-22 bg-[#2D2D44] rounded-[12px] border-2 border-[#3D3D5C] flex flex-col items-center justify-between py-2 px-2">
            <div className="w-full h-5 bg-[#0A0A1A] rounded-[4px] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
            </div>
            <div className="w-9 h-9 rounded-full border-[3px] border-[#E24B4A] flex items-center justify-center">
              <i className="ti ti-microphone text-[16px] text-white"/>
            </div>
            <div className="w-full flex gap-1">
              <div className="flex-1 h-1.5 bg-[#3D3D5C] rounded-full"/>
              <div className="flex-1 h-1.5 bg-[#3D3D5C] rounded-full"/>
            </div>
          </div>
          <div className="absolute -right-1 top-3 w-1.5 h-7 bg-[#E24B4A] rounded-r-full"/>
        </div>
        <div>
          <div className="text-white text-[17px] font-black mb-1">무전</div>
          <div className="text-[#A0AEC0] text-[11px] leading-relaxed">버튼을 누르고 말하면<br/>담당자에게 즉시 전달돼요</div>
          <div className="flex gap-1.5 mt-2">
            {['운영팀','포토팀','안전팀'].map(t=>(
              <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-[#2D2D44] text-[#A0AEC0]">{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#E24B4A] px-5 py-2.5 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 무전이 연결돼요</span>
      </div>
    </div>
  )
}

// ── 심플 프로젝트 선택 카드 ───────────────────────────────
// ── 달력 모양 카드 (타임라인) ────────────────────────────
function TimelineShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-white rounded-[16px] overflow-hidden shadow-sm border border-[#E2E8F0] hover:shadow-md transition-shadow">
        {/* 달력 상단 탭 구멍 2개 */}
        <div className="absolute top-0 left-0 right-0 flex justify-around px-8">
          <div className="w-4 h-3 bg-[#F4F6F9] rounded-b-full border-x border-b border-[#E2E8F0]"/>
          <div className="w-4 h-3 bg-[#F4F6F9] rounded-b-full border-x border-b border-[#E2E8F0]"/>
        </div>
        {/* 달력 헤더 */}
        <div className="bg-[#185FA5] pt-3 pb-2 px-4 flex items-center justify-between mt-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white/70 text-[10px]">{d.getFullYear()}년</span>
            <span className="text-white font-black text-[13px]">{d.getMonth()+1}월</span>
          </div>
          <span className={`text-[12px] font-black ${dday==='D-DAY'?'text-[#FFD700]':'text-white/80'}`}>{dday}</span>
        </div>
        {/* 날짜 크게 */}
        <div className="px-4 pt-2 pb-1 flex items-center gap-3">
          <div className="text-[42px] font-black text-[#185FA5] leading-none">{d.getDate()}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5"><i className="ti ti-map-pin text-[10px]"/>{project.venue}</div>}
          </div>
        </div>
        {/* 구분선 점선 */}
        <div className="mx-4 border-t border-dashed border-[#E2E8F0] my-1"/>
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-[#185FA5]">일정표 열기 →</span>
        </div>
      </div>
    </button>
  )
}

// ── 확성기 모양 카드 (소통) ───────────────────────────────
function CommsShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative overflow-hidden hover:shadow-md transition-shadow" style={{
        background: '#7C3AED',
        borderRadius: '16px 16px 16px 16px',
        clipPath: 'polygon(0 0, 85% 0, 100% 15%, 100% 100%, 0 100%)'
      }}>
        {/* 확성기 SVG 배경 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-10">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </div>
        <div className="relative px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">공지 · 연락</span>
            <span className={`text-[12px] font-black ${dday==='D-DAY'?'text-[#FFD700]':'text-white/80'}`}>{dday}</span>
          </div>
          <div className="text-[14px] font-bold text-white truncate mb-0.5">{project.name}</div>
          <div className="text-[11px] text-white/60">{project.date.replace(/-/g,'.')}</div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
            <span className="text-[10px] font-mono text-white/40">{project.joinCode}</span>
            <span className="text-[11px] font-bold text-white">채널 열기 →</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── 무전기 모양 카드 (PTT) ────────────────────────────────
function PTTShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-[#1A1A2E] overflow-hidden hover:shadow-md transition-shadow" style={{
        borderRadius: '12px 12px 20px 20px',
        border: '2px solid #3D3D5C'
      }}>
        {/* 안테나 */}
        <div className="absolute -top-3 right-8 w-1.5 h-4 bg-[#E24B4A] rounded-full"/>
        {/* 상단 스피커 격자 */}
        <div className="bg-[#0A0A1A] mx-3 mt-3 rounded-[6px] px-3 py-2 flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(4)].map((_,i) => <div key={i} className="w-0.5 h-3 bg-[#3D3D5C] rounded-full"/>)}
          </div>
          <div className="flex-1 text-center">
            <span className={`text-[11px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#A0AEC0]'}`}>{dday}</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
        </div>
        {/* PTT 버튼 영역 */}
        <div className="px-3 py-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-[#E24B4A] flex items-center justify-center flex-shrink-0">
            <i className="ti ti-microphone text-[16px] text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-white truncate">{project.name}</div>
            <div className="text-[10px] text-[#A0AEC0] mt-0.5">{project.date.replace(/-/g,'.')}</div>
          </div>
        </div>
        {/* 하단 바 */}
        <div className="bg-[#E24B4A] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/50">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-white">무전 연결 →</span>
        </div>
      </div>
    </button>
  )
}

// ── 체크보드 모양 카드 (내 파트) ─────────────────────────
function MyPartShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-white overflow-hidden hover:shadow-md transition-shadow rounded-[16px] border-2 border-[#3B6D11]">
        {/* 클립보드 고리 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-3 bg-[#3B6D11] rounded-b-[8px] flex items-center justify-center">
          <div className="w-4 h-1.5 bg-[#2D5209] rounded-full"/>
        </div>
        <div className="pt-4 px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#3B6D11]">✅ 내 할 일</span>
            <span className={`text-[12px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#3B6D11]'}`}>{dday}</span>
          </div>
          <div className="text-[14px] font-bold text-[#1A1A2E] truncate mb-2">{project.name}</div>
          {/* 체크리스트 줄 */}
          <div className="flex flex-col gap-1">
            {[true,true,false,false].map((done,i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded flex-shrink-0 flex items-center justify-center ${done?'bg-[#3B6D11]':'border border-[#E2E8F0]'}`}>
                  {done && <i className="ti ti-check text-white text-[7px]"/>}
                </div>
                <div className={`flex-1 h-1.5 rounded-full ${done?'bg-[#3B6D11]':'bg-[#F1F5F9]'}`}/>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-[#E2E8F0]">
            <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
            <span className="text-[11px] font-bold text-[#3B6D11]">할 일 열기 →</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── 모니터 모양 카드 (대시보드) ──────────────────────────
function DashboardShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-white overflow-hidden hover:shadow-md transition-shadow" style={{
        borderRadius: '12px 12px 4px 4px',
        border: '2px solid #854F0B'
      }}>
        {/* 모니터 상단 바 */}
        <div className="bg-[#854F0B] px-4 py-2 flex items-center justify-between">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white/30"/>
            <div className="w-2 h-2 rounded-full bg-white/30"/>
            <div className="w-2 h-2 rounded-full bg-white/30"/>
          </div>
          <span className={`text-[12px] font-black ${dday==='D-DAY'?'text-[#FFD700]':'text-white/80'}`}>{dday}</span>
        </div>
        {/* 화면 내용 */}
        <div className="px-4 py-3">
          <div className="text-[13px] font-bold text-[#1A1A2E] truncate mb-2">{project.name}</div>
          <div className="flex flex-col gap-1">
            {[{w:'75%',c:'#185FA5'},{w:'50%',c:'#3B6D11'},{w:'20%',c:'#E24B4A'}].map((b,i) => (
              <div key={i} className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{width:b.w,background:b.c}}/>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
            <span className="text-[11px] font-bold text-[#854F0B]">현황판 열기 →</span>
          </div>
        </div>
        {/* 모니터 받침 */}
        <div className="flex justify-center pb-2">
          <div className="w-8 h-1.5 bg-[#FAEEDA] rounded-full"/>
        </div>
      </div>
    </button>
  )
}

function ProjectSelectCard({ project, nextTab, onClick }: {
  project: Project; nextTab: string | null; onClick: () => void
}) {
  if (nextTab === 'timeline')  return <TimelineShapeCard  project={project} onClick={onClick}/>
  if (nextTab === 'comms')     return <CommsShapeCard     project={project} onClick={onClick}/>
  if (nextTab === 'ptt')       return <PTTShapeCard       project={project} onClick={onClick}/>
  if (nextTab === 'my-part')   return <MyPartShapeCard    project={project} onClick={onClick}/>
  if (nextTab === 'dashboard') return <DashboardShapeCard project={project} onClick={onClick}/>
  return null
}

// 기본 카드 (프로젝트 직접 진입)
function DefaultCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const isLive = project.status === 'live'
  const statusLabel: Record<Project['status'], string> = { planning:'기획 중', ready:'준비 중', live:'진행 중', done:'완료' }
  const statusStyle: Record<Project['status'], string> = {
    planning:'bg-[#F1EFE8] text-[#5F5E5A]', ready:'bg-[#E6F1FB] text-[#185FA5]',
    live:'bg-[#EAF3DE] text-[#3B6D11]', done:'bg-[#F1EFE8] text-[#A0AEC0]',
  }
  return (
    <button onClick={onClick}
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
          </div>
        </div>
        <div className={`text-[22px] font-black flex-shrink-0 ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#185FA5]'}`}>{dday}</div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold tracking-widest text-[#185FA5]">{project.joinCode}</span>
        <span className="text-[12px] text-[#185FA5] font-semibold flex items-center gap-1">이어서 작업하기 <i className="ti ti-arrow-right"/></span>
      </div>
    </button>
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

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-24">

        {/* 탭별 임팩트 헤더 */}
        {nextTab === 'timeline'  && <TimelineHeader />}
        {nextTab === 'my-part'   && <MyPartHeader />}
        {nextTab === 'dashboard' && <DashboardHeader />}
        {nextTab === 'comms'     && <CommsHeader />}
        {nextTab === 'ptt'       && <PTTHeader />}

        {/* 기본 헤더 */}
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
            {projects.map(project => nextTab
              ? <ProjectSelectCard key={project.id} project={project} nextTab={nextTab} onClick={() => goToProject(project.id)}/>
              : <DefaultCard key={project.id} project={project} onClick={() => goToProject(project.id)}/>
            )}
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
