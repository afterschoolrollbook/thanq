import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { FIELD_TERMS } from '@/utils/fieldTerms'
import { Topbar, StepBar } from '@/components/ui/Common'
import type { FieldType } from '@/types'

const FIELDS = [
  { key: 'event' as FieldType,     name: '행사 / 축제',   desc: '대학 축제, 기업 행사, 박람회',  icon: 'ti-confetti',  bg: '#E6F1FB', color: '#185FA5' },
  { key: 'film' as FieldType,      name: '드라마 / 영화',  desc: '촬영 현장, 광고, MV',           icon: 'ti-video',     bg: '#EEEDFE', color: '#534AB7' },
  { key: 'concert' as FieldType,   name: '콘서트 / 공연',  desc: '콘서트, 뮤지컬, 연극',          icon: 'ti-music',     bg: '#E1F5EE', color: '#0F6E56' },
  { key: 'fashion' as FieldType,   name: '패션쇼',         desc: '런웨이, 브랜드 쇼케이스',       icon: 'ti-hanger',    bg: '#FBEAF0', color: '#993556' },
  { key: 'sports' as FieldType,    name: '스포츠 / 대회',  desc: '마라톤, 체육대회, e스포츠',     icon: 'ti-trophy',    bg: '#FAEEDA', color: '#854F0B' },
  { key: 'broadcast' as FieldType, name: '방송 / 생방송',  desc: 'TV, 유튜브 라이브',             icon: 'ti-broadcast',    bg: '#FAECE7', color: '#993C1D' },
  { key: 'club' as FieldType,      name: '모임 / 클럽',    desc: '드라이브, 라이딩, 러닝, 등산',  icon: 'ti-users-group',  bg: '#E8F5E9', color: '#2E7D32' },
]

export default function FieldSelectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [selected, setSelected] = useState<FieldType | null>(null)
  const [custom, setCustom] = useState('')

  // Firebase에서 이전에 선택한 분야 불러오기
  useEffect(() => {
    if (!user) return
    onValue(ref(db, `drafts/${user.uid}/fieldType`), (snap) => {
      if (snap.exists()) {
        const val = snap.val() as FieldType
        if (val === 'custom') return
        setSelected(val)
      }
    }, { onlyOnce: true })
  }, [user])

  function handleSelect(field: FieldType) {
    setSelected(field)
    setCustom('')
    if (user) update(ref(db, `drafts/${user.uid}`), { fieldType: field })
  }

  function handleCustom(val: string) {
    setCustom(val)
    setSelected(null)
    if (user) update(ref(db, `drafts/${user.uid}`), { fieldType: 'custom', customField: val })
  }

  function handleNext() {
    const field = selected ?? 'custom'
    // sessionStorage는 보조용으로만 유지
    sessionStorage.setItem('oncue_field', field)
    sessionStorage.setItem('oncue_terms', JSON.stringify(FIELD_TERMS[field]))
    navigate('/onboarding/create')
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Topbar />
      <StepBar step={2} />
      <div className="max-w-2xl mx-auto px-5 pt-7 pb-10">
        <h2 className="text-[20px] font-semibold text-[#1A1A2E] mb-1">어떤 현장에서 사용하실 건가요?</h2>
        <p className="text-[13px] text-[#64748B] mb-6 leading-relaxed">선택한 분야에 맞는 용어와 템플릿이 자동으로 세팅됩니다. 나중에 언제든 변경 가능해요.</p>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {FIELDS.map(({ key, name, desc, icon, bg, color }) => (
            <button key={key} onClick={() => handleSelect(key)}
              className={`text-left p-3.5 rounded-[14px] border-2 transition-all ${selected === key ? 'border-[#185FA5] bg-[#E6F1FB]' : 'border-[#E2E8F0] bg-white hover:border-[#185FA5]'}`}>
              <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-2" style={{ background: bg }}>
                <i className={`ti ${icon} text-[18px]`} style={{ color }} />
              </div>
              <div className="text-[13px] font-semibold text-[#1A1A2E]">{name}</div>
              <div className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{desc}</div>
              {selected === key && (
                <div className="inline-flex items-center gap-1 mt-1.5 bg-[#185FA5] text-white text-[10px] px-2 py-0.5 rounded-full">
                  <i className="ti ti-check text-[10px]" /> 선택됨
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3.5 py-3 border border-dashed border-[#E2E8F0] rounded-[10px] mb-6">
          <i className="ti ti-pencil text-[16px] text-[#A0AEC0]" />
          <input className="flex-1 bg-transparent outline-none text-[13px] text-[#1A1A2E] placeholder-[#A0AEC0]"
            placeholder="직접 입력 — 다른 현장이라면 여기에 입력하세요"
            value={custom} onChange={(e) => handleCustom(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <button onClick={handleNext} disabled={!selected && !custom.trim()}
            className="h-[38px] px-5 bg-[#185FA5] text-white rounded-[10px] flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40">
            <i className="ti ti-arrow-right" /> 다음
          </button>
        </div>
      </div>
    </div>
  )
}
