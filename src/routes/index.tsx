import { createFileRoute } from "@tanstack/react-router";
import { GameView } from "@/game/GameView";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Block Flag Wars — Red vs Blue Capture the Flag" },
      { name: "description", content: "Mine gold, buy swords and armor, build walls and steal the enemy flag in this fast browser brawler." },
      { property: "og:title", content: "Block Flag Wars" },
      { property: "og:description", content: "Red vs Blue capture-the-flag brawler: mine gold, upgrade, build, capture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameView,
});
