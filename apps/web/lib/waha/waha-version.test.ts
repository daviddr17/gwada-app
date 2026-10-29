import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cleanWahaReleaseNoteItem,
  parseWahaReleaseNotes,
} from "./waha-version.ts";

test("cleanWahaReleaseNoteItem strips markdown, version prefix and links", () => {
  assert.equal(
    cleanWahaReleaseNoteItem(
      "-   `2026.10.1` - [**🏷️ Labels**](https://example.com/docs) - `type` and `isActive` fields.",
    ),
    "🏷️ Labels - type and isActive fields.",
  );
});

test("parseWahaReleaseNotes returns empty for missing body", () => {
  assert.deepEqual(parseWahaReleaseNotes(null), []);
  assert.deepEqual(parseWahaReleaseNotes(""), []);
});

test("parseWahaReleaseNotes maps sections to German titles and readable bullets", () => {
  const body = `
🆕 **New**

-   \`2026.10.1\` - [**Labels**](https://waha.devlike.pro/docs) - type fields.
-   \`2026.10.1\` - Groups - member tags

🛠️ **Fixes**

-   \`2026.10.1\` - **GOWS** - fix labels sync - [#2290](https://github.com/devlikeapro/waha/issues/2290)

**Full Changelog**: https://github.com/devlikeapro/waha/compare/a...b
`;
  const sections = parseWahaReleaseNotes(body);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["Neu", "Fehlerbehebungen"],
  );
  assert.deepEqual(sections[0]?.items, [
    "Labels - type fields.",
    "Groups - member tags",
  ]);
  assert.equal(sections[1]?.items[0], "GOWS - fix labels sync - #2290");
});

test("parseWahaReleaseNotes keeps known ChatWoot label", () => {
  const sections = parseWahaReleaseNotes("**ChatWoot**\n\n- Add member tag");
  assert.deepEqual(sections, [
    { title: "ChatWoot", items: ["Add member tag"] },
  ]);
});
