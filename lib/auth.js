import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";
import { ROLES, ROLE_LIST } from "./constants/roles";

const ADMIN_EMAILS = (
  globalThis?.process?.env?.NEXT_PUBLIC_ADMIN_EMAILS || ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "TEAMLEAD" || normalized === "TEAM_LEADER" || normalized === "LEAD") {
    return ROLES.TEAM_LEAD;
  }

  return ROLE_LIST.includes(normalized) ? normalized : null;
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

export async function getUserRole(user) {
  if (!user) return null;

  try {
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult?.claims?.admin === true) {
      return ROLES.ADMIN;
    }

    const claimRole = normalizeRole(tokenResult?.claims?.role);
    if (claimRole) {
      return claimRole;
    }
  } catch {
    // Fall back to email-based role checks.
  }

  return isAdminEmail(user.email) ? ROLES.ADMIN : ROLES.PARTICIPANT;
}

export async function loginWithRole(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const role = await getUserRole(userCredential.user);

  if (role === ROLES.ADMIN) {
    const idToken = await userCredential.user.getIdToken();
    await createAdminSession(idToken);
  } else {
    await clearAdminSession();
  }

  return {
    user: userCredential.user,
    role,
  };
}

export async function loginAdmin(email, password) {
  try {
    const { user, role } = await loginWithRole(email, password);

    if (role !== ROLES.ADMIN) {
      await clearAdminSession();
      await signOut(auth);
      const accessError = new Error(
        "ACCESS_DENIED: This account is not authorized as admin."
      );
      accessError.code = "ACCESS_DENIED";
      throw accessError;
    }

    return user;
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

export function onUserAuthChange(callback, onError) {
  return onAuthStateChanged(
    auth,
    (user) => {
      callback(user || null);
    },
    (error) => {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  );
}
