import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const ADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

async function createAdminSession(idToken) {
  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data?.error || "Could not initialize admin session.");
    error.code = "SESSION_INIT_FAILED";
    throw error;
  }
}

async function clearAdminSession() {
  try {
    await fetch("/api/admin/session", { method: "DELETE" });
  } catch {
    // Best-effort cleanup only.
  }
}

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

export async function loginAdmin() {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);

    if (!isAdminEmail(userCredential.user.email)) {
      await signOut(auth);
      const accessError = new Error(
        "ACCESS_DENIED: This account is not authorized as admin."
      );
      accessError.code = "ACCESS_DENIED";
      throw accessError;
    }

    const idToken = await userCredential.user.getIdToken();
    await createAdminSession(idToken);
    return userCredential.user;
  } catch (err) {
    if (err?.code || err?.message) {
      throw err;
    }

    const unknownError = new Error("Authentication failed.");
    unknownError.code = "UNKNOWN_ERROR";
    throw unknownError;
  }
}

export async function logoutAdmin() {
  await clearAdminSession();
  await signOut(auth);
}

export function onAuthChange(callback, onError) {
  return onAuthStateChanged(
    auth,
    (user) => {
      if (user && isAdminEmail(user.email)) {
        callback(user);
      } else {
        callback(null);
      }
    },
    (error) => {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  );
}
