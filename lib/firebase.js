import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyCVeKvEX6gPR2mo5FlbUvbnuR_Ie69dIaA",
  authDomain: "ai4impact-cc315.firebaseapp.com",
  projectId: "ai4impact-cc315",
  storageBucket: "ai4impact-cc315.firebasestorage.app",
  messagingSenderId: "646262423427",
  appId: "1:646262423427:web:acfa1277398e5500efc0b6",
};

function readClientConfigValue(envValue, fallbackValue) {
  const normalizedEnvValue = typeof envValue === "string" ? envValue.trim() : "";
  return normalizedEnvValue || fallbackValue;
}

const firebaseConfig = {
  apiKey: readClientConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    fallbackFirebaseConfig.apiKey
  ),
  authDomain: readClientConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    fallbackFirebaseConfig.authDomain
  ),
  projectId: readClientConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    fallbackFirebaseConfig.projectId
  ),
  storageBucket: readClientConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    fallbackFirebaseConfig.storageBucket
  ),
  messagingSenderId: readClientConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    fallbackFirebaseConfig.messagingSenderId
  ),
  appId: readClientConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    fallbackFirebaseConfig.appId
  ),
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
