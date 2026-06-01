import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/meetings")({
  component: MeetingsLayout,
});

function MeetingsLayout() {
  return (
    <div className="w-full min-w-0">
      <Outlet />
    </div>
  );
}
