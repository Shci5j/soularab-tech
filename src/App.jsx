import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');
const modules = [
  { id: 'overview', title: 'نظرة عامة', icon: '⌂', desc: 'مركز إدارة المنصة وحالة الخدمات' },
  { id: 'assistant', title: 'المساعد الذكي', icon: '✦', desc: 'محادثة مع النماذج المحلية والوكلاء' },
  { id: 'web', title: 'المواقع والمتاجر', icon: '▤', desc: 'إنشاء المواقع وإدارتها وفحصها' },
  { id: 'design', title: 'التصميم والهوية', icon: '◈', desc: 'الشعارات والهوية وتجارب المستخدم' },
  { id: 'media', title: 'الصور والفيديو', icon: '▧', desc: 'مسارات توليد الوسائط ومعالجتها' },
  { id: 'apps', title: 'بناء التطبيقات', icon: '▦', desc: 'تطوير التطبيقات وفحص المشاريع' },
  { id: 'files', title: 'الملفات والمشاريع', icon: '▱', desc: 'إدارة الملفات والنسخ والإصدارات' },
  { id: 'agents', title: 'الوكلاء والأتمتة', icon: '⌘', desc: 'مهام متعددة الخطوات بموافقات صريحة' },
  { id: 'domains', title: 'النطاقات والاستضافة', icon: '◎', desc: 'إعدادات النطاق والنشر والاستضافة' },
  { id: 'security', title: 'الأمان وسجل العمليات', icon: '⬡', desc: 'الموافقات وسجل التدقيق والإعدادات' },
];

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function App() {
  const [active, setActive] = useState('overview');
  const [api, setApi] = useState({ state: 'checking', version: '—' });
  const [approvals, setApprovals] = useState([]);
  const [events, setEvents] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('st-theme') || 'dark');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState({ title: '', description: '', risk: 'medium' });
  const [apiToken, setApiToken] = useState(() => sessionStorage.getItem('st-api-token') || '');
  const [authRequired, setAuthRequired] = useState(false);
  const [loginToken, setLoginToken] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState({ connected: false, loading: false });
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState({ title: '', description: '' });
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectFiles, setProjectFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('st-theme', theme);
  }, [theme]);

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}), ...options.headers },
    });
    if (!response.ok) {
      if (response.status === 401) setAuthRequired(true);
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `تعذر إكمال الطلب (${response.status})`);
    }
    return response.json();
  }

  function unlockWorkspace(event) {
    event.preventDefault();
    const value = loginToken.trim();
    if (!value) return;
    sessionStorage.setItem('st-api-token', value);
    setApiToken(value);
    setAuthRequired(false);
    setLoginToken('');
  }

  async function refresh() {
    try {
      const [health, pending, log] = await Promise.all([
        request('/api/health'), request('/api/approvals?status=pending'), request('/api/audit?limit=8'),
      ]);
      setApi({ state: 'online', version: health.version || '0.1.0', mode: health.mode || 'local' });
      setApprovals(pending.items || []);
      setEvents(log.items || []);
    } catch (error) {
      setApi({ state: 'offline', version: '—' });
      setNotice(error.message.includes('Failed to fetch') ? 'الخادم غير متصل حالياً. شغّل خدمة FastAPI لربط لوحة التحكم.' : error.message);
    }
  }

  useEffect(() => { refresh(); const id = window.setInterval(refresh, 15000); return () => clearInterval(id); }, [apiToken]);

  async function loadAssistant() {
    setAssistantStatus({ connected: false, loading: true });
    try {
      const [status, result] = await Promise.all([request('/api/assistant/status'), request('/api/assistant/models')]);
      setAssistantStatus({ connected: status.connected, loading: false, version: status.version });
      setModels(result.items || []);
      setSelectedModel((current) => current || result.items?.[0]?.name || '');
      if (!result.items?.length) setNotice('Ollama متصلة، لكن لا توجد نماذج مثبتة بعد.');
    } catch (error) {
      setAssistantStatus({ connected: false, loading: false });
      setModels([]);
      setNotice(error.message);
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !selectedModel || sendingChat) return;
    const next = [...chatMessages, { role: 'user', content }];
    setChatMessages(next);
    setChatInput('');
    setSendingChat(true);
    try {
      const result = await request('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ model: selectedModel, messages: next }) });
      setChatMessages([...next, result.message]);
    } catch (error) {
      setChatMessages([...next, { role: 'assistant', content: 'تعذر إكمال الطلب: ' + error.message }]);
    } finally {
      setSendingChat(false);
    }
  }

  useEffect(() => { if (active === 'assistant') loadAssistant(); }, [active, apiToken]);
  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const result = await request('/api/projects');
      setProjects(result.items || []);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    if (!projectForm.title.trim()) return;
    setBusy(true);
    try {
      await request('/api/projects', { method: 'POST', body: JSON.stringify(projectForm) });
      setProjectForm({ title: '', description: '' });
      setNotice('تم إنشاء مساحة المشروع ومجلدها المحلي.');
      await loadProjects();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveProject(id) {
    setBusy(true);
    try {
      await request('/api/projects/' + id + '/archive', { method: 'POST' });
      setNotice('تمت أرشفة المشروع دون حذف ملفاته.');
      await loadProjects();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (active === 'files') loadProjects(); }, [active, apiToken]);

  async function openProject(project) {
    setSelectedProject(project);
    try {
      const result = await request('/api/projects/' + project.id + '/files');
      setProjectFiles(result.items || []);
    } catch (error) { setNotice(error.message); }
  }

  async function uploadProjectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedProject) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice('حجم الملف يتجاوز الحد المسموح (10 ميغابايت).');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setUploadingFile(true);
    try {
      const response = await fetch(API + '/api/projects/' + selectedProject.id + '/files', {
        method: 'POST',
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || 'تعذر رفع الملف.');
      setNotice('تم رفع الملف بنجاح.');
      await openProject(selectedProject);
    } catch (error) { setNotice(error.message); }
    finally { setUploadingFile(false); }
  }

  async function downloadProjectFile(filename) {
    if (!selectedProject) return;
    try {
      const response = await fetch(API + '/api/projects/' + selectedProject.id + '/files/' + encodeURIComponent(filename), {
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || 'تعذر تنزيل الملف.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { setNotice(error.message); }
  }

  async function createProposal(event) {
    event.preventDefault();
    if (!proposal.title.trim() || !proposal.description.trim()) return;
    setBusy(true);
    try {
      await request('/api/approvals', { method: 'POST', body: JSON.stringify(proposal) });
      setProposal({ title: '', description: '', risk: 'medium' });
      setNotice('تم تسجيل طلب الموافقة. لم يُنفّذ أي إجراء.');
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function decide(id, decision) {
    setBusy(true);
    try {
      await request(`/api/approvals/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, note: 'قرار من لوحة التحكم' }) });
      setNotice(decision === 'approved' ? 'سُجلت الموافقة فقط؛ التنفيذ يحتاج خطوة مستقلة.' : 'تم رفض الطلب وتسجيل القرار.');
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  const current = useMemo(() => modules.find((item) => item.id === active), [active]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">ST</div><div><strong>SOULARAB TECH</strong><small>IDEAS INTO DIGITAL REALITY</small></div></div>
      <div className="side-caption">مساحة العمل</div>
      <nav aria-label="القائمة الرئيسية">{modules.map((item) => <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item.id)}><Icon>{item.icon}</Icon><span>{item.title}</span>{item.id === 'security' && approvals.length > 0 && <b className="nav-count">{approvals.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><span className={api.state === 'online' ? 'status-dot online' : 'status-dot'} />{api.state === 'online' ? 'الخادم متصل' : 'الخادم غير متصل'}<small>الإصدار {api.version}</small></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">SOULARAB TECH / WORKSPACE</p><h1>{current.title}</h1><p className="muted">{current.desc}</p></div><div className="top-actions"><button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="تبديل المظهر">{theme === 'dark' ? '☼' : '☾'}</button><button className="button secondary" onClick={refresh}>تحديث الحالة ↻</button></div></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="إغلاق">×</button></div>}

      {active === 'overview' && <section className="content">
        <div className="hero"><div><span className="pill">منصة مفتوحة المصدر · نواة أولية</span><h2>كل أدواتك الإبداعية<br/><em>في مساحة واحدة.</em></h2><p>بيئة عمل موحدة للمواقع والتصميم والوسائط والتطبيقات ووكلاء الذكاء الاصطناعي، مع تحكم واضح في الصلاحيات والبيانات.</p><button className="button primary" onClick={() => setActive('assistant')}>ابدأ من المساعد الذكي <span>←</span></button></div><div className="hero-orb"><div className="orb-ring ring-one"/><div className="orb-ring ring-two"/><div className="orb-core">ST</div></div></div>
        <div className="section-heading"><div><h3>مركز العمليات</h3><p>ملخص الاتصال والمهام التي تحتاج قرارك</p></div></div>
        <div className="stats-grid"><article className="stat-card"><span>حالة الخادم</span><strong className={api.state === 'online' ? 'good' : 'warn'}>{api.state === 'online' ? 'متصل' : 'غير متصل'}</strong><small>{api.mode || 'بانتظار تشغيل الخلفية'}</small></article><article className="stat-card"><span>طلبات الموافقة</span><strong>{approvals.length}</strong><small>تنتظر مراجعتك</small></article><article className="stat-card"><span>الأقسام</span><strong>10</strong><small>واجهة موحدة</small></article><article className="stat-card"><span>الاتصال الخارجي</span><strong className="good">مقيّد</strong><small>لا اتصال دون إعداد وموافقة</small></article></div>
        <div className="section-heading"><div><h3>مساحات العمل</h3><p>اختر المجال الذي تريد العمل عليه</p></div></div>
        <div className="module-grid">{modules.filter((m) => m.id !== 'overview').map((item) => <button className="module-card" key={item.id} onClick={() => setActive(item.id)}><Icon>{item.icon}</Icon><strong>{item.title}</strong><span>{item.desc}</span><b>فتح القسم ↗</b></button>)}</div>
        <div className="section-heading"><div><h3>آخر العمليات</h3><p>سجل قابل للمراجعة</p></div><button className="text-button" onClick={() => setActive('security')}>عرض الكل</button></div>
        <AuditList events={events}/>
      </section>}

      {active === 'files' && <section className="content">
        <div className="project-layout">
          <div className="panel-card">
            <h3>إنشاء مساحة مشروع</h3>
            <p className="muted">كل مشروع يحصل على سجل مستقل ومجلد محلي خاص به على جهاز الخادم.</p>
            <form className="proposal-form" onSubmit={createProject}>
              <label>اسم المشروع<input value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} required minLength="2" maxLength="100" placeholder="مثال: متجر إلكتروني"/></label>
              <label>وصف المشروع<textarea rows="3" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} maxLength="1000" placeholder="اكتب وصفاً مختصراً (اختياري)"/></label>
              <button className="button primary" disabled={busy || !projectForm.title.trim()}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء المشروع +'}</button>
            </form>
          </div>
          <div className="panel-card project-list-panel">
            <div className="section-heading"><div><h3>مشاريعي</h3><p>المشاريع النشطة والمؤرشفة</p></div><button className="button secondary" onClick={loadProjects}>تحديث ↻</button></div>
            {loadingProjects ? <Empty text="جارٍ تحميل المشاريع…"/> : projects.length ? <div className="project-list">
              {projects.map((project) => <article className="project-card" key={project.id}>
                <div className="project-card-top"><span className="project-symbol">▣</span><span className={project.status === 'active' ? 'project-status active' : 'project-status'}>{project.status === 'active' ? 'نشط' : 'مؤرشف'}</span></div>
                <strong>{project.title}</strong><p>{project.description || 'لا يوجد وصف لهذا المشروع.'}</p>
                <small>المشروع #{project.id} · {new Date(project.created_at).toLocaleDateString('ar')}</small>
                {project.status === 'active' && <div className="project-actions"><button className="text-button" onClick={() => openProject(project)}>إدارة الملفات</button><button className="text-button" disabled={busy} onClick={() => archiveProject(project.id)}>أرشفة</button></div>}
              </article>)}
            </div> : <Empty text="لا توجد مشاريع بعد. أنشئ أول مساحة عمل من النموذج."/>}
          </div>
        </div>
        {selectedProject && <div className="panel-card workspace-files">
          <div className="section-heading"><div><h3>ملفات: {selectedProject.title}</h3><p>إدارة الملفات داخل مساحة هذا المشروع فقط</p></div><button className="text-button" onClick={() => setSelectedProject(null)}>إغلاق</button></div>
          <label className="upload-control">رفع ملف (حد أقصى 10 MB)<input type="file" onChange={uploadProjectFile} disabled={uploadingFile || selectedProject.status === 'archived'} /></label>
          {uploadingFile && <p className="muted">جارٍ رفع الملف…</p>}
          {projectFiles.length ? <div className="workspace-file-list">{projectFiles.map((file) => <div className="workspace-file" key={file.name}><span>▤</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></div><button className="text-button" onClick={() => downloadProjectFile(file.name)}>تنزيل</button></div>)}</div> : <Empty text="لا توجد ملفات في مساحة هذا المشروع بعد."/>}
          <p className="chat-footnote">الملفات تبقى داخل مجلد المشروع على الخادم. الأنواع التنفيذية المحظورة لا يمكن رفعها.</p>
        </div>}
        <div className="panel-card workspace-note"><strong>حماية الملفات</strong><p>تُحصر عمليات الرفع والتنزيل داخل مجلد المشروع، ويُمنع استخدام المسارات للوصول إلى ملفات أخرى. الحد الأقصى للملف الواحد 10 ميغابايت.</p></div>
      </section>}

      {active === "assistant" && <section className="content">
        <div className="assistant-toolbar panel-card">
          <div><h3>المساعد المحلي</h3><p className="muted">تُرسل المحادثة إلى Ollama على الجهاز الذي يعمل عليه الخادم فقط.</p></div>
          <div className="assistant-controls"><span className={assistantStatus.connected ? "pill connected" : "pill"}>{assistantStatus.loading ? "جارٍ الفحص…" : assistantStatus.connected ? "Ollama متصلة" : "Ollama غير متصلة"}</span><button className="button secondary" onClick={loadAssistant}>فحص الاتصال</button></div>
        </div>
        <div className="chat-panel panel-card">
          <div className="chat-heading"><div><h3>محادثة جديدة</h3><small>المحادثة محفوظة مؤقتاً في هذه الصفحة فقط.</small></div>
            <select aria-label="اختر النموذج" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={!models.length}>
              {!models.length && <option value="">لا توجد نماذج متاحة</option>}
              {models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}
            </select>
          </div>
          <div className="chat-transcript" aria-live="polite">
            {!chatMessages.length && <div className="chat-empty"><span>✦</span><strong>ما الذي نعمل عليه اليوم؟</strong><p>اختر نموذجاً محلياً وابدأ محادثتك. لن يتم إرسال رسائلك إلى خدمة سحابية.</p></div>}
            {chatMessages.map((message, index) => <article key={index} className={"chat-message " + message.role}><small>{message.role === "user" ? "أنت" : "المساعد"}</small><p>{message.content}</p></article>)}
            {sendingChat && <div className="chat-thinking">النموذج يفكر…</div>}
          </div>
          <form className="chat-compose" onSubmit={sendChat}>
            <textarea rows="2" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={models.length ? "اكتب رسالتك هنا…" : "شغّل Ollama وثبّت نموذجاً محلياً أولاً"} disabled={!models.length || sendingChat} />
            <button className="button primary" disabled={!models.length || !chatInput.trim() || sendingChat}>{sendingChat ? "جارٍ الإرسال…" : "إرسال ↑"}</button>
          </form>
          <p className="chat-footnote">يلزم تثبيت Ollama والنموذج على جهاز الخادم. الهاتف واجهة تحكم ولا يشغّل النموذج الثقيل بنفسه.</p>
        </div>
      </section>}
      {active === 'security' && <section className="content two-col">
        <div className="panel-card"><div className="section-heading"><div><h3>طلبات الموافقة</h3><p>الموافقة لا تعني التنفيذ التلقائي</p></div><span className="pill">{approvals.length} معلّق</span></div>
          {approvals.length ? approvals.map((item) => <article className="approval" key={item.id}><div className="approval-top"><strong>{item.title}</strong><span className={`risk risk-${item.risk}`}>{item.risk === 'high' ? 'مرتفع' : item.risk === 'low' ? 'منخفض' : 'متوسط'}</span></div><p>{item.description}</p><small>{new Date(item.created_at).toLocaleString('ar')}</small><div className="approval-actions"><button className="button primary" disabled={busy} onClick={() => decide(item.id, 'approved')}>موافقة</button><button className="button danger" disabled={busy} onClick={() => decide(item.id, 'rejected')}>رفض</button></div></article>) : <Empty text="لا توجد طلبات معلّقة حالياً."/>}
        </div>
        <div className="panel-card"><h3>تسجيل طلب جديد</h3><p className="muted">سجّل الإجراء المقترح ليظهر في قائمة المراجعة. لا ينفذ النظام أي تغيير من هذه الخطوة.</p><form className="proposal-form" onSubmit={createProposal}><label>عنوان الإجراء<input value={proposal.title} onChange={(e) => setProposal({...proposal, title:e.target.value})} required maxLength="120" placeholder="مثال: ربط مزود نموذج محلي"/></label><label>التفاصيل<textarea value={proposal.description} onChange={(e) => setProposal({...proposal, description:e.target.value})} required rows="4" maxLength="2000" placeholder="ما الذي سيتغير؟ ولماذا؟"/></label><label>مستوى المخاطر<select value={proposal.risk} onChange={(e) => setProposal({...proposal, risk:e.target.value})}><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">مرتفع</option></select></label><button className="button primary" disabled={busy}>إرسال للمراجعة</button></form></div>
        <div className="panel-card"><h3>مفتاح الوصول المحلي</h3><p className="muted">أدخل رمز API الذي ضبطته في الخادم. يُحفظ في جلسة المتصفح الحالية فقط.</p><form onSubmit={(e) => {e.preventDefault();sessionStorage.setItem('st-api-token',apiToken);refresh();}}><label>رمز API<input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="اتركه فارغاً إذا لم تضبطه"/></label><button className="button secondary">حفظ للجلسة</button></form></div>
        <div className="panel-card"><h3>مبادئ الحماية</h3><ul className="safety-list"><li>لا اتصال بمزود خارجي افتراضياً.</li><li>لا تعديل أو حذف أو نشر دون موافقة منفصلة.</li><li>كل قرار يُسجل في سجل التدقيق.</li><li>لا توجد كلمات مرور تجريبية مضمنة في الواجهة.</li><li>المهام الخطرة تتطلب مراجعة بشرية.</li></ul></div>
      </section>}

      {active !== 'overview' && active !== 'security' && <section className="content"><div className="module-intro panel-card"><Icon>{current.icon}</Icon><h2>{current.title}</h2><p>{current.desc}</p><span className="pill">تم تجهيز نقطة التكامل ضمن النواة</span></div><div className="panel-card roadmap"><h3>حالة هذا القسم</h3><p>الواجهة الأساسية جاهزة، أما محرك التنفيذ وربط الأدوات فيُضافان كوحدات مستقلة بعد فحص الترخيص والموارد المطلوبة.</p><div className="roadmap-row"><span>واجهة المستخدم</span><b className="good">جاهزة</b></div><div className="roadmap-row"><span>واجهة API الخلفية</span><b className={api.state === 'online' ? 'good' : 'warn'}>{api.state === 'online' ? 'متصلة' : 'بانتظار التشغيل'}</b></div><div className="roadmap-row"><span>الموصلات والنماذج</span><b>غير مفعّلة افتراضياً</b></div><button className="button secondary" onClick={() => setActive('security')}>إدارة الموافقات والأمان</button></div></section>}
    </main>
      {authRequired && <div className="auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <form className="auth-card" onSubmit={unlockWorkspace}>
          <div className="brand-mark auth-mark">ST</div>
          <p className="eyebrow">SOULARAB TECH / SECURE ACCESS</p>
          <h2 id="auth-title">مساحة العمل محمية</h2>
          <p>أدخل رمز الوصول الذي ضبطته في ملف إعدادات الخادم لفتح لوحة التحكم. يُحفظ الرمز في جلسة المتصفح الحالية فقط.</p>
          <label>رمز الوصول<input type="password" value={loginToken} onChange={(e) => setLoginToken(e.target.value)} autoComplete="current-password" required placeholder="أدخل رمز API"/></label>
          <button className="button primary" disabled={!loginToken.trim()}>فتح مساحة العمل</button>
        </form>
      </div>}
  </div>;
}

function Empty({text}) { return <div className="empty">{text}</div>; }
function AuditList({events}) { return events.length ? <div className="audit-list">{events.map((event) => <div className="audit-row" key={event.id}><span className="audit-mark">•</span><div><strong>{event.action}</strong><small>{event.details}</small></div><time>{new Date(event.created_at).toLocaleString('ar')}</time></div>)}</div> : <Empty text="لا توجد عمليات مسجلة بعد."/>; }
