export const READING_TOPICS = [
  { key: 'overview', label: '命格', title: '命格总览' },
  { key: 'love', label: '感情', title: '感情 · 夫妻宫' },
  { key: 'career', label: '事业', title: '事业 · 官禄宫' },
  { key: 'wealth', label: '财运', title: '财运 · 财帛宫' },
  { key: 'health', label: '健康', title: '健康 · 疾厄宫' },
  { key: 'personality', label: '性格', title: '性格 · 命宫' },
] as const;

/** 本宫、对宫、两个三合宫。 */
export function getSanFangSiZheng(branch: number): [number, number, number, number] {
  return [branch, (branch + 6) % 12, (branch + 4) % 12, (branch + 8) % 12];
}
