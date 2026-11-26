'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buildChartQuestionContext } from '@/lib/ziwei/chart-question-context';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

type Message = { role: 'user' | 'assistant'; content: string };

const errors: Record<number, string> = {
  400: '無法送出這個問題。請縮短問題後重試。',
  401: '追問通行碼不正確，請更正後再送出。',
  413: '問題或對話長度超過服務上限，你的問題已保留。',
  429: '追問次數暫時達到上限，請稍後再試。',
  502: '模型服務目前無法回答，請稍後再試。',
  503: '模型服務暫時無法使用，請稍後再試。',
  504: '模型回答逾時，你的問題已保留，可以再送出一次。',
};

export default function ChartQuestions({ endpoint, chart, selectedPalace }: {
  endpoint?: string;
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
}) {
  const [token, setToken] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const latestAnswer = useRef<HTMLDivElement>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (messages.length) latestAnswer.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!endpoint || !token.trim() || !content || request.current) return;

    let apiUrl: URL;
    try {
      apiUrl = new URL(endpoint, window.location.origin);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname);
      if (apiUrl.username || apiUrl.password || (apiUrl.protocol !== 'https:' && !(local && apiUrl.protocol === 'http:'))) {
        throw new Error('Invalid API URL');
      }
    } catch {
      setError('追問服務網址設定有誤。');
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    const deadline = AbortSignal.timeout(45_000);
    setPending(true);
    setError('');
    const userMessage: Message = { role: 'user', content };
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({ chart: buildChartQuestionContext(chart, selectedPalace), messages: [...messages.slice(-8), userMessage] }),
        signal: AbortSignal.any([controller.signal, deadline]),
        redirect: 'error',
      });
      if (!response.ok) {
        setError(errors[response.status] ?? '目前無法送達模型服務，你的問題已保留。');
        return;
      }
      const { answer } = await response.json();
      if (typeof answer !== 'string' || !answer.trim()) {
        setError('模型沒有傳回答覆，你的問題已保留。');
        return;
      }
      setMessages(previous => [...previous, userMessage, { role: 'assistant', content: answer }]);
      setQuestion('');
    } catch {
      if (!controller.signal.aborted) {
        setError(deadline.aborted ? errors[504] : '連線失敗，你的問題已保留。');
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <section className="card-glass rounded-xl p-4" aria-label="AI 自由追問">
      <h2 className="text-sm font-medium" style={{ color: 'var(--t-gold)' }}>AI 自由追問</h2>
      {endpoint ? (
        <>
          <p className="mt-1 text-xs" style={{ color: 'var(--t-text2)' }}>送出後，模型會根據命盤摘要及最近四輪對話回答。請避免在問題中填寫個人資料。</p>
          {messages.length > 0 && (
            <div className="mt-3 max-h-[24rem] space-y-3 overflow-y-auto" role="log" aria-label="追問記錄">
              {messages.map((message, index) => (
                <div key={index} className="whitespace-pre-wrap break-words rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--t-border)', color: 'var(--t-text)' }}>
                  <strong className="mb-1 block" style={{ color: 'var(--t-gold)' }}>{message.role === 'user' ? '你' : 'AI'}</strong>
                  {message.content}
                </div>
              ))}
              <div ref={latestAnswer} />
            </div>
          )}
          <form className="mt-3 space-y-2 text-xs" onSubmit={submit}>
            <label className="block">
              追問通行碼
              <input type="password" autoComplete="off" required maxLength={256} value={token} onChange={event => setToken(event.target.value)} disabled={pending}
                className="mt-1 block w-full rounded-md border px-2 py-1.5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }} />
            </label>
            <label className="block">
              你的問題
              <textarea required rows={3} maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)} disabled={pending}
                className="mt-1 block w-full rounded-md border px-2 py-1.5" style={{ background: 'var(--t-card)', borderColor: 'var(--t-border)' }} />
            </label>
            {error && <p role="alert">{error}</p>}
            {pending && <p role="status">模型正在回答…</p>}
            <button type="submit" disabled={pending || !question.trim() || !token.trim()}
              className="rounded-md border px-3 py-1.5 disabled:opacity-40" style={{ color: 'var(--t-gold)', borderColor: 'var(--t-gold)' }}>
              送出問題
            </button>
          </form>
        </>
      ) : (
        <p className="mt-1 text-xs" style={{ color: 'var(--t-text2)' }}>此站尚未接上模型服務。</p>
      )}
    </section>
  );
}
