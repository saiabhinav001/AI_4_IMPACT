import { NextResponse } from "next/server";
import { getHackathonConfig } from "../../../../../lib/server/hackathon";

function toMillis(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const time = Date.parse(value);
  return Number.isNaN(time) ? NaN : time;
}

export async function GET() {
  try {
    const config = await getHackathonConfig();
    const events = Array.isArray(config.timelineEvents) ? config.timelineEvents : [];
    const now = Date.now();

    let activeEvent = null;
    for (const event of events) {
      const start = toMillis(event?.startAt);
      const end = toMillis(event?.endAt);
      if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end) {
        activeEvent = event;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      currentPhase: config.currentPhase,
      activeEvent,
      timelineEvents: events,
      now,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to resolve active timeline event." },
      { status: 500 }
    );
  }
}
