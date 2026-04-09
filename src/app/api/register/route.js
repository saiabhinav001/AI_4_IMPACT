import { NextResponse } from 'next/server';
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/admin";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const registerRateLimitStore = globalThis.__registerRateLimitStore || new Map();

if (!globalThis.__registerRateLimitStore) {
  globalThis.__registerRateLimitStore = registerRateLimitStore;
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const firstIp = forwarded.split(',')[0].trim();
  return firstIp || 'unknown';
}

function hitRateLimit(key) {
  const now = Date.now();
  const current = registerRateLimitStore.get(key);

  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    registerRateLimitStore.set(key, { count: 1, start: now });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  registerRateLimitStore.set(key, current);
  return false;
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^\+?[0-9\-\s]{8,18}$/.test(phone);
}

export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    if (hitRateLimit(`register:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: 'Too many registration attempts. Please retry in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    const { teamName, collegeName, teamSize, participants, payment } = body;
    const parsedTeamSize = Number(teamSize);

    // Basic validation
    if (!teamName || !collegeName || !teamSize || !participants || !payment) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (![3, 4].includes(parsedTeamSize)) {
      return NextResponse.json(
        { success: false, error: 'Team size must be 3 or 4' },
        { status: 400 }
      );
    }

    if (!Array.isArray(participants) || participants.length !== parsedTeamSize) {
      return NextResponse.json(
        { success: false, error: `Expected ${parsedTeamSize} participants, got ${participants?.length || 0}` },
        { status: 400 }
      );
    }

    const cleanTeamName = sanitizeText(teamName);
    const cleanCollegeName = sanitizeText(collegeName);
    const cleanPayment = {
      transactionId: sanitizeText(payment.transactionId || ''),
      screenshotUrl: sanitizeText(payment.screenshotUrl || ''),
      status: sanitizeText(payment.status || ''),
      paymentId: sanitizeText(payment.paymentId || ''),
      orderId: sanitizeText(payment.orderId || ''),
      amount: Number(payment.amount || 0),
    };

    if (!cleanTeamName || !cleanCollegeName) {
      return NextResponse.json(
        { success: false, error: 'Team and college name are required' },
        { status: 400 }
      );
    }

    const hasUploadProof = Boolean(cleanPayment.transactionId && cleanPayment.screenshotUrl);
    const hasRazorpayProof =
      cleanPayment.status === 'SUCCESS' &&
      Boolean(cleanPayment.paymentId && cleanPayment.orderId && cleanPayment.amount > 0);

    if (!hasUploadProof && !hasRazorpayProof) {
      return NextResponse.json(
        { success: false, error: 'Valid payment proof is required' },
        { status: 400 }
      );
    }

    // Validate each participant has required fields
    const cleanParticipants = [];
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.name || !p.roll || !p.email || !p.phone) {
        return NextResponse.json(
          { success: false, error: `Participant ${i + 1} is missing required fields` },
          { status: 400 }
        );
      }

      const cleanParticipant = {
        name: sanitizeText(p.name),
        roll: sanitizeText(p.roll),
        email: sanitizeText(p.email).toLowerCase(),
        phone: sanitizeText(p.phone),
      };

      if (!isValidEmail(cleanParticipant.email)) {
        return NextResponse.json(
          { success: false, error: `Participant ${i + 1} email is invalid` },
          { status: 400 }
        );
      }

      if (!isValidPhone(cleanParticipant.phone)) {
        return NextResponse.json(
          { success: false, error: `Participant ${i + 1} phone is invalid` },
          { status: 400 }
        );
      }

      cleanParticipants.push(cleanParticipant);
    }

    const members = cleanParticipants.map((participant, idx) => ({
      name: participant.name,
      roll: participant.roll,
      email: participant.email,
      phone: participant.phone,
      college: cleanCollegeName,
      uid: "",
      isLead: idx === 0,
    }));

    const legacyDocRef = adminDb.collection("registrations").doc();
    const teamDocRef = adminDb.collection("teams").doc();

    await Promise.all([
      legacyDocRef.set({
        teamName: cleanTeamName,
        collegeName: cleanCollegeName,
        teamSize: parsedTeamSize,
        participants: cleanParticipants,
        payment: cleanPayment,
        createdAt: FieldValue.serverTimestamp(),
        status: 'pending',
        notes: '',
      }),
      teamDocRef.set({
        teamName: cleanTeamName,
        leadUid: "",
        memberUids: [],
        members,
        payment: {
          screenshotUrl: cleanPayment.screenshotUrl || "",
          reference: cleanPayment.transactionId || cleanPayment.paymentId || "",
          status: "PENDING",
        },
        psSelection: {
          selected: false,
          problemStatementId: "",
          selectedAt: null,
          selectedBy: "",
          locked: false,
        },
        submission: {
          submitted: false,
          githubUrl: "",
          pptUrl: "",
          submittedAt: null,
          submittedBy: "",
          locked: false,
        },
        source: "legacy_public_form",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return NextResponse.json({ success: true, id: teamDocRef.id });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}