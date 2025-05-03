// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Import Firestore

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // Use environment variable
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, // Use environment variable
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Use environment variable
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // Use environment variable
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // Use environment variable
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID // Use environment variable
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app); // Export Firestore instance
