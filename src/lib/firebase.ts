// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyBBQDAaUKUJorLDo5Mc8MdadQ73hlcDGxA",
    authDomain: "onlyfly-fbeh6.firebaseapp.com",
    projectId: "onlyfly-fbeh6",
    storageBucket: "onlyfly-fbeh6.firebasestorage.app",
    messagingSenderId: "253717079128",
    appId: "1:253717079128:web:d535832126ef780390562d"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
