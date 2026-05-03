import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { partnerId, password, quoteId, estimatePrice, message, fileUrl } = await req.json();

    if (!partnerId || !password || !quoteId || !fileUrl) {
      return NextResponse.json({ error: 'Missing parameters. File attachment is required.' }, { status: 400 });
    }

    // 1. Verify partner
    const partnerSnapshot = await adminDb.collection('partners')
      .where('partnerId', '==', partnerId)
      .where('password', '==', password)
      .get();

    if (partnerSnapshot.empty) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const partnerData = partnerSnapshot.docs[0].data();

    // 2. Fetch settings for estimateCost
    const settingsDoc = await adminDb.collection('settings').doc('systemConfig').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : null;
    const estimateCost = settings?.estimateCost || 5000;

    // 3. Check if already estimated or unlocked
    const isUnlocked = partnerData.unlockedQuotes?.includes(quoteId);
    const isEstimated = partnerData.estimatedQuotes?.includes(quoteId);
    const isFreeToSend = isUnlocked || isEstimated;

    // 4. Check coin balance if not free
    if (!isFreeToSend && (partnerData.coins || 0) < estimateCost) {
      return NextResponse.json({ error: `견적 발송에 필요한 코인이 부족합니다. (필요: ${estimateCost} 코인, 보유: ${partnerData.coins || 0} 코인)` }, { status: 403 });
    }

    // 5. Get the quote data to find the customer's email
    const quoteDoc = await adminDb.collection('quote_requests').doc(quoteId).get();
    if (!quoteDoc.exists) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    
    const quoteData = quoteDoc.data();
    const customerEmail = quoteData?.customerEmail || quoteData?.userEmail;

    if (!customerEmail) {
      return NextResponse.json({ error: '고객의 이메일 주소가 등록되어 있지 않아 발송할 수 없습니다.' }, { status: 400 });
    }

    // 4. Send email using Nodemailer
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const formatPrice = (price: string) => {
      // Add commas to number string
      return price.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    await transporter.sendMail({
      from: `"필라테스 스페이스" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `[필라테스 스페이스] ${quoteData.region} 오픈 건에 대한 맞춤 견적서가 도착했습니다.`,
      html: `
        <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #3b82f6; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">맞춤 견적서 도착</h1>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #374151;">고객님께서 요청하신 <strong>${quoteData.region}</strong> 지역 필라테스 센터 오픈 건에 대해 제휴 파트너사의 맞춤 견적이 도착했습니다.</p>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <h2 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #d1d5db; padding-bottom: 8px;">제안 내역 요약</h2>
              <table style="width: 100%; border-collapse: collapse;">
                ${estimatePrice ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 100px;">예상 총액</td>
                  <td style="padding: 8px 0; color: #ef4444; font-size: 20px; font-weight: bold;">대략 ${formatPrice(estimatePrice)} 원</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 100px;">제안 업체</td>
                  <td style="padding: 8px 0; color: #111827;">${partnerData.companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">담당자</td>
                  <td style="padding: 8px 0; color: #111827;">${partnerData.contactName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">연락처</td>
                  <td style="padding: 8px 0; color: #111827;">${partnerData.phone}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <p style="color: #4b5563; font-size: 15px; margin-bottom: 16px; font-weight: bold;">👇 아래 버튼을 클릭하여 첨부된 견적서(PDF/JPG)를 확인해 보세요!</p>
              <a href="${fileUrl}" target="_blank" style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                📎 내 견적서 파일 열기
              </a>
            </div>

            <h3 style="color: #374151; font-size: 16px; margin-bottom: 8px;">업체 전달 메시지</h3>
            <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; color: #4b5563; white-space: pre-wrap; line-height: 1.6;">
              ${message || '전달된 상세 메시지가 없습니다. 견적서를 확인해 주세요!'}
            </div>

            <div style="margin-top: 32px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">상세한 상담이나 계약을 원하시면 아래 연락처로 직접 전화해 보세요!</p>
              <a href="tel:${partnerData.phone.replace(/-/g, '')}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                📞 업체에 바로 전화걸기
              </a>
            </div>
          </div>
          <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
            이 메일은 필라테스 스페이스 플랫폼을 통해 발송되었습니다.
          </div>
        </div>
      `
    });

    // 6. Deduct coins and update partner's estimatedQuotes if not free
    if (!isFreeToSend) {
      await adminDb.collection('partners').doc(partnerSnapshot.docs[0].id).update({
        coins: FieldValue.increment(-estimateCost),
        estimatedQuotes: FieldValue.arrayUnion(quoteId)
      });
    } else if (!isEstimated) {
      // Just record that they estimated it, without deducting coins (e.g. they unlocked it first)
      await adminDb.collection('partners').doc(partnerSnapshot.docs[0].id).update({
        estimatedQuotes: FieldValue.arrayUnion(quoteId)
      });
    }

    // 7. Optionally, mark this quote as 'estimated by partnerId' in DB
    await adminDb.collection('quote_requests').doc(quoteId).update({
      estimatesSent: FieldValue.arrayUnion(partnerId)
    }).catch(e => console.error("Error updating estimatesSent:", e));

    // 8. Log the estimate in sent_estimates collection for Admin Tracking
    await adminDb.collection('sent_estimates').add({
      quoteId,
      partnerId,
      partnerName: partnerData.companyName,
      price: estimatePrice || null,
      message: message || '',
      fileUrl,
      isRead: false,
      createdAt: FieldValue.serverTimestamp()
    }).catch(e => console.error("Error logging sent_estimate:", e));

    return NextResponse.json({ success: true, isFreeToSend, coinsDeducted: isFreeToSend ? 0 : estimateCost });
  } catch (error: any) {
    console.error('Error sending estimate:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
