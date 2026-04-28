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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error registering partner:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
