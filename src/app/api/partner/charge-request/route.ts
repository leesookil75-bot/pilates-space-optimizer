import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { partnerId, password, depositorName } = await req.json();

    if (!partnerId || !password || !depositorName) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify against 'partners' collection
    const partnerSnapshot = await adminDb.collection('partners')
      .where('partnerId', '==', partnerId)
      .where('password', '==', password)
      .get();

    if (partnerSnapshot.empty) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const partnerData = partnerSnapshot.docs[0].data();

    // Send email notification to Admin
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD,
        },
      });

      const settingsDoc = await adminDb.collection('settings').doc('systemConfig').get();
      const adminEmail = settingsDoc.exists ? settingsDoc.data()?.adminEmail : process.env.EMAIL_USER;

      if (adminEmail) {
        await transporter.sendMail({
          from: `"Pilates Space 알림" <${process.env.EMAIL_USER}>`,
          to: adminEmail,
          subject: `[알림] 💰 ${depositorName} 님의 코인 충전 확인 요청입니다.`,
          html: `
            <h2>코인 충전(입금) 확인 요청</h2>
            <p><strong>업체명:</strong> ${partnerData.companyName} (${partnerId})</p>
            <p><strong>입금자명:</strong> <span style={{color: 'red', fontWeight: 'bold'}}>${depositorName}</span></p>
            <p><strong>담당자 성함:</strong> ${partnerData.contactName}</p>
            <p><strong>연락처:</strong> ${partnerData.phone}</p>
            <hr />
            <p>은행 계좌 입금 내역을 확인하신 후, 관리자 페이지 [제휴사 파트너 관리] 탭에서 수동으로 코인을 충전해 주세요.</p>
          `
        });
      }
    } catch (mailError) {
      console.error('Failed to send charge request email:', mailError);
      return NextResponse.json({ error: 'Failed to send notification email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error handling charge request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
