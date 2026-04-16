"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import CyberDropdown from "./CyberDropdown";
import PaymentSection from "./PaymentSection";
import {
  BRANCH_OPTIONS,
  BRANCH_OPTIONS_WITH_OTHER,
  INDIA_STATES,
  OTHER_BRANCH_OPTION,
  YEAR_OPTIONS,
} from "./registrationOptions";
import SubmitButton from "./SubmitButton";
import {
  RuntimeApiError,
  createIdempotencyKey,
  submitHackathonRegistration,
  uploadPaymentScreenshot,
} from "./runtimeRegistrationApi";

const phoneRegex = /^\d{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const memberSchema = z.object({
  name: z.string().trim(),
  email: z.string().trim(),
  phone: z.string().trim(),
  rollNumber: z.string().trim(),
  department: z.string().trim(),
  branchOther: z.string().trim().optional(),
  yearOfStudy: z.string().trim(),
});

const hackathonSchema = z
  .object({
    teamName: z.string().trim().min(1, "Team Name is required."),
    college: z.string().trim().min(1, "College / University is required."),
    state: z.string().trim().min(1, "State is required."),
    teamSize: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    members: z.array(memberSchema).length(4),
    transactionId: z.string().trim().min(1, "Transaction ID is required."),
  })
  .superRefine((data, context) => {
    if (!INDIA_STATES.includes(data.state as (typeof INDIA_STATES)[number])) {
      context.addIssue({
        code: "custom",
        message: "Select a valid state.",
        path: ["state"],
      });
    }

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
          message: "Branch is required.",
          path: ["members", index, "department"],
        });
      } else if (member.department === OTHER_BRANCH_OPTION) {
        if (!String(member.branchOther || "").trim()) {
          context.addIssue({
            code: "custom",
            message: "Please enter branch name.",
            path: ["members", index, "branchOther"],
          });
        }
      } else if (!BRANCH_OPTIONS.includes(member.department as (typeof BRANCH_OPTIONS)[number])) {
        context.addIssue({
          code: "custom",
          message: "Select a valid branch.",
          path: ["members", index, "department"],
        });
      }

      if (!member.yearOfStudy.trim()) {
        context.addIssue({
          code: "custom",
          message: "Year is required.",
          path: ["members", index, "yearOfStudy"],
        });
      } else if (!YEAR_OPTIONS.includes(member.yearOfStudy as (typeof YEAR_OPTIONS)[number])) {
        context.addIssue({
          code: "custom",
          message: "Select a valid year.",
          path: ["members", index, "yearOfStudy"],
        });
      }
    }
  });

type HackathonFormValues = z.infer<typeof hackathonSchema>;

type MessageTone = "ok" | "error" | "info";

interface HackathonFormProps {
  qrSrc: string;
  duoQrSrc: string;
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
            "mx-8 mb-4 mt-5 rounded-[11px] border px-3.5 py-3 text-[13px] font-semibold max-sm:mx-4 max-sm:mb-3",
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
  branchOther: "",
  yearOfStudy: "",
});

