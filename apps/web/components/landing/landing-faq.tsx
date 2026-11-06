"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "what",
    question: "Was ist Gwada?",
    answer:
      "Gwada ist das Restaurant-OS für Speisekarte, Reservierungen, Nachrichten, News, Team, Bestand und mehr — Module und Kanäle in einem Dashboard.",
  },
  {
    id: "free",
    question: "Gibt es einen Free-Plan?",
    answer:
      "Ja. Free enthält unbegrenzte Speisen und Reservierungen sowie 1 App-Login. Basic und Pro schalten weitere Module, Nutzer und Integrationen frei — ohne Seat-Fees.",
  },
  {
    id: "users",
    question: "Wie viele Nutzer sind inklusive?",
    answer:
      "Free: 1 registrierter Nutzer. Basic: bis 3. Pro: unbegrenzt. Es gibt keine Seat-Fees — ihr zahlt für den Plan, nicht pro Kopf.",
  },
  {
    id: "channels",
    question: "Welche Kanäle kann ich anbinden?",
    answer:
      "Unter anderem WhatsApp, E-Mail (SMTP/Gmail/Outlook), Google Business, Facebook, Instagram, Lexware Office, TripAdvisor und Mollie — abhängig vom Plan und der Plattform-Freischaltung.",
  },
  {
    id: "pos",
    question: "Ist die Kasse (POS) schon verfügbar?",
    answer:
      "Die native Kasse mit TSE ist als Add-on in Vorbereitung (Coming soon). Online-Bestellung und Kiosk folgen mit dem POS-Add-on.",
  },
  {
    id: "api",
    question: "Gibt es eine API oder MCP?",
    answer:
      "Ja — ab Pro. Die öffentliche Restaurant-API und MCP nutzen dieselben Rechte wie in der App. Details stehen in der Dokumentation unter /docs/api.",
  },
  {
    id: "upgrade",
    question: "Kann ich jederzeit wechseln?",
    answer:
      "Ja. Nach dem Login unter Einstellungen → Abo den Plan wählen. Monatlich oder jährlich — mit Jahresabo spart ihr gegenüber dem Monatspreis.",
  },
];

function FaqRow({ item, open, onToggle }: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            "flex w-full items-center justify-between gap-4 py-5 text-left",
            "text-base font-semibold tracking-tight text-foreground md:text-lg",
            "outline-none transition-colors hover:text-foreground/90",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <span className="text-balance">{item.question}</span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className={cn(open ? "pb-5" : "hidden")}
      >
        <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export function LandingFaq() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  return (
    <section
      id="faq"
      className="relative scroll-mt-28 overflow-hidden border-t border-border/50 pt-28 pb-20 md:pb-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--accent)_0%,transparent_55%)] opacity-[0.05] dark:opacity-[0.1]"
      />

      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            FAQ
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl md:leading-[1.1]">
            Kurze Antworten
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Die wichtigsten Fragen zu Plänen, Modulen und Anbindungen.
          </p>
        </motion.div>

        <motion.div
          className="mt-12 rounded-2xl border border-border/60 bg-card/80 px-5 shadow-sm backdrop-blur-sm md:px-8"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          {FAQ_ITEMS.map((item) => (
            <FaqRow
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() =>
                setOpenId((prev) => (prev === item.id ? null : item.id))
              }
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
