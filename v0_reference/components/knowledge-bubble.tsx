"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { BubbleCard } from "@/components/bubble-card"

interface KnowledgeBubbleProps {
  title: string
  count: number
  icon: React.ReactNode
  mastery: number // 0-100
  color: string
  delay?: number
  onClick?: () => void
}

function getBubbleSize(mastery: number): "sm" | "md" | "lg" | "xl" {
  if (mastery >= 80) return "xl"
  if (mastery >= 60) return "lg"
  if (mastery >= 40) return "md"
  return "sm"
}

export function KnowledgeBubble({
  title,
  count,
  icon,
  mastery,
  color,
  delay = 0,
  onClick,
}: KnowledgeBubbleProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const size = getBubbleSize(mastery)

  return (
    <BubbleCard
      size={size}
      delay={delay}
      glowColor={color}
      onClick={onClick}
      className={cn(
        isDark ? "" : "!rounded-2xl"
      )}
    >
      <div className="flex flex-col items-center gap-1 p-3 text-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-full p-2",
            isDark ? "bg-transparent" : "bg-muted"
          )}
          style={{
            color: isDark ? color : undefined,
          }}
        >
          {icon}
        </div>
        <span
          className={cn(
            "font-medium text-xs md:text-sm leading-tight",
            isDark ? "text-foreground" : "text-foreground"
          )}
          style={{
            color: isDark ? color : undefined,
          }}
        >
          {title}
        </span>
        <span className="text-muted-foreground text-xs">
          {count} items
        </span>
        {/* Mastery indicator */}
        <div className="w-full mt-1 px-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${mastery}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      </div>
    </BubbleCard>
  )
}
