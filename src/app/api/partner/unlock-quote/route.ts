import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { partnerId, password, quoteId } = await req.json();

    if (!partnerId || !password || !quoteId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Verify partner credentials
    const snapshot = await adminDb.collection('partners')
      .where('partnerId', '==', partnerId)
      .where('password', '==', password)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const partnerDoc = snapshot.docs[0];
    const partnerData = partnerDoc.data();

    // 2. Check if already unlocked
    if (partnerData.unlockedQuotes && partnerData.unlockedQuotes.includes(quoteId)) {
      return NextResponse.json({ success: true, message: 'Already unlocked' });
    }

    // 3. Get current settings to know unlock cost
    const settingsDoc = await adminDb.collection('settings').doc('systemConfig').get();
    let unlockCost = 1000; // default
    if (settingsDoc.exists) {
      unlockCost = settingsDoc.data()?.unlockCost ?? 1000;
    }

    // 4. Check balance
    const currentCoins = partnerData.coins || 0;
    if (currentCoins < unlockCost) {
      return NextResponse.json({ error: 'Insufficient coins', required: unlockCost, balance: currentCoins }, { status: 403 });
    }

    // 5. Deduct coins and add to unlockedQuotes
    const admin = require('firebase-admin');
    await partnerDoc.ref.update({
      coins: admin.firestore.FieldValue.increment(-unlockCost),
      unlockedQuotes: admin.firestore.FieldValue.arrayUnion(quoteId)
    });

    // 6. Track unlock on quote document for FOMO competition count
    await adminDb.collection('quote_requests').doc(quoteId).update({
      unlockedBy: admin.firestore.FieldValue.arrayUnion(partnerId)
    }).catch(e => console.error("Error updating unlockedBy:", e));

    return NextResponse.json({ success: true, remainingCoins: currentCoins - unlockCost });
  } catch (error: any) {
    console.error('Error unlocking quote:', error);
    return NextResponse.json({ error: 'Failed to unlock quote' }, { status: 500 });
  }
}
