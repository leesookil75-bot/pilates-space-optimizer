import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { password, partnerDocId, amount } = await req.json();

    if (password !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!partnerDocId || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const partnerRef = adminDb.collection('partners').doc(partnerDocId);
    
    // We use a transaction or simple increment
    // Since Firebase Admin SDK has FieldValue.increment
    const admin = require('firebase-admin');
    await partnerRef.update({
      coins: admin.firestore.FieldValue.increment(amount)
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating coins:', error);
    return NextResponse.json({ error: 'Failed to update coins' }, { status: 500 });
  }
}
