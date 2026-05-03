import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const {
      name,
      phone,
      region,
      expectedDate,
      email,
      rooms,
      equipments,
    } = body;

    if (!name || !phone || !region) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docData = {
      name,
      phone,
      region,
      expectedDate,
      rooms: rooms || [],
      equipments: equipments || [],
      customerEmail: email || null,
      userEmail: session?.user?.email || null,
      userName: session?.user?.name || null,
      status: '신규 접수',
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore 'quote_requests' collection
    const docRef = await adminDb.collection('quote_requests').add(docData);

    // Send Email Notifications
    if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pilates-space-optimizer.vercel.app';
      
      // 1. Email to Admin
      const adminMailOptions = {
        from: `"PILA-SPACE 시스템" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER, // Admin email
        subject: `[신규 견적 접수] ${region} 지역 견적 요청이 도착했습니다.`,
        html: `
          <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #3b82f6;">새로운 견적이 접수되었습니다! 🎉</h2>
            <p><strong>고객명:</strong> ${name}</p>
            <p><strong>지역:</strong> ${region}</p>
            <p><strong>연락처:</strong> ${phone}</p>
            <p><strong>희망일정:</strong> ${expectedDate}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <a href="${appUrl}/admin" style="display: inline-block; background-color: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">관리자 페이지에서 확인하기</a>
          </div>
        `
      };

      // 2. Email to Consumer
      const consumerMailOptions = {
        from: `"PILA-SPACE" <${process.env.EMAIL_USER}>`,
        to: email || session?.user?.email,
        subject: `[필라테스 스페이스] ${name}님의 견적 요청이 정상적으로 접수되었습니다.`,
        html: `
          <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #10b981;">견적 요청 접수 완료 ✅</h2>
            <p>안녕하세요, ${name}님!</p>
            <p>작성해주신 <strong>${region}</strong> 지역 필라테스 센터 오픈 견적 요청이 성공적으로 접수되었습니다.</p>
            <p>관리자 검토 후 검증된 제휴 파트너사들에게 전달되며, 파트너사들이 분석 후 맞춤 견적서를 보내드릴 예정입니다.</p>
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #4b5563; font-size: 14px;">파트너사들의 견적서가 도착하면 이메일로 다시 안내해 드립니다. 진행 상황은 언제든지 홈페이지에서 확인하실 수 있습니다.</p>
            </div>
            <a href="${appUrl}/mypage" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">내 견적함 바로가기</a>
          </div>
        `
      };

      try {
        await transporter.sendMail(adminMailOptions);
        if (consumerMailOptions.to) {
          await transporter.sendMail(consumerMailOptions);
        }
      } catch (err) {
        console.error('Email sending failed during quote submission:', err);
      }
    }

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('Error saving quote request:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
