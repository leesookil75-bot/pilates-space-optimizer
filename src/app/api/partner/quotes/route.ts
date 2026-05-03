import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { partnerId, password } = await req.json();

    if (!partnerId || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    // Verify against 'partners' collection
    const partnerSnapshot = await adminDb.collection('partners')
      .where('partnerId', '==', partnerId)
      .where('password', '==', password)
      .get();

    if (partnerSnapshot.empty) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const partnerData = partnerSnapshot.docs[0].data();

    if (partnerData.status !== 'approved') {
      return NextResponse.json({ error: '관리자 승인 대기 중이거나 반려된 계정입니다.' }, { status: 403 });
    }

    // Fetch quotes
    const snapshot = await adminDb.collection('quote_requests').orderBy('createdAt', 'desc').get();
    
    // Fetch settings
    const settingsDoc = await adminDb.collection('settings').doc('systemConfig').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { bankName: '우리은행', bankAccount: '1002352696292', bankOwner: '이수길', unlockCost: 1000 };

    // Mask contact information if not unlocked
    const unlockedQuotes = partnerData.unlockedQuotes || [];

    // Map to client-friendly format
    const quotes = snapshot.docs.map(doc => {
      const data = doc.data();
      const isPurchased = unlockedQuotes.includes(doc.id);
      
      // Determine if the quote is expired
      const expireDays = settings?.expireDays || 30;
      const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
      const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      
      const isExpiredByTime = daysSinceCreation > expireDays;
      const isExpiredByStatus = ['계약 완료', '보류/취소', '기간 만료'].includes(data.status);
      const isExpired = isExpiredByTime || isExpiredByStatus;

      // If expired, completely mask sensitive data regardless of purchase status
      if (isExpired) {
        return {
          id: doc.id,
          ...data,
          name: data.name ? `${data.name[0]}**` : '익명',
          phone: '010-****-****',
          floorPlanUrl: null, // Hide floor plan
          isPurchased: false, // Cannot be purchased or viewed anymore
          isExpired: true
        };
      }

      // If not purchased and not expired, mask the data
      if (!isPurchased) {
        return {
          id: doc.id,
          ...data,
          name: data.name ? `${data.name[0]}**` : '익명',
          phone: data.phone ? data.phone.substring(0, 4) + '****-****' : '010-****-****',
          floorPlanUrl: null, // Hide floor plan for non-purchased
          isPurchased: false,
          isExpired: false
        };
      }

      // If purchased and not expired, return full data
      return {
        id: doc.id,
        ...data,
        isPurchased: true,
        isExpired: false
      };
    });

    return NextResponse.json({ 
      quotes, 
      partner: { 
        companyName: partnerData.companyName || '',
        coins: partnerData.coins || 0, 
        unlockedQuotes,
        estimatedQuotes: partnerData.estimatedQuotes || []
      },
      settings 
    });
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
