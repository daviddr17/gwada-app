import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { resolveGuidesMediaSignedUrls } from "@/lib/guides/guides-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DisplayGuide } from "@/lib/types/guides";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "guides");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: guides, error: guidesError } = await admin
    .from("restaurant_guides")
    .select(
      "id, title, short_description, sort_order, is_active, archived_at, category_id",
    )
    .eq("restaurant_id", access.restaurantId)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (guidesError) {
    return NextResponse.json({ error: guidesError.message }, { status: 500 });
  }

  const guideRows = guides ?? [];
  const guideIds = guideRows.map((g) => g.id as string);
  const categoryIds = [
    ...new Set(
      guideRows
        .map((g) => g.category_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const categoryNameById = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: cats, error: catsError } = await admin
      .from("restaurant_guide_categories")
      .select("id, name")
      .eq("restaurant_id", access.restaurantId)
      .in("id", categoryIds);
    if (catsError) {
      return NextResponse.json({ error: catsError.message }, { status: 500 });
    }
    for (const c of cats ?? []) {
      categoryNameById.set(c.id as string, (c.name as string) ?? "");
    }
  }

  let steps: {
    id: string;
    guide_id: string;
    position: number;
    body: string;
    image_storage_path: string | null;
    video_storage_path: string | null;
  }[] = [];

  if (guideIds.length > 0) {
    const { data: stepRows, error: stepsError } = await admin
      .from("restaurant_guide_steps")
      .select(
        "id, guide_id, position, body, image_storage_path, video_storage_path",
      )
      .eq("restaurant_id", access.restaurantId)
      .in("guide_id", guideIds)
      .order("position", { ascending: true });

    if (stepsError) {
      return NextResponse.json({ error: stepsError.message }, { status: 500 });
    }
    steps = (stepRows ?? []) as typeof steps;
  }

  const mediaPaths = steps.flatMap((s) =>
    [s.image_storage_path, s.video_storage_path].filter(
      (p): p is string => Boolean(p),
    ),
  );
  const urlMap = await resolveGuidesMediaSignedUrls(mediaPaths);

  const stepsByGuide = new Map<string, typeof steps>();
  for (const step of steps) {
    const list = stepsByGuide.get(step.guide_id) ?? [];
    list.push(step);
    stepsByGuide.set(step.guide_id, list);
  }

  const result: DisplayGuide[] = guideRows.map((g) => {
    const guideSteps = stepsByGuide.get(g.id as string) ?? [];
    const categoryId = (g.category_id as string | null) ?? null;
    return {
      id: g.id as string,
      title: (g.title as string) ?? "",
      short_description: (g.short_description as string | null) ?? "",
      sort_order: Number(g.sort_order ?? 0),
      category_id: categoryId,
      category_name: categoryId
        ? (categoryNameById.get(categoryId) ?? null)
        : null,
      steps: guideSteps.map((s) => ({
        id: s.id,
        position: s.position,
        body: s.body ?? "",
        image_url: s.image_storage_path
          ? (urlMap.get(s.image_storage_path) ?? null)
          : null,
        video_url: s.video_storage_path
          ? (urlMap.get(s.video_storage_path) ?? null)
          : null,
        has_video: Boolean(s.video_storage_path),
      })),
    };
  });

  return NextResponse.json({ guides: result });
}
