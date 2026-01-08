"use client"

import { useParams } from "next/navigation"
import { useTeamStats } from "@/lib/hooks/use-team-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, Tooltip } from "recharts"
import { Spinner } from "@/components/ui/spinner"
import IconFiles from "@/components/ui/IconFiles"
import IconUsers from "@/components/ui/IconUsers"
import IconSquareChartLine from "@/components/ui/IconSquareChartLine"
import IconCircleCheck from "@/components/ui/IconCircleCheck"
import { useTranslations } from "next-intl"

const COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  none: '#64748b',
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export function ManagementPageClient() {
  const t = useTranslations('management');
  const params = useParams<{ teamId: string }>()
  const teamId = params.teamId as string

  // Use TanStack Query hook
  const { data: stats, isLoading: loading } = useTeamStats(teamId)

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground">{t('loadingStatistics')}</p>
        </div>
      </div>
    )
  }

  const priorityData = stats.priorityBreakdown?.map((item: any) => ({
    name: t(`priorities.${item.priority}`),
    value: item.count,
    color: COLORS[item.priority as keyof typeof COLORS] || COLORS.none
  })) || []

  const statusData = stats.statusBreakdown?.map((item: any) => ({
    name: item.status,
    value: item.count
  })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {t('subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('teamMembers')}</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.stats?.members || 0}</div>
            <p className="text-xs text-muted-foreground">{t('activeTeamMembers')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('activeProjects')}</CardTitle>
            <IconSquareChartLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.stats?.projects || 0}</div>
            <p className="text-xs text-muted-foreground">{t('projectsInProgress')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalIssues')}</CardTitle>
            <IconFiles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.stats?.totalIssues || 0}</div>
            <p className="text-xs text-muted-foreground">{stats.stats?.completedIssues || 0} {t('completed')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('completionRate')}</CardTitle>
            <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.stats?.completionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">{t('issuesCompleted')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Issues by Priority */}
        <Card>
          <CardHeader>
            <CardTitle>{t('issuesByPriority')}</CardTitle>
          </CardHeader>
          <CardContent>
            {priorityData.length > 0 ? (
              <ChartContainer
                config={{
                  count: { label: "Count" }
                }}
                className="h-[250px] sm:h-[300px] w-full"
              >
                <BarChart data={priorityData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium">{payload[0].payload.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {payload[0].value}
                              </span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-count)">
                    {priorityData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground">
                {t('noPriorityData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Issues by Status */}
        <Card>
          <CardHeader>
            <CardTitle>{t('issuesByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ChartContainer
                config={{
                  count: { label: "Count" }
                }}
                className="h-[250px] sm:h-[300px] w-full"
              >
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${t(`statuses.${name}`)}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium">{t(`statuses.${data.name}`)}</span>
                              <span className="text-xs text-muted-foreground">
                                {data.value}
                              </span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground">
                {t('noStatusData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentIssues && stats.recentIssues.length > 0 ? (
              stats.recentIssues.map((issue: any) => (
                <div key={issue.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconFiles className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{issue.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('noRecentActivity')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('quickInsights')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
              <IconCircleCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium">{t('completionRate')}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.stats?.completionRate || 0}% {t('ofIssuesCompleted')}
                </p>
              </div>
            </div>
            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
              <IconUsers className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium">{t('teamMembers')}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.stats?.members || 0} {t('activeMembers')}
                </p>
              </div>
            </div>
            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
              <IconSquareChartLine className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium">{t('activeProjects')}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.stats?.projects || 0} {t('projectsInProgressLower')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

