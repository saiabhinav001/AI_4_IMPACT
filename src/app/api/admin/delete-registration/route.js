import { NextResponse } from "next/server";
import { adminAuth, adminDb, FieldPath, FieldValue } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";
import { invalidateAdminRegistrationsCache } from "../_utils/runtime-cache-invalidation";
import { deleteAdminReadModelForTransaction } from "../../../../../lib/server/admin-read-model.js";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const REGISTRATION_COLLECTIONS = {
  workshop: "workshop_registrations",
  hackathon: "hackathon_registrations",
};

const ENV = globalThis?.process?.env || {};
const DEFAULT_EMAIL_QUEUE_COLLECTION =
  String(ENV.FIREBASE_EMAIL_QUEUE_COLLECTION || "mail").trim() || "mail";

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

function asTrimmedString(value) {
  return String(value || "").trim();
}

function normalizeRegistrationType(value) {
  const normalized = asTrimmedString(value).toLowerCase();
  return Object.prototype.hasOwnProperty.call(REGISTRATION_COLLECTIONS, normalized)
    ? normalized
    : null;
}

function readObjectMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function clampDecrement(value, amount = 1) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(numeric) - amount);
}

function decrementMapValue(map, key) {
  const currentValue = Number(map?.[key] || 0);
  if (!Number.isFinite(currentValue) || currentValue <= 1) {
    return FieldValue.delete();
  }

  return Math.floor(currentValue) - 1;
}

function toSafeCollectionName(value) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : null;
}

function toUniqueIds(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(asTrimmedString).filter(Boolean)));
}

