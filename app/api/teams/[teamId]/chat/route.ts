import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from '@/lib/auth-server-helpers'
import { streamText, tool, convertToModelMessages } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getTeamContext, createChatConversation, saveChatMessages, getChatConversation, generateConversationTitle, updateConversationTitle } from '@/lib/api/chat'
import { createIssue } from '@/lib/api/issues'
import { updateIssue } from '@/lib/api/issues'
import { getIssues } from '@/lib/api/issues'
import { getIssueById } from '@/lib/api/issues'
import { deleteIssue } from '@/lib/api/issues'
import { createProject, updateProject, deleteProject } from '@/lib/api/projects'
import { sendInvitationEmail, getLocaleFromRequest } from '@/lib/email'
import { stepCountIs } from 'ai'
import { getTranslations } from 'next-intl/server'
import {
  resolveWorkflowState,
  resolveProject,
  resolveAssignee,
  resolveLabelIds,
  validateIssueFields,
  formatValidationError,
} from '@/lib/api/chat-helpers'

export const maxDuration = 30

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { messages, apiKey: clientApiKey, conversationId: existingConversationId } = await request.json()

    // Get user's locale preference from request
    const locale = getLocaleFromRequest(request)
    const t = await getTranslations({ locale, namespace: 'api.chat' })

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: t('errors.messagesRequired') },
        { status: 400 }
      )
    }

    const userId = await getUserId()
    const user = await getUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: t('errors.unauthorized') },
        { status: 401 }
      )
    }

    // Get or create conversation
    let conversationId = existingConversationId
    if (!conversationId) {
      // Create new conversation with title from first user message
      const firstUserMessage = messages.find((m: any) => m.role === 'user')
      const title = firstUserMessage
        ? generateConversationTitle(firstUserMessage.content || firstUserMessage.text || '')
        : undefined

      const conversation = await createChatConversation({
        teamId,
        userId,
        title,
      })
      conversationId = conversation.id
    } else {
      // Verify conversation exists and belongs to user
      const conversation = await getChatConversation(conversationId)
      if (!conversation || conversation.userId !== userId || conversation.teamId !== teamId) {
        return NextResponse.json(
          { error: t('errors.conversationNotFound') },
          { status: 404 }
        )
      }
    }

    // Get team context
    const teamContext = await getTeamContext(teamId)

    // Get API key (from client localStorage or environment variable)
    const apiKey = clientApiKey || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: t('errors.noApiKey') },
        { status: 400 }
      )
    }

    // Get translations for system prompt
    const tSystemPrompt = await getTranslations({ locale, namespace: 'api.chat.systemPrompt' })
    const tTools = await getTranslations({ locale, namespace: 'api.chat.tools' })
    const tCommon = await getTranslations({ locale, namespace: 'api.chat.common' })
    const tWorkflowStates = await getTranslations({ locale, namespace: 'workflowStates' })

    // Translate workflow state names for AI context
    const translatedWorkflowStates = teamContext.workflowStates.map(s => tWorkflowStates(s.name)).join(', ')

    // Build system prompt from team context
    const systemPrompt = `${tSystemPrompt('languageInstruction')}

${tSystemPrompt('intro')}

## ${tSystemPrompt('teamContext')}

${tSystemPrompt('availableProjects')}: ${teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ') || tSystemPrompt('none')}
${tSystemPrompt('workflowStates')}: ${translatedWorkflowStates}
${tSystemPrompt('availableLabels')}: ${teamContext.labels.map(l => l.name).join(', ')}
${tSystemPrompt('teamMembers')}: ${teamContext.members.map(m => m.userName).join(', ') || tSystemPrompt('none')}

## ${tSystemPrompt('rules')}

${tSystemPrompt('rulesIntro')}
1. ${tSystemPrompt('ruleTitle')}
2. ${tSystemPrompt('ruleStatus')}
3. ${tSystemPrompt('rulePriority')}
4. ${tSystemPrompt('ruleProject')}

${tSystemPrompt('criticalRules')}
- ${tSystemPrompt('criticalRule1')}
- ${tSystemPrompt('criticalRule2')}
- ${tSystemPrompt('criticalRule3')}
- ${tSystemPrompt('criticalRule4')}
- ${tSystemPrompt('criticalRule5')}
- ${tSystemPrompt('criticalRule6')}

${tSystemPrompt('listIssuesRule')}
${tSystemPrompt('minimalInfoRule')}
${tSystemPrompt('useToolsRule')}`

    // Define tools for the AI
    const tools = {
      createIssue: tool({
        description: 'Create a single new issue. For creating multiple issues at once (2+), use createIssues instead. You can use workflow state names (like "Todo", "In Progress", "Done") and they will be automatically matched to IDs. Same for project names, assignee names, and label names. CRITICAL: Do NOT call this tool if ANY required information is missing (title, status/workflow state, priority, or project). Instead, ask the user ONE question at a time for the missing information. Do not default priority to "none" - always ask the user to specify a priority level explicitly. Always ask which project the issue should be added to if not provided. Always ask what status/workflow state the issue should be in if not provided.',
        inputSchema: z.object({
          title: z.string().nullish().describe('The title of the issue (REQUIRED)'),
          description: z.string().nullish().describe('A detailed description of the issue'),
          projectId: z.string().nullish().describe('The project ID, key, or name (e.g., "testing" or project name) this issue belongs to (REQUIRED). Do not call this tool with project missing - always ask the user to specify which project to add the issue to.'),
          workflowStateId: z.string().nullish().describe('The workflow state ID or name (e.g., "Todo", "In Progress", "Done") (REQUIRED)'),
          assigneeId: z.string().nullish().describe('The user ID or name (e.g., "kartik") to assign this issue to'),
          priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish().describe('The priority level (REQUIRED - must be one of: low, medium, high, urgent, or none). Do not call this tool with priority missing or defaulted to "none" - always ask the user to specify a priority first.'),
          estimate: z.number().nullish().describe('Story points or hours estimate'),
          labelIds: z.array(z.string()).nullish().describe('Array of label names or IDs (e.g., ["Bug", "Feature", "Documentation", "Enhancement"])'),
          // Support alias parameters that the AI might use
          status: z.string().nullish().optional().describe('Alias for workflowStateId - do not use, use workflowStateId instead'),
          project: z.string().nullish().optional().describe('Alias for projectId - do not use, use projectId instead'),
        }).passthrough(),
        execute: async (params) => {
          try {
            // Handle alias parameters - map status to workflowStateId and project to projectId
            const {
              title,
              description,
              projectId: paramProjectId,
              workflowStateId: paramWorkflowStateId,
              status,
              project,
              assigneeId,
              priority,
              estimate,
              labelIds,
            } = params

            // Use aliases if main parameters are missing
            const projectId = paramProjectId || project
            const workflowStateId = paramWorkflowStateId || status

            // Check for duplicate title before proceeding
            const existingIssue = await db.issue.findFirst({
              where: {
                teamId,
                title: {
                  equals: title || '',
                  mode: 'insensitive',
                },
              },
              select: {
                id: true,
                number: true,
                title: true,
                project: {
                  select: {
                    name: true,
                    key: true,
                  },
                },
              },
            })

            if (existingIssue) {
              const projectInfo = existingIssue.project ? ` in project ${existingIssue.project.name} (${existingIssue.project.key})` : ''
              return {
                success: false,
                error: tTools('createIssue.duplicateError', {
                  title: title || '',
                  number: existingIssue.number,
                  project: projectInfo
                }),
              }
            }

            // Validate required fields FIRST - do not proceed if anything is missing
            const validation = validateIssueFields({ title, workflowStateId, priority, projectId })
            if (!validation.isValid) {
              return {
                success: false,
                error: formatValidationError(validation.missingFields, teamContext),
              }
            }

            // Resolve all entities (synchronous lookups) - NO defaults allowed, we validated above
            const resolvedWorkflowStateId = resolveWorkflowState(teamContext, workflowStateId)
            const resolvedProject = resolveProject(teamContext, projectId)
            const assignee = resolveAssignee(teamContext, assigneeId)
            const resolvedLabelIds = resolveLabelIds(teamContext, labelIds)

            // Validate that required entities were successfully resolved (more strict than just "provided")
            if (!resolvedWorkflowStateId) {
              const availableStates = teamContext.workflowStates.map(ws => tWorkflowStates(ws.name)).join(', ')
              return {
                success: false,
                error: tTools('createIssue.workflowStateError', {
                  state: workflowStateId || '',
                  availableStates
                }),
              }
            }

            // Validate project was found
            if (!resolvedProject) {
              const availableProjects = teamContext.projects.length > 0
                ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                : ''
              const projectsInfo = teamContext.projects.length > 0
                ? tTools('createIssue.projectsAvailable', { projects: availableProjects })
                : tTools('createIssue.noProjects')
              return {
                success: false,
                error: tTools('createIssue.projectError', { project: projectId || '', projectsInfo }),
              }
            }

            // Create issue with resolved entities
            const issue = await createIssue(
              teamId,
              {
                title: title!,
                description: description ?? undefined,
                projectId: resolvedProject.id,
                workflowStateId: resolvedWorkflowStateId,
                assigneeId: assignee?.userId || undefined,
                priority: priority ?? 'none',
                estimate: estimate || undefined,
                labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
              },
              userId,
              user.name || user.email || tCommon('unknown')
            )

            if (!issue) {
              return { success: false, error: tTools('createIssue.createError') }
            }

            return {
              success: true,
              issue: {
                id: issue.id,
                title: issue.title,
                number: issue.number,
                description: issue.description,
                priority: issue.priority,
              },
              message: tTools('createIssue.success', { number: issue.number, title: issue.title }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('createIssue.failed') }
          }
        },
      }),

      createIssues: tool({
        description: 'Create multiple issues at once. Accepts an array of issue objects. Each issue needs: title, status (workflow state), priority, and project. IMPORTANT: Do NOT call this tool if any issue is missing title, status, priority, or project - instead, ask the user for the missing information first. Use this when the user asks to create multiple issues (e.g., "create 10 issues", "create issues for tasks X, Y, Z").',
        inputSchema: z.object({
          issues: z.array(z.object({
            title: z.string().nullish().describe('The title of the issue (REQUIRED)'),
            description: z.string().nullish(),
            projectId: z.string().nullish().describe('The project ID, key, or name (REQUIRED)'),
            workflowStateId: z.string().nullish().describe('The workflow state ID or name (e.g., "Todo", "In Progress", "Done") (REQUIRED)'),
            assigneeId: z.string().optional().describe('The user ID or name to assign this issue to'),
            priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish().describe('The priority level (REQUIRED)'),
            estimate: z.number().optional().describe('Story points or hours estimate'),
            labelIds: z.array(z.string()).optional().describe('Array of label names or IDs'),
            // Support alias parameters
            status: z.string().nullish().optional().describe('Alias for workflowStateId - do not use, use workflowStateId instead'),
            project: z.string().nullish().optional().describe('Alias for projectId - do not use, use projectId instead'),
          }).passthrough()).min(1).describe('Array of issues to create. Must contain at least 1 issue.'),
        }),
        execute: async ({ issues }) => {
          try {
            if (!issues || issues.length === 0) {
              return { success: false, error: tCommon('atLeastOneRequired', { item: tCommon('issue') }) }
            }

            // Check for duplicate titles across all issues before proceeding
            const titlesToCheck = issues
              .map((issue) => issue.title)
              .filter((title): title is string => !!title && title !== 'null' && title !== 'undefined')

            if (titlesToCheck.length > 0) {
              const existingIssues = await db.issue.findMany({
                where: {
                  teamId,
                  title: {
                    in: titlesToCheck,
                    mode: 'insensitive',
                  },
                },
                select: {
                  title: true,
                  number: true,
                  project: {
                    select: {
                      name: true,
                      key: true,
                    },
                  },
                },
              })

              if (existingIssues.length > 0) {
                const duplicates = existingIssues
                  .map((issue) => {
                    const projectInfo = issue.project
                      ? ` in project ${issue.project.name} (${issue.project.key})`
                      : ''
                    return `"${issue.title}" (Issue #${issue.number}${projectInfo})`
                  })
                  .join(', ')

                return {
                  success: false,
                  error: tTools('createIssues.duplicateError', { duplicates }),
                }
              }
            }

            // Check for missing required fields across all issues
            const missingFields: string[] = []
            for (let i = 0; i < issues.length; i++) {
              const issueData = issues[i]
              if (!issueData.title || issueData.title === 'null' || issueData.title === 'undefined') {
                missingFields.push(`Issue ${i + 1}: title`)
              }
              if (!issueData.workflowStateId || issueData.workflowStateId === 'null' || issueData.workflowStateId === 'undefined') {
                missingFields.push(`Issue ${i + 1}: status (workflow state)`)
              }
              if (issueData.priority === null || issueData.priority === undefined) {
                missingFields.push(`Issue ${i + 1}: priority`)
              }
              if (!issueData.projectId || issueData.projectId === 'null' || issueData.projectId === 'undefined') {
                missingFields.push(`Issue ${i + 1}: project`)
              }
            }

            if (missingFields.length > 0) {
              const availableProjects = teamContext.projects.length > 0
                ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                : tCommon('noProjectsAvailable')

              return {
                success: false,
                error: tTools('createIssues.validationError', {
                  missingFields: missingFields.join(', '),
                  fieldCount: missingFields.length === 1 ? 'this' : 'these',
                  projectsInfo: teamContext.projects.length > 0 && missingFields.some(f => f.includes('project')) ? availableProjects : ''
                }),
              }
            }

            // Resolve all entities and prepare issue creation tasks in parallel
            const issueCreationTasks = issues.map((issueData) => {
              return (async () => {
                try {
                  // Handle alias parameters
                  const issueProjectId = issueData.projectId || (issueData as any).project
                  const issueWorkflowStateId = issueData.workflowStateId || (issueData as any).status

                  // Resolve all entities (no defaults - validation already checked they exist)
                  const resolvedWorkflowStateId = resolveWorkflowState(
                    teamContext,
                    issueWorkflowStateId
                  )
                  
                  const resolvedProject = resolveProject(teamContext, issueProjectId!)
                  
                  if (!resolvedProject) {
                    const availableProjects = teamContext.projects.length > 0
                      ? teamContext.projects.map(p => `${p.name} (${p.key})`).join(', ')
                      : tCommon('noProjectsAvailable')
                    return {
                      error: {
                        issue: issueData.title || tCommon('unknown'),
                        error: tTools('createIssues.projectError', { project: issueProjectId, projects: availableProjects })
                      },
                    }
                  }

                  const assignee = resolveAssignee(teamContext, issueData.assigneeId)
                  const resolvedLabelIds = resolveLabelIds(teamContext, issueData.labelIds)

                  if (!resolvedWorkflowStateId) {
                    const availableStates = teamContext.workflowStates.map(ws => tWorkflowStates(ws.name)).join(', ')
                    return {
                      error: {
                        issue: issueData.title || tCommon('unknown'),
                        error: tTools('createIssues.workflowStateError', { state: issueWorkflowStateId, availableStates })
                      },
                    }
                  }

                  // Create the issue
                  const issue = await createIssue(
                    teamId,
                    {
                      title: issueData.title!,
                      description: issueData.description ?? undefined,
                      projectId: resolvedProject.id,
                      workflowStateId: resolvedWorkflowStateId,
                      assigneeId: assignee?.userId || undefined,
                      priority: issueData.priority ?? 'none',
                      estimate: issueData.estimate || undefined,
                      labelIds: resolvedLabelIds.length > 0 ? resolvedLabelIds : undefined,
                    },
                    userId,
                    user.name || user.email || tCommon('unknown')
                  )

                  if (issue) {
                    return {
                      success: {
                        id: issue.id,
                        number: issue.number,
                        title: issue.title,
                      },
                    }
                  } else {
                    return {
                      error: { issue: issueData.title || tCommon('unknown'), error: tTools('createIssues.failed') },
                    }
                  }
                } catch (error: any) {
                  return {
                    error: { issue: issueData.title || tCommon('unknown'), error: error.message || tTools('createIssues.failed') },
                  }
                }
              })()
            })

            // Execute all issue creations in parallel
            const results = await Promise.all(issueCreationTasks)

            // Separate successes from errors
            const createdIssues = results.filter((r) => r.success).map((r) => r.success!)
            const errors = results.filter((r) => r.error).map((r) => r.error!)

            const successMessage = createdIssues.length > 0
              ? tTools('createIssues.success', { count: createdIssues.length, plural: createdIssues.length !== 1 ? 's' : '', issues: createdIssues.map(i => `#${i.number} "${i.title}"`).join(', ') })
              : ''

            const errorMessage = errors.length > 0
              ? tTools('createIssues.failure', { count: errors.length, plural: errors.length !== 1 ? 's' : '', errors: errors.map(e => `"${e.issue}" (${e.error})`).join(', ') })
              : ''

            return {
              success: createdIssues.length > 0,
              issues: createdIssues,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              createdCount: createdIssues.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('createIssues.failed') }
          }
        },
      }),

      updateIssue: tool({
        description: 'Update an existing issue by title or ID. Use workflow state names (like "Todo", "Backlog", "In Progress", "Done"), assignee names, and label names.',
        inputSchema: z.object({
          issueId: z.string().optional().describe('The ID of the issue to update'),
          title: z.string().optional().describe('The title of the issue to find (if issueId not provided)'),
          newTitle: z.string().optional(),
          description: z.string().optional(),
          workflowStateId: z.string().optional().describe('The new workflow state ID or name (e.g., "Todo", "Backlog", "In Progress", "Done")'),
          assigneeId: z.string().nullish().describe('The user ID or name to assign this issue to'),
          priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish(),
          estimate: z.number().nullish(),
          labelIds: z.array(z.string()).nullish().describe('Array of label names or IDs (e.g., ["Bug", "Feature", "Documentation"])'),
        }),
        execute: async ({ issueId, title, newTitle, description, workflowStateId, assigneeId, priority, estimate, labelIds }) => {
          try {
            let resolvedIssueId = issueId

            // If title is provided, find the issue by title
            if (title && !issueId) {
              const issues = await getIssues(teamId)
              const matchingIssues = issues.filter(
                (issue) => issue.title.toLowerCase().includes(title.toLowerCase())
              )

              if (matchingIssues.length === 0) {
                return { success: false, error: tTools('updateIssue.notFound', { title }) }
              }

              if (matchingIssues.length > 1) {
                return {
                  success: false,
                  error: tTools('updateIssue.multiple', { title, matches: matchingIssues.map(i => `#${i.number} "${i.title}"`).join(', ') }),
                }
              }

              resolvedIssueId = matchingIssues[0].id
            }

            if (!resolvedIssueId) {
              return { success: false, error: tTools('updateIssue.idOrTitleRequired') }
            }

            // Resolve entities using helper functions
            const resolvedWorkflowStateId = resolveWorkflowState(teamContext, workflowStateId)
            
            // Resolve assignee and handle unassignment
            let resolvedAssigneeId: string | null = null
            let resolvedAssigneeName: string | null = null
            if (assigneeId && assigneeId !== 'unassigned' && assigneeId !== 'null' && assigneeId !== 'undefined') {
              const assignee = resolveAssignee(teamContext, assigneeId)
              if (assignee) {
                resolvedAssigneeId = assignee.userId
                resolvedAssigneeName = assignee.userName
              }
            } else if (assigneeId === null || assigneeId === 'unassigned' || assigneeId === 'null' || assigneeId === 'undefined') {
              // Explicitly unassign
              resolvedAssigneeId = null
              resolvedAssigneeName = null
            }

            const resolvedLabelIds = resolveLabelIds(teamContext, labelIds)

            const issue = await updateIssue(teamId, resolvedIssueId, {
              ...(newTitle && { title: newTitle }),
              ...(description !== undefined && description !== null && { description }),
              ...(resolvedWorkflowStateId && { workflowStateId: resolvedWorkflowStateId }),
              ...(assigneeId !== undefined && { 
                assigneeId: resolvedAssigneeId ?? null,
                assignee: resolvedAssigneeName
              }),
              ...(priority && { priority }),
              ...(estimate && { estimate }),
              ...(resolvedLabelIds && { labelIds: resolvedLabelIds }),
            })

            if (!issue) {
              return { success: false, error: tTools('updateIssue.notFound') }
            }

            return {
              success: true,
              issue: {
                id: issue.id,
                title: issue.title,
                number: issue.number,
              },
              message: tTools('updateIssue.success', { number: issue.number, title: issue.title }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('updateIssue.failed') }
          }
        },
      }),

      listIssues: tool({
        description: 'Get a list of ALL issues for the team. Returns all issues by default unless a specific limit is requested. Use this to get a complete overview of all tasks.',
        inputSchema: z.object({
          limit: z.number().nullable().optional().describe('Maximum number of issues to return (omit to get all issues)'),
        }),
        execute: async ({ limit }) => {
          try {
            const issues = await getIssues(teamId)
            const limited = limit ? issues.slice(0, limit) : issues
            
            return {
              success: true,
              issues: limited.map(issue => ({
                id: issue.id,
                number: issue.number,
                title: issue.title,
                description: issue.description,
                priority: issue.priority,
                assignee: issue.assignee,
                project: issue.project,
                workflowState: issue.workflowState.name,
              })),
              count: limited.length,
              total: issues.length,
              message: limited.length === issues.length
                ? tTools('listIssues.allIssues', { count: issues.length })
                : tTools('listIssues.limitedIssues', { shown: limited.length, total: issues.length })
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('listIssues.failed') }
          }
        },
      }),

      getIssue: tool({
        description: 'Get details of a specific issue by ID',
        inputSchema: z.object({
          issueId: z.string().describe('The ID of the issue'),
        }),
        execute: async ({ issueId }) => {
          try {
            const issue = await getIssueById(teamId, issueId)
            if (!issue) {
              return { success: false, error: tTools('getIssue.notFound') }
            }

            return {
              success: true,
              issue: {
                id: issue.id,
                number: issue.number,
                title: issue.title,
                description: issue.description,
                priority: issue.priority,
                assignee: issue.assignee,
                project: issue.project,
                workflowState: issue.workflowState.name,
                labels: issue.labels.map(l => l.label.name),
              },
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('getIssue.failed') }
          }
        },
      }),

      deleteIssue: tool({
        description: 'Delete an issue by its title or ID. If title is provided, it will search for matching issues.',
        inputSchema: z.object({
          title: z.string().optional().describe('The title of the issue to delete'),
          issueId: z.string().optional().describe('The ID of the issue to delete'),
        }),
        execute: async ({ title, issueId }) => {
          try {
            // If title is provided, search for matching issues
            if (title && !issueId) {
              const issues = await getIssues(teamId)
              const matchingIssues = issues.filter(
                (issue) => issue.title.toLowerCase().includes(title.toLowerCase())
              )

              if (matchingIssues.length === 0) {
                return { success: false, error: tTools('deleteIssue.notFound', { title }) }
              }

              if (matchingIssues.length > 1) {
                return {
                  success: false,
                  error: tTools('deleteIssue.multiple', { title, matches: matchingIssues.map(i => `#${i.number} "${i.title}"`).join(', ') }),
                  matches: matchingIssues.map(i => ({ id: i.id, title: i.title, number: i.number })),
                }
              }

              issueId = matchingIssues[0].id
            }

            if (!issueId) {
              return { success: false, error: tTools('deleteIssue.idOrTitleRequired') }
            }

            const issue = await getIssueById(teamId, issueId)
            if (!issue) {
              return { success: false, error: tTools('deleteIssue.notFound') }
            }

            await deleteIssue(teamId, issueId)

            return {
              success: true,
              message: tTools('deleteIssue.success', { number: issue.number, title: issue.title }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('deleteIssue.failed') }
          }
        },
      }),

      updateIssues: tool({
        description: 'Update multiple issues at once. Accepts an array of updates. Use this when the user asks to update multiple issues (e.g., "change status of issues #1, #2, #3 to Done", "assign all issues in project X to John").',
        inputSchema: z.object({
          updates: z.array(z.object({
            issueId: z.string().optional().describe('The ID of the issue to update'),
            title: z.string().optional().describe('The title of the issue to find (if issueId not provided)'),
            newTitle: z.string().optional(),
            description: z.string().nullish(),
            workflowStateId: z.string().optional().describe('The new workflow state ID or name'),
            assigneeId: z.string().nullish().describe('The user ID or name to assign this issue to'),
            priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
            estimate: z.number().nullish(),
            labelIds: z.array(z.string()).optional().describe('Array of label names or IDs'),
          })).min(1).describe('Array of issue updates. Must contain at least 1 update.'),
        }),
        execute: async ({ updates }) => {
          try {
            if (!updates || updates.length === 0) {
              return { success: false, error: tCommon('atLeastOneRequired', { item: tCommon('issueUpdate') }) }
            }

            const updatedIssues = []
            const errors = []

            for (const updateData of updates) {
              try {
                let resolvedIssueId = updateData.issueId

                // If title is provided, find the issue
                if (updateData.title && !updateData.issueId) {
                  const issues = await getIssues(teamId)
                  const matchingIssues = issues.filter(
                    (issue: any) => issue.title.toLowerCase().includes((updateData.title || '').toLowerCase())
                  )

                  if (matchingIssues.length === 0) {
                    errors.push({ issue: updateData.title, error: tTools('updateIssues.notFound') })
                    continue
                  }

                  if (matchingIssues.length > 1) {
                    errors.push({ issue: updateData.title, error: tTools('updateIssues.multiple', { title: updateData.title }) })
                    continue
                  }

                  resolvedIssueId = matchingIssues[0].id
                }

                if (!resolvedIssueId) {
                  errors.push({ issue: updateData.title || tCommon('unknown'), error: tTools('updateIssues.idOrTitleRequired') })
                  continue
                }

                // Resolve entities using helper functions
                const resolvedWorkflowStateId = updateData.workflowStateId
                  ? resolveWorkflowState(teamContext, updateData.workflowStateId)
                  : undefined

                // Resolve assignee and handle unassignment
                let resolvedAssigneeId: string | null = null
                let resolvedAssigneeName: string | null = null
                if (updateData.assigneeId && updateData.assigneeId !== 'unassigned' && updateData.assigneeId !== 'null' && updateData.assigneeId !== 'undefined') {
                  const assignee = resolveAssignee(teamContext, updateData.assigneeId)
                  if (assignee) {
                    resolvedAssigneeId = assignee.userId
                    resolvedAssigneeName = assignee.userName
                  }
                } else if (updateData.assigneeId === null || updateData.assigneeId === 'unassigned' || updateData.assigneeId === 'null' || updateData.assigneeId === 'undefined') {
                  // Explicitly unassign
                  resolvedAssigneeId = null
                  resolvedAssigneeName = null
                }

                // Resolve labels if provided
                const resolvedLabelIds = updateData.labelIds
                  ? resolveLabelIds(teamContext, updateData.labelIds)
                  : undefined

                const issue = await updateIssue(teamId, resolvedIssueId, {
                  ...(updateData.newTitle && { title: updateData.newTitle }),
                  ...(updateData.description !== undefined && updateData.description !== null && { description: updateData.description }),
                  ...(resolvedWorkflowStateId && { workflowStateId: resolvedWorkflowStateId }),
                  ...(updateData.assigneeId !== undefined && { 
                    assigneeId: resolvedAssigneeId ?? null,
                    assignee: resolvedAssigneeName
                  }),
                  ...(updateData.priority && { priority: updateData.priority }),
                  ...(updateData.estimate !== undefined && { estimate: updateData.estimate || null }),
                  ...(resolvedLabelIds && { labelIds: resolvedLabelIds }),
                })

                if (!issue) {
                  errors.push({ issue: updateData.title || updateData.issueId || tCommon('unknown'), error: tTools('updateIssues.updateFailed') })
                  continue
                }

                updatedIssues.push({
                  id: issue.id,
                  number: issue.number,
                  title: issue.title,
                })
              } catch (error: any) {
                errors.push({ issue: updateData.title || updateData.issueId || tCommon('unknown'), error: error.message || tTools('updateIssues.updateFailed') })
              }
            }

            const successMessage = updatedIssues.length > 0
              ? tTools('updateIssues.success', { count: updatedIssues.length, plural: updatedIssues.length !== 1 ? 's' : '', issues: updatedIssues.map(i => `#${i.number} "${i.title}"`).join(', ') })
              : ''

            const errorMessage = errors.length > 0
              ? tTools('updateIssues.failure', { count: errors.length, plural: errors.length !== 1 ? 's' : '', errors: errors.map(e => `"${e.issue}" (${e.error})`).join(', ') })
              : ''

            return {
              success: updatedIssues.length > 0,
              issues: updatedIssues,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              updatedCount: updatedIssues.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('updateIssues.failed') }
          }
        },
      }),

      deleteIssues: tool({
        description: 'Delete multiple issues at once. Accepts an array of issue IDs or titles. Use this when the user asks to delete multiple issues (e.g., "delete issues #1, #2, #3", "delete all issues in project X").',
        inputSchema: z.object({
          issues: z.array(z.object({
            issueId: z.string().optional().describe('The ID of the issue to delete'),
            title: z.string().optional().describe('The title of the issue to find and delete (if issueId not provided)'),
          })).min(1).describe('Array of issues to delete. Must contain at least 1 issue.'),
        }),
        execute: async ({ issues }) => {
          try {
            if (!issues || issues.length === 0) {
              return { success: false, error: tCommon('atLeastOneRequired', { item: tCommon('issue') }) }
            }

            const deletedIssues = []
            const errors = []

            for (const issueData of issues) {
              try {
                let resolvedIssueId = issueData.issueId

                // If title is provided, find the issue
                if (issueData.title && !issueData.issueId) {
                  const allIssues = await getIssues(teamId)
                  const matchingIssues = allIssues.filter(
                    (issue: any) => issue.title.toLowerCase().includes((issueData.title || '').toLowerCase())
                  )

                  if (matchingIssues.length === 0) {
                    errors.push({ issue: issueData.title, error: tTools('deleteIssues.notFound') })
                    continue
                  }

                  if (matchingIssues.length > 1) {
                    errors.push({ issue: issueData.title, error: tTools('deleteIssues.multiple', { title: issueData.title }) })
                    continue
                  }

                  resolvedIssueId = matchingIssues[0].id
                }

                if (!resolvedIssueId) {
                  errors.push({ issue: issueData.title || tCommon('unknown'), error: tTools('deleteIssues.idOrTitleRequired') })
                  continue
                }

                const issue = await getIssueById(teamId, resolvedIssueId)
                if (!issue) {
                  errors.push({ issue: resolvedIssueId, error: tTools('deleteIssues.issueNotFound') })
                  continue
                }

                await deleteIssue(teamId, resolvedIssueId)

                deletedIssues.push({
                  id: issue.id,
                  number: issue.number,
                  title: issue.title,
                })
              } catch (error: any) {
                errors.push({ issue: issueData.title || issueData.issueId || tCommon('unknown'), error: error.message || tTools('deleteIssues.failed') })
              }
            }

            const successMessage = deletedIssues.length > 0
              ? tTools('deleteIssues.success', { count: deletedIssues.length, plural: deletedIssues.length !== 1 ? 's' : '', issues: deletedIssues.map(i => `#${i.number} "${i.title}"`).join(', ') })
              : ''

            const errorMessage = errors.length > 0
              ? tTools('deleteIssues.failure', { count: errors.length, plural: errors.length !== 1 ? 's' : '', errors: errors.map(e => `"${e.issue}" (${e.error})`).join(', ') })
              : ''

            return {
              success: deletedIssues.length > 0,
              issues: deletedIssues,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              deletedCount: deletedIssues.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('deleteIssues.failed') }
          }
        },
      }),

      createProject: tool({
        description: 'Create a single new project. For creating multiple projects at once (2+), use createProjects instead. The name and key are REQUIRED. If any required information is missing (name or key), ask the user for it. The color parameter is optional and defaults to #6366f1 if not provided. The status parameter is optional and defaults to "active" if not provided.',
        inputSchema: z.object({
          name: z.string().nullish().describe('The name of the project (REQUIRED). Do not call this tool with name missing - always ask the user to specify the project name first.'),
          description: z.string().optional(),
          key: z.string().nullish().describe('A 3-letter project identifier (REQUIRED). Do not call this tool with key missing - always ask the user to specify a 3-letter project key first.'),
          color: z.string().optional(),
          icon: z.string().optional(),
          leadId: z.string().optional(),
          status: z.enum(['active', 'completed', 'canceled']).optional().describe('The status of the project (active, completed, or canceled)'),
        }),
        execute: async ({ name, description, key, color, icon, leadId, status }) => {
          try {
            // Check for missing required fields and ask user for them
            const missingFields = []
            
            if (!name || name === 'null' || name === 'undefined') {
              missingFields.push('name')
            }
            
            if (!key || key === 'null' || key === 'undefined') {
              missingFields.push('key (3-letter project identifier)')
            }
            
            if (missingFields.length > 0) {
              // Special message for key
              if (missingFields.includes('key (3-letter project identifier)') && missingFields.length === 1) {
                return {
                  success: false,
                  error: tTools('createProject.missingKey'),
                }
              }

              // Special message for name
              if (missingFields.includes('name') && missingFields.length === 1) {
                return {
                  success: false,
                  error: tTools('createProject.missingName'),
                }
              }

              // Combined message
              return {
                success: false,
                error: tTools('createProject.missingBoth', { fieldCount: missingFields.length === 1 ? 'this' : 'these' }),
              }
            }

            // Validate key length if provided
            if (key && key.length !== 3) {
              return {
                success: false,
                error: tTools('createProject.keyLengthError', { key, length: key.length, plural: key.length !== 1 ? 's' : '' }),
              }
            }
            
            // Default color if not provided
            const projectColor = color || '#6366f1'
            // Default status if not provided
            const projectStatus = status || 'active'
            
            const project = await createProject(teamId, {
              name: name!,
              description,
              key: key!,
              color: projectColor,
              icon,
              leadId,
              status: projectStatus,
              lead: leadId ? teamContext.members.find(m => m.userId === leadId)?.userName : undefined,
            })

            return {
              success: true,
              project: {
                id: project.id,
                name: project.name,
                key: project.key,
                description: project.description,
              },
              message: tTools('createProject.success', { name: project.name }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('createProject.failed') }
          }
        },
      }),

      createProjects: tool({
        description: 'Create multiple projects at once. Accepts an array of project objects. Each project needs: name and key (3-letter identifier). Use this when the user asks to create multiple projects (e.g., "create 5 projects", "create projects for frontend, backend, and API").',
        inputSchema: z.object({
          projects: z.array(z.object({
            name: z.string().nullish().describe('The name of the project (REQUIRED)'),
            description: z.string().nullish(),
            key: z.string().nullish().describe('A 3-letter project identifier (REQUIRED)'),
            color: z.string().optional(),
            icon: z.string().optional(),
            leadId: z.string().optional(),
            status: z.enum(['active', 'completed', 'canceled']).nullish().describe('The status of the project (optional, defaults to active)'),
          })).min(1).describe('Array of projects to create. Must contain at least 1 project.'),
        }),
        execute: async ({ projects }) => {
          try {
            if (!projects || projects.length === 0) {
              return { success: false, error: tTools('createProjects.atLeastOne') }
            }

            // Check for missing required fields across all projects
            const missingFields: string[] = []
            for (let i = 0; i < projects.length; i++) {
              const projectData = projects[i]
              if (!projectData.name || projectData.name === 'null' || projectData.name === 'undefined') {
                missingFields.push(`Project ${i + 1}: name`)
              }
              if (!projectData.key || projectData.key === 'null' || projectData.key === 'undefined') {
                missingFields.push(`Project ${i + 1}: key (3-letter identifier)`)
              }
            }

            if (missingFields.length > 0) {
              return {
                success: false,
                error: tTools('createProjects.validationError', { missingFields: missingFields.join(', '), fieldCount: missingFields.length === 1 ? 'this' : 'these' }),
              }
            }

            const createdProjects = []
            const errors = []

            for (const projectData of projects) {
              try {
                // Validate key length
                const projectKey = projectData.key! // Safe after validation
                if (projectKey.length !== 3) {
                  errors.push({ project: projectData.name || tCommon('unknown'), error: tTools('createProjects.keyLengthError', { key: projectKey }) })
                  continue
                }

                // Check if key already exists
                const existingProject = teamContext.projects.find(p => p.key.toLowerCase() === projectKey.toLowerCase())
                if (existingProject) {
                  errors.push({ project: projectData.name || tCommon('unknown'), error: tTools('createProjects.keyExistsError', { key: projectKey }) })
                  continue
                }

                const project = await createProject(teamId, {
                  name: projectData.name!,
                  description: projectData.description ?? undefined,
                  key: projectData.key!,
                  color: projectData.color || '#6366f1',
                  icon: projectData.icon,
                  leadId: projectData.leadId,
                  status: projectData.status || 'active',
                  lead: projectData.leadId ? teamContext.members.find(m => m.userId === projectData.leadId)?.userName : undefined,
                })

                createdProjects.push({
                  id: project.id,
                  name: project.name,
                  key: project.key,
                })
              } catch (error: any) {
                errors.push({ project: projectData.name, error: error.message || tTools('createProjects.failed') })
              }
            }

            const successMessage = createdProjects.length > 0
              ? tTools('createProjects.success', { count: createdProjects.length, plural: createdProjects.length !== 1 ? 's' : '', projects: createdProjects.map(p => `"${p.name}" (${p.key})`).join(', ') })
              : ''

            const errorMessage = errors.length > 0
              ? tTools('createProjects.failure', { count: errors.length, plural: errors.length !== 1 ? 's' : '', errors: errors.map(e => `"${e.project}" (${e.error})`).join(', ') })
              : ''

            return {
              success: createdProjects.length > 0,
              projects: createdProjects,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              createdCount: createdProjects.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('createProjects.failed') }
          }
        },
      }),

      listProjects: tool({
        description: 'Get all projects for the team',
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          try {
            const projects = teamContext.projects
            return {
              success: true,
              projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                key: p.key,
                description: p.description,
                status: p.status,
                issueCount: p._count.issues,
              })),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('listProjects.failed') }
          }
        },
      }),

      updateProject: tool({
        description: 'Update an existing project by name or ID. You can update properties like status, name, description, color, icon, or lead.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project to update'),
          name: z.string().optional().describe('The name of the project to find (if projectId not provided)'),
          newName: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(['active', 'completed', 'canceled']).optional().describe('The new status of the project (active, completed, or canceled)'),
          color: z.string().optional(),
          icon: z.string().optional(),
          leadId: z.string().optional(),
        }),
        execute: async ({ projectId, name, newName, description, status, color, icon, leadId }) => {
          try {
            let resolvedProjectId = projectId

            // If name is provided, find the project by name
            if (name && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(name.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: tTools('updateProject.notFound', { name }) }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: tTools('updateProject.multiple', { name, matches: matchingProjects.map(p => `${p.name} (${p.key})`).join(', ') }),
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: tTools('updateProject.idOrNameRequired') }
            }

            const project = await updateProject(teamId, resolvedProjectId, {
              ...(newName && { name: newName }),
              ...(description !== undefined && { description }),
              ...(status && { status }),
              ...(color && { color }),
              ...(icon && { icon }),
              ...(leadId !== undefined && {
                leadId,
                lead: leadId ? teamContext.members.find(m => m.userId === leadId)?.userName : undefined,
              }),
            })

            if (!project) {
              return { success: false, error: tTools('updateProject.projectNotFound') }
            }

            return {
              success: true,
              project: {
                id: project.id,
                name: project.name,
                key: project.key,
                status: project.status,
              },
              message: tTools('updateProject.success', { name: project.name }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('updateProject.failed') }
          }
        },
      }),

      inviteTeamMember: tool({
        description: 'Invite a single new team member via email. For inviting multiple team members at once (2+), use inviteTeamMembers instead.',
        inputSchema: z.object({
          email: z.string().min(5).describe('The email address to invite'),
          role: z.string().optional().default('developer').describe('The role for the member (developer, admin, viewer)'),
        }),
        execute: async ({ email, role }) => {
          try {
            // Check if invitation already exists
            const existingInvitation = await db.invitation.findUnique({
              where: {
                teamId_email: { teamId, email },
              },
            })

            if (existingInvitation?.status === 'pending') {
              return { success: false, error: tTools('inviteTeamMember.alreadyInvited', { email }) }
            }

            // Create invitation
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 7)

            const invitation = await db.invitation.create({
              data: {
                teamId,
                email,
                role,
                invitedBy: userId,
                status: 'pending',
                expiresAt,
              },
            })

            // Send email
            const team = await db.team.findUnique({ where: { id: teamId } })
            const inviterName = user.name || user.email || 'Someone'

            if (process.env.RESEND_API_KEY) {
              try {
                await sendInvitationEmail({
                  email,
                  teamName: team?.name || 'the team',
                  inviterName,
                  role: role || 'developer',
                  inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL}/invite/${invitation.id}`,
                  locale,
                })
              } catch (emailError) {
                console.error('Error sending invitation email:', emailError)
              }
            }

            return {
              success: true,
              message: tTools('inviteTeamMember.success', { email }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('inviteTeamMember.failed') }
          }
        },
      }),

      inviteTeamMembers: tool({
        description: 'Invite multiple team members at once. Accepts an array of email addresses with optional roles. Use this when the user asks to invite multiple people (e.g., "invite 10 team members", "invite john@example.com, jane@example.com, and bob@example.com").',
        inputSchema: z.object({
          invitations: z.array(z.object({
            email: z.string().min(5).describe('The email address to invite (REQUIRED). Must be a valid email format.'),
            role: z.string().optional().default('developer').describe('The role for the member (developer, admin, viewer)'),
          })).min(1).describe('Array of invitations to send. Must contain at least 1 invitation.'),
        }),
        execute: async ({ invitations }) => {
          try {
            if (!invitations || invitations.length === 0) {
              return { success: false, error: tCommon('atLeastOneRequired', { item: tCommon('invitation') }) }
            }

            const sentInvitations = []
            const errors = []
            const team = await db.team.findUnique({ where: { id: teamId } })
            const inviterName = user.name || user.email || 'Someone'

            for (const invitationData of invitations) {
              try {
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (!emailRegex.test(invitationData.email)) {
                  errors.push({ email: invitationData.email, error: tTools('inviteTeamMembers.invalidEmail') })
                  continue
                }

                // Check if invitation already exists
                const existingInvitation = await db.invitation.findUnique({
                  where: {
                    teamId_email: { teamId, email: invitationData.email },
                  },
                })

                if (existingInvitation?.status === 'pending') {
                  errors.push({ email: invitationData.email, error: tTools('inviteTeamMembers.alreadyInvited') })
                  continue
                }

                // Create invitation
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 7)

                const invitation = await db.invitation.create({
                  data: {
                    teamId,
                    email: invitationData.email,
                    role: invitationData.role || 'developer',
                    invitedBy: userId,
                    status: 'pending',
                    expiresAt,
                  },
                })

                // Send email
                if (process.env.RESEND_API_KEY) {
                  try {
                    await sendInvitationEmail({
                      email: invitationData.email,
                      teamName: team?.name || 'the team',
                      inviterName,
                      role: invitationData.role || 'developer',
                      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL}/invite/${invitation.id}`,
                      locale,
                    })
                  } catch (emailError) {
                    console.error(`Error sending invitation email to ${invitationData.email}:`, emailError)
                    // Don't fail the invitation if email fails
                  }
                }

                sentInvitations.push({
                  email: invitationData.email,
                  role: invitationData.role || 'developer',
                })
              } catch (error: any) {
                errors.push({ email: invitationData.email, error: error.message || tTools('inviteTeamMembers.sendFailed') })
              }
            }

            const successMessage = sentInvitations.length > 0
              ? tTools('inviteTeamMembers.success', { count: sentInvitations.length, plural: sentInvitations.length !== 1 ? 's' : '', emails: sentInvitations.map(i => i.email).join(', ') })
              : ''

            const errorMessage = errors.length > 0
              ? tTools('inviteTeamMembers.failure', { count: errors.length, plural: errors.length !== 1 ? 's' : '', errors: errors.map(e => `${e.email} (${e.error})`).join(', ') })
              : ''

            return {
              success: sentInvitations.length > 0,
              invitations: sentInvitations,
              message: [successMessage, errorMessage].filter(m => m).join('. '),
              sentCount: sentInvitations.length,
              failedCount: errors.length,
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('inviteTeamMembers.failed') }
          }
        },
      }),

      listTeamMembers: tool({
        description: 'Get all team members',
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          try {
            return {
              success: true,
              members: teamContext.members.map(m => ({
                userId: m.userId,
                name: m.userName,
                email: m.userEmail,
                role: m.role,
              })),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('listTeamMembers.failed') }
          }
        },
      }),

      getTeamStats: tool({
        description: 'Get team statistics and summary',
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          try {
            const [issueCount, projectCount, memberCount] = await Promise.all([
              db.issue.count({ where: { teamId } }),
              db.project.count({ where: { teamId } }),
              db.teamMember.count({ where: { teamId } }),
            ])

            return {
              success: true,
              stats: {
                issues: issueCount,
                projects: projectCount,
                members: memberCount,
              },
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('getTeamStats.failed') }
          }
        },
      }),

      deleteProject: tool({
        description: 'Delete a project by name or ID. This will permanently remove the project and all associated issues.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project to delete'),
          name: z.string().optional().describe('The name of the project to find and delete (if projectId not provided)'),
        }),
        execute: async ({ projectId, name }) => {
          try {
            let resolvedProjectId = projectId

            // If name is provided, find the project by name
            if (name && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(name.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: tTools('deleteProject.notFound', { name }) }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: tTools('deleteProject.multiple', { name, matches: matchingProjects.map(p => `${p.name} (${p.key})`).join(', ') }),
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: tTools('deleteProject.idOrNameRequired') }
            }

            // Get project details before deleting
            const project = await db.project.findUnique({
              where: { id: resolvedProjectId, teamId },
            })

            if (!project) {
              return { success: false, error: tTools('deleteProject.projectNotFound') }
            }

            // Delete the project
            await deleteProject(teamId, resolvedProjectId)

            return {
              success: true,
              message: tTools('deleteProject.success', { name: project.name }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('deleteProject.failed') }
          }
        },
      }),

      addProjectMember: tool({
        description: 'Add a team member to a project. The member must already be a team member. Use project name or ID, and member name or email.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project'),
          projectName: z.string().optional().describe('The name of the project (if projectId not provided)'),
          userId: z.string().optional().describe('The user ID to add'),
          userEmail: z.string().optional().describe('The email of the user to add'),
          userName: z.string().optional().describe('The name of the user to add'),
        }),
        execute: async ({ projectId, projectName, userId, userEmail, userName }) => {
          try {
            // Resolve project
            let resolvedProjectId = projectId
            if (projectName && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(projectName.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: tTools('addProjectMember.projectNotFound', { name: projectName }) }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: tTools('addProjectMember.multipleProjects', { name: projectName, matches: matchingProjects.map(p => `${p.name} (${p.key})`).join(', ') }),
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: tTools('addProjectMember.idOrNameRequired') }
            }

            // Verify project exists
            const project = await db.project.findUnique({
              where: { id: resolvedProjectId, teamId },
            })

            if (!project) {
              return { success: false, error: tTools('addProjectMember.projectNotFound2') }
            }

            // Resolve team member
            let teamMember = null
            if (userId) {
              teamMember = teamContext.members.find(m => m.userId === userId)
            } else if (userEmail) {
              teamMember = teamContext.members.find(m => m.userEmail.toLowerCase() === userEmail.toLowerCase())
            } else if (userName) {
              teamMember = teamContext.members.find(m => m.userName.toLowerCase().includes(userName.toLowerCase()))
            }

            if (!teamMember) {
              const availableMembers = teamContext.members.map(m => `${m.userName} (${m.userEmail})`).join(', ')
              return {
                success: false,
                error: tTools('addProjectMember.memberNotFound', { members: availableMembers || tCommon('noMembers') }),
              }
            }

            // Check if already a project member
            const existingMember = await db.projectMember.findUnique({
              where: {
                projectId_userId: {
                  projectId: resolvedProjectId,
                  userId: teamMember.userId,
                },
              },
            })

            if (existingMember) {
              return { success: false, error: tTools('addProjectMember.alreadyMember', { name: teamMember.userName }) }
            }

            // Add member to project
            await db.projectMember.create({
              data: {
                projectId: resolvedProjectId,
                userId: teamMember.userId,
                userEmail: teamMember.userEmail,
                userName: teamMember.userName,
              },
            })

            return {
              success: true,
              message: tTools('addProjectMember.success', { userName: teamMember.userName, projectName: project.name }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('addProjectMember.failed') }
          }
        },
      }),

      removeProjectMember: tool({
        description: 'Remove a team member from a project. Use project name or ID, and member name or email.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project'),
          projectName: z.string().optional().describe('The name of the project (if projectId not provided)'),
          userId: z.string().optional().describe('The user ID to remove'),
          userEmail: z.string().optional().describe('The email of the user to remove'),
          userName: z.string().optional().describe('The name of the user to remove'),
        }),
        execute: async ({ projectId, projectName, userId, userEmail, userName }) => {
          try {
            // Resolve project
            let resolvedProjectId = projectId
            if (projectName && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(projectName.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: tTools('removeProjectMember.projectNotFound', { name: projectName }) }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: tTools('removeProjectMember.multipleProjects', { name: projectName, matches: matchingProjects.map(p => `${p.name} (${p.key})`).join(', ') }),
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: tTools('removeProjectMember.idOrNameRequired') }
            }

            // Verify project exists
            const project = await db.project.findUnique({
              where: { id: resolvedProjectId, teamId },
            })

            if (!project) {
              return { success: false, error: tTools('removeProjectMember.projectNotFound2') }
            }

            // Resolve project member
            let projectMember = null
            if (userId) {
              projectMember = await db.projectMember.findFirst({
                where: {
                  projectId: resolvedProjectId,
                  userId,
                },
              })
            } else if (userEmail) {
              projectMember = await db.projectMember.findFirst({
                where: {
                  projectId: resolvedProjectId,
                  userEmail: {
                    equals: userEmail,
                    mode: 'insensitive',
                  },
                },
              })
            } else if (userName) {
              const members = await db.projectMember.findMany({
                where: { projectId: resolvedProjectId },
              })
              projectMember = members.find(m => m.userName.toLowerCase().includes(userName.toLowerCase())) || null
            }

            if (!projectMember) {
              return { success: false, error: tTools('removeProjectMember.memberNotFound') }
            }

            // Remove member from project
            await db.projectMember.delete({
              where: { id: projectMember.id },
            })

            return {
              success: true,
              message: tTools('removeProjectMember.success', { userName: projectMember.userName, projectName: project.name }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('removeProjectMember.failed') }
          }
        },
      }),

      listProjectMembers: tool({
        description: 'List all members of a specific project. Use project name or ID.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('The ID of the project'),
          projectName: z.string().optional().describe('The name of the project (if projectId not provided)'),
        }),
        execute: async ({ projectId, projectName }) => {
          try {
            // Resolve project
            let resolvedProjectId = projectId
            if (projectName && !projectId) {
              const projects = teamContext.projects
              const matchingProjects = projects.filter(
                (project) => project.name.toLowerCase().includes(projectName.toLowerCase())
              )

              if (matchingProjects.length === 0) {
                return { success: false, error: tTools('listProjectMembers.projectNotFound', { name: projectName }) }
              }

              if (matchingProjects.length > 1) {
                return {
                  success: false,
                  error: tTools('listProjectMembers.multipleProjects', { name: projectName, matches: matchingProjects.map(p => `${p.name} (${p.key})`).join(', ') }),
                }
              }

              resolvedProjectId = matchingProjects[0].id
            }

            if (!resolvedProjectId) {
              return { success: false, error: tTools('listProjectMembers.idOrNameRequired') }
            }

            // Verify project exists
            const project = await db.project.findUnique({
              where: { id: resolvedProjectId, teamId },
            })

            if (!project) {
              return { success: false, error: tTools('listProjectMembers.projectNotFound2') }
            }

            // Get project members
            const members = await db.projectMember.findMany({
              where: { projectId: resolvedProjectId },
              orderBy: { createdAt: 'asc' },
            })

            return {
              success: true,
              members: members.map(m => ({
                userId: m.userId,
                name: m.userName,
                email: m.userEmail,
              })),
              projectName: project.name,
              count: members.length,
              message: members.length === 0
                ? tTools('listProjectMembers.noMembers', { name: project.name })
                : tTools('listProjectMembers.success', { name: project.name, count: members.length, plural: members.length !== 1 ? 's' : '', members: members.map(m => m.userName).join(', ') }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('listProjectMembers.failed') }
          }
        },
      }),

      revokeInvitation: tool({
        description: 'Revoke or cancel a pending team invitation by email or invitation ID',
        inputSchema: z.object({
          invitationId: z.string().optional().describe('The ID of the invitation to revoke'),
          email: z.string().optional().describe('The email address of the pending invitation to revoke (if invitationId not provided)'),
        }),
        execute: async ({ invitationId, email }) => {
          try {
            let resolvedInvitationId = invitationId

            // If email is provided, find the invitation by email
            if (email && !invitationId) {
              const invitation = await db.invitation.findUnique({
                where: {
                  teamId_email: { teamId, email },
                },
              })

              if (!invitation) {
                return { success: false, error: tTools('revokeInvitation.notFound', { email }) }
              }

              if (invitation.status !== 'pending') {
                return { success: false, error: tTools('revokeInvitation.notPending', { email, status: invitation.status }) }
              }

              resolvedInvitationId = invitation.id
            }

            if (!resolvedInvitationId) {
              return { success: false, error: tTools('revokeInvitation.idOrEmailRequired') }
            }

            // Get invitation details before deleting
            const invitation = await db.invitation.findUnique({
              where: { id: resolvedInvitationId, teamId },
            })

            if (!invitation) {
              return { success: false, error: tTools('revokeInvitation.invitationNotFound') }
            }

            // Delete the invitation
            await db.invitation.delete({
              where: { id: resolvedInvitationId, teamId },
            })

            return {
              success: true,
              message: tTools('revokeInvitation.success', { email: invitation.email }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('revokeInvitation.failed') }
          }
        },
      }),

      removeTeamMember: tool({
        description: 'Remove a team member from the workspace by user ID, email, or name. Only admins can remove team members.',
        inputSchema: z.object({
          memberId: z.string().optional().describe('The team member ID to remove'),
          userId: z.string().optional().describe('The user ID of the member to remove (if memberId not provided)'),
          email: z.string().optional().describe('The email address of the member to remove (if memberId or userId not provided)'),
          name: z.string().optional().describe('The name of the member to remove (if memberId, userId, or email not provided)'),
        }),
        execute: async ({ memberId, userId, email, name }) => {
          try {
            let resolvedMemberId = memberId

            // If user identifier is provided, find the member
            if (!memberId && (userId || email || name)) {
              const members = await db.teamMember.findMany({
                where: { teamId },
              })

              let matchingMember
              if (userId) {
                matchingMember = members.find(m => m.userId === userId)
              } else if (email) {
                matchingMember = members.find(m => m.userEmail?.toLowerCase() === email.toLowerCase())
              } else if (name) {
                matchingMember = members.find(m =>
                  m.userName?.toLowerCase().includes(name.toLowerCase())
                )
              }

              if (!matchingMember) {
                return { success: false, error: tTools('removeTeamMember.memberNotFound') }
              }

              resolvedMemberId = matchingMember.id
            }

            if (!resolvedMemberId) {
              return { success: false, error: tTools('removeTeamMember.idOrIdentifierRequired') }
            }

            // Check if current user is an admin
            const currentMember = await db.teamMember.findFirst({
              where: {
                teamId,
                userId,
              },
            })

            if (!currentMember || currentMember.role !== 'admin') {
              return { success: false, error: tTools('removeTeamMember.adminOnly') }
            }

            // Get member details before deleting
            const member = await db.teamMember.findUnique({
              where: { id: resolvedMemberId },
            })

            if (!member || member.teamId !== teamId) {
              return { success: false, error: tTools('removeTeamMember.notFound') }
            }

            // Check if trying to remove yourself
            if (member.userId === userId) {
              return { success: false, error: tTools('removeTeamMember.cannotRemoveSelf') }
            }

            // Delete the member
            await db.teamMember.delete({
              where: { id: resolvedMemberId },
            })

            return {
              success: true,
              message: tTools('removeTeamMember.success', { name: member.userName || member.userEmail }),
            }
          } catch (error: any) {
            return { success: false, error: error.message || tTools('removeTeamMember.failed') }
          }
        },
      }),
    }

    // Convert UIMessages to ModelMessages
    // Ensure messages are in the correct UIMessage format (with parts array) before conversion
    let modelMessages
    try {
      // Convert messages to UIMessage format (parts array structure)
      // Messages from the client might already be in UIMessage format or might be simple {role, content}
      const validMessages = messages.map((msg: any) => {
        // If message already has parts array, use it (UIMessage format)
        if (msg.parts && Array.isArray(msg.parts)) {
          return {
            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
            role: msg.role,
            parts: msg.parts,
            ...(msg.metadata && { metadata: msg.metadata }),
          }
        }
        
        // Otherwise, convert simple {role, content} to UIMessage format
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : (msg.content || msg.text || '')
        
        const parts: any[] = [
          {
            type: 'text',
            text: content,
          }
        ]
        
        // Add tool calls if they exist
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
          msg.toolCalls.forEach((tc: any) => {
            parts.push({
              type: 'tool-call' as const,
              toolCallId: tc.toolCallId || tc.id || `tc-${Date.now()}-${Math.random()}`,
              toolName: tc.toolName || tc.name,
              args: tc.args || tc.arguments || {},
            })
          })
        }
        
        return {
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          parts,
          ...(msg.metadata && { metadata: msg.metadata }),
        }
      })
      
      modelMessages = convertToModelMessages(validMessages)
    } catch (error: any) {
      console.error('Error converting messages:', error)
      console.error('Messages received:', JSON.stringify(messages, null, 2))
      const t = await getTranslations({ locale, namespace: 'api.chat' })
      return NextResponse.json(
        { error: t('errors.failedToProcess', { error: error.message || 'Unknown error' }) },
        { status: 400 }
      )
    }

    // Create Groq provider with API key
    const groq = createGroq({
      apiKey: apiKey,
    })

    // Stream the response
    const result = streamText({
      model: groq('openai/gpt-oss-120b'),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(5), // Allow multi-step tool calls
      onFinish: async ({ text, usage, toolCalls, toolResults }) => {
        // Save all messages to database after completion
        try {
          // Collect all messages including the assistant's response
          const allMessages = [
            ...messages.map((msg: any) => ({
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : (msg.content || msg.text || ''),
              toolCalls: msg.toolCalls || null,
            })),
            {
              role: 'assistant',
              content: text || '',
              toolCalls: toolCalls ? JSON.parse(JSON.stringify(toolCalls)) : null,
            },
          ]

          await saveChatMessages({
            conversationId,
            messages: allMessages,
          })

          // Update conversation title if this is the first message
          const conversation = await getChatConversation(conversationId)
          if (conversation && !conversation.title && allMessages.length >= 2) {
            const firstUserMessage = allMessages.find((m) => m.role === 'user')
            if (firstUserMessage) {
              const title = generateConversationTitle(firstUserMessage.content)
              await updateConversationTitle(conversationId, title)
            }
          }
        } catch (error) {
          console.error('Error saving chat messages:', error)
          // Don't fail the request if saving fails
        }
      },
    })

    // Create a custom response that includes conversationId in headers
    const response = result.toUIMessageStreamResponse()
    
    // Add conversationId to response headers
    response.headers.set('X-Conversation-Id', conversationId)
    
    return response
  } catch (error) {
    console.error('Error in chat route:', error)
    // Try to get locale for error message
    let locale = 'en'
    try {
      locale = getLocaleFromRequest(request)
    } catch (e) {
      // Use default locale if unable to get from request
    }
    const t = await getTranslations({ locale, namespace: 'api.chat' })
    return NextResponse.json(
      { error: t('errors.failedToSave') },
      { status: 500 }
    )
  }
}
