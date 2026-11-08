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

function cleanApiBase(value) { let result = value.trim(); while (result.endsWith('/')) result = result.slice(0, -1); return result; }

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('st-language') || 'ar');
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('st-api-base-url') || API);
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
  const [mediaStatus, setMediaStatus] = useState({ image: false, speech: false, loading: false });
  const [mediaModels, setMediaModels] = useState([]);
  const [imageDraft, setImageDraft] = useState({ model:'', prompt:'A premium cinematic product photograph, elegant studio lighting, refined composition, ultra-detailed', negative:'blurry, low quality, distorted, watermark, text', width:1024, height:1024, steps:24 });
  const [mediaWorkflow, setMediaWorkflow] = useState('');
  const [mediaQueue, setMediaQueue] = useState(null);
  const [mediaHistory, setMediaHistory] = useState(null);
  const [mediaImages, setMediaImages] = useState([]);
  const [mediaTranscript, setMediaTranscript] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
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
  const [siteDraft, setSiteDraft] = useState({ title: 'SOULARAB TECH', subtitle: 'Ideas into digital reality', description: 'A clear, elegant digital experience for your next idea.', buttonText: 'Get in touch', color: '#c49a43' });
  const [siteHtml, setSiteHtml] = useState('');
  const [brandDraft, setBrandDraft] = useState({ name:'SOULARAB TECH', initials:'ST', tagline:'IDEAS INTO DIGITAL REALITY', primary:'#c49a43', secondary:'#171519', accent:'#e8d9b5' });
  const [brandReady, setBrandReady] = useState(false);
  const [appDraft, setAppDraft] = useState({ name:'My Workspace App', description:'A focused space to organize work and ideas.', color:'#c49a43', features:'Dashboard\nProjects\nSettings' });
  const [appHtml, setAppHtml] = useState('');
  const [agentDraft, setAgentDraft] = useState({ title:'', steps:'', risk:'medium' });
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [queuedTasks, setQueuedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskActionId, setTaskActionId] = useState(null);
  const [domainDraft, setDomainDraft] = useState({ domain:'', provider:'Cloudflare Pages', project:'soularab-site' });
  const [domainReport, setDomainReport] = useState('');

  useEffect(() => {
    localStorage.setItem('st-api-base-url', cleanApiBase(apiBaseUrl));
  }, [apiBaseUrl]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('st-language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('st-vault', JSON.stringify(vaultItems));
  }, [vaultItems]);

  useEffect(() => () => { mediaImages.forEach((item) => URL.revokeObjectURL(item.url)); }, [mediaImages]);

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
    const response = await fetch(cleanApiBase(apiBaseUrl) + path, {
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
  useEffect(() => { if (active === 'media') refreshMediaEngines(); }, [active, apiToken]);

  async function refreshMediaEngines() {
    setMediaStatus((current) => ({ ...current, loading: true }));
    try {
      const results = await Promise.allSettled([
        request('/api/media/image/status'),
        request('/api/media/speech/status'),
        request('/api/media/image/models'),
      ]);
      const image = results[0].status === 'fulfilled' ? results[0].value : null;
      const speech = results[1].status === 'fulfilled' ? results[1].value : null;
      const models = results[2].status === 'fulfilled' ? results[2].value : null;
      const available = Array.isArray(models?.models) ? models.models : [];
      setMediaModels(available);
      setImageDraft((current) => ({ ...current, model: available.includes(current.model) ? current.model : (available[0] || '') }));
      setMediaStatus({ image: Boolean(image?.connected), speech: Boolean(speech?.connected), loading: false });
      if (results.every((result) => result.status === 'rejected')) setNotice(results[0].reason?.message || 'تعذر فحص محركات الوسائط.');
    } catch (error) {
      setMediaStatus({ image: false, speech: false, loading: false });
      setMediaModels([]);
      setNotice(error.message);
    }
  }

  async function queuePromptImage(event) {
    event.preventDefault();
    if (!imageDraft.model || !imageDraft.prompt.trim()) {
      setNotice(language === 'ar' ? 'اختر نموذجاً واكتب وصف الصورة.' : 'Choose a checkpoint and enter an image prompt.');
      return;
    }
    const dimension = (value) => Math.max(256, Math.min(1536, Math.round(Number(value || 1024) / 64) * 64));
    const workflow = {
      "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: imageDraft.model } },
      "2": { class_type: "CLIPTextEncode", inputs: { text: imageDraft.prompt.trim(), clip: ["1", 1] } },
      "3": { class_type: "CLIPTextEncode", inputs: { text: imageDraft.negative.trim(), clip: ["1", 1] } },
      "4": { class_type: "EmptyLatentImage", inputs: { width: dimension(imageDraft.width), height: dimension(imageDraft.height), batch_size: 1 } },
      "5": { class_type: "KSampler", inputs: { seed: Math.floor(Math.random() * 2147483647), steps: Math.max(1, Math.min(60, Number(imageDraft.steps) || 24)), cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0] } },
      "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
      "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "SOULARAB" } },
    };
    setMediaBusy(true);
    try {
      const result = await request('/api/media/image/queue', { method: 'POST', body: JSON.stringify({ workflow }) });
      setMediaQueue(result); setMediaHistory(null); setMediaImages([]);
      setNotice(language === 'ar' ? 'تم إرسال وصف الصورة إلى محرك ComfyUI المحلي.' : 'Image prompt queued on local ComfyUI.');
    } catch (error) { setNotice(error.message); }
    finally { setMediaBusy(false); }
  }

  async function queueMediaWorkflow(event) {
    event.preventDefault();
    let workflow;
    try { workflow = JSON.parse(mediaWorkflow); }
    catch { setNotice(language === 'ar' ? 'صيغة JSON غير صالحة.' : 'Invalid JSON format.'); return; }
    if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow) || !Object.keys(workflow).length) {
      setNotice(language === 'ar' ? 'أدخل سير عمل ComfyUI بصيغة API.' : 'Enter a ComfyUI API workflow.'); return;
    }
    setMediaBusy(true);
    try {
      const result = await request('/api/media/image/queue', { method: 'POST', body: JSON.stringify({ workflow }) });
      setMediaQueue(result);
      setNotice(language === 'ar' ? 'تم إرسال مهمة التوليد إلى ComfyUI المحلي.' : 'Generation job queued on local ComfyUI.');
    } catch (error) { setNotice(error.message); }
    finally { setMediaBusy(false); }
  }

  async function loadMediaHistory() {
    if (!mediaQueue?.prompt_id) return;
    setMediaBusy(true);
    setMediaImages([]);
    try {
      const result = await request('/api/media/image/history/' + encodeURIComponent(mediaQueue.prompt_id));
      setMediaHistory(result);
      const entry = result?.[mediaQueue.prompt_id] || Object.values(result || {})[0];
      const outputs = Object.values(entry?.outputs || {});
      const imageRefs = outputs.flatMap((output) => Array.isArray(output.images) ? output.images : []).slice(0, 8);
      const images = await Promise.all(imageRefs.map(async (item) => {
        const params = new URLSearchParams({ filename: item.filename || '', subfolder: item.subfolder || '', type: 'output' });
        try {
          const response = await fetch(cleanApiBase(apiBaseUrl) + '/api/media/image/view?' + params.toString(), {
            headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
          });
          if (!response.ok) return null;
          const blob = await response.blob();
          return { url: URL.createObjectURL(blob), name: item.filename || 'generated-image' };
        } catch { return null; }
      }));
      setMediaImages(images.filter(Boolean));
      if (imageRefs.length && !images.some(Boolean)) setNotice(language === 'ar' ? 'تم جلب سجل المهمة لكن تعذر تحميل ملفات الصور.' : 'Job history loaded, but image files could not be fetched.');
    } catch (error) { setNotice(error.message); }
    finally { setMediaBusy(false); }
  }

  async function transcribeAudio(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setMediaBusy(true);
    setMediaTranscript('');
    try {
      const response = await fetch(cleanApiBase(apiBaseUrl) + '/api/media/transcribe', {
        method: 'POST',
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || 'تعذر تفريغ الملف الصوتي.');
      setMediaTranscript(result.text || '');
      setNotice(language === 'ar' ? 'اكتمل التفريغ الصوتي محلياً.' : 'Local transcription completed.');
    } catch (error) { setNotice(error.message); }
    finally { setMediaBusy(false); }
  }

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
      const response = await fetch(cleanApiBase(apiBaseUrl) + '/api/projects/' + selectedProject.id + '/files', {
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
      const response = await fetch(cleanApiBase(apiBaseUrl) + '/api/projects/' + selectedProject.id + '/files/' + encodeURIComponent(filename), {
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

  function buildLandingPage(event) {
    event.preventDefault();
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const title = escapeHtml(siteDraft.title.trim() || 'My new website');
    const subtitle = escapeHtml(siteDraft.subtitle);
    const description = escapeHtml(siteDraft.description);
    const buttonText = escapeHtml(siteDraft.buttonText);
    const color = /^#[0-9a-fA-F]{6}$/.test(siteDraft.color) ? siteDraft.color : '#c49a43';
    const html = `<!doctype html><html lang="und" dir="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#101014;color:#f7f4ed;min-height:100vh;display:grid;place-items:center;padding:32px}.site{width:min(100%,900px);padding:clamp(32px,8vw,88px);border:1px solid #ffffff20;border-radius:28px;background:linear-gradient(145deg,#1d1b20,#111114);box-shadow:0 24px 90px #0008}.mark{color:${color};letter-spacing:.24em;font-size:12px;font-weight:700}.line{width:64px;height:2px;background:${color};margin:28px 0}h1{font-size:clamp(38px,7vw,76px);line-height:1.02;margin:0 0 18px;letter-spacing:-.05em}h2{font-size:clamp(17px,2vw,22px);font-weight:400;color:#c8c3ba;margin:0 0 24px}p{max-width:620px;color:#a9a4a0;line-height:1.8;font-size:17px}.cta{display:inline-block;margin-top:26px;padding:15px 24px;border-radius:999px;background:${color};color:#15120c;text-decoration:none;font-weight:700}.foot{margin-top:72px;color:#777;font-size:11px;letter-spacing:.16em}</style></head><body><main class="site"><div class="mark">SOULARAB STUDIO</div><div class="line"></div><h1>${title}</h1><h2>${subtitle}</h2><p>${description}</p><a class="cta" href="#contact">${buttonText}</a><div class="foot" id="contact">ADD YOUR CONTACT DETAILS · DESIGNED WITH SOULARAB TECH</div></main></body></html>`;
    setSiteHtml(html);
  }

  function downloadLandingPage() {
    if (!siteHtml) return;
    const url = URL.createObjectURL(new Blob([siteHtml], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'soularab-landing-page.html';
    link.click();
    URL.revokeObjectURL(url);
  }


  function prepareBrandIdentity(event) {
    event.preventDefault();
    setBrandDraft((current) => ({...current, initials: current.initials.trim().slice(0,4).toUpperCase() || 'ST'}));
    setBrandReady(true);
    setNotice(language === 'ar' ? 'تم إعداد مسودة الهوية. الشعار الرسمي لم يتغير.' : 'Identity draft prepared. The official logo is unchanged.');
  }
  function downloadBrandSvg() {
    if (!brandReady) return;
    const esc = (v) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="${brandDraft.secondary}"/><path d="M600 120 L820 205 V420 Q820 590 600 690 Q380 590 380 420 V205 Z" fill="none" stroke="${brandDraft.primary}" stroke-width="12"/><path d="M470 260 L520 205 L565 250 L600 195 L635 250 L680 205 L730 260" fill="none" stroke="${brandDraft.accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="600" y="445" text-anchor="middle" fill="${brandDraft.primary}" font-family="Georgia,serif" font-size="180" font-weight="bold">${esc(brandDraft.initials)}</text><path d="M430 730 H770" stroke="${brandDraft.primary}" stroke-width="3"/><text x="600" y="790" text-anchor="middle" fill="${brandDraft.accent}" font-family="Arial,sans-serif" font-size="48" letter-spacing="7">${esc(brandDraft.name)}</text><text x="600" y="840" text-anchor="middle" fill="${brandDraft.primary}" font-family="Arial,sans-serif" font-size="20" letter-spacing="5">${esc(brandDraft.tagline)}</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})); const link=document.createElement('a'); link.href=url; link.download='soularab-brand-concept.svg'; link.click(); URL.revokeObjectURL(url);
  }
  function downloadBrandGuide() {
    if (!brandReady) return;
    const guide=[brandDraft.name,brandDraft.tagline,'','CONCEPT ONLY — OFFICIAL LOGO UNCHANGED','Primary: '+brandDraft.primary,'Secondary: '+brandDraft.secondary,'Accent: '+brandDraft.accent,'Monogram: '+brandDraft.initials].join('\n');
    const url=URL.createObjectURL(new Blob([guide],{type:'text/plain;charset=utf-8'})); const link=document.createElement('a'); link.href=url; link.download='soularab-brand-guide.txt'; link.click(); URL.revokeObjectURL(url);
  }
  function buildAppStarter(event) {
    event.preventDefault();
    const esc=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const name=esc(appDraft.name.trim()||'My App'), desc=esc(appDraft.description);
    const color=/^#[0-9a-fA-F]{6}$/.test(appDraft.color)?appDraft.color:'#c49a43';
    const cards=appDraft.features.split('\n').map(v=>v.trim()).filter(Boolean).slice(0,8).map(v=>'<article><span>✦</span><h2>'+esc(v)+'</h2><p>Organize, review, and manage this area in one place.</p></article>').join('');
    const html=`<!doctype html><html lang="und" dir="auto"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>*{box-sizing:border-box}body{margin:0;background:#111;color:#f5f1e9;font:16px system-ui}header{padding:24px 7%;display:flex;justify-content:space-between;border-bottom:1px solid #ffffff20}header b{color:${color};letter-spacing:.15em}main{max-width:1100px;margin:auto;padding:72px 7%}h1{font-size:clamp(36px,7vw,68px);margin:0 0 16px}main>p{color:#aaa;line-height:1.8;max-width:650px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-top:48px}article{padding:26px;border:1px solid #ffffff20;border-radius:18px;background:#1a1a1e}article span{color:${color}}article p{color:#aaa;line-height:1.6}footer{padding:30px 7%;color:#777;border-top:1px solid #ffffff20}@media(max-width:600px){main{padding-top:44px}}</style><header><b>SOULARAB APP STUDIO</b><span>WORKSPACE</span></header><main><h1>${name}</h1><p>${desc}</p><section class="grid">${cards}</section></main><footer>Starter interface · Extend with your own data and backend</footer></html>`;
    setAppHtml(html);
  }
  function downloadAppStarter() {
    if (!appHtml) return;
    const url=URL.createObjectURL(new Blob([appHtml],{type:'text/html;charset=utf-8'})); const link=document.createElement('a'); link.href=url; link.download='soularab-app-starter.html'; link.click(); URL.revokeObjectURL(url);
  }


  async function loadTasks() {
    setLoadingTasks(true);
    try {
      const result = await request('/api/tasks');
      setQueuedTasks(Array.isArray(result.items) ? result.items : []);
    } catch (error) {
      setQueuedTasks([]);
      setNotice(error.message);
    } finally {
      setLoadingTasks(false);
    }
  }

  async function cancelQueuedTask(taskId) {
    setTaskActionId(taskId);
    try {
      await request('/api/tasks/' + taskId + '/cancel', { method: 'POST' });
      setNotice(language === 'ar' ? 'تم إلغاء المهمة من قائمة الانتظار.' : 'Task cancelled from the queue.');
      await loadTasks();
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setTaskActionId(null);
    }
  }

  useEffect(() => {
    if (active === 'agents') loadTasks();
  }, [active, apiToken]);

  async function submitAgentPlan(event) {
    event.preventDefault();
    const steps=agentDraft.steps.split('\n').map(v=>v.trim()).filter(Boolean);
    const title=agentDraft.title.trim();
    if(title.length<3 || steps.length<1){setNotice(language==='ar'?'أدخل عنواناً واضحاً وخطوة واحدة على الأقل.':'Enter a clear title and at least one step.');return;}
    const description=steps.map((step,index)=>(index+1)+'. '+step).join('\n');
    setAgentSubmitting(true);
    let queuedTaskId=null;
    try {
      const queued=await request('/api/tasks',{method:'POST',body:JSON.stringify({title,description,department:'system'})});
      queuedTaskId=queued.id;
      const approval=await request('/api/approvals',{method:'POST',body:JSON.stringify({title,description,risk:agentDraft.risk})});
      setVaultItems(items=>[{id:Date.now(),title,content:description+'\n\nTask ID: '+queuedTaskId+'\nApproval ID: '+approval.id,category:'task',createdAt:new Date().toISOString()},...items]);
      setAgentDraft({title:'',steps:'',risk:'medium'});
      await Promise.all([loadTasks(),refresh()]);
      setNotice(language==='ar'?'أُضيفت الخطة إلى طابور المهام وأُرسلت للموافقة. لم يبدأ أي تنفيذ.':'Plan added to the task queue and submitted for approval. No execution has started.');
    } catch(error) {
      if(queuedTaskId!==null) {
        try { await request('/api/tasks/'+queuedTaskId+'/cancel',{method:'POST'}); } catch {}
        await loadTasks();
      }
      setNotice(error.message);
    }
    finally{setAgentSubmitting(false);}
  }
  function createDomainRunbook(event) {
    event.preventDefault();
    const domain=domainDraft.domain.trim().toLowerCase();
    const valid=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
    if(!valid){setNotice(language==='ar'?'اسم النطاق غير صالح.':'Invalid domain name.');setDomainReport('');return;}
    const lines=[
      'SOULARAB TECH — DOMAIN & DEPLOYMENT RUNBOOK',
      'Domain: '+domain,
      'Provider: '+domainDraft.provider,
      'Project: '+(domainDraft.project.trim()||'soularab-site'),
      '',
      'CHECKLIST',
      '1. Add the domain to your hosting provider.',
      '2. Configure the DNS records shown by the provider.',
      '3. Verify domain ownership and wait for DNS propagation.',
      '4. Enable HTTPS and force secure redirects.',
      '5. Configure the frontend build output directory: dist.',
      '6. Set the backend API URL and trusted CORS origin.',
      '7. Add provider tokens only in the provider secret manager.',
      '8. Run a production build and test mobile navigation.',
      '',
      'SECURITY: Never put provider API tokens in this file or the frontend.'
    ].join('\n');
    setDomainReport(lines);
    setNotice(language==='ar'?'تم إنشاء خطة النطاق والنشر. لم يتم شراء النطاق أو تغيير DNS.':'Deployment runbook created. No domain purchase or DNS change was made.');
  }
  function downloadDomainRunbook() {
    if(!domainReport)return;
    const url=URL.createObjectURL(new Blob([domainReport],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='soularab-domain-runbook.txt';link.click();URL.revokeObjectURL(url);
  }

  function inspectDevice() {
    setDeviceInfo({
      browser: navigator.userAgent, language: navigator.language, platform: navigator.platform || (language === 'ar' ? 'غير متاح' : 'Unavailable'),
      online: navigator.onLine, screen: window.screen.width + ' × ' + window.screen.height,
      viewport: window.innerWidth + ' × ' + window.innerHeight, memory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : (language === 'ar' ? 'غير متاح' : 'Unavailable'),
      cores: navigator.hardwareConcurrency || (language === 'ar' ? 'غير متاح' : 'Unavailable'), touch: navigator.maxTouchPoints > 0 ? (language === 'ar' ? 'مدعوم' : 'Supported') : (language === 'ar' ? 'غير مكتشف' : 'Not detected'),
      storage: navigator.storage?.estimate ? 'مدعوم' : (language === 'ar' ? 'غير متاح' : 'Unavailable'), checkedAt: new Date().toLocaleString('ar')
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
        <button className="rooh-hero" onClick={() => setActive('assistant')} aria-label={language === 'ar' ? 'افتح مساعد روح' : 'Open Rooh assistant'}>
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
          <div className="section-heading"><div><h3>{language === 'ar' ? 'مركز العمليات' : 'Operations center'}</h3><p>{language === 'ar' ? 'ملخص الاتصال والمهام التي تحتاج قرارك' : 'Connection summary and tasks awaiting your decision'}</p></div></div>
          <div className="stats-grid">
            <article className="stat-card"><span>{language === 'ar' ? 'حالة الخادم' : 'Server status'}</span><strong className={api.state === 'online' ? 'good' : 'warn'}>{api.state === 'online' ? (language === 'ar' ? 'متصل' : 'Online') : (language === 'ar' ? 'غير متصل' : 'Offline')}</strong><small>{api.mode || (language === 'ar' ? 'بانتظار تشغيل الخلفية' : 'Backend not running')}</small></article>
            <article className="stat-card"><span>{language === 'ar' ? 'طلبات الموافقة' : 'Approval requests'}</span><strong>{approvals.length}</strong><small>{language === 'ar' ? 'تنتظر مراجعتك' : 'Awaiting your review'}</small></article>
            <article className="stat-card"><span>{language === 'ar' ? 'الأقسام' : 'Modules'}</span><strong>10</strong><small>{language === 'ar' ? 'واجهة موحدة' : 'Unified workspace'}</small></article>
            <article className="stat-card"><span>{language === 'ar' ? 'الاتصال الخارجي' : 'External connections'}</span><strong className="good">مقيّد</strong><small>{language === 'ar' ? 'لا اتصال دون إعداد وموافقة' : 'No connection without setup and approval'}</small></article>
          </div>
          <button className="vault-entry" onClick={() => setActive('vault')}><span className="vault-symbol">▣</span><span><strong>{language === 'ar' ? 'الخزنة' : 'Vault'}</strong><small>{language === 'ar' ? 'الأعمال القائمة والمؤجلة، الأكواد المحفوظة، والبيانات قيد المراجعة أو المؤقتة' : 'Active and deferred work, saved code, and items under review'}</small></span><b>{language === 'ar' ? 'فتح الخزنة ←' : 'Open vault ←'}</b></button>
        </div>
      </section>}
      {active === 'work' && <section className="content"><div className="section-heading"><div><h3>{language === 'ar' ? 'الشروع بالعمل' : 'Get to work'}</h3><p>{language === 'ar' ? 'كل أدوات التنفيذ ضمن مساحة واحدة' : 'All execution tools in one workspace'}</p></div></div><div className="module-grid">{modules.filter((m) => m.id !== 'overview').map((item) => <button className="module-card" key={item.id} onClick={() => setActive(item.id)}><Icon>{item.icon}</Icon><strong>{language === 'en' && englishModules[item.id] ? englishModules[item.id][0] : item.title}</strong><span>{language === 'en' && englishModules[item.id] ? englishModules[item.id][1] : item.desc}</span><b>{language === 'ar' ? 'فتح القسم ↗' : 'Open section ↗'}</b></button>)}</div></section>}
      {active === 'hub' && <section className="content"><div className="panel-card destination-page">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'سولاراب هوب' : 'Soularab Hub'}</h2><p className="muted">{language === 'ar' ? 'مستكشف مستودعات GitHub للقراءة والمتابعة.' : 'Browse GitHub repositories and inspect their contents.'}</p></div><span className="pill">{language === 'ar' ? 'قراءة آمنة' : 'Read only'}</span></div>
        <form className="repo-search" onSubmit={loadGithubRepository}><label>{language === 'ar' ? 'رابط المستودع أو owner/repository' : 'Repository URL or owner/repository'}<input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="owner/repository"/></label><button className="button primary" disabled={repoLoading || !repoInput.trim()}>{repoLoading ? (language === 'ar' ? 'جارٍ الفحص…' : 'Loading…') : (language === 'ar' ? 'استكشاف المستودع' : 'Explore repository')}</button></form>
        {repoError && <p className="notice" role="alert">{repoError}</p>}
        {repoInfo && <div className="repo-summary"><div><strong>{repoInfo.full_name}</strong><p>{repoInfo.description || (language === 'ar' ? 'لا يوجد وصف للمستودع.' : 'No repository description.')}</p></div><span className="pill">{repoInfo.private ? (language === 'ar' ? 'خاص' : 'Private') : (language === 'ar' ? 'عام' : 'Public')}</span><div className="repo-metrics"><span>★ {repoInfo.stargazers_count}</span><span>⑂ {repoInfo.forks_count}</span><span>{repoInfo.language || (language === 'ar' ? 'لغة غير محددة' : 'Language not specified')}</span><span>{repoInfo.default_branch}</span></div><a className="button secondary" href={repoInfo.html_url} target="_blank" rel="noreferrer">{language === 'ar' ? 'فتح على GitHub ↗' : 'Open on GitHub ↗'}</a></div>}
        {repoFiles.length > 0 && <div className="repo-file-list"><h3>{language === 'ar' ? 'محتويات الجذر' : 'Root contents'}</h3>{repoFiles.map((file) => <a className="repo-file" key={file.path} href={file.html_url} target="_blank" rel="noreferrer"><span>{file.type === 'dir' ? '▰' : '▤'}</span><strong>{file.name}</strong><small>{file.type === 'dir' ? (language === 'ar' ? 'مجلد' : 'Folder') : (language === 'ar' ? 'ملف' : 'File')}</small><b>فتح ↗</b></a>)}</div>}
        {!repoInfo && !repoLoading && !repoError && <p className="chat-footnote">{language === 'ar' ? 'أدخل مستودعاً عاماً لاستعراض ملفاته وبياناته. لا تُنفذ هذه النسخة تعديلات أو عمليات دفع إلى GitHub.' : 'Enter a public repository to inspect its files and metadata. This version does not modify or push changes to GitHub.'}</p>}
      </div></section>}
      {active === 'root' && <section className="content"><div className="panel-card destination-page">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'الجذر والتشخيص' : 'Root & diagnostics'}</h2><p className="muted">{language === 'ar' ? 'فحص إمكانات المتصفح والجهاز الذي يعرض مساحة العمل.' : 'Inspect browser and device capabilities for this workspace.'}</p></div><button className="button primary" onClick={inspectDevice}>{language === 'ar' ? 'بدء الفحص' : 'Run diagnostics'}</button></div>
        {deviceInfo ? <><div className="diagnostic-grid">
          <article className="stat-card"><span>{language === 'ar' ? 'حالة الشبكة' : 'Network status'}</span><strong className={deviceInfo.online ? 'good' : 'warn'}>{deviceInfo.online ? (language === 'ar' ? 'متصل' : 'Online') : (language === 'ar' ? 'غير متصل' : 'Offline')}</strong></article>
          <article className="stat-card"><span>{language === 'ar' ? 'دقة الشاشة' : 'Screen resolution'}</span><strong>{deviceInfo.screen}</strong></article><article className="stat-card"><span>{language === 'ar' ? 'مساحة العرض' : 'Viewport'}</span><strong>{deviceInfo.viewport}</strong></article>
          <article className="stat-card"><span>{language === 'ar' ? 'أنوية المعالج المعلنة' : 'Reported CPU cores'}</span><strong>{deviceInfo.cores}</strong></article><article className="stat-card"><span>{language === 'ar' ? 'ذاكرة الجهاز المقدرة' : 'Estimated device memory'}</span><strong>{deviceInfo.memory}</strong></article><article className="stat-card"><span>{language === 'ar' ? 'اللمس' : 'Touch support'}</span><strong>{deviceInfo.touch}</strong></article>
        </div><div className="diagnostic-details"><p><strong>{language === 'ar' ? 'المتصفح:' : 'Browser:'}</strong> {deviceInfo.browser}</p><p><strong>{language === 'ar' ? 'النظام:' : 'Platform:'}</strong> {deviceInfo.platform}</p><p><strong>{language === 'ar' ? 'اللغة:' : 'Language:'}</strong> {deviceInfo.language}</p><p><strong>{language === 'ar' ? 'التخزين:' : 'Storage:'}</strong> {deviceInfo.storage}</p><small>آخر فحص: {deviceInfo.checkedAt}</small></div></> : <div className="empty">{language === 'ar' ? 'اضغط «بدء الفحص» لعرض المعلومات التي يسمح المتصفح بالوصول إليها.' : 'Run diagnostics to view the device information available to this browser.'}</div>}
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
            <div className="settings-row"><div><strong>{language === 'ar' ? 'نوع الخط' : 'Font family'}</strong><small>{language === 'ar' ? 'تغيير عائلة الخط في التطبيق' : 'Change the application font family'}</small></div><select value={preferences.font} onChange={(e) => updatePreference('font', e.target.value)}><option value="ibm">IBM Plex Arabic</option><option value="system">{language === 'ar' ? 'خط النظام' : 'System font'}</option><option value="tahoma">Tahoma</option><option value="georgia">Georgia</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حجم الخط' : 'Font size'}</strong><small>{language === 'ar' ? 'تكبير أو تصغير النصوص' : 'Scale text'}: {preferences.fontScale}%</small></div><input aria-label="حجم الخط" type="range" min="85" max="125" step="5" value={preferences.fontScale} onChange={(e) => updatePreference('fontScale', Number(e.target.value))}/></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'كثافة الواجهة' : 'Interface density'}</strong><small>{language === 'ar' ? 'المسافات بين البطاقات والعناصر' : 'Spacing between cards and elements'}</small></div><select value={preferences.density} onChange={(e) => updatePreference('density', e.target.value)}><option value="comfortable">{language === 'ar' ? 'مريحة' : 'Comfortable'}</option><option value="compact">{language === 'ar' ? 'مضغوطة' : 'Compact'}</option></select></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'إمكانية الوصول' : 'Accessibility'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'تقليل الحركة' : 'Reduce motion'}</strong><small>{language === 'ar' ? 'إيقاف الانتقالات والحركات الزخرفية' : 'Disable transitions and decorative motion'}</small></div><input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => updatePreference('reducedMotion', e.target.checked)}/></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'الاتصال والخدمات' : 'Connections & services'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'عنوان الخادم الخلفي' : 'Backend API URL'}</strong><small>{language === 'ar' ? 'اتركه فارغاً لاستخدام نفس النطاق، أو أدخل عنوان خادم موثوق يدعم CORS.' : 'Leave blank to use the same origin, or enter a trusted server URL with CORS enabled.'}</small></div><input type="url" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://your-server.example"/></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حالة الخادم' : 'Server status'}</strong><small>{api.state === 'online' ? (language === 'ar' ? 'الخادم متصل' : 'Server connected') : (language === 'ar' ? 'بانتظار تشغيل الخلفية' : 'Waiting for backend')}</small></div><button className="button secondary" onClick={refresh}>{language === 'ar' ? 'فحص الاتصال ↻' : 'Check connection ↻'}</button></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حالة المساعد' : 'Assistant status'}</strong><small>{assistantStatus.connected ? (language === 'ar' ? 'متصل بالنموذج المحلي' : 'Connected to local model') : (language === 'ar' ? 'غير متصل حالياً' : 'Currently disconnected')}</small></div><button className="button secondary" onClick={loadAssistant}>{language === 'ar' ? 'فحص المساعد' : 'Check assistant'}</button></div>
          </div>
          <p className="chat-footnote">{language === 'ar' ? 'تُحفظ تفضيلات الواجهة على هذا الجهاز فقط. لا تغيّر إعدادات الخادم أو تمنح أي موصل صلاحيات جديدة.' : 'Interface preferences are stored on this device only. They do not change server settings or grant new connector permissions.'}</p>
        </div>
      </section>}
      {active === 'vault' && <section className="content">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'الخزنة' : 'Vault'}</h2><p className="muted">{language === 'ar' ? 'ملاحظاتك وأفكارك ومقتطفات العمل محفوظة محلياً على هذا الجهاز.' : 'Your notes, ideas, and work snippets are stored locally on this device.'}</p></div><div className="vault-transfer"><label className="button secondary">{language === 'ar' ? 'استيراد JSON' : 'Import JSON'}<input type="file" accept="application/json,.json" onChange={importVault} hidden/></label><button className="button secondary" onClick={exportVault} disabled={!vaultItems.length}>{language === 'ar' ? 'تصدير نسخة JSON' : 'Export JSON backup'}</button></div></div>
        <div className="vault-layout">
          <div className="panel-card"><h3>{language === 'ar' ? 'حفظ عنصر جديد' : 'Save a new item'}</h3><form className="proposal-form" onSubmit={saveVaultItem}>
            <label>{language === 'ar' ? 'عنوان العنصر' : 'Item title'}<input value={vaultDraft.title} onChange={(e) => setVaultDraft({...vaultDraft,title:e.target.value})} required maxLength="120" placeholder={language === 'ar' ? 'عنوان الفكرة أو الملاحظة' : 'Idea or note title'}/></label>
            <label>{language === 'ar' ? 'التصنيف' : 'Category'}<select value={vaultDraft.category} onChange={(e) => setVaultDraft({...vaultDraft,category:e.target.value})}><option value="note">{language === 'ar' ? 'ملاحظة' : 'Note'}</option><option value="idea">{language === 'ar' ? 'فكرة' : 'Idea'}</option><option value="task">{language === 'ar' ? 'مهمة مؤجلة' : 'Deferred task'}</option><option value="code">{language === 'ar' ? 'مقتطف برمجي' : 'Code snippet'}</option><option value="reference">{language === 'ar' ? 'مرجع' : 'Reference'}</option></select></label>
            <label>{language === 'ar' ? 'المحتوى' : 'Content'}<textarea rows="6" value={vaultDraft.content} onChange={(e) => setVaultDraft({...vaultDraft,content:e.target.value})} required maxLength="12000" placeholder={language === 'ar' ? 'اكتب المحتوى الذي تريد الاحتفاظ به…' : 'Write the content you want to keep…'}/></label>
            <button className="button primary" disabled={!vaultDraft.title.trim() || !vaultDraft.content.trim()}>{language === 'ar' ? 'حفظ في الخزنة' : 'Save to vault'}</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><div><h3>{language === 'ar' ? 'المحفوظات' : 'Saved items'}</h3><p>{vaultItems.length} {language === 'ar' ? 'عنصر محفوظ على هذا الجهاز' : 'items saved on this device'}</p></div></div>
            {vaultItems.length ? <div className="vault-list">{vaultItems.map((item) => <article className="vault-item" key={item.id}><div className="vault-item-head"><strong>{item.title}</strong><span className="pill">{(language === 'ar' ? {note:'ملاحظة',idea:'فكرة',task:'مهمة',code:'كود',reference:'مرجع'} : {note:'Note',idea:'Idea',task:'Task',code:'Code',reference:'Reference'})[item.category] || (language === 'ar' ? 'عنصر' : 'Item')}</span></div><p>{item.content}</p><div className="vault-item-foot"><small>{new Date(item.createdAt).toLocaleString('ar')}</small><button className="text-button" onClick={() => setVaultItems((items) => items.filter((entry) => entry.id !== item.id))}>{language === 'ar' ? 'حذف' : 'Delete'}</button></div></article>)}</div> : <Empty text={language === 'ar' ? 'الخزنة فارغة حالياً. احفظ أول فكرة أو ملاحظة من النموذج.' : 'Your vault is empty. Save your first idea or note using the form.'}/>}
          </div>
        </div>
        <p className="chat-footnote">{language === 'ar' ? 'محتويات الخزنة تُحفظ في مساحة التخزين المحلية للمتصفح ولا تُرفع إلى الخادم. استخدم تصدير JSON للاحتفاظ بنسخة احتياطية قبل مسح بيانات المتصفح.' : 'Vault items stay in this browser and are not uploaded to the server. Export a JSON backup before clearing browser data.'}</p>
      </section>}
      {active === 'files' && <section className="content">
        <div className="project-layout">
          <div className="panel-card">
            <h3>{language === 'ar' ? 'إنشاء مساحة مشروع' : 'Create project workspace'}</h3>
            <p className="muted">{language === 'ar' ? 'كل مشروع يحصل على سجل مستقل ومجلد محلي خاص به على جهاز الخادم.' : 'Each project gets its own record and dedicated folder on the server.'}</p>
            <form className="proposal-form" onSubmit={createProject}>
              <label>{language === 'ar' ? 'اسم المشروع' : 'Project name'}<input value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} required minLength="2" maxLength="100" placeholder={language === 'ar' ? 'مثال: متجر إلكتروني' : 'Example: Online store'}/></label>
              <label>{language === 'ar' ? 'وصف المشروع' : 'Project description'}<textarea rows="3" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} maxLength="1000" placeholder={language === 'ar' ? 'اكتب وصفاً مختصراً (اختياري)' : 'Short description (optional)'}/></label>
              <button className="button primary" disabled={busy || !projectForm.title.trim()}>{busy ? (language === 'ar' ? 'جارٍ الإنشاء…' : 'Creating…') : (language === 'ar' ? 'إنشاء المشروع +' : 'Create project +')}</button>
            </form>
          </div>
          <div className="panel-card project-list-panel">
            <div className="section-heading"><div><h3>{language === 'ar' ? 'مشاريعي' : 'My projects'}</h3><p>{language === 'ar' ? 'المشاريع النشطة والمؤرشفة' : 'Active and archived projects'}</p></div><button className="button secondary" onClick={loadProjects}>{language === 'ar' ? 'تحديث ↻' : 'Refresh ↻'}</button></div>
            {loadingProjects ? <Empty text={language === 'ar' ? 'جارٍ تحميل المشاريع…' : 'Loading projects…'}/> : projects.length ? <div className="project-list">
              {projects.map((project) => <article className="project-card" key={project.id}>
                <div className="project-card-top"><span className="project-symbol">▣</span><span className={project.status === 'active' ? 'project-status active' : 'project-status'}>{project.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'مؤرشف' : 'Archived')}</span></div>
                <strong>{project.title}</strong><p>{project.description || (language === 'ar' ? 'لا يوجد وصف لهذا المشروع.' : 'No project description.')}</p>
                <small>المشروع #{project.id} · {new Date(project.created_at).toLocaleDateString('ar')}</small>
                {project.status === 'active' && <div className="project-actions"><button className="text-button" onClick={() => openProject(project)}>{language === 'ar' ? 'إدارة الملفات' : 'Manage files'}</button><button className="text-button" disabled={busy} onClick={() => archiveProject(project.id)}>{language === 'ar' ? 'أرشفة' : 'Archive'}</button></div>}
              </article>)}
            </div> : <Empty text={language === 'ar' ? 'لا توجد مشاريع بعد. أنشئ أول مساحة عمل من النموذج.' : 'No projects yet. Create your first workspace using the form.'}/>}
          </div>
        </div>
        {selectedProject && <div className="panel-card workspace-files">
          <div className="section-heading"><div><h3>ملفات: {selectedProject.title}</h3><p>{language === 'ar' ? 'إدارة الملفات داخل مساحة هذا المشروع فقط' : 'Manage files only within this project workspace'}</p></div><button className="text-button" onClick={() => setSelectedProject(null)}>{language === 'ar' ? 'إغلاق' : 'Close'}</button></div>
          <label className="upload-control">{language === 'ar' ? 'رفع ملف (حد أقصى 10 MB)' : 'Upload file (10 MB maximum)'}<input type="file" onChange={uploadProjectFile} disabled={uploadingFile || selectedProject.status === 'archived'} /></label>
          {uploadingFile && <p className="muted">جارٍ رفع الملف…</p>}
          {projectFiles.length ? <div className="workspace-file-list">{projectFiles.map((file) => <div className="workspace-file" key={file.name}><span>▤</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></div><button className="text-button" onClick={() => downloadProjectFile(file.name)}>{language === 'ar' ? 'تنزيل' : 'Download'}</button></div>)}</div> : <Empty text={language === 'ar' ? 'لا توجد ملفات في مساحة هذا المشروع بعد.' : 'No files in this project workspace yet.'}/>}
          <p className="chat-footnote">{language === 'ar' ? 'الملفات تبقى داخل مجلد المشروع على الخادم. الأنواع التنفيذية المحظورة لا يمكن رفعها.' : 'Files remain in the project folder on the server. Blocked executable file types cannot be uploaded.'}</p>
        </div>}
        <div className="panel-card workspace-note"><strong>{language === 'ar' ? 'حماية الملفات' : 'File protection'}</strong><p>{language === 'ar' ? 'تُحصر عمليات الرفع والتنزيل داخل مجلد المشروع، ويُمنع استخدام المسارات للوصول إلى ملفات أخرى. الحد الأقصى للملف الواحد 10 ميغابايت.' : 'Uploads and downloads are restricted to the project folder. Path traversal is blocked. Maximum file size is 10 MB.'}</p></div>
      </section>}

      {active === "assistant" && <section className="content">
        <div className="assistant-toolbar panel-card">
          <div><h3>{language === 'ar' ? 'المساعد المحلي' : 'Local assistant'}</h3><p className="muted">{language === 'ar' ? 'تُرسل المحادثة إلى Ollama على الجهاز الذي يعمل عليه الخادم فقط.' : 'Messages are sent only to the local Ollama service on the server machine.'}</p></div>
          <div className="assistant-controls"><span className={assistantStatus.connected ? "pill connected" : "pill"}>{assistantStatus.loading ? (language === 'ar' ? 'جارٍ الفحص…' : 'Checking…') : assistantStatus.connected ? (language === 'ar' ? 'Ollama متصلة' : 'Ollama connected') : (language === 'ar' ? 'Ollama غير متصلة' : 'Ollama disconnected')}</span><button className="button secondary" onClick={loadAssistant}>{language === 'ar' ? 'فحص الاتصال' : 'Check connection'}</button></div>
        </div>
        <div className="chat-panel panel-card">
          <div className="chat-heading"><div><h3>{language === 'ar' ? 'محادثة جديدة' : 'New conversation'}</h3><small>{language === 'ar' ? 'المحادثة محفوظة مؤقتاً في هذه الصفحة فقط.' : 'This conversation is kept temporarily on this page only.'}</small></div>
            <select aria-label={language === 'ar' ? 'اختر النموذج' : 'Choose model'} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={!models.length}>
              {!models.length && <option value="">{language === 'ar' ? 'لا توجد نماذج متاحة' : 'No models available'}</option>}
              {models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}
            </select>
          </div>
          <div className="chat-transcript" aria-live="polite">
            {!chatMessages.length && <div className="chat-empty"><span>✦</span><strong>{language === 'ar' ? 'ما الذي نعمل عليه اليوم؟' : 'What are we working on today?'}</strong><p>{language === 'ar' ? 'اختر نموذجاً محلياً وابدأ محادثتك. لن يتم إرسال رسائلك إلى خدمة سحابية.' : 'Choose a local model and start chatting. Your messages are not sent to a cloud service.'}</p></div>}
            {chatMessages.map((message, index) => <article key={index} className={"chat-message " + message.role}><small>{message.role === "user" ? (language === 'ar' ? 'أنت' : 'You') : (language === 'ar' ? 'المساعد' : 'Assistant')}</small><p>{message.content}</p></article>)}
            {sendingChat && <div className="chat-thinking">{language === 'ar' ? 'النموذج يفكر…' : 'Model is thinking…'}</div>}
          </div>
          <form className="chat-compose" onSubmit={sendChat}>
            <textarea rows="2" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={models.length ? (language === 'ar' ? 'اكتب رسالتك هنا…' : 'Type your message…') : (language === 'ar' ? 'شغّل Ollama وثبّت نموذجاً محلياً أولاً' : 'Start Ollama and install a local model first')} disabled={!models.length || sendingChat} />
            <button className="button primary" disabled={!models.length || !chatInput.trim() || sendingChat}>{sendingChat ? (language === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : (language === 'ar' ? 'إرسال ↑' : 'Send ↑')}</button>
          </form>
          <p className="chat-footnote">{language === 'ar' ? 'يلزم تثبيت Ollama والنموذج على جهاز الخادم. الهاتف واجهة تحكم ولا يشغّل النموذج الثقيل بنفسه.' : 'Ollama and a model must be installed on the server machine. The phone is a control interface and does not run the large model itself.'}</p>
        </div>
      </section>}
      {active === 'security' && <section className="content two-col">
        <div className="panel-card"><div className="section-heading"><div><h3>{language === 'ar' ? 'طلبات الموافقة' : 'Approval requests'}</h3><p>{language === 'ar' ? 'الموافقة لا تعني التنفيذ التلقائي' : 'Approval does not trigger execution' }</p></div><span className="pill">{approvals.length} {language === 'ar' ? 'معلّق' : 'pending'}</span></div>
          {approvals.length ? approvals.map((item) => <article className="approval" key={item.id}><div className="approval-top"><strong>{item.title}</strong><span className={`risk risk-${item.risk}`}>{item.risk === 'high' ? (language === 'ar' ? 'مرتفع' : 'High') : item.risk === 'low' ? (language === 'ar' ? 'منخفض' : 'Low') : (language === 'ar' ? 'متوسط' : 'Medium')}</span></div><p>{item.description}</p><small>{new Date(item.created_at).toLocaleString('ar')}</small><div className="approval-actions"><button className="button primary" disabled={busy} onClick={() => decide(item.id, 'approved')}>{language === 'ar' ? 'موافقة' : 'Approve'}</button><button className="button danger" disabled={busy} onClick={() => decide(item.id, 'rejected')}>{language === 'ar' ? 'رفض' : 'Reject'}</button></div></article>) : <Empty text={language === 'ar' ? 'لا توجد طلبات معلّقة حالياً.' : 'No pending requests.'}/>}
        </div>
        <div className="panel-card"><h3>{language === 'ar' ? 'تسجيل طلب جديد' : 'Create a request'}</h3><p className="muted">{language === 'ar' ? 'سجّل الإجراء المقترح ليظهر في قائمة المراجعة. لا ينفذ النظام أي تغيير من هذه الخطوة.' : 'Submit a proposed action for review. This step does not execute any change.'}</p><form className="proposal-form" onSubmit={createProposal}><label>{language === 'ar' ? 'عنوان الإجراء' : 'Action title'}<input value={proposal.title} onChange={(e) => setProposal({...proposal, title:e.target.value})} required maxLength="120" placeholder="مثال: ربط مزود نموذج محلي"/></label><label>{language === 'ar' ? 'التفاصيل' : 'Details'}<textarea value={proposal.description} onChange={(e) => setProposal({...proposal, description:e.target.value})} required rows="4" maxLength="2000" placeholder={language === 'ar' ? 'ما الذي سيتغير؟ ولماذا؟' : 'What will change, and why?'} /></label><label>{language === 'ar' ? 'مستوى المخاطر' : 'Risk level'}<select value={proposal.risk} onChange={(e) => setProposal({...proposal, risk:e.target.value})}><option value="low">{language === 'ar' ? 'منخفض' : 'Low'}</option><option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option><option value="high">{language === 'ar' ? 'مرتفع' : 'High'}</option></select></label><button className="button primary" disabled={busy}>{language === 'ar' ? 'إرسال للمراجعة' : 'Submit for review'}</button></form></div>
        <div className="panel-card"><h3>{language === 'ar' ? 'مفتاح الوصول المحلي' : 'Local access token'}</h3><p className="muted">{language === 'ar' ? 'أدخل رمز API الذي ضبطته في الخادم. يُحفظ في جلسة المتصفح الحالية فقط.' : 'Enter the API token configured on the server. It is stored only for this browser session.'}</p><form onSubmit={(e) => {e.preventDefault();sessionStorage.setItem('st-api-token',apiToken);refresh();}}><label>{language === 'ar' ? 'رمز API' : 'API token'}<input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder={language === 'ar' ? 'اتركه فارغاً إذا لم تضبطه' : 'Leave blank if not configured'}/></label><button className="button secondary">{language === 'ar' ? 'حفظ للجلسة' : 'Save for session'}</button></form></div>
        <div className="panel-card"><h3>{language === 'ar' ? 'مبادئ الحماية' : 'Security principles'}</h3><ul className="safety-list"><li>{language === 'ar' ? 'لا اتصال بمزود خارجي افتراضياً.' : 'No external provider connection by default.'}</li><li>{language === 'ar' ? 'لا تعديل أو حذف أو نشر دون موافقة منفصلة.' : 'No edits, deletion, or publishing without separate approval.'}</li><li>{language === 'ar' ? 'كل قرار يُسجل في سجل التدقيق.' : 'Every decision is recorded in the audit log.'}</li><li>{language === 'ar' ? 'لا توجد كلمات مرور تجريبية مضمنة في الواجهة.' : 'No demo passwords are embedded in the interface.'}</li><li>{language === 'ar' ? 'المهام الخطرة تتطلب مراجعة بشرية.' : 'High-risk tasks require human review.'}</li></ul></div>
        <div className="panel-card audit-panel"><div className="section-heading"><div><h3>{language === 'ar' ? 'سجل العمليات' : 'Audit log'}</h3><p>{language === 'ar' ? 'آخر الأحداث المسجلة في الخادم' : 'Latest events recorded by the server'}</p></div><button className="button secondary" onClick={refresh}>{language === 'ar' ? 'تحديث السجل ↻' : 'Refresh log ↻'}</button></div><AuditList events={events}/></div>
      </section>}




      {active === 'agents' && <section className="content">
        <div className="section-heading"><div><h2>{language==='ar'?'استوديو الوكلاء والأتمتة':'Agents & automation studio'}</h2><p className="muted">{language==='ar'?'خطط مهام متعددة الخطوات وأرسلها للموافقة قبل أي تنفيذ.':'Plan multi-step tasks and request approval before any execution.'}</p></div><span className="pill">{language==='ar'?'مراجعة إلزامية':'Approval required'}</span></div>
        <div className="two-col">
          <div className="panel-card"><h3>{language==='ar'?'إنشاء خطة وكيل':'Create an agent plan'}</h3><form className="proposal-form" onSubmit={submitAgentPlan}>
            <label>{language==='ar'?'عنوان المهمة':'Task title'}<input value={agentDraft.title} onChange={e=>setAgentDraft({...agentDraft,title:e.target.value})} maxLength="120" minLength="3" required placeholder={language==='ar'?'مثال: تجهيز ونشر موقع الشركة':'Example: Prepare and publish company website'}/></label>
            <label>{language==='ar'?'خطوات التنفيذ (كل خطوة في سطر)':'Execution steps (one per line)'}<textarea rows="8" value={agentDraft.steps} onChange={e=>setAgentDraft({...agentDraft,steps:e.target.value})} maxLength="1800" required placeholder={language==='ar'?'1. مراجعة الملفات\n2. بناء نسخة الإنتاج\n3. فحص الروابط':'1. Review project files\n2. Build production version\n3. Check links'}/></label>
            <label>{language==='ar'?'مستوى المخاطر':'Risk level'}<select value={agentDraft.risk} onChange={e=>setAgentDraft({...agentDraft,risk:e.target.value})}><option value="low">{language==='ar'?'منخفض':'Low'}</option><option value="medium">{language==='ar'?'متوسط':'Medium'}</option><option value="high">{language==='ar'?'مرتفع':'High'}</option></select></label>
            <button className="button primary" disabled={agentSubmitting||!agentDraft.title.trim()||!agentDraft.steps.trim()}>{agentSubmitting?(language==='ar'?'جارٍ الإرسال…':'Submitting…'):(language==='ar'?'إرسال إلى الموافقات':'Submit for approval')}</button>
          </form></div>
          <div className="panel-card"><h3>{language==='ar'?'ضوابط التنفيذ':'Execution safeguards'}</h3><div className="roadmap-row"><span>{language==='ar'?'حفظ الخطة':'Plan storage'}</span><b className="good">{language==='ar'?'الخزنة المحلية':'Local vault'}</b></div><div className="roadmap-row"><span>{language==='ar'?'مراجعة بشرية':'Human review'}</span><b className="good">{language==='ar'?'مطلوبة':'Required'}</b></div><div className="roadmap-row"><span>{language==='ar'?'التنفيذ التلقائي':'Automatic execution'}</span><b>{language==='ar'?'معطل':'Disabled'}</b></div><p className="chat-footnote">{language==='ar'?'كل خطة تُسجل في طابور المهام وتُرسل أيضاً للموافقة البشرية. إنشاء المهمة أو الموافقة عليها لا يشغّل الأوامر؛ يلزم محرك تنفيذ مستقل ومراجعة أمان.':'Each plan is recorded in the task queue and separately submitted for human approval. Queueing or approving a task never executes commands; a separate execution engine and safety review are required.'}</p><button className="button secondary" onClick={()=>setActive('security')}>{language==='ar'?'فتح قائمة الموافقات':'Open approvals'}</button></div>
        </div>
        <div className="panel-card task-queue-panel">
          <div className="section-heading"><div><h3>{language==='ar'?'طابور المهام':'Task queue'}</h3><p className="muted">{language==='ar'?'المهام المحفوظة على الخادم. الإلغاء متاح قبل بدء أي تنفيذ.':'Tasks persisted on the server. Cancellation is available before execution starts.'}</p></div><div className="queue-tools"><span className="pill">{queuedTasks.length} {language==='ar'?'مهمة':'tasks'}</span><button className="button secondary" onClick={loadTasks} disabled={loadingTasks}>{loadingTasks?(language==='ar'?'جارٍ التحديث…':'Refreshing…'):(language==='ar'?'تحديث ↻':'Refresh ↻')}</button></div></div>
          {loadingTasks && !queuedTasks.length ? <Empty text={language==='ar'?'جارٍ تحميل المهام…':'Loading tasks…'}/> : queuedTasks.length ? <div className="task-queue-list">{queuedTasks.map((task)=> <article className="approval task-queue-item" key={task.id}>
            <div className="approval-top"><strong>{task.title}</strong><span className="pill">{task.status==='queued'?(language==='ar'?'في الانتظار':'Queued'):task.status==='waiting_approval'?(language==='ar'?'بانتظار الموافقة':'Awaiting approval'):task.status==='running'?(language==='ar'?'قيد التنفيذ':'Running'):task.status==='completed'?(language==='ar'?'مكتملة':'Completed'):task.status==='cancelled'?(language==='ar'?'ملغاة':'Cancelled'):task.status==='failed'?(language==='ar'?'فشلت':'Failed'):task.status}</span></div>
            {task.description && <p>{task.description}</p>}
            <small>{new Date(task.created_at).toLocaleString(language==='ar'?'ar':'en-US')}</small>
            {['queued','planning','waiting_approval','running'].includes(task.status) && <div className="approval-actions"><button className="button danger" disabled={taskActionId===task.id} onClick={()=>cancelQueuedTask(task.id)}>{taskActionId===task.id?(language==='ar'?'جارٍ الإلغاء…':'Cancelling…'):(language==='ar'?'إلغاء المهمة':'Cancel task')}</button></div>}
          </article>)}</div> : <Empty text={language==='ar'?'لا توجد مهام في الطابور بعد. أرسل أول خطة من النموذج أعلاه.':'The queue is empty. Submit your first plan using the form above.'}/>}
          <p className="chat-footnote">{language==='ar'?'الحالة «في الانتظار» تعني أن المهمة محفوظة فقط؛ لا يوجد تنفيذ تلقائي في هذه النسخة.':'Queued means saved only; no automatic execution engine is enabled in this build.'}</p>
        </div>
      </section>}
      {active === 'domains' && <section className="content">
        <div className="section-heading"><div><h2>{language==='ar'?'النطاقات والاستضافة':'Domains & hosting'}</h2><p className="muted">{language==='ar'?'تحقق من اسم النطاق وجهّز ملف خطوات النشر لمزودك.':'Validate a domain name and prepare a deployment runbook for your provider.'}</p></div></div>
        <div className="two-col">
          <div className="panel-card"><h3>{language==='ar'?'إعداد النشر':'Deployment setup'}</h3><form className="proposal-form" onSubmit={createDomainRunbook}>
            <label>{language==='ar'?'اسم النطاق':'Domain name'}<input value={domainDraft.domain} onChange={e=>setDomainDraft({...domainDraft,domain:e.target.value})} placeholder="example.com" required/></label>
            <label>{language==='ar'?'مزود الاستضافة':'Hosting provider'}<select value={domainDraft.provider} onChange={e=>setDomainDraft({...domainDraft,provider:e.target.value})}><option>Cloudflare Pages</option><option>GitHub Pages</option><option>Vercel</option><option>Netlify</option><option>Self-hosted Docker</option></select></label>
            <label>{language==='ar'?'اسم المشروع':'Project name'}<input value={domainDraft.project} onChange={e=>setDomainDraft({...domainDraft,project:e.target.value})} maxLength="80"/></label>
            <button className="button primary">{language==='ar'?'إنشاء خطة النشر':'Generate deployment runbook'}</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><h3>{language==='ar'?'خطة النشر':'Deployment runbook'}</h3><button className="button secondary" onClick={downloadDomainRunbook} disabled={!domainReport}>{language==='ar'?'تنزيل TXT':'Download TXT'}</button></div>{domainReport?<textarea rows="17" readOnly value={domainReport}/>:<Empty text={language==='ar'?'أدخل النطاق لإنشاء قائمة تحقق للنشر.':'Enter a domain to generate a deployment checklist.'}/>}<p className="chat-footnote">{language==='ar'?'هذه الأداة لا تشتري النطاقات ولا تغيّر سجلات DNS أو تنشر المشروع تلقائياً. يلزم حساب مزود وبيانات اعتماد مخزنة بأمان.':'This tool does not purchase domains, change DNS records, or deploy automatically. Provider accounts and securely stored credentials are required.'}</p></div>
        </div>
      </section>}
      {active === 'design' && <section className="content">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'استوديو التصميم والهوية' : 'Design & identity studio'}</h2><p className="muted">{language === 'ar' ? 'أنشئ لوحة هوية قابلة للتصدير مع الحفاظ على الشعار الرسمي المعتمد.' : 'Create an exportable identity concept while preserving the approved official logo.'}</p></div><span className="pill">{language === 'ar' ? 'مسودة تصميم' : 'Design draft'}</span></div>
        <div className="two-col">
          <div className="panel-card"><h3>{language === 'ar' ? 'بيانات الهوية' : 'Identity details'}</h3><form className="proposal-form" onSubmit={prepareBrandIdentity}>
            <label>{language === 'ar' ? 'اسم العلامة' : 'Brand name'}<input value={brandDraft.name} onChange={e=>setBrandDraft({...brandDraft,name:e.target.value})} maxLength="80" required/></label>
            <label>{language === 'ar' ? 'الأحرف المختصرة' : 'Monogram'}<input value={brandDraft.initials} onChange={e=>setBrandDraft({...brandDraft,initials:e.target.value})} maxLength="4"/></label>
            <label>{language === 'ar' ? 'الشعار النصي' : 'Tagline'}<input value={brandDraft.tagline} onChange={e=>setBrandDraft({...brandDraft,tagline:e.target.value})} maxLength="100"/></label>
            <label>{language === 'ar' ? 'اللون الرئيسي' : 'Primary color'}<input type="color" value={brandDraft.primary} onChange={e=>setBrandDraft({...brandDraft,primary:e.target.value})}/></label>
            <label>{language === 'ar' ? 'لون الخلفية' : 'Background color'}<input type="color" value={brandDraft.secondary} onChange={e=>setBrandDraft({...brandDraft,secondary:e.target.value})}/></label>
            <label>{language === 'ar' ? 'اللون المساعد' : 'Accent color'}<input type="color" value={brandDraft.accent} onChange={e=>setBrandDraft({...brandDraft,accent:e.target.value})}/></label>
            <button className="button primary">{language === 'ar' ? 'تحديث لوحة الهوية' : 'Prepare identity sheet'}</button>
          </form></div>
          <div className="panel-card"><h3>{language === 'ar' ? 'معاينة الهوية' : 'Identity preview'}</h3><svg viewBox="0 0 600 460" role="img" aria-label="Brand identity concept" style={{width:'100%',borderRadius:'16px',background:brandDraft.secondary}}>
            <path d="M300 55 L410 100 V215 Q410 300 300 355 Q190 300 190 215 V100 Z" fill="none" stroke={brandDraft.primary} strokeWidth="7"/><path d="M235 135 L260 105 L282 130 L300 100 L318 130 L340 105 L365 135" fill="none" stroke={brandDraft.accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><text x="300" y="245" textAnchor="middle" fill={brandDraft.primary} fontSize="112" fontFamily="Georgia,serif" fontWeight="bold">{brandDraft.initials.slice(0,4).toUpperCase()}</text><path d="M160 375 H440" stroke={brandDraft.primary} strokeWidth="2"/><text x="300" y="410" textAnchor="middle" fill={brandDraft.accent} fontSize="23" letterSpacing="3">{brandDraft.name.slice(0,32)}</text><text x="300" y="438" textAnchor="middle" fill={brandDraft.primary} fontSize="11" letterSpacing="2">{brandDraft.tagline.slice(0,54)}</text>
          </svg><div className="module-action-list"><button className="button secondary" onClick={downloadBrandSvg} disabled={!brandReady}>{language === 'ar' ? 'تصدير SVG' : 'Export SVG'}</button><button className="button secondary" onClick={downloadBrandGuide} disabled={!brandReady}>{language === 'ar' ? 'تصدير دليل الهوية TXT' : 'Export brand guide TXT'}</button></div><p className="chat-footnote">{language === 'ar' ? 'هذه مسودة مفاهيمية ولا تعدّل الشعار الذهبي الرسمي لـ SOULARAB TECH.' : 'This is a concept draft and does not alter the official gold SOULARAB TECH logo.'}</p></div>
        </div>
      </section>}
      {active === 'apps' && <section className="content">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'منشئ التطبيقات' : 'Application starter'}</h2><p className="muted">{language === 'ar' ? 'أنشئ واجهة تطبيق متعددة الأقسام مع معاينة وتصدير ملف مستقل.' : 'Create a multi-section app interface with preview and standalone export.'}</p></div></div>
        <div className="two-col">
          <div className="panel-card"><h3>{language === 'ar' ? 'إعداد التطبيق' : 'App setup'}</h3><form className="proposal-form" onSubmit={buildAppStarter}>
            <label>{language === 'ar' ? 'اسم التطبيق' : 'App name'}<input value={appDraft.name} onChange={e=>setAppDraft({...appDraft,name:e.target.value})} maxLength="80" required/></label>
            <label>{language === 'ar' ? 'وصف التطبيق' : 'App description'}<textarea rows="3" value={appDraft.description} onChange={e=>setAppDraft({...appDraft,description:e.target.value})} maxLength="500"/></label>
            <label>{language === 'ar' ? 'الأقسام (كل قسم في سطر)' : 'Sections (one per line)'}<textarea rows="6" value={appDraft.features} onChange={e=>setAppDraft({...appDraft,features:e.target.value})} maxLength="1200"/></label>
            <label>{language === 'ar' ? 'اللون الرئيسي' : 'Primary color'}<input type="color" value={appDraft.color} onChange={e=>setAppDraft({...appDraft,color:e.target.value})}/></label>
            <button className="button primary">{language === 'ar' ? 'إنشاء واجهة التطبيق' : 'Generate app interface'}</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><div><h3>{language === 'ar' ? 'المعاينة والتصدير' : 'Preview & export'}</h3><p className="muted">{language === 'ar' ? 'واجهة أولية قابلة للتطوير وربطها بقاعدة بيانات.' : 'An interface starter ready for future backend integration.'}</p></div><button className="button secondary" onClick={downloadAppStarter} disabled={!appHtml}>{language === 'ar' ? 'تنزيل HTML' : 'Download HTML'}</button></div>{appHtml ? <iframe title="Application preview" sandbox="" srcDoc={appHtml} style={{width:'100%',minHeight:'520px',border:'1px solid var(--line)',borderRadius:'14px',background:'#111'}}/> : <Empty text={language === 'ar' ? 'أدخل بيانات التطبيق ثم أنشئ المعاينة.' : 'Enter app details and generate a preview.'}/>}</div>
        </div><p className="chat-footnote">{language === 'ar' ? 'هذه واجهة ثابتة أولية؛ تسجيل الدخول وقواعد البيانات والتزامن تحتاج خادماً وربطاً إضافياً.' : 'This is a static UI starter; authentication, databases, and synchronization need additional backend integration.'}</p>
      </section>}
      {active === 'web' && <section className="content">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'منشئ المواقع' : 'Website builder'}</h2><p className="muted">{language === 'ar' ? 'أنشئ صفحة هبوط أولية، شاهد معاينتها مباشرة، ثم نزّل ملف HTML مستقلاً.' : 'Create a starter landing page, preview it live, and download a standalone HTML file.'}</p></div></div>
        <div className="two-col">
          <div className="panel-card"><h3>{language === 'ar' ? 'محتوى الصفحة' : 'Page content'}</h3><form className="proposal-form" onSubmit={buildLandingPage}>
            <label>{language === 'ar' ? 'اسم الموقع' : 'Website name'}<input value={siteDraft.title} onChange={(e) => setSiteDraft({...siteDraft,title:e.target.value})} maxLength="80" required/></label>
            <label>{language === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}<input value={siteDraft.subtitle} onChange={(e) => setSiteDraft({...siteDraft,subtitle:e.target.value})} maxLength="120"/></label>
            <label>{language === 'ar' ? 'وصف مختصر' : 'Short description'}<textarea rows="4" value={siteDraft.description} onChange={(e) => setSiteDraft({...siteDraft,description:e.target.value})} maxLength="600"/></label>
            <label>{language === 'ar' ? 'نص زر التواصل' : 'Contact button label'}<input value={siteDraft.buttonText} onChange={(e) => setSiteDraft({...siteDraft,buttonText:e.target.value})} maxLength="40"/></label>
            <label>{language === 'ar' ? 'اللون الأساسي' : 'Primary color'}<input type="color" value={siteDraft.color} onChange={(e) => setSiteDraft({...siteDraft,color:e.target.value})}/></label>
            <button className="button primary">{language === 'ar' ? 'إنشاء المعاينة' : 'Generate preview'}</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><div><h3>{language === 'ar' ? 'معاينة مباشرة' : 'Live preview'}</h3><p className="muted">{language === 'ar' ? 'صفحة ثابتة مستقلة دون مكتبات خارجية.' : 'Standalone static page with no external libraries.'}</p></div><button className="button secondary" onClick={downloadLandingPage} disabled={!siteHtml}>{language === 'ar' ? 'تنزيل HTML' : 'Download HTML'}</button></div>
            {siteHtml ? <iframe title="Website preview" sandbox="" srcDoc={siteHtml} style={{width:'100%',minHeight:'520px',border:'1px solid var(--line)',borderRadius:'14px',background:'#101014'}}/> : <Empty text={language === 'ar' ? 'أدخل المحتوى ثم اضغط إنشاء المعاينة.' : 'Enter your content and generate the preview.'}/>}
          </div>
        </div>
        <p className="chat-footnote">{language === 'ar' ? 'هذه نسخة أولية ثابتة تعمل محلياً داخل المتصفح. ربط النطاقات والاستضافة والنشر يحتاج مزوداً وإعدادات وصول فعلية.' : 'This is a static starter page generated in your browser. Domains, hosting, and publishing require a real provider and credentials.'}</p>
      </section>}
      {active === 'media' && <section className="content">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'الصور والصوت' : 'Images & Audio'}</h2><p className="muted">{language === 'ar' ? 'اتصال محلي بمحركات الوسائط دون إرسال ملفاتك إلى خدمات سحابية.' : 'Local media engines; your files are not sent to cloud services.'}</p></div><button className="button secondary" onClick={refreshMediaEngines} disabled={mediaStatus.loading}>{language === 'ar' ? 'فحص المحركات ↻' : 'Check engines ↻'}</button></div>
        <div className="two-col">
          <div className="panel-card">
            <div className="section-heading"><div><h3>{language === 'ar' ? 'توليد الصور — ComfyUI' : 'Image generation — ComfyUI'}</h3><p className="muted">{language === 'ar' ? 'اكتب وصف الصورة واختر نموذجاً مثبتاً؛ تُبنى عقد ComfyUI تلقائياً. ويمكنك استخدام سير عمل API المتقدم عند الحاجة.' : 'Send an API-format workflow to your local ComfyUI engine.'}</p></div><span className={mediaStatus.image ? 'pill connected' : 'pill'}>{mediaStatus.loading ? '…' : mediaStatus.image ? (language === 'ar' ? 'متصل' : 'Connected') : (language === 'ar' ? 'غير متصل' : 'Offline')}</span></div>
<p className="chat-footnote">{mediaStatus.image && mediaModels.length === 0 ? (language === 'ar' ? 'المحرك متصل، لكن لم يُعثر على نماذج Checkpoint مثبتة. أضف نموذجاً إلى مجلد models/checkpoints في ComfyUI ثم أعد الفحص.' : 'Engine connected, but no checkpoint models were found. Add a model to ComfyUI models/checkpoints and check again.') : (language === 'ar' ? 'تُعرض النماذج المثبتة تلقائياً بعد فحص المحرك.' : 'Installed checkpoints appear automatically after checking the engine.')}</p>
                        <form className="proposal-form" onSubmit={queuePromptImage}>
              <label>{language === 'ar' ? 'نموذج التوليد' : 'Checkpoint model'}<select value={imageDraft.model} onChange={(e) => setImageDraft({...imageDraft,model:e.target.value})} disabled={!mediaModels.length}><option value="">{language === 'ar' ? 'اختر نموذجاً مثبتاً' : 'Select an installed model'}</option>{mediaModels.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
              <label>{language === 'ar' ? 'وصف الصورة المطلوب' : 'Image prompt'}<textarea rows="4" value={imageDraft.prompt} onChange={(e) => setImageDraft({...imageDraft,prompt:e.target.value})} maxLength="3000" required/></label>
              <label>{language === 'ar' ? 'الوصف السلبي (اختياري)' : 'Negative prompt (optional)'}<textarea rows="2" value={imageDraft.negative} onChange={(e) => setImageDraft({...imageDraft,negative:e.target.value})} maxLength="1500"/></label>
              <div className="two-col"><label>{language === 'ar' ? 'العرض' : 'Width'}<input type="number" min="256" max="1536" step="64" value={imageDraft.width} onChange={(e) => setImageDraft({...imageDraft,width:e.target.value})}/></label><label>{language === 'ar' ? 'الارتفاع' : 'Height'}<input type="number" min="256" max="1536" step="64" value={imageDraft.height} onChange={(e) => setImageDraft({...imageDraft,height:e.target.value})}/></label></div>
              <label>{language === 'ar' ? 'خطوات الجودة' : 'Sampling steps'}<input type="number" min="1" max="60" value={imageDraft.steps} onChange={(e) => setImageDraft({...imageDraft,steps:e.target.value})}/></label>
              <button className="button primary" disabled={mediaBusy || !mediaStatus.image || !mediaModels.length || !imageDraft.prompt.trim()}>{mediaBusy ? (language === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : (language === 'ar' ? 'توليد الصورة' : 'Generate image')}</button>
            </form>
            <details className="advanced-settings"><summary>{language === 'ar' ? 'إعداد متقدم: سير عمل ComfyUI بصيغة API' : 'Advanced: ComfyUI API workflow'}</summary><form className="proposal-form" onSubmit={queueMediaWorkflow}><label>{language === 'ar' ? 'سير العمل JSON' : 'Workflow JSON'}<textarea rows="8" value={mediaWorkflow} onChange={(e) => setMediaWorkflow(e.target.value)} spellCheck="false"/></label><button className="button secondary" disabled={mediaBusy || !mediaStatus.image || !mediaWorkflow.trim()}>{language === 'ar' ? 'إرسال سير العمل المتقدم' : 'Queue advanced workflow'}</button></form></details>
            {mediaQueue && <><div className="roadmap-row"><span>{language === 'ar' ? 'معرّف المهمة' : 'Prompt ID'}</span><b>{mediaQueue.prompt_id}</b></div><button className="button secondary" onClick={loadMediaHistory} disabled={mediaBusy}>{language === 'ar' ? 'فحص نتيجة المهمة' : 'Check job result'}</button>{mediaHistory && <><label>{language === 'ar' ? 'بيانات النتيجة' : 'Result data'}<textarea rows="6" readOnly value={JSON.stringify(mediaHistory, null, 2)}/></label>{mediaImages.length > 0 && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'12px',marginTop:'14px'}}>{mediaImages.map((item,index)=><figure key={item.url} style={{margin:0}}><img src={item.url} alt={item.name} style={{width:'100%',height:'auto',borderRadius:'12px',border:'1px solid var(--line)'}}/><figcaption className="chat-footnote">{item.name}</figcaption></figure>)}</div>}</>}</>}
            <p className="chat-footnote">{language === 'ar' ? 'يلزم تشغيل ComfyUI على جهاز الخادم وتصدير سير العمل بصيغة API. زر الإرسال ينفذ المهمة المطلوبة محلياً.' : 'Run ComfyUI on the server and export the workflow in API format. Submitting queues the requested local job.'}</p>
          </div>
          <div className="panel-card">
            <div className="section-heading"><div><h3>{language === 'ar' ? 'تحويل الصوت إلى نص — whisper.cpp' : 'Speech to text — whisper.cpp'}</h3><p className="muted">{language === 'ar' ? 'تفريغ ملفات صوتية باستخدام محرك محلي.' : 'Transcribe audio files using a local engine.'}</p></div><span className={mediaStatus.speech ? 'pill connected' : 'pill'}>{mediaStatus.loading ? '…' : mediaStatus.speech ? (language === 'ar' ? 'متصل' : 'Connected') : (language === 'ar' ? 'غير متصل' : 'Offline')}</span></div>
            <label className="upload-control">{language === 'ar' ? 'اختر ملفاً صوتياً (حد أقصى 25 MB)' : 'Choose an audio file (25 MB maximum)'}<input type="file" accept=".wav,.mp3,.m4a,.ogg,.webm,.flac,.mp4,.mpeg,.mpga,audio/*" onChange={transcribeAudio} disabled={mediaBusy || !mediaStatus.speech}/></label>
            {mediaBusy && <p className="muted">{language === 'ar' ? 'جارٍ معالجة الملف محلياً…' : 'Processing locally…'}</p>}
            {mediaTranscript && <div className="chat-message assistant"><small>{language === 'ar' ? 'النص المستخرج' : 'Transcript'}</small><p>{mediaTranscript}</p><button className="text-button" onClick={() => navigator.clipboard?.writeText(mediaTranscript)}>{language === 'ar' ? 'نسخ النص' : 'Copy text'}</button></div>}
            <p className="chat-footnote">{language === 'ar' ? 'يدعم WAV مباشرة. تتطلب الصيغ الأخرى تشغيل whisper-server بخيار --convert وتثبيت FFmpeg. الملف لا يغادر خادمك المحلي.' : 'WAV works natively. Other formats require whisper-server with --convert and FFmpeg installed. Files stay on your local server.'}</p>
          </div>
        </div>
      </section>}
      {!['overview','security','files','assistant','media','web','design','apps','agents','domains','work','hub','root','settings','vault'].includes(active) && <section className="content">
        <div className="module-intro panel-card"><Icon>{current.icon}</Icon><h2>{current.title}</h2><p>{current.desc}</p><span className="pill">{language === 'ar' ? 'مساحة تجهيز العمل' : 'Work preparation space'}</span></div>
        <div className="module-workspace-grid">
          <div className="panel-card"><h3>{language === 'ar' ? 'إعداد مهمة جديدة' : 'Create a new task'}</h3><p className="muted">{language === 'ar' ? 'اكتب المطلوب واحفظه في الخزنة كتكليف قابل للمتابعة. لن ندّعي تنفيذ خدمة خارجية قبل ربط محركها فعلياً.' : 'Describe the task and save it to the vault for follow-up. External services will not be presented as active until their engines are connected.'}</p>
            <form className="proposal-form" onSubmit={(event) => { event.preventDefault(); if (!moduleDraft.title.trim() || !moduleDraft.details.trim()) return; setVaultItems((items) => [{ id: Date.now(), title: moduleDraft.title.trim(), content: current.title + '\\n\\n' + moduleDraft.details.trim(), category: 'task', createdAt: new Date().toISOString() }, ...items]); setModuleDraft({ title: '', details: '' }); setNotice('تم حفظ التكليف في الخزنة المحلية.'); }}>
              <label>{language === 'ar' ? 'عنوان المهمة' : 'Task title'}<input value={moduleDraft.title} onChange={(e) => setModuleDraft({...moduleDraft,title:e.target.value})} required maxLength="120" placeholder={language === 'ar' ? 'مثال: إعداد صفحة هبوط' : 'Example: Create a landing page'}/></label>
              <label>{language === 'ar' ? 'التفاصيل والمتطلبات' : 'Details and requirements'}<textarea rows="5" value={moduleDraft.details} onChange={(e) => setModuleDraft({...moduleDraft,details:e.target.value})} required maxLength="12000" placeholder={language === 'ar' ? 'اكتب الهدف والنتيجة المطلوبة والقيود…' : 'Describe the goal, expected outcome, and constraints…'}/></label>
              <button className="button primary" disabled={!moduleDraft.title.trim() || !moduleDraft.details.trim()}>{language === 'ar' ? 'حفظ التكليف في الخزنة' : 'Save task to vault'}</button>
            </form>
          </div>
          <div className="panel-card"><h3>{language === 'ar' ? 'أدوات مساحة العمل' : 'Workspace tools'}</h3><div className="module-action-list">
            <button className="module-action" onClick={() => setActive('assistant')}><span>✦</span><div><strong>{language === 'ar' ? 'روح — المساعد الذكي' : 'Rooh — AI assistant'}</strong><small>{language === 'ar' ? 'تحليل المتطلبات وصياغة خطة العمل' : 'Analyze requirements and draft a work plan'}</small></div><b>{language === 'ar' ? 'فتح ←' : 'Open ←'}</b></button>
            <button className="module-action" onClick={() => setActive('files')}><span>▱</span><div><strong>{language === 'ar' ? 'ملفات ومشاريع' : 'Files & projects'}</strong><small>{language === 'ar' ? 'إنشاء مساحة مشروع وإدارة ملفاته' : 'Create a project workspace and manage its files'}</small></div><b>{language === 'ar' ? 'فتح ←' : 'Open ←'}</b></button>
            <button className="module-action" onClick={() => setActive('vault')}><span>▣</span><div><strong>{language === 'ar' ? 'الخزنة' : 'Vault'}</strong><small>{language === 'ar' ? 'الرجوع إلى التكليفات والملاحظات المحفوظة' : 'Review saved tasks and notes'}</small></div><b>{language === 'ar' ? 'فتح ←' : 'Open ←'}</b></button>
            <button className="module-action" onClick={() => setActive('security')}><span>⬡</span><div><strong>{language === 'ar' ? 'الأمان والموافقات' : 'Security & approvals'}</strong><small>{language === 'ar' ? 'مراجعة الطلبات قبل أي إجراء مؤثر' : 'Review requests before impactful actions'}</small></div><b>{language === 'ar' ? 'فتح ←' : 'Open ←'}</b></button>
          </div><div className="roadmap-row"><span>{language === 'ar' ? 'واجهة القسم' : 'Section interface'}</span><b className="good">{language === 'ar' ? 'جاهزة' : 'Ready'}</b></div><div className="roadmap-row"><span>{language === 'ar' ? 'الخادم المحلي' : 'Local server'}</span><b className={api.state === 'online' ? 'good' : 'warn'}>{api.state === 'online' ? (language === 'ar' ? 'متصل' : 'Connected') : (language === 'ar' ? 'غير متصل' : 'Disconnected')}</b></div><div className="roadmap-row"><span>{language === 'ar' ? 'محرك التنفيذ الخارجي' : 'External execution engine'}</span><b>{language === 'ar' ? 'غير مربوط بعد' : 'Not connected yet'}</b></div></div>
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
