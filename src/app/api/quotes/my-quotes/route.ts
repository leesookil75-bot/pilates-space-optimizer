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
      return NextResponse.json({ quotes: [] });
    }

    const quotes = quotesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt || new Date().toISOString()
    })).sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 2. Fetch all estimates for these quotes
    const quoteIds = quotes.map(q => q.id);
    const estimates: any[] = [];
    
    // Chunking to handle >10 quoteIds
    for (let i = 0; i < quoteIds.length; i += 10) {
      const chunk = quoteIds.slice(i, i + 10);
      const estimatesSnapshot = await adminDb.collection('sent_estimates')
        .where('quoteId', 'in', chunk)
        .get();
        
      estimatesSnapshot.forEach(doc => {
        estimates.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString()
        });
      });
    }

    estimates.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 3. Join estimates into quotes
    const joinedQuotes = quotes.map(quote => ({
      ...quote,
      estimates: estimates.filter(e => e.quoteId === quote.id)
    }));

    return NextResponse.json({ quotes: joinedQuotes });
  } catch (error: any) {
    console.error('Error fetching my quotes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
