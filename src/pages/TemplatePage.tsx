import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, query, orderByChild } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar } from '@/components/ui/Common'
import type { BlogPost, TemplateFile } from '@/types'

const FIELD_LABELS: Record<string, { label: string; icon: string }> = {
  event:     { label: '행사/축제',   icon: '🎪' },
  film:      { label: '드라마/영화', icon: '🎬' },
  concert:   { label: '콘서트/공연', icon: '🎵' },
  fashion:   { label: '패션쇼',      icon: '👗' },
  sports:    { label: '스포츠/대회', icon: '⚽' },
  broadcast: { label: '방송/생방송', icon: '📺' },
  club:      { label: '모임/클럽',   icon: '🏔' },
  custom:    { label: '기타',        icon: '✏️' },
}

interface TemplatePost extends BlogPost {
  parsedTemplate: TemplateFile
}

export default function TemplatePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<TemplatePost[]>([])
  const [loading, setLoading] = useState(true)
  const [fieldFilter, setFieldFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [previewPost, setPreviewPost] = useState<TemplatePost | null>(null)

  useEffect(() => {
    const q = query(ref(db, 'blog'), orderByChild('createdAt'))
    const unsub = onValue(q, (snap) => {
      if (snap.exists()) {
        const all: BlogPost[] = Object.values(snap.val())
        const tmplPosts: TemplatePost[] = []
        for (const post of all) {
          if (post.category === 'template' && post.templateFile) {
            try {
              const parsed = JSON.parse(post.templateFile) as TemplateFile
              tmplPosts.push({ ...post, parsedTemplate: parsed })
            } catch { /* skip malformed */ }
          }
        }
        tmplPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setTemplates(tmplPosts)
      } else {
        setTemplates([])
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = templates.filter((t) => {
    const matchField = fieldFilter === 'all' || t.parsedTemplate.fieldType === fieldFilter
    const matchSearch = !search ||
      t.parsedTemplate.name.includes(search) ||
      t.title.includes(search) ||
      t.parsedTemplate.description?.includes(search) ||
      t.parsedTemplate.authorName.includes(search)
    return matchField && matchSearch
  })

  function downloadTemplate(post: TemplatePost) {
    const blob = new Blob([post.templateFile!], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${post.parsedTemplate.name}.thanq`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const fieldTypes = [...new Set(templates.map((t) => t.parsedTemplate.fieldType))]

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />

      {/* 헤더 */}
      <div className="bg-gradient-to-br from-[#854F0B] to-[#5C3608] px-5 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white text-[22px] font-bold tracking-tight">템플릿 공유</h1>
          <p className="text-[#F5D9A8] text-[13px] mt-1">다른 사람의 행사 구성을 .thanq 파일로 받아 바로 적용해요</p>
          <div className="mt-4 relative">
            <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AEC0] text-[15px]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="템플릿 검색..."
              className="w-full h-[42px] bg-white/10 border border-white/20 rounded-[10px] pl-9 pr-4 text-[13px] text-white placeholder-white/50 focus:outline-none focus:border-white/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 -mt-3">

        {/* 분야 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button onClick={() => setFieldFilter('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
              fieldFilter === 'all' ? 'bg-[#854F0B] text-white' : 'bg-white text-[#64748B] border border-[#E2E8F0]'
            }`}>
            전체
          </button>
          {fieldTypes.map((ft) => {
            const info = FIELD_LABELS[ft] ?? { label: ft, icon: '📁' }
            return (
              <button key={ft} onClick={() => setFieldFilter(ft)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all ${
                  fieldFilter === ft ? 'bg-[#854F0B] text-white' : 'bg-white text-[#64748B] border border-[#E2E8F0]'
                }`}>
                {info.icon} {info.label}
              </button>
            )
          })}
        </div>

        {/* 내 템플릿 공유 버튼 */}
        {user && (
          <button onClick={() => navigate('/blog/write')}
            className="w-full bg-white border border-[#E2E8F0] rounded-[12px] px-4 py-3 flex items-center gap-3 mb-4 hover:border-[#854F0B] transition-colors">
            <div className="w-8 h-8 rounded-full bg-[#854F0B] flex items-center justify-center flex-shrink-0">
              <i className="ti ti-upload text-white text-[13px]" />
            </div>
            <span className="text-[13px] text-[#A0AEC0]">내 템플릿을 공유해보세요...</span>
            <i className="ti ti-arrow-right text-[#A0AEC0] text-[14px] ml-auto" />
          </button>
        )}

        {/* 목록 */}
        {loading ? (
          <div className="flex justify-center py-12 text-[13px] text-[#64748B]">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[14px] p-10 text-center">
            <i className="ti ti-file-off text-[32px] text-[#D1D5DB] block mb-3" />
            <p className="text-[13px] text-[#64748B]">
              {search || fieldFilter !== 'all' ? '검색 결과가 없어요' : '아직 공유된 템플릿이 없어요'}
            </p>
            {user && (
              <button onClick={() => navigate('/blog/write')}
                className="mt-4 px-4 py-2 bg-[#854F0B] text-white rounded-[8px] text-[12px] font-semibold">
                첫 번째로 공유하기
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-10">
            {filtered.map((post) => {
              const tmpl = post.parsedTemplate
              const fieldInfo = FIELD_LABELS[tmpl.fieldType] ?? { label: tmpl.fieldType, icon: '📁' }
              return (
                <div key={post.id} className="bg-white rounded-[14px] p-4 border border-transparent hover:border-[#E2E8F0] hover:shadow-md transition-all">
                  <div className="flex items-start gap-3">
                    {/* 아이콘 */}
                    <div className="w-11 h-11 rounded-[10px] bg-[#FAEEDA] flex items-center justify-center flex-shrink-0 text-[20px]">
                      {fieldInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[15px] font-bold text-[#1A1A2E] truncate">{tmpl.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAEEDA] text-[#854F0B] font-semibold whitespace-nowrap">
                          {fieldInfo.label}
                        </span>
                      </div>
                      {tmpl.description && (
                        <p className="text-[12px] text-[#64748B] line-clamp-2 mb-2">{tmpl.description}</p>
                      )}
                      {/* 파트 목록 */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {tmpl.parts.map((p, i) => (
                          <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-[#F4F6F9] rounded text-[#64748B]">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            {p.name}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#A0AEC0]">
                        <span>{tmpl.authorName}</span>
                        <span>·</span>
                        <span>파트 {tmpl.parts.length}개</span>
                        <span>·</span>
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 영역 */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#F4F6F9]">
                    <button onClick={() => setPreviewPost(post)}
                      className="flex-1 h-[36px] bg-[#F4F6F9] text-[#64748B] rounded-[8px] text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#E2E8F0] transition-colors">
                      <i className="ti ti-eye text-[13px]" /> 미리보기
                    </button>
                    <button onClick={() => downloadTemplate(post)}
                      className="flex-1 h-[36px] bg-[#854F0B] text-white rounded-[8px] text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#6B3E08] transition-colors">
                      <i className="ti ti-download text-[13px]" /> .thanq 받기
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 미리보기 모달 */}
      {previewPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setPreviewPost(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] p-5 pb-8 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-bold text-[#1A1A2E]">{previewPost.parsedTemplate.name}</div>
              <button onClick={() => setPreviewPost(null)}>
                <i className="ti ti-x text-[18px] text-[#A0AEC0]" />
              </button>
            </div>

            {previewPost.parsedTemplate.description && (
              <p className="text-[13px] text-[#64748B] mb-4 leading-relaxed">{previewPost.parsedTemplate.description}</p>
            )}

            <div className="text-[12px] font-semibold text-[#64748B] mb-2">파트 구성 ({previewPost.parsedTemplate.parts.length}개)</div>
            <div className="flex flex-col gap-2 mb-5">
              {previewPost.parsedTemplate.parts.map((p, i) => (
                <div key={i} className="bg-[#F4F6F9] rounded-[10px] p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-[13px] font-bold text-[#1A1A2E]">{p.name}</span>
                    <span className="ml-auto text-[11px] text-[#A0AEC0]">
                      큐 {p.cueItems.length} · 체크 {p.checkItems.length}
                    </span>
                  </div>
                  {p.cueItems.length > 0 && (
                    <div className="flex flex-col gap-1 ml-5">
                      {p.cueItems.slice(0, 3).map((c, j) => (
                        <div key={j} className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                          <i className="ti ti-clock text-[10px]" />{c.startTime} {c.title}
                        </div>
                      ))}
                      {p.cueItems.length > 3 && (
                        <div className="text-[11px] text-[#A0AEC0]">+{p.cueItems.length - 3}개 더</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => { downloadTemplate(previewPost); setPreviewPost(null) }}
              className="w-full h-[46px] bg-[#854F0B] text-white rounded-[12px] text-[14px] font-bold flex items-center justify-center gap-2">
              <i className="ti ti-download text-[16px]" /> .thanq 파일 받기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
