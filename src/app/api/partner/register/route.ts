import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { partnerId, password, companyName, contactName, phone, businessNumber } = body;

    if (!partnerId || !password || !companyName || !contactName || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if ID already exists
    const existingPartner = await adminDb.collection('partners').where('partnerId', '==', partnerId).get();
    if (!existingPartner.empty) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
    }

    const newPartner = {
      partnerId,
      password, // Note: In a real production app, this should be hashed. Keeping plain for MVP prototype.
      companyName,
      contactName,
      phone,
      businessNumber: businessNumber || '',
      status: 'pending', // pending, approved, rejected
      createdAt: new Date().toISOString(),
      coins: 0,
      unlockedQuotes: [],
    };

    await adminDb.collection('partners').add(newPartner);

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
          subject: '[알림] 🚀 새로운 제휴사 입점 신청이 접수되었습니다.',
          html: `
            <h2>새로운 제휴사 입점 신청</h2>
            <p><strong>희망 아이디:</strong> ${partnerId}</p>
            <p><strong>업체명(상호):</strong> ${companyName}</p>
            <p><strong>담당자 성함:</strong> ${contactName}</p>
            <p><strong>연락처:</strong> ${phone}</p>
            <p><strong>사업자번호:</strong> ${businessNumber || '미입력'}</p>
            <hr />
            <p>관리자 페이지에 접속하여 승인 처리를 진행해 주세요.</p>
          `
        });
      }
    } catch (mailError) {
      console.error('Failed to send registration notification email:', mailError);
      // We don't fail the registration if email fails
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error registering partner:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
