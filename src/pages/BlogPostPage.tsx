import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, update, runTransaction } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar } from '@/components/ui/Common'
import type { BlogPost, BlogCategory, TemplateFile } from '@/types'

const CATEGORY_LABELS: Record<BlogCategory, { label: string; icon: string; color: string; bg: string }> = {
  notice:   { label: '공지',        icon: 'ti-speakerphone', color: '#993C1D', bg: '#FAECE7' },
  tip:      { label: '노하우',      icon: 'ti-bulb',         color: '#0F6E56', bg: '#E1F5EE' },
  template: { label: '템플릿 공유', icon: 'ti-file-export',  color: '#854F0B', bg: '#FAEEDA' },
  free:     { label: '자유게시판',  icon: 'ti-message',      color: '#534AB7', bg: '#EEEDFE' },
}

export default function BlogPostPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (!postId) return
    const unsub = onValue(ref(db, `blog/${postId}`), (snap) => {
      if (snap.exists()) {
        setPost(snap.val())
        // 조회수 증가
        update(ref(db, `blog/${postId}`), { viewCount: (snap.val().viewCount ?? 0) + 1 })
      }
      setLoading(false)
    }, { onlyOnce: false })
    return () => unsub()
  }, [postId])

  useEffect(() => {
    if (!user || !postId) return
    onValue(ref(db, `blogLikes/${postId}/${user.uid}`), (snap) => {
      setLiked(snap.exists())
    })
  }, [user, postId])

  async function handleLike() {
    if (!user || !postId) { navigate('/login'); return }
    const likeRef = ref(db, `blogLikes/${postId}/${user.uid}`)
    const postLikeRef = ref(db, `blog/${postId}/likes`)
    if (liked) {
      await update(ref(db, `blogLikes/${postId}`), { [user.uid]: null })
      await runTransaction(postLikeRef, (v) => Math.max(0, (v ?? 0) - 1))
    } else {
      await update(ref(db, `blogLikes/${postId}`), { [user.uid]: true })
      await runTransaction(postLikeRef, (v) => (v ?? 0) + 1)
    }
  }

  function downloadTemplate() {
    if (!post?.templateFile) return
    try {
      const blob = new Blob([post.templateFile], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const templateData = JSON.parse(post.templateFile) as TemplateFile
      a.href = url
      a.download = `${templateData.name}.thanq`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('템플릿 파일을 다운로드할 수 없어요')
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="flex justify-center pt-20 text-[13px] text-[#64748B]">불러오는 중...</div>
    </div>
  )

  if (!post) return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="flex justify-center pt-20 text-[13px] text-[#64748B]">게시글을 찾을 수 없어요</div>
    </div>
  )

  const catInfo = CATEGORY_LABELS[post.category]

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-16">

        {/* 뒤로가기 */}
        <button onClick={() => navigate('/blog')} className="flex items-center gap-1.5 text-[13px] text-[#64748B] mb-4 hover:text-[#185FA5]">
          <i className="ti ti-arrow-left" /> 블로그로
        </button>

        <div className="bg-white rounded-[14px] p-5">
          {/* 카테고리 뱃지 */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: catInfo.color, background: catInfo.bg }}>
              <i className={`ti ${catInfo.icon} mr-1`} />{catInfo.label}
            </span>
          </div>

          {/* 제목 */}
          <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-tight mb-3">{post.title}</h1>

          {/* 메타 */}
          <div className="flex items-center gap-2 text-[12px] text-[#A0AEC0] pb-4 border-b border-[#F4F6F9]">
            <span>{post.authorName}</span>
            <span>·</span>
            <span>{formatDate(post.createdAt)}</span>
            <span>·</span>
            <span><i className="ti ti-eye mr-0.5" />{post.viewCount ?? 0}</span>
          </div>

          {/* 템플릿 첨부 카드 */}
          {post.templateFile && (() => {
            let tmpl: TemplateFile | null = null
            try { tmpl = JSON.parse(post.templateFile) } catch {}
            return tmpl ? (
              <div className="mt-4 bg-[#FAEEDA] rounded-[12px] p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#854F0B] flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-file-zip text-white text-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[#854F0B]">{tmpl.name}</div>
                  <div className="text-[11px] text-[#A0AEC0] mt-0.5">
                    파트 {tmpl.parts.length}개 포함 · {tmpl.authorName}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tmpl.parts.map((p, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/60 rounded text-[#854F0B]">{p.name}</span>
                    ))}
                  </div>
                </div>
                <button onClick={downloadTemplate}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#854F0B] text-white rounded-[8px] text-[12px] font-semibold hover:bg-[#633806] transition-colors">
                  <i className="ti ti-download text-[14px]" />
                  받기
                </button>
              </div>
            ) : null
          })()}

          {/* 본문 */}
          <div className="mt-4 text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>

          {/* 좋아요 */}
          <div className="mt-6 pt-4 border-t border-[#F4F6F9] flex justify-center">
            <button onClick={handleLike}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-colors ${
                liked ? 'bg-[#FCEBEB] text-[#A32D2D]' : 'bg-[#F4F6F9] text-[#64748B] hover:bg-[#FCEBEB] hover:text-[#A32D2D]'
              }`}>
              <i className={`ti ${liked ? 'ti-heart-filled' : 'ti-heart'} text-[16px]`} />
              도움이 됐어요 {post.likes > 0 ? post.likes : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
