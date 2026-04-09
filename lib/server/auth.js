import { adminAuth, adminDb } from "../admin";
import { ROLES, ROLE_LIST } from "../constants/roles";

function getBearerToken(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function getSessionCookieToken(request) {
  return request.cookies.get("admin_session")?.value || "";
}

export async function verifyRequestUser(request) {
  const token = getBearerToken(request) || getSessionCookieToken(request);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      isAdminClaim: decoded.admin === true,
    };
  } catch {
    return null;
  }
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await adminDb.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!ROLE_LIST.includes(data?.role)) return null;
  return { id: snap.id, ...data };
}

export async function verifyRequestWithProfile(request) {
  const authUser = await verifyRequestUser(request);
  if (!authUser) return { authUser: null, profile: null };
  const profile = await getUserProfile(authUser.uid);
  return { authUser, profile };
}

export function hasRole(profile, roles) {
  if (!profile?.role) return false;
  return roles.includes(profile.role);
}

export function isAdmin(profile, authUser) {
  return profile?.role === ROLES.ADMIN || authUser?.isAdminClaim === true;
}
