import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    // Check partner password (in reality, we should check against a 'partners' collection)
    if (password !== process.env.NEXT_PUBLIC_PARTNER_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
