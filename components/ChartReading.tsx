'use client';

import { useState } from 'react';
import { getSanFangSiZheng, READING_TOPICS } from '@/lib/ziwei/chart-reading';
import { BRANCHES, STAR_DESCRIPTIONS, STEMS } from '@/lib/ziwei/constants';
import { TOPIC_PALACE_NAME } from '@/lib/ziwei/db-analysis';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

type ReadingTopic = (typeof READING_TOPICS)[number];

const PALACE_THEMES: Record<string, string> = {
  '命宫': '命宫用来观察个性、行事风格与整体配置。',
  '兄弟宫': '兄弟宫用来观察手足与同辈关系。',
  '夫妻宫': '夫妻宫用来观察伴侣关系与相处模式。',
  '子女宫': '子女宫用来观察亲子关系。',
  '财帛宫': '财帛宫用来观察资源取得与运用的方式。',
  '疾厄宫': '疾厄宫以下列传统星曜配置供参照。',
  '迁移宫': '迁移宫用来观察外出与适应新环境的方式。',
  '交友宫': '交友宫用来观察朋友、同事与合作关系。',
  '官禄宫': '官禄宫用来观察工作方式与社会角色。',
  '田宅宫': '田宅宫用来观察居住环境与家庭资源。',
  '福德宫': '福德宫用来观察精神生活与休闲方式。',
  '父母宫': '父母宫用来观察与父母、长辈的关系。',
};

const majorStarsIn = (palace: Palace) => palace.stars.filter(star => star.type === 'major');

function palaceLabel(name: string): string {
  if (name === '仆役') return '交友宫';
  return name.endsWith('宫') ? name : `${name}宫`;
}

export default function ChartReading({ chart, selectedPalace }: { chart: ZiweiChart; selectedPalace?: Palace | null }) {
  const [topic, setTopic] = useState<ReadingTopic | null>(null);
  const activeTopic = topic ?? (selectedPalace ? null : READING_TOPICS[0]);
  const palace = activeTopic
    ? chart.palaces.find(p => palaceLabel(p.name) === palaceLabel(TOPIC_PALACE_NAME[activeTopic.key]))
    : selectedPalace;

  return (
    <aside aria-label="命盘解读" className="flex flex-col h-[min(44rem,80dvh)] min-h-0 min-w-0 rounded-xl overflow-hidden card-glass">
      <div className="flex-shrink-0 px-3 py-3" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <h2 className="text-sm font-medium" style={{ color: 'var(--t-gold)' }}>命盘解读</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--t-text2)' }}>在浏览器内根据本命盘生成。选择主题或点击宫位查看。</p>
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-1.5" role="group" aria-label="解读主题">
          {READING_TOPICS.map(item => (
            <button
              key={item.key}
              type="button"
              aria-pressed={activeTopic === item}
              onClick={() => setTopic(item)}
              className="rounded-md border px-1 py-2 text-xs"
              style={{
                borderColor: activeTopic === item ? 'var(--t-gold)' : 'var(--t-border)',
                color: activeTopic === item ? 'var(--t-gold)' : 'var(--t-text2)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div key={`${activeTopic?.key ?? 'palace'}-${palace?.branch}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {palace ? (
          <PalaceReading chart={chart} palace={palace} topic={activeTopic} />
        ) : (
          <p className="text-sm" style={{ color: 'var(--t-text2)' }}>命盘中没有这个宫位。</p>
        )}
      </div>
    </aside>
  );
}

function PalaceReading({ chart, palace, topic }: { chart: ZiweiChart; palace: Palace; topic: ReadingTopic | null }) {
  const name = palaceLabel(palace.name);
  const [, oppositeBranch, ...trineBranches] = getSanFangSiZheng(palace.branch);
  const opposite = chart.palaces.find(p => p.branch === oppositeBranch);
  const trines = chart.palaces.filter(p => trineBranches.includes(p.branch));
  const ownStars = majorStarsIn(palace);
  const borrowedPalace = ownStars.length === 0 ? opposite : undefined;
  const readingStars = borrowedPalace ? majorStarsIn(borrowedPalace) : ownStars;
  const transformations = palace.stars.filter(star => star.siHua);
  const currentDaXian = chart.daXians[chart.currentDaXianIndex];

  return (
    <div className="space-y-4 text-xs leading-relaxed" style={{ color: 'var(--t-text2)' }}>
      <div>
        <h3 className="text-base font-medium" style={{ color: 'var(--t-text)' }}>{topic?.title ?? `${name}解读`}</h3>
        <p className="mt-1">{name}在{STEMS[palace.stem]}{BRANCHES[palace.branch]}。{PALACE_THEMES[name]}</p>
        {topic?.key === 'overview' && (
          <p className="mt-1">{chart.wuxingJuName} · 身宫在{BRANCHES[chart.shenGongBranch]}</p>
        )}
      </div>

      <section>
        <h4 className="mb-1 font-medium" style={{ color: 'var(--t-gold)' }}>主星与星性</h4>
        {borrowedPalace && <p className="mb-1">本宫无主星，传统读法会参照对宫{palaceLabel(borrowedPalace.name)}的主星。</p>}
        {readingStars.length > 0 ? (
          <ul className="space-y-1">
            {readingStars.map(star => (
              <li key={star.name}>
                <strong style={{ color: 'var(--t-text)' }}>{star.name}</strong>
                {star.brightnessRaw && `（${star.brightnessRaw}）`}
                {STAR_DESCRIPTIONS[star.name] && ` · ${STAR_DESCRIPTIONS[star.name].keywords}`}
              </li>
            ))}
          </ul>
        ) : <p>没有可参照的主星，可合看下方的三方四正。</p>}
      </section>

      <section>
        <h4 className="mb-1 font-medium" style={{ color: 'var(--t-gold)' }}>生年四化</h4>
        <p>{transformations.length > 0
          ? transformations.map(star => `${star.name}化${star.siHua}`).join('、')
          : '本宫无生年四化星。'}</p>
      </section>

      <section>
        <h4 className="mb-1 font-medium" style={{ color: 'var(--t-gold)' }}>三方四正</h4>
        <ul className="space-y-1">
          {[...(opposite ? [opposite] : []), ...trines].map(related => (
            <li key={related.branch}>
              {related.branch === oppositeBranch ? '对宫' : '三合'} · {palaceLabel(related.name)} · {majorStarsIn(related).map(star => star.name).join('、') || '无主星'}
            </li>
          ))}
        </ul>
      </section>

      {topic?.key === 'overview' && currentDaXian && (
        <section>
          <h4 className="mb-1 font-medium" style={{ color: 'var(--t-gold)' }}>当前大限</h4>
          <p>{palaceLabel(currentDaXian.palaceName)} · {currentDaXian.startAge}–{currentDaXian.endAge} 虚岁</p>
        </section>
      )}
    </div>
  );
}
