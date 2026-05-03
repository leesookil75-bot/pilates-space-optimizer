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
    const [buckets] = await admin.storage().getBuckets();
    console.log('Buckets found:');
    buckets.forEach(bucket => {
      console.log(bucket.name);
    });
    process.exit(0);
  } catch (e) {
    console.error('Error getting buckets:', e);
  }
})();
