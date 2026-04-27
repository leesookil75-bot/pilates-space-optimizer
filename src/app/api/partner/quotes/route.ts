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
    
    // Mask contact information (B approach)
    const quotes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        name: data.name ? data.name[0] + '*'.repeat(data.name.length - 1) : '***', // 홍**
        phone: data.phone ? data.phone.substring(0, 4) + '****-****' : '010-****-****',
      };
    });

    return NextResponse.json({ quotes });
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
