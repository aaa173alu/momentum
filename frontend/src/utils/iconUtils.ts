export function getIcon(tema: string, iconDefault: string, iconN: string): string {
  return tema === 'oscuro' ? iconDefault : iconN
}
