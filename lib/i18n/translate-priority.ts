/**
 * Translate priority level from English to localized display name
 */
export function translatePriority(priority: string, t: (key: string) => string): string {
  // List of priority levels that should be translated
  const priorities = ['none', 'low', 'medium', 'high', 'urgent']

  const priorityLower = priority.toLowerCase()

  // Check if this is a standard priority level
  if (priorities.includes(priorityLower)) {
    try {
      return t(`components.filterBar.priorities.${priorityLower}`)
    } catch {
      // Fallback to original if translation key doesn't exist
      return priority
    }
  }

  // Return original for any non-standard priority
  return priority
}
