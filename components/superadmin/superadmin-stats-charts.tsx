"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { LabelCount } from "@/lib/superadmin/stats-series";

export function SuperadminAreaChartCard({
  title,
  description,
  data,
  dataKey,
  yLabel,
  className,
  valueFormatter,
}: {
  title: string;
  description: string;
  data: { label: string; [key: string]: string | number }[];
  dataKey: string;
  yLabel: string;
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const config = {
    [dataKey]: { label: yLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <Card className={cn("min-w-0 border-border/50 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pl-0">
        <ChartContainer
          config={config}
          className="aspect-auto h-[260px] w-full min-w-0"
        >
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={`var(--color-${dataKey})`}
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${dataKey})`}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickMargin={8}
              allowDecimals={false}
              className="tabular-nums"
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value) =>
                    valueFormatter
                      ? valueFormatter(Number(value))
                      : String(value)
                  }
                />
              }
            />
            <Area
              dataKey={dataKey}
              type="natural"
              fill={`url(#${gradientId})`}
              stroke={`var(--color-${dataKey})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function SuperadminBarChartCard({
  title,
  description,
  data,
  dataKey = "count",
  yLabel = "Anzahl",
  className,
  horizontal,
}: {
  title: string;
  description: string;
  data: LabelCount[];
  dataKey?: string;
  yLabel?: string;
  className?: string;
  horizontal?: boolean;
}) {
  const chartData = data.map((d) => ({ name: d.name, [dataKey]: d.count }));
  const config = {
    [dataKey]: { label: yLabel, color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <Card className={cn("min-w-0 border-border/50 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pl-0">
        <ChartContainer
          config={config}
          className={cn(
            "aspect-auto w-full min-w-0",
            horizontal ? "h-[280px]" : "h-[240px]",
          )}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              horizontal={!horizontal}
              vertical={horizontal}
            />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="tabular-nums"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickMargin={8}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  interval={0}
                  angle={data.length > 4 ? -24 : 0}
                  textAnchor={data.length > 4 ? "end" : "middle"}
                  height={data.length > 4 ? 56 : 32}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                  className="tabular-nums"
                />
              </>
            )}
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel indicator="dot" />}
            />
            <Bar
              dataKey={dataKey}
              fill={`var(--color-${dataKey})`}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
