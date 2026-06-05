import { createFileRoute } from "@tanstack/react-router";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { pageTitle } from "@/lib/branding";

export const Route = createFileRoute("/_app/assistant")({
  head: () => ({
    meta: [
      { title: pageTitle("Assistant") },
      {
        name: "description",
        content:
          "Ask questions across all your meetings — decisions, action items, owners, deadlines, and topics.",
      },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  return <AssistantChat />;
}
