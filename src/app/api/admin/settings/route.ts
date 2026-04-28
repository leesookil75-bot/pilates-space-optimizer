import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settingsDoc = await adminDb.collection('settings').doc('systemConfig').get();
    
    if (!settingsDoc.exists) {
      // Return default settings if none exist
      return NextResponse.json({
        bankName: '우리은행',
        bankAccount: '1002352696292',
        bankOwner: '이수길',
        unlockCost: 20000,
        estimateCost: 5000,
        adminEmail: process.env.EMAIL_USER || 'admin@example.com',
        expireDays: 30
      });
    }

    return NextResponse.json(settingsDoc.data());
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { password, settings } = await req.json();

    if (password !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await adminDb.collection('settings').doc('systemConfig').set(settings, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
