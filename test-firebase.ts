import * as fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf-8');
const keyMatch = envFile.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.*)'/);
if (keyMatch) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = keyMatch[1];
}

import * as admin from 'firebase-admin';

async function test() {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    console.log('Env var length:', serviceAccountJson?.length);
    
    if (serviceAccountJson) {
      let parsed;
      try {
        parsed = JSON.parse(serviceAccountJson);
      } catch (e) {
        // Try removing outer quotes
        if (serviceAccountJson.startsWith("'") && serviceAccountJson.endsWith("'")) {
          parsed = JSON.parse(serviceAccountJson.slice(1, -1));
        } else {
          throw e;
        }
      }
      
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      console.log('Firebase initialized');
      
      const db = admin.firestore();
      const docRef = await db.collection('test_collection').add({
        test: 'data',
        createdAt: new Date()
      });
      console.log('Document added with ID:', docRef.id);
    } else {
      console.error('FIREBASE_SERVICE_ACCOUNT_KEY is empty');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
