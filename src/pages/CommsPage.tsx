import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import type { Notice } from '@/types'

export default function CommsPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [notices, setNotices] = useState<Notice[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<Notice['type']>('notice')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!projectId) return
    const unsubNotices = onValue(ref(db, `notices/${projectId}`), (snap) => {
      if (snap.exists()) {
        const list: Notice[] = Object.values(snap.val())
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setNotices(list)
      } else {
        setNotices([])
      }
    })
    return () => unsubNotices()
  }, [projectId])

  async function handleSend() {
    if (!title.trim() || !content.trim() || !user || !projectId) return
    setSending(true)
    try {
      const noticeRef = push(ref(db, `notices/${projectId}`))
      const notice: Notice = {
        id: noticeRef.key!,
        projectId: projectId!,
        type,
        title: title.trim(),
        content: content.trim(),
        targetPartIds: [],
        authorId: user.uid,
        authorName: user.displayName,
        readByUids: [],
        createdAt: new Date().toISOString(),
      }
      await set(noticeRef, notice)
      setTitle('')
      setContent('')
      setType('notice')
      setShowForm(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-4">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg text-oncue-text">소통 허브</h2>
          <p className="text-xs text-oncue-muted">공지 · 긴급 연락 · 무전</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary py-2 px-4"
        >
          <i className="ti ti-plus text-sm" />
          공지
        </button>
      </div>

      {/* 무전 버튼 */}
      <div className="oncue-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-oncue-text">무전 채널</h3>
          <span className="badge-ongoing">준비 중</span>
        </div>
        <button
          className="w-full bg-primary-light border-2 border-primary rounded-card py-5 flex flex-col items-center gap-2 active:bg-primary-mid transition-colors"
          onTouchStart={(e) => e.currentTarget.classList.add('bg-primary', 'text-white')}
          onTouchEnd={(e) => e.currentTarget.classList.remove('bg-primary', 'text-white')}
        >
          <i className="ti ti-microphone text-3xl text-primary" />
          <span className="text-sm font-bold text-primary">누르고 말하기 (전체)</span>
          <span className="text-xs text-oncue-muted">WebRTC 무전 — 다음 업데이트 예정</span>
        </button>
      </div>

      {/* 공지 작성 폼 */}
      {showForm && (
        <div className="oncue-card p-4 mb-4 border border-primary">
          <h3 className="font-semibold text-sm text-oncue-text mb-3">새 공지 작성</h3>

          {/* 타입 선택 */}
          <div className="flex gap-2 mb-3">
            {([
              { key: 'notice',  label: '일반',  icon: 'ti-bell' },
              { key: 'urgent',  label: '긴급',  icon: 'ti-alert-triangle' },
              { key: 'meeting', label: '미팅',  icon: 'ti-users' },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`flex-1 py-2 rounded-btn text-xs font-semibold flex items-center justify-center gap-1 border transition-colors ${
                  type === key
                    ? key === 'urgent'
                      ? 'bg-status-urgent text-white border-status-urgent'
                      : 'bg-primary text-white border-primary'
                    : 'border-oncue-border text-oncue-muted'
                }`}
              >
                <i className={`ti ${icon} text-sm`} />
                {label}
              </button>
            ))}
          </div>

          <input
            className="input-field mb-3"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input-field resize-none h-20 mb-3"
            placeholder="내용"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-outline flex-1 justify-center">
              취소
            </button>
            <button onClick={handleSend} disabled={sending} className="btn-primary flex-1 justify-center">
              <i className="ti ti-send text-sm" />
              {sending ? '전송 중...' : '전송'}
            </button>
          </div>
        </div>
      )}

      {/* 공지 목록 */}
      <div>
        <h3 className="font-semibold text-sm text-oncue-text mb-3">공지 목록</h3>
        {notices.length === 0 ? (
          <div className="text-center py-10 text-oncue-muted">
            <i className="ti ti-bell-off text-4xl block mb-2 opacity-30" />
            <p className="text-sm">공지가 없어요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NoticeCard({ notice }: { notice: Notice }) {
  const typeMap: Record<Notice['type'], { icon: string; color: string; bg: string }> = {
    notice:  { icon: 'ti-bell',           color: 'text-primary',       bg: 'bg-primary-light' },
    urgent:  { icon: 'ti-alert-triangle', color: 'text-status-urgent', bg: 'bg-status-urgent-bg' },
    meeting: { icon: 'ti-users',          color: 'text-status-done',   bg: 'bg-status-done-bg' },
    file:    { icon: 'ti-paperclip',      color: 'text-oncue-muted',   bg: 'bg-oncue-bg' },
  }
  const { icon, color, bg } = typeMap[notice.type]

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    if (diff < 1) return '방금'
    if (diff < 60) return `${diff}분 전`
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
    return `${Math.floor(diff / 1440)}일 전`
  }

  return (
    <div className="oncue-card p-3">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
          <i className={`ti ${icon} text-sm ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-oncue-text truncate">{notice.title}</p>
            <span className="text-xs text-oncue-muted flex-shrink-0">{timeAgo(notice.createdAt)}</span>
          </div>
          <p className="text-xs text-oncue-muted line-clamp-2">{notice.content}</p>
          <p className="text-xs text-oncue-muted mt-1">· {notice.authorName}</p>
        </div>
      </div>
    </div>
  )
}
