import type { Metadata } from "next";
import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";
import {
  restaurantApiModuleById,
  type RestaurantApiModuleId,
} from "@/lib/api/restaurant-api-modules";
import { apiModuleGuideById } from "@/lib/docs/api/api-module-guide";

export function docsApiModuleMetadata(moduleId: RestaurantApiModuleId): Metadata {
  const guide = apiModuleGuideById(moduleId);
  const meta = restaurantApiModuleById(moduleId);
  return {
    title: guide?.title ?? meta?.label ?? "API",
    description: guide?.description,
  };
}

export function DocsApiModulePage({ moduleId }: { moduleId: RestaurantApiModuleId }) {
  const guide = apiModuleGuideById(moduleId);
  if (!guide) return null;

  return (
    <DocsProse title={guide.title} description={guide.description}>
      {guide.intro.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <p>
        Methoden:{" "}
        {guide.methods.map((method, index) => (
          <span key={method}>
            {index > 0 ? ", " : null}
            <code>{method}</code>
          </span>
        ))}
        {" · "}
        Endpunkt: <code>GET /api/v1/{guide.path}</code>
      </p>

      <DocsCallout variant="note" title="Caching">
        {guide.cacheNote}
      </DocsCallout>

      {guide.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2>{section.heading}</h2>
          {section.body ? <p>{section.body}</p> : null}
          {section.items ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {section.table ? (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    {section.table.headers.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 font-semibold text-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row) => (
                    <tr
                      key={row.join("-")}
                      className="border-b border-border/40 last:border-0"
                    >
                      {row.map((cell, index) => (
                        <td
                          key={`${index}-${cell}`}
                          className="px-3 py-2 align-top text-muted-foreground"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {section.code ? <pre>{section.code}</pre> : null}
        </section>
      ))}

      {guide.tips?.length ? (
        <>
          <h2>Gut zu wissen</h2>
          {guide.tips.map((tip) => (
            <DocsCallout key={tip} variant="tip">
              {tip}
            </DocsCallout>
          ))}
        </>
      ) : null}

      <h2>Fehler</h2>
      <p>
        Auth- und Limit-Fehler sind einheitlich — siehe{" "}
        <Link href="/docs/api/rate-limits">Rate Limits &amp; Fehler</Link>. Typisch:{" "}
        <code>401 invalid_api_key</code>, <code>403 module_not_enabled</code>,{" "}
        <code>403 restaurant_not_published</code>, <code>404 not_found</code>,{" "}
        <code>429 rate_limit_exceeded</code>.
      </p>

      {guide.related?.length ? (
        <>
          <h2>Weiterlesen</h2>
          <ul>
            {guide.related.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </DocsProse>
  );
}
