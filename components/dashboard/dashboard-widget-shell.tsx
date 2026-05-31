"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  DashboardWidgetStatsSkeleton,
} from "@/components/dashboard/dashboard-stat-block";

export function DashboardWidgetShell({
  title,
  description,
  icon,
  href,
  linkLabel,
  ready,
  loading,
  error,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  linkLabel: string;
  ready: boolean;
  loading: boolean;
  error: string | null;
  children: ReactNode;
}) {
  if (!ready) {
    return (
      <SkeletonCardFrame className="min-w-0 border-border/50 shadow-card">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-4 w-72 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <DashboardWidgetStatsSkeleton />
      </SkeletonCardFrame>
    );
  }

  return (
    <Card className="min-w-0 border-border/50 shadow-card">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1 rounded-xl"
          render={<Link href={href} prefetch />}
        >
          {linkLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : loading ? (
          <div aria-busy="true" aria-label={`${title} wird geladen`}>
            <DashboardWidgetStatsSkeleton />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
