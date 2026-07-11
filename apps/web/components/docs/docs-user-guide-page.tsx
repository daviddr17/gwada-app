import Link from "next/link";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsProse } from "@/components/docs/docs-prose";
import type { UserGuidePage } from "@/lib/docs/user-guide-content";

export function DocsUserGuidePage({ guide }: { guide: UserGuidePage }) {
  return (
    <DocsProse title={guide.title} description={guide.description}>
      {guide.intro.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

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
          {section.steps ? (
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
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
