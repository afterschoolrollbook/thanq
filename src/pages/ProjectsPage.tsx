import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ref, onValue } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { getDday } from '@/utils/joinCode'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Project, Part } from '@/types'

// ── 탭별 헤더 (임팩트 있게) ──────────────────────────────
function TimelineHeader() {
  return (
    <div className="mb-5 rounded-[16px] overflow-hidden border border-[#B5D4F4]">
      <div className="bg-[#E6F1FB] px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-[10px] bg-[#185FA5] flex items-center justify-center">
            <i className="ti ti-timeline text-white text-[17px]"/>
          </div>
          <div>
            <div className="text-[#1A1A2E] text-[15px] font-bold">일정표</div>
            <div className="text-[#185FA5] text-[11px]">팀별 · 시간대별 운영 일정</div>
          </div>
        </div>
        <div className="flex gap-1 mt-2 overflow-hidden rounded-[10px] bg-white p-2 border border-[#D1E8F8]">
          <div className="flex flex-col gap-1 flex-shrink-0 mr-1">
            {['07:00','07:30','08:00','08:30'].map(t => (
              <div key={t} className="h-6 flex items-center"><span className="text-[9px] font-bold text-[#94A3B8]">{t}</span></div>
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
      <div className="bg-[#185FA5] px-5 py-2 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/80 text-[12px]"/>
        <span className="text-white text-[11px]">아래 프로젝트를 선택하면 일정표가 열려요</span>
      </div>
    </div>
  )
}

function MyPartHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#EAF3DE] px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#3B6D11] flex items-center justify-center">
            <i className="ti ti-checklist text-white text-[17px]"/>
          </div>
          <div>
            <div className="text-[#1A1A2E] text-[15px] font-bold">내 할 일</div>
            <div className="text-[#3B6D11] text-[11px]">내가 담당한 파트의 체크리스트</div>
          </div>
        </div>
        {/* 기능 설명 */}
        <div className="bg-white rounded-[10px] p-3 border border-[#C6E8A8] flex flex-col gap-2">
          {[
            {icon:'ti-circle-check', text:'내가 맡은 역할과 할 일 목록을 확인해요', color:'#3B6D11'},
            {icon:'ti-checkbox', text:'완료한 항목을 체크하면 팀 현황에 반영돼요', color:'#3B6D11'},
            {icon:'ti-bell', text:'담당 파트에 새 할 일이 추가되면 알림이 와요', color:'#3B6D11'},
          ].map((item,i) => (
            <div key={i} className="flex items-start gap-2">
              <i className={`ti ${item.icon} text-[13px] mt-0.5 flex-shrink-0`} style={{color:item.color}}/>
              <span className="text-[11px] text-[#1A1A2E] font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#3B6D11] px-5 py-2 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 내 할 일이 열려요</span>
      </div>
    </div>
  )
}

function DashboardHeader({ allParts }: { allParts: Record<string, Part[]> }) {
  // 전체 프로젝트의 parts 합산
  const parts = Object.values(allParts).flat()
  const progress = parts.length ? Math.round(parts.reduce((s,p) => s + p.progress, 0) / parts.length) : 0
  const ongoing = parts.filter(p => p.status === 'ongoing').length
  const delay   = parts.filter(p => p.status === 'delay').length
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#F1F4F8] px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-[12px] bg-[#E2E8F0] flex items-center justify-center">
            <i className="ti ti-layout-dashboard text-[#475569] text-[20px]"/>
          </div>
          <div>
            <div className="text-[#1A1A2E] text-[15px] font-bold">본부 현황판</div>
            <div className="text-[#475569] text-[11px]">전체 준비율 · 파트별 진행 상태</div>
          </div>
        </div>
        <div className="bg-white rounded-[10px] p-3 border border-[#E2E8F0]">
          <div className="flex gap-3 mb-2">
            {[
              {label:'전체 준비율', value:`${progress}%`, color:'#475569'},
              {label:'진행 중',     value:`${ongoing}팀`,  color:'#3B6D11'},
              {label:'지연',        value:`${delay}팀`,    color:'#E24B4A'},
            ].map(s => (
              <div key={s.label} className="flex-1 text-center">
                <div className="text-[15px] font-black" style={{color:s.color}}>{s.value}</div>
                <div className="text-[9px] text-[#A0AEC0] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#475569] rounded-full transition-all" style={{width:`${progress}%`}}/>
          </div>
        </div>
      </div>
      <div className="bg-[#475569] px-5 py-2 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 현황판이 열려요</span>
      </div>
    </div>
  )
}

function CommsHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#EDE9FE] px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center flex-shrink-0">
            <i className="ti ti-speakerphone text-white text-[17px]"/>
          </div>
          <div>
            <div className="text-[#1A1A2E] text-[15px] font-bold">공지 · 연락</div>
            <div className="text-[#7C3AED] text-[11px]">팀 전체에 공지 · 긴급 연락 · 미팅 안내</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 bg-white/10 rounded-[10px] p-3">
          {[{type:'긴급',color:'#FCA5A5',text:'A그룹 집결지 변경 안내'},{type:'일반',color:'#93C5FD',text:'준비물 최종 점검 완료'}].map((n,i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{background:n.color+'33',color:n.color}}>{n.type}</span>
              <span className="text-[11px] text-[#1A1A2E] truncate">{n.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#7C3AED] px-5 py-2 flex items-center gap-1.5">
        <i className="ti ti-hand-click text-white/70 text-[12px]"/>
        <span className="text-white text-[11px] font-semibold">아래 프로젝트를 선택하면 공지 채널이 열려요</span>
      </div>
    </div>
  )
}

function PTTHeader() {
  return (
    <div className="mb-6 rounded-[20px] overflow-hidden shadow-md">
      <div className="bg-[#EDF7F1] px-5 pt-4 pb-3 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-16 bg-[#D4EFE1] rounded-[12px] border-2 border-[#A8D9BE] flex flex-col items-center justify-between py-2 px-2 gap-2">
            <div className="w-full h-5 bg-[#EAEEF2] rounded-[4px] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
            </div>
            <div className="w-9 h-9 rounded-full border-[3px] border-[#E24B4A] bg-white flex items-center justify-center">
              <i className="ti ti-microphone text-[16px] text-[#3B7A57]"/>
            </div>
            <div className="w-full flex gap-1">
              <div className="flex-1 h-1.5 bg-[#A8D9BE] rounded-full"/>
              <div className="flex-1 h-1.5 bg-[#A8D9BE] rounded-full"/>
            </div>
          </div>
          <div className="absolute -right-1 top-3 w-1.5 h-7 bg-[#E24B4A] rounded-r-full"/>
        </div>
        <div>
          <div className="text-[#1A2E22] text-[17px] font-black mb-1">무전</div>
          <div className="text-[#3B7A57] text-[11px] leading-relaxed">버튼을 누르고 말하면<br/>담당자에게 즉시 전달돼요</div>
          <div className="flex gap-1.5 mt-2">
            {['운영팀','포토팀','안전팀'].map(t=>(
              <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-[#D4EFE1] text-[#3B7A57] border border-[#A8D9BE]">{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#3B7A57] px-5 py-2 flex items-center gap-1.5">
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
    <button onClick={onClick} className="w-full hover:scale-[1.03] transition-transform">
      <div className="bg-white rounded-[10px] overflow-hidden border border-[#B5D4F4] hover:shadow-md transition-shadow">
        {/* 달력 고리 */}
        <div className="flex justify-around px-3">
          <div className="w-2 h-1.5 rounded-b-full border-x border-b border-[#B5D4F4] bg-[#F8FAFC]"/>
          <div className="w-2 h-1.5 rounded-b-full border-x border-b border-[#B5D4F4] bg-[#F8FAFC]"/>
        </div>
        {/* 헤더 */}
        <div className="bg-[#E6F1FB] px-2 py-1 flex items-center justify-between">
          <span className="text-[#185FA5] font-bold text-[9px]">{d.getMonth()+1}월</span>
          <span className={`text-[8px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#185FA5]'}`}>{dday}</span>
        </div>
        {/* 날짜 - 높이 키움 */}
        <div className="px-2 py-4 text-center">
          <div className="text-[28px] font-black text-[#185FA5] leading-none">{d.getDate()}</div>
          <div className="text-[8px] text-[#A0AEC0] mt-1">{d.getFullYear()}</div>
        </div>
        <div className="mx-2 border-t border-dashed border-[#E2E8F0]"/>
        {/* 프로젝트명 */}
        <div className="px-2 py-2">
          <div className="text-[9px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
          <div className="text-[8px] text-[#185FA5] mt-0.5">열기 →</div>
        </div>
      </div>
    </button>
  )
}

// ── 아이콘 뷰 소형 카드들 ────────────────────────────────
function CommsIconCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.03] transition-transform">
      <div className="bg-white rounded-[10px] overflow-hidden border border-[#DDD6FE] hover:shadow-md transition-shadow">
        <div className="bg-[#EDE9FE] px-2 py-1 flex items-center justify-between">
          <i className="ti ti-speakerphone text-[#7C3AED] text-[10px]"/>
          <span className={`text-[8px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#7C3AED]'}`}>{dday}</span>
        </div>
        {/* 날짜 + 이름 먼저 위에 */}
        <div className="px-2 pt-2 pb-1 text-center">
          <div className="text-[24px] font-black text-[#7C3AED] leading-none">{d.getDate()}</div>
          <div className="text-[8px] font-black text-[#1A1A2E] mt-0.5 truncate leading-tight">{project.name}</div>
        </div>
        {/* 스피커 원형 — 작게 아래 배치 */}
        <div className="flex justify-center pb-1.5">
          <div className="w-[38px] h-[38px] rounded-full bg-[#EDE9FE] border-2 border-[#DDD6FE] flex items-center justify-center relative">
            <div className="w-[24px] h-[24px] rounded-full bg-[#C4B5FD] border-[1.5px] border-[#A78BFA] flex items-center justify-center">
              <div className="w-[10px] h-[10px] rounded-full bg-[#7C3AED]"/>
            </div>
            <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 flex flex-col gap-[2px]">
              <div className="w-[3px] h-[2px] rounded bg-[#7C3AED] opacity-40"/>
              <div className="w-[4px] h-[2px] rounded bg-[#7C3AED] opacity-70"/>
              <div className="w-[3px] h-[2px] rounded bg-[#7C3AED] opacity-40"/>
            </div>
            <div className="absolute right-[-5px] top-1/2 -translate-y-1/2 flex flex-col gap-[2px]">
              <div className="w-[3px] h-[2px] rounded bg-[#7C3AED] opacity-40"/>
              <div className="w-[4px] h-[2px] rounded bg-[#7C3AED] opacity-70"/>
              <div className="w-[3px] h-[2px] rounded bg-[#7C3AED] opacity-40"/>
            </div>
          </div>
        </div>
        <div className="mx-2 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-2 py-1.5">
          <div className="text-[8px] text-[#7C3AED]">열기 →</div>
        </div>
      </div>
    </button>
  )
}

function PTTIconCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.03] transition-transform">
      <div className="bg-[#F0FAF4] rounded-[10px] overflow-hidden border border-[#A8D9BE] hover:shadow-md transition-shadow">
        {/* 안테나 */}
        <div className="flex justify-around px-3">
          <div className="w-1.5 h-2 rounded-b-full bg-[#E24B4A]"/>
          <div className="w-1.5 h-2 rounded-b-full bg-[#A8D9BE]"/>
        </div>
        <div className="bg-[#D4EFE1] px-2 py-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
            <span className="text-[8px] font-bold text-[#3B7A57]">무전</span>
          </div>
          <span className={`text-[8px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#3B7A57]'}`}>{dday}</span>
        </div>
        {/* 날짜 + 이름 + 무전기 몸통 */}
        <div className="px-1.5 pt-1.5 pb-1 relative">
          <div className="text-[24px] font-black text-[#3B7A57] leading-none text-center">{d.getDate()}</div>
          <div className="text-[8px] font-black text-[#1A1A2E] mt-0.5 truncate text-center leading-tight">{project.name}</div>
          {/* 무전기 몸통 */}
          <div className="mt-1.5 mx-auto relative" style={{width:'52px'}}>
            {/* 옆 버튼 */}
            <div className="absolute -left-[5px] top-[6px] w-[5px] h-[14px] bg-[#E24B4A] rounded-l-full"/>
            <div className="absolute -right-[5px] top-[6px] w-[5px] h-[10px] bg-[#A8D9BE] rounded-r-full"/>
            {/* 본체 */}
            <div className="w-full bg-[#D4EFE1] rounded-[8px] border border-[#A8D9BE] flex flex-col items-center py-1.5 gap-1">
              {/* 스크린 */}
              <div className="w-[38px] h-[10px] bg-[#0F2015] rounded-[3px] flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
              </div>
              {/* PTT 버튼 크게 */}
              <div className="w-[32px] h-[32px] rounded-full bg-[#E24B4A] border-[2.5px] border-[#FF8080] flex items-center justify-center shadow-md">
                <i className="ti ti-microphone text-[14px] text-white"/>
              </div>
              {/* 스피커 그릴 */}
              <div className="flex flex-col gap-[2px] w-[32px]">
                <div className="h-[2px] bg-[#A8D9BE] rounded-full"/>
                <div className="h-[2px] bg-[#A8D9BE] rounded-full w-3/4 mx-auto"/>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-2 border-t border-dashed border-[#A8D9BE]"/>
        <div className="px-2 py-1.5">
          <div className="text-[8px] text-[#3B7A57]">열기 →</div>
        </div>
      </div>
    </button>
  )
}

function MyPartIconCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.03] transition-transform">
      <div className="bg-white rounded-[10px] overflow-hidden border border-[#C6E8A8] hover:shadow-md transition-shadow">
        {/* 노트 구멍 3개 */}
        <div className="flex justify-around px-2">
          <div className="w-2 h-1.5 rounded-b-full border-x border-b border-[#C6E8A8] bg-[#F8FAFC]"/>
          <div className="w-2 h-1.5 rounded-b-full border-x border-b border-[#C6E8A8] bg-[#F8FAFC]"/>
          <div className="w-2 h-1.5 rounded-b-full border-x border-b border-[#C6E8A8] bg-[#F8FAFC]"/>
        </div>
        <div className="bg-[#EAF3DE] px-2 py-1 flex items-center justify-between">
          <i className="ti ti-notes text-[#3B6D11] text-[10px]"/>
          <span className={`text-[8px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#3B6D11]'}`}>{dday}</span>
        </div>
        <div className="px-2 pt-2 pb-1 text-center">
          <div className="text-[26px] font-black text-[#3B6D11] leading-none">{d.getDate()}</div>
          <div className="text-[9px] font-black text-[#1A1A2E] mt-0.5 truncate leading-tight">{project.name}</div>
        </div>
        <div className="px-2 pb-1 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-[2px] bg-[#3B6D11] flex-shrink-0"/>
            <div className="h-[3px] flex-1 bg-[#C6E8A8] rounded-full opacity-60"/>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-[2px] border border-[#C6E8A8] flex-shrink-0"/>
            <div className="h-[3px] flex-1 bg-[#E2E8F0] rounded-full"/>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-[2px] border border-[#C6E8A8] flex-shrink-0"/>
            <div className="h-[3px] w-3/4 bg-[#E2E8F0] rounded-full"/>
          </div>
        </div>
        <div className="mx-2 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-2 py-1.5">
          <div className="text-[8px] text-[#3B6D11]">열기 →</div>
        </div>
      </div>
    </button>
  )
}

function DashboardIconCard({ project, parts, onClick }: { project: Project; parts: Part[]; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  const progress = parts.length ? Math.round(parts.reduce((s,p) => s + p.progress, 0) / parts.length) : 0
  const progressColor = progress >= 70 ? '#4CAF50' : progress >= 40 ? '#FDE68A' : '#E24B4A'
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.03] transition-transform">
      <div className="bg-white rounded-[10px] overflow-hidden border border-[#CBD5E1] hover:shadow-md transition-shadow">
        <div className="bg-[#F1F4F8] px-2 py-1 flex items-center justify-between">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"/>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FDE68A]"/>
            <div className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]"/>
          </div>
          <span className={`text-[8px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#475569]'}`}>{dday}</span>
        </div>
        <div className="px-2 pt-2 pb-1 text-center">
          <div className="text-[28px] font-black text-[#475569] leading-none">{d.getDate()}</div>
          <div className="text-[8px] font-black text-[#1A1A2E] mt-0.5 truncate leading-tight">{project.name}</div>
        </div>
        <div className="px-2 pb-2">
          <div className="flex justify-between mb-0.5">
            <span className="text-[7px] text-[#94A3B8]">준비율</span>
            <span className="text-[7px] font-black" style={{color:progressColor}}>{progress}%</span>
          </div>
          <div className="h-[4px] bg-[#E2E8F0] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{width:`${progress}%`, background:progressColor}}/>
          </div>
        </div>
        <div className="mx-2 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-2 py-1.5">
          <div className="text-[8px] text-[#475569]">열기 →</div>
        </div>
      </div>
    </button>
  )
}

// ── 소통 카드 (확성기/스피커) ────────────────────────────
function CommsShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-white rounded-[14px] overflow-hidden border border-[#DDD6FE] hover:shadow-md transition-shadow">
        <div className="bg-[#EDE9FE] px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <i className="ti ti-speakerphone text-[#7C3AED] text-[12px]"/>
            <span className="text-[#7C3AED] font-bold text-[10px]">공지 · 연락</span>
          </div>
          <span className={`text-[11px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#7C3AED]'}`}>{dday}</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="text-[32px] font-black text-[#7C3AED] leading-none flex-shrink-0">{d.getDate()}</div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1"><i className="ti ti-map-pin text-[10px]"/>{project.venue}</div>}
          </div>
          {/* 스피커 원형 미니 */}
          <div className="flex-shrink-0 w-[42px] h-[42px] rounded-full bg-[#EDE9FE] border-2 border-[#DDD6FE] flex items-center justify-center relative">
            <div className="w-[27px] h-[27px] rounded-full bg-[#C4B5FD] border-[1.5px] border-[#A78BFA] flex items-center justify-center">
              <div className="w-[11px] h-[11px] rounded-full bg-[#7C3AED]"/>
            </div>
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 flex flex-col gap-[2px]">
              <div className="w-[4px] h-[2px] rounded bg-[#7C3AED] opacity-40"/>
              <div className="w-[5px] h-[2px] rounded bg-[#7C3AED] opacity-70"/>
              <div className="w-[4px] h-[2px] rounded bg-[#7C3AED] opacity-40"/>
            </div>
          </div>
        </div>
        <div className="mx-4 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-[#7C3AED]">채널 열기 →</span>
        </div>
      </div>
    </button>
  )
}

// ── 무전 카드 (워키토키) ──────────────────────────────────
function PTTShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-[#F0FAF4] rounded-[14px] overflow-hidden border border-[#A8D9BE] hover:shadow-md transition-shadow">
        {/* 안테나 */}
        <div className="flex justify-around px-10">
          <div className="w-1.5 h-3 rounded-b-full bg-[#E24B4A]"/>
          <div className="w-1.5 h-3 rounded-b-full bg-[#A8D9BE]"/>
        </div>
        <div className="bg-[#D4EFE1] px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] animate-pulse"/>
            <span className="text-[#3B7A57] font-bold text-[10px]">무전</span>
          </div>
          <span className={`text-[11px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#3B7A57]'}`}>{dday}</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="text-[32px] font-black text-[#3B7A57] leading-none flex-shrink-0">{d.getDate()}</div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-bold text-[#1A2E22] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1"><i className="ti ti-map-pin text-[10px]"/>{project.venue}</div>}
          </div>
          {/* PTT 버튼 */}
          <div className="flex-shrink-0 w-[36px] h-[36px] rounded-full bg-[#E24B4A] border-2 border-[#FF8080] flex items-center justify-center">
            <i className="ti ti-microphone text-[15px] text-white"/>
          </div>
        </div>
        <div className="mx-4 border-t border-dashed border-[#A8D9BE]"/>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#6BBF8E]">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-[#3B7A57]">무전 연결 →</span>
        </div>
      </div>
    </button>
  )
}

// ── 내 파트 카드 (메모장/노트) ────────────────────────────
function MyPartShapeCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-white rounded-[14px] overflow-hidden border border-[#C6E8A8] hover:shadow-md transition-shadow">
        {/* 노트 구멍 3개 */}
        <div className="flex justify-around px-8">
          <div className="w-3 h-2.5 rounded-b-full border-x border-b border-[#C6E8A8] bg-[#F8FAFC]"/>
          <div className="w-3 h-2.5 rounded-b-full border-x border-b border-[#C6E8A8] bg-[#F8FAFC]"/>
          <div className="w-3 h-2.5 rounded-b-full border-x border-b border-[#C6E8A8] bg-[#F8FAFC]"/>
        </div>
        <div className="bg-[#EAF3DE] px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <i className="ti ti-notes text-[#3B6D11] text-[12px]"/>
            <span className="text-[#3B6D11] font-bold text-[10px]">내 할 일</span>
          </div>
          <span className={`text-[11px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#3B6D11]'}`}>{dday}</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="text-[32px] font-black text-[#3B6D11] leading-none flex-shrink-0">{d.getDate()}</div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1"><i className="ti ti-map-pin text-[10px]"/>{project.venue}</div>}
          </div>
          {/* 체크리스트 미니 */}
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] bg-[#3B6D11]"/><div className="w-8 h-[3px] bg-[#C6E8A8] rounded-full opacity-60"/></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] border border-[#C6E8A8]"/><div className="w-8 h-[3px] bg-[#E2E8F0] rounded-full"/></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px] border border-[#C6E8A8]"/><div className="w-6 h-[3px] bg-[#E2E8F0] rounded-full"/></div>
          </div>
        </div>
        <div className="mx-4 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-[#3B6D11]">할 일 열기 →</span>
        </div>
      </div>
    </button>
  )
}

// ── 대시보드 카드 (현황판) ────────────────────────────────
function DashboardShapeCard({ project, parts, onClick }: { project: Project; parts: Part[]; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  const progress = parts.length ? Math.round(parts.reduce((s,p) => s + p.progress, 0) / parts.length) : 0
  const ongoing  = parts.filter(p => p.status === 'ongoing').length
  const delay    = parts.filter(p => p.status === 'delay').length
  const progressColor = progress >= 70 ? '#4CAF50' : progress >= 40 ? '#E8820C' : '#E24B4A'
  // 상위 3개 파트만 바로 표시
  const topParts = parts.slice(0, 3)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.02] transition-transform">
      <div className="relative bg-white rounded-[14px] overflow-hidden border border-[#CBD5E1] hover:shadow-md transition-shadow">
        <div className="bg-[#F1F4F8] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#4CAF50]"/>
              <div className="w-2 h-2 rounded-full bg-[#FDE68A]"/>
              <div className="w-2 h-2 rounded-full bg-[#CBD5E1]"/>
            </div>
            <span className="text-[#475569] font-bold text-[10px]">현황판</span>
            {delay > 0 && <span className="text-[9px] font-bold text-white bg-[#E24B4A] px-1.5 py-0.5 rounded-full">지연 {delay}</span>}
          </div>
          <span className={`text-[11px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#475569]'}`}>{dday}</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="text-[32px] font-black text-[#475569] leading-none flex-shrink-0">{d.getDate()}</div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1"><i className="ti ti-map-pin text-[10px]"/>{project.venue}</div>}
            <div className="flex gap-2 mt-1.5">
              {topParts.length > 0 ? topParts.map(p => (
                <div key={p.id} className="flex-1">
                  <div className="text-[7px] text-[#94A3B8] mb-0.5 truncate">{p.name}</div>
                  <div className="h-[3px] bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{width:`${p.progress}%`, background: p.status==='delay'?'#E24B4A': p.status==='done'?'#4CAF50':'#475569'}}/>
                  </div>
                </div>
              )) : (
                <div className="flex-1">
                  <div className="h-[3px] bg-[#E2E8F0] rounded-full"/>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[18px] font-black" style={{color:progressColor}}>{progress}%</div>
            <div className="text-[8px] text-[#94A3B8]">준비율</div>
            {ongoing > 0 && <div className="text-[8px] font-bold text-[#3B6D11] mt-0.5">{ongoing}팀 진행</div>}
          </div>
        </div>
        <div className="mx-4 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-[#475569]">현황판 열기 →</span>
        </div>
      </div>
    </button>
  )
}


function ProjectSelectCard({ project, nextTab, parts, onClick }: {
  project: Project; nextTab: string | null; parts: Part[]; onClick: () => void
}) {
  if (nextTab === 'comms')     return <CommsShapeCard     project={project} onClick={onClick}/>
  if (nextTab === 'ptt')       return <PTTShapeCard       project={project} onClick={onClick}/>
  if (nextTab === 'my-part')   return <MyPartShapeCard    project={project} onClick={onClick}/>
  if (nextTab === 'dashboard') return <DashboardShapeCard project={project} parts={parts} onClick={onClick}/>

  // 타임라인 리스트 뷰 + 기본 = 슬림 달력형
  const dday = getDday(project.date)
  const d = new Date(project.date)
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.01] transition-transform">
      <div className="relative bg-white rounded-[14px] overflow-hidden border border-[#B5D4F4] hover:shadow-md transition-shadow">
        {/* 달력 고리 2개 */}
        <div className="absolute top-0 left-0 right-0 flex justify-around px-10">
          <div className="w-3.5 h-2.5 rounded-b-full border-x border-b border-[#B5D4F4] bg-[#F4F6F9]"/>
          <div className="w-3.5 h-2.5 rounded-b-full border-x border-b border-[#B5D4F4] bg-[#F4F6F9]"/>
        </div>
        {/* 헤더 */}
        <div className="bg-[#E6F1FB] pt-2.5 pb-1.5 px-4 flex items-center justify-between">
          <span className="text-[#64748B] text-[10px]">{d.getFullYear()}년 <span className="font-bold text-[#185FA5]">{d.getMonth()+1}월</span></span>
          <span className={`text-[11px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#185FA5]'}`}>{dday}</span>
        </div>
        {/* 날짜 + 내용 한 줄 */}
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="text-[32px] font-black text-[#185FA5] leading-none flex-shrink-0">{d.getDate()}</div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1"><i className="ti ti-map-pin text-[10px]"/>{project.venue}</div>}
          </div>
        </div>
        {/* 하단 */}
        <div className="mx-4 border-t border-dashed border-[#E2E8F0]"/>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#A0AEC0]">{project.joinCode}</span>
          <span className="text-[11px] font-bold text-[#185FA5]">일정표 열기 →</span>
        </div>
      </div>
    </button>
  )
}

// 기본 카드 (프로젝트 직접 진입) — 티켓 입장권 디자인
function DefaultCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  const isLive = project.status === 'live'
  const statusLabel: Record<Project['status'], string> = { planning:'기획 중', ready:'준비 중', live:'진행 중', done:'완료' }
  const statusColor: Record<Project['status'], string> = {
    planning:'bg-[#F1EFE8] text-[#5F5E5A]',
    ready:'bg-[#FEF3E2] text-[#E8820C]',
    live:'bg-[#EAF3DE] text-[#3B6D11]',
    done:'bg-[#F1EFE8] text-[#A0AEC0]',
  }
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.01] transition-transform text-left">
      <div className={`relative bg-white rounded-[14px] overflow-hidden hover:shadow-md transition-shadow border-[1.5px] ${isLive?'border-[#E8820C]':'border-[#F4D7A8]'}`}>
        {/* 티켓 헤더 */}
        <div className={`px-4 py-2 flex items-center justify-between ${isLive?'bg-[#FEF3E2]':'bg-[#FFF8F0]'}`}>
          <div className="flex items-center gap-2">
            {isLive && <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-[#E24B4A] px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block"/>LIVE</span>}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[project.status]}`}>{statusLabel[project.status]}</span>
          </div>
          <span className={`text-[12px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#E8820C]'}`}>{dday}</span>
        </div>
        {/* 절취선 위 */}
        <div className="relative flex items-center h-[14px]">
          <div className="absolute -left-[7px] w-[14px] h-[14px] rounded-full bg-[#F4F6F9] border-[1.5px] border-[#F4D7A8]"/>
          <div className="flex-1 border-t-2 border-dashed border-[#F4D7A8] mx-1"/>
          <div className="absolute -right-[7px] w-[14px] h-[14px] rounded-full bg-[#F4F6F9] border-[1.5px] border-[#F4D7A8]"/>
        </div>
        {/* 본문 */}
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="flex-shrink-0 text-center">
            <div className={`text-[36px] font-black leading-none ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#E8820C]'}`}>{d.getDate()}</div>
            <div className="text-[10px] text-[#94A3B8] font-semibold">{d.getMonth()+1}월 {d.getFullYear()}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#1A1A2E] truncate">{project.name}</div>
            {project.venue && <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5"><i className="ti ti-map-pin text-[11px]"/>{project.venue}</div>}
          </div>
          {/* 도장 */}
          <div className="flex-shrink-0 w-[38px] h-[38px] rounded-full border-2 border-[#E8820C] flex items-center justify-center opacity-40 rotate-[-12deg]">
            <span className="text-[6px] font-black text-[#E8820C] text-center leading-tight">PRJ<br/>2026</span>
          </div>
        </div>
        {/* 절취선 아래 */}
        <div className="relative flex items-center h-[14px]">
          <div className="absolute -left-[7px] w-[14px] h-[14px] rounded-full bg-[#F4F6F9] border-[1.5px] border-[#F4D7A8]"/>
          <div className="flex-1 border-t-2 border-dashed border-[#F4D7A8] mx-1"/>
          <div className="absolute -right-[7px] w-[14px] h-[14px] rounded-full bg-[#F4F6F9] border-[1.5px] border-[#F4D7A8]"/>
        </div>
        {/* 하단 */}
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] font-mono font-black tracking-widest text-[#E8820C]">{project.joinCode}</span>
          <span className="text-[12px] text-[#E8820C] font-semibold flex items-center gap-1">이어서 작업하기 <i className="ti ti-arrow-right"/></span>
        </div>
      </div>
    </button>
  )
}

// ── 프로젝트 탭 아이콘형 카드 (티켓 배지 오렌지) ──────────
function DefaultIconCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const dday = getDday(project.date)
  const d = new Date(project.date)
  const isLive = project.status === 'live'
  return (
    <button onClick={onClick} className="w-full hover:scale-[1.03] transition-transform">
      <div className={`rounded-[10px] overflow-hidden bg-white hover:shadow-md transition-shadow border-[1.5px] ${isLive?'border-[#E8820C]':'border-[#F4D7A8]'}`}>
        {/* 헤더 */}
        <div className={`px-2 py-1 flex items-center justify-between ${isLive?'bg-[#FEF3E2]':'bg-[#FFF8F0]'}`}>
          {isLive
            ? <span className="flex items-center gap-0.5 text-[7px] font-semibold text-white bg-[#E24B4A] px-1.5 py-0.5 rounded-full"><span className="w-1 h-1 rounded-full bg-white animate-pulse inline-block"/>LIVE</span>
            : <div className="w-1.5 h-1.5 rounded-full bg-[#F4D7A8]"/>
          }
          <span className={`text-[8px] font-black ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#E8820C]'}`}>{dday}</span>
        </div>
        {/* 절취선 */}
        <div className="relative flex items-center h-[10px]">
          <div className="absolute -left-[5px] w-[10px] h-[10px] rounded-full bg-[#F4F6F9] border border-[#F4D7A8]"/>
          <div className="flex-1 border-t-[1.5px] border-dashed border-[#F4D7A8] mx-1"/>
          <div className="absolute -right-[5px] w-[10px] h-[10px] rounded-full bg-[#F4F6F9] border border-[#F4D7A8]"/>
        </div>
        {/* 날짜 + 도장 + 이름 */}
        <div className="px-2 pt-2 pb-1 text-center relative">
          <div className={`text-[26px] font-black leading-none ${dday==='D-DAY'?'text-[#E24B4A]':'text-[#E8820C]'}`}>{d.getDate()}</div>
          <div className="text-[7px] text-[#94A3B8] mt-0.5">{d.getMonth()+1}월</div>
          <div className="text-[8px] font-bold text-[#1A1A2E] mt-1 truncate">{project.name}</div>
          {/* 도장 */}
          <div className="absolute top-1 right-1 w-[26px] h-[26px] rounded-full border-2 border-[#E8820C] flex items-center justify-center opacity-40 rotate-[-12deg]">
            <span className="text-[6px] font-black text-[#E8820C] leading-tight text-center">PRJ<br/>26</span>
          </div>
        </div>
        {/* 절취선 */}
        <div className="relative flex items-center h-[10px]">
          <div className="absolute -left-[5px] w-[10px] h-[10px] rounded-full bg-[#F4F6F9] border border-[#F4D7A8]"/>
          <div className="flex-1 border-t-[1.5px] border-dashed border-[#F4D7A8] mx-1"/>
          <div className="absolute -right-[5px] w-[10px] h-[10px] rounded-full bg-[#F4F6F9] border border-[#F4D7A8]"/>
        </div>
        <div className="px-2 py-1.5">
          <div className="text-[7px] font-mono font-bold text-[#E8820C] tracking-widest truncate">{project.joinCode}</div>
        </div>
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
  const [allParts, setAllParts] = useState<Record<string, Part[]>>({})
  const [loading, setLoading] = useState(true)
  const [showJoinInput, setShowJoinInput] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  const nextTab = new URLSearchParams(location.search).get('next')
  const [viewMode, setViewMode] = useState<'icon'|'list'>('icon')

  function goToProject(projectId: string) {
    navigate(`/p/${projectId}/${nextTab ?? 'home'}`)
  }

  useEffect(() => {
    if (!user) return
    const unsub = onValue(ref(db, 'projects'), (snap) => {
      if (snap.exists()) {
        const all: Project[] = Object.values(snap.val())
        const mine = all.filter(p => p.ownerId === user.uid).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setProjects(mine)
        // 각 프로젝트의 parts 구독
        mine.forEach(p => {
          onValue(ref(db, `parts/${p.id}`), (s) => {
            const parts: Part[] = s.exists() ? Object.values(s.val()) : []
            setAllParts(prev => ({ ...prev, [p.id]: parts }))
          })
        })
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
        {nextTab === 'dashboard' && <DashboardHeader allParts={allParts} />}
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
                className="h-[38px] px-4 bg-[#E8820C] text-white rounded-[10px] flex items-center gap-1.5 text-[13px] font-semibold">
                <i className="ti ti-plus text-[14px]" /> 새 프로젝트
              </button>
            </div>
            <div className="mb-4">
              {!showJoinInput ? (
                <button onClick={() => setShowJoinInput(true)}
                  className="w-full bg-white border border-[#F4D7A8] rounded-[12px] px-4 py-3 flex items-center gap-3 hover:border-[#E8820C] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#FFF8F0] flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-key text-[#E8820C] text-[16px]" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-[13px] font-semibold">참여 코드로 입장</div>
                    <div className="text-[11px] text-[#64748B]">초대받은 프로젝트에 참여하기</div>
                  </div>
                  <i className="ti ti-chevron-right text-[#E8820C]" />
                </button>
              ) : (
                <div className="bg-white border-2 border-[#E8820C] rounded-[12px] px-4 py-3 flex items-center gap-2">
                  <input className="flex-1 text-[14px] font-bold tracking-widest text-[#E8820C] outline-none placeholder-[#F4D7A8]"
                    placeholder="참여 코드 6자리" value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} autoFocus />
                  <button onClick={() => setShowJoinInput(false)} className="text-[#A0AEC0] text-[12px]">취소</button>
                  <button className="h-[32px] px-3 bg-[#E8820C] text-white rounded-[8px] text-[12px] font-semibold">입장</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* 뷰 전환 버튼 - 모든 탭 + 프로젝트 탭 포함 */}
        {projects.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-[#64748B]">{viewMode === 'icon' ? '아이콘 보기' : '리스트 보기'}</span>
            <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-[10px] p-1">
              {(() => {
                const activeColor = !nextTab ? 'bg-[#E8820C]'
                  : nextTab==='my-part' ? 'bg-[#3B6D11]'
                  : nextTab==='dashboard' ? 'bg-[#475569]'
                  : nextTab==='comms' ? 'bg-[#7C3AED]'
                  : nextTab==='ptt' ? 'bg-[#3B7A57]'
                  : 'bg-[#185FA5]'
                return <>
                  <button onClick={() => setViewMode('icon')}
                    className={`w-7 h-7 rounded-[7px] flex items-center justify-center transition-all ${viewMode==='icon'?`${activeColor} text-white`:'text-[#A0AEC0]'}`}>
                    <i className="ti ti-layout-grid text-[13px]"/>
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={`w-7 h-7 rounded-[7px] flex items-center justify-center transition-all ${viewMode==='list'?`${activeColor} text-white`:'text-[#A0AEC0]'}`}>
                    <i className="ti ti-list text-[13px]"/>
                  </button>
                </>
              })()}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-[#64748B] text-[13px]">불러오는 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-14">
            <i className="ti ti-folder-open text-[48px] text-[#A0AEC0] block mb-3 opacity-40" />
            <p className="text-[13px] text-[#64748B]">아직 프로젝트가 없어요</p>
            <button onClick={() => navigate('/onboarding/field')}
              className="mt-4 h-[38px] px-5 bg-[#E8820C] text-white rounded-[10px] text-[13px] font-semibold inline-flex items-center gap-1.5">
              <i className="ti ti-plus" /> 새 프로젝트 만들기
            </button>
          </div>
        ) : (
          <>
          {viewMode === 'icon' ? (
            <div className="grid grid-cols-5 gap-2">
              {projects.map(project => {
                if (!nextTab)                return <DefaultIconCard    key={project.id} project={project} onClick={() => goToProject(project.id)}/>
                if (nextTab === 'timeline') return <TimelineShapeCard  key={project.id} project={project} onClick={() => goToProject(project.id)}/>
                if (nextTab === 'comms')    return <CommsIconCard      key={project.id} project={project} onClick={() => goToProject(project.id)}/>
                if (nextTab === 'ptt')      return <PTTIconCard        key={project.id} project={project} onClick={() => goToProject(project.id)}/>
                if (nextTab === 'my-part')  return <MyPartIconCard     key={project.id} project={project} onClick={() => goToProject(project.id)}/>
                if (nextTab === 'dashboard')return <DashboardIconCard  key={project.id} project={project} parts={allParts[project.id] ?? []} onClick={() => goToProject(project.id)}/>
                return null
              })}
            </div>
          ) : (
          <div className="flex flex-col gap-3">
            {projects.map(project => nextTab
              ? <ProjectSelectCard key={project.id} project={project} nextTab={nextTab} parts={allParts[project.id] ?? []} onClick={() => goToProject(project.id)}/>
              : <DefaultCard key={project.id} project={project} onClick={() => goToProject(project.id)}/>
            )}
          </div>
          )}
          </>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
