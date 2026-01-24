"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

interface StatsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: React.ReactNode
}

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
}: StatsCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
        isDark
          ? "glass bubble-gradient border-[0.5px] border-border/50 hover:border-primary/30"
          : "bg-card border border-border shadow-sm hover:shadow-md"
      )}
    >
      {isDark && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      )}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">{title}</span>
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {change && (
            <span
              className={cn(
                "text-xs font-medium",
                changeType === "positive" && "text-emerald-500",
                changeType === "negative" && "text-red-500",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex items-center justify-center rounded-xl p-3",
            isDark
              ? "bg-primary/10 text-primary"
              : "bg-primary/10 text-primary"
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
