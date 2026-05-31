import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { Topbar, StatusBadge, BottomTabBar } from '@/components/ui/Common'
import { useAuthStore } from '@/store/authStore'
import type { Project, Part, CueItem, Issue } from '@/types'

// ── 날짜/시간 포맷 유틸 ────────────────────────────────────
function formatKorDate(date: Date) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const day = days[date.getDay()]
  return `${y}.${m}.${d} (${day})`
}
function formatKorTime(date: Date) {
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${ampm} ${h12}:${m}`
}

// ── 경고 항목 계산 ────────────────────────────────────────
interface Warning {
  id: string
  level: 'urgent' | 'warning'
  partName: string
  partColor: string
  message: string
}

// ── 큐시트 변경 알림 타입 ─────────────────────────────────
interface CueChangeAlert {
  id: string
  partId: string
  partName: string
  partColor: string
  cueTitle: string
  changeType: 'new' | 'updated' | 'deleted'
  detail: string
  isChecked: boolean
  createdAt: string
}

export default function DashboardPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [allCues, setAllCues] = useState<CueItem[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [cueAlerts, setCueAlerts] = useState<CueChangeAlert[]>([])
  const [now, setNow] = useState(new Date())
  const [memberRole, setMemberRole] = useState<string>('member')

  // ── 실시간 시계 ────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ── Firebase 데이터 구독 ───────────────────────────────
  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), (s) => { if (s.exists()) setProject(s.val()) })
    onValue(ref(db, `parts/${projectId}`), (s) => {
      if (s.exists()) {
        const l: Part[] = Object.values(s.val())
        l.sort((a, b) => a.order - b.order)
        setParts(l)
      }
    })
    onValue(ref(db, `cueItems/${projectId}`), (s) => {
      if (s.exists()) {
        const all: CueItem[] = []
        Object.values(s.val() as Record<string, Record<string, CueItem>>).forEach((partCues) => {
          Object.values(partCues).forEach((c) => all.push(c))
        })
        setAllCues(all)
      }
    })
    onValue(ref(db, `issues/${projectId}`), (s) => {
      if (s.exists()) {
        const l: Issue[] = Object.values(s.val())
        l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setIssues(l.filter(i => !i.isResolved))
      } else {
        setIssues([])
      }
    })
    onValue(ref(db, `cueAlerts/${projectId}`), (s) => {
      if (s.exists()) {
        const l: CueChangeAlert[] = Object.values(s.val())
        l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setCueAlerts(l)
      } else {
        setCueAlerts([])
      }
    })
    if (user) {
      onValue(ref(db, `members/${projectId}/${user.uid}`), (s) => {
        if (s.exists()) setMemberRole(s.val().role ?? 'member')
      })
    }
  }, [projectId, user])

  // ── 계산 ──────────────────────────────────────────────
  const progress = parts.length
    ? Math.round(parts.reduce((s, p) => s + p.progress, 0) / parts.length)
    : 0
  const counts = { waiting: 0, ready: 0, ongoing: 0, done: 0, delay: 0 }
  parts.forEach((p) => { if (p.status in counts) counts[p.status as keyof typeof counts]++ })

  // 오늘 큐시트 항목
  const todayStr = now.toISOString().split('T')[0]
  const todayCues = allCues.filter(c => {
    const cueDate = c.date ?? project?.date ?? ''
    return cueDate === todayStr || (!c.date && project?.date === todayStr)
  })

  // 현재 진행 중인 큐
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const currentCue = todayCues.find(c => {
    const [h, m] = c.startTime.split(':').map(Number)
    const start = h * 60 + m
    const end = start + c.durationMin
    return nowMinutes >= start && nowMinutes < end
  })
  const nextCue = todayCues
    .filter(c => {
      const [h, m] = c.startTime.split(':').map(Number)
      return h * 60 + m > nowMinutes
    })
    .sort((a, b) => {
      const [ah, am] = a.startTime.split(':').map(Number)
      const [bh, bm] = b.startTime.split(':').map(Number)
      return (ah * 60 + am) - (bh * 60 + bm)
    })[0]

  // 행사 당일 여부 / D-day 계산
  const isEventDay = project?.date === todayStr
  const dDayDiff = project?.date
    ? Math.ceil((new Date(project.date).getTime() - new Date(todayStr).getTime()) / 86400000)
    : null

  // 경고 생성
  const warnings: Warning[] = []
  parts.forEach((part) => {
    if (part.status === 'delay') {
      warnings.push({
        id: `delay-${part.id}`,
        level: 'urgent',
        partName: part.name,
        partColor: part.color,
        message: '지연 상태입니다. 즉시 확인이 필요합니다.',
      })
    }
    if (!part.managerName) {
      warnings.push({
        id: `nomanager-${part.id}`,
        level: 'warning',
        partName: part.name,
        partColor: part.color,
        message: '담당자가 배정되지 않았습니다.',
      })
    }
    const partCues = allCues.filter(c => c.partId === part.id)
    if (partCues.length === 0 && !part.isParticipant) {
      warnings.push({
        id: `nocue-${part.id}`,
        level: 'warning',
        partName: part.name,
        partColor: part.color,
        message: '큐시트가 없습니다. 행사 전 등록이 필요합니다.',
      })
    }
  })

  // 권한 체크: admin/owner만 모든 큐알림, member는 자기 파트만
  const isAdminOrOwner = memberRole === 'owner' || memberRole === 'admin'
  const uncheckedAlerts = cueAlerts.filter(a => !a.isChecked)

  // ── 큐 알림 확인 처리 ─────────────────────────────────
  function handleCheckAlert(alertId: string) {
    if (!projectId) return
    update(ref(db, `cueAlerts/${projectId}/${alertId}`), { isChecked: true })
  }

  // ── 이슈 해결 처리 ────────────────────────────────────
  function handleResolveIssue(issueId: string) {
    if (!projectId) return
    update(ref(db, `issues/${projectId}/${issueId}`), { isResolved: true })
  }

  // ── D-day 표시 ────────────────────────────────────────
  function getDayLabel() {
    if (dDayDiff === null) return ''
    if (dDayDiff === 0) return '🎉 D-DAY'
    if (dDayDiff > 0) return `D-${dDayDiff}`
    return `D+${Math.abs(dDayDiff)}`
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar projectName={project?.name} />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-28">

        {/* ── 헤더 + 날짜/시간 ── */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[18px] font-semibold text-[#1A1A2E]">본부 대시보드</div>
            <div className="text-[12px] text-[#64748B]">전체 현황 모니터링</div>
          </div>
          {/* 날짜/시간 + D-day */}
          <div className="text-right">
            <div className="text-[11px] text-[#64748B] font-medium">{formatKorDate(now)}</div>
            <div className="text-[20px] font-black text-[#1A1A2E] leading-tight tabular-nums">{formatKorTime(now)}</div>
            {dDayDiff !== null && (
              <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                dDayDiff === 0 ? 'bg-[#185FA5] text-white' :
                dDayDiff > 0 ? 'bg-[#FAEEDA] text-[#854F0B]' :
                'bg-[#EAF3DE] text-[#3B6D11]'
              }`}>
                {getDayLabel()}
              </div>
            )}
          </div>
        </div>

        {/* ── 행사 당일: 현재 진행 상황 카드 ── */}
        {isEventDay && (
          <div className="bg-[#185FA5] rounded-[14px] p-4 mb-4 text-white">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#B5D4F4] mb-3">
              <i className="ti ti-live-view text-[13px]" /> 실시간 진행 현황
            </div>
            {currentCue ? (
              <div>
                <div className="text-[11px] text-[#B5D4F4] mb-0.5">현재 진행 중</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-bold">{currentCue.title}</div>
                    <div className="text-[11px] text-[#B5D4F4] mt-0.5">
                      {currentCue.startTime} · {currentCue.durationMin}분
                      {currentCue.assigneeName && <> · {currentCue.assigneeName}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse inline-block" />
                    <span className="text-[11px] font-semibold">LIVE</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-[#B5D4F4]">현재 진행 중인 프로그램이 없습니다</div>
            )}
            {nextCue && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="text-[11px] text-[#B5D4F4] mb-0.5">다음 순서</div>
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{nextCue.title}</div>
                  <div className="text-[11px] text-[#B5D4F4]">{nextCue.startTime}</div>
                </div>
              </div>
            )}
            {todayCues.length === 0 && (
              <div className="text-[13px] text-[#B5D4F4]">오늘 등록된 큐시트 항목이 없습니다</div>
            )}
          </div>
        )}

        {/* ── 행사 전: 준비율 카드 ── */}
        {!isEventDay && (
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-[#1A1A2E]">전체 준비율</span>
              <span className="text-[22px] font-bold text-[#185FA5]">{progress}%</span>
            </div>
            <div className="h-2 bg-[#F4F6F9] rounded-full overflow-hidden">
              <div className="h-2 bg-[#185FA5] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[#A0AEC0]">0%</span>
              <span className="text-[10px] text-[#A0AEC0]">100%</span>
            </div>
          </div>
        )}

        {/* ── 행사 당일: 준비율도 같이 표시 ── */}
        {isEventDay && (
          <div className="bg-white border border-[#E2E8F0] rounded-[14px] p-3 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-[#1A1A2E]">전체 준비율</span>
              <span className="text-[16px] font-bold text-[#185FA5]">{progress}%</span>
            </div>
            <div className="h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden">
              <div className="h-1.5 bg-[#185FA5] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── 상태 요약 ── */}
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

        {/* ── 경고 섹션 ── */}
        {warnings.length > 0 && (
          <div className="mb-4">
            <div className="text-[13px] font-semibold flex items-center gap-1.5 mb-2">
              <i className="ti ti-alert-triangle text-[15px] text-[#854F0B]" />
              준비 미완료 경고
              <span className="ml-auto text-[11px] font-bold bg-[#FAEEDA] text-[#854F0B] px-2 py-0.5 rounded-full">{warnings.length}건</span>
            </div>
            <div className="flex flex-col gap-2">
              {warnings.map((w) => (
                <div key={w.id}
                  className={`flex items-start gap-3 rounded-[12px] p-3 border ${
                    w.level === 'urgent'
                      ? 'bg-[#FCEBEB] border-[#F3BCBC]'
                      : 'bg-[#FAEEDA] border-[#F5D9A8]'
                  }`}>
                  <i className={`ti ${w.level === 'urgent' ? 'ti-alert-circle text-[#A32D2D]' : 'ti-alert-triangle text-[#854F0B]'} text-[16px] mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: w.partColor }} />
                      <span className="text-[12px] font-semibold text-[#1A1A2E] truncate">{w.partName}</span>
                    </div>
                    <div className={`text-[12px] ${w.level === 'urgent' ? 'text-[#A32D2D]' : 'text-[#854F0B]'}`}>{w.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 이슈 / 알림 ── */}
        <div className="mb-4">
          <div className="text-[13px] font-semibold flex items-center gap-1.5 mb-2">
            <i className="ti ti-alert-circle text-[15px] text-[#E24B4A]" />
            이슈 / 알림
            {issues.length > 0 && (
              <span className="ml-auto text-[11px] font-bold bg-[#FCEBEB] text-[#A32D2D] px-2 py-0.5 rounded-full">{issues.length}건</span>
            )}
          </div>

          {/* 큐시트 변경 알림 */}
          {uncheckedAlerts.length > 0 && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-[#64748B] mb-1.5 flex items-center gap-1">
                <i className="ti ti-refresh text-[12px]" /> 큐시트 변경 알림
              </div>
              <div className="flex flex-col gap-2">
                {uncheckedAlerts.map((alert) => (
                  <div key={alert.id} className="bg-[#E6F1FB] border border-[#B5D4F4] rounded-[12px] p-3 flex items-start gap-2.5">
                    <i className="ti ti-edit text-[#185FA5] text-[15px] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: alert.partColor }} />
                        <span className="text-[11px] font-semibold text-[#185FA5]">{alert.partName}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          alert.changeType === 'new' ? 'bg-[#EAF3DE] text-[#3B6D11]' :
                          alert.changeType === 'deleted' ? 'bg-[#FCEBEB] text-[#A32D2D]' :
                          'bg-[#FAEEDA] text-[#854F0B]'
                        }`}>
                          {alert.changeType === 'new' ? '신규' : alert.changeType === 'deleted' ? '삭제' : '수정'}
                        </span>
                      </div>
                      <div className="text-[12px] font-semibold text-[#1A1A2E]">{alert.cueTitle}</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">{alert.detail}</div>
                    </div>
                    <button
                      onClick={() => handleCheckAlert(alert.id)}
                      className="flex-shrink-0 w-6 h-6 rounded-full bg-[#185FA5] text-white flex items-center justify-center hover:bg-[#154e8a] transition-colors"
                      title="확인 완료"
                    >
                      <i className="ti ti-check text-[12px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이슈 목록 */}
          {issues.length === 0 && uncheckedAlerts.length === 0 ? (
            <div className="text-[12px] text-[#64748B] text-center py-4 bg-white rounded-[10px] border border-[#E2E8F0]">
              등록된 이슈가 없어요
            </div>
          ) : issues.length > 0 ? (
            <div className="flex flex-col gap-2">
              {issues.map((issue) => (
                <div key={issue.id} className={`rounded-[12px] p-3 border flex items-start gap-2.5 ${
                  issue.level === 'urgent' ? 'bg-[#FCEBEB] border-[#F3BCBC]' :
                  issue.level === 'warning' ? 'bg-[#FAEEDA] border-[#F5D9A8]' :
                  'bg-white border-[#E2E8F0]'
                }`}>
                  <i className={`ti ${
                    issue.level === 'urgent' ? 'ti-alert-circle text-[#A32D2D]' :
                    issue.level === 'warning' ? 'ti-alert-triangle text-[#854F0B]' :
                    'ti-info-circle text-[#185FA5]'
                  } text-[16px] mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#1A1A2E]">{issue.content}</div>
                    <div className="text-[10px] text-[#A0AEC0] mt-0.5">{issue.authorName}</div>
                  </div>
                  {isAdminOrOwner && (
                    <button
                      onClick={() => handleResolveIssue(issue.id)}
                      className="flex-shrink-0 text-[11px] font-semibold text-[#64748B] border border-[#E2E8F0] bg-white rounded-full px-2 py-0.5 hover:bg-[#F4F6F9] transition-colors"
                    >
                      확인
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── 파트별 상세 현황 ── */}
        <div className="text-[13px] font-semibold flex items-center gap-1.5 mb-3">
          <i className="ti ti-layout-grid text-[15px] text-[#185FA5]" /> 파트별 상세 현황
        </div>
        {parts.length === 0 ? (
          <div className="text-[12px] text-[#64748B] text-center py-8">파트가 없어요</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {parts.map((part) => {
              const partCues = allCues.filter(c => c.partId === part.id)
              const partTodayCues = partCues.filter(c => {
                const d = c.date ?? project?.date ?? ''
                return d === todayStr || (!c.date && project?.date === todayStr)
              })
              const partCurrentCue = isEventDay ? partTodayCues.find(c => {
                const [h, m] = c.startTime.split(':').map(Number)
                const start = h * 60 + m
                return nowMinutes >= start && nowMinutes < start + c.durationMin
              }) : null
              const hasWarning = warnings.some(w => w.id.includes(part.id))

              return (
                <div key={part.id} className={`bg-white border rounded-[14px] overflow-hidden ${
                  part.status === 'delay' ? 'border-[#F3BCBC]' :
                  hasWarning ? 'border-[#F5D9A8]' :
                  'border-[#E2E8F0]'
                }`}>
                  <div className="px-3.5 py-3 border-b border-[#E2E8F0]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold truncate pr-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: part.color }} />
                        <span className="truncate">{part.name}</span>
                      </div>
                      <StatusBadge status={part.status} />
                    </div>
                    <div className="text-[11px] text-[#64748B] mb-2 flex items-center gap-1">
                      <i className="ti ti-user text-[12px]" />
                      {part.managerName ?? <span className="text-[#E24B4A]">담당자 미배정</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#F4F6F9] rounded-full overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${part.progress}%`, background: part.color }} />
                      </div>
                      <span className="text-[11px] text-[#64748B]">{part.progress}%</span>
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5">
                    {isEventDay && partCurrentCue ? (
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse inline-block" />
                          <span className="text-[10px] font-semibold text-[#3B6D11]">진행 중</span>
                        </div>
                        <div className="text-[11px] font-semibold text-[#1A1A2E] truncate">{partCurrentCue.title}</div>
                        <div className="text-[10px] text-[#64748B]">{partCurrentCue.startTime} · {partCurrentCue.durationMin}분</div>
                      </div>
                    ) : partCues.length > 0 ? (
                      <div className="text-[11px] text-[#64748B]">
                        큐시트 <span className="font-semibold text-[#1A1A2E]">{partCues.length}개</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#E24B4A] flex items-center gap-1">
                        <i className="ti ti-alert-triangle text-[12px]" /> 큐시트 없음
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 행사 당일 타임라인 요약 ── */}
        {isEventDay && todayCues.length > 0 && (
          <div className="mb-5">
            <div className="text-[13px] font-semibold flex items-center gap-1.5 mb-3">
              <i className="ti ti-timeline text-[15px] text-[#185FA5]" /> 오늘 타임라인
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden">
              {todayCues
                .sort((a, b) => {
                  const [ah, am] = a.startTime.split(':').map(Number)
                  const [bh, bm] = b.startTime.split(':').map(Number)
                  return (ah * 60 + am) - (bh * 60 + bm)
                })
                .slice(0, 8)
                .map((cue, idx, arr) => {
                  const [h, m] = cue.startTime.split(':').map(Number)
                  const startMin = h * 60 + m
                  const isPast = nowMinutes > startMin + cue.durationMin
                  const isCurrent = nowMinutes >= startMin && nowMinutes < startMin + cue.durationMin
                  const part = parts.find(p => p.id === cue.partId)
                  return (
                    <div key={cue.id} className={`flex items-start gap-3 px-3.5 py-2.5 ${idx < arr.length - 1 ? 'border-b border-[#F4F6F9]' : ''} ${isCurrent ? 'bg-[#E6F1FB]' : ''}`}>
                      <div className="w-12 flex-shrink-0 pt-0.5">
                        <div className={`text-[12px] font-semibold tabular-nums ${isPast ? 'text-[#A0AEC0]' : isCurrent ? 'text-[#185FA5]' : 'text-[#1A1A2E]'}`}>{cue.startTime}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-medium truncate ${isPast ? 'text-[#A0AEC0] line-through' : 'text-[#1A1A2E]'}`}>{cue.title}</div>
                        {part && <div className="text-[10px] mt-0.5" style={{ color: part.color }}>{part.name}</div>}
                      </div>
                      {isCurrent && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#185FA5] animate-pulse mt-1.5" />}
                      {cue.status === 'done' && <i className="ti ti-check text-[#3B6D11] text-[14px] flex-shrink-0 mt-0.5" />}
                    </div>
                  )
                })}
              {todayCues.length > 8 && (
                <div className="px-3.5 py-2 text-[11px] text-[#A0AEC0] text-center border-t border-[#F4F6F9]">
                  외 {todayCues.length - 8}개 항목 · 타임라인에서 전체 보기
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 액션 버튼 ── */}
        <div className="flex gap-2 flex-wrap">
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] bg-[#A32D2D] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5">
            <i className="ti ti-alert-triangle text-[16px]" /> 비상 상황
          </button>
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] bg-[#185FA5] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5">
            <i className="ti ti-speakerphone text-[16px]" /> 전체 공지
          </button>
          <button className="flex-1 min-w-[120px] h-[42px] rounded-[10px] border border-[#E2E8F0] bg-[#FAFBFC] text-[#1A1A2E] text-[13px] font-semibold flex items-center justify-center gap-1.5">
            <i className="ti ti-player-pause text-[16px]" /> 일시 중단
          </button>
        </div>
      </div>
      <BottomTabBar />
    </div>
  )
}
