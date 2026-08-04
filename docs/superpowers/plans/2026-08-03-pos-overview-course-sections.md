# POS Überblick Gang-Sektionen + Cart-Badges + Entwurf leeren — Plan

> **For agentic workers:** Implement task-by-task. Commits only if user asks.

**Goal:** Course sections on overview, cart-only menu badges, clear-draft in Bon sheet.

**Spec:** `docs/superpowers/specs/2026-08-03-pos-overview-course-sections-design.md`

## Tasks

### Task 1: Cart-only badges
- Modify `TableSessionView.quantityForMenuItem` to sum cart only.
- Optional unit-free: manual/UITest later.
- Verify build.

### Task 2: Overview course sections
- Modify `TableSessionOverviewView`: group by course, section headers, remove top chip row; filter redundant course label from detail.
- Helper optional in `PosSessionOverviewMath.groupedOpenLines(byCourse:)` if cleaner.

### Task 3: Entwurf leeren
- Modify `BonSheetView`: secondary button when cart non-empty; alert if quantity/lines > 1; `cart = []`.

### Task 4: Smoke
- Build + launch simulator; or extend TableOverviewUITests lightly if cheap.
