import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialAutopilotIdea } from "./social-autopilot-ideas";
import {
  availableSocialAutopilotIdeaFilters,
  filterSocialAutopilotIdeas,
  groupSocialAutopilotIdeas,
  SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS,
} from "./social-autopilot-idea-sort";

function idea(
  partial: Pick<SocialAutopilotIdea, "id" | "slotKind" | "sourceBucket"> &
    Partial<SocialAutopilotIdea>,
): SocialAutopilotIdea {
  return {
    title: partial.title ?? partial.id,
    reasonLabel: partial.reasonLabel ?? "x",
    reasonDetail: partial.reasonDetail ?? "y",
    imageUrl: partial.imageUrl ?? "https://example.com/x.jpg",
    imageLabel: partial.imageLabel ?? "img",
    ...partial,
  };
}

test("groupSocialAutopilotIdeas orders Speisekarte → Galerie → KI-Ideen", () => {
  const groups = groupSocialAutopilotIdeas([
    idea({ id: "ai:voice", slotKind: "brand", sourceBucket: "ai" }),
    idea({ id: "menu:1", slotKind: "menu_dish", sourceBucket: "menu" }),
    idea({ id: "gallery:1", slotKind: "ambient", sourceBucket: "gallery" }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.sourceBucket),
    ["menu", "gallery", "ai"],
  );
  assert.equal(groups[2]?.label, "KI-Ideen");
});

test("filterSocialAutopilotIdeas Alle keeps all; Speisekarte filters", () => {
  const ideas = [
    idea({ id: "ai:1", slotKind: "brand", sourceBucket: "ai" }),
    idea({ id: "menu:1", slotKind: "menu_dish", sourceBucket: "menu" }),
  ];
  assert.equal(filterSocialAutopilotIdeas(ideas, "all").length, 2);
  assert.deepEqual(
    filterSocialAutopilotIdeas(ideas, "menu").map((i) => i.id),
    ["menu:1"],
  );
  assert.equal(SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS.all, "Alle");
});

test("availableSocialAutopilotIdeaFilters always includes Alle", () => {
  const filters = availableSocialAutopilotIdeaFilters([
    idea({ id: "menu:1", slotKind: "menu_dish", sourceBucket: "menu" }),
  ]);
  assert.deepEqual(filters, ["all", "menu"]);
});
