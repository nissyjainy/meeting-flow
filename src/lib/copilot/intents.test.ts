import { describe, expect, it } from "vitest";

import {

  classifyCopilotIntent,

  COPILOT_SUPPORTED_QUERY_EXAMPLES,

  intentUsesWorkspaceContext,

} from "./intents";



describe("classifyCopilotIntent", () => {

  it("classifies workspace intents before broader patterns", () => {

    expect(classifyCopilotIntent("Show pending tasks")).toBe("pending_tasks");

    expect(classifyCopilotIntent("What tasks are overdue?")).toBe("overdue_tasks");

    expect(classifyCopilotIntent("How many tasks are completed?")).toBe("completion_stats");

    expect(classifyCopilotIntent("Show recent reminders sent")).toBe("reminder_history");

  });



  it("classifies accountability analytics intents", () => {

    expect(classifyCopilotIntent("Show execution health")).toBe("execution_health");

    expect(classifyCopilotIntent("What is the team's completion rate?")).toBe("completion_rate");

    expect(classifyCopilotIntent("Who is the best performer?")).toBe("best_performer");

    expect(classifyCopilotIntent("Who has the most overdue tasks?")).toBe("most_delayed_owner");

    expect(classifyCopilotIntent("On-time completion rate")).toBe("on_time_completion");

    expect(classifyCopilotIntent("Average completion time")).toBe("average_completion_time");

    expect(classifyCopilotIntent("Weekly completion trend")).toBe("weekly_completion_trend");

  });



  it("routes owner overdue queries to most_delayed_owner, not overdue_tasks", () => {

    expect(classifyCopilotIntent("Who has the most overdue tasks?")).toBe("most_delayed_owner");

    expect(classifyCopilotIntent("Show overdue tasks")).toBe("overdue_tasks");

  });



  it("routes completion rate separately from completion stats", () => {

    expect(classifyCopilotIntent("What is the team's completion rate?")).toBe("completion_rate");

    expect(classifyCopilotIntent("How many tasks are completed?")).toBe("completion_stats");

  });



  it("does not route overdue task queries to task_deadlines", () => {

    expect(classifyCopilotIntent("Show overdue tasks")).toBe("overdue_tasks");

    expect(classifyCopilotIntent("Show deadlines")).toBe("task_deadlines");

  });



  it("does not route reminder history to reminder_status", () => {

    expect(classifyCopilotIntent("Reminder history")).toBe("reminder_history");

    expect(classifyCopilotIntent("Reminder status")).toBe("reminder_status");

  });



  it("preserves legacy meeting intents", () => {

    expect(classifyCopilotIntent("Summarize this meeting")).toBe("meeting_summary");

    expect(classifyCopilotIntent("List action items")).toBe("extracted_tasks");

    expect(classifyCopilotIntent("Who owns each task?")).toBe("task_owners");

  });



  it("returns null for unsupported queries", () => {

    expect(classifyCopilotIntent("What's the weather?")).toBeNull();

  });

});



describe("classifyCopilotIntent advanced insights", () => {

  it("classifies weekly focus before generic patterns", () => {

    expect(classifyCopilotIntent("What should I focus on this week?")).toBe("weekly_focus");

  });



  it("classifies executive briefing before meeting summary", () => {

    expect(classifyCopilotIntent("Give me an executive briefing")).toBe("executive_briefing");

    expect(classifyCopilotIntent("Summarize execution health")).toBe("executive_briefing");

    expect(classifyCopilotIntent("What should leadership know this week?")).toBe(

      "executive_briefing",

    );

  });



  it("classifies all advanced insight example queries", () => {

    expect(classifyCopilotIntent("Who improved the most this month?")).toBe("owner_improvement");

    expect(classifyCopilotIntent("Who declined this month?")).toBe("owner_decline");

    expect(classifyCopilotIntent("What is slowing execution?")).toBe("execution_bottlenecks");

    expect(classifyCopilotIntent("Which owners need attention?")).toBe("at_risk_owners");

    expect(classifyCopilotIntent("Which tasks are most at risk?")).toBe("at_risk_tasks");

    expect(classifyCopilotIntent("Which meetings generated the most action items?")).toBe(

      "meetings_most_tasks",

    );

    expect(classifyCopilotIntent("Is workload balanced?")).toBe("workload_imbalance");

  });



  it("does not misroute at-risk tasks to extracted_tasks", () => {

    expect(classifyCopilotIntent("Which tasks are most at risk?")).not.toBe("extracted_tasks");

    expect(classifyCopilotIntent("Which meetings generated the most action items?")).not.toBe(

      "extracted_tasks",

    );

  });



  it("still routes show overdue tasks to overdue_tasks", () => {

    expect(classifyCopilotIntent("Show overdue tasks")).toBe("overdue_tasks");

  });

});



describe("intentUsesWorkspaceContext", () => {

  it("marks workspace intents as workspace-scoped", () => {

    for (const intent of [

      "pending_tasks",

      "overdue_tasks",

      "completion_stats",

      "reminder_history",

      "execution_health",

      "completion_rate",

      "on_time_completion",

      "average_completion_time",

      "best_performer",

      "most_delayed_owner",

      "weekly_completion_trend",

      "owner_improvement",

      "owner_decline",

      "execution_bottlenecks",

      "meetings_most_tasks",

      "at_risk_owners",

      "at_risk_tasks",

      "weekly_focus",

      "workload_imbalance",

      "executive_briefing",

    ] as const) {

      expect(intentUsesWorkspaceContext(intent)).toBe(true);

    }



    expect(intentUsesWorkspaceContext("meeting_summary")).toBe(false);

    expect(intentUsesWorkspaceContext("extracted_tasks")).toBe(false);

  });

});



describe("COPILOT_SUPPORTED_QUERY_EXAMPLES", () => {

  it("includes example queries for every intent", () => {

    const intents = [

      "meeting_summary",

      "extracted_tasks",

      "task_owners",

      "task_deadlines",

      "reminder_status",

      "pending_tasks",

      "overdue_tasks",

      "completion_stats",

      "reminder_history",

      "execution_health",

      "completion_rate",

      "on_time_completion",

      "average_completion_time",

      "best_performer",

      "most_delayed_owner",

      "weekly_completion_trend",

      "owner_improvement",

      "owner_decline",

      "execution_bottlenecks",

      "meetings_most_tasks",

      "at_risk_owners",

      "at_risk_tasks",

      "weekly_focus",

      "workload_imbalance",

      "executive_briefing",

    ] as const;



    for (const intent of intents) {

      expect(COPILOT_SUPPORTED_QUERY_EXAMPLES[intent].length).toBeGreaterThan(0);

    }

  });

});


