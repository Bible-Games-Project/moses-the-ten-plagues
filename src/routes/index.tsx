import { createFileRoute } from "@tanstack/react-router";
import { PlagueOne } from "@/game/PlagueOne";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Moses: The Ten Plagues — Plague I" },
      { name: "description", content: "A minimalist pixel platformer. Play Moses through the plagues of Egypt." },
      { property: "og:title", content: "Moses: The Ten Plagues" },
      { property: "og:description", content: "Plague I – Water Turned to Blood. A minimalist biblical precision platformer." },
    ],
  }),
  component: Index,
});

function Index() {
  return <PlagueOne />;
}
