/**
 * Translate project status from database to localized display names
 */
export function translateProjectStatus(status: string, t: (key: string) => string): string {
  // List of project statuses that should be translated
  const projectStatuses = ['active', 'completed', 'canceled', 'backlog']

  const statusLower = status.toLowerCase()

  // Check if this is a standard project status
  if (projectStatuses.includes(statusLower)) {
    try {
      return t(`projects.${statusLower}`)
    } catch {
      // Fallback to original if translation key doesn't exist
      return status
    }
  }

  // Return original for any non-standard status
  return status
}
