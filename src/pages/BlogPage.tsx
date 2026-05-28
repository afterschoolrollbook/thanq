import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, query, orderByChild } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar } from '@/components/ui/Common'
import type { BlogPost, BlogCategory } from '@/types'

const CATEGORY_LABELS: Record<BlogCategory | 'all', { label: string; icon: string; color: string; bg: string }> = {
  all:      { label: '전체',        icon: 'ti-layout-grid',  color: '#185FA5', bg: '#E6F1FB' },
  notice:   { label: '공지',        icon: 'ti-speakerphone', color: '#993C1D', bg: '#FAECE7' },
  tip:      { label: '노하우',      icon: 'ti-bulb',         color: '#0F6E56', bg: '#E1F5EE' },
  template: { label: '템플릿 공유', icon: 'ti-file-export',  color: '#854F0B', bg: '#FAEEDA' },
  free:     { label: '자유게시판',  icon: 'ti-message',      color: '#534AB7', bg: '#EEEDFE' },
}

export default function BlogPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<BlogCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(ref(db, 'blog'), orderByChild('createdAt'))
    const unsub = onValue(q, (snap) => {
      if (snap.exists()) {
        const list: BlogPost[] = Object.values(snap.val())
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setPosts(list)
      } else {
        setPosts([])
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = posts.filter((p) => {
    const matchCat = category === 'all' || p.category === category
    const matchSearch = !search || p.title.includes(search) || p.content.includes(search)
    return matchCat && matchSearch
  })

  function formatDate(iso: string) {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />

      {/* 헤더 */}
      <div className="bg-gradient-to-br from-[#185FA5] to-[#0d3f6e] px-5 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white text-[22px] font-bold tracking-tight">ThanQ 블로그</h1>
          <p className="text-[#B5D4F4] text-[13px] mt-1">공지, 노하우, 템플릿을 자유롭게 공유해요</p>
          <div className="mt-4 relative">
            <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="게시글 검색..."
              className="w-full h-[42px] bg-white/10 border border-white/20 rounded-[10px] pl-9 pr-4 text-[13px] text-white placeholder-white/50 focus:outline-none focus:border-white/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 -mt-3">
        {/* 카테고리 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {(Object.keys(CATEGORY_LABELS) as (BlogCategory | 'all')[]).map((cat) => {
            const info = CATEGORY_LABELS[cat]
            const active = category === cat
            return (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'text-white shadow-sm'
                    : 'bg-white text-[#64748B] border border-[#E2E8F0]'
                }`}
                style={active ? { background: info.color } : {}}>
                <i className={`ti ${info.icon} text-[13px]`} />
                {info.label}
              </button>
            )
          })}
        </div>

        {/* 글쓰기 버튼 */}
        {user && (
          <button onClick={() => navigate('/blog/write')}
            className="w-full bg-white border border-[#E2E8F0] rounded-[12px] px-4 py-3 flex items-center gap-3 mb-4 hover:border-[#185FA5] transition-colors">
            <div className="w-8 h-8 rounded-full bg-[#185FA5] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[12px] font-bold">{user.displayName?.charAt(0) ?? '?'}</span>
            </div>
            <span className="text-[13px] text-[#A0AEC0]">글을 작성해보세요... (템플릿 파일 첨부 가능)</span>
            <i className="ti ti-pencil text-[#A0AEC0] text-[15px] ml-auto" />
          </button>
        )}

        {/* 게시글 목록 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-[13px] text-[#64748B]">불러오는 중...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[14px] p-10 text-center">
            <i className="ti ti-file-off text-[32px] text-[#D1D5DB] block mb-3" />
            <p className="text-[13px] text-[#64748B]">
              {search ? '검색 결과가 없어요' : '아직 게시글이 없어요'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-10">
            {filtered.map((post) => {
              const catInfo = CATEGORY_LABELS[post.category]
              return (
                <button key={post.id} onClick={() => navigate(`/blog/${post.id}`)}
                  className="bg-white rounded-[14px] p-4 text-left hover:shadow-md transition-shadow border border-transparent hover:border-[#E2E8F0]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: catInfo.color, background: catInfo.bg }}>
                          <i className={`ti ${catInfo.icon} mr-1`} />{catInfo.label}
                        </span>
                        {post.templateFile && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-[#854F0B] bg-[#FAEEDA]">
                            <i className="ti ti-file-zip mr-1" />템플릿 첨부
                          </span>
                        )}
                      </div>
                      <div className="text-[14px] font-semibold text-[#1A1A2E] truncate">{post.title}</div>
                      <div className="text-[12px] text-[#64748B] mt-1 line-clamp-2">{post.content.slice(0, 100)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F4F6F9]">
                    <span className="text-[11px] text-[#A0AEC0]">{post.authorName}</span>
                    <span className="text-[11px] text-[#A0AEC0]">·</span>
                    <span className="text-[11px] text-[#A0AEC0]">{formatDate(post.createdAt)}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <span className="text-[11px] text-[#A0AEC0] flex items-center gap-1">
                        <i className="ti ti-eye text-[12px]" />{post.viewCount ?? 0}
                      </span>
                      <span className="text-[11px] text-[#A0AEC0] flex items-center gap-1">
                        <i className="ti ti-heart text-[12px]" />{post.likes ?? 0}
                      </span>
                    </span>
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
