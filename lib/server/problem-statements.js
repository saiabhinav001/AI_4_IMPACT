const ENV = globalThis?.process?.env || {};

export const PROBLEM_STATEMENT_SELECTION_COLLECTION = "team_problem_selection";
export const PROBLEM_STATEMENT_CAPACITY_COLLECTION = "problem_statement_capacity";
export const PROBLEM_STATEMENT_CAPACITY_DOC_ID = "global";

const DEFAULT_MAX_TEAMS_PER_PROBLEM = 5;

const STATIC_PROBLEM_STATEMENTS = Object.freeze([
  {
    id: "PS_DEMO_01",
    title: "Demo Problem Statement 01",
    description:
      "Replace this placeholder with the final published problem statement content.",
    category: "Demo",
  },
  {
    id: "PS_DEMO_02",
    title: "Demo Problem Statement 02",
    description:
      "Replace this placeholder with the final published problem statement content.",
    category: "Demo",
  },
  {
    id: "PS_DEMO_03",
    title: "Demo Problem Statement 03",
    description:
      "Replace this placeholder with the final published problem statement content.",
    category: "Demo",
  },
]);

function asTrimmedString(value) {
  return String(value || "").trim();
}

function toPositiveInteger(value, fallbackValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallbackValue;
  }

  return Math.floor(numeric);
}

function toIsoString(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeProblemId(value, fallbackValue = "") {
  const normalized = asTrimmedString(value)
    .toUpperCase()
    .replace(/\s+/g, "_");

  return normalized || fallbackValue;
}

function normalizeProblemStatement(rawStatement, index) {
  const fallbackId = `PS_DEMO_${String(index + 1).padStart(2, "0")}`;
  const id = normalizeProblemId(rawStatement?.id, fallbackId);

  return {
    id,
    title: asTrimmedString(rawStatement?.title || `Problem Statement ${index + 1}`),
    description: asTrimmedString(rawStatement?.description),
    category: asTrimmedString(rawStatement?.category || "General"),
  };
}

export const MAX_TEAMS_PER_PROBLEM = toPositiveInteger(
  ENV.PROBLEM_STATEMENT_MAX_TEAMS_PER_PROBLEM,
  DEFAULT_MAX_TEAMS_PER_PROBLEM
);

export function getProblemStatementCatalog() {
  return STATIC_PROBLEM_STATEMENTS.map((statement, index) =>
    normalizeProblemStatement(statement, index)
  );
}

export function findProblemStatementById(problemId, catalog = getProblemStatementCatalog()) {
  const normalizedProblemId = normalizeProblemId(problemId);
  if (!normalizedProblemId) {
    return null;
  }

  return (
    catalog.find((statement) => statement.id === normalizedProblemId) || null
  );
}

function normalizeCapacityCounts(rawCounts, catalog) {
  const source = rawCounts && typeof rawCounts === "object" ? rawCounts : {};
  const normalized = {};

  for (const statement of catalog) {
    const key = statement.id;
    const count = Number(source[key]);

    normalized[key] =
      Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  return normalized;
}

export function getProblemStatementCapacityRef(adminDb) {
  return adminDb
    .collection(PROBLEM_STATEMENT_CAPACITY_COLLECTION)
    .doc(PROBLEM_STATEMENT_CAPACITY_DOC_ID);
}

export async function readProblemStatementCapacitySnapshot(
  adminDb,
  catalog = getProblemStatementCatalog()
) {
  const capacityRef = getProblemStatementCapacityRef(adminDb);
  const capacityDoc = await capacityRef.get();

  const rawData = capacityDoc.exists ? capacityDoc.data() || {} : {};
  const maxTeamsPerProblem = toPositiveInteger(
    rawData?.max_teams_per_problem,
    MAX_TEAMS_PER_PROBLEM
  );

  return {
    maxTeamsPerProblem,
    counts: normalizeCapacityCounts(rawData?.counts, catalog),
    updatedAt: toIsoString(rawData?.updated_at),
  };
}

export function mapProblemStatementsWithCapacity({
  catalog = getProblemStatementCatalog(),
  capacitySnapshot,
} = {}) {
  const maxTeamsPerProblem = toPositiveInteger(
    capacitySnapshot?.maxTeamsPerProblem,
    MAX_TEAMS_PER_PROBLEM
  );
  const counts = normalizeCapacityCounts(capacitySnapshot?.counts, catalog);

  return catalog.map((statement) => {
    const selectedTeamsCount = counts[statement.id] || 0;
    const availableSlots = Math.max(0, maxTeamsPerProblem - selectedTeamsCount);

    return {
      problem_id: statement.id,
      title: statement.title,
      description: statement.description,
      category: statement.category,
      selected_teams_count: selectedTeamsCount,
      max_teams_allowed: maxTeamsPerProblem,
      available_slots: availableSlots,
      is_full: availableSlots <= 0,
    };
  });
}

function normalizeTeamSelectionRecord(doc, teamId) {
  const data = doc.data() || {};

  return {
    selection_id: doc.id,
    team_id: asTrimmedString(data?.team_id || teamId),
    problem_id: normalizeProblemId(data?.problem_id),
    problem_title: asTrimmedString(data?.problem_title),
    problem_description: asTrimmedString(data?.problem_description),
    selected_at: toIsoString(data?.selected_at || data?.created_at),
    selected_count_at_selection:
      Number.isFinite(Number(data?.selected_count_at_selection))
        ? Number(data?.selected_count_at_selection)
        : null,
    max_teams_allowed_at_selection:
      Number.isFinite(Number(data?.max_teams_allowed_at_selection))
        ? Number(data?.max_teams_allowed_at_selection)
        : null,
  };
}

export async function readTeamProblemSelection(adminDb, teamId) {
  const normalizedTeamId = asTrimmedString(teamId);
  if (!normalizedTeamId) {
    return null;
  }

  const directDoc = await adminDb
    .collection(PROBLEM_STATEMENT_SELECTION_COLLECTION)
    .doc(normalizedTeamId)
    .get();

  if (directDoc.exists) {
    return normalizeTeamSelectionRecord(directDoc, normalizedTeamId);
  }

  const fallbackSnapshot = await adminDb
    .collection(PROBLEM_STATEMENT_SELECTION_COLLECTION)
    .where("team_id", "==", normalizedTeamId)
    .limit(1)
    .get();

  if (fallbackSnapshot.empty) {
    return null;
  }

  return normalizeTeamSelectionRecord(fallbackSnapshot.docs[0], normalizedTeamId);
}
