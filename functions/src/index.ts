import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Resend } from 'resend'

admin.initializeApp()
const db = admin.database()

// ─────────────────────────────────────────────────────────
// 초대 이메일 발송 함수
// 호출: httpsCallable('sendInviteEmail')
// ─────────────────────────────────────────────────────────
export const sendInviteEmail = functions
  .region('asia-northeast3') // 서울 리전
  .https.onCall(async (data, context) => {

    // 1. 로그인 확인
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '로그인이 필요해요')
    }

    const { toEmail, toName, projectName, partName, joinCode, joinLink } = data as {
      toEmail: string
      toName: string
      projectName: string
      partName: string
      joinCode: string
      joinLink: string
    }

    // 2. 입력값 확인
    if (!toEmail || !projectName || !joinCode) {
      throw new functions.https.HttpsError('invalid-argument', '필수 정보가 빠져있어요')
    }

    // 3. Firebase에서 이메일 설정 불러오기
    const settingsSnap = await db.ref('siteSettings/email').once('value')
    if (!settingsSnap.exists()) {
      throw new functions.https.HttpsError('failed-precondition', '이메일 설정이 되어있지 않아요. 관리자 페이지에서 설정해주세요.')
    }

    const settings = settingsSnap.val() as {
      apiKey: string
      from: string
      enabled: boolean
    }

    if (!settings.enabled) {
      throw new functions.https.HttpsError('failed-precondition', '이메일 발송이 비활성화되어 있어요')
    }
    if (!settings.apiKey || !settings.from) {
      throw new functions.https.HttpsError('failed-precondition', 'API Key 또는 발신 이메일이 설정되지 않았어요')
    }

    // 4. Resend로 이메일 발송
    const resend = new Resend(settings.apiKey)

    const displayName = toName || '안녕하세요'

    const { error } = await resend.emails.send({
      from: settings.from,
      to: toEmail,
      subject: `[ThanQ] ${projectName} 참여 초대`,
      html: `
        <!DOCTYPE html>
        <html lang="ko">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- 헤더 -->
            <div style="background:#185FA5;padding:32px 32px 24px;">
              <div style="color:#fff;font-size:22px;font-weight:700;margin-bottom:4px;">ThanQ</div>
              <div style="color:#A8C8F0;font-size:13px;">현장 운영 플랫폼</div>
            </div>

            <!-- 본문 -->
            <div style="padding:32px;">
              <p style="margin:0 0 8px;color:#64748B;font-size:13px;">안녕하세요, <strong style="color:#1A1A2E;">${displayName}</strong>님</p>
              <h2 style="margin:0 0 24px;color:#1A1A2E;font-size:20px;font-weight:700;line-height:1.4;">
                <span style="color:#185FA5;">${projectName}</span>에<br/>초대받으셨어요! 🎉
              </h2>

              ${partName ? `
              <div style="background:#F4F6F9;border-radius:12px;padding:16px;margin-bottom:24px;">
                <div style="font-size:11px;color:#64748B;margin-bottom:4px;">배정된 파트</div>
                <div style="font-size:15px;font-weight:600;color:#1A1A2E;">${partName}</div>
              </div>` : ''}

              <!-- 참여 코드 -->
              <div style="background:#EAF3DE;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
                <div style="font-size:11px;color:#3B6D11;font-weight:600;margin-bottom:8px;">참여 코드</div>
                <div style="font-size:28px;font-weight:800;color:#3B6D11;letter-spacing:6px;">${joinCode}</div>
              </div>

              <!-- 참여 버튼 -->
              <a href="${joinLink}" style="display:block;background:#185FA5;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-size:15px;font-weight:600;margin-bottom:24px;">
                🚀 지금 바로 참여하기
              </a>

              <p style="margin:0;color:#A0AEC0;font-size:11px;line-height:1.6;">
                버튼이 작동하지 않으면 아래 링크를 복사해서 브라우저에 붙여넣으세요.<br/>
                <span style="color:#185FA5;">${joinLink}</span>
              </p>
            </div>

            <!-- 푸터 -->
            <div style="background:#F4F6F9;padding:20px 32px;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#A0AEC0;font-size:11px;">
                이 메일은 ThanQ 현장 운영 플랫폼에서 발송되었습니다.<br/>
                본인이 초대를 요청하지 않았다면 이 메일을 무시하세요.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend 오류:', error)
      throw new functions.https.HttpsError('internal', `이메일 발송 실패: ${error.message}`)
    }

    return { success: true }
  })