export default function HackathonForm({ qrSrc, duoQrSrc }: HackathonFormProps) {
  const {
    register,
    control,
    watch,
    setValue,
    setError,
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
      state: "",
      teamSize: 2,
      members: [
        createEmptyMember(),
        createEmptyMember(),
        createEmptyMember(),
        createEmptyMember(),
      ],
      transactionId: "",
    },
  });

  const teamSize = watch("teamSize");
  const watchedMembers = watch("members");

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
      const uploadedUrl = await uploadPaymentScreenshot({
        file,
        registrationType: "hackathon",
      });

      setUploadMessage("Screenshot uploaded successfully.");
      setUploadMessageTone("ok");
      setFileError(undefined);
      return uploadedUrl;
    } catch (error) {
      console.error("Hackathon screenshot upload failed:", error);
      const message =
        error instanceof RuntimeApiError && error.message
          ? error.message
          : "Screenshot upload failed. Please try again.";

      setUploadMessage(message);
      setUploadMessageTone("error");
      setFileError(message);
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

    const activeMembers = values.members.slice(0, values.teamSize).map((member) => {
      const resolvedBranch =
        member.department === OTHER_BRANCH_OPTION
          ? String(member.branchOther || "").trim()
          : member.department.trim();

      return {
        name: member.name.trim(),
        email: member.email.trim().toLowerCase(),
        phone: member.phone.trim(),
        roll_number: member.rollNumber.trim(),
        state: values.state.trim(),
        branch: resolvedBranch,
        department: resolvedBranch,
        branch_selection: member.department.trim(),
        year_of_study: member.yearOfStudy.trim(),
        yearOfStudy: member.yearOfStudy.trim(),
      };
    });

    const emailToIndices = new Map<string, number[]>();
    const phoneToIndices = new Map<string, number[]>();

    activeMembers.forEach((member, index) => {
      const emailIndices = emailToIndices.get(member.email) || [];
      emailIndices.push(index);
      emailToIndices.set(member.email, emailIndices);

      const phoneIndices = phoneToIndices.get(member.phone) || [];
      phoneIndices.push(index);
      phoneToIndices.set(member.phone, phoneIndices);
    });

    let hasInFormDuplicate = false;

    emailToIndices.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((index) => {
          setError(`members.${index}.email` as const, {
            type: "manual",
            message: "This email is duplicated inside your team.",
          });
        });
        hasInFormDuplicate = true;
      }
    });

    phoneToIndices.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((index) => {
          setError(`members.${index}.phone` as const, {
            type: "manual",
            message: "This phone number is duplicated inside your team.",
          });
        });
        hasInFormDuplicate = true;
      }
    });

    if (hasInFormDuplicate) {
      setSubmitError("Duplicate email/phone found in this team. Fix highlighted fields.");
      setIsSubmitting(false);
      return;
    }

    try {
      const uploadedUrl = await uploadScreenshot(selectedFile);
      if (!uploadedUrl) {
        return;
      }

      const idempotencyKey = createIdempotencyKey("hackathon", [
        values.teamName,
        values.transactionId,
        activeMembers[0]?.email,
      ]);

      await submitHackathonRegistration(
        {
          team_name: values.teamName.trim(),
          college: values.college.trim(),
          state: values.state.trim(),
          team_size: values.teamSize,
          members: activeMembers,
          upi_transaction_id: values.transactionId.trim(),
          screenshot_url: uploadedUrl,
        },
        idempotencyKey
      );

      setSubmitSuccess(
        "Registration successful. Team leader will be notified shortly with access credentials."
      );
      reset({
        teamName: "",
        college: "",
        state: "",
        teamSize: 2,
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

      if (error instanceof RuntimeApiError) {
        const memberEmailConflicts = Array.isArray(error.fieldErrors?.member_emails)
          ? error.fieldErrors.member_emails
              .map((entry) => String(entry || "").trim().toLowerCase())
              .filter(Boolean)
          : [];

        const memberPhoneConflicts = Array.isArray(error.fieldErrors?.member_phones)
          ? error.fieldErrors.member_phones
              .map((entry) => String(entry || "").trim())
              .filter(Boolean)
          : [];

        if (memberEmailConflicts.length > 0 || memberPhoneConflicts.length > 0) {
          activeMembers.forEach((member, index) => {
            if (memberEmailConflicts.includes(member.email)) {
              setError(`members.${index}.email` as const, {
                type: "manual",
                message: "This email is already registered for hackathon.",
              });
            }

            if (memberPhoneConflicts.includes(member.phone)) {
              setError(`members.${index}.phone` as const, {
                type: "manual",
                message: "This phone number is already registered for hackathon.",
              });
            }
          });
        }

        setSubmitError(error.message || "Failed to complete hackathon registration.");
        return;
      }

      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "Connection error. Please check your internet and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeamSizeChange = (size: 2 | 3 | 4) => {
    setValue("teamSize", size, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });

    const hiddenMemberErrors = [2, 3]
      .filter((index) => index >= size)
      .flatMap((index) => [
        `members.${index}.name`,
        `members.${index}.email`,
        `members.${index}.phone`,
        `members.${index}.rollNumber`,
        `members.${index}.department`,
        `members.${index}.branchOther`,
        `members.${index}.yearOfStudy`,
      ]);

    if (hiddenMemberErrors.length > 0) {
      clearErrors([
        ...(hiddenMemberErrors as Array<
          | "members.2.name"
          | "members.2.email"
          | "members.2.phone"
          | "members.2.rollNumber"
          | "members.2.department"
          | "members.2.branchOther"
          | "members.2.yearOfStudy"
          | "members.3.name"
          | "members.3.email"
          | "members.3.phone"
          | "members.3.rollNumber"
          | "members.3.department"
          | "members.3.branchOther"
          | "members.3.yearOfStudy"
        >),
      ]);
    }

    setSubmitError("");
    setSubmitSuccess("");
  };

  const runSubmit = handleSubmit(onSubmit);
  const displayAmount = teamSize === 2 ? "₹ 500" : "₹ 800";
  const displayQrSrc = teamSize === 2 ? duoQrSrc : qrSrc;

  const renderMemberCard = (index: number) => {
    const isLeader = index === 0;
    const branchSelection = watchedMembers?.[index]?.department;

    return (
      <motion.div
        key={`member-${index + 1}`}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.25 }}
        className="overflow-visible rounded-2xl border border-[rgba(141,54,213,0.14)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[rgba(141,54,213,0.1)] bg-[rgba(141,54,213,0.1)] px-4 py-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#46067A,#8D36D5)] font-[var(--font-dm-mono)] text-[10px] font-medium text-white shadow-[0_0_10px_rgba(141,54,213,0.5)]">
            {String(index + 1).padStart(2, "0")}
          </div>
          <p className="font-[var(--font-syne)] text-[11px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
            Member {index + 1}
          </p>
          {isLeader ? (
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
              {...register(`members.${index}.name` as const, {
                onChange: () => clearErrors(`members.${index}.name` as const),
              })}
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
                {...register(`members.${index}.email` as const, {
                  onChange: () => {
                    clearErrors(`members.${index}.email` as const);
                    setSubmitError("");
                  },
                })}
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
                {...register(`members.${index}.phone` as const, {
                  onChange: () => {
                    clearErrors(`members.${index}.phone` as const);
                    setSubmitError("");
                  },
                })}
              />
              <AnimatedFieldError message={errors.members?.[index]?.phone?.message} />
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
                {...register(`members.${index}.rollNumber` as const, {
                  onChange: () => clearErrors(`members.${index}.rollNumber` as const),
                })}
              />
              <AnimatedFieldError message={errors.members?.[index]?.rollNumber?.message} />
            </div>

            <div>
              <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                Branch
              </label>
              <Controller
                control={control}
                name={`members.${index}.department` as const}
                render={({ field }) => (
                  <CyberDropdown
                    value={field.value || ""}
                    options={BRANCH_OPTIONS_WITH_OTHER}
                    placeholder="Select branch"
                    onChange={(nextValue) => {
                      field.onChange(nextValue);
                      clearErrors(`members.${index}.department` as const);

                      if (nextValue !== OTHER_BRANCH_OPTION) {
                        setValue(`members.${index}.branchOther` as const, "", {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        clearErrors(`members.${index}.branchOther` as const);
                      }
                    }}
                  />
                )}
              />
              <AnimatedFieldError message={errors.members?.[index]?.department?.message} />
            </div>
          </div>

          {branchSelection === OTHER_BRANCH_OPTION ? (
            <div>
              <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                Enter Branch
              </label>
              <input
                type="text"
                placeholder="Type branch name"
                className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                {...register(`members.${index}.branchOther` as const, {
                  onChange: () => clearErrors(`members.${index}.branchOther` as const),
                })}
              />
              <AnimatedFieldError message={errors.members?.[index]?.branchOther?.message} />
            </div>
          ) : null}

          <div>
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              Year
            </label>
            <Controller
              control={control}
              name={`members.${index}.yearOfStudy` as const}
              render={({ field }) => (
                <CyberDropdown
                  value={field.value || ""}
                  options={YEAR_OPTIONS}
                  placeholder="Select year"
                  onChange={(nextValue) => {
                    field.onChange(nextValue);
                    clearErrors(`members.${index}.yearOfStudy` as const);
                  }}
                />
              )}
            />
            <AnimatedFieldError message={errors.members?.[index]?.yearOfStudy?.message} />
          </div>
        </div>
      </motion.div>
    );
  };

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

        <div className="mb-4 grid grid-cols-1 gap-[14px] sm:grid-cols-2">
          <div>
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              Team Name
            </label>
            <input
              type="text"
              placeholder="Enter team name"
              className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
              {...register("teamName", {
                onChange: () => {
                  clearErrors("teamName");
                  setSubmitError("");
                },
              })}
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

        <div className="mb-4">
          <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
            State
          </label>
          <Controller
            control={control}
            name="state"
            render={({ field }) => (
              <CyberDropdown
                value={field.value || ""}
                options={INDIA_STATES}
                placeholder="Select state"
                onChange={(nextValue) => {
                  field.onChange(nextValue);
                  clearErrors("state");
                }}
              />
            )}
          />
          <AnimatedFieldError message={errors.state?.message} />
        </div>

        <div>
          <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
            Team Size
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              className={[
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-[var(--font-syne)] text-[12px] font-bold uppercase tracking-[0.08em] transition-all duration-300",
                teamSize === 2
                  ? "border-[#8D36D5] bg-[rgba(141,54,213,0.2)] text-[#EDE8F5] shadow-[0_0_0_2px_rgba(141,54,213,0.15),0_0_20px_rgba(141,54,213,0.12)]"
                  : "border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] text-[rgba(237,232,245,0.45)] hover:border-[rgba(141,54,213,0.5)] hover:bg-[rgba(141,54,213,0.1)] hover:text-[#EDE8F5]",
              ].join(" ")}
              onClick={() => handleTeamSizeChange(2)}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  teamSize === 2
                    ? "bg-[#8D36D5] shadow-[0_0_8px_#8D36D5]"
                    : "bg-[rgba(141,54,213,0.4)]",
                ].join(" ")}
              />
              2 Members
            </button>
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
          <AnimatePresence initial={false}>
            {Array.from({ length: teamSize }, (_, index) => renderMemberCard(index))}
          </AnimatePresence>
        </div>
      </div>

      <PaymentSection
        type="hackathon"
        amount={displayAmount}
        amountSuffix="per team"
        qrSrc={displayQrSrc}
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
