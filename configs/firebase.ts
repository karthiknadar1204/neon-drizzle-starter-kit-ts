// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCIs0Oi7qjqHYIOCqtYAYTeWeH-5U4pw68",
  authDomain: "pdfstudy-909ca.firebaseapp.com",
  storageBucket: "pdfstudy-909ca.firebasestorage.app",
  messagingSenderId: "496079733545",
  appId: "1:496079733545:web:506dd5e81356cfcca76d38",
  measurementId: "G-2JWJGHHP4N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Only initialize analytics on the client side
let storage;

// Check if we're in a browser environment before initializing storage
if (typeof window !== 'undefined') {
  // We're on the client side
  const { getAnalytics } = require("firebase/analytics");
  const analytics = getAnalytics(app);
}

// Storage can be used in both environments
storage = getStorage(app);

export { storage };