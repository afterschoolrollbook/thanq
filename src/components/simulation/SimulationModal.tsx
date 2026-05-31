import { useState, useEffect, useRef } from 'react'
import type { Project, Part, CueItem } from '@/types'

// ── 타입 ──────────────────────────────────────────────────
type IssueSeverity = 'conflict' | 'warning' | 'info'

interface SimIssue {
  id: string
  severity: IssueSeverity
  time?: string
  partNames: string[]
  title: string
  detail: string
  cueIds: string[]
}

interface SimEvent {
  time: string
  partName: string
  partColor: string
  title: string
  durationMin: number
  cueId: string
}

interface SimulationResult {
  issues: SimIssue[]
  timeline: SimEvent[]
  totalCues: number
  totalDuration: number
  conflictCount: number
  warningCount: number
}

// ── 유틸 ──────────────────────────────────────────────────
function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minToTime(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// ── 시뮬레이션 분석 엔진 ──────────────────────────────────
function runSimulation(
  project: Project,
  parts: Part[],
  cuesByPart: Record<string, CueItem[]>,
  date: string
): SimulationResult {
  const issues: SimIssue[] = []
  let issueIdx = 0

  // 날짜 필터: date 없거나 해당 날짜 큐만
  const allCues: Array<CueItem & { partName: string; partColor: string }> = []
  for (const part of parts) {
    const cues = (cuesByPart[part.id] ?? []).filter(
      c => !c.date || c.date === date
    )
    for (const c of cues) {
      allCues.push({ ...c, partName: part.name, partColor: part.color })
    }
  }

  allCues.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))

  // 1) 시간 겹침 (같은 파트 내 큐 충돌)
  for (const part of parts) {
    const cues = (cuesByPart[part.id] ?? [])
      .filter(c => !c.date || c.date === date)
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
    for (let i = 0; i < cues.length - 1; i++) {
      const cur = cues[i]
      const next = cues[i + 1]
      const curEnd = timeToMin(cur.startTime) + (cur.durationMin ?? 0)
      const nextStart = timeToMin(next.startTime)
      if (curEnd > nextStart) {
        const overlap = curEnd - nextStart
        issues.push({
          id: `c${issueIdx++}`,
          severity: 'conflict',
          time: cur.startTime,
          partNames: [part.name],
          title: `[${part.name}] 시간 겹침: "${cur.title}" ↔ "${next.title}"`,
          detail: `"${cur.title}"가 ${minToTime(curEnd)}에 끝나지만 "${next.title}"는 ${next.startTime}에 시작 → ${overlap}분 충돌`,
          cueIds: [cur.id, next.id],
        })
      }
    }
  }

  // 2) 행사 시간 범위 초과
  if (project.startTime && project.endTime) {
    const eventStart = timeToMin(project.startTime)
    const eventEnd = timeToMin(project.endTime)
    for (const cue of allCues) {
      const cueStart = timeToMin(cue.startTime)
      const cueEnd = cueStart + (cue.durationMin ?? 0)
      if (cueEnd > eventEnd + 10) {
        issues.push({
          id: `c${issueIdx++}`,
          severity: 'warning',
          time: cue.startTime,
          partNames: [cue.partName],
          title: `[${cue.partName}] 행사 종료 후 초과: "${cue.title}"`,
          detail: `큐 종료 예정 ${minToTime(cueEnd)} — 행사 종료 시각 ${project.endTime} 초과`,
          cueIds: [cue.id],
        })
      }
      if (cueStart < eventStart - 10) {
        issues.push({
          id: `c${issueIdx++}`,
          severity: 'warning',
          time: cue.startTime,
          partNames: [cue.partName],
          title: `[${cue.partName}] 행사 시작 전 배치: "${cue.title}"`,
          detail: `큐 시작 ${cue.startTime} — 행사 시작 시각 ${project.startTime} 이전`,
          cueIds: [cue.id],
        })
      }
    }
  }

  // 3) 다른 파트 간 동시 진행 (같은 시간대 큰 이벤트 여러 파트)
  const slots: Record<string, Array<{ partName: string; cueId: string; title: string }>> = {}
  for (const cue of allCues) {
    const startSlot = Math.floor(timeToMin(cue.startTime) / 30) * 30
    const key = minToTime(startSlot)
    if (!slots[key]) slots[key] = []
    slots[key].push({ partName: cue.partName, cueId: cue.id, title: cue.title })
  }
  for (const [slotTime, items] of Object.entries(slots)) {
    const partGroups = new Map<string, typeof items>()
    for (const item of items) {
      if (!partGroups.has(item.partName)) partGroups.set(item.partName, [])
      partGroups.get(item.partName)!.push(item)
    }
    // 같은 파트에 30분 슬롯에 큐 3개 이상이면 경고
    for (const [partName, its] of partGroups) {
      if (its.length >= 3) {
        issues.push({
          id: `c${issueIdx++}`,
          severity: 'warning',
          time: slotTime,
          partNames: [partName],
          title: `[${partName}] ${slotTime} 전후 과밀 배치`,
          detail: `${slotTime}대에 큐 ${its.length}개가 집중 → 여유 없이 진행 가능성`,
          cueIds: its.map(i => i.cueId),
        })
      }
    }
  }

  // 4) 큐 간격 너무 짧음 (0분 간격)
  for (const part of parts) {
    const cues = (cuesByPart[part.id] ?? [])
      .filter(c => !c.date || c.date === date)
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
    for (let i = 0; i < cues.length - 1; i++) {
      const cur = cues[i]
      const next = cues[i + 1]
      const curEnd = timeToMin(cur.startTime) + (cur.durationMin ?? 0)
      const gap = timeToMin(next.startTime) - curEnd
      if (gap === 0 && (cur.durationMin ?? 0) > 0) {
        issues.push({
          id: `c${issueIdx++}`,
          severity: 'info',
          time: cur.startTime,
          partNames: [part.name],
          title: `[${part.name}] 전환 여유 없음: "${cur.title}" → "${next.title}"`,
          detail: `두 큐 사이 여유 시간 0분 — 준비/이동 시간 필요할 수 있어요`,
          cueIds: [cur.id, next.id],
        })
      }
    }
  }

  // 5) duration 0이거나 미설정
  for (const cue of allCues) {
    if (!cue.durationMin || cue.durationMin === 0) {
      issues.push({
        id: `c${issueIdx++}`,
        severity: 'info',
        time: cue.startTime,
        partNames: [cue.partName],
        title: `[${cue.partName}] 소요 시간 미설정: "${cue.title}"`,
        detail: `소요 시간이 0분으로 설정되어 있어요 — 실제 시간을 입력하면 더 정확하게 분석돼요`,
        cueIds: [cue.id],
      })
    }
  }

  const totalDuration = allCues.reduce((s, c) => s + (c.durationMin ?? 0), 0)
  const timeline: SimEvent[] = allCues.map(c => ({
    time: c.startTime,
    partName: c.partName,
    partColor: c.partColor,
    title: c.title,
    durationMin: c.durationMin ?? 0,
    cueId: c.id,
  }))

  return {
    issues,
    timeline,
    totalCues: allCues.length,
    totalDuration,
    conflictCount: issues.filter(i => i.severity === 'conflict').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
  }
}

