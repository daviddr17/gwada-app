import Link from "next/link";

type Props = {
  title: string;
  children: React.ReactNode;
};

export function MarketingStaticPage({ title, children }: Props) {
  return (
    <div className="min-h-dvh bg-background px-6 py-24 text-foreground antialiased">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Startseite
        </Link>
        <h1 className="mt-8 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        <div className="mt-6 space-y-4 text-pretty text-muted-foreground md:text-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