function shouldDeleteTeamLeadAuthAccount(userRecord, registrationRefId) {
  const claims = userRecord?.customClaims || {};
  if (claims?.admin === true) {
    return false;
  }

  const role = asTrimmedString(claims?.role).toUpperCase();
  const claimRegistrationRef = asTrimmedString(claims?.registration_ref);

  return role === "TEAM_LEAD" && claimRegistrationRef && claimRegistrationRef === registrationRefId;
}

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const transactionId = asTrimmedString(body?.transaction_id);

    if (!transactionId) {
      return badRequest("transaction_id is required.");
    }

    const transactionRef = adminDb.collection("transactions").doc(transactionId);
    const analyticsRef = adminDb.collection("analytics").doc("summary");

    const deletionMeta = {
      registrationType: null,
      registrationRefId: "",
      removedRegistration: false,
      removedParticipantCount: 0,
      removedQueueDoc: false,
      authUid: "",
    };

    await adminDb.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(transactionRef);
      if (!txDoc.exists) {
        throw new ApiError(404, "Transaction not found.");
      }

      const txData = txDoc.data() || {};
      const registrationType = normalizeRegistrationType(txData?.registration_type);
      if (!registrationType) {
        throw new ApiError(400, "Transaction has an invalid registration_type.");
      }

      const registrationRefId = asTrimmedString(txData?.registration_ref);
      const registrationCollection = REGISTRATION_COLLECTIONS[registrationType];
      const registrationRef = registrationRefId
        ? adminDb.collection(registrationCollection).doc(registrationRefId)
        : null;

      let registrationData = null;
      if (registrationRef) {
        const registrationDoc = await transaction.get(registrationRef);
        if (registrationDoc.exists) {
          registrationData = registrationDoc.data() || {};
          deletionMeta.removedRegistration = true;
        }
      }

      const analyticsDoc = await transaction.get(analyticsRef);
      const analytics = analyticsDoc.exists ? analyticsDoc.data() || {} : null;

      const participantIds = registrationType === "workshop"
        ? toUniqueIds([registrationData?.participant_id])
        : toUniqueIds(registrationData?.member_ids);

      const queueDocId = asTrimmedString(
        registrationData?.access_credentials?.email_delivery?.queue_doc_id
      );
      const queueCollection =
        toSafeCollectionName(registrationData?.access_credentials?.email_delivery?.collection) ||
        toSafeCollectionName(DEFAULT_EMAIL_QUEUE_COLLECTION);

      if (registrationRef && registrationData) {
        transaction.delete(registrationRef);
      }

      participantIds.forEach((participantId) => {
        transaction.delete(adminDb.collection("participants").doc(participantId));
      });

      if (queueDocId && queueCollection) {
        transaction.delete(adminDb.collection(queueCollection).doc(queueDocId));
        deletionMeta.removedQueueDoc = true;
      }

      if (analytics) {
        const analyticsUpdates = [];

        if (registrationType === "hackathon") {
          analyticsUpdates.push(
            "total_hackathon",
            clampDecrement(analytics?.total_hackathon)
          );
        } else {
          analyticsUpdates.push(
            "total_workshop",
            clampDecrement(analytics?.total_workshop)
          );
        }

        const teamSize = Number(registrationData?.team_size || 0);
        if (registrationType === "hackathon" && [2, 3, 4].includes(teamSize)) {
          const teamSizeField = `team_size_${teamSize}`;
          analyticsUpdates.push(
            teamSizeField,
            clampDecrement(analytics?.[teamSizeField])
          );
        }

        const collegeName = asTrimmedString(registrationData?.college);
        if (collegeName) {
          const legacyColleges = readObjectMap(analytics?.colleges);
          const typedColleges = readObjectMap(
            registrationType === "hackathon"
              ? analytics?.colleges_hackathon
              : analytics?.colleges_workshop
          );

          analyticsUpdates.push(
            new FieldPath("colleges", collegeName),
            decrementMapValue(legacyColleges, collegeName),
            new FieldPath(
              registrationType === "hackathon" ? "colleges_hackathon" : "colleges_workshop",
              collegeName
            ),
            decrementMapValue(typedColleges, collegeName)
          );
        }

        analyticsUpdates.push("updated_at", FieldValue.serverTimestamp());
        transaction.update(analyticsRef, ...analyticsUpdates);
      }

      transaction.delete(transactionRef);

      deletionMeta.registrationType = registrationType;
      deletionMeta.registrationRefId = registrationRefId;
      deletionMeta.removedParticipantCount = participantIds.length;
      deletionMeta.authUid = asTrimmedString(
        registrationData?.team_lead_auth_uid || registrationData?.access_credentials?.auth_uid
      );
    });

    let deletedAuthAccount = false;
    let authCleanupNotice = "";

    if (
      deletionMeta.registrationType === "hackathon" &&
      deletionMeta.authUid &&
      deletionMeta.registrationRefId
    ) {
      try {
        const userRecord = await adminAuth.getUser(deletionMeta.authUid);
        if (shouldDeleteTeamLeadAuthAccount(userRecord, deletionMeta.registrationRefId)) {
          await adminAuth.deleteUser(deletionMeta.authUid);
          deletedAuthAccount = true;
        } else {
          authCleanupNotice =
            "Skipped auth cleanup because linked account claims did not match this team registration.";
        }
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          authCleanupNotice = "Linked team auth account was already removed.";
        } else {
          console.error("Failed to clean up team auth account:", error);
          authCleanupNotice = "Deleted registration records but failed to clean up team auth account.";
        }
      }
    }

    try {
      await deleteAdminReadModelForTransaction(transactionId);
    } catch (readModelError) {
      console.error("Failed to delete admin read model record:", readModelError);
    }

    invalidateAdminRegistrationsCache();

    return NextResponse.json({
      success: true,
      message:
        deletionMeta.registrationType === "hackathon"
          ? "Hackathon team and linked registration data deleted."
          : "Workshop registration and linked participant data deleted.",
      deleted: {
        transaction_id: transactionId,
        registration_type: deletionMeta.registrationType,
        registration_ref: deletionMeta.registrationRefId || null,
        registration_removed: deletionMeta.removedRegistration,
        participants_removed: deletionMeta.removedParticipantCount,
        queue_doc_removed: deletionMeta.removedQueueDoc,
        auth_user_removed: deletedAuthAccount,
      },
      notice: authCleanupNotice || null,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete registration:", error);
    return NextResponse.json(
      { error: "Failed to delete registration data." },
      { status: 500 }
    );
  }
}
