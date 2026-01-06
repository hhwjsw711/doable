import { useLocale } from 'next-intl'

export function useFormatDate() {
  const locale = useLocale()

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date

    // Check if the date is valid
    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }

    // Default options if not provided
    const defaultOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }

    return new Intl.DateTimeFormat(locale, options || defaultOptions).format(dateObj)
  }

  const formatDateShort = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }

    // Check if the date is in the current year
    const now = new Date()
    const isThisYear = dateObj.getFullYear() === now.getFullYear()

    if (isThisYear) {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
      }).format(dateObj)
    }

    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj)
  }

  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }

    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(dateObj)
  }

  const formatRelativeTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Invalid date'
    }

    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

    // Less than a minute
    if (diffInSeconds < 60) {
      return locale === 'zh' ? '刚刚' : 'just now'
    }

    // Less than an hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return locale === 'zh' ? `${minutes}分钟前` : `${minutes}m ago`
    }

    // Less than a day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return locale === 'zh' ? `${hours}小时前` : `${hours}h ago`
    }

    // Less than a week
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400)
      return locale === 'zh' ? `${days}天前` : `${days}d ago`
    }

    // Otherwise, use the regular date format
    return formatDateShort(dateObj)
  }

  return {
    formatDate,
    formatDateShort,
    formatDateTime,
    formatRelativeTime,
    locale,
  }
}
