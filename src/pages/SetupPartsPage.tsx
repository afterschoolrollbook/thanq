import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ref, push, update } from 'firebase/database'
import { db } from '@/lib/firebase'
import { PART_COLORS } from '@/utils/fieldTerms'
import type { Part } from '@/types'

const PRESET_PARTS = ['무대', '음향', '조명', '영상', '진행', '안전', '케이터링', '포토']

export default function SetupPartsPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [parts, setParts] = useState<{ name: string }[]>([{ name: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addPart() {
    setParts([...parts, { name: '' }])
  }

  function removePart(idx: number) {
    setParts(parts.filter((_, i) => i !== idx))
  }

  function updatePart(idx: number, name: string) {
    setParts(parts.map((p, i) => (i === idx ? { name } : p)))
  }

  function addPreset(name: string) {
    if (parts.some((p) => p.name === name)) return
    const empty = parts.findIndex((p) => p.name === '')
    if (empty >= 0) {
      updatePart(empty, name)
    } else {
      setParts([...parts, { name }])
    }
  }

  async function handleSave() {
    const valid = parts.filter((p) => p.name.trim())
    if (valid.length === 0) {
      setError('파트를 최소 1개 이상 입력해주세요')
      return
    }

    setLoading(true)
    setError('')
    try {
      const updates: Record<string, unknown> = {}

      valid.forEach((p, idx) => {
        const partRef = push(ref(db, `parts/${projectId}`))
        const part: Part = {
          id: partRef.key!,
          projectId: projectId!,
          name: p.name.trim(),
          color: PART_COLORS[idx % PART_COLORS.length],
          status: 'waiting',
          progress: 0,
          order: idx,
          createdAt: new Date().toISOString(),
        }
        updates[`parts/${projectId}/${part.id}`] = part
      })

      await update(ref(db), updates)
      navigate(`/p/${projectId}/home`)
    } catch (e) {
      setError('저장 중 오류가 발생했어요')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    navigate(`/p/${projectId}/home`)
  }

  return (
    <div className="min-h-screen bg-oncue-bg">
      {/* 헤더 */}
      <header className="bg-primary text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <span className="font-bold text-lg">ThanQ</span>
      </header>

      {/* 스텝 바 */}
      <div className="bg-white border-b border-oncue-border px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <StepDot done label="계정" />
          <StepLine />
          <StepDot done label="분야" />
          <StepLine />
          <StepDot done label="프로젝트" />
          <StepLine />
          <StepDot active label="파트 구성" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
        <h2 className="text-lg font-bold text-oncue-text mb-1">파트 구성</h2>
        <p className="text-oncue-muted text-sm mb-5">현장을 운영할 파트를 만들어주세요. 나중에 추가할 수도 있어요.</p>

        {/* 프리셋 버튼 */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-oncue-muted mb-2">빠른 추가</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_PARTS.map((name) => (
              <button
                key={name}
                onClick={() => addPreset(name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  parts.some((p) => p.name === name)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-oncue-muted border-oncue-border hover:border-primary hover:text-primary'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* 파트 목록 */}
        <div className="space-y-3 mb-4">
          {parts.map((part, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: PART_COLORS[idx % PART_COLORS.length] }}
              />
              <input
                className="input-field flex-1"
                placeholder={`파트 ${idx + 1} 이름`}
                value={part.name}
                onChange={(e) => updatePart(idx, e.target.value)}
              />
              {parts.length > 1 && (
                <button
                  onClick={() => removePart(idx)}
                  className="w-8 h-8 flex items-center justify-center text-oncue-muted hover:text-status-urgent transition-colors"
                >
                  <i className="ti ti-x text-sm" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 파트 추가 버튼 */}
        <button
          onClick={addPart}
          className="btn-outline w-full justify-center mb-6"
        >
          <i className="ti ti-plus" />
          파트 추가
        </button>

        {error && <p className="text-status-urgent text-sm mb-3">{error}</p>}

        {/* 참여 코드 안내 */}
        <div className="oncue-card p-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
            <i className="ti ti-key text-primary text-sm" />
          </div>
          <div>
            <p className="text-sm font-semibold text-oncue-text mb-0.5">팀원 초대</p>
            <p className="text-xs text-oncue-muted">프로젝트 생성 후 참여 코드를 공유하면 팀원들이 바로 합류할 수 있어요</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary w-full justify-center mb-3"
        >
          <i className="ti ti-check" />
          {loading ? '저장 중...' : '파트 저장하고 시작하기'}
        </button>

        <button
          onClick={handleSkip}
          className="w-full text-center text-oncue-muted text-sm py-2"
        >
          나중에 설정할게요
        </button>
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
