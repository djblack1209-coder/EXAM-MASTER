"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

interface ActivityItemProps {
  title: string
  subtitle: string
  time: string
  icon: React.ReactNode
  status?: "completed" | "in-progress" | "pending"
}

export function ActivityItem({
  title,
  subtitle,
  time,
  icon,
  status = "completed",
}: ActivityItemProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl transition-all duration-200",
        isDark
          ? "glass hover:bg-white/[0.08]"
          : "bg-card border border-border hover:bg-muted/50"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full p-3",
          status === "completed" && "bg-emerald-500/10 text-emerald-500",
          status === "in-progress" && "bg-primary/10 text-primary",
          status === "pending" && "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{title}</p>
        <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{time}</span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            status === "completed" && "bg-emerald-500/10 text-emerald-500",
            status === "in-progress" && "bg-primary/10 text-primary",
            status === "pending" && "bg-muted text-muted-foreground"
          )}
        >
          {status === "completed" && "Done"}
          {status === "in-progress" && "Active"}
          {status === "pending" && "Pending"}
        </span>
      </div>
    </div>
  )
}
