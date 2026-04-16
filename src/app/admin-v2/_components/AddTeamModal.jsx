import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, X } from "lucide-react";
import FileUpload from "../../../components/registration/FileUpload";
import {
  RuntimeApiError,
  uploadPaymentScreenshot,
} from "../../../components/registration/runtimeRegistrationApi";
import styles from "../admin-v2.module.css";

function createEmptyMember() {
  return {
    name: "",
    email: "",
    phone: "",
    roll_number: "",
    branch: "",
    year_of_study: "",
    state: "",
  };
}

function normalizeTeamSize(value) {
  const parsed = Number(value);
  if (![2, 3, 4].includes(parsed)) {
    return 3;
  }

  return parsed;
}

function buildMembersForSize(size, previousMembers = []) {
  const normalizedSize = normalizeTeamSize(size);
  const nextMembers = [];

  for (let index = 0; index < normalizedSize; index += 1) {
    nextMembers.push(previousMembers[index] || createEmptyMember());
  }

  return nextMembers;
}

export default function AddTeamModal({
  isOpen,
  busy,
  error,
  onClose,
  onSubmit,
  onResetError,
}) {
  const [teamName, setTeamName] = useState("");
  const [college, setCollege] = useState("");
  const [state, setState] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [transactionId, setTransactionId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadMessageTone, setUploadMessageTone] = useState("ok");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [members, setMembers] = useState(() => buildMembersForSize(3));
  const [localError, setLocalError] = useState("");
  const isBusy = busy || uploadingScreenshot;

  const visibleError = localError || error || "";
  const uploadToneClass =
    uploadMessageTone === "error"
      ? styles.uploadNoticeError
      : uploadMessageTone === "info"
        ? styles.uploadNoticeInfo
        : styles.uploadNoticeOk;

  const resetDraft = () => {
    setTeamName("");
    setCollege("");
    setState("");
    setTeamSize(3);
    setTransactionId("");
    setSelectedFile(null);
    setFileName("");
    setFileError("");
    setUploadMessage("");
    setUploadMessageTone("ok");
    setMembers(buildMembersForSize(3));
    setLocalError("");
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isBusy) {
        onClose?.();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isBusy, onClose]);

  useEffect(() => {
    onResetError?.();
  }, [onResetError]);

  const teamSizeOptions = useMemo(
    () => [
      { value: 2, label: "2 Members" },
      { value: 3, label: "3 Members" },
      { value: 4, label: "4 Members" },
    ],
    []
  );

  const updateMemberField = (memberIndex, field, value) => {
    setMembers((previousMembers) =>
      previousMembers.map((member, index) =>
        index === memberIndex ? { ...member, [field]: value } : member
      )
    );
  };

  const handleTeamSizeChange = (value) => {
    const nextSize = normalizeTeamSize(value);
    setTeamSize(nextSize);
    setMembers((previousMembers) => buildMembersForSize(nextSize, previousMembers));
  };

  const handleClose = () => {
    if (isBusy) {
      return;
    }

    setLocalError("");
    onResetError?.();
    onClose?.();
  };

  const uploadScreenshot = async (file) => {
    if (!file) {
      setFileError("Payment screenshot is required.");
      return "";
    }

    setUploadingScreenshot(true);
    setUploadMessage("Uploading screenshot securely...");
    setUploadMessageTone("info");

    try {
      const uploadedUrl = await uploadPaymentScreenshot({
        file,
        registrationType: "hackathon",
      });

      setUploadMessage("Screenshot uploaded successfully.");
      setUploadMessageTone("ok");
      setFileError("");
      return uploadedUrl;
    } catch (uploadError) {
      const message =
        uploadError instanceof RuntimeApiError && uploadError.message
          ? uploadError.message
          : "Screenshot upload failed. Please try again.";

      setUploadMessage(message);
      setUploadMessageTone("error");
      setFileError(message);
      return "";
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleFileSelect = (file) => {
    setLocalError("");

    if (!file) {
      setSelectedFile(null);
      setFileName("");
      setFileError("");
      setUploadMessage("");
      setUploadMessageTone("ok");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setFileError("");
    setUploadMessage("File selected. Ready to submit.");
    setUploadMessageTone("ok");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    const normalizedTeamName = String(teamName || "").trim();
    const normalizedCollege = String(college || "").trim();
    const normalizedState = String(state || "").trim();
    const normalizedTeamSize = normalizeTeamSize(teamSize);
    const normalizedTransactionId = String(transactionId || "").trim();

    if (!normalizedTeamName || !normalizedCollege) {
      setLocalError("Team name and college are required.");
      return;
    }

    if (!normalizedTransactionId) {
      setLocalError("UPI transaction ID is required.");
      return;
    }

    if (!selectedFile) {
      setFileError("Payment screenshot is required.");
      return;
    }

    const normalizedMembers = members.map((member) => ({
      name: String(member?.name || "").trim(),
      email: String(member?.email || "").trim().toLowerCase(),
      phone: String(member?.phone || "").trim(),
      roll_number: String(member?.roll_number || "").trim(),
      branch: String(member?.branch || "").trim(),
      year_of_study: String(member?.year_of_study || "").trim(),
      state: String(member?.state || "").trim() || normalizedState,
    }));

    for (let index = 0; index < normalizedMembers.length; index += 1) {
      const member = normalizedMembers[index];
      if (!member.name || !member.email || !member.phone) {
        setLocalError(`Member ${index + 1} requires name, email, and phone.`);
        return;
      }
    }

    const uploadedScreenshotUrl = await uploadScreenshot(selectedFile);
    if (!uploadedScreenshotUrl) {
      return;
    }

    const payload = {
      team_name: normalizedTeamName,
      college: normalizedCollege,
      state: normalizedState,
      team_size: normalizedTeamSize,
      members: normalizedMembers,
      upi_transaction_id: normalizedTransactionId,
      screenshot_url: uploadedScreenshotUrl,
    };

    try {
      setLocalError("");
      await onSubmit?.(payload);
      resetDraft();
      onClose?.();
    } catch (submitError) {
      setLocalError(submitError?.message || "Failed to create team.");
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      className={styles.eventControlsOverlay}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add team"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        className={styles.eventControlsModal}
        onClick={(nextEvent) => nextEvent.stopPropagation()}
        initial={{ y: 18, opacity: 0.96 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 22, opacity: 0.96 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={styles.eventControlsModalHeader}>
          <div className={styles.eventControlsModalTitleWrap}>
            <p className={styles.eventControlsKicker}>
              <UserPlus size={14} aria-hidden="true" />
              Manual Team Entry
            </p>
            <h2 className={styles.eventControlsModalTitle}>Add Hackathon Team</h2>
            <p className={styles.eventControlsModalSubtitle}>
              Create a pending registration directly from the admin workspace.
            </p>
          </div>

          <button
            type="button"
            className={styles.iconButton}
            onClick={handleClose}
            aria-label="Close add team modal"
            disabled={isBusy}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <form className={styles.eventControlsModalBody} onSubmit={handleSubmit}>
          <section className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Team details</h3>
            <div className={styles.detailGrid}>
              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>Team name</span>
                <input
                  type="text"
                  className={styles.textInput}
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Team Phoenix"
                  maxLength={120}
                  disabled={isBusy}
                  required
                />
              </label>

              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>College</span>
                <input
                  type="text"
                  className={styles.textInput}
                  value={college}
                  onChange={(event) => setCollege(event.target.value)}
                  placeholder="CBIT"
                  maxLength={180}
                  disabled={isBusy}
                  required
                />
              </label>

              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>State (optional)</span>
                <input
                  type="text"
                  className={styles.textInput}
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  placeholder="Telangana"
                  maxLength={80}
                  disabled={isBusy}
                />
              </label>

              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>Team size</span>
                <select
                  className={styles.textInput}
                  value={teamSize}
                  onChange={(event) => handleTeamSizeChange(Number(event.target.value))}
                  disabled={isBusy}
                >
                  {teamSizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>UPI transaction ID</span>
                <input
                  type="text"
                  className={styles.textInput}
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                  placeholder="T2604XXXX"
                  maxLength={120}
                  disabled={isBusy}
                  required
                />
              </label>
            </div>

            <div className={styles.fileUploadField}>
              <span className={styles.fieldLabel}>Payment screenshot</span>
              <p className={styles.uploadHelpText}>
                Upload a clear screenshot with transaction ID, amount, and payment status visible.
              </p>
              <FileUpload fileName={fileName} disabled={isBusy} onFileSelect={handleFileSelect} />
              {fileError ? <p className={styles.uploadFieldError}>{fileError}</p> : null}
              {uploadMessage ? (
                <p className={[styles.uploadNotice, uploadToneClass].join(" ")}>{uploadMessage}</p>
              ) : null}
            </div>
          </section>

          <section className={styles.drawerSection}>
            <h3 className={styles.drawerSectionTitle}>Members</h3>
            <div className={styles.participantList}>
              {members.map((member, index) => (
                <article
                  key={`member-${index + 1}`}
                  className={styles.participantCard}
                  aria-label={`Member ${index + 1}`}
                >
                  <div className={styles.participantHeader}>
                    <p className={styles.participantRole}>
                      {index === 0 ? "Team Lead" : `Member ${index + 1}`}
                    </p>
                    <p className={styles.participantName}>Participant {index + 1}</p>
                  </div>

                  <div className={styles.participantGrid}>
                    <label className={styles.searchField}>
                      <span className={styles.fieldLabel}>Name</span>
                      <input
                        type="text"
                        className={styles.textInput}
                        value={member.name}
                        onChange={(event) => updateMemberField(index, "name", event.target.value)}
                        placeholder="Full name"
                        maxLength={120}
                        disabled={isBusy}
                        required
                      />
                    </label>

                    <label className={styles.searchField}>
                      <span className={styles.fieldLabel}>Email</span>
                      <input
                        type="email"
                        className={styles.textInput}
                        value={member.email}
                        onChange={(event) => updateMemberField(index, "email", event.target.value)}
                        placeholder="participant@example.com"
                        maxLength={180}
                        disabled={isBusy}
                        required
                      />
                    </label>

                    <label className={styles.searchField}>
                      <span className={styles.fieldLabel}>Phone</span>
                      <input
                        type="tel"
                        className={styles.textInput}
                        value={member.phone}
                        onChange={(event) => updateMemberField(index, "phone", event.target.value)}
                        placeholder="10-digit number"
                        maxLength={10}
                        disabled={isBusy}
                        required
                      />
                    </label>

                    <label className={styles.searchField}>
                      <span className={styles.fieldLabel}>Roll no. (optional)</span>
                      <input
                        type="text"
                        className={styles.textInput}
                        value={member.roll_number}
                        onChange={(event) =>
                          updateMemberField(index, "roll_number", event.target.value)
                        }
                        placeholder="23WU0102186"
                        maxLength={80}
                        disabled={isBusy}
                      />
                    </label>

                    <label className={styles.searchField}>
                      <span className={styles.fieldLabel}>Branch (optional)</span>
                      <input
                        type="text"
                        className={styles.textInput}
                        value={member.branch}
                        onChange={(event) => updateMemberField(index, "branch", event.target.value)}
                        placeholder="CSE"
                        maxLength={80}
                        disabled={isBusy}
                      />
                    </label>

                    <label className={styles.searchField}>
                      <span className={styles.fieldLabel}>Year (optional)</span>
                      <input
                        type="text"
                        className={styles.textInput}
                        value={member.year_of_study}
                        onChange={(event) =>
                          updateMemberField(index, "year_of_study", event.target.value)
                        }
                        placeholder="3rd year"
                        maxLength={40}
                        disabled={isBusy}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {visibleError ? <p className={styles.inlineError}>{visibleError}</p> : null}

          <div className={styles.actionRow}>
            <button type="submit" className={styles.btnPrimary} disabled={isBusy}>
              {uploadingScreenshot ? "Uploading screenshot..." : busy ? "Creating team..." : "Create Team"}
            </button>

            <button type="button" className={styles.btnSecondary} disabled={isBusy} onClick={handleClose}>
              Cancel
            </button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}
