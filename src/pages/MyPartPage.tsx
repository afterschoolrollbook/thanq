import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Part, CueItem, CheckItem } from '@/types'

export default function MyPartPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [myPart, setMyPart] = useState<Part | null>(null)
  const [cueItems, setCueItems] = useState<CueItem[]>([])
  const [checkItems, setCheckItems] = useState<CheckItem[]>([])
  const [tab, setTab] = useState<'cue' | 'check' | 'issue'>('cue')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId || !user) return

    // 내 파트 찾기
    const partsRef = ref(db, `parts/${projectId}`)
    const unsubParts = onValue(partsRef, (snap) => {
      if (snap.exists()) {
        const parts: Part[] = Object.values(snap.val())
        const mine = parts.find((p) => p.managerId === user.uid) ?? parts[0]
        setMyPart(mine ?? null)
        setLoading(false)

        if (mine) {
          // 큐시트
          const cueRef = ref(db, `cueItems/${projectId}/${mine.id}`)
          onValue(cueRef, (cSnap) => {
            if (cSnap.exists()) {
              const list: CueItem[] = Object.values(cSnap.val())
              list.sort((a, b) => a.order - b.order)
              setCueItems(list)
            } else {
              setCueItems([])
            }
          })

          // 체크리스트
          const checkRef = ref(db, `checkItems/${projectId}/${mine.id}`)
          onValue(checkRef, (ckSnap) => {
            if (ckSnap.exists()) {
              const list: CheckItem[] = Object.values(ckSnap.val())
              setCheckItems(list)
            } else {
              setCheckItems([])
            }
          })
        }
      }
    })

    return () => unsubParts()
  }, [projectId, user])

  async function toggleCheck(item: CheckItem) {
    if (!projectId || !myPart) return
    await update(ref(db, `checkItems/${projectId}/${myPart.id}/${item.id}`), {
      isDone: !item.isDone,
    })
  }

  async function updateCueStatus(item: CueItem, status: CueItem['status']) {
    if (!projectId || !myPart) return
    await update(ref(db, `cueItems/${projectId}/${myPart.id}/${item.id}`), {
      status,
      updatedAt: new Date().toISOString(),
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-oncue-muted text-sm">불러오는 중...</p>
    </div>
  )

  if (!myPart) return (
    <div className="flex items-center justify-center h-64 flex-col gap-2">
      <i className="ti ti-user-off text-3xl text-oncue-muted opacity-40" />
      <p className="text-oncue-muted text-sm">배정된 파트가 없어요</p>
    </div>
  )

  const doneChecks = checkItems.filter((c) => c.isDone).length

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-4">

      {/* 파트 헤더 */}
      <div className="oncue-card p-4 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: myPart.color }}>
          {myPart.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-oncue-text">{myPart.name}</h2>
          <p className="text-xs text-oncue-muted">내 파트</p>
        </div>
        <StatusBadge status={myPart.status} />
      </div>

      {/* 탭 */}
      <div className="flex bg-oncue-bg rounded-btn p-1 mb-4">
        {([
          { key: 'cue',   label: '큐시트',     count: cueItems.length },
          { key: 'check', label: '체크리스트', count: checkItems.length },
          { key: 'issue', label: '이슈',        count: 0 },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
              tab === key ? 'bg-white text-primary shadow-sm' : 'text-oncue-muted'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                tab === key ? 'bg-primary text-white' : 'bg-oncue-border text-oncue-muted'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 큐시트 탭 */}
      {tab === 'cue' && (
        <div>
          {cueItems.length === 0 ? (
            <EmptyState icon="ti-list" text="큐시트 항목이 없어요" />
          ) : (
            <div className="space-y-2">
              {cueItems.map((item) => (
                <CueRow key={item.id} item={item} onStatusChange={updateCueStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 체크리스트 탭 */}
      {tab === 'check' && (
        <div>
          {checkItems.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-oncue-muted">{doneChecks}/{checkItems.length} 완료</span>
              <div className="flex-1 mx-3 h-1.5 bg-oncue-bg rounded-full">
                <div
                  className="h-1.5 bg-status-done rounded-full transition-all"
                  style={{ width: `${checkItems.length > 0 ? (doneChecks / checkItems.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {checkItems.length === 0 ? (
            <EmptyState icon="ti-checklist" text="체크리스트가 없어요" />
          ) : (
            <div className="space-y-2">
              {checkItems.map((item) => (
                <CheckRow key={item.id} item={item} onToggle={toggleCheck} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 이슈 탭 */}
      {tab === 'issue' && (
        <EmptyState icon="ti-alert-circle" text="등록된 이슈가 없어요" />
      )}
    </div>
  )
}

function CueRow({ item, onStatusChange }: {
  item: CueItem
  onStatusChange: (item: CueItem, status: CueItem['status']) => void
}) {
  const statusMap: Record<CueItem['status'], { label: string; cls: string }> = {
    pending: { label: '대기',   cls: 'badge-wait' },
    ongoing: { label: '진행중', cls: 'badge-ongoing' },
    done:    { label: '완료',   cls: 'badge-done' },
    delay:   { label: '지연',   cls: 'badge-delay' },
  }
  const { label, cls } = statusMap[item.status]

  return (
    <div className="oncue-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-primary">{item.startTime}</span>
            {item.durationMin > 0 && (
              <span className="text-xs text-oncue-muted">{item.durationMin}분</span>
            )}
          </div>
          <p className="text-sm font-medium text-oncue-text">{item.title}</p>
          {item.memo && <p className="text-xs text-oncue-muted mt-0.5">{item.memo}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cls}>{label}</span>
          {item.status === 'pending' && (
            <button
              onClick={() => onStatusChange(item, 'ongoing')}
              className="text-xs text-primary font-semibold"
            >
              시작
            </button>
          )}
          {item.status === 'ongoing' && (
            <button
              onClick={() => onStatusChange(item, 'done')}
              className="text-xs text-status-done font-semibold"
            >
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CheckRow({ item, onToggle }: {
  item: CheckItem
  onToggle: (item: CheckItem) => void
}) {
  return (
    <button
      onClick={() => onToggle(item)}
      className={`oncue-card p-3 w-full flex items-center gap-3 transition-opacity ${
        item.isDone ? 'opacity-60' : ''
      }`}
    >
      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
        item.isDone ? 'bg-status-done border-status-done' : 'border-oncue-border'
      }`}>
        {item.isDone && <i className="ti ti-check text-white text-xs" />}
      </div>
      <span className={`text-sm flex-1 text-left ${item.isDone ? 'line-through text-oncue-muted' : 'text-oncue-text'}`}>
        {item.title}
      </span>
    </button>
  )
}

function StatusBadge({ status }: { status: Part['status'] }) {
  const map: Record<Part['status'], { label: string; cls: string }> = {
    waiting: { label: '대기',    cls: 'badge-wait' },
    ready:   { label: '준비완료', cls: 'badge-ongoing' },
    ongoing: { label: '진행중',  cls: 'badge-ongoing' },
    done:    { label: '완료',    cls: 'badge-done' },
    delay:   { label: '지연',    cls: 'badge-delay' },
  }
  const { label, cls } = map[status]
  return <span className={cls}>{label}</span>
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-12 text-oncue-muted">
      <i className={`ti ${icon} text-4xl block mb-2 opacity-30`} />
      <p className="text-sm">{text}</p>
    </div>
  )
}
