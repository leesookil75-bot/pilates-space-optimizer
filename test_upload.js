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
    const fileRef = bucket.file('test_script.txt');
    await fileRef.save('Hello Test', { metadata: { contentType: 'text/plain' } });
    console.log('Upload successful!');
  } catch (e) {
    console.error('Upload Error:', e);
  }
})();
