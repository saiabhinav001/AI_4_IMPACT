import { adminStorage } from "../../../../../firebaseAdmin";

function extractObjectPathFromFirebaseUrl(screenshotUrl) {
  try {
    const parsed = new URL(screenshotUrl);

    if (parsed.hostname !== "firebasestorage.googleapis.com") {
      return null;
    }

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const bucketIndex = pathSegments.indexOf("b");
    const objectIndex = pathSegments.indexOf("o");

    if (bucketIndex === -1 || objectIndex === -1 || bucketIndex + 1 >= pathSegments.length) {
      return null;
    }

    const bucketName = pathSegments[bucketIndex + 1];
    if (bucketName !== adminStorage.name) {
      return null;
    }

    const encodedObjectPath = pathSegments.slice(objectIndex + 1).join("/");
    if (!encodedObjectPath) {
      return null;
    }

    return decodeURIComponent(encodedObjectPath);
  } catch {
    return null;
  }
}

export async function cleanupTempScreenshot(screenshotUrl) {
  if (!screenshotUrl) {
    return;
  }

  const objectPath = extractObjectPathFromFirebaseUrl(screenshotUrl);
  if (!objectPath || !objectPath.startsWith("payments/temp_")) {
    return;
  }

  try {
    await adminStorage.file(objectPath).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error("Failed to clean up temp screenshot:", error);
  }
}
