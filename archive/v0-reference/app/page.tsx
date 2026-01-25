"use client"

import {
  Award,
  BookCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Play,
  TrendingUp,
  Zap,
} from "lucide-react"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCard } from "@/components/stats-card"
import { BubbleField } from "@/components/bubble-field"
import { ActivityItem } from "@/components/activity-item"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function DashboardContent() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const recentActivities = [
    {
      title: "Mock Exam: Mathematics",
      subtitle: "Completed with 85% score",
      time: "2h ago",
      icon: <BookCheck className="h-5 w-5" />,
      status: "completed" as const,
    },
    {
      title: "Error Review: Physics",
      subtitle: "12 questions reviewed",
      time: "5h ago",
      icon: <CheckCircle2 className="h-5 w-5" />,
      status: "completed" as const,
    },
    {
      title: "Daily Practice: Chemistry",
      subtitle: "15/30 questions done",
      time: "Active",
      icon: <Play className="h-5 w-5" />,
      status: "in-progress" as const,
    },
    {
      title: "Scheduled: Biology Review",
      subtitle: "Tomorrow at 9:00 AM",
      time: "Upcoming",
      icon: <Calendar className="h-5 w-5" />,
      status: "pending" as const,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* Welcome Section */}
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl p-6 md:p-8 mb-8",
            isDark
              ? "bubble-gradient border border-border/50"
              : "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-border"
          )}
        >
          {isDark && (
            <>
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
            </>
          )}
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Welcome back, John!
              </h1>
              <p className="text-muted-foreground">
                You have <span className="text-primary font-medium">23 questions</span> pending review.
                Keep up the momentum!
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                className={cn(
                  "gap-2",
                  isDark && "animate-pulse-glow"
                )}
              >
                <Zap className="h-4 w-4" />
                Quick Practice
              </Button>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Clock className="h-4 w-4" />
                Mock Exam
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Total Questions"
            value="1,234"
            change="+12% this week"
            changeType="positive"
            icon={<BookCheck className="h-6 w-6" />}
          />
          <StatsCard
            title="Accuracy Rate"
            value="78.5%"
            change="+3.2% improvement"
            changeType="positive"
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatsCard
            title="Study Streak"
            value="14 days"
            change="Personal best!"
            changeType="positive"
            icon={<Zap className="h-6 w-6" />}
          />
          <StatsCard
            title="Achievements"
            value="23"
            change="2 new unlocked"
            changeType="neutral"
            icon={<Award className="h-6 w-6" />}
          />
        </div>

        {/* Knowledge Bubbles */}
        <BubbleField />

        {/* Recent Activity */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Learning Trajectory
            </h2>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
            </Button>
          </div>
          <div className="grid gap-3">
            {recentActivities.map((activity, index) => (
              <ActivityItem
                key={index}
                title={activity.title}
                subtitle={activity.subtitle}
                time={activity.time}
                icon={activity.icon}
                status={activity.status}
              />
            ))}
          </div>
        </div>

        {/* Mode Description */}
        <div
          className={cn(
            "mt-8 p-6 rounded-2xl text-center",
            isDark ? "glass" : "bg-muted/50 border border-border"
          )}
        >
          <p className="text-sm text-muted-foreground">
            {isDark ? (
              <>
                <span className="text-primary font-medium">Dark Mode Active:</span>{" "}
                High-energy review mode with floating bubble cards. Perfect for quick sprints and data analysis.
              </>
            ) : (
              <>
                <span className="text-primary font-medium">Light Mode Active:</span>{" "}
                Structured learning mode with clean layouts. Optimized for long study sessions.
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <ThemeProvider defaultTheme="system">
      <DashboardContent />
    </ThemeProvider>
  )
}