// ── 뱃지 컴포넌트 ──────────────────────────────────────────
function SeverityBadge({ s }: { s: IssueSeverity }) {
  if (s === 'conflict') return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FCEBEB] text-[#A32D2D] flex-shrink-0">충돌</span>
  )
  if (s === 'warning') return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FAEEDA] text-[#854F0B] flex-shrink-0">주의</span>
  )
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F1FB] text-[#185FA5] flex-shrink-0">참고</span>
  )
}

// ── 시뮬레이션 타임라인 바 ────────────────────────────────
function SimTimeline({ timeline }: { timeline: SimEvent[]; totalDuration?: number }) {
  if (timeline.length === 0) return null
  const minStart = Math.min(...timeline.map(e => timeToMin(e.time)))
  const maxEnd = Math.max(...timeline.map(e => timeToMin(e.time) + e.durationMin))
  const span = maxEnd - minStart || 60

  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold text-[#64748B] mb-2 flex items-center gap-1.5">
        <i className="ti ti-layout-columns text-[13px]" /> 시뮬레이션 타임라인
      </div>
      <div className="bg-[#F4F6F9] rounded-[10px] p-3 overflow-x-auto">
        <div className="relative" style={{ minWidth: 280, height: `${timeline.length * 28 + 8}px` }}>
          {timeline.map((ev, i) => {
            const left = ((timeToMin(ev.time) - minStart) / span) * 100
            const width = Math.max(2, (ev.durationMin / span) * 100)
            return (
              <div key={ev.cueId + i}
                style={{
                  position: 'absolute',
                  top: i * 28,
                  left: `${left}%`,
                  width: `${width}%`,
                  height: 22,
                  background: ev.partColor + 'CC',
                  border: `1px solid ${ev.partColor}`,
                  borderRadius: 5,
                  overflow: 'hidden',
                  minWidth: 6,
                }}
                title={`[${ev.partName}] ${ev.title} ${ev.time} (${ev.durationMin}분)`}
              >
                {width > 8 && (
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '0 4px', color: '#1A1A2E', whiteSpace: 'nowrap' }}>
                    {ev.title}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#A0AEC0]">{minToTime(minStart)}</span>
          <span className="text-[10px] text-[#A0AEC0]">{minToTime(maxEnd)}</span>
        </div>
      </div>
    </div>
  )
}

// ── 메인 모달 ─────────────────────────────────────────────
interface Props {
  project: Project
  parts: Part[]
  cuesByPart: Record<string, CueItem[]>
  onClose: () => void
}

export default function SimulationModal({ project, parts, cuesByPart, onClose }: Props) {
  const [step, setStep] = useState<'idle' | 'running' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [selectedDate, setSelectedDate] = useState(project.date)
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'all'>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 행사 날짜 범위
  const dateRange: string[] = (() => {
    const dates: string[] = []
    const start = new Date(project.date)
    const end = new Date((project as any).dateEnd || project.date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
      dates.push(d.toISOString().split('T')[0])
    return dates
  })()

  function startSim() {
    setStep('running')
    setProgress(0)
    setResult(null)
    let p = 0
    timerRef.current = setInterval(() => {
      p += Math.random() * 18 + 8
      if (p >= 100) {
        p = 100
        clearInterval(timerRef.current!)
        const r = runSimulation(project, parts, cuesByPart, selectedDate)
        setResult(r)
        setStep('done')
      }
      setProgress(Math.min(100, Math.round(p)))
    }, 120)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const filteredIssues = result?.issues.filter(
    i => filterSeverity === 'all' || i.severity === filterSeverity
  ) ?? []

  const SEVERITY_ICON: Record<IssueSeverity, string> = {
    conflict: 'ti-alert-triangle',
    warning: 'ti-alert-circle',
    info: 'ti-info-circle',
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-[24px] overflow-hidden"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F1F5F9] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[#E6F1FB] flex items-center justify-center">
              <i className="ti ti-player-play text-[#185FA5] text-[15px]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#1A1A2E]">AI 시뮬레이션</div>
              <div className="text-[11px] text-[#64748B]">큐시트 시간 흐름 분석</div>
            </div>
          </div>
          <button onClick={onClose}><i className="ti ti-x text-[#A0AEC0] text-[18px]" /></button>
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* STEP 0: 설정 + 시작 */}
          {step === 'idle' && (
            <>
              <div className="bg-[#F4F6F9] rounded-[12px] p-4 mb-4">
                <div className="text-[12px] font-semibold text-[#64748B] mb-3">시뮬레이션 대상 날짜</div>
                {dateRange.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {dateRange.map(d => (
                      <button key={d} onClick={() => setSelectedDate(d)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-colors ${selectedDate === d ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B] bg-white'}`}>
                        {d.replace(/-/g, '.')}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] font-semibold text-[#185FA5]">{selectedDate.replace(/-/g, '.')}</div>
                )}
              </div>

              <div className="bg-[#E6F1FB] rounded-[12px] p-4 mb-5">
                <div className="text-[12px] font-semibold text-[#0C447C] mb-2 flex items-center gap-1.5">
                  <i className="ti ti-sparkles text-[14px]" /> 이런 걸 체크해요
                </div>
                {[
                  { icon: 'ti-alert-triangle', color: '#A32D2D', bg: '#FCEBEB', text: '같은 파트 내 큐 시간 겹침 (충돌)' },
                  { icon: 'ti-clock-x', color: '#854F0B', bg: '#FAEEDA', text: '행사 시간 범위 초과 배치' },
                  { icon: 'ti-stack-2', color: '#854F0B', bg: '#FAEEDA', text: '특정 시간대 큐 과밀 집중' },
                  { icon: 'ti-arrows-right-left', color: '#185FA5', bg: '#E6F1FB', text: '전환 여유 없는 연속 큐' },
                  { icon: 'ti-timer-off', color: '#185FA5', bg: '#E6F1FB', text: '소요 시간 미설정 큐' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                      <i className={`ti ${item.icon} text-[11px]`} style={{ color: item.color }} />
                    </span>
                    <span className="text-[12px] text-[#1A1A2E]">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-[#A0AEC0] text-center mb-3">
                파트 {parts.length}개 · 총 큐 {Object.values(cuesByPart).flat().filter(c => !c.date || c.date === selectedDate).length}개 분석 예정
              </div>

              <button onClick={startSim}
                className="w-full h-[48px] bg-[#185FA5] text-white rounded-[14px] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#0C447C] transition-colors">
                <i className="ti ti-player-play text-[16px]" /> 시뮬레이션 시작
              </button>
            </>
          )}

          {/* STEP 1: 분석 중 */}
          {step === 'running' && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="w-16 h-16 rounded-full bg-[#E6F1FB] flex items-center justify-center">
                <i className="ti ti-player-play text-[#185FA5] text-[28px]" style={{ animation: 'spin 1.5s linear infinite' }} />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-semibold text-[#1A1A2E] mb-1">큐시트 분석 중...</div>
                <div className="text-[12px] text-[#64748B]">시간 흐름을 따라 검토하고 있어요</div>
              </div>
              <div className="w-full bg-[#F4F6F9] rounded-full h-2.5 overflow-hidden">
                <div className="h-full bg-[#185FA5] rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }} />
              </div>
              <div className="text-[12px] text-[#185FA5] font-semibold">{progress}%</div>
            </div>
          )}

          {/* STEP 2: 결과 */}
          {step === 'done' && result && (
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-3 text-center">
                  <div className="text-[11px] text-[#64748B] mb-0.5">총 큐</div>
                  <div className="text-[18px] font-bold text-[#1A1A2E]">{result.totalCues}</div>
                </div>
                <div className={`rounded-[12px] p-3 text-center border ${result.conflictCount > 0 ? 'bg-[#FCEBEB] border-[#F7C1C1]' : 'bg-white border-[#E2E8F0]'}`}>
                  <div className="text-[11px] text-[#64748B] mb-0.5">충돌</div>
                  <div className={`text-[18px] font-bold ${result.conflictCount > 0 ? 'text-[#A32D2D]' : 'text-[#3B6D11]'}`}>
                    {result.conflictCount > 0 ? result.conflictCount : '없음'}
                  </div>
                </div>
                <div className={`rounded-[12px] p-3 text-center border ${result.warningCount > 0 ? 'bg-[#FAEEDA] border-[#FAC775]' : 'bg-white border-[#E2E8F0]'}`}>
                  <div className="text-[11px] text-[#64748B] mb-0.5">주의</div>
                  <div className={`text-[18px] font-bold ${result.warningCount > 0 ? 'text-[#854F0B]' : 'text-[#3B6D11]'}`}>
                    {result.warningCount > 0 ? result.warningCount : '없음'}
                  </div>
                </div>
              </div>

              {/* 타임라인 미리보기 */}
              <SimTimeline timeline={result.timeline} totalDuration={result.totalDuration} />

              {/* 이슈 없음 */}
              {result.issues.length === 0 && (
                <div className="bg-[#EAF3DE] rounded-[14px] p-5 text-center mb-4">
                  <i className="ti ti-circle-check text-[#3B6D11] text-[36px] mb-2 block" />
                  <div className="text-[14px] font-semibold text-[#3B6D11]">문제 없음!</div>
                  <div className="text-[12px] text-[#3B6D11] mt-1">충돌이나 주의사항이 발견되지 않았어요 👍</div>
                </div>
              )}

              {/* 이슈 목록 */}
              {result.issues.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12px] font-semibold text-[#1A1A2E]">
                      발견된 항목 {result.issues.length}개
                    </div>
                    <div className="flex gap-1">
                      {(['all', 'conflict', 'warning', 'info'] as const).map(sv => (
                        <button key={sv} onClick={() => setFilterSeverity(sv)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${filterSeverity === sv ? 'bg-[#185FA5] text-white' : 'bg-[#F4F6F9] text-[#64748B]'}`}>
                          {sv === 'all' ? '전체' : sv === 'conflict' ? '충돌' : sv === 'warning' ? '주의' : '참고'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mb-4">
                    {filteredIssues.map(issue => (
                      <div key={issue.id}
                        className={`rounded-[12px] p-3.5 border ${
                          issue.severity === 'conflict' ? 'bg-[#FCEBEB] border-[#F7C1C1]'
                          : issue.severity === 'warning' ? 'bg-[#FAEEDA] border-[#FAC775]'
                          : 'bg-[#E6F1FB] border-[#B5D4F4]'
                        }`}>
                        <div className="flex items-start gap-2 mb-1">
                          <i className={`ti ${SEVERITY_ICON[issue.severity]} text-[14px] mt-0.5 flex-shrink-0 ${
                            issue.severity === 'conflict' ? 'text-[#A32D2D]'
                            : issue.severity === 'warning' ? 'text-[#854F0B]'
                            : 'text-[#185FA5]'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-start gap-1.5 flex-wrap">
                              <SeverityBadge s={issue.severity} />
                              {issue.time && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-[#64748B]">{issue.time}</span>
                              )}
                            </div>
                            <div className="text-[12px] font-semibold text-[#1A1A2E] mt-1 leading-snug">{issue.title}</div>
                            <div className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{issue.detail}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 다시 실행 */}
              <button onClick={() => { setStep('idle'); setResult(null); setProgress(0) }}
                className="w-full h-[40px] border border-[#E2E8F0] rounded-[12px] text-[12px] font-semibold text-[#64748B] flex items-center justify-center gap-1.5 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                <i className="ti ti-refresh text-[13px]" /> 다시 시뮬레이션
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
