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

const englishModules = { overview: ['Overview', 'Workspace overview and service status'], assistant: ['AI Assistant', 'Chat with local models and agents'], web: ['Websites & Stores', 'Create, manage, and inspect websites'], design: ['Design & Identity', 'Logos, brand identity, and user experience'], media: ['Images & Video', 'Media generation and processing'], apps: ['App Builder', 'Develop and inspect applications'], files: ['Files & Projects', 'Manage project files and versions'], agents: ['Agents & Automation', 'Multi-step tasks with explicit approvals'], domains: ['Domains & Hosting', 'Domain, deployment, and hosting settings'], security: ['Security & Audit', 'Approvals, audit history, and controls'] };

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('st-language') || 'ar');
  const [active, setActiveState] = useState('overview');
  function setActive(next) {
    if (next === active) return;
    window.history.pushState({ soularabPage: next }, '', window.location.pathname + window.location.search);
    setActiveState(next);
  }
  useEffect(() => {
    window.history.replaceState({ soularabPage: 'overview', soularabRoot: true }, '', window.location.pathname + window.location.search);
    window.history.pushState({ soularabPage: 'overview', soularabRoot: true }, '', window.location.pathname + window.location.search);
    const handleBack = (event) => {
      if (event.state?.soularabRoot) {
        setActiveState('overview');
        window.history.pushState({ soularabPage: 'overview', soularabRoot: true }, '', window.location.pathname + window.location.search);
      } else if (event.state?.soularabPage) setActiveState(event.state.soularabPage);
      else {
        setActiveState('overview');
        window.history.pushState({ soularabPage: 'overview', soularabRoot: true }, '', window.location.pathname + window.location.search);
      }
    };
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);
  const [api, setApi] = useState({ state: 'checking', version: '—' });
  const [approvals, setApprovals] = useState([]);
  const [events, setEvents] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('st-theme') || 'dark');
  const [preferences, setPreferences] = useState(() => {
    try { return { font: 'ibm', fontScale: 100, density: 'comfortable', reducedMotion: false, ...JSON.parse(localStorage.getItem('st-preferences') || '{}') }; }
    catch { return { font: 'ibm', fontScale: 100, density: 'comfortable', reducedMotion: false }; }
  });
  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }
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
  const [repoInput, setRepoInput] = useState('Shci5j/soularab-tech');
  const [repoInfo, setRepoInfo] = useState(null);
  const [repoFiles, setRepoFiles] = useState([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [vaultItems, setVaultItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('st-vault') || '[]'); } catch { return []; }
  });
  const [vaultDraft, setVaultDraft] = useState({ title: '', content: '', category: 'note' });
  const [moduleDraft, setModuleDraft] = useState({ title: '', details: '' });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('st-language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('st-vault', JSON.stringify(vaultItems));
  }, [vaultItems]);

  function saveVaultItem(event) {
    event.preventDefault();
    if (!vaultDraft.title.trim() || !vaultDraft.content.trim()) return;
    setVaultItems((items) => [{ id: Date.now(), ...vaultDraft, createdAt: new Date().toISOString() }, ...items]);
    setVaultDraft({ title: '', content: '', category: 'note' });
    setNotice('تم حفظ العنصر في الخزنة المحلية على هذا الجهاز.');
  }

  function exportVault() {
    const blob = new Blob([JSON.stringify(vaultItems, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'soularab-vault-backup.json'; link.click();
    URL.revokeObjectURL(url);
  }

  async function importVault(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item.title !== 'string' || typeof item.content !== 'string')) {
        throw new Error('صيغة النسخة الاحتياطية غير صالحة.');
      }
      setVaultItems(parsed.map((item, index) => ({ id: item.id || Date.now() + index, title: item.title, content: item.content, category: item.category || 'note', createdAt: item.createdAt || new Date().toISOString() })));
      setNotice('تم استيراد عناصر الخزنة بنجاح.');
    } catch (error) { setNotice(error.message || 'تعذر قراءة ملف النسخة الاحتياطية.'); }
  }

  useEffect(() => {
    const fonts = { ibm: "'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif", system: "system-ui, sans-serif", tahoma: "Tahoma, Arial, sans-serif", georgia: "Georgia, serif" };
    document.documentElement.style.fontFamily = fonts[preferences.font] || fonts.ibm;
    document.body.style.zoom = String(preferences.fontScale / 100);
    document.documentElement.dataset.density = preferences.density;
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
    localStorage.setItem('st-preferences', JSON.stringify(preferences));
  }, [preferences]);

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

  async function loadGithubRepository(event) {
    event?.preventDefault();
    let target = repoInput.trim();
    if (target.includes('github.com/')) target = target.split('github.com/').pop();
    if (target.endsWith('.git')) target = target.slice(0, -4);
    if (target.endsWith('/')) target = target.slice(0, -1);
    const parts = target.split('/');
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))) { setRepoError('أدخل المستودع بصيغة owner/repository.'); return; }
    setRepoLoading(true); setRepoError('');
    try {
      const [details, contents] = await Promise.all([fetch('https://api.github.com/repos/' + target), fetch('https://api.github.com/repos/' + target + '/contents')]);
      if (!details.ok) throw new Error(details.status === 404 ? 'المستودع غير موجود أو غير متاح للعامة.' : 'تعذر قراءة بيانات المستودع (' + details.status + ').');
      if (!contents.ok) throw new Error('تعذر قراءة الملفات (' + contents.status + ').');
      setRepoInfo(await details.json());
      const items = await contents.json(); setRepoFiles(Array.isArray(items) ? items : []);
    } catch (error) { setRepoInfo(null); setRepoFiles([]); setRepoError(error.message || 'تعذر الاتصال بـ GitHub.'); }
    finally { setRepoLoading(false); }
  }

  function inspectDevice() {
    setDeviceInfo({
      browser: navigator.userAgent, language: navigator.language, platform: navigator.platform || 'غير متاح',
      online: navigator.onLine, screen: window.screen.width + ' × ' + window.screen.height,
      viewport: window.innerWidth + ' × ' + window.innerHeight, memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'غير متاح',
      cores: navigator.hardwareConcurrency || 'غير متاح', touch: navigator.maxTouchPoints > 0 ? 'مدعوم' : 'غير مكتشف',
      storage: navigator.storage?.estimate ? 'مدعوم' : 'غير متاح', checkedAt: new Date().toLocaleString('ar')
    });
  }

  const pageTitles = language === 'ar' ? {
    overview: { title: 'الرئيسية', desc: 'مساحة سولاراب الموحدة' },
    work: { title: 'الشروع بالعمل', desc: 'الأقسام المتخصصة وأدوات التنفيذ' },
    hub: { title: 'سولاراب هوب', desc: 'إدارة المستودعات والأكواد والإصدارات' },
    root: { title: 'الجذر', desc: 'إدارة الأجهزة والتشخيص والصيانة' },
    settings: { title: 'الإعدادات العامة', desc: 'إعدادات المنصة والاتصال والمظهر' },
    vault: { title: 'الخزنة', desc: 'الأعمال المحفوظة والمؤجلة والبيانات المؤقتة' },
  } : {
    overview: { title: 'Home', desc: 'The unified Soularab workspace' },
    work: { title: 'Get to work', desc: 'Specialized departments and execution tools' },
    hub: { title: 'Soularab Hub', desc: 'Repositories, code, and releases' },
    root: { title: 'Root', desc: 'Devices, diagnostics, and maintenance' },
    settings: { title: 'General settings', desc: 'Workspace, connection, and appearance' },
    vault: { title: 'Vault', desc: 'Saved work, deferred tasks, and temporary data' },
  };
  const current = useMemo(() => { if (pageTitles[active]) return pageTitles[active]; const item = modules.find((entry) => entry.id === active) || pageTitles.overview; return language === 'en' && englishModules[active] ? { ...item, title: englishModules[active][0], desc: englishModules[active][1] } : item; }, [active, language]);
  const todayLabel = new Intl.DateTimeFormat(language === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return <div className="app-shell">
    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">SOULARAB TECH / WORKSPACE</p><h1>{current.title}</h1><p className="muted">{current.desc}</p></div><div className="top-actions"><select className="language-select" aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select>{active !== 'overview' && <button className="button secondary back-button" onClick={() => window.history.back()}>{language === 'ar' ? '→ رجوع' : '← Back'}</button>}<button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={language === "ar" ? "تبديل المظهر" : "Toggle theme"}>{theme === 'dark' ? '☼' : '☾'}</button><button className="button secondary" onClick={refresh}>{language === "ar" ? "تحديث الحالة ↻" : "Refresh status ↻"}</button></div></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="إغلاق">×</button></div>}

      {active === 'overview' && <section className="content home-content">
        <div className="workspace-calendar" aria-label={todayLabel}><span className="calendar-mark">▦</span><div><small>{language === 'ar' ? 'التاريخ اليوم' : 'TODAY'}</small><strong>{todayLabel}</strong></div><span className="calendar-live">{language === 'ar' ? 'محدّث تلقائياً' : 'LIVE DATE'}</span></div>
        <button className="rooh-hero" onClick={() => setActive('assistant')} aria-label="افتح مساعد روح">
          <span className="rooh-emblem" aria-hidden="true"><span className="rooh-orbit orbit-a"></span><span className="rooh-orbit orbit-b"></span><span className="rooh-core">روح</span></span>
          <span className="rooh-copy"><small>SOULARAB INTELLIGENCE</small><strong>{language === 'ar' ? 'روح' : 'Rooh'}</strong><b>{language === 'ar' ? 'مساعدك الذكي في قلب المنصة' : 'Your intelligent assistant at the heart of the workspace'}</b><span>{language === 'ar' ? 'اسأل، خطّط، حلّل، وابدأ تنفيذ أفكارك من مكان واحد' : 'Ask, plan, analyze, and bring your ideas to life in one place'}</span><i>{language === 'ar' ? 'ابدأ المحادثة ←' : 'Start conversation ←'}</i></span>
          <span className="rooh-status"><span></span>{language === 'ar' ? 'جاهزة للمساعدة' : 'Ready to help'}</span>
        </button>
        <div className="primary-destinations">
          <button className="destination-card featured" onClick={() => setActive('work')}><Icon>✦</Icon><strong>{language === 'ar' ? 'الشروع بالعمل' : 'Get to work'}</strong><span>{language === 'ar' ? 'الدخول إلى أقسام العمل المتخصصة' : 'Explore specialized work areas'}</span><b>{language === 'ar' ? 'ابدأ الآن ←' : 'Start now ←'}</b></button>
          <button className="destination-card" onClick={() => setActive('hub')}><Icon>⌘</Icon><strong>Soularab Hub</strong><span>{language === 'ar' ? 'المستودعات والأكواد والإصدارات' : 'Repositories, code, and releases'}</span><b>{language === 'ar' ? 'فتح القسم ←' : 'Open section ←'}</b></button>
          <button className="destination-card" onClick={() => setActive('root')}><Icon>⬡</Icon><strong>{language === 'ar' ? 'الجذر' : 'Root'}</strong><span>{language === 'ar' ? 'الأجهزة والتشخيص والصيانة' : 'Devices, diagnostics, and maintenance'}</span><b>{language === 'ar' ? 'فتح القسم ←' : 'Open section ←'}</b></button>
          <button className="destination-card" onClick={() => setActive('settings')}><Icon>⚙</Icon><strong>{language === 'ar' ? 'الإعدادات العامة' : 'General settings'}</strong><span>{language === 'ar' ? 'إعدادات المنصة والاتصال والمظهر' : 'Workspace, connection, and appearance settings'}</span><b>{language === 'ar' ? 'Open settings ←' : 'فتح الإعدادات ←'}</b></button>
        </div>
        <div className="operations-center">
          <div className="section-heading"><div><h3>مركز العمليات</h3><p>ملخص الاتصال والمهام التي تحتاج قرارك</p></div></div>
          <div className="stats-grid">
            <article className="stat-card"><span>حالة الخادم</span><strong className={api.state === 'online' ? 'good' : 'warn'}>{api.state === 'online' ? 'متصل' : 'غير متصل'}</strong><small>{api.mode || 'بانتظار تشغيل الخلفية'}</small></article>
            <article className="stat-card"><span>طلبات الموافقة</span><strong>{approvals.length}</strong><small>تنتظر مراجعتك</small></article>
            <article className="stat-card"><span>الأقسام</span><strong>10</strong><small>واجهة موحدة</small></article>
            <article className="stat-card"><span>الاتصال الخارجي</span><strong className="good">مقيّد</strong><small>لا اتصال دون إعداد وموافقة</small></article>
          </div>
          <button className="vault-entry" onClick={() => setActive('vault')}><span className="vault-symbol">▣</span><span><strong>الخزنة</strong><small>الأعمال القائمة والمؤجلة، الأكواد المحفوظة، والبيانات قيد المراجعة أو المؤقتة</small></span><b>فتح الخزنة ←</b></button>
        </div>
      </section>}
      {active === 'work' && <section className="content"><div className="section-heading"><div><h3>{language === 'ar' ? 'الشروع بالعمل' : 'Get to work'}</h3><p>{language === 'ar' ? 'كل أدوات التنفيذ ضمن مساحة واحدة' : 'All execution tools in one workspace'}</p></div></div><div className="module-grid">{modules.filter((m) => m.id !== 'overview').map((item) => <button className="module-card" key={item.id} onClick={() => setActive(item.id)}><Icon>{item.icon}</Icon><strong>{language === 'en' && englishModules[item.id] ? englishModules[item.id][0] : item.title}</strong><span>{language === 'en' && englishModules[item.id] ? englishModules[item.id][1] : item.desc}</span><b>{language === 'ar' ? 'فتح القسم ↗' : 'Open section ↗'}</b></button>)}</div></section>}
      {active === 'hub' && <section className="content"><div className="panel-card destination-page">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'سولاراب هوب' : 'Soularab Hub'}</h2><p className="muted">{language === 'ar' ? 'مستكشف مستودعات GitHub للقراءة والمتابعة.' : 'Browse GitHub repositories and inspect their contents.'}</p></div><span className="pill">{language === 'ar' ? 'قراءة آمنة' : 'Read only'}</span></div>
        <form className="repo-search" onSubmit={loadGithubRepository}><label>{language === 'ar' ? 'رابط المستودع أو owner/repository' : 'Repository URL or owner/repository'}<input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="owner/repository"/></label><button className="button primary" disabled={repoLoading || !repoInput.trim()}>{repoLoading ? (language === 'ar' ? 'جارٍ الفحص…' : 'Loading…') : (language === 'ar' ? 'استكشاف المستودع' : 'Explore repository')}</button></form>
        {repoError && <p className="notice" role="alert">{repoError}</p>}
        {repoInfo && <div className="repo-summary"><div><strong>{repoInfo.full_name}</strong><p>{repoInfo.description || (language === 'ar' ? 'لا يوجد وصف للمستودع.' : 'No repository description.')}</p></div><span className="pill">{repoInfo.private ? (language === 'ar' ? 'خاص' : 'Private') : (language === 'ar' ? 'عام' : 'Public')}</span><div className="repo-metrics"><span>★ {repoInfo.stargazers_count}</span><span>⑂ {repoInfo.forks_count}</span><span>{repoInfo.language || 'لغة غير محددة'}</span><span>{repoInfo.default_branch}</span></div><a className="button secondary" href={repoInfo.html_url} target="_blank" rel="noreferrer">{language === 'ar' ? 'فتح على GitHub ↗' : 'Open on GitHub ↗'}</a></div>}
        {repoFiles.length > 0 && <div className="repo-file-list"><h3>{language === 'ar' ? 'محتويات الجذر' : 'Root contents'}</h3>{repoFiles.map((file) => <a className="repo-file" key={file.path} href={file.html_url} target="_blank" rel="noreferrer"><span>{file.type === 'dir' ? '▰' : '▤'}</span><strong>{file.name}</strong><small>{file.type === 'dir' ? (language === 'ar' ? 'مجلد' : 'Folder') : (language === 'ar' ? 'ملف' : 'File')}</small><b>فتح ↗</b></a>)}</div>}
        {!repoInfo && !repoLoading && !repoError && <p className="chat-footnote">أدخل مستودعاً عاماً لاستعراض ملفاته وبياناته. لا تُنفذ هذه النسخة تعديلات أو عمليات دفع إلى GitHub.</p>}
      </div></section>}
      {active === 'root' && <section className="content"><div className="panel-card destination-page">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'الجذر والتشخيص' : 'Root & diagnostics'}</h2><p className="muted">{language === 'ar' ? 'فحص إمكانات المتصفح والجهاز الذي يعرض مساحة العمل.' : 'Inspect browser and device capabilities for this workspace.'}</p></div><button className="button primary" onClick={inspectDevice}>{language === 'ar' ? 'بدء الفحص' : 'Run diagnostics'}</button></div>
        {deviceInfo ? <><div className="diagnostic-grid">
          <article className="stat-card"><span>حالة الشبكة</span><strong className={deviceInfo.online ? 'good' : 'warn'}>{deviceInfo.online ? 'متصل' : 'غير متصل'}</strong></article>
          <article className="stat-card"><span>دقة الشاشة</span><strong>{deviceInfo.screen}</strong></article><article className="stat-card"><span>مساحة العرض</span><strong>{deviceInfo.viewport}</strong></article>
          <article className="stat-card"><span>أنوية المعالج المعلنة</span><strong>{deviceInfo.cores}</strong></article><article className="stat-card"><span>ذاكرة الجهاز المقدرة</span><strong>{deviceInfo.memory}</strong></article><article className="stat-card"><span>اللمس</span><strong>{deviceInfo.touch}</strong></article>
        </div><div className="diagnostic-details"><p><strong>المتصفح:</strong> {deviceInfo.browser}</p><p><strong>النظام:</strong> {deviceInfo.platform}</p><p><strong>اللغة:</strong> {deviceInfo.language}</p><p><strong>التخزين:</strong> {deviceInfo.storage}</p><small>آخر فحص: {deviceInfo.checkedAt}</small></div></> : <div className="empty">{language === 'ar' ? 'اضغط «بدء الفحص» لعرض المعلومات التي يسمح المتصفح بالوصول إليها.' : 'Run diagnostics to view the device information available to this browser.'}</div>}
        <p className="chat-footnote">{language === 'ar' ? 'قيود أمان المتصفح تمنع صفحة الويب من الوصول إلى صلاحيات root أو ملفات النظام الخاصة أو التحكم الكامل بالجهاز. الفحص تشخيصي وآمن ولا يغيّر إعدادات جهازك.' : 'Browser security prevents this page from accessing OS root privileges, private system files, or full device control. Diagnostics are read-only and do not change your device.'}</p>
      </div></section>}
      {active === 'settings' && <section className="content">
        <div className="panel-card settings-page">
          <div className="section-heading"><div><h2>{language === 'ar' ? 'الإعدادات العامة' : 'General settings'}</h2><p className="muted">{language === 'ar' ? 'تحكم بتجربة الاستخدام واللغة والمظهر وإمكانية الوصول.' : 'Customize language, appearance, and accessibility.'}</p></div><button className="button secondary" onClick={() => { setPreferences({ font: 'ibm', fontScale: 100, density: 'comfortable', reducedMotion: false }); setLanguage('ar'); setTheme('dark'); }}>{language === 'ar' ? 'استعادة الافتراضيات' : 'Restore defaults'}</button></div>
          <div className="settings-group"><h3>{language === 'ar' ? 'اللغة والمنطقة' : 'Language & region'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'لغة التطبيق' : 'Application language'}</strong><small>{language === 'ar' ? 'تغيير اللغة واتجاه الواجهة' : 'Change language and interface direction'}</small></div><select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ar">العربية · RTL</option><option value="en">English · LTR</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'التاريخ' : 'Date'}</strong><small>{language === 'ar' ? 'التاريخ المعروض في الصفحة الرئيسية حسب وقت جهازك' : 'Date shown on the home screen using your device time'}</small></div><span className="settings-value">{todayLabel}</span></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'المظهر والتخصيص' : 'Appearance & customization'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'سمة الألوان' : 'Color theme'}</strong><small>{language === 'ar' ? 'اختيار المظهر الداكن أو الفاتح' : 'Choose dark or light appearance'}</small></div><button className="button secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? (language === 'ar' ? 'داكن · تبديل إلى الفاتح' : 'Dark · switch to light') : (language === 'ar' ? 'فاتح · تبديل إلى الداكن' : 'Light · switch to dark')}</button></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'نوع الخط' : 'Font family'}</strong><small>{language === 'ar' ? 'تغيير عائلة الخط في التطبيق' : 'Change the application font family'}</small></div><select value={preferences.font} onChange={(e) => updatePreference('font', e.target.value)}><option value="ibm">IBM Plex Arabic</option><option value="system">خط النظام</option><option value="tahoma">Tahoma</option><option value="georgia">Georgia</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حجم الخط' : 'Font size'}</strong><small>تكبير أو تصغير النصوص: {preferences.fontScale}%</small></div><input aria-label="حجم الخط" type="range" min="85" max="125" step="5" value={preferences.fontScale} onChange={(e) => updatePreference('fontScale', Number(e.target.value))}/></div>
            <div className="settings-row"><div><strong>كثافة الواجهة</strong><small>{language === 'ar' ? 'المسافات بين البطاقات والعناصر' : 'Spacing between cards and elements'}</small></div><select value={preferences.density} onChange={(e) => updatePreference('density', e.target.value)}><option value="comfortable">مريحة</option><option value="compact">مضغوطة</option></select></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'إمكانية الوصول' : 'Accessibility'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'تقليل الحركة' : 'Reduce motion'}</strong><small>{language === 'ar' ? 'إيقاف الانتقالات والحركات الزخرفية' : 'Disable transitions and decorative motion'}</small></div><input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => updatePreference('reducedMotion', e.target.checked)}/></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'الاتصال والخدمات' : 'Connections & services'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حالة الخادم' : 'Server status'}</strong><small>{api.state === 'online' ? (language === 'ar' ? 'الخادم متصل' : 'Server connected') : (language === 'ar' ? 'بانتظار تشغيل الخلفية' : 'Waiting for backend')}</small></div><button className="button secondary" onClick={refresh}{language === 'ar' ? 'فحص الاتصال ↻' : 'Check connection ↻'}</button></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حالة المساعد' : 'Assistant status'}</strong><small>{assistantStatus.connected ? (language === 'ar' ? 'متصل بالنموذج المحلي' : 'Connected to local model') : (language === 'ar' ? 'غير متصل حالياً' : 'Currently disconnected')}</small></div><button className="button secondary" onClick={loadAssistant}{language === 'ar' ? 'فحص المساعد' : 'Check assistant'}</button></div>
          </div>
          <p className="chat-footnote">{language === 'ar' ? 'تُحفظ تفضيلات الواجهة على هذا الجهاز فقط. لا تغيّر إعدادات الخادم أو تمنح أي موصل صلاحيات جديدة.' : 'Interface preferences are stored on this device only. They do not change server settings or grant new connector permissions.'}</p>
        </div>
      </section>}
      {active === 'vault' && <section className="content">
        <div className="section-heading"><div><h2>الخزنة</h2><p className="muted">ملاحظاتك وأفكارك ومقتطفات العمل محفوظة محلياً على هذا الجهاز.</p></div><div className="vault-transfer"><label className="button secondary">استيراد JSON<input type="file" accept="application/json,.json" onChange={importVault} hidden/></label><button className="button secondary" onClick={exportVault} disabled={!vaultItems.length}>تصدير نسخة JSON</button></div></div>
        <div className="vault-layout">
          <div className="panel-card"><h3>حفظ عنصر جديد</h3><form className="proposal-form" onSubmit={saveVaultItem}>
            <label>عنوان العنصر<input value={vaultDraft.title} onChange={(e) => setVaultDraft({...vaultDraft,title:e.target.value})} required maxLength="120" placeholder="عنوان الفكرة أو الملاحظة"/></label>
            <label>التصنيف<select value={vaultDraft.category} onChange={(e) => setVaultDraft({...vaultDraft,category:e.target.value})}><option value="note">ملاحظة</option><option value="idea">فكرة</option><option value="task">مهمة مؤجلة</option><option value="code">مقتطف برمجي</option><option value="reference">مرجع</option></select></label>
            <label>المحتوى<textarea rows="6" value={vaultDraft.content} onChange={(e) => setVaultDraft({...vaultDraft,content:e.target.value})} required maxLength="12000" placeholder="اكتب المحتوى الذي تريد الاحتفاظ به…"/></label>
            <button className="button primary" disabled={!vaultDraft.title.trim() || !vaultDraft.content.trim()}>حفظ في الخزنة</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><div><h3>المحفوظات</h3><p>{vaultItems.length} عنصر محفوظ على هذا الجهاز</p></div></div>
            {vaultItems.length ? <div className="vault-list">{vaultItems.map((item) => <article className="vault-item" key={item.id}><div className="vault-item-head"><strong>{item.title}</strong><span className="pill">{({note:'ملاحظة',idea:'فكرة',task:'مهمة',code:'كود',reference:'مرجع'})[item.category] || 'عنصر'}</span></div><p>{item.content}</p><div className="vault-item-foot"><small>{new Date(item.createdAt).toLocaleString('ar')}</small><button className="text-button" onClick={() => setVaultItems((items) => items.filter((entry) => entry.id !== item.id))}>حذف</button></div></article>)}</div> : <Empty text="الخزنة فارغة حالياً. احفظ أول فكرة أو ملاحظة من النموذج."/>}
          </div>
        </div>
        <p className="chat-footnote">محتويات الخزنة تُحفظ في مساحة التخزين المحلية للمتصفح ولا تُرفع إلى الخادم. استخدم تصدير JSON للاحتفاظ بنسخة احتياطية قبل مسح بيانات المتصفح.</p>
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
        <div className="panel-card audit-panel"><div className="section-heading"><div><h3>سجل العمليات</h3><p>آخر الأحداث المسجلة في الخادم</p></div><button className="button secondary" onClick={refresh}>تحديث السجل ↻</button></div><AuditList events={events}/></div>
      </section>}

      {!['overview','security','files','assistant','work','hub','root','settings','vault'].includes(active) && <section className="content">
        <div className="module-intro panel-card"><Icon>{current.icon}</Icon><h2>{current.title}</h2><p>{current.desc}</p><span className="pill">مساحة تجهيز العمل</span></div>
        <div className="module-workspace-grid">
          <div className="panel-card"><h3>إعداد مهمة جديدة</h3><p className="muted">اكتب المطلوب واحفظه في الخزنة كتكليف قابل للمتابعة. لن ندّعي تنفيذ خدمة خارجية قبل ربط محركها فعلياً.</p>
            <form className="proposal-form" onSubmit={(event) => { event.preventDefault(); if (!moduleDraft.title.trim() || !moduleDraft.details.trim()) return; setVaultItems((items) => [{ id: Date.now(), title: moduleDraft.title.trim(), content: current.title + '\\n\\n' + moduleDraft.details.trim(), category: 'task', createdAt: new Date().toISOString() }, ...items]); setModuleDraft({ title: '', details: '' }); setNotice('تم حفظ التكليف في الخزنة المحلية.'); }}>
              <label>عنوان المهمة<input value={moduleDraft.title} onChange={(e) => setModuleDraft({...moduleDraft,title:e.target.value})} required maxLength="120" placeholder="مثال: إعداد صفحة هبوط"/></label>
              <label>التفاصيل والمتطلبات<textarea rows="5" value={moduleDraft.details} onChange={(e) => setModuleDraft({...moduleDraft,details:e.target.value})} required maxLength="12000" placeholder="اكتب الهدف والنتيجة المطلوبة والقيود…"/></label>
              <button className="button primary" disabled={!moduleDraft.title.trim() || !moduleDraft.details.trim()}>حفظ التكليف في الخزنة</button>
            </form>
          </div>
          <div className="panel-card"><h3>أدوات مساحة العمل</h3><div className="module-action-list">
            <button className="module-action" onClick={() => setActive('assistant')}><span>✦</span><div><strong>روح — المساعد الذكي</strong><small>تحليل المتطلبات وصياغة خطة العمل</small></div><b>فتح ←</b></button>
            <button className="module-action" onClick={() => setActive('files')}><span>▱</span><div><strong>ملفات ومشاريع</strong><small>إنشاء مساحة مشروع وإدارة ملفاته</small></div><b>فتح ←</b></button>
            <button className="module-action" onClick={() => setActive('vault')}><span>▣</span><div><strong>الخزنة</strong><small>الرجوع إلى التكليفات والملاحظات المحفوظة</small></div><b>فتح ←</b></button>
            <button className="module-action" onClick={() => setActive('security')}><span>⬡</span><div><strong>الأمان والموافقات</strong><small>مراجعة الطلبات قبل أي إجراء مؤثر</small></div><b>فتح ←</b></button>
          </div><div className="roadmap-row"><span>واجهة القسم</span><b className="good">جاهزة</b></div><div className="roadmap-row"><span>الخادم المحلي</span><b className={api.state === 'online' ? 'good' : 'warn'}>{api.state === 'online' ? 'متصل' : 'غير متصل'}</b></div><div className="roadmap-row"><span>محرك التنفيذ الخارجي</span><b>غير مربوط بعد</b></div></div>
        </div>
      </section>}
    </main>
    <nav className="utility-dock" aria-label="التنقل الرئيسي">
      <button className={active === 'overview' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('overview')}><span>⌂</span>{language === 'ar' ? 'البداية' : 'Home'}</button>
      <button className={active === 'assistant' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('assistant')}><span>✦</span>{language === 'ar' ? 'روح' : 'Rooh'}</button>
      <button className={active === 'work' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('work')}><span>✧</span>{language === 'ar' ? 'العمل' : 'Work'}</button>
      <button className={active === 'hub' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('hub')}><span>⌘</span>{language === 'ar' ? 'هوب' : 'Hub'}</button>
      <button className={active === 'root' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('root')}><span>⬡</span>{language === 'ar' ? 'الجذر' : 'Root'}</button>
      <button className={active === 'settings' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('settings')}><span>⚙</span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</button>
    </nav>      {authRequired && <div className="auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
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
