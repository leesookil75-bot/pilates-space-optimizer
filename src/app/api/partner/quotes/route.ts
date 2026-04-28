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

    const quotes = snapshot.docs.map(doc => {
      const data = doc.data();
      const isUnlocked = unlockedQuotes.includes(doc.id);

      if (isUnlocked) {
        return { id: doc.id, ...data }; // Return full data if unlocked
      } else {
        return {
          id: doc.id,
          ...data,
          name: data.name ? data.name[0] + '*'.repeat(data.name.length - 1) : '***',
          phone: data.phone ? data.phone.substring(0, 4) + '****-****' : '010-****-****',
        };
      }
    });

    return NextResponse.json({ 
      quotes, 
      partner: { coins: partnerData.coins || 0, unlockedQuotes },
      settings 
    });
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
