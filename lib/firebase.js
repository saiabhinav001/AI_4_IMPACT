import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasNonEmptyValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const hasFirebaseClientConfig = Object.values(firebaseConfig).every(hasNonEmptyValue);

let app = null;
let db = null;
let auth = null;
let storage = null;
let googleProvider = null;

if (hasFirebaseClientConfig) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
}

function getMissingFirebaseClientConfigError() {
  const error = new Error(
    "Missing Firebase web client configuration. Set NEXT_PUBLIC_FIREBASE_* environment variables."
  );
  error.code = "FIREBASE_CLIENT_CONFIG_MISSING";
  return error;
}

export {
  app,
  db,
  auth,
  storage,
  googleProvider,
  hasFirebaseClientConfig,
  getMissingFirebaseClientConfigError,
};
