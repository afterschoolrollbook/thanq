import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '@/lib/firebase'

const functions = getFunctions(app, 'asia-northeast3') // 서울 리전

interface InviteEmailParams {
  toEmail: string       // 받는 사람 이메일
  toName: string        // 받는 사람 이름
  projectName: string   // 프로젝트 이름
  partName?: string     // 파트 이름 (선택)
  joinCode: string      // 참여 코드
  joinLink: string      // 참여 링크
}

/**
 * 초대 이메일 발송
 * Firebase Function 'sendInviteEmail' 호출
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<void> {
  const fn = httpsCallable(functions, 'sendInviteEmail')
  const result = await fn(params) as { data: { success: boolean } }
  if (!result.data.success) {
    throw new Error('이메일 발송에 실패했어요')
  }
}
