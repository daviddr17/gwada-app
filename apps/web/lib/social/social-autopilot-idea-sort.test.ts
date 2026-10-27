import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialAutopilotIdea } from "./social-autopilot-ideas";
import {
  availableSocialAutopilotIdeaFilters,
  filterSocialAutopilotIdeas,
  groupSocialAutopilotIdeas,
} from "./social-autopilot-idea-sort";

function idea(
  partial: Pick<SocialAutopilotIdea, "id" | "slotKind"> &
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

test("groupSocialAutopilotIdeas orders Events → Speisekarte → Galerie → Feiertag → Marke", () => {
  const groups = groupSocialAutopilotIdeas([
    idea({ id: "brand:cover", slotKind: "brand" }),
    idea({ id: "menu:1", slotKind: "menu_dish" }),
    idea({ id: "event:1", slotKind: "event" }),
    idea({ id: "gallery:1", slotKind: "ambient" }),
    idea({ id: "holiday:2026-10-28", slotKind: "holiday" }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.slotKind),
    ["event", "menu_dish", "ambient", "holiday", "brand"],
  );
});

test("filterSocialAutopilotIdeas Empfohlen keeps all; Speisekarte filters", () => {
  const ideas = [
    idea({ id: "event:1", slotKind: "event" }),
    idea({ id: "menu:1", slotKind: "menu_dish" }),
  ];
  assert.equal(filterSocialAutopilotIdeas(ideas, "all").length, 2);
  assert.deepEqual(
    filterSocialAutopilotIdeas(ideas, "menu_dish").map((i) => i.id),
    ["menu:1"],
  );
});

test("availableSocialAutopilotIdeaFilters always includes Empfohlen", () => {
  const filters = availableSocialAutopilotIdeaFilters([
    idea({ id: "menu:1", slotKind: "menu_dish" }),
  ]);
  assert.deepEqual(filters, ["all", "menu_dish"]);
});
