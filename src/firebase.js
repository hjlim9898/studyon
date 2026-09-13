import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD1jj1icfppRhXycGqL4nS1EoFBLIDwoeo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'studyon-e48c8.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'studyon-e48c8',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'studyon-e48c8.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '823084988466',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:823084988466:web:0bbde3581c12314959e42b',
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length) {
  console.warn(`Firebase 설정이 누락되었습니다: ${missingConfig.join(', ')}`);
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
