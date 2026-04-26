import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // Check if the service account key is available in environment variables
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
    } else {
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const db = admin.firestore();

export { admin, db as adminDb };
