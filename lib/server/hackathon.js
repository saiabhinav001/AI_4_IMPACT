import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../admin";
import { PHASES, PHASE_LIST } from "../constants/phases";

const CONFIG_COLLECTION = "hackathon_config";
const CONFIG_DOC_ID = "global";

export function getHackathonConfigRef() {
  return adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID);
}

export async function getHackathonConfig() {
  const snap = await getHackathonConfigRef().get();
  if (!snap.exists) {
    return {
      currentPhase: PHASES.REGISTRATION,
      psSelectionLocked: false,
      submissionLocked: false,
      submissionDeadline: null,
      timelineEvents: [],
    };
  }
  const data = snap.data();
  return {
    currentPhase: PHASE_LIST.includes(data?.currentPhase)
      ? data.currentPhase
      : PHASES.REGISTRATION,
    psSelectionLocked: Boolean(data?.psSelectionLocked),
    submissionLocked: Boolean(data?.submissionLocked),
    submissionDeadline: data?.submissionDeadline || null,
    timelineEvents: Array.isArray(data?.timelineEvents) ? data.timelineEvents : [],
  };
}

export function isSubmissionOpen(config) {
  if (!config) return false;
  if (config.currentPhase !== PHASES.SUBMISSION) return false;
  if (config.submissionLocked) return false;

  const deadline = config.submissionDeadline;
  if (!deadline) return true;
  const now = Timestamp.now().toMillis();
  const end = typeof deadline?.toMillis === "function" ? deadline.toMillis() : Number(deadline);
  if (!Number.isFinite(end)) return true;
  return now <= end;
}
