import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref as dbRef, push, set } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Topbar } from '@/components/ui/Common'
import type { BlogCategory, TemplateFile } from '@/types'

const CATEGORIES: { key: BlogCategory; label: string; icon: string }[] = [
  { key: 'notice',   label: '공지',        icon: 'ti-speakerphone' },
  { key: 'tip',      label: '노하우',      icon: 'ti-bulb' },
  { key: 'template', label: '템플릿 공유', icon: 'ti-file-export' },
  { key: 'free',     label: '자유게시판',  icon: 'ti-message' },
]

export default function BlogWritePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<BlogCategory>('free')
  const [templateFile, setTemplateFile] = useState<TemplateFile | null>(null)
  const [templateFileName, setTemplateFileName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) {
    navigate('/login')
    return null
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.thanq')) {
      setError('ThanQ 템플릿 파일(.thanq)만 첨부할 수 있어요')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as TemplateFile
        if (parsed.version !== '1.0' || !parsed.parts) throw new Error()
        setTemplateFile(parsed)
        setTemplateFileName(file.name)
        setError('')
        if (!title) setTitle(`[템플릿] ${parsed.name}`)
        if (!content) setContent(parsed.description || '')
        setCategory('template')
      } catch {
        setError('올바른 ThanQ 템플릿 파일이 아니에요')
      }
    }
    reader.readAsText(file)
  }

  function removeTemplate() {
    setTemplateFile(null)
    setTemplateFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (!content.trim()) { setError('내용을 입력해주세요'); return }
    setSaving(true)
    try {
      const newRef = push(dbRef(db, 'blog'))
      await set(newRef, {
        id: newRef.key,
        title: title.trim(),
        content: content.trim(),
        category,
        authorId: user.uid,
        authorName: user.displayName ?? '익명',
        likes: 0,
        viewCount: 0,
        templateFile: templateFile ? JSON.stringify(templateFile) : null,
        templateName: templateFile?.name ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      navigate('/blog')
    } catch {
      setError('저장 중 오류가 발생했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <div className="max-w-2xl mx-auto px-5 pt-5 pb-16">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/blog')} className="text-[#64748B] hover:text-[#1A1A2E]">
            <i className="ti ti-arrow-left text-[18px]" />
          </button>
          <h1 className="text-[18px] font-bold text-[#1A1A2E]">글쓰기</h1>
        </div>

        <div className="bg-white rounded-[14px] p-5 flex flex-col gap-4">

          {/* 카테고리 */}
          <div>
            <label className="text-[12px] font-semibold text-[#64748B] mb-2 block">카테고리</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button key={cat.key} onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                    category === cat.key
                      ? 'bg-[#185FA5] text-white border-[#185FA5]'
                      : 'bg-white text-[#64748B] border-[#E2E8F0]'
                  }`}>
                  <i className={`ti ${cat.icon} text-[13px]`} />{cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="text-[12px] font-semibold text-[#64748B] mb-1.5 block">제목</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full h-[42px] border border-[#E2E8F0] rounded-[10px] px-3 text-[14px] text-[#1A1A2E] focus:outline-none focus:border-[#185FA5]" />
          </div>

          {/* 내용 */}
          <div>
            <label className="text-[12px] font-semibold text-[#64748B] mb-1.5 block">내용</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={8}
              className="w-full border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#185FA5] resize-none" />
          </div>

          {/* 템플릿 파일 첨부 */}
          <div>
            <label className="text-[12px] font-semibold text-[#64748B] mb-1.5 block">
              템플릿 파일 첨부 <span className="font-normal text-[#A0AEC0]">(선택 · .thanq 파일)</span>
            </label>
            {templateFile ? (
              <div className="flex items-center gap-3 p-3 bg-[#FAEEDA] rounded-[10px]">
                <i className="ti ti-file-zip text-[#854F0B] text-[20px]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#854F0B] truncate">{templateFile.name}</div>
                  <div className="text-[11px] text-[#A0AEC0]">{templateFileName} · 파트 {templateFile.parts.length}개</div>
                </div>
                <button onClick={removeTemplate} className="text-[#A0AEC0] hover:text-[#E24B4A]">
                  <i className="ti ti-x text-[16px]" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full h-[60px] border-2 border-dashed border-[#E2E8F0] rounded-[10px] flex items-center justify-center gap-2 text-[13px] text-[#64748B] hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                <i className="ti ti-upload text-[16px]" />
                .thanq 파일을 첨부하세요
              </button>
            )}
            <input ref={fileRef} type="file" accept=".thanq" className="hidden" onChange={handleFileUpload} />
          </div>

          {error && <p className="text-[12px] text-[#A32D2D]">{error}</p>}

          <button onClick={handleSubmit} disabled={saving}
            className="h-[44px] bg-[#185FA5] text-white rounded-[10px] text-[14px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <i className="ti ti-send text-[15px]" />
            {saving ? '게시 중...' : '게시하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
