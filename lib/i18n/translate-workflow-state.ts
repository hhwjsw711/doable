/**
 * Translate workflow state names from database to localized display names
 * For custom user-created states, returns the original name
 */
export function translateWorkflowState(stateName: string, t: (key: string) => string): string {
  // List of default workflow states that should be translated
  const defaultStates = ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled']

  // Check if this is a default state
  if (defaultStates.includes(stateName)) {
    try {
      return t(`workflowStates.${stateName}`)
    } catch {
      // Fallback to original name if translation key doesn't exist
      return stateName
    }
  }

  // Return original name for custom user-created states
  return stateName
}
