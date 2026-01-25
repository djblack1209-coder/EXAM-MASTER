"use client"

import { Bell, Search } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b",
        isDark
          ? "glass border-border/50 bg-background/80"
          : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl font-bold",
              isDark
                ? "bg-primary text-primary-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            EM
          </div>
          <span className="text-lg font-semibold text-foreground hidden sm:inline-block">
            Exam-Master
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search topics..."
              className={cn(
                "w-64 pl-10",
                isDark && "glass bg-transparent border-border/50"
              )}
            />
          </div>
          <Button variant="ghost" size="icon" className="relative rounded-full">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              3
            </span>
          </Button>
          <ThemeToggle />
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium",
              isDark
                ? "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            JD
          </div>
        </div>
      </div>
    </header>
  )
}
