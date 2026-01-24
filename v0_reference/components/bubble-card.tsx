"use client"

import React from "react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

interface BubbleCardProps {
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  delay?: number
  className?: string
  glowColor?: string
  onClick?: () => void
}

const sizeClasses = {
  sm: "w-24 h-24 md:w-28 md:h-28",
  md: "w-32 h-32 md:w-40 md:h-40",
  lg: "w-40 h-40 md:w-52 md:h-52",
  xl: "w-48 h-48 md:w-64 md:h-64",
}

export function BubbleCard({
  children,
  size = "md",
  delay = 0,
  className,
  glowColor,
  onClick,
}: BubbleCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <div
      onClick={onClick}
      style={{
        animationDelay: `${delay}ms`,
        ...(isDark && glowColor
          ? {
              boxShadow: `0 0 20px ${glowColor}30, 0 0 40px ${glowColor}20`,
            }
          : {}),
      }}
      className={cn(
        "relative flex cursor-pointer items-center justify-center rounded-full transition-all duration-300",
        sizeClasses[size],
        isDark
          ? "glass bubble-gradient animate-float hover:scale-105"
          : "bg-card shadow-sm border border-border rounded-2xl hover:shadow-md",
        className
      )}
    >
      {isDark && (
        <div
          className="absolute inset-0 rounded-full opacity-50 animate-breathe"
          style={{
            background: glowColor
              ? `radial-gradient(circle at center, ${glowColor}20 0%, transparent 70%)`
              : "radial-gradient(circle at center, rgba(0, 242, 255, 0.1) 0%, transparent 70%)",
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
