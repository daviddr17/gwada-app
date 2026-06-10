"use client";

import type { ReactNode } from "react";
import {
  accountingFormSectionClassName,
  accountingFormSectionTitleClassName,
} from "@/lib/ui/accounting-form-styles";
import { cn } from "@/lib/utils";

export function AccountingFormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(accountingFormSectionClassName, className)}>
      <h3 className={accountingFormSectionTitleClassName}>{title}</h3>
      {children}
    </section>
  );
}
