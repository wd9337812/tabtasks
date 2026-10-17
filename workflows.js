/* Local workflow records. All writes run through the background's serialized queue. */
const TaskFlows = (() => {
  const builtins = new Set(['inbox', 'today']);
  function template(x) {
    const base = Data.list(x);
    if (!Array.isArray(x.items) || !x.items.length || x.items.length > 200) Data.fail('invalid', 'flowInvalid');
    const items = x.items.map(item => {
      if (!Data.object(item) || typeof item.title !== 'string' || !item.title.trim()) Data.fail('invalid', 'flowInvalid');
      const offsetDays = item.offsetDays == null ? null : Number(item.offsetDays);
      if (offsetDays !== null && (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > 3650)) Data.fail('invalid', 'flowInvalid');
      if (item.url && !Data.http(item.url)) Data.fail('invalid', 'flowInvalid');
      if (item.subtasks !== undefined && (!Array.isArray(item.subtasks) || item.subtasks.some(v => typeof v !== 'string'))) Data.fail('invalid', 'flowInvalid');
      return { title: item.title.trim().slice(0, 140), note: Data.text(item.note), url: item.url || '', tags: Data.tags(item.tags),
        listId: Data.validId(item.listId) ? item.listId : 'inbox', offsetDays, subtasks: (item.subtasks || []).map(v => v.trim().slice(0, 140)).filter(Boolean).slice(0, 100) };
    });
    return { id: base.id, name: base.name, items };
  }
  function view(x) {
    const base = Data.list(x), f = x.filters || {};
    if (!Data.object(f) || !['any', 'active', 'done'].includes(f.status || 'active') || !['any', 'today', 'overdue', 'week', 'none'].includes(f.due || 'any')) Data.fail('invalid', 'flowInvalid');
    return { id: base.id, name: base.name, filters: { status: f.status || 'active', due: f.due || 'any',
      listId: Data.text(f.listId, 120), tag: Data.text(f.tag, 80).trim(), domain: Data.text(f.domain, 253).trim().toLowerCase(), query: Data.text(f.query, 200) },
      groupBy: ['none', 'due', 'list', 'domain'].includes(x.groupBy) ? x.groupBy : 'none', sort: x.sort === 'title' ? 'title' : 'due', pinned: !!x.pinned };
  }
  function prompt(x) { const base = Data.list(x); if (typeof x.text !== 'string' || !x.text.trim()) Data.fail('invalid', 'flowInvalid'); return { id: base.id, name: base.name, text: x.text.slice(0, 4000) }; }
  function load(raw = {}, strict = false) {
    if (!Data.object(raw)) { if (strict) Data.fail('invalid', 'flowInvalid'); return { templates: [], views: [], prompts: [], invalid: true }; }
    const result = {}, invalid = [];
    for (const [key, normal] of [['templates', template], ['views', view], ['prompts', prompt]]) {
      const records = Data.records(raw[key] ?? [], normal, strict); result[key] = records.values; invalid.push(records.invalid);
    }
    return { ...result, invalid: invalid.some(Boolean) };
  }
  const data = s => ({ templates: s.flows.templates, views: s.flows.views, prompts: s.flows.prompts });
  const content = s => ({ tasks: s.tasks, lists: s.lists, pending:s.pending, flows: data(s) });
  const signature = s => Data.fingerprint(content(s));
  const undoContent=s=>({tasks:s.tasks,lists:s.lists,pending:s.pending,...data(s)});
  function undo(s,before){const restored=Data.applyUndo(undoContent(s),before);s.tasks=Data.records(restored.tasks,Data.task,true).values;s.lists=Data.records(restored.lists,Data.list,true).values;s.flows=load(restored,true);s.pending=restored.pending;}
  function merge(s, raw) {
    if (raw === undefined) return;
    const incoming = load(raw, true);
    for (const key of ['templates', 'views', 'prompts']) { const ids = new Set(s.flows[key].map(x => x.id)); s.flows[key].push(...incoming[key].filter(x => !ids.has(x.id))); }
  }
  function shift(date, days) {
    Data.date(date); if (!date) Data.fail('invalid', 'flowInvalid');
    const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + days); return Data.date(value.toISOString().slice(0, 10));
  }
  function preview(s, p) {
    const tpl = s.flows.templates.find(x => x.id === p.id); if (!tpl) Data.fail('missing', 'flowMissing');
    const runs = p.runs || [{ start: p.start, project: p.project || '' }];
    if (!Array.isArray(runs) || !runs.length || runs.length > 20) Data.fail('invalid', 'flowInvalid');
    const tasks = [];
    for (const run of runs) {
      if (!Data.object(run)) Data.fail('invalid', 'flowInvalid'); Data.date(run.start); if (!run.start) Data.fail('invalid', 'flowInvalid');
      const replace = text => text.replaceAll('{project}', Data.text(run.project, 80));
      for (const item of tpl.items) {
        if (!s.lists.some(list => list.id === item.listId)) Data.fail('missing', 'flowListMissing');
        tasks.push({ ...item, title: replace(item.title), note: replace(item.note), subtasks: item.subtasks.map(replace), due: item.offsetDays === null ? '' : shift(run.start, item.offsetDays) });
      }
    }
    if (tasks.length > 500) Data.fail('invalid', 'flowTooLarge');
    return { tasks, revision: JSON.stringify(tpl), proRequired: runs.length > 1 || new Set(tpl.items.map(x => x.listId)).size > 1 || tpl.items.some(x => [x.title, x.note, ...x.subtasks].some(v => v.includes('{project}'))) };
  }
  function handle(s, op, p) {
    if (op === 'TEMPLATE_PREVIEW') return { changed: false, ...preview(s, p) };
    if (op === 'TEMPLATE_RUN') {
      const result = preview(s, p);
      if (p.revision !== result.revision) Data.fail('stale', 'flowStale');
      if (result.proRequired && s.plan !== 'pro') Data.fail('pro', 'flowPro');
      const indices = p.indices ?? result.tasks.map((_, i) => i);
      if (!Array.isArray(indices) || !indices.length || new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || !result.tasks[i])) Data.fail('invalid', 'invalidSelection');
      if (s.tasks.filter(x => !x.done).length + indices.length > capsFor(s).maxActiveTasks) Data.fail('limit', 'flowTaskLimit');
      for (const index of indices) { const item = result.tasks[index]; addTask(s, { ...item, subtasks: item.subtasks.map(title => ({ id: Data.id(), title, done: false })), source: 'template' }); }
      return { changed: true, created: indices.length };
    }
    const kind = op.startsWith('TEMPLATE_') ? 'templates' : op.startsWith('VIEW_') ? 'views' : 'prompts';
    const normal = { templates: template, views: view, prompts: prompt }[kind];
    if (op.endsWith('_DELETE')) { s.flows[kind] = s.flows[kind].filter(x => x.id !== p.id); return { changed: true }; }
    const id = p.id || Data.id(), old = s.flows[kind].find(x => x.id === id);
    if (!old && s.plan !== 'pro' && (kind === 'prompts' || s.flows[kind].length >= 1)) Data.fail('pro', 'flowPro');
    const clean = normal({ ...old, ...p, id });
    if (kind === 'views' && s.plan !== 'pro' && (clean.groupBy !== 'none' || clean.pinned)) Data.fail('pro', 'flowPro');
    if (old) Object.assign(old, clean); else s.flows[kind].push(clean);
    return { changed: true, record: clean };
  }
  return { undoContent, undo, builtins, load, data, merge, content, signature, shift, preview, handle };
})();
