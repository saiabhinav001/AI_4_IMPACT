const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

export function asTrimmedString(value) {
  return String(value ?? "").trim();
}

export function asNormalizedEmail(value) {
  return asTrimmedString(value).toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}

export function isValidPhone(phone) {
  return PHONE_REGEX.test(phone);
}

export function isValidHttpUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
