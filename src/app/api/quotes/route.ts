import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const {
      name,
      phone,
      region,
      expectedDate,
      rooms,
      equipments,
    } = body;

    if (!name || !phone || !region) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docData = {
      name,
      phone,
      region,
      expectedDate,
      rooms: rooms || [],
      equipments: equipments || [],
      userEmail: session?.user?.email || null,
      userName: session?.user?.name || null,
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore 'quote_requests' collection
    const docRef = await adminDb.collection('quote_requests').add(docData);

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('Error saving quote request:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
