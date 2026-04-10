"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import PaymentSection from "./PaymentSection";
import SubmitButton from "./SubmitButton";

const phoneRegex = /^\d{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const memberSchema = z.object({
  name: z.string().trim(),
  email: z.string().trim(),
  phone: z.string().trim(),
  rollNumber: z.string().trim(),
  department: z.string().trim(),
  yearOfStudy: z.string().trim(),
});

const hackathonSchema = z
  .object({
    teamName: z.string().trim().min(1, "Team Name is required."),
    college: z.string().trim().min(1, "College / University is required."),
    teamSize: z.union([z.literal(3), z.literal(4)]),
    members: z.array(memberSchema).length(4),
    transactionId: z.string().trim().min(1, "Transaction ID is required."),
  })
  .superRefine((data, context) => {
    for (let index = 0; index < data.teamSize; index += 1) {
      const member = data.members[index];

      if (!member.name.trim()) {
        context.addIssue({
          code: "custom",
          message: "Name is required.",
          path: ["members", index, "name"],
        });
      }

      if (!member.email.trim()) {
        context.addIssue({
          code: "custom",
          message: "Email is required.",
          path: ["members", index, "email"],
        });
      } else if (!emailRegex.test(member.email.trim().toLowerCase())) {
        context.addIssue({
          code: "custom",
          message: "Enter a valid email address.",
          path: ["members", index, "email"],
        });
      }

      if (!member.phone.trim()) {
        context.addIssue({
          code: "custom",
          message: "Phone is required.",
          path: ["members", index, "phone"],
        });
      } else if (!phoneRegex.test(member.phone.trim())) {
        context.addIssue({
          code: "custom",
          message: "Phone must be exactly 10 digits.",
          path: ["members", index, "phone"],
        });
      }

      if (!member.rollNumber.trim()) {
        context.addIssue({
          code: "custom",
          message: "Roll number is required.",
          path: ["members", index, "rollNumber"],
        });
      }

      if (!member.department.trim()) {
        context.addIssue({
          code: "custom",
          message: "Department is required.",
          path: ["members", index, "department"],
        });
      }

      if (!member.yearOfStudy.trim()) {
        context.addIssue({
          code: "custom",
          message: "Year of studying is required.",
          path: ["members", index, "yearOfStudy"],
        });
      }
    }
  });

type HackathonFormValues = z.infer<typeof hackathonSchema>;

type MessageTone = "ok" | "error" | "info";

interface HackathonFormProps {
  qrSrc: string;
}

function AnimatedFieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2 text-[11px] text-[#FF8BB5]"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

function AnimatedNotice({
  message,
  tone,
}: {
  message?: string;
  tone: "success" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(216,172,255,0.44)] bg-[rgba(141,54,213,0.24)] text-[#F3E3FF]"
      : "border-[rgba(255,135,176,0.45)] bg-[rgba(255,89,153,0.14)] text-[#FFD7E3]";

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className={[
            "mx-8 mt-4 rounded-[11px] border px-3.5 py-3 text-[13px] font-semibold max-sm:mx-4",
            toneClass,
          ].join(" ")}
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

const createEmptyMember = () => ({
  name: "",
  email: "",
  phone: "",
  rollNumber: "",
  department: "",
  yearOfStudy: "",
});

export default function HackathonForm({ qrSrc }: HackathonFormProps) {
  const {
    register,
    control,
    watch,
    setValue,
    clearErrors,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HackathonFormValues>({
    resolver: zodResolver(hackathonSchema),
    mode: "onSubmit",
    defaultValues: {
      teamName: "",
      college: "",
      teamSize: 3,
      members: [
        createEmptyMember(),
        createEmptyMember(),
        createEmptyMember(),
        createEmptyMember(),
      ],
      transactionId: "",
    },
  });

  useFieldArray({
    control,
    name: "members",
  });

  const teamSize = watch("teamSize");

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);

  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadMessageTone, setUploadMessageTone] = useState<MessageTone>("ok");

  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const uploadScreenshot = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    setUploadMessage("Uploading screenshot securely...");
    setUploadMessageTone("info");

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const tempId = Math.random().toString(36).substring(2, 15);
      const objectPath = `payments/hackathon/temp_${tempId}.${ext}`;
      const storageRef = ref(storage, objectPath);

      await uploadBytes(storageRef, file);
      const uploadedUrl = await getDownloadURL(storageRef);

      setUploadMessage("Screenshot uploaded successfully.");
      setUploadMessageTone("ok");
      setFileError(undefined);
      return uploadedUrl;
    } catch (error) {
      console.error("Hackathon screenshot upload failed:", error);
      setUploadMessage("Screenshot upload failed. Please try again.");
      setUploadMessageTone("error");
      setFileError("Payment screenshot upload failed.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (file: File | null) => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!file) {
      setFileName("");
      setSelectedFile(null);
      setUploadMessage("");
      setFileError(undefined);
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setUploadMessage("File selected. Ready to submit.");
    setUploadMessageTone("ok");
  };

  const onSubmit = async (values: HackathonFormValues) => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!selectedFile) {
      setFileError("Payment screenshot is required.");
      return;
    }

    setIsSubmitting(true);

    const membersData = values.members.slice(0, values.teamSize).map((member) => ({
      name: member.name.trim(),
      email: member.email.trim().toLowerCase(),
      phone: member.phone.trim(),
    }));

    const memberEmails = membersData.map((m) => m.email);
    const uniqueEmails = new Set(memberEmails);
    if (uniqueEmails.size !== memberEmails.length) {
      setSubmitError("Duplicate emails found in the form.");
      return;
    }

    try {
      const existingParticipants = await getDocs(
        query(collection(db, "participants"), where("email", "in", memberEmails))
      );
      const existingHackathonEmailSet = new Set(
        existingParticipants.docs
          .filter((participantDoc) => participantDoc.data().registration_type === "hackathon")
          .map((participantDoc) => String(participantDoc.data().email || "").trim().toLowerCase())
          .filter(Boolean)
      );
      const duplicateEmail = memberEmails.find((email) => existingHackathonEmailSet.has(email));

      if (duplicateEmail) {
        setSubmitError(`Email ${duplicateEmail} is already registered for hackathon.`);
        return;
      }

      const uploadedUrl = await uploadScreenshot(selectedFile);
      if (!uploadedUrl) {
        return;
      }

      const batch = writeBatch(db);
      const teamRef = doc(collection(db, "hackathon_registrations"));
      const transactionRef = doc(collection(db, "transactions"));

      const participantIds = membersData.map(() => doc(collection(db, "participants")).id);
      membersData.forEach((member, index) => {
        const participantRef = doc(db, "participants", participantIds[index]);
        batch.set(participantRef, {
          participant_id: participantRef.id,
          ...member,
          registration_type: "hackathon",
          registration_ref: teamRef.id,
          created_at: serverTimestamp(),
        });
      });

      batch.set(teamRef, {
        team_id: teamRef.id,
        team_name: values.teamName.trim(),
        college: values.college.trim(),
        team_size: values.teamSize,
        member_ids: participantIds,
        transaction_id: transactionRef.id,
        payment_verified: false,
        created_at: serverTimestamp(),
      });

      batch.set(transactionRef, {
        transaction_id: transactionRef.id,
        registration_type: "hackathon",
        registration_ref: teamRef.id,
        upi_transaction_id: values.transactionId.trim(),
        screenshot_url: uploadedUrl,
        amount: 800,
        status: "pending",
        verified_by: null,
        verified_at: null,
        created_at: serverTimestamp(),
      });

      const analyticsRef = doc(db, "analytics", "summary");
      batch.update(analyticsRef, {
        total_hackathon: increment(1),
        [values.teamSize === 3 ? "team_size_3" : "team_size_4"]: increment(1),
        [`colleges.${values.college.trim()}`]: increment(1),
        [`colleges_hackathon.${values.college.trim()}`]: increment(1),
        updated_at: serverTimestamp(),
      });

      await batch.commit();

      setSubmitSuccess(
        "Registration submitted successfully. Verification is pending from the admin panel."
      );
      reset({
        teamName: "",
        college: "",
        teamSize: 3,
        members: [
          createEmptyMember(),
          createEmptyMember(),
          createEmptyMember(),
          createEmptyMember(),
        ],
        transactionId: "",
      });
      setSelectedFile(null);
      setFileName("");
      setUploadMessage("");
      setFileError(undefined);
    } catch (error) {
      console.error("Hackathon registration failed:", error);
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "Connection error. Please check your internet and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeamSizeChange = (size: 3 | 4) => {
    setValue("teamSize", size, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });

    if (size === 3) {
      clearErrors(["members.3.name", "members.3.email", "members.3.phone"]);
    }

    setSubmitError("");
    setSubmitSuccess("");
  };

  const runSubmit = handleSubmit(onSubmit);

  return (
    <div role="form" aria-label="Hackathon registration form" className="pb-0">
      <div className="border-b border-[rgba(141,54,213,0.1)] px-8 py-7 max-sm:px-4 max-sm:py-5">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded bg-[linear-gradient(180deg,#8D36D5,#46067A)] shadow-[0_0_10px_#8D36D5]" />
          <h2 className="font-[var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
            Team Details
          </h2>
          <span className="ml-auto font-[var(--font-dm-mono)] text-[9px] uppercase tracking-[0.1em] text-[#8D36D5]/70">
            01 / 03
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-[14px] max-sm:grid-cols-1">
          <div>
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              Team Name
            </label>
            <input
              type="text"
              placeholder="Enter team name"
              className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
              {...register("teamName")}
            />
            <AnimatedFieldError message={errors.teamName?.message} />
          </div>
          <div>
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              College / University
            </label>
            <input
              type="text"
              placeholder="Institution name"
              className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
              {...register("college")}
            />
            <AnimatedFieldError message={errors.college?.message} />
          </div>
        </div>

        <div>
          <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
            Team Size
          </label>
          <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
            <button
              type="button"
              className={[
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-[var(--font-syne)] text-[12px] font-bold uppercase tracking-[0.08em] transition-all duration-300",
                teamSize === 3
                  ? "border-[#8D36D5] bg-[rgba(141,54,213,0.2)] text-[#EDE8F5] shadow-[0_0_0_2px_rgba(141,54,213,0.15),0_0_20px_rgba(141,54,213,0.12)]"
                  : "border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] text-[rgba(237,232,245,0.45)] hover:border-[rgba(141,54,213,0.5)] hover:bg-[rgba(141,54,213,0.1)] hover:text-[#EDE8F5]",
              ].join(" ")}
              onClick={() => handleTeamSizeChange(3)}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  teamSize === 3
                    ? "bg-[#8D36D5] shadow-[0_0_8px_#8D36D5]"
                    : "bg-[rgba(141,54,213,0.4)]",
                ].join(" ")}
              />
              3 Members
            </button>
            <button
              type="button"
              className={[
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-[var(--font-syne)] text-[12px] font-bold uppercase tracking-[0.08em] transition-all duration-300",
                teamSize === 4
                  ? "border-[#8D36D5] bg-[rgba(141,54,213,0.2)] text-[#EDE8F5] shadow-[0_0_0_2px_rgba(141,54,213,0.15),0_0_20px_rgba(141,54,213,0.12)]"
                  : "border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] text-[rgba(237,232,245,0.45)] hover:border-[rgba(141,54,213,0.5)] hover:bg-[rgba(141,54,213,0.1)] hover:text-[#EDE8F5]",
              ].join(" ")}
              onClick={() => handleTeamSizeChange(4)}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  teamSize === 4
                    ? "bg-[#8D36D5] shadow-[0_0_8px_#8D36D5]"
                    : "bg-[rgba(141,54,213,0.4)]",
                ].join(" ")}
              />
              4 Members
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[rgba(141,54,213,0.1)] px-8 py-7 max-sm:px-4 max-sm:py-5">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded bg-[linear-gradient(180deg,#8D36D5,#46067A)] shadow-[0_0_10px_#8D36D5]" />
          <h2 className="font-[var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
            Team Members
          </h2>
          <span className="ml-auto font-[var(--font-dm-mono)] text-[9px] uppercase tracking-[0.1em] text-[#8D36D5]/70">
            02 / 03
          </span>
        </div>

        <div className="space-y-3.5">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={`member-${index + 1}`}
              layout
              className="overflow-hidden rounded-2xl border border-[rgba(141,54,213,0.14)]"
            >
              <div className="flex items-center gap-2.5 border-b border-[rgba(141,54,213,0.1)] bg-[rgba(141,54,213,0.1)] px-4 py-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#46067A,#8D36D5)] font-[var(--font-dm-mono)] text-[10px] font-medium text-white shadow-[0_0_10px_rgba(141,54,213,0.5)]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className="font-[var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
                  Member {index + 1}
                </p>
                {index === 0 ? (
                  <span className="ml-auto rounded-full bg-[rgba(141,54,213,0.15)] px-2 py-0.5 font-[var(--font-dm-mono)] text-[9px] uppercase tracking-[0.08em] text-[#8D36D5]">
                    Leader
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 p-4">
                <div>
                  <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Member name"
                    className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                    {...register(`members.${index}.name` as const)}
                  />
                  <AnimatedFieldError message={errors.members?.[index]?.name?.message} />
                </div>
                
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="member@example.com"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register(`members.${index}.email` as const)}
                    />
                    <AnimatedFieldError message={errors.members?.[index]?.email?.message} />
                  </div>
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register(`members.${index}.phone` as const)}
                    />
                    <AnimatedFieldError message={errors.members?.[index]?.phone?.message} />
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 21BCE0001"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register(`members.${index}.rollNumber` as const)}
                    />
                    <AnimatedFieldError message={errors.members?.[index]?.rollNumber?.message} />
                  </div>
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CSE"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register(`members.${index}.department` as const)}
                    />
                    <AnimatedFieldError message={errors.members?.[index]?.department?.message} />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                    Year of Studying
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1st Year"
                    className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                    {...register(`members.${index}.yearOfStudy` as const)}
                  />
                  <AnimatedFieldError message={errors.members?.[index]?.yearOfStudy?.message} />
                </div>
              </div>
            </motion.div>
          ))}

          <AnimatePresence initial={false}>
            {teamSize === 4 ? (
              <motion.div
                key="member-4"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden rounded-2xl border border-[rgba(141,54,213,0.14)]"
              >
                <div className="flex items-center gap-2.5 border-b border-[rgba(141,54,213,0.1)] bg-[rgba(141,54,213,0.1)] px-4 py-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#46067A,#8D36D5)] font-[var(--font-dm-mono)] text-[10px] font-medium text-white shadow-[0_0_10px_rgba(141,54,213,0.5)]">
                    04
                  </div>
                  <p className="font-[var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
                    Member 4
                  </p>
                  <span className="ml-auto rounded-full bg-[rgba(141,54,213,0.15)] px-2 py-0.5 font-[var(--font-dm-mono)] text-[9px] uppercase tracking-[0.08em] text-[#8D36D5]">
                    Optional
                  </span>
                </div>

              <div className="flex flex-col gap-4 p-4">
                <div>
                  <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Member name"
                    className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                    {...register("members.3.name")}
                  />
                  <AnimatedFieldError message={errors.members?.[3]?.name?.message} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="member@example.com"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register("members.3.email")}
                    />
                    <AnimatedFieldError message={errors.members?.[3]?.email?.message} />
                  </div>
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register("members.3.phone")}
                    />
                    <AnimatedFieldError message={errors.members?.[3]?.phone?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 21BCE0001"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register("members.3.rollNumber")}
                    />
                    <AnimatedFieldError message={errors.members?.[3]?.rollNumber?.message} />
                  </div>
                  <div>
                    <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CSE"
                      className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                      {...register("members.3.department")}
                    />
                    <AnimatedFieldError message={errors.members?.[3]?.department?.message} />
                  </div>
                </div>

                <div>
                  <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                    Year of Studying
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1st Year"
                    className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                    {...register("members.3.yearOfStudy")}
                  />
                  <AnimatedFieldError message={errors.members?.[3]?.yearOfStudy?.message} />
                </div>
              </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <PaymentSection
        type="hackathon"
        amount="₹ 800"
        amountSuffix="per team"
        qrSrc={qrSrc}
        sectionTag="03 / 03"
        transactionInputProps={register("transactionId")}
        transactionError={errors.transactionId?.message}
        fileName={fileName}
        fileError={fileError}
        uploadMessage={uploadMessage}
        uploadMessageTone={uploadMessageTone}
        uploadInProgress={isUploading}
        onFileSelect={handleFileSelect}
      />

      <AnimatedNotice message={submitError} tone="error" />
      <AnimatedNotice message={submitSuccess} tone="success" />

      <div className="border-t border-[rgba(141,54,213,0.12)] bg-[rgba(141,54,213,0.05)] px-8 py-6 max-sm:px-4 max-sm:py-4">
        <SubmitButton
          label="Submit Hackathon Registration"
          disabled={isUploading || isSubmitting}
          loading={isSubmitting}
          onClick={() => {
            void runSubmit();
          }}
        />
      </div>
    </div>
  );
}
