/**
 * Format a date to a Spanish locale string
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  // Forzar año 2025 para todas las fechas
  const newDate = new Date(date);
  newDate.setFullYear(2025);
  
  return newDate.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generates a random string ID
 * @param length Length of the ID
 * @returns Random ID string
 */
export function generateRandomId(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
