import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const systemPrompt = [
  '你是紫微斗數學習助理。使用繁體中文，以清楚、簡潔的語言回答使用者的問題。',
  '依據提供的命盤摘要和近期對話，點出支持解讀的宮位、星曜或四化。缺少資料時明說，勿捏造盤面、古籍引文或精確時間。',
  '最後一則使用者訊息包含 JSON，其中 chart 是命盤資料，question 是本輪問題。把斗數解讀說成傳統觀點或反思方向，避免斷言未來，勿把它當成醫療、法律、財務決策的依據。',
  '回答以純文字為主，每次以 600 字內為原則。',
].join('\n');

const maxBody = 80 * 1024;
const maxRequests = 10;
const minute = 60_000;
const modelErrorStatus = { 429: 503, 503: 503, 504: 504 };
const provider = process.env.AI_PROVIDER || 'deepseek';
const providerConfig = {
  deepseek: {
    key: process.env.DEEPSEEK_API_KEY,
    url: 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
    options: { thinking: { type: 'disabled' } },
  },
  mimo: {
    key: process.env.MIMO_API_KEY,
    url: process.env.MIMO_BASE_URL,
    model: process.env.MIMO_MODEL,
  },
  compatible: {
    key: process.env.AI_API_KEY,
    url: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
  },
}[provider];

const accessToken = process.env.INTERPRET_ACCESS_TOKEN?.trim();
if (!accessToken || !/^[!-~]{24,256}$/.test(accessToken)) {
  throw new Error('Set INTERPRET_ACCESS_TOKEN to 24–256 printable, non-space ASCII characters.');
}
if (!providerConfig?.key || !providerConfig.url || !providerConfig.model) {
  throw new Error('Set the server-side API key, URL and model for the selected AI_PROVIDER.');
}

const upstream = new URL(providerConfig.url);
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname);
if (upstream.protocol !== 'https:' && !(upstream.protocol === 'http:' && loopback)) {
  throw new Error('The model URL must use HTTPS or local loopback HTTP.');
}
if (upstream.username || upstream.password || upstream.search || upstream.hash) {
  throw new Error('Use a model base URL without credentials, a query or a fragment.');
}
upstream.pathname = `${upstream.pathname.replace(/\/+$/, '')}/chat/completions`;

const allowedOrigins = new Set((process.env.INTERPRET_ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(origin => new URL(origin.trim()).origin));
const digest = value => createHash('sha256').update(value).digest();
const expectedAuthorization = digest(`Bearer ${accessToken}`);
let windowStarted = 0;
let requestCount = 0;

function reply(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBody) {
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validPayload(payload) {
  if (!payload || typeof payload.chart !== 'string' || !payload.chart.trim() || payload.chart.length > 5000) return false;
  const { messages } = payload;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 9 || messages.length % 2 === 0) return false;
  return messages.every((message, index) => {
    const role = index % 2 === 0 ? 'user' : 'assistant';
    return message?.role === role && typeof message.content === 'string' && message.content.trim()
      && message.content.length <= (role === 'user' ? 1000 : 2000);
  });
}

const server = createServer({ requestTimeout: 15_000 }, async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Origin');
  if (request.url !== '/api/interpret') return reply(response, 404, { error: 'not_found' });

  const { origin, authorization } = request.headers;
  if (origin && !allowedOrigins.has(origin)) return reply(response, 403, { error: 'origin_not_allowed' });
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    });
    response.end();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    return reply(response, 405, { error: 'method_not_allowed' });
  }
  if (!authorization || !timingSafeEqual(digest(authorization), expectedAuthorization)) {
    return reply(response, 401, { error: 'invalid_access_token' });
  }
  const contentType = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') return reply(response, 400, { error: 'invalid_request' });
  if (Number(request.headers['content-length']) > maxBody) return reply(response, 413, { error: 'request_too_large' });

  let payload;
  try {
    payload = await readBody(request);
  } catch {
    return reply(response, 400, { error: 'invalid_request' });
  }
  if (!validPayload(payload)) return reply(response, 400, { error: 'invalid_request' });

  const now = Date.now();
  if (now - windowStarted >= minute) {
    windowStarted = now;
    requestCount = 0;
  }
  if (requestCount >= maxRequests) {
    response.setHeader('Retry-After', Math.ceil((windowStarted + minute - now) / 1000));
    return reply(response, 429, { error: 'request_limit' });
  }
  requestCount++;

  const deadline = AbortSignal.timeout(35_000);
  const disconnect = new AbortController();
  response.once('close', () => disconnect.abort());
  const history = payload.messages.slice(0, -1).map(({ role, content }) => ({ role, content }));
  const question = payload.messages.at(-1).content;
  try {
    const modelResponse = await fetch(upstream, {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerConfig.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: providerConfig.model,
        stream: false,
        max_tokens: 900,
        ...providerConfig.options,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: JSON.stringify({ chart: payload.chart, question }) },
        ],
      }),
      signal: AbortSignal.any([deadline, disconnect.signal]),
      redirect: 'error',
    });
    if (!modelResponse.ok) {
      await modelResponse.body?.cancel();
      return reply(response, modelErrorStatus[modelResponse.status] ?? 502, { error: 'model_unavailable' });
    }
    const result = await modelResponse.json();
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) return reply(response, 502, { error: 'empty_answer' });
    reply(response, 200, { answer: answer.trim().slice(0, 2000) });
  } catch {
    if (!response.destroyed) reply(response, deadline.aborted ? 504 : 502, { error: 'model_unavailable' });
  }
});

const port = Number(process.env.INTERPRET_PORT || 8787);
const host = process.env.INTERPRET_HOST || '127.0.0.1';
server.listen(port, host, () => console.log(`Interpretation service listening on ${host}:${port}`));
