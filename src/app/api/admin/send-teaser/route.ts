import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { password, quoteId, targetEmails, teaserType } = await req.json();

    // Check master password
    if (password !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!quoteId || !targetEmails || !targetEmails.length) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Fetch quote details
    const quoteDoc = await adminDb.collection('quote_requests').doc(quoteId).get();
    if (!quoteDoc.exists) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const quoteData = quoteDoc.data()!;
    const region = quoteData.region || '미정';
    const expectedDate = quoteData.expectedDate || '미정';
    
    // Summarize equipments
    let equipmentSummary = '-';
    if (quoteData.equipments && quoteData.equipments.length > 0) {
      const counts = quoteData.equipments.reduce((acc: any, eq: any) => {
        let label = eq.type;
        if (label === 'Reformer') label = '리포머';
        if (label === 'Cadillac') label = '캐딜락';
        if (label === 'Chair') label = '체어';
        if (label === 'Barrel') label = '바렐';
        if (label === 'Custom') label = eq.customLabel || '가구';
        if (label === 'Door') label = '출입문';
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      equipmentSummary = Object.entries(counts)
        .filter(([key]) => key !== '출입문' && key !== '가구')
        .map(([key, count]) => `${key} ${count}대`)
        .join(', ');
    }

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pilates-space-optimizer.vercel.app';

    // 스팸 회피를 위해 BCC 대신 1:1 개별 발송으로 변경
    let successCount = 0;
    
    for (const email of targetEmails) {
      let subject = '';
      let htmlContent = '';

      if (teaserType === 'interior') {
        subject = `[필라테스 인테리어 견적요청] ${region} 지역 신규 센터 시공 건`;
        htmlContent = `
          <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #111827; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">새로운 인테리어 견적 요청</h1>
            </div>
            <div style="padding: 32px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                안녕하세요, 대표님!<br/><br/>
                <strong>${region}</strong> 지역에서 새로운 필라테스 센터 오픈을 위한 인테리어 시공 견적 요청이 접수되었습니다.
              </p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <h3 style="margin-top: 0; margin-bottom: 12px; color: #111827;">📌 요청 요약 정보</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                  <li><strong>시공 예정 지역:</strong> ${region}</li>
                  <li><strong>오픈 예정 시기:</strong> ${expectedDate}</li>
                </ul>
              </div>
              
              <p style="font-size: 15px; color: #ef4444; font-weight: bold; text-align: center; margin-bottom: 24px;">
                * 고객이 직접 작성한 상세 도면(레이아웃)과 공간 정보, 연락처는 파트너 가입 후 확인하실 수 있습니다.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}/partner" style="background-color: #3b82f6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  👉 파트너 가입하고 도면 레이아웃 확인하기
                </a>
              </div>
            </div>
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                본 메일은 인테리어 및 기구 제휴사 시범 운영 안내를 위해 발송되었습니다.<br/>
                발신 전용이며, 문의사항이 있으시면 고객센터로 연락 바랍니다.
              </p>
            </div>
          </div>
        `;
      } else {
        // default: equipment
        subject = `[필라테스 기구 견적요청] ${region} 지역 신규 오픈 건`;
        htmlContent = `
          <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #111827; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">새로운 견적 요청</h1>
            </div>
            <div style="padding: 32px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                안녕하세요, 대표님!<br/><br/>
                <strong>${region}</strong> 지역에서 새로운 필라테스 센터 오픈 견적 요청이 접수되었습니다.
              </p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <h3 style="margin-top: 0; margin-bottom: 12px; color: #111827;">📌 요청 요약 정보</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                  <li><strong>오픈 예정 지역:</strong> ${region}</li>
                  <li><strong>오픈 예정 시기:</strong> ${expectedDate}</li>
                  <li><strong>필요 예상 기구:</strong> ${equipmentSummary}</li>
                </ul>
              </div>
              
              <p style="font-size: 15px; color: #ef4444; font-weight: bold; text-align: center; margin-bottom: 24px;">
                * 고객의 상세 도면과 연락처는 파트너 가입 후 확인하실 수 있습니다.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}/partner" style="background-color: #3b82f6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  👉 파트너 가입하고 도면 확인하기
                </a>
              </div>
            </div>
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                본 메일은 인테리어 및 기구 제휴사 시범 운영 안내를 위해 발송되었습니다.<br/>
                발신 전용이며, 문의사항이 있으시면 고객센터로 연락 바랍니다.
              </p>
            </div>
          </div>
        `;
      }

      const mailOptions = {
        from: `"PILA-SPACE 관리자" <${process.env.EMAIL_USER}>`,
        to: email, // 개별 수신자
        subject: subject,
        html: htmlContent,
      };

      try {
        await transporter.sendMail(mailOptions);
        successCount++;
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
      }
    }

    console.log(`Teaser emails sent: ${successCount} / ${targetEmails.length}`);

    return NextResponse.json({ success: true, sentCount: successCount });
  } catch (error: any) {
    console.error('Error sending teaser emails:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}
