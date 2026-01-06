/**
 * Translate label names from database to localized display names
 * For custom user-created labels, returns the original name
 */
export function translateLabel(labelName: string, t: (key: string) => string): string {
  // List of default labels that should be translated
  const defaultLabels = ['Bug', 'Feature', 'Enhancement', 'Documentation', 'Performance', 'Security']

  // Check if this is a default label
  if (defaultLabels.includes(labelName)) {
    try {
      return t(`defaultLabels.${labelName}`)
    } catch {
      // Fallback to original name if translation key doesn't exist
      return labelName
    }
  }

  // Return original name for custom user-created labels
  return labelName
}
