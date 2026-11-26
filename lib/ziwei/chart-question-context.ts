import { BRANCHES, STEMS } from './constants';
import type { Palace, ZiweiChart } from './types';

/** Only derived chart placements are sent to the interpretation service. */
export function buildChartQuestionContext(chart: ZiweiChart, selectedPalace?: Palace | null): string {
  const current = chart.daXians[chart.currentDaXianIndex];
  const lines = [
    `五行局：${chart.wuxingJuName}。命宮在${BRANCHES[chart.mingGongBranch]}，身宮在${BRANCHES[chart.shenGongBranch]}。`,
  ];
  if (current) lines.push(`盤面目前大限：${current.palaceName}，${current.startAge}–${current.endAge} 虛歲。`);
  if (selectedPalace) lines.push(`本輪點選宮位：${selectedPalace.name}。`);

  for (const palace of chart.palaces) {
    const major = palace.stars.filter(star => star.type === 'major')
      .map(star => star.brightnessRaw ? `${star.name}（${star.brightnessRaw}）` : star.name);
    const natal = palace.stars.filter(star => star.siHua).map(star => `${star.name}化${star.siHua}`);
    const mainStars = major.length ? major.join('、') : '無主星';
    const borrowed = !major.length && palace.borrowedStars?.length
      ? `，參照對宮${palace.borrowedFromName ?? ''}的${palace.borrowedStars.join('、')}` : '';
    const transformations = natal.length ? `。生年四化：${natal.join('、')}` : '';
    lines.push(`${palace.name}（${STEMS[palace.stem]}${BRANCHES[palace.branch]}）：${mainStars}${borrowed}${transformations}。`);
  }
  return lines.join('\n');
}
