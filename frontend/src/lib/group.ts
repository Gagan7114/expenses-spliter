import type { GroupDetail, Member } from '../api/types'

export function memberMap(group: GroupDetail | undefined) {
  return new Map<number, Member>((group?.members ?? []).map((m) => [m.id, m]))
}

/** "You" for the current member, otherwise their display name. */
export function nameOf(members: Map<number, Member>, id: number, me?: number) {
  if (id === me) return 'You'
  return members.get(id)?.user.display_name ?? 'Former member'
}

/** Each category has an icon and a hue for its tinted tile. */
export const CATEGORIES: { value: string; label: string; hue: number }[] = [
  { value: 'food', label: 'Food', hue: 25 },
  { value: 'groceries', label: 'Groceries', hue: 140 },
  { value: 'rent', label: 'Rent', hue: 260 },
  { value: 'utilities', label: 'Bills', hue: 85 },
  { value: 'travel', label: 'Travel', hue: 220 },
  { value: 'stay', label: 'Stay', hue: 295 },
  { value: 'shopping', label: 'Shopping', hue: 340 },
  { value: 'fun', label: 'Fun', hue: 55 },
  { value: 'other', label: 'Other', hue: 230 },
]
export const category = (v: string) => CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[CATEGORIES.length - 1]
export const categoryLabel = (v: string) => category(v).label

/** Stable hue per name, for group tiles and avatars. */
export function hueOf(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return hash % 360
}

/** Soft background + strong foreground for a hue, readable in both themes. */
export function tint(hue: number) {
  return {
    background: `light-dark(oklch(0.93 0.05 ${hue}), oklch(0.33 0.07 ${hue}))`,
    color: `light-dark(oklch(0.42 0.12 ${hue}), oklch(0.88 0.08 ${hue}))`,
  }
}

export function dayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  const diff = Math.round((new Date(today.toDateString()).getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function groupBy<T>(items: T[], key: (t: T) => string) {
  const out = new Map<string, T[]>()
  for (const it of items) out.set(key(it), [...(out.get(key(it)) ?? []), it])
  return out
}
