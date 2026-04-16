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
  submitWorkshopRegistration,
  uploadPaymentScreenshot,
} from "./runtimeRegistrationApi";

const workshopSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full Name is required."),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Phone must be exactly 10 digits."),
    college: z.string().trim().min(1, "College / University is required."),
    state: z.string().trim().min(1, "State is required."),
    rollNumber: z.string().trim().min(1, "Roll Number is required."),
    department: z.string().trim().min(1, "Branch is required."),
    branchOther: z.string().trim().optional(),
    yearOfStudy: z.string().trim().min(1, "Year is required."),
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

    if (data.department === OTHER_BRANCH_OPTION) {
      if (!String(data.branchOther || "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Please enter your branch name.",
          path: ["branchOther"],
        });
      }
    } else if (!BRANCH_OPTIONS.includes(data.department as (typeof BRANCH_OPTIONS)[number])) {
      context.addIssue({
        code: "custom",
        message: "Select a valid branch.",
        path: ["department"],
      });
    }

    if (!YEAR_OPTIONS.includes(data.yearOfStudy as (typeof YEAR_OPTIONS)[number])) {
      context.addIssue({
        code: "custom",
        message: "Select a valid year.",
        path: ["yearOfStudy"],
      });
    }
  });

type WorkshopFormValues = z.infer<typeof workshopSchema>;

type MessageTone = "ok" | "error" | "info";

interface WorkshopFormProps {
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

export default function WorkshopForm({ qrSrc }: WorkshopFormProps) {
  const {
    register,
    control,
    setValue,
    setError,
    clearErrors,
    watch,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopSchema),
    mode: "onSubmit",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      college: "",
      state: "",
      rollNumber: "",
      department: "",
      branchOther: "",
      yearOfStudy: "",
      transactionId: "",
    },
  });

  const selectedBranch = watch("department");

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
        registrationType: "workshop",
      });

      setUploadMessage("Screenshot uploaded successfully.");
      setUploadMessageTone("ok");
      setFileError(undefined);
      return uploadedUrl;
    } catch (error) {
      console.error("Workshop screenshot upload failed:", error);
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

  const onSubmit = async (values: WorkshopFormValues) => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!selectedFile) {
      setFileError("Payment screenshot is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      const normalizedPhone = values.phone.trim();

      const branchValue =
        values.department === OTHER_BRANCH_OPTION
          ? String(values.branchOther || "").trim()
          : values.department.trim();
      const stateValue = values.state.trim();
      const collegeValue = values.college.trim();

      const uploadedUrl = await uploadScreenshot(selectedFile);
      if (!uploadedUrl) {
        return;
      }

      const idempotencyKey = createIdempotencyKey("workshop", [
        normalizedEmail,
        normalizedPhone,
        values.transactionId,
      ]);

      await submitWorkshopRegistration(
        {
          name: values.fullName.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          college: collegeValue,
          state: stateValue,
          roll_number: values.rollNumber.trim(),
          branch: branchValue,
          department: branchValue,
          branch_selection: values.department.trim(),
          year_of_study: values.yearOfStudy.trim(),
          yearOfStudy: values.yearOfStudy.trim(),
          upi_transaction_id: values.transactionId.trim(),
          screenshot_url: uploadedUrl,
        },
        idempotencyKey
      );

      setSubmitSuccess(
        "Registration successful. We'll contact you shortly regarding the venue details."
      );
      reset();
      setSelectedFile(null);
      setFileName("");
      setUploadMessage("");
      setFileError(undefined);
    } catch (error) {
      console.error("Workshop registration failed:", error);

      if (error instanceof RuntimeApiError) {
        const hasEmailConflict = Boolean(error.fieldErrors?.email);
        const hasPhoneConflict = Boolean(error.fieldErrors?.phone);

        if (hasEmailConflict) {
          setError("email", {
            type: "manual",
            message: "This email is already used for workshop registration.",
          });
        }

        if (hasPhoneConflict) {
          setError("phone", {
            type: "manual",
            message: "This phone number is already used for workshop registration.",
          });
        }

        setSubmitError(error.message || "Failed to complete workshop registration.");
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

  const runSubmit = handleSubmit(onSubmit);

  return (
    <div role="form" aria-label="Workshop registration form" className="pb-0">
      <div className="border-b border-[rgba(141,54,213,0.1)] px-8 py-7 max-sm:px-4 max-sm:py-5">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded bg-[linear-gradient(180deg,#8D36D5,#46067A)] shadow-[0_0_10px_#8D36D5]" />
          <h2 className="font-[var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
            Participant Details
          </h2>
          <span className="ml-auto font-[var(--font-dm-mono)] text-[9px] uppercase tracking-[0.1em] text-[#8D36D5]/70">
            01 / 02
          </span>
        </div>

        <div className="mb-4">
          <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
            Full Name
          </label>
          <input
            type="text"
            placeholder="Your full name"
            className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
            {...register("fullName")}
          />
          <AnimatedFieldError message={errors.fullName?.message} />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="mb-5">
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              Email
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
              {...register("email", {
                onChange: () => {
                  clearErrors("email");
                  setSubmitError("");
                },
              })}
            />
            <AnimatedFieldError message={errors.email?.message} />
          </div>
          <div className="mb-5">
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              Phone
            </label>
            <input
              type="tel"
              placeholder="10-digit mobile"
              className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
              {...register("phone", {
                onChange: () => {
                  clearErrors("phone");
                  setSubmitError("");
                },
              })}
            />
            <AnimatedFieldError message={errors.phone?.message} />
          </div>
        </div>

        <div className="mb-5">
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

        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
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
              Roll Number
            </label>
            <input
              type="text"
              placeholder="e.g. 21BCE0001"
              className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
              {...register("rollNumber")}
            />
            <AnimatedFieldError message={errors.rollNumber?.message} />
          </div>

          <div>
            <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
              Branch
            </label>
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <CyberDropdown
                  value={field.value || ""}
                  options={BRANCH_OPTIONS_WITH_OTHER}
                  placeholder="Select branch"
                  onChange={(nextValue) => {
                    field.onChange(nextValue);
                    clearErrors("department");

                    if (nextValue !== OTHER_BRANCH_OPTION) {
                      setValue("branchOther", "", {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      clearErrors("branchOther");
                    }
                  }}
                />
              )}
            />
            <AnimatedFieldError message={errors.department?.message} />

            {selectedBranch === OTHER_BRANCH_OPTION ? (
              <div className="mt-3">
                <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
                  Enter Branch
                </label>
                <input
                  type="text"
                  placeholder="Type your branch"
                  className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
                  {...register("branchOther", {
                    onChange: () => clearErrors("branchOther"),
                  })}
                />
                <AnimatedFieldError message={errors.branchOther?.message} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-8">
          <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
            Year
          </label>
          <Controller
            control={control}
            name="yearOfStudy"
            render={({ field }) => (
              <CyberDropdown
                value={field.value || ""}
                options={YEAR_OPTIONS}
                placeholder="Select year"
                onChange={(nextValue) => {
                  field.onChange(nextValue);
                  clearErrors("yearOfStudy");
                }}
              />
            )}
          />
          <AnimatedFieldError message={errors.yearOfStudy?.message} />
        </div>
      </div>

      <PaymentSection
        type="workshop"
        amount="₹ 60"
        amountSuffix="per person"
        qrSrc={qrSrc}
        sectionTag="02 / 02"
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
          label="Submit Workshop Registration"
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
