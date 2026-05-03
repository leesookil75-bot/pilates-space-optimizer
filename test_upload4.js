const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const parsed = JSON.parse(serviceAccountJson);
parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
admin.initializeApp({
  credential: admin.credential.cert(parsed),
});

(async () => {
  try {
    const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const [exists] = await bucket.exists();
    console.log(`Bucket ${bucket.name} exists: ${exists}`);
    
    const bucket2 = admin.storage().bucket('pilates-manager-43623.appspot.com');
    const [exists2] = await bucket2.exists();
    console.log(`Bucket ${bucket2.name} exists: ${exists2}`);
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
