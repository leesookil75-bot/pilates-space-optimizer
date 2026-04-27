import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { password, action, partnerId, newStatus } = await req.json();

    // Check master password
    if (password !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'get') {
      const snapshot = await adminDb.collection('partners').orderBy('createdAt', 'desc').get();
      const partners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return NextResponse.json({ partners });
    } 
    
    if (action === 'updateStatus') {
      if (!partnerId || !newStatus) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      }
      await adminDb.collection('partners').doc(partnerId).update({
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error handling partners:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
