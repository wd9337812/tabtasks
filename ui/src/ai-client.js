export const aiProviders = {
  openai: { name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  anthropic: { name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5' },
  deepseek: { name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
  custom: { name: 'Custom', protocol: 'openai', baseUrl: '', model: '' }
};

export function normalizeAiConfig(input = {}) {
  const provider = Object.hasOwn(aiProviders, input.provider) ? input.provider : 'openai';
  const preset = aiProviders[provider];
  const protocol = input.protocol || preset.protocol;
  if (!['openai', 'anthropic'].includes(protocol)) throw new Error('aiInvalidConfig');
  let url;
  try { url = new URL(String(input.baseUrl ?? preset.baseUrl).trim()); } catch { throw new Error('aiInvalidUrl'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || url.protocol === 'http:' && loopback) || url.username || url.password || url.search || url.hash) throw new Error('aiInvalidUrl');
  const model = String(input.model ?? preset.model).trim();
  if (!model || model.length > 200) throw new Error('aiInvalidModel');
  const key = String(input.key || '').trim();
  if (key.length > 4096 || /[\r\n]/.test(key)) throw new Error('aiInvalidConfig');
  return { provider, protocol, baseUrl: url.href.replace(/\/$/, ''), model, key };
}

export async function readAiConfig() {
  const data = await chrome.storage.local.get(['aiConfig', 'aiKey', 'aiModel']);
  return normalizeAiConfig(data.aiConfig || { key: data.aiKey || '', model: data.aiModel || aiProviders.openai.model });
}

export function requestAiPermission(config) {
  return chrome.permissions.request({ origins: [new URL(config.baseUrl).origin + '/*'] });
}

export function aiRequest(config, system, prompt, test = false) {
  const suffix = config.protocol === 'anthropic' ? '/messages' : '/chat/completions';
  const endpoint = config.baseUrl.endsWith(suffix) ? config.baseUrl : config.baseUrl + suffix;
  const headers = { 'Content-Type': 'application/json' };
  let body;
  if (config.protocol === 'anthropic') {
    if (config.key) headers['x-api-key'] = config.key;
    headers['anthropic-version'] = '2023-06-01';
    body = { model: config.model, max_tokens: test ? 64 : 8192, system, messages: [{ role: 'user', content: prompt }] };
  } else {
    if (config.key) headers.Authorization = 'Bearer ' + config.key;
    // Plain JSON instructions work on gateways that do not support response_format or tools.
    body = { model: config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
  }
  return { endpoint, headers, body };
}

export function aiResponseText(data, protocol) {
  if (protocol === 'anthropic') {
    if (['max_tokens', 'refusal', 'pause_turn'].includes(data.stop_reason)) throw new Error(data.stop_reason === 'refusal' ? 'aiRefused' : 'aiIncomplete');
    const text = data.content?.filter(block => block.type === 'text').map(block => block.text).join('');
    if (!text) throw new Error('aiFailed');
    return text;
  }
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error('aiRefused');
  if (['length', 'content_filter'].includes(choice?.finish_reason)) throw new Error('aiIncomplete');
  if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('aiFailed');
  return choice.message.content;
}

export async function requestAi(config, system, prompt, { signal, test = false } = {}) {
  if (!config.key && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.baseUrl).hostname)) throw new Error('aiNoKey');
  const request = aiRequest(config, system, prompt, test), controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 45000);
  try {
    const response = await fetch(request.endpoint, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal: controller.signal, redirect: 'error', credentials: 'omit' });
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? 'aiInvalidKey' : response.status === 404 ? 'aiModelUnavailable' : response.status === 429 ? 'aiRateLimit' : 'aiServiceError';
      throw new Error(code);
    }
    return aiResponseText(await response.json(), config.protocol);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('aiTimeout');
    if (error instanceof TypeError) throw new Error('aiNetwork');
    if (error instanceof SyntaxError) throw new Error('aiFailed');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
