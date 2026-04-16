import ProblemStatementsPublicView from "../../components/problem-statements/ProblemStatementsPublicView";
import { getProblemStatementCatalog } from "../../../lib/server/problem-statements";

export const dynamic = "force-dynamic";

export default function ProblemStatementsPage() {
  const statements = getProblemStatementCatalog();

  return <ProblemStatementsPublicView statements={statements} />;
}
