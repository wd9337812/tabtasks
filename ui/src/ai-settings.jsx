import React, { useEffect, useState, useRef } from 'react';
import { Button } from './shared';
import { aiProviders, normalizeAiConfig, readAiConfig, requestAiPermission, requestAi } from './ai-client';

export function AiSettings({ ws }) {
  const [config, setConfig] = useState({ ...aiProviders.openai, provider: 'openai', key: '' });
  const [working, setWorking] = useState(false), [status, setStatus] = useState('');
  const controller = useRef(null), revision = useRef(0);
  useEffect(() => { let alive = true; readAiConfig().then(value => { if (alive) setConfig(value); }).catch(() => {}); return () => { alive = false; controller.current?.abort(); }; }, []);
  const edit = patch => { revision.current++; controller.current?.abort(); setConfig(value => ({ ...value, ...patch })); setStatus(''); };
  const test = async () => {
    if (working) return;
    let clean; try { clean = normalizeAiConfig(config); } catch (error) { return setStatus(ws.t(error.message)); }
    const permission = requestAiPermission(clean), current = revision.current;
    setWorking(true); setStatus(ws.t('aiTesting')); controller.current = new AbortController();
    try {
      if (!await permission) throw new Error('aiPermission');
      await requestAi(clean, 'Reply briefly to confirm the connection.', 'Reply OK.', { test: true, signal: controller.current.signal });
      if (revision.current === current) setStatus(ws.t('aiConnected'));
    } catch (error) { if (revision.current === current) setStatus(ws.t(error.message)); }
    finally { setWorking(false); controller.current = null; }
  };
  const save = async () => { try { const clean = normalizeAiConfig(config); await chrome.storage.local.set({ aiConfig: clean }); await chrome.storage.local.remove(['aiKey', 'aiModel']); ws.notify(ws.t('aiSaved')); } catch (error) { ws.notify(ws.t(error.message === 'aiInvalidUrl' || error.message === 'aiInvalidModel' ? error.message : 'saveFailed')); } };
  return <div className="settings-section"><h4>{ws.t('aiConfig')}</h4><p className="settings-note">{ws.t('aiSetupDesc')}</p>
    <label className="form-label">{ws.t('aiProvider')}<select id="aiProvider" value={config.provider} onChange={event => { const provider = event.target.value; edit({ ...aiProviders[provider], provider, key: '' }); }}>{Object.entries(aiProviders).map(([id, provider]) => <option key={id} value={id}>{id === 'custom' ? ws.t('aiCustom') : provider.name}</option>)}</select></label>
    <label className="form-label">{ws.t('aiProtocol')}<select id="aiProtocol" value={config.protocol} onChange={event => edit({ protocol: event.target.value })}><option value="openai">OpenAI compatible</option><option value="anthropic">Anthropic Messages</option></select></label>
    <label className="form-label">{ws.t('aiBaseUrl')}<input id="aiBaseUrl" type="url" value={config.baseUrl} onChange={event => edit({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" autoComplete="off" spellCheck="false" /></label>
    <label className="form-label">{ws.t('aiKey')}<input id="aiKey" type="password" value={config.key} onChange={event => edit({ key: event.target.value })} autoComplete="off" spellCheck="false" /></label>
    <label className="form-label">{ws.t('aiModel')}<input id="aiModel" value={config.model} onChange={event => edit({ model: event.target.value })} /></label>
    <div className="setting-data-actions"><Button id="btnAiTest" variant="outline" disabled={working} onClick={test}>{ws.t(working ? 'aiTesting' : 'aiTest')}</Button><Button id="btnAiSave" variant="outline" disabled={working} onClick={save}>{ws.t('aiSave')}</Button></div>
    {status && <p className="settings-note" role="status">{status}</p>}<p className="settings-note">{ws.t('aiKeyNote')}</p>
  </div>;
}
