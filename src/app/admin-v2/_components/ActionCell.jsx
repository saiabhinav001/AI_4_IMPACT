import { SendHorizontal } from "lucide-react";
import { canSendCredentialEmailForRegistration, getEmailStateMeta } from "../_lib/adminData";
import styles from "../admin-v2.module.css";

export default function ActionCell({
  registration,
  onSendCredentialEmail,
  emailActionBusyId,
  bulkSendBusy,
  apiRuntimeAvailable,
}) {
  const emailMeta = getEmailStateMeta(registration?.emailDelivery);
  const isSending = emailActionBusyId === registration.id;
  const canSend =
    canSendCredentialEmailForRegistration(registration) && !bulkSendBusy && apiRuntimeAvailable;
  const forceResend = emailMeta.state === "SUCCESS";

  if (!canSend) {
    return <span className={styles.mutedDash}>-</span>;
  }

  return (
    <button
      type="button"
      className={styles.btnInline}
      disabled={isSending || bulkSendBusy}
      onClick={(event) => {
        event.stopPropagation();
        void onSendCredentialEmail(registration, { force: forceResend });
      }}
    >
      <SendHorizontal size={12} aria-hidden="true" />
      {isSending ? "Sending..." : forceResend ? "Resend" : "Send"}
    </button>
  );
}
