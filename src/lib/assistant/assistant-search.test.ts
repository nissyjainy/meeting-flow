import { describe, expect, it } from "vitest";
import { extractSearchTerms, KeywordAssistantSearchStrategy } from "./assistant-search";
import type { AssistantCorpus } from "./types";

function corpus(meetings: AssistantCorpus["meetings"]): AssistantCorpus {
  return {
    meetings,
    userEmail: "nisarg@example.com",
    userName: "Nisarg",
  };
}

describe("extractSearchTerms", () => {
  it("filters stop words and short tokens", () => {
    expect(extractSearchTerms("What tasks are assigned to Nisarg?")).toEqual([
      "tasks",
      "assigned",
      "nisarg",
    ]);
  });
});

describe("KeywordAssistantSearchStrategy", () => {
  const strategy = new KeywordAssistantSearchStrategy();

  it("ranks meetings by owner and task matches", () => {
    const hits = strategy.search(
      "What action items were assigned to Nisarg?",
      corpus([
        {
          meetingId: "m1",
          meetingTitle: "Weekly Sync",
          meetingDate: "May 22, 2026",
          createdAt: "2026-05-22T10:00:00.000Z",
          summary: "Discussed pricing updates.",
          transcript: "We talked about onboarding.",
          pipelineStatus: "ready",
          tasks: [
            {
              id: "t1",
              task: "Update pricing page",
              owner: "Alex",
              deadline: "2026-06-01",
              status: "pending",
            },
          ],
        },
        {
          meetingId: "m2",
          meetingTitle: "Product Review",
          meetingDate: "May 28, 2026",
          createdAt: "2026-05-28T10:00:00.000Z",
          summary: "Marketing launch plan.",
          transcript: "Nisarg will own the onboarding checklist.",
          pipelineStatus: "ready",
          tasks: [
            {
              id: "t2",
              task: "Draft onboarding checklist",
              owner: "Nisarg",
              deadline: "2026-06-05",
              status: "pending",
            },
          ],
        },
      ]),
    );

    expect(hits[0]?.meetingId).toBe("m2");
    expect(hits[0]?.matchedFields).toContain("owners");
  });

  it("matches transcript and summary topics", () => {
    const hits = strategy.search(
      "What did we decide about pricing?",
      corpus([
        {
          meetingId: "m1",
          meetingTitle: "Weekly Sync",
          meetingDate: "May 22, 2026",
          createdAt: "2026-05-22T10:00:00.000Z",
          summary: "Team agreed to raise pricing for enterprise tier.",
          transcript: "Pricing discussion for enterprise customers.",
          pipelineStatus: "ready",
          tasks: [],
        },
      ]),
    );

    expect(hits).toHaveLength(1);
    expect(hits[0]?.matchedFields).toEqual(expect.arrayContaining(["summary", "transcript"]));
  });
});
