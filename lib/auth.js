import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  auth,
  db,
  getMissingFirebaseClientConfigError,
  hasFirebaseClientConfig,
} from "./firebase";
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

function requireFirebaseAuth() {
  if (!hasFirebaseClientConfig || !auth) {
    throw getMissingFirebaseClientConfigError();
  }

  return auth;
}

async function syncAdminRoleDocument(user) {
  if (!user?.uid || !hasFirebaseClientConfig || !db) {
    return;
  }

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        role: ROLES.ADMIN,
        email: normalizeEmail(user.email),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Best effort only. Role fallback still relies on token/email checks.
  }
}

async function createAdminSession(idToken) {
  try {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    // Static Firebase Hosting has no server route handlers.
    if (response.status === 404 || response.status === 405) {
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data?.error || "Could not initialize admin session.");
      error.code = "SESSION_INIT_FAILED";
      throw error;
    }
  } catch (error) {
    if (error?.code === "SESSION_INIT_FAILED") {
      throw error;
    }

    // Network/route unavailability should not block admin login in static mode.
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
      await syncAdminRoleDocument(user);
      return ROLES.ADMIN;
    }

    const claimRole = normalizeRole(tokenResult?.claims?.role);
    if (claimRole) {
      if (claimRole === ROLES.ADMIN) {
        await syncAdminRoleDocument(user);
      }
      return claimRole;
    }
  } catch {
    // Fall back to email-based role checks.
  }

  if (isAdminEmail(user.email)) {
    await syncAdminRoleDocument(user);
    return ROLES.ADMIN;
  }

  return ROLES.PARTICIPANT;
}

export async function loginWithRole(email, password) {
  const authInstance = requireFirebaseAuth();
  const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
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
      await signOut(requireFirebaseAuth());
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
  await signOut(requireFirebaseAuth());
}

export function onAuthChange(callback, onError) {
  if (!hasFirebaseClientConfig || !auth) {
    callback(null);

    if (typeof onError === "function") {
      onError(getMissingFirebaseClientConfigError());
    }

    return () => {};
  }

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
  if (!hasFirebaseClientConfig || !auth) {
    callback(null);

    if (typeof onError === "function") {
      onError(getMissingFirebaseClientConfigError());
    }

    return () => {};
  }

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
