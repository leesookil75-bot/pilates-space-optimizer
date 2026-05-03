import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { estimateId } = await req.json();

    if (!estimateId) {
      return NextResponse.json({ error: 'Missing estimateId' }, { status: 400 });
    }

    // Verify ownership of the quote before marking as read
    const estimateDoc = await adminDb.collection('sent_estimates').doc(estimateId).get();
    if (!estimateDoc.exists) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const estimateData = estimateDoc.data();
    const quoteDoc = await adminDb.collection('quote_requests').doc(estimateData?.quoteId).get();
    
    if (quoteDoc.exists && quoteDoc.data()?.userEmail === session.user.email) {
      await adminDb.collection('sent_estimates').doc(estimateId).update({
        isRead: true
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Unauthorized to read this estimate' }, { status: 403 });
    }
  } catch (error: any) {
    console.error('Error marking estimate as read:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
