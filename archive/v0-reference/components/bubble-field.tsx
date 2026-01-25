"use client"

import {
  BookOpen,
  Brain,
  Calculator,
  FileText,
  Flame,
  Target,
} from "lucide-react"
import { KnowledgeBubble } from "@/components/knowledge-bubble"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const knowledgePoints = [
  {
    id: 1,
    title: "Error Set",
    count: 156,
    icon: <Target className="h-5 w-5" />,
    mastery: 35,
    color: "#EF4444",
  },
  {
    id: 2,
    title: "Hot Topics",
    count: 89,
    icon: <Flame className="h-5 w-5" />,
    mastery: 45,
    color: "#F59E0B",
  },
  {
    id: 3,
    title: "Practice",
    count: 234,
    icon: <FileText className="h-5 w-5" />,
    mastery: 72,
    color: "#00F2FF",
  },
  {
    id: 4,
    title: "Concepts",
    count: 312,
    icon: <Brain className="h-5 w-5" />,
    mastery: 88,
    color: "#9FE870",
  },
  {
    id: 5,
    title: "Formulas",
    count: 67,
    icon: <Calculator className="h-5 w-5" />,
    mastery: 60,
    color: "#A855F7",
  },
  {
    id: 6,
    title: "Reading",
    count: 45,
    icon: <BookOpen className="h-5 w-5" />,
    mastery: 50,
    color: "#EC4899",
  },
]

export function BubbleField() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Sort by mastery for dark mode (higher mastery = larger, at bottom)
  const sortedBubbles = isDark
    ? [...knowledgePoints].sort((a, b) => a.mastery - b.mastery)
    : knowledgePoints

  return (
    <div
      className={cn(
        "relative py-8",
        isDark ? "min-h-[500px]" : ""
      )}
    >
      <h2 className="text-xl font-semibold text-foreground mb-6">
        Knowledge Points
      </h2>
      
      {isDark ? (
        // Bitget-style floating bubble layout
        <div className="relative h-[400px] w-full">
          {sortedBubbles.map((item, index) => {
            // Create organic positioning based on mastery
            const positions = [
              { top: "5%", left: "5%" },
              { top: "10%", right: "15%" },
              { top: "35%", left: "25%" },
              { bottom: "10%", right: "5%" },
              { top: "20%", left: "55%" },
              { bottom: "25%", left: "10%" },
            ]
            const pos = positions[index % positions.length]
            
            return (
              <div
                key={item.id}
                className="absolute"
                style={{
                  ...pos,
                  zIndex: item.mastery,
                }}
              >
                <KnowledgeBubble
                  title={item.title}
                  count={item.count}
                  icon={item.icon}
                  mastery={item.mastery}
                  color={item.color}
                  delay={index * 200}
                  onClick={() => console.log(`Navigate to ${item.title}`)}
                />
              </div>
            )
          })}
        </div>
      ) : (
        // Wise-style grid layout
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {knowledgePoints.map((item, index) => (
            <KnowledgeBubble
              key={item.id}
              title={item.title}
              count={item.count}
              icon={item.icon}
              mastery={item.mastery}
              color={item.color}
              delay={index * 100}
              onClick={() => console.log(`Navigate to ${item.title}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
