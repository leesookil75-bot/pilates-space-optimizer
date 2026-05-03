import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // 1. Fetch user's quote_requests
    const quotesSnapshot = await adminDb.collection('quote_requests')
      .where('userEmail', '==', userEmail)
      .get();

    if (quotesSnapshot.empty) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const quoteIds = quotesSnapshot.docs.map(doc => doc.id);

    // 2. Since Firestore 'in' query supports max 10, we'll chunk it if needed
    // But usually a user doesn't have more than 10 quotes. 
    // We'll just fetch all sent_estimates that have one of these quoteIds and isRead != true
    let unreadCount = 0;
    
    // Chunking to handle >10 quoteIds
    for (let i = 0; i < quoteIds.length; i += 10) {
      const chunk = quoteIds.slice(i, i + 10);
      const estimatesSnapshot = await adminDb.collection('sent_estimates')
        .where('quoteId', 'in', chunk)
        .where('isRead', '==', false)
        .get();
        
      unreadCount += estimatesSnapshot.size;
    }

    return NextResponse.json({ unreadCount });
  } catch (error: any) {
    console.error('Error fetching unread estimates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
