import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar, BottomTabBar } from '@/components/ui/Common'
import type { Notice, Project } from '@/types'

export default function CommsPage() {
  const { projectId } = useParams()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<Notice['type']>('notice')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!projectId) return
    onValue(ref(db, `projects/${projectId}`), s => { if (s.exists()) setProject(s.val()) }, { onlyOnce: true })
    onValue(ref(db, `notices/${projectId}`), (s) => {
      if (s.exists()) { const l: Notice[] = Object.values(s.val()); l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); setNotices(l) }
      else setNotices([])
    })
  }, [projectId])

  async function handleSend() {
    if (!title.trim() || !content.trim() || !user || !projectId) return
    setSending(true)
    try {
      const r = push(ref(db, `notices/${projectId}`))
      await set(r, { id: r.key!, projectId, type, title: title.trim(), content: content.trim(), targetPartIds: [], authorId: user.uid, authorName: user.displayName, readByUids: [], createdAt: new Date().toISOString() } as Notice)
      setTitle(''); setContent(''); setType('notice'); setShowForm(false)
    } finally { setSending(false) }
  }

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; if (m < 1440) return `${Math.floor(m/60)}시간 전`; return `${Math.floor(m/1440)}일 전` }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar projectName={project?.name}/>
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-24">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div><div className="text-[18px] font-semibold">소통 허브</div><div className="text-[12px] text-[#64748B]">공지 · 긴급 연락 · 무전</div></div>
          <button onClick={() => setShowForm(!showForm)} className="h-[34px] px-3.5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-1.5 text-[13px] font-semibold">
            <i className="ti ti-plus text-[13px]" /> 공지 작성
          </button>
        </div>

        {/* 공지 작성 폼 */}
        {showForm && (
          <div className="bg-white border-2 border-[#185FA5] rounded-[14px] p-4 mb-4">
            <div className="text-[13px] font-semibold mb-3">새 공지 작성</div>
            <div className="flex gap-2 mb-3">
              {([['notice','일반','ti-bell'],['urgent','긴급','ti-alert-triangle'],['meeting','미팅','ti-users']] as const).map(([k,l,ic]) => (
                <button key={k} onClick={() => setType(k as Notice['type'])}
                  className={`flex-1 py-2 rounded-[8px] text-[12px] font-semibold flex items-center justify-center gap-1 border transition-colors ${type === k ? k === 'urgent' ? 'bg-[#A32D2D] text-white border-[#A32D2D]' : 'bg-[#185FA5] text-white border-[#185FA5]' : 'border-[#E2E8F0] text-[#64748B]'}`}>
                  <i className={`ti ${ic}`} /> {l}
                </button>
              ))}
            </div>
            <input className="w-full h-10 border border-[#E2E8F0] rounded-[10px] px-3 text-[13px] mb-2.5 focus:outline-none focus:border-[#185FA5]" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="w-full h-20 border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] resize-none mb-3 focus:outline-none focus:border-[#185FA5]" placeholder="내용" value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 h-[38px] border border-[#E2E8F0] rounded-[10px] text-[13px] text-[#64748B]">취소</button>
              <button onClick={handleSend} disabled={sending} className="flex-1 h-[38px] bg-[#185FA5] text-white rounded-[10px] text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40">
                <i className="ti ti-send text-[14px]" /> {sending ? '전송 중...' : '발송'}
              </button>
            </div>
          </div>
        )}

        {/* 공지 목록 */}
        <div className="text-[13px] font-semibold mb-3">공지 목록</div>
        {notices.length === 0 ? (
          <div className="text-center py-10 text-[#A0AEC0]"><i className="ti ti-bell-off text-[40px] block mb-2 opacity-30" /><p className="text-[13px]">공지가 없어요</p></div>
        ) : (
          <div className="flex flex-col gap-2">
            {notices.map((n) => {
              const typeMap: Record<string, { icon: string; bg: string; color: string }> = {
                notice:  { icon: 'ti-bell',           bg: '#E6F1FB', color: '#185FA5' },
                urgent:  { icon: 'ti-alert-triangle', bg: '#FCEBEB', color: '#A32D2D' },
                meeting: { icon: 'ti-users',          bg: '#EAF3DE', color: '#3B6D11' },
                file:    { icon: 'ti-paperclip',      bg: '#F1EFE8', color: '#5F5E5A' },
              }
              const t = typeMap[n.type] ?? typeMap['notice']
              return (
                <div key={n.id} className="bg-white border border-[#E2E8F0] rounded-[14px] p-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.bg }}>
                    <i className={`ti ${t.icon} text-[14px]`} style={{ color: t.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold truncate">{n.title}</p>
                      <span className="text-[11px] text-[#A0AEC0] flex-shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-[12px] text-[#64748B] line-clamp-2">{n.content}</p>
                    <p className="text-[11px] text-[#A0AEC0] mt-1">· {n.authorName}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  )
}
