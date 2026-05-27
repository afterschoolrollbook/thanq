import { useNavigate } from 'react-router-dom'
import { FIELD_LABELS, FIELD_TERMS } from '@/utils/fieldTerms'
import type { FieldType } from '@/types'

const FIELDS: FieldType[] = ['event', 'film', 'concert', 'fashion', 'sports', 'broadcast', 'custom']

export default function FieldSelectPage() {
  const navigate = useNavigate()

  function handleSelect(field: FieldType) {
    // 선택한 분야를 sessionStorage에 임시 저장
    sessionStorage.setItem('oncue_field', field)
    sessionStorage.setItem('oncue_terms', JSON.stringify(FIELD_TERMS[field]))
    navigate('/onboarding/create')
  }

  return (
    <div className="min-h-screen bg-oncue-bg">
      {/* 상단 */}
      <header className="bg-primary text-white px-4 py-3">
        <span className="font-bold text-lg">OnCue</span>
      </header>

      {/* 스텝 바 */}
      <div className="bg-white border-b border-oncue-border px-4 py-3 flex items-center gap-2 max-w-lg mx-auto">
        <StepDot done label="계정" />
        <StepLine />
        <StepDot active label="분야" />
        <StepLine />
        <StepDot label="프로젝트" />
        <StepLine />
        <StepDot label="파트 구성" />
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
        <h2 className="text-lg font-bold text-oncue-text mb-1">어떤 현장에서 사용하실 건가요?</h2>
        <p className="text-oncue-muted text-sm mb-5">선택한 분야에 맞는 용어와 템플릿이 자동으로 세팅됩니다.</p>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((field) => {
            const { label, icon, desc } = FIELD_LABELS[field]
            return (
              <button
                key={field}
                onClick={() => handleSelect(field)}
                className="oncue-card p-4 text-left hover:border-primary hover:shadow-card-hover transition-all border border-transparent active:scale-95"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-3">
                  <i className={`ti ${icon} text-primary text-lg`} />
                </div>
                <div className="font-semibold text-sm text-oncue-text mb-1">{label}</div>
                <div className="text-xs text-oncue-muted leading-relaxed">{desc}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StepDot({ done, active, label }: { done?: boolean; active?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? 'bg-status-done text-white' : active ? 'bg-primary text-white' : 'bg-oncue-border text-oncue-muted'
      }`}>
        {done ? <i className="ti ti-check text-xs" /> : null}
      </div>
      <span className={`text-[10px] ${active ? 'text-primary font-semibold' : 'text-oncue-muted'}`}>{label}</span>
    </div>
  )
}

function StepLine() {
  return <div className="flex-1 h-px bg-oncue-border mt-[-10px]" />
}
