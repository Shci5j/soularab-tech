import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalBackend } from '@soularab/local-backend';
import { getEmbeddedNodeHealth, localNodeRequest } from './services/localNodes.js';
import { cleanApiBase, safeApiBase } from './utils/apiUrl.js';

const API = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');
const modules = [
  { id: 'overview', title: 'نظرة عامة', icon: '⌂', desc: 'مركز إدارة المنصة وحالة الخدمات' },
  { id: 'assistant', title: 'المساعد الذكي', icon: '✦', desc: 'محادثة مع النماذج المحلية والوكلاء' },
  { id: 'web', title: 'المواقع والمتاجر', icon: '▤', desc: 'إنشاء المواقع وإدارتها وفحصها' },
  { id: 'design', title: 'التصميم والهوية', icon: '◈', desc: 'الشعارات والهوية وتجارب المستخدم' },
  { id: 'media', title: 'توليد الصور', icon: '▧', desc: 'توليد الصور وتحريرها عبر محرك محلي' },
  { id: 'video', title: 'إنشاء الفيديو', icon: '▶', desc: 'تخطيط المشاهد وخط إنتاج الفيديو' },
  { id: 'store', title: 'المتاجر الإلكترونية', icon: '▣', desc: 'المنتجات والكتالوج والسلة والطلبات' },
  { id: 'apps', title: 'بناء التطبيقات', icon: '▦', desc: 'تطوير التطبيقات وفحص المشاريع' },
  { id: 'graphics', title: 'التصميم الجرافيكي', icon: '◫', desc: 'المنشورات والقوالب والمطبوعات' },
  { id: 'documents', title: 'المستندات والملفات', icon: '▱', desc: 'إنشاء المستندات وإدارة ملفات المشاريع' },
  { id: 'files', title: 'المشاريع والأرشفة', icon: '▤', desc: 'مساحات المشاريع والنسخ والاستعادة' },
  { id: 'agents', title: 'الوكلاء الذكيون', icon: '⌘', desc: 'خطط متعددة الخطوات بموافقات صريحة' },
  { id: 'automation', title: 'الأتمتة والجدولة', icon: '◷', desc: 'مشغلات محلية وطوابير مهام محكومة' },
  { id: 'domains', title: 'النطاقات والاستضافة', icon: '◎', desc: 'إعدادات النطاق والنشر والاستضافة' },
  { id: 'security', title: 'الأمان وسجل العمليات', icon: '⬡', desc: 'الموافقات وسجل التدقيق والإعدادات' },
  { id: 'terminal', title: 'طرفية Termux', icon: '⌘', desc: 'تنفيذ أوامر محلية عبر Termux على الهاتف' },
];

const englishModules = { overview: ['Overview', 'Workspace overview and service status'], assistant: ['AI Assistant', 'Chat with local models and agents'], web: ['Websites & Stores', 'Create, manage, and inspect websites'], design: ['Design & Identity', 'Logos, brand identity, and user experience'], media: ['Image Generation', 'Generate and edit images through a local engine'], video: ['Video Studio', 'Plan scenes and assemble a video pipeline'], store: ['Online Stores', 'Products, catalog, cart, and order workflows'], apps: ['App Builder', 'Develop and inspect applications'], graphics: ['Graphic Design', 'Create social posts, templates, and print layouts'], documents: ['Documents', 'Create documents and manage project files'], files: ['Projects & Archives', 'Project workspaces, versions, and restore'], agents: ['AI Agents', 'Multi-step plans with explicit approvals'], automation: ['Automation & Scheduling', 'Controlled local triggers and task queues'], domains: ['Domains & Hosting', 'Domain, deployment, and hosting settings'], security: ['Security & Audit', 'Approvals, audit history, and controls'], terminal: ['Termux Terminal', 'Run local phone commands through the Termux app'] };

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('st-language') || 'ar');
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('st-api-base-url') || API);
  const [active, setActiveState] = useState('overview');
  const [departmentDraft, setDepartmentDraft] = useState({ title: '', details: '', risk: 'medium' });
  const [departmentSubmitting, setDepartmentSubmitting] = useState(false);
  const [departmentResult, setDepartmentResult] = useState(null);
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
  const [embeddedBackend, setEmbeddedBackend] = useState({ running: false, nodes: [] });
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState('pending');
  const [events, setEvents] = useState([]);
  const [engineStatuses, setEngineStatuses] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('st-theme') || 'dark');
  const [preferences, setPreferences] = useState(() => {
    try { return { font: 'ibm', fontScale: 100, density: 'comfortable', reducedMotion: false, highContrast: false, defaultModel: '', defaultTemperature: 0.7, dateFormat: 'long', timeZone: 'local', refreshIntervalSeconds: 15, sessionTimeoutMinutes: 0, ...JSON.parse(localStorage.getItem('st-preferences') || '{}') }; }
    catch { return { font: 'ibm', fontScale: 100, density: 'comfortable', reducedMotion: false, highContrast: false, defaultModel: '', defaultTemperature: 0.7, dateFormat: 'long', timeZone: 'local', refreshIntervalSeconds: 15, sessionTimeoutMinutes: 0 }; }
  });
  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState({ title: '', description: '', risk: 'medium' });
  const [apiToken, setApiToken] = useState(() => sessionStorage.getItem('st-api-token') || '');
  const [authRequired, setAuthRequired] = useState(false);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [securityStatusLoading, setSecurityStatusLoading] = useState(false);
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
  const [studioProjectId, setStudioProjectId] = useState('');
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
  const [siteGenerating, setSiteGenerating] = useState(false);
  const [brandDraft, setBrandDraft] = useState({ name:'SOULARAB TECH', initials:'ST', tagline:'IDEAS INTO DIGITAL REALITY', primary:'#c49a43', secondary:'#171519', accent:'#e8d9b5' });
  const [brandReady, setBrandReady] = useState(false);
  const [brandBrief, setBrandBrief] = useState(null);
  const [brandBriefGenerating, setBrandBriefGenerating] = useState(false);
  const [appDraft, setAppDraft] = useState({ name:'My Workspace App', description:'A focused space to organize work and ideas.', color:'#c49a43', features:'Dashboard\nProjects\nSettings' });
  const [appHtml, setAppHtml] = useState('');
  const [appGenerating, setAppGenerating] = useState(false);
  const [agentDraft, setAgentDraft] = useState({ title:'', steps:'', risk:'medium' });
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [agentGenerating, setAgentGenerating] = useState(false);
  const [queuedTasks, setQueuedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskActionId, setTaskActionId] = useState(null);
  const [executionInputs, setExecutionInputs] = useState({});
  const [executionActions, setExecutionActions] = useState([]);
  const [loadingExecutionActions, setLoadingExecutionActions] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskHistoryId, setTaskHistoryId] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);
  const [domainDraft, setDomainDraft] = useState({ domain:'', provider:'Cloudflare Pages', project:'soularab-site' });
  const [domainReport, setDomainReport] = useState('');
  const [terminalCommand, setTerminalCommand] = useState('pwd');
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [terminalBusy, setTerminalBusy] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(() => localStorage.getItem('st-app-lock-enabled') === 'true');
  const [appLocked, setAppLocked] = useState(() => localStorage.getItem('st-app-lock-enabled') === 'true');
  const [appPin, setAppPin] = useState('');
  const [appPinConfirm, setAppPinConfirm] = useState('');
  const [appLockError, setAppLockError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [rootAccess, setRootAccess] = useState({ available: false, checked: false, message: '' });

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
    setNotice(language === 'ar' ? 'تم حفظ العنصر في الخزنة المحلية على هذا الجهاز.' : 'Item saved to the local vault on this device.');
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
        throw new Error(language === 'ar' ? 'صيغة النسخة الاحتياطية غير صالحة.' : 'Invalid backup file format.');
      }
      setVaultItems(parsed.map((item, index) => ({ id: item.id || Date.now() + index, title: item.title, content: item.content, category: item.category || 'note', createdAt: item.createdAt || new Date().toISOString() })));
      setNotice(language === 'ar' ? 'تم استيراد عناصر الخزنة بنجاح.' : 'Vault items imported successfully.');
    } catch (error) { setNotice(error.message || (language === 'ar' ? 'تعذر قراءة ملف النسخة الاحتياطية.' : 'Could not read the backup file.')); }
  }

  useEffect(() => {
    const fonts = { ibm: "'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif", system: "system-ui, sans-serif", tahoma: "Tahoma, Arial, sans-serif", georgia: "Georgia, serif" };
    document.documentElement.style.fontFamily = fonts[preferences.font] || fonts.ibm;
    document.body.style.zoom = String(preferences.fontScale / 100);
    document.documentElement.dataset.density = preferences.density;
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
    document.documentElement.dataset.highContrast = String(Boolean(preferences.highContrast));
    localStorage.setItem('st-preferences', JSON.stringify(preferences));
  }, [preferences]);

  async function hashAppPin(pin, saltHex) {
    if (!globalThis.crypto?.subtle) throw new Error(language === 'ar' ? 'التشفير الآمن غير متاح في هذا الجهاز.' : 'Secure cryptography is unavailable on this device.');
    const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map((part) => parseInt(part, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function saveAppPin() {
    if (!/^\d{6}$/.test(appPin) || appPin !== appPinConfirm) {
      setAppLockError(language === 'ar' ? 'أدخل رمزاً من 6 أرقام وتأكد من تطابق الرمزَين.' : 'Enter a 6-digit PIN and make sure both entries match.');
      return;
    }
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const hash = await hashAppPin(appPin, salt);
      localStorage.setItem('st-app-lock-salt', salt);
      localStorage.setItem('st-app-lock-hash', hash);
      localStorage.setItem('st-app-lock-enabled', 'true');
      setAppLockEnabled(true);
      setAppLocked(false);
      setAppPin(''); setAppPinConfirm(''); setAppLockError('');
      setNotice(language === 'ar' ? 'تم تفعيل قفل التطبيق برمز PIN.' : 'App PIN lock enabled.');
    } catch (error) { setAppLockError(error.message); }
  }

  async function unlockApp() {
    try {
      const salt = localStorage.getItem('st-app-lock-salt') || '';
      const expected = localStorage.getItem('st-app-lock-hash') || '';
      const actual = await hashAppPin(appPin, salt);
      if (actual !== expected) {
        setAppLockError(language === 'ar' ? 'رمز القفل غير صحيح.' : 'Incorrect PIN.');
        setAppPin('');
        return;
      }
      setAppLocked(false); setAppPin(''); setAppLockError('');
    } catch (error) { setAppLockError(error.message); }
  }

  async function unlockWithBiometric() {
    try {
      const availability = await LocalBackend.biometricAvailability();
      setBiometricAvailable(Boolean(availability.available));
      if (!availability.available) throw new Error(language === 'ar' ? 'البصمة القوية غير مهيأة أو غير متاحة على هذا الجهاز.' : 'Strong biometrics are not enrolled or available on this device.');
      await LocalBackend.authenticateBiometric({ title: 'SOULARAB TECH', subtitle: language === 'ar' ? 'تأكيد الهوية لفتح التطبيق' : 'Verify your identity to unlock the app' });
      setAppLocked(false); setAppPin(''); setAppLockError('');
    } catch (error) { setAppLockError(error.message || (language === 'ar' ? 'فشل التحقق البيومتري.' : 'Biometric verification failed.')); }
  }

  async function inspectRootAccess() {
    if (!Capacitor.isNativePlatform() || !LocalBackend.checkRootAccess) {
      setRootAccess({ available: false, checked: true, message: language === 'ar' ? 'صلاحيات الجذر متاحة فقط على Android مروّت.' : 'Root access is available only on a rooted Android device.' });
      return;
    }
    try {
      const result = await LocalBackend.checkRootAccess();
      setRootAccess({ ...result, checked: true });
      setNotice(result.available ? (language === 'ar' ? 'تم اكتشاف صلاحيات الجذر UID 0.' : 'Root UID 0 access detected.') : (language === 'ar' ? 'هذا الهاتف لا يمنح التطبيق صلاحيات الجذر.' : 'This phone did not grant root access.'));
    } catch (error) { setRootAccess({ available: false, checked: true, message: error.message }); }
  }

  function lockAppNow() {
    if (appLockEnabled) { setAppLocked(true); setAppPin(''); setAppLockError(''); }
  }

  function removeAppLock() {
    localStorage.removeItem('st-app-lock-salt');
    localStorage.removeItem('st-app-lock-hash');
    localStorage.removeItem('st-app-lock-enabled');
    setAppLockEnabled(false); setAppLocked(false); setAppPin(''); setAppPinConfirm(''); setAppLockError('');
    setNotice(language === 'ar' ? 'تم تعطيل قفل التطبيق.' : 'App lock disabled.');
  }

  function exportSettingsBackup() {
    const backup = {
      format: 'soularab-settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { language, theme, preferences, apiBaseUrl: cleanApiBase(apiBaseUrl) },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'soularab-settings-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    setNotice(language === 'ar' ? 'تم تنزيل نسخة إعدادات الواجهة. لم تتضمن مفاتيح الدخول.' : 'Settings backup downloaded. Authentication tokens were not included.');
  }

  async function importSettingsBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error(language === 'ar' ? 'حجم ملف الإعدادات يتجاوز الحد المسموح.' : 'Settings file exceeds the allowed size.');
      const parsed = JSON.parse(await file.text());
      const settings = parsed?.settings;
      if (parsed?.format !== 'soularab-settings' || parsed?.version !== 1 || !settings || !['ar', 'en'].includes(settings.language) || !['dark', 'light'].includes(settings.theme) || typeof settings.preferences !== 'object' || settings.preferences === null) {
        throw new Error(language === 'ar' ? 'ملف الإعدادات غير صالح أو غير مدعوم.' : 'Invalid or unsupported settings backup.');
      }
      const nextPreferences = {
        font: ['ibm', 'system', 'tahoma', 'georgia'].includes(settings.preferences.font) ? settings.preferences.font : 'ibm',
        fontScale: [85, 90, 95, 100, 105, 110, 115, 120, 125].includes(Number(settings.preferences.fontScale)) ? Number(settings.preferences.fontScale) : 100,
        density: ['comfortable', 'compact'].includes(settings.preferences.density) ? settings.preferences.density : 'comfortable',
        reducedMotion: Boolean(settings.preferences.reducedMotion),
        highContrast: Boolean(settings.preferences.highContrast),
        defaultModel: typeof settings.preferences.defaultModel === 'string' && settings.preferences.defaultModel.length <= 120 ? settings.preferences.defaultModel : '',
        defaultTemperature: Number.isFinite(Number(settings.preferences.defaultTemperature)) && Number(settings.preferences.defaultTemperature) >= 0 && Number(settings.preferences.defaultTemperature) <= 2 ? Number(settings.preferences.defaultTemperature) : 0.7,
        dateFormat: ['long', 'medium', 'short'].includes(settings.preferences.dateFormat) ? settings.preferences.dateFormat : 'long',
        timeZone: ['local', 'UTC'].includes(settings.preferences.timeZone) ? settings.preferences.timeZone : 'local',
        refreshIntervalSeconds: [15, 30, 60].includes(Number(settings.preferences.refreshIntervalSeconds)) ? Number(settings.preferences.refreshIntervalSeconds) : 15,
        sessionTimeoutMinutes: [0, 15, 30, 60].includes(Number(settings.preferences.sessionTimeoutMinutes)) ? Number(settings.preferences.sessionTimeoutMinutes) : 0,
      };
      let nextApiUrl = '';
      if (typeof settings.apiBaseUrl === 'string') {
        try { nextApiUrl = safeApiBase(settings.apiBaseUrl); }
        catch { throw new Error(language === 'ar' ? 'عنوان الخادم في النسخة الاحتياطية غير آمن أو غير صالح.' : 'The backend URL in this backup is unsafe or invalid.'); }
      }
      setPreferences(nextPreferences);
      if (models.some((model) => model.name === nextPreferences.defaultModel)) setSelectedModel(nextPreferences.defaultModel);
      setLanguage(settings.language);
      setTheme(settings.theme);
      setApiBaseUrl(nextApiUrl);
      setNotice(language === 'ar' ? 'تم استيراد الإعدادات. لم يتم استيراد كلمات المرور أو رموز الوصول.' : 'Settings restored. Passwords and access tokens were not imported.');
    } catch (error) {
      setNotice(error.message || (language === 'ar' ? 'تعذر استيراد الإعدادات.' : 'Could not import settings.'));
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('st-theme', theme);
  }, [theme]);

  useEffect(() => {
    const minutes = Number(preferences.sessionTimeoutMinutes || 0);
    let timeoutId = null;
    if (!apiToken || ![15, 30, 60].includes(minutes)) {
      window.clearTimeout(timeoutId);
      return;
    }
    const timeoutMs = minutes * 60 * 1000;
    const expireSession = () => {
      sessionStorage.removeItem('st-api-token');
      sessionStorage.removeItem('st-last-activity');
      setApiToken('');
      setLoginToken('');
      setAuthRequired(true);
      setNotice(language === 'ar' ? 'انتهت جلسة الوصول بسبب عدم النشاط. أدخل رمز الوصول للمتابعة.' : 'Your access session expired after inactivity. Enter your access token to continue.');
    };
    const schedule = () => {
      const last = Number(sessionStorage.getItem('st-last-activity') || Date.now());
      const remaining = timeoutMs - (Date.now() - last);
      window.clearTimeout(timeoutId);
      if (remaining <= 0) expireSession();
      else timeoutId = window.setTimeout(expireSession, remaining);
    };
    const recordActivity = () => {
      sessionStorage.setItem('st-last-activity', String(Date.now()));
      schedule();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') schedule(); };
    if (!sessionStorage.getItem('st-last-activity')) sessionStorage.setItem('st-last-activity', String(Date.now()));
    schedule();
    window.addEventListener('pointerdown', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('touchstart', recordActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [apiToken, preferences.sessionTimeoutMinutes, language]);

  function localizeApiError(detail, status) {
    if (language !== 'en' || typeof detail !== 'string') return detail;
    const exact = new Map([
      ['رمز الوصول غير صحيح أو غير موجود.', 'The access token is missing or invalid.'],
      ['خدمة Ollama المحلية غير متصلة. شغّل Ollama على جهاز الخادم.', 'The local Ollama service is offline. Start Ollama on the server.'],
      ['انتهت مهلة انتظار النموذج المحلي.', 'The local model request timed out.'],
      ['أعاد مزود النموذج استجابة غير صالحة.', 'The model provider returned an invalid response.'],
      ['النموذج المحدد غير موجود في Ollama المحلية.', 'The selected model is not installed in local Ollama.'],
      ['لم يُرجع النموذج محتوى.', 'The model returned no content.'],
      ['محرك الوسائط المحلي غير متصل. تحقق من تشغيل الخدمة على جهاز الخادم.', 'The local media engine is offline. Check that the service is running on the server.'],
      ['انتهت مهلة انتظار محرك الوسائط المحلي.', 'The local media engine request timed out.'],
      ['أعاد محرك الوسائط استجابة غير صالحة.', 'The media engine returned an invalid response.'],
      ['صيغة سير عمل ComfyUI غير صالحة.', 'The ComfyUI workflow format is invalid.'],
      ['ComfyUI غير متصل. شغّل المحرك المحلي أولاً.', 'ComfyUI is offline. Start the local engine first.'],
      ['انتهت مهلة إرسال مهمة التوليد إلى ComfyUI.', 'The ComfyUI generation request timed out.'],
      ['لم يُرجع ComfyUI معرّف مهمة صالحاً.', 'ComfyUI did not return a valid job ID.'],
      ['ComfyUI غير متصل.', 'ComfyUI is offline.'],
      ['انتهت مهلة تحميل الصورة.', 'Image download timed out.'],
      ['تعذر جلب الصورة من ComfyUI.', 'Could not retrieve the image from ComfyUI.'],
      ['whisper.cpp غير متصل. شغّل خادم التفريغ الصوتي المحلي أولاً.', 'whisper.cpp is offline. Start the local transcription server first.'],
      ['انتهت مهلة تفريغ الملف الصوتي.', 'Audio transcription timed out.'],
      ['أعاد محرك التفريغ نصاً غير صالح.', 'The transcription engine returned invalid text.'],
      ['لم يُرجع محرك التفريغ نصاً.', 'The transcription engine returned no text.'],
      ['المشروع غير موجود.', 'Project not found.'],
      ['المشروع مؤرشف مسبقاً.', 'Project is already archived.'],
      ['لا يمكن رفع ملفات إلى مشروع مؤرشف.', 'Files cannot be uploaded to an archived project.'],
      ['الملف غير موجود.', 'File not found.'],
      ['الملف موجود مسبقاً.', 'File already exists.'],
      ['الحد الأقصى لحجم الملف 10 ميغابايت.', 'The maximum file size is 10 MB.'],
      ['لا يمكن رفع ملف فارغ.', 'Empty files cannot be uploaded.'],
      ['طلب الموافقة غير موجود.', 'Approval request not found.'],
      ['تم اتخاذ قرار بشأن هذا الطلب مسبقاً.', 'A decision has already been recorded for this request.'],
      ['المهمة غير موجودة.', 'Task not found.'],
      ['لا توجد مساحة مشروع نشطة. أنشئ مشروعاً أولاً من قسم الملفات والمشاريع.', 'No active project. Create one in Files & Projects first.'],
    ]);
    if (exact.has(detail)) return exact.get(detail);
    const mediaStatus = detail.match(/^رفض محرك الوسائط الطلب \((\d+)\)\.$/);
    if (mediaStatus) return 'The media engine rejected the request (' + mediaStatus[1] + ').';
    const speechStatus = detail.match(/^فشل التفريغ الصوتي \((\d+)\)\.$/);
    if (speechStatus) return 'Audio transcription failed (' + speechStatus[1] + ').';
    if (/[\u0600-\u06FF]/.test(detail)) return 'The server rejected the request (' + status + ').';
    return detail;
  }

  async function request(path, options = {}) {
    if (Capacitor.isNativePlatform()) {
      const method = String(options.method || 'GET').toUpperCase();
      const nativeBody = options.body ? JSON.parse(options.body) : {};
      if (path === '/api/health') return { ...(await getEmbeddedNodeHealth('A')), version: 'embedded-android', mode: 'local' };
      if (path === '/api/assistant/status' || path === '/api/assistant/models') return await localNodeRequest('A', '/models');
      if (path === '/api/assistant/chat' && method === 'POST') return await localNodeRequest('A', '/chat', { method: 'POST', body: JSON.stringify(nativeBody) });
      if (path === '/api/tasks' && method === 'GET') return { items: await localNodeRequest('E', '/tasks') };
      if (path === '/api/agent-plans' && method === 'POST') {
        const queued = await localNodeRequest('E', '/dispatch', { method: 'POST', body: JSON.stringify({ taskType: nativeBody.department || active, payload: nativeBody }) });
        return { id: queued.taskId, status: queued.status, assignedNode: queued.assignedNode, execution: 'queued_on_device' };
      }
      if (path === '/api/tasks' && method === 'POST') {
        const queued = await localNodeRequest('E', '/dispatch', { method: 'POST', body: JSON.stringify({ taskType: nativeBody.department || 'general', payload: nativeBody }) });
        return { id: queued.taskId, status: queued.status, assignedNode: queued.assignedNode, execution: 'queued_on_device' };
      }
      const nativeTaskAction = path.match(/^\/api\/tasks\/(\d+)\/(cancel|pause|resume|priority)$/);
      if (nativeTaskAction && method === 'POST') return await localNodeRequest('E', '/tasks/' + nativeTaskAction[1] + '/' + nativeTaskAction[2], { method: 'POST', body: options.body || JSON.stringify({}) });
      if (/^\/api\/tasks\/\d+\/events$/.test(path)) return { items: [] };
      if (/^\/api\/tasks\/\d+$/.test(path) && method === 'GET') return await localNodeRequest('E', path.replace('/api', ''));
      if (path === '/api/engines/status' || path === '/api/mesh/status' || path === '/api/mesh/discover' || path === '/api/mesh/nodes/') {
        const ids = ['A', 'B', 'C', 'D', 'E'];
        const nodes = await Promise.all(ids.map(async (id) => {
          try { return await getEmbeddedNodeHealth(id); }
          catch { return { node: id, status: 'offline' }; }
        }));
        if (path === '/api/engines/status') return { providers: Object.fromEntries(nodes.map((node) => [node.node, { connected: node.status === 'online', provider: 'embedded-android' }])) };
        return { connected: nodes.some((node) => node.status === 'online'), nodes };
      }
      if (path === '/api/approvals') return { items: [] };
      if (path.startsWith('/api/audit')) return { items: [] };
      if (path === '/api/executions/registry') return { items: [], policy: 'native_allowlist_pending' };
      if (path === '/api/security/status') return { mode: 'embedded-local', authentication: 'device-local', node: await getEmbeddedNodeHealth('E') };
      if (path === '/api/media/image/status') return { connected: false, provider: 'not_installed', node: await getEmbeddedNodeHealth('C') };
      if (path === '/api/media/speech/status') return { connected: false, provider: 'not_installed', node: await getEmbeddedNodeHealth('D') };
      if (path === '/api/media/image/models') return { models: [] };
      throw new Error(language === 'ar'
        ? 'هذا الإجراء يحتاج محركاً محلياً غير مثبت أو واجهة تنفيذ لم تُفعّل بعد: ' + path
        : 'This action requires a local engine or execution API that is not installed yet: ' + path);
    }
    const response = await fetch(safeApiBase(apiBaseUrl) + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}), ...options.headers },
    });
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    let body = null;
    if (rawBody) {
      try { body = JSON.parse(rawBody); }
      catch {
        const detail = contentType.includes('text/html') || /^\s*<!doctype html/i.test(rawBody)
          ? (language === 'ar'
              ? 'وصلت صفحة HTML بدلاً من JSON. عنوان الخادم الخلفي أو مسار API غير صحيح.'
              : 'Received an HTML page instead of JSON. The backend URL or API route is incorrect.')
          : (language === 'ar' ? 'أعاد الخادم بيانات ليست بصيغة JSON.' : 'The server returned a non-JSON response.');
        throw new Error(detail);
      }
    }
    if (!response.ok) {
      if (response.status === 401) setAuthRequired(true);
      throw new Error(localizeApiError(body?.detail, response.status) || (language === 'ar' ? `تعذر إكمال الطلب (${response.status})` : `Request failed (${response.status}).`));
    }
    if (!contentType.includes('application/json') && body === null) {
      throw new Error(language === 'ar' ? 'استجابة الخادم فارغة أو غير صالحة.' : 'The server response is empty or invalid.');
    }
    return body;
  }

  function unlockWorkspace(event) {
    event.preventDefault();
    const value = loginToken.trim();
    if (!value) return;
    sessionStorage.setItem('st-api-token', value);
    sessionStorage.setItem('st-last-activity', String(Date.now()));
    setApiToken(value);
    setAuthRequired(false);
    setLoginToken('');
  }

  async function controlEmbeddedNode(id, action) {
    if (!Capacitor.isNativePlatform() || !LocalBackend.controlNode) return;
    try {
      const status = await LocalBackend.controlNode({ id, action });
      setEmbeddedBackend(status);
      setNotice(language === 'ar' ? (action === 'start' ? 'تم تشغيل الخادم ' : 'تم إيقاف الخادم ') + id : 'Node ' + id + (action === 'start' ? ' started.' : ' stopped.'));
    } catch (error) {
      setNotice(error.message || (language === 'ar' ? 'تعذر التحكم بالخادم.' : 'Could not control the node.'));
    }
  }

  async function refresh() {
    try {
      if (Capacitor.isNativePlatform()) {
        const [checks, localTasks] = await Promise.all([
          Promise.all(['A', 'B', 'C', 'D', 'E'].map(async (id) => {
            try { return await getEmbeddedNodeHealth(id); }
            catch { return { status: 'offline', node: id }; }
          })),
          localNodeRequest('E', '/tasks').catch(() => []),
        ]);
        const online = checks.filter((item) => item.status === 'online').length;
        setApi({ state: online === 5 ? 'online' : 'offline', version: 'embedded-android', mode: language === 'ar' ? `خوادم داخلية: ${online}/5` : `Embedded nodes: ${online}/5` });
        setApprovals([]);
        setEvents([]);
        setQueuedTasks(Array.isArray(localTasks) ? localTasks : []);
        setEngineStatuses(Object.fromEntries(checks.map((item) => [item.node, { connected: item.status === 'online', provider: 'embedded-android', worker: item.worker, taskExecution: item.taskExecution }])));
        if (online !== 5) setNotice(language === 'ar' ? `بعض الخوادم الداخلية غير متاحة (${online}/5).` : `Some embedded nodes are unavailable (${online}/5).`);
        return;
      }
      const [health, approvalData, log, taskQueue, engineData] = await Promise.all([
        request('/api/health'), request('/api/approvals'), request('/api/audit?limit=8'), request('/api/tasks'), request('/api/engines/status').catch(() => null),
      ]);
      setApi({ state: 'online', version: health.version || '0.1.0', mode: health.mode || 'local' });
      setApprovals(approvalData.items || []);
      setEngineStatuses(engineData?.providers || {});
      setEvents(log.items || []);
      setQueuedTasks(Array.isArray(taskQueue.items) ? taskQueue.items : []);
    } catch (error) {
      setApi({ state: 'offline', version: '—' });
      setNotice(error.message.includes('Failed to fetch') ? (language === 'ar' ? 'الخادم غير متصل حالياً. شغّل خدمة FastAPI لربط لوحة التحكم.' : 'The backend is offline. Start the FastAPI service to connect the dashboard.') : error.message);
    }
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let active = true;
    LocalBackend.start()
      .then(async (status) => {
        if (!active) return;
        if (status.accessToken) sessionStorage.setItem('st-embedded-local-token', status.accessToken);
        const checkedNodes = await Promise.all(status.nodes.map(async (node) => {
          try {
            const health = await getEmbeddedNodeHealth(node.id);
            return { ...node, running: health.status === 'online' };
          } catch {
            return { ...node, running: false };
          }
        }));
        if (active) setEmbeddedBackend({ ...status, nodes: checkedNodes, running: checkedNodes.length === 5 && checkedNodes.every((node) => node.running) });
      })
      .catch((error) => {
        if (active) setNotice((language === 'ar' ? 'تعذر تشغيل الخوادم الداخلية: ' : 'Could not start embedded nodes: ') + (error?.message || 'unknown error'));
      });
    return () => { active = false; };
  }, []);
  
  useEffect(() => { refresh(); const id = window.setInterval(refresh, (preferences.refreshIntervalSeconds || 15) * 1000); return () => clearInterval(id); }, [apiToken, preferences.refreshIntervalSeconds]);

  async function loadSecurityStatus() {
    setSecurityStatusLoading(true);
    try {
      const result = await request('/api/security/status');
      setSecurityStatus(result);
    } catch (error) {
      setSecurityStatus(null);
      setNotice(error.message);
    } finally {
      setSecurityStatusLoading(false);
    }
  }

  async function loadAssistant() {
    setAssistantStatus({ connected: false, loading: true });
    try {
      const nativeApp = Capacitor.isNativePlatform();
      const [status, result] = nativeApp
        ? [null, await localNodeRequest('A', '/models')]
        : await Promise.all([request('/api/assistant/status'), request('/api/assistant/models')]);
      setAssistantStatus({ connected: nativeApp ? Boolean(result.connected) : status.connected, loading: false, version: nativeApp ? 'llama.cpp' : status.version });
      setModels(result.items || []);
      setSelectedModel((current) => result.items?.some((item) => item.name === current) ? current : (result.items?.some((item) => item.name === preferences.defaultModel) ? preferences.defaultModel : result.items?.[0]?.name || ''));
      if (!result.items?.length) setNotice(nativeApp ? (language === 'ar' ? 'محرك روح متصل، لكن لم يُعثر على نموذج. تحقق من تشغيل llama-server في Termux.' : 'Rooh engine is online, but no model was found. Check llama-server in Termux.') : (language === 'ar' ? 'Ollama متصلة، لكن لا توجد نماذج مثبتة بعد.' : 'Ollama is connected, but no models are installed yet.'));
    } catch (error) {
      setAssistantStatus({ connected: false, loading: false });
      setModels([]);
      setNotice(error.message);
    }
  }

  async function runTerminalCommand(event) {
    event.preventDefault();
    const command = terminalCommand.trim();
    if (!command || terminalBusy) return;
    if (!Capacitor.isNativePlatform() || !LocalBackend.runTermuxCommand) {
      setNotice(language === 'ar' ? 'طرفية Termux متاحة في نسخة Android فقط.' : 'The Termux bridge is available in the Android app only.');
      return;
    }
    setTerminalBusy(true);
    try {
      await LocalBackend.runTermuxCommand({ command });
      setTerminalHistory((items) => [{ command, at: new Date().toISOString(), status: 'sent' }, ...items].slice(0, 30));
      setNotice(language === 'ar' ? 'أُرسل الأمر إلى Termux. ستظهر نتيجته في جلسة Termux المفتوحة.' : 'Command sent to Termux. Its output appears in the Termux session.');
    } catch (error) {
      setNotice(language === 'ar' ? 'تعذر تشغيل الأمر عبر Termux: ' + error.message : 'Could not run the command through Termux: ' + error.message);
    } finally { setTerminalBusy(false); }
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
      const payload = { model: selectedModel, temperature: Number(preferences.defaultTemperature ?? 0.7), messages: next };
      const result = Capacitor.isNativePlatform() && embeddedBackend.running
        ? await localNodeRequest('A', '/chat', { method: 'POST', body: JSON.stringify(payload) })
        : await request('/api/assistant/chat', { method: 'POST', body: JSON.stringify(payload) });
      setChatMessages([...next, result.message]);
    } catch (error) {
      setChatMessages([...next, { role: 'assistant', content: (language === 'ar' ? 'تعذر إكمال الطلب: ' : 'Request failed: ') + error.message }]);
    } finally {
      setSendingChat(false);
    }
  }

  useEffect(() => { if (active === 'assistant') loadAssistant(); }, [active, apiToken]);
  useEffect(() => { if (active === 'security') loadSecurityStatus(); }, [active, apiToken, apiBaseUrl]);
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
      if (results.every((result) => result.status === 'rejected')) setNotice(results[0].reason?.message || (language === 'ar' ? 'تعذر فحص محركات الوسائط.' : 'Could not check media engines.'));
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
          const response = await fetch(safeApiBase(apiBaseUrl) + '/api/media/image/view?' + params.toString(), {
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
      const response = await fetch(safeApiBase(apiBaseUrl) + '/api/media/transcribe', {
        method: 'POST',
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(localizeApiError(result.detail, response.status) || (language === 'ar' ? 'تعذر تفريغ الملف الصوتي.' : 'Audio transcription failed.'));
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
      setNotice(language === 'ar' ? 'تم إنشاء مساحة المشروع ومجلدها المحلي.' : 'Project workspace and local folder created.');
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
      setNotice(language === 'ar' ? 'تمت أرشفة المشروع دون حذف ملفاته.' : 'Project archived without deleting its files.');
      await loadProjects();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (['files', 'web', 'apps'].includes(active)) loadProjects(); }, [active, apiToken]);

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
      setNotice(language === 'ar' ? 'حجم الملف يتجاوز الحد المسموح (10 ميغابايت).' : 'File size exceeds the 10 MB limit.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setUploadingFile(true);
    try {
      const response = await fetch(safeApiBase(apiBaseUrl) + '/api/projects/' + selectedProject.id + '/files', {
        method: 'POST',
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(localizeApiError(result.detail, response.status) || (language === 'ar' ? 'تعذر رفع الملف.' : 'File upload failed.'));
      setNotice(language === 'ar' ? 'تم رفع الملف بنجاح.' : 'File uploaded successfully.');
      await openProject(selectedProject);
    } catch (error) { setNotice(error.message); }
    finally { setUploadingFile(false); }
  }

  async function downloadProjectFile(filename) {
    if (!selectedProject) return;
    try {
      const response = await fetch(safeApiBase(apiBaseUrl) + '/api/projects/' + selectedProject.id + '/files/' + encodeURIComponent(filename), {
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(localizeApiError(result.detail, response.status) || (language === 'ar' ? 'تعذر تنزيل الملف.' : 'File download failed.'));
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

  async function importProjectArchive(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip') || file.size > 50 * 1024 * 1024) {
      setNotice(language === 'ar' ? 'اختر ملف ZIP لا يتجاوز 50 MB.' : 'Choose a ZIP file no larger than 50 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      const response = await fetch(safeApiBase(apiBaseUrl) + '/api/projects/import', {
        method: 'POST',
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(localizeApiError(result.detail, response.status) || (language === 'ar' ? 'تعذرت استعادة المشروع.' : 'Could not restore the project.'));
      setNotice(language === 'ar'
        ? 'تمت استعادة المشروع: ' + result.title + ' (' + result.restored_files + ' ملف).'
        : 'Project restored: ' + result.title + ' (' + result.restored_files + ' files).');
      await loadProjects();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportProject(project) {
    try {
      const response = await fetch(safeApiBase(apiBaseUrl) + '/api/projects/' + project.id + '/export', {
        headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {},
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(localizeApiError(result.detail, response.status) || (language === 'ar' ? 'تعذر تصدير المشروع.' : 'Could not export the project.'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'soularab-project-' + project.id + '.zip';
      link.click();
      URL.revokeObjectURL(url);
      setNotice(language === 'ar' ? 'تم تجهيز أرشيف المشروع للتنزيل.' : 'Project archive is ready to download.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function deleteProjectFile(filename) {
    if (!selectedProject) return;
    const confirmed = window.confirm(language === 'ar' ? 'هل تريد حذف الملف "' + filename + '" نهائياً؟' : 'Permanently delete "' + filename + '"?');
    if (!confirmed) return;
    setUploadingFile(true);
    try {
      await request('/api/projects/' + selectedProject.id + '/files/' + encodeURIComponent(filename), { method: 'DELETE' });
      setNotice(language === 'ar' ? 'تم حذف الملف.' : 'File deleted.');
      await openProject(selectedProject);
    } catch (error) { setNotice(error.message); }
    finally { setUploadingFile(false); }
  }

  async function createProposal(event) {
    event.preventDefault();
    if (!proposal.title.trim() || !proposal.description.trim()) return;
    setBusy(true);
    try {
      await request('/api/approvals', { method: 'POST', body: JSON.stringify(proposal) });
      setProposal({ title: '', description: '', risk: 'medium' });
      setNotice(language === 'ar' ? 'تم تسجيل طلب الموافقة. لم يُنفّذ أي إجراء.' : 'Approval request recorded. No action was executed.');
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function decide(id, decision) {
    setBusy(true);
    try {
      const result = await request(`/api/approvals/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, note: language === 'ar' ? 'قرار من لوحة التحكم' : 'Decision made from the dashboard' }) });
      if (result.task_id) {
        setNotice(decision === 'approved'
          ? (language === 'ar' ? 'تمت الموافقة ونُقلت المهمة إلى قائمة الانتظار. لم يبدأ التنفيذ.' : 'Approved and moved the linked task to the queue. Execution has not started.')
          : (language === 'ar' ? 'تم رفض الطلب وإلغاء المهمة المرتبطة.' : 'Request rejected and linked task cancelled.'));
      } else {
        setNotice(decision === 'approved' ? (language === 'ar' ? 'سُجلت الموافقة فقط؛ التنفيذ يحتاج خطوة مستقلة.' : 'Approval recorded only; execution requires a separate step.') : (language === 'ar' ? 'تم رفض الطلب وتسجيل القرار.' : 'Request rejected and decision recorded.'));
      }
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
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))) { setRepoError(language === 'ar' ? 'أدخل المستودع بصيغة owner/repository.' : 'Enter the repository as owner/repository.'); return; }
    setRepoLoading(true); setRepoError('');
    try {
      const [details, contents] = await Promise.all([fetch('https://api.github.com/repos/' + target), fetch('https://api.github.com/repos/' + target + '/contents')]);
      if (!details.ok) throw new Error(details.status === 404 ? (language === 'ar' ? 'المستودع غير موجود أو غير متاح للعامة.' : 'Repository not found or not publicly available.') : (language === 'ar' ? 'تعذر قراءة بيانات المستودع (' + details.status + ').' : 'Could not read repository details (' + details.status + ').'));
      if (!contents.ok) throw new Error(language === 'ar' ? 'تعذر قراءة الملفات (' + contents.status + ').' : 'Could not read repository files (' + contents.status + ').');
      setRepoInfo(await details.json());
      const items = await contents.json(); setRepoFiles(Array.isArray(items) ? items : []);
    } catch (error) { setRepoInfo(null); setRepoFiles([]); setRepoError(error.message || (language === 'ar' ? 'تعذر الاتصال بـ GitHub.' : 'Could not connect to GitHub.')); }
    finally { setRepoLoading(false); }
  }

  async function generateStudioDraft(target) {
    const isWebsite = target === 'website';
    const setGenerating = isWebsite ? setSiteGenerating : setAppGenerating;
    const draft = isWebsite ? siteDraft : appDraft;
    if (isWebsite ? siteGenerating : appGenerating) return;
    setGenerating(true);
    try {
      let model = selectedModel;
      if (!model) {
        const available = await request('/api/assistant/models');
        model = available.items && available.items.length ? available.items[0].name : '';
      }
      if (!model) throw new Error('No local model installed');
      const prompt = isWebsite
        ? (language === 'ar' ? 'اكتب محتوى احترافياً لصفحة هبوط عربية. أعد JSON صالحاً فقط بالمفاتيح title وsubtitle وdescription وbuttonText. اسم النشاط: ' + draft.title + '. الوصف الحالي: ' + draft.description : 'Write polished landing page copy. Return JSON only with title, subtitle, description, buttonText. Business: ' + draft.title + '. Description: ' + draft.description)
        : (language === 'ar' ? 'اقترح بنية تطبيق عملية. أعد JSON فقط بالمفاتيح name وdescription وfeatures، واجعل features مصفوفة من 4 إلى 7 أقسام قصيرة. اسم التطبيق: ' + draft.name + '. الوصف: ' + draft.description : 'Suggest an app structure. Return JSON only with name, description, features as an array of 4 to 7 short section names. App: ' + draft.name + '. Description: ' + draft.description);
      const result = await request('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ model: model, temperature: 0.45, messages: [{ role: 'user', content: prompt }] }) });
      const raw = result.message && result.message.content ? result.message.content.trim() : '';
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      if (isWebsite) {
        if (![parsed.title, parsed.subtitle, parsed.description, parsed.buttonText].every((value) => typeof value === 'string' && value.trim())) throw new Error('Invalid website draft');
        setSiteDraft((current) => ({ ...current, title: parsed.title.slice(0,80), subtitle: parsed.subtitle.slice(0,120), description: parsed.description.slice(0,600), buttonText: parsed.buttonText.slice(0,40) }));
        setNotice(language === 'ar' ? 'جهّز روح محتوى الصفحة. راجعه ثم أنشئ المعاينة.' : 'Rooh drafted the page copy. Review it and generate the preview.');
      } else {
        if (typeof parsed.name !== 'string' || typeof parsed.description !== 'string' || !Array.isArray(parsed.features)) throw new Error('Invalid app draft');
        const features = parsed.features.filter((value) => typeof value === 'string' && value.trim()).slice(0,8);
        if (features.length < 3) throw new Error('Not enough app sections');
        setAppDraft((current) => ({ ...current, name: parsed.name.slice(0,80), description: parsed.description.slice(0,500), features: features.join('\n').slice(0,1200) }));
        setNotice(language === 'ar' ? 'جهّز روح هيكل التطبيق. راجعه ثم أنشئ المعاينة.' : 'Rooh drafted the app structure. Review it and generate the preview.');
      }
    } catch (error) {
      setNotice(language === 'ar' ? 'تعذر إنشاء المسودة. تحقق من اتصال النموذج المحلي وصيغة استجابته.' : 'Could not create the draft. Check the local model connection and response format.');
    } finally { setGenerating(false); }
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
  async function generateBrandBrief() {
    if (brandBriefGenerating) return;
    setBrandBriefGenerating(true);
    try {
      let model = selectedModel;
      if (!model) {
        const available = await request('/api/assistant/models');
        model = available.items && available.items.length ? available.items[0].name : '';
      }
      if (!model) throw new Error('No local model installed');
      const prompt = language === 'ar'
        ? 'أنت مستشار هوية بصرية. أنشئ موجز علامة تجارية عملياً وأعد JSON صالحاً فقط بالمفاتيح positioning وaudience وvoice وvisualDirection وapplications (مصفوفة من 3 تطبيقات). لا تقترح تغيير الشعار أو الألوان المحددة؛ قدم توصيات نصية فقط. العلامة: ' + brandDraft.name + '. الشعار النصي: ' + brandDraft.tagline + '. الألوان الحالية: ' + brandDraft.primary + ' و' + brandDraft.secondary + ' و' + brandDraft.accent
        : 'Act as a brand strategist. Return valid JSON only with positioning, audience, voice, visualDirection, and applications (an array of 3 applications). Do not suggest changing the existing logo or selected colors; provide text recommendations only. Brand: ' + brandDraft.name + '. Tagline: ' + brandDraft.tagline + '. Current colors: ' + brandDraft.primary + ', ' + brandDraft.secondary + ', ' + brandDraft.accent;
      const result = await request('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ model: model, temperature: 0.4, messages: [{ role: 'user', content: prompt }] }) });
      const raw = result.message && result.message.content ? result.message.content.trim() : '';
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      if (![parsed.positioning, parsed.audience, parsed.voice, parsed.visualDirection].every((value) => typeof value === 'string' && value.trim()) || !Array.isArray(parsed.applications)) throw new Error('Invalid brand brief');
      setBrandBrief({ positioning: parsed.positioning.slice(0,500), audience: parsed.audience.slice(0,500), voice: parsed.voice.slice(0,500), visualDirection: parsed.visualDirection.slice(0,700), applications: parsed.applications.filter((value) => typeof value === 'string').slice(0,3) });
      setNotice(language === 'ar' ? 'أعدّت روح موجز الهوية دون تغيير الشعار أو الألوان.' : 'Rooh prepared a brand brief without changing the logo or colors.');
    } catch (error) {
      setNotice(language === 'ar' ? 'تعذر إعداد موجز الهوية. تحقق من اتصال النموذج المحلي.' : 'Could not prepare the brand brief. Check the local model connection.');
    } finally { setBrandBriefGenerating(false); }
  }
  function downloadBrandBrief() {
    if (!brandBrief) return;
    const lines = [
      brandDraft.name + ' — ' + brandDraft.tagline,
      '',
      (language === 'ar' ? 'التموضع' : 'Positioning') + ': ' + brandBrief.positioning,
      (language === 'ar' ? 'الجمهور المستهدف' : 'Target audience') + ': ' + brandBrief.audience,
      (language === 'ar' ? 'نبرة العلامة' : 'Brand voice') + ': ' + brandBrief.voice,
      (language === 'ar' ? 'الاتجاه البصري' : 'Visual direction') + ': ' + brandBrief.visualDirection,
      (language === 'ar' ? 'تطبيقات الهوية' : 'Identity applications') + ':',
      ...brandBrief.applications.map((item, index) => (index + 1) + '. ' + item),
      '',
      (language === 'ar' ? 'الألوان المعتمدة' : 'Approved colors') + ': ' + [brandDraft.primary, brandDraft.secondary, brandDraft.accent].join(' / '),
      language === 'ar' ? 'تم إعداد هذا الموجز محلياً بمساعدة SOULARAB TECH.' : 'Prepared locally with SOULARAB TECH.'
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'soularab-brand-strategy-brief.txt'; link.click();
    URL.revokeObjectURL(url);
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


  async function saveStudioArtifact(kind) {
    const html = kind === 'website' ? siteHtml : appHtml;
    const projectId = Number(studioProjectId);
    const project = projects.find((item) => item.id === projectId && item.status === 'active');
    if (!html || !project) {
      setNotice(language === 'ar' ? 'اختر مشروعاً نشطاً وأنشئ المعاينة أولاً.' : 'Select an active project and generate the preview first.');
      return;
    }
    const sourceName = kind === 'website' ? siteDraft.title : appDraft.name;
    const slug = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'soularab';
    const filename = (kind === 'website' ? 'website-' : 'app-') + slug + '-' + Date.now() + '.html';
    const form = new FormData();
    form.append('file', new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
    setUploadingFile(true);
    try {
      const response = await fetch(safeApiBase(apiBaseUrl) + '/api/projects/' + projectId + '/files', {
        method: 'POST', headers: apiToken ? { Authorization: 'Bearer ' + apiToken } : {}, body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(localizeApiError(result.detail, response.status) || (language === 'ar' ? 'تعذر حفظ ملف المعاينة داخل المشروع.' : 'Could not save preview to project.'));
      setNotice(language === 'ar' ? 'تم حفظ ملف HTML داخل مشروع ' + project.title + ': ' + result.name : 'HTML saved to ' + project.title + ': ' + result.name);
      await loadProjects();
    } catch (error) { setNotice(error.message); }
    finally { setUploadingFile(false); }
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

  async function loadExecutionRegistry() {
    setLoadingExecutionActions(true);
    try {
      const result = await request('/api/executions/registry');
      setExecutionActions(Array.isArray(result.items) ? result.items : []);
    } catch (error) {
      setExecutionActions([]);
      setNotice(error.message);
    } finally {
      setLoadingExecutionActions(false);
    }
  }

  async function toggleTaskHistory(taskId) {
    if (taskHistoryId === taskId) {
      setTaskHistoryId(null);
      setTaskHistory([]);
      return;
    }
    setTaskHistoryId(taskId);
    setLoadingTaskHistory(true);
    try {
      const result = await request('/api/tasks/' + taskId + '/events');
      setTaskHistory(Array.isArray(result.items) ? result.items : []);
    } catch (error) {
      setTaskHistory([]);
      setNotice(error.message);
    } finally {
      setLoadingTaskHistory(false);
    }
  }

  async function controlQueuedTask(taskId, action, priority) {
    setTaskActionId(taskId);
    try {
      await request('/api/tasks/' + taskId + '/' + action, { method: 'POST', body: action === 'priority' ? JSON.stringify({ priority }) : JSON.stringify({}) });
      setNotice(language === 'ar' ? 'تم تحديث حالة المهمة في الطابور المحلي.' : 'Local queue task updated.');
      await refresh();
    } catch (error) { setNotice(error.message); }
    finally { setTaskActionId(null); }
  }

  async function cancelQueuedTask(taskId) {
    setTaskActionId(taskId);
    try {
      await request('/api/tasks/' + taskId + '/cancel', { method: 'POST' });
      setNotice(language === 'ar' ? 'تم إلغاء المهمة من قائمة الانتظار.' : 'Task cancelled from the queue.');
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setTaskActionId(null);
    }
  }

  async function executeQueuedTask(task) {
    const draft = executionInputs[task.id] || {};
    const projectId = Number(draft.projectId);
    const action = draft.action || executionActions[0]?.id || 'write_project_note';
    const filename = (draft.filename || (action === 'export_project_inventory' ? 'inventory.md' : 'task-' + task.id + '.md')).trim();
    const text = (draft.content ?? task.description ?? '').trim();
    if (!Number.isInteger(projectId) || projectId < 1 || !filename || (action === 'write_project_note' && !text)) {
      setNotice(language === 'ar' ? 'اختر مشروعاً نشطاً واسم ملف، وأدخل المحتوى عند اختيار حفظ ملاحظة.' : 'Select an active project and filename; enter content when saving a note.');
      return;
    }
    setTaskActionId(task.id);
    try {
      const payload = { action, project_id: projectId, filename };
      if (action === 'write_project_note') payload.content = text;
      const result = await request('/api/tasks/' + task.id + '/execute', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNotice(language === 'ar' ? 'اكتمل التنفيذ وحُفظ الملف: ' + result.artifact : 'Execution completed. Saved: ' + result.artifact);
      await refresh();
      if (taskHistoryId === task.id) await toggleTaskHistory(task.id);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setTaskActionId(null);
    }
  }

  useEffect(() => {
    if (active === 'agents') { loadTasks(); loadProjects(); loadExecutionRegistry(); }
  }, [active, apiToken]);

  const departmentConfig = {
    store: { name: 'المتاجر الإلكترونية', node: 'E', engineId: 'workspace-commerce', provider: 'Embedded Node E', engineStatus: 'queue_only', prompt: 'محرك تطوير E يستقبل خطة المتجر ويجهز مهام بناء مساحة العمل؛ لا توجد بعد دورة متجر تنفّذ الطلبات أو الدفع أو الشحن.' },
    video: { name: 'إنشاء الفيديو', node: 'D', engineId: 'media-pipeline', provider: 'whisper.cpp + media adapters', engineStatus: 'partial', prompt: 'العقدة D مخصصة للصوت والفيديو؛ المتاح حالياً تفريغ الصوت عبر whisper.cpp عند اتصاله، أما توليد الفيديو والمونتاج الآلي فغير مفعّلين بعد.' },
    graphics: { name: 'التصميم الجرافيكي', node: 'C', engineId: 'comfyui-image-design', provider: 'ComfyUI', engineStatus: 'optional', prompt: 'العقدة C للتصميم والصور. يتاح توليد الصور فقط عند اتصال ComfyUI المحلي؛ تخطيطات الجرافيك القابلة للتحرير تحتاج عاملاً إضافياً.' },
    documents: { name: 'المستندات والملفات', node: 'E', engineId: 'project-document-tools', provider: 'Local project tools', engineStatus: 'partial', prompt: 'العقدة E تدعم أدوات ملفات المشروع الآمنة وفهرسة الملفات وكتابة الملاحظات عند اختيار الإجراء المعتمد؛ لا تفترض وجود محررات DOCX/PDF متقدمة.' },
    automation: { name: 'الأتمتة والجدولة', node: 'E', engineId: 'local-automation-queue', provider: 'Embedded Node E', engineStatus: 'queue_only', prompt: 'العقدة E تستقبل مهام الأتمتة في طابور محلي؛ لا يوجد مشغّل جدولة عام مفعّل حالياً، ولا تنفذ إرسالاً أو نشراً أو حذفاً تلقائياً.' },
  };
  async function submitDepartmentWorkflow(event) {
    event.preventDefault();
    const config = departmentConfig[active];
    const title = departmentDraft.title.trim();
    const details = departmentDraft.details.trim();
    if (!config || title.length < 3 || details.length < 8 || departmentSubmitting) return;
    setDepartmentSubmitting(true);
    setDepartmentResult(null);
    try {
      const description = [
        'القسم: ' + config.name,
        'معرّف المحرك: ' + config.engineId,
        'الخادم الفعلي: ' + config.node,
        'المزود: ' + config.provider,
        'المطلوب: ' + details,
        'ضوابط القسم: ' + config.prompt,
        'حالة المحرك: ' + config.engineStatus,
        'الحالة: خطة للمراجعة فقط؛ لا يبدأ التنفيذ تلقائياً بعد الموافقة.',
      ].join('\\n');
      const legacyDepartment = ({ store: 'store', video: 'video', graphics: 'graphics', documents: 'documents', automation: 'automation' })[active] || active;
      const result = await request('/api/agent-plans', {
        method: 'POST',
        body: JSON.stringify({ title, description, risk: departmentDraft.risk, department: legacyDepartment }),
      });
      setDepartmentResult(result);
      setDepartmentDraft({ title: '', details: '', risk: 'medium' });
      await refresh();
      setNotice(Capacitor.isNativePlatform()
        ? (language === 'ar' ? 'وُجّهت المهمة إلى الخادم المحلي المخصص للقسم وأُضيفت إلى طابور المهام.' : 'The department task was routed to its assigned local node and added to the task queue.')
        : (language === 'ar' ? 'تم إنشاء خطة القسم وربطها بمركز الموافقات. لم يبدأ أي تنفيذ بعد.' : 'The department plan was created and sent to approvals. No execution has started.'));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDepartmentSubmitting(false);
    }
  }

  async function generateAgentSteps() {
    const title = agentDraft.title.trim();
    if (title.length < 3 || agentGenerating) return;
    setAgentGenerating(true);
    try {
      let model = selectedModel;
      if (!model) {
        const available = await request('/api/assistant/models');
        model = available.items?.[0]?.name || '';
      }
      if (!model) throw new Error(language === 'ar' ? 'لا يوجد نموذج محلي مثبت. شغّل Ollama وثبّت نموذجاً أولاً.' : 'No local model is installed. Start Ollama and install a model first.');
      const context = agentDraft.steps.trim();
      const prompt = language === 'ar'
        ? 'أنت مساعد تخطيط داخل SOULARAB TECH. اقترح خطوات عملية واضحة ومحددة للمهمة التالية. أعد الخطوات فقط، كل خطوة في سطر مستقل ومرقمة. لا تدّعِ تنفيذ أي إجراء، ولا تقترح تجاوز الموافقات أو تشغيل أوامر تلقائياً. عنوان المهمة: ' + title + (context ? '\nالملاحظات الحالية: ' + context : '')
        : 'You are a planning assistant inside SOULARAB TECH. Suggest clear, practical steps for this task. Return only numbered steps, one per line. Do not claim to have performed any action, bypass approvals, or trigger automatic commands. Task: ' + title + (context ? '\nCurrent notes: ' + context : '');
      const result = await request('/api/assistant/chat', { method: 'POST', body: JSON.stringify({ model, temperature: 0.35, messages: [{ role: 'user', content: prompt }] }) });
      const suggested = result.message?.content?.trim();
      if (!suggested) throw new Error(language === 'ar' ? 'لم يُرجع النموذج خطوات صالحة.' : 'The model returned no usable steps.');
      setAgentDraft((current) => ({ ...current, steps: suggested.slice(0, 1800) }));
      setNotice(language === 'ar' ? 'جهّز روح مسودة خطوات محلية. راجعها وعدّلها قبل إرسالها للموافقة.' : 'Rooh drafted local steps. Review and edit them before submitting for approval.');
    } catch (error) { setNotice(error.message); }
    finally { setAgentGenerating(false); }
  }

  async function submitAgentPlan(event) {
    event.preventDefault();
    const steps=agentDraft.steps.split('\n').map(v=>v.trim()).filter(Boolean);
    const title=agentDraft.title.trim();
    if(title.length<3 || steps.length<1){setNotice(language==='ar'?'أدخل عنواناً واضحاً وخطوة واحدة على الأقل.':'Enter a clear title and at least one step.');return;}
    const description=steps.map((step,index)=>(index+1)+'. '+step).join('\n');
    setAgentSubmitting(true);
    try {
      const result=await request('/api/agent-plans',{method:'POST',body:JSON.stringify({title,description,risk:agentDraft.risk,department:'system'})});
      setVaultItems(items=>[{id:Date.now(),title,content:description+'\n\nTask ID: '+result.task_id+'\nApproval ID: '+result.approval_id,category:'task',createdAt:new Date().toISOString()},...items]);
      setAgentDraft({title:'',steps:'',risk:'medium'});
      await refresh();
      setNotice(language==='ar'?'أُنشئت الخطة والمهمة وطلب الموافقة بعملية واحدة. المهمة بانتظار الموافقة ولن يبدأ التنفيذ تلقائياً.':'Plan, task, and approval request created atomically. The task is awaiting approval; execution will not start automatically.');
    } catch(error) { setNotice(error.message); }
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
  const dateOptions = preferences.dateFormat === 'short' ? { year: 'numeric', month: '2-digit', day: '2-digit' } : preferences.dateFormat === 'medium' ? { year: 'numeric', month: 'short', day: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  if (preferences.dateFormat === 'long') dateOptions.weekday = 'long';
  if (preferences.timeZone === 'UTC') dateOptions.timeZone = 'UTC';
  const todayLabel = new Intl.DateTimeFormat(language === 'ar' ? 'ar-u-nu-latn' : 'en-US', dateOptions).format(new Date());

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{language === 'ar' ? 'تجاوز التنقل إلى المحتوى' : 'Skip navigation and go to content'}</a>
    <main className="main-area" id="main-content" tabIndex={-1}>
      <header className="topbar"><div><p className="eyebrow">SOULARAB TECH / WORKSPACE</p><h1>{current.title}</h1><p className="muted">{current.desc}</p></div><div className="top-actions"><select className="language-select" aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select>{active !== 'overview' && <button className="button secondary back-button" onClick={() => window.history.back()}>{language === 'ar' ? '→ رجوع' : '← Back'}</button>}<button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={language === "ar" ? "تبديل المظهر" : "Toggle theme"}>{theme === 'dark' ? '☼' : '☾'}</button><button className="button secondary" onClick={refresh}>{language === "ar" ? "تحديث الحالة ↻" : "Refresh status ↻"}</button></div></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label={language === 'ar' ? 'إغلاق' : 'Close'}>×</button></div>}

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
            <article className="stat-card"><span>{language === 'ar' ? 'طلبات الموافقة' : 'Approval requests'}</span><strong>{approvals.filter((item) => item.status === 'pending').length}</strong><small>{language === 'ar' ? 'تنتظر مراجعتك' : 'Awaiting your review'}</small></article>
            <article className="stat-card"><span>{language === 'ar' ? 'المهام النشطة' : 'Active tasks'}</span><strong>{queuedTasks.filter((task) => ['queued','planning','waiting_approval','running'].includes(task.status)).length}</strong><small>{language === 'ar' ? 'في مسار العمل' : 'In the workflow'}</small></article>
            <article className="stat-card"><span>{language === 'ar' ? 'الخوادم الداخلية' : 'Embedded nodes'}</span><strong className={embeddedBackend.nodes.length === 5 && embeddedBackend.nodes.every((node) => node.running) ? 'good' : 'warn'}>{embeddedBackend.nodes.filter((node) => node.running).length}/5</strong><small>{language === 'ar' ? 'عقد محلية مستقلة' : 'Independent local nodes'}</small></article>
            <article className="stat-card"><span>{language === 'ar' ? 'الاتصال الخارجي' : 'External connections'}</span><strong className="good">مقيّد</strong><small>{language === 'ar' ? 'لا اتصال دون إعداد وموافقة' : 'No connection without setup and approval'}</small></article>
          </div>
          {Capacitor.isNativePlatform() && <div className="engine-status-grid embedded-node-grid">
            {embeddedBackend.nodes.map((node) => <article className="engine-status-card node-control-card" key={node.id}><div><strong>{language === 'ar' ? 'الخادم ' + node.id : 'Server ' + node.id}</strong><small>{node.name}</small><small>127.0.0.1:{node.port}</small><small>{node.running ? (language === 'ar' ? 'نشط — يستجيب لفحص الحالة' : 'Active — health check responding') : (language === 'ar' ? 'متوقف — لا يستقبل طلبات' : 'Stopped — not accepting requests')}</small>{node.id === 'B' && <small>{engineStatuses.B?.worker === 'running' ? (language === 'ar' ? 'عامل مهام روح: يعمل' : 'Rooh task worker: running') : (language === 'ar' ? 'عامل مهام روح: متوقف' : 'Rooh task worker: stopped')}</small>}<div className="node-control-actions">{node.running ? <button type="button" className="button danger" onClick={() => controlEmbeddedNode(node.id,'stop')}>{language === 'ar' ? 'إيقاف الخادم' : 'Stop server'}</button> : <button type="button" className="button primary" onClick={() => controlEmbeddedNode(node.id,'start')}>{language === 'ar' ? 'تشغيل الخادم' : 'Start server'}</button>}<button type="button" className="button secondary" onClick={() => refresh()}>{language === 'ar' ? 'فحص الحالة' : 'Check status'}</button></div></div><span className={node.running ? 'good' : 'warn'}>{node.running ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'متوقف' : 'Stopped')}</span></article>)}
          </div>}
          <div className="engine-status-grid">
            {[
              { id: 'ollama', label: 'Ollama', description: language === 'ar' ? 'نماذج المحادثة المحلية' : 'Local language models' },
              { id: 'comfyui', label: 'ComfyUI', description: language === 'ar' ? 'توليد الصور محلياً' : 'Local image generation' },
              { id: 'whisper_cpp', label: 'whisper.cpp', description: language === 'ar' ? 'تحويل الصوت إلى نص' : 'Speech transcription' },
            ].map((engine) => {
              const status = engineStatuses[engine.id];
              return <button type="button" className="engine-status-card" key={engine.id} onClick={() => setActive(engine.id === 'ollama' ? 'assistant' : 'media')}><div><strong>{engine.label}</strong><small>{engine.description}</small><small className="engine-open-link">{language === 'ar' ? 'فتح إعدادات المحرك ←' : 'Open engine settings →'}</small></div><span className={status?.connected ? 'good' : 'warn'}>{status ? (status.connected ? (language === 'ar' ? 'متصل' : 'Connected') : (language === 'ar' ? 'غير متصل' : 'Offline')) : (api.state === 'offline' ? (language === 'ar' ? 'الخادم غير متصل' : 'Backend offline') : (language === 'ar' ? 'لم يُفحص بعد' : 'Not checked'))}</span></button>;
            })}
          </div>
          <button className="vault-entry" onClick={() => setActive('vault')}><span className="vault-symbol">▣</span><span><strong>{language === 'ar' ? 'الخزنة' : 'Vault'}</strong><small>{language === 'ar' ? 'الأعمال القائمة والمؤجلة، الأكواد المحفوظة، والبيانات قيد المراجعة أو المؤقتة' : 'Active and deferred work, saved code, and items under review'}</small></span><b>{language === 'ar' ? 'فتح الخزنة ←' : 'Open vault ←'}</b></button>
        </div>
      </section>}
      {['store', 'video', 'graphics', 'documents', 'automation'].includes(active) && <section className="content">
        <div className="section-heading">
          <div>
            <h2>{language === 'ar' ? departmentConfig[active].name : englishModules[active]?.[0]}</h2>
            <p className="muted">{language === 'ar' ? 'مساحة استقبال مهام القسم وتوجيهها إلى الخادم المختص، مع موافقة منفصلة قبل التنفيذ.' : 'Submit a department brief and route it to the assigned node. Execution requires a separate approval.'}</p>
          </div>
          <span className="pill">{language === 'ar' ? 'الخادم ' + departmentConfig[active].node : 'Node ' + departmentConfig[active].node}</span>
        </div>
        <div className="two-col">
          <div className="panel-card">
            <h3>{language === 'ar' ? 'طلب جديد للقسم' : 'New department request'}</h3>
            <form className="proposal-form" onSubmit={submitDepartmentWorkflow}>
              <label>{language === 'ar' ? 'عنوان المهمة' : 'Task title'}
                <input value={departmentDraft.title} onChange={(e) => setDepartmentDraft({ ...departmentDraft, title: e.target.value })} minLength="3" maxLength="120" required placeholder={language === 'ar' ? 'اكتب عنواناً واضحاً' : 'Enter a clear task title'}/>
              </label>
              <label>{language === 'ar' ? 'تفاصيل ومتطلبات المهمة' : 'Task details and requirements'}
                <textarea rows="7" value={departmentDraft.details} onChange={(e) => setDepartmentDraft({ ...departmentDraft, details: e.target.value })} minLength="8" maxLength="4000" required placeholder={language === 'ar' ? 'اشرح النتيجة المطلوبة والقيود والملفات ذات الصلة…' : 'Describe the desired result, constraints, and relevant files…'}/>
              </label>
              <label>{language === 'ar' ? 'مستوى المخاطر' : 'Risk level'}
                <select value={departmentDraft.risk} onChange={(e) => setDepartmentDraft({ ...departmentDraft, risk: e.target.value })}>
                  <option value="low">{language === 'ar' ? 'منخفض' : 'Low'}</option>
                  <option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option>
                  <option value="high">{language === 'ar' ? 'مرتفع' : 'High'}</option>
                </select>
              </label>
              <button className="button primary" disabled={departmentSubmitting || departmentDraft.title.trim().length < 3 || departmentDraft.details.trim().length < 8}>
                {departmentSubmitting ? (language === 'ar' ? 'جارٍ إعداد الخطة…' : 'Preparing plan…') : (language === 'ar' ? 'إرسال الخطة للموافقة' : 'Submit plan for approval')}
              </button>
            </form>
          </div>
          <div className="panel-card">
            <h3>{language === 'ar' ? 'المحرك المرتبط بالقسم' : 'Department engine binding'}</h3>
            <div className="settings-inline"><span className="pill">{language === 'ar' ? 'العقدة' : 'Node'}</span><strong>{departmentConfig[active].node}</strong></div>
            <div className="settings-inline"><span className="pill">{language === 'ar' ? 'معرّف المحرك' : 'Engine ID'}</span><strong>{departmentConfig[active].engineId}</strong></div>
            <div className="settings-inline"><span className="pill">{language === 'ar' ? 'المزود' : 'Provider'}</span><strong>{departmentConfig[active].provider}</strong></div>
            <p className="muted">{language === 'ar' ? departmentConfig[active].prompt : 'The engine binding is explicit. Availability and execution depend on the provider being installed and connected.'}</p>
            <p className="chat-footnote">{language === 'ar' ? 'حالة المحرك: ' + ({ queue_only: 'طابور فقط — لا يوجد عامل تنفيذ مكتمل', partial: 'قدرات جزئية — ليس خط إنتاج كاملاً', optional: 'محرك اختياري — يتطلب اتصال ComfyUI' }[departmentConfig[active].engineStatus]) : 'Engine state: ' + departmentConfig[active].engineStatus}</p>
            {departmentResult ? <div className="notice-inline" role="status">
              <strong>{language === 'ar' ? 'تم إنشاء طلب الموافقة' : 'Approval request created'}</strong>
              <p>{language === 'ar' ? 'رقم المهمة: ' + departmentResult.task_id + ' · رقم الموافقة: ' + departmentResult.approval_id : 'Task #' + departmentResult.task_id + ' · Approval #' + departmentResult.approval_id}</p>
              <p>{language === 'ar' ? 'الحالة: بانتظار المراجعة. لم يبدأ التنفيذ.' : 'Status: waiting for review. Execution has not started.'}</p>
              <button type="button" className="button secondary" onClick={() => setActive('security')}>{language === 'ar' ? 'فتح مركز الموافقات' : 'Open approval center'}</button>
            </div> : <p className="chat-footnote">{language === 'ar' ? 'لن تُنفّذ عمليات شراء أو دفع أو نشر أو حذف أو إرسال خارجي من هذه الشاشة. الموافقة تحفظ القرار فقط، والتنفيذ يحتاج عاملاً فعلياً متصلاً بالقسم.' : 'This screen does not purchase, charge, publish, delete, or send externally. Approval records a decision only; execution requires a connected department worker.'}</p>}
          </div>
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
        <div className="settings-group"><h3>{language === 'ar' ? 'صلاحيات Android Root' : 'Android root access'}</h3><p className="chat-footnote">{language === 'ar' ? 'صلاحيات الجذر لا يمكن تفعيلها برمجياً على هاتف غير مروّت. افحص وجود su وامنح التطبيق الإذن من مدير الجذر إذا ظهر الطلب.' : 'Root cannot be enabled by an app on a non-rooted phone. Check for su and grant access in your root manager if prompted.'}</p><button type="button" className="button secondary" onClick={inspectRootAccess}>{language === 'ar' ? 'فحص صلاحيات الجذر' : 'Check root access'}</button>{rootAccess.checked && <p className={rootAccess.available ? 'good' : 'warn'}>{rootAccess.available ? 'UID 0: ' + rootAccess.uid : (rootAccess.message || (language === 'ar' ? 'صلاحيات الجذر غير متاحة.' : 'Root access unavailable.'))}</p>}</div>
        {deviceInfo ? <><div className="diagnostic-grid">
          <article className="stat-card"><span>{language === 'ar' ? 'حالة الشبكة' : 'Network status'}</span><strong className={deviceInfo.online ? 'good' : 'warn'}>{deviceInfo.online ? (language === 'ar' ? 'متصل' : 'Online') : (language === 'ar' ? 'غير متصل' : 'Offline')}</strong></article>
          <article className="stat-card"><span>{language === 'ar' ? 'دقة الشاشة' : 'Screen resolution'}</span><strong>{deviceInfo.screen}</strong></article><article className="stat-card"><span>{language === 'ar' ? 'مساحة العرض' : 'Viewport'}</span><strong>{deviceInfo.viewport}</strong></article>
          <article className="stat-card"><span>{language === 'ar' ? 'أنوية المعالج المعلنة' : 'Reported CPU cores'}</span><strong>{deviceInfo.cores}</strong></article><article className="stat-card"><span>{language === 'ar' ? 'ذاكرة الجهاز المقدرة' : 'Estimated device memory'}</span><strong>{deviceInfo.memory}</strong></article><article className="stat-card"><span>{language === 'ar' ? 'اللمس' : 'Touch support'}</span><strong>{deviceInfo.touch}</strong></article>
        </div><div className="diagnostic-details"><p><strong>{language === 'ar' ? 'المتصفح:' : 'Browser:'}</strong> {deviceInfo.browser}</p><p><strong>{language === 'ar' ? 'النظام:' : 'Platform:'}</strong> {deviceInfo.platform}</p><p><strong>{language === 'ar' ? 'اللغة:' : 'Language:'}</strong> {deviceInfo.language}</p><p><strong>{language === 'ar' ? 'التخزين:' : 'Storage:'}</strong> {deviceInfo.storage}</p><small>آخر فحص: {deviceInfo.checkedAt}</small></div></> : <div className="empty">{language === 'ar' ? 'اضغط «بدء الفحص» لعرض المعلومات التي يسمح المتصفح بالوصول إليها.' : 'Run diagnostics to view the device information available to this browser.'}</div>}
        <p className="chat-footnote">{language === 'ar' ? 'قيود أمان المتصفح تمنع صفحة الويب من الوصول إلى صلاحيات root أو ملفات النظام الخاصة أو التحكم الكامل بالجهاز. الفحص تشخيصي وآمن ولا يغيّر إعدادات جهازك.' : 'Browser security prevents this page from accessing OS root privileges, private system files, or full device control. Diagnostics are read-only and do not change your device.'}</p>
        <MeshManager request={request} language={language} />
      </div></section>}
      {active === 'settings' && <section className="content">
        <div className="panel-card settings-page">
          <div className="section-heading"><div><h2>{language === 'ar' ? 'الإعدادات العامة' : 'General settings'}</h2><p className="muted">{language === 'ar' ? 'تحكم بتجربة الاستخدام واللغة والمظهر وإمكانية الوصول.' : 'Customize language, appearance, and accessibility.'}</p></div><button className="button secondary" onClick={() => { setPreferences({ font: 'ibm', fontScale: 100, density: 'comfortable', reducedMotion: false, highContrast: false, defaultModel: '', defaultTemperature: 0.7, dateFormat: 'long', timeZone: 'local', refreshIntervalSeconds: 15, sessionTimeoutMinutes: 0 }); setLanguage('ar'); setTheme('dark'); }}>{language === 'ar' ? 'استعادة الافتراضيات' : 'Restore defaults'}</button></div>
          <div className="settings-group"><h3>{language === 'ar' ? 'اللغة والمنطقة' : 'Language & region'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'لغة التطبيق' : 'Application language'}</strong><small>{language === 'ar' ? 'تغيير اللغة واتجاه الواجهة' : 'Change language and interface direction'}</small></div><select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ar">العربية · RTL</option><option value="en">English · LTR</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'التاريخ' : 'Date'}</strong><small>{language === 'ar' ? 'التاريخ المعروض في الصفحة الرئيسية حسب وقت جهازك' : 'Date shown on the home screen using your device time'}</small></div><span className="settings-value">{todayLabel}</span></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'تنسيق التاريخ' : 'Date format'}</strong><small>{language === 'ar' ? 'اختيار طريقة عرض التاريخ في لوحة التحكم' : 'Choose how dates appear on the dashboard'}</small></div><select value={preferences.dateFormat || 'long'} onChange={(e) => updatePreference('dateFormat', e.target.value)}><option value="long">{language === 'ar' ? 'مفصل' : 'Long'}</option><option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option><option value="short">{language === 'ar' ? 'مختصر' : 'Short'}</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'المنطقة الزمنية' : 'Time zone'}</strong><small>{language === 'ar' ? 'استخدام توقيت الجهاز أو توقيت UTC' : 'Use device time or Coordinated Universal Time'}</small></div><select value={preferences.timeZone || 'local'} onChange={(e) => updatePreference('timeZone', e.target.value)}><option value="local">{language === 'ar' ? 'توقيت الجهاز' : 'Device local time'}</option><option value="UTC">UTC</option></select></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'المظهر والتخصيص' : 'Appearance & customization'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'سمة الألوان' : 'Color theme'}</strong><small>{language === 'ar' ? 'اختيار المظهر الداكن أو الفاتح' : 'Choose dark or light appearance'}</small></div><button className="button secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? (language === 'ar' ? 'داكن · تبديل إلى الفاتح' : 'Dark · switch to light') : (language === 'ar' ? 'فاتح · تبديل إلى الداكن' : 'Light · switch to dark')}</button></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'نوع الخط' : 'Font family'}</strong><small>{language === 'ar' ? 'تغيير عائلة الخط في التطبيق' : 'Change the application font family'}</small></div><select value={preferences.font} onChange={(e) => updatePreference('font', e.target.value)}><option value="ibm">IBM Plex Arabic</option><option value="system">{language === 'ar' ? 'خط النظام' : 'System font'}</option><option value="tahoma">Tahoma</option><option value="georgia">Georgia</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حجم الخط' : 'Font size'}</strong><small>{language === 'ar' ? 'تكبير أو تصغير النصوص' : 'Scale text'}: {preferences.fontScale}%</small></div><input aria-label="حجم الخط" type="range" min="85" max="125" step="5" value={preferences.fontScale} onChange={(e) => updatePreference('fontScale', Number(e.target.value))}/></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'كثافة الواجهة' : 'Interface density'}</strong><small>{language === 'ar' ? 'المسافات بين البطاقات والعناصر' : 'Spacing between cards and elements'}</small></div><select value={preferences.density} onChange={(e) => updatePreference('density', e.target.value)}><option value="comfortable">{language === 'ar' ? 'مريحة' : 'Comfortable'}</option><option value="compact">{language === 'ar' ? 'مضغوطة' : 'Compact'}</option></select></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'قفل التطبيق' : 'App lock'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'حالة القفل' : 'Lock status'}</strong><small>{appLockEnabled ? (language === 'ar' ? 'التطبيق محمي برمز PIN عند فتحه مجدداً' : 'The app asks for your PIN when reopened') : (language === 'ar' ? 'لا يوجد قفل محلي مفعّل' : 'No local app lock is enabled')}</small></div>{appLockEnabled ? <div className="settings-inline"><button type="button" className="button secondary" onClick={lockAppNow}>{language === 'ar' ? 'قفل الآن' : 'Lock now'}</button><button type="button" className="button danger" onClick={removeAppLock}>{language === 'ar' ? 'تعطيل القفل' : 'Disable lock'}</button></div> : <span className="pill">{language === 'ar' ? 'غير محمي' : 'Unprotected'}</span>}</div>
            {!appLockEnabled && <div className="pin-setup"><label>{language === 'ar' ? 'رمز PIN — ستة أرقام' : 'PIN — six digits'}<input type="password" inputMode="numeric" autoComplete="new-password" maxLength="6" value={appPin} onChange={(e) => setAppPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••"/></label><label>{language === 'ar' ? 'تأكيد الرمز' : 'Confirm PIN'}<input type="password" inputMode="numeric" autoComplete="new-password" maxLength="6" value={appPinConfirm} onChange={(e) => setAppPinConfirm(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••"/></label><button type="button" className="button primary" onClick={saveAppPin} disabled={appPin.length !== 6 || appPinConfirm.length !== 6}>{language === 'ar' ? 'تفعيل قفل التطبيق' : 'Enable app lock'}</button></div>}
            <button type="button" className="button secondary" onClick={async () => { try { const result = await LocalBackend.biometricAvailability(); setBiometricAvailable(Boolean(result.available)); setNotice(result.available ? (language === 'ar' ? 'البصمة متاحة.' : 'Biometrics are available.') : (language === 'ar' ? 'سجّل بصمة في إعدادات Android أولاً.' : 'Enroll a biometric in Android settings first.')); } catch (error) { setNotice(error.message); } }}>{language === 'ar' ? 'فحص توفر البصمة' : 'Check biometric availability'}{biometricAvailable ? ' ✓' : ''}</button>
            {appLockError && !appLocked && <p className="warn">{appLockError}</p>}
            <p className="chat-footnote">{language === 'ar' ? 'يُخزّن التطبيق تجزئة مشتقة من الرمز مع ملح عشوائي. يمكنك استخدام البصمة القوية المسجلة في Android لفتح التطبيق.' : 'Only a salted PIN hash is stored. Enrolled Android strong biometrics can also unlock the app.'}</p>
            <button type="button" className="button secondary" onClick={async () => { try { const result = await LocalBackend.biometricAvailability(); setBiometricAvailable(Boolean(result.available)); setNotice(result.available ? (language === 'ar' ? 'البصمة متاحة على هذا الجهاز.' : 'Biometrics are available.') : (language === 'ar' ? 'البصمة غير مهيأة على هذا الجهاز.' : 'Biometrics are not enrolled on this device.')); } catch (error) { setNotice(error.message); } }}>{language === 'ar' ? 'فحص البصمة البيومترية' : 'Check biometric availability'}{biometricAvailable ? ' ✓' : ''}</button>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'الجلسة والأمان' : 'Session & security'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'قفل الجلسة عند عدم النشاط' : 'Lock session after inactivity'}</strong><small>{language === 'ar' ? 'إنهاء رمز الوصول وطلب إدخاله مجدداً بعد فترة خمول. يعمل فقط عند استخدام رمز وصول.' : 'Clear the access token and require it again after inactivity. Applies only when an access token is in use.'}</small></div><select value={preferences.sessionTimeoutMinutes || 0} onChange={(e) => updatePreference('sessionTimeoutMinutes', Number(e.target.value))}><option value="0">{language === 'ar' ? 'معطّل' : 'Disabled'}</option><option value="15">{language === 'ar' ? '15 دقيقة' : '15 minutes'}</option><option value="30">{language === 'ar' ? '30 دقيقة' : '30 minutes'}</option><option value="60">{language === 'ar' ? '60 دقيقة' : '60 minutes'}</option></select></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'جلسة الوصول الحالية' : 'Current access session'}</strong><small>{apiToken ? (language === 'ar' ? 'يوجد رمز وصول محفوظ لهذه الجلسة فقط' : 'An access token is stored for this browser session only') : (language === 'ar' ? 'لا يوجد رمز وصول محفوظ حالياً' : 'No access token is stored currently')}</small></div><button type="button" className="button secondary" disabled={!apiToken} onClick={() => { sessionStorage.removeItem('st-api-token'); sessionStorage.removeItem('st-last-activity'); setApiToken(''); setAuthRequired(false); setNotice(language === 'ar' ? 'تم إنهاء جلسة الوصول على هذا الجهاز.' : 'The access session on this device has been ended.'); }}>{language === 'ar' ? 'إنهاء الجلسة' : 'End session'}</button></div>
            <p className="chat-footnote">{language === 'ar' ? 'لا يعرض التطبيق رمز الوصول ولا يضمّنه في النسخ الاحتياطية. إنهاء الجلسة يمسح الرمز من جلسة المتصفح الحالية فقط.' : 'The token is never displayed or included in backups. Ending the session clears it from this browser session only.'}</p>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'تحديث البيانات' : 'Data refresh'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'فاصل تحديث لوحة التحكم' : 'Dashboard refresh interval'}</strong><small>{language === 'ar' ? 'تحديد عدد الثواني بين فحوص حالة الخادم والمهام' : 'Set how often server and task status are refreshed'}</small></div><select value={preferences.refreshIntervalSeconds || 15} onChange={(e) => updatePreference('refreshIntervalSeconds', Number(e.target.value))}><option value="15">{language === 'ar' ? 'كل 15 ثانية' : 'Every 15 seconds'}</option><option value="30">{language === 'ar' ? 'كل 30 ثانية' : 'Every 30 seconds'}</option><option value="60">{language === 'ar' ? 'كل دقيقة' : 'Every minute'}</option></select></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'إعدادات الذكاء الاصطناعي' : 'AI settings'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'النموذج النصي الافتراضي' : 'Default text model'}</strong><small>{language === 'ar' ? 'النموذج المحلي الذي يختاره روح تلقائياً للمحادثات ومساعدات الصياغة' : 'Local model selected by default for chat and AI-assisted drafting'}</small></div><div className="settings-inline"><select aria-label={language === 'ar' ? 'النموذج الافتراضي' : 'Default model'} value={selectedModel} disabled={!models.length} onChange={(e) => { setSelectedModel(e.target.value); updatePreference('defaultModel', e.target.value); }}><option value="">{language === 'ar' ? 'لا توجد نماذج محملة' : 'No models loaded'}</option>{models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}</select><button type="button" className="button secondary" onClick={loadAssistant} disabled={assistantStatus.loading}>{language === 'ar' ? 'فحص النماذج' : 'Load models'}</button></div></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'درجة الإبداع للنموذج' : 'Model creativity (temperature)'}</strong><small>{language === 'ar' ? 'توازن بين الإجابات الدقيقة والأفكار المتنوعة في محادثات روح' : 'Balance focused answers and more varied ideas in Rooh chat'}: {Number(preferences.defaultTemperature ?? 0.7).toFixed(1)}</small></div><input aria-label={language === 'ar' ? 'درجة الإبداع' : 'Model temperature'} type="range" min="0" max="2" step="0.1" value={preferences.defaultTemperature ?? 0.7} onChange={(e) => updatePreference('defaultTemperature', Number(e.target.value))}/></div>
            <p className="chat-footnote">{language === 'ar' ? 'تُجلب قائمة النماذج من Ollama المحلية عند الضغط على فحص النماذج أو فتح المساعد. لا يتم إرسالها إلى خدمة سحابية.' : 'The model list is read from local Ollama when you load models or open the assistant. It is not sent to a cloud service.'}</p>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'إمكانية الوصول' : 'Accessibility'}</h3>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'تقليل الحركة' : 'Reduce motion'}</strong><small>{language === 'ar' ? 'إيقاف الانتقالات والحركات الزخرفية' : 'Disable transitions and decorative motion'}</small></div><input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => updatePreference('reducedMotion', e.target.checked)}/></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'تباين مرتفع' : 'High contrast'}</strong><small>{language === 'ar' ? 'تعزيز وضوح النصوص والحدود وعناصر التركيز' : 'Improve text, border, and focus visibility'}</small></div><input type="checkbox" checked={Boolean(preferences.highContrast)} onChange={(e) => updatePreference('highContrast', e.target.checked)}/></div>
          </div>
          <div className="settings-group"><h3>{language === 'ar' ? 'النسخ الاحتياطي للإعدادات' : 'Settings backup'}</h3>
            <p className="muted">{language === 'ar' ? 'احفظ اللغة والمظهر وتفضيلات الواجهة وعنوان الخادم لاستعادتها لاحقاً أو نقلها إلى جهاز آخر.' : 'Back up language, appearance, interface preferences, and backend URL for later restoration or transfer to another device.'}</p>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'تصدير الإعدادات' : 'Export settings'}</strong><small>{language === 'ar' ? 'تنزيل ملف JSON متوافق مع هذا التطبيق' : 'Download a JSON file compatible with this app'}</small></div><button type="button" className="button secondary" onClick={exportSettingsBackup}>{language === 'ar' ? 'تنزيل نسخة الإعدادات' : 'Download settings backup'}</button></div>
            <div className="settings-row"><div><strong>{language === 'ar' ? 'استيراد الإعدادات' : 'Import settings'}</strong><small>{language === 'ar' ? 'استعادة الإعدادات من ملف سابق؛ لن تُستورد رموز الدخول' : 'Restore from a previous file; authentication tokens are never imported'}</small></div><label className="button secondary">{language === 'ar' ? 'اختيار ملف JSON' : 'Choose JSON file'}<input type="file" accept="application/json,.json" onChange={importSettingsBackup} hidden/></label></div>
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
              <label className="upload-control">{language === 'ar' ? 'استعادة مشروع من أرشيف ZIP' : 'Restore project from ZIP archive'}<input type="file" accept=".zip,application/zip" onChange={importProjectArchive} disabled={busy} /></label>
            </form>
          </div>
          <div className="panel-card project-list-panel">
            <div className="section-heading"><div><h3>{language === 'ar' ? 'مشاريعي' : 'My projects'}</h3><p>{language === 'ar' ? 'المشاريع النشطة والمؤرشفة' : 'Active and archived projects'}</p></div><button className="button secondary" onClick={loadProjects}>{language === 'ar' ? 'تحديث ↻' : 'Refresh ↻'}</button></div>
            {loadingProjects ? <Empty text={language === 'ar' ? 'جارٍ تحميل المشاريع…' : 'Loading projects…'}/> : projects.length ? <div className="project-list">
              {projects.map((project) => <article className="project-card" key={project.id}>
                <div className="project-card-top"><span className="project-symbol">▣</span><span className={project.status === 'active' ? 'project-status active' : 'project-status'}>{project.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'مؤرشف' : 'Archived')}</span></div>
                <strong>{project.title}</strong><p>{project.description || (language === 'ar' ? 'لا يوجد وصف لهذا المشروع.' : 'No project description.')}</p>
                <small>المشروع #{project.id} · {new Date(project.created_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US')}</small>
                <div className="project-actions">
                  {project.status === 'active' && <><button className="text-button" onClick={() => openProject(project)}>{language === 'ar' ? 'إدارة الملفات' : 'Manage files'}</button><button className="text-button" disabled={busy} onClick={() => archiveProject(project.id)}>{language === 'ar' ? 'أرشفة' : 'Archive'}</button></>}
                  <button className="text-button" onClick={() => exportProject(project)}>{language === 'ar' ? 'تصدير ZIP' : 'Export ZIP'}</button>
                </div>
              </article>)}
            </div> : <Empty text={language === 'ar' ? 'لا توجد مشاريع بعد. أنشئ أول مساحة عمل من النموذج.' : 'No projects yet. Create your first workspace using the form.'}/>}
          </div>
        </div>
        {selectedProject && <div className="panel-card workspace-files">
          <div className="section-heading"><div><h3>ملفات: {selectedProject.title}</h3><p>{language === 'ar' ? 'إدارة الملفات داخل مساحة هذا المشروع فقط' : 'Manage files only within this project workspace'}</p></div><button className="text-button" onClick={() => setSelectedProject(null)}>{language === 'ar' ? 'إغلاق' : 'Close'}</button></div>
          <label className="upload-control">{language === 'ar' ? 'رفع ملف (حد أقصى 10 MB)' : 'Upload file (10 MB maximum)'}<input type="file" onChange={uploadProjectFile} disabled={uploadingFile || selectedProject.status === 'archived'} /></label>
          {uploadingFile && <p className="muted">{language === 'ar' ? 'جارٍ رفع الملف…' : 'Uploading file…'}</p>}
          {projectFiles.length ? <div className="workspace-file-list">{projectFiles.map((file) => <div className="workspace-file" key={file.name}><span>▤</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></div><button className="text-button" onClick={() => downloadProjectFile(file.name)}>{language === 'ar' ? 'تنزيل' : 'Download'}</button><button className="text-button danger-text" disabled={uploadingFile || selectedProject.status === 'archived'} onClick={() => deleteProjectFile(file.name)}>{language === 'ar' ? 'حذف' : 'Delete'}</button></div>)}</div> : <Empty text={language === 'ar' ? 'لا توجد ملفات في مساحة هذا المشروع بعد.' : 'No files in this project workspace yet.'}/>}
          <p className="chat-footnote">{language === 'ar' ? 'الملفات تبقى داخل مجلد المشروع على الخادم. الأنواع التنفيذية المحظورة لا يمكن رفعها.' : 'Files remain in the project folder on the server. Blocked executable file types cannot be uploaded.'}</p>
        </div>}
        <div className="panel-card workspace-note"><strong>{language === 'ar' ? 'حماية الملفات' : 'File protection'}</strong><p>{language === 'ar' ? 'تُحصر عمليات الرفع والتنزيل داخل مجلد المشروع، ويُمنع استخدام المسارات للوصول إلى ملفات أخرى. الحد الأقصى للملف الواحد 10 ميغابايت.' : 'Uploads and downloads are restricted to the project folder. Path traversal is blocked. Maximum file size is 10 MB.'}</p></div>
      </section>}

      {active === 'terminal' && <section className="content"><div className="panel-card terminal-page">
        <div className="section-heading"><div><h2>{language === 'ar' ? 'طرفية الهاتف — Termux' : 'Phone terminal — Termux'}</h2><p className="muted">{language === 'ar' ? 'واجهة أوامر متصلة بتطبيق Termux المثبت على الهاتف، وليست محاكاة شكلية لسطر الأوامر.' : 'A command bridge to the Termux app installed on this phone, not a fake shell emulator.'}</p></div><span className="pill">Android / Termux</span></div>
        <div className="notice-inline"><strong>{language === 'ar' ? 'متطلبات الاتصال' : 'Connection requirements'}</strong><p>{language === 'ar' ? 'يجب تثبيت Termux من مصدر موثوق، وتفعيل Allow external apps في إعداداته. عند إرسال الأمر ستُفتح جلسة داخل Termux، وتظهر المخرجات هناك؛ لا يستطيع التطبيق قراءة مخرجات الجلسة تلقائياً حالياً.' : 'Install Termux from a trusted source and enable Allow external apps in its settings. Commands open a Termux session and output appears there; this app cannot currently capture that session output automatically.'}</p></div>
        <div className="terminal-presets"><strong>{language === 'ar' ? 'أوامر سريعة' : 'Quick commands'}</strong>{[['pwd','المجلد الحالي'],['ls -la','عرض الملفات'],['df -h','مساحة التخزين'],['free -h','الذاكرة'],['uname -a','معلومات النظام'],['ps -ef','العمليات']].map(([cmd,label]) => <button key={cmd} type="button" className="button secondary" onClick={() => setTerminalCommand(cmd)}><code>{cmd}</code><small>{label}</small></button>)}</div>
        <form className="terminal-command-form" onSubmit={runTerminalCommand}><label>{language === 'ar' ? 'الأمر المراد تنفيذه' : 'Command to execute'}<textarea rows="3" value={terminalCommand} onChange={(e) => setTerminalCommand(e.target.value)} spellCheck="false" autoCapitalize="off" autoCorrect="off" placeholder="pkg update && pkg upgrade"/></label><button className="button primary" disabled={terminalBusy || !terminalCommand.trim()}>{terminalBusy ? (language === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : (language === 'ar' ? 'إرسال إلى Termux ↗' : 'Send to Termux ↗')}</button></form>
        <div className="terminal-history"><div className="section-heading"><h3>{language === 'ar' ? 'سجل الأوامر المرسلة' : 'Sent command history'}</h3><button className="text-button" onClick={() => setTerminalHistory([])}>{language === 'ar' ? 'مسح السجل' : 'Clear history'}</button></div>{terminalHistory.length ? terminalHistory.map((item,index)=><article key={item.at+index}><code>{item.command}</code><small>{new Date(item.at).toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</small></article>) : <Empty text={language === 'ar' ? 'لم ترسل أوامر بعد.' : 'No commands sent yet.'}/>}</div>
        <p className="chat-footnote">{language === 'ar' ? 'تنبيه أمني: الأوامر تُنفذ بصلاحيات مستخدم Termux، وليست بصلاحيات root. راجع الأمر قبل إرساله؛ لا ترسل أوامر مجهولة أو مدمرة.' : 'Security: commands run with the Termux user permissions, not root. Review every command before sending; avoid unknown or destructive commands.'}</p>
      </div></section>}
      {active === "assistant" && <section className="content">
        <div className="assistant-toolbar panel-card">
          <div><h3>{language === 'ar' ? 'المساعد المحلي' : 'Local assistant'}</h3><p className="muted">{Capacitor.isNativePlatform() ? (language === 'ar' ? 'تتصل روح بمحرك llama.cpp المحلي الذي يعمل عبر Termux على هذا الهاتف.' : 'Rooh connects to the local llama.cpp engine running through Termux on this phone.') : (language === 'ar' ? 'تُرسل المحادثة إلى Ollama على الجهاز الذي يعمل عليه الخادم فقط.' : 'Messages are sent only to the local Ollama service on the server machine.')}</p></div>
          <div className="assistant-controls"><span className={assistantStatus.connected ? "pill connected" : "pill"}>{assistantStatus.loading ? (language === 'ar' ? 'جارٍ الفحص…' : 'Checking…') : assistantStatus.connected ? (Capacitor.isNativePlatform() ? (language === 'ar' ? 'محرك روح متصل' : 'Rooh engine connected') : (language === 'ar' ? 'Ollama متصلة' : 'Ollama connected')) : (Capacitor.isNativePlatform() ? (language === 'ar' ? 'محرك روح غير متصل' : 'Rooh engine offline') : (language === 'ar' ? 'Ollama غير متصلة' : 'Ollama disconnected'))}</span><button className="button secondary" onClick={loadAssistant}>{language === 'ar' ? 'فحص الاتصال' : 'Check connection'}</button></div>
        </div>
        <div className="chat-panel panel-card">
          <div className="chat-heading"><div><h3>{language === 'ar' ? 'محادثة جديدة' : 'New conversation'}</h3><small>{language === 'ar' ? 'المحادثة محفوظة مؤقتاً في هذه الصفحة فقط.' : 'This conversation is kept temporarily on this page only.'}</small></div>
            <select aria-label={language === 'ar' ? 'اختر النموذج' : 'Choose model'} value={selectedModel} onChange={(e) => { setSelectedModel(e.target.value); updatePreference('defaultModel', e.target.value); }} disabled={!models.length}>
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
            <textarea rows="2" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={models.length ? (language === 'ar' ? 'اكتب رسالتك هنا…' : 'Type your message…') : (Capacitor.isNativePlatform() ? (language === 'ar' ? 'شغّل محرك روح في Termux أولاً' : 'Start the Rooh engine in Termux first') : (language === 'ar' ? 'شغّل Ollama وثبّت نموذجاً محلياً أولاً' : 'Start Ollama and install a local model first'))} disabled={!models.length || sendingChat} />
            <button className="button primary" disabled={!models.length || !chatInput.trim() || sendingChat}>{sendingChat ? (language === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : (language === 'ar' ? 'إرسال ↑' : 'Send ↑')}</button>
          </form>
          <p className="chat-footnote">{Capacitor.isNativePlatform() ? (language === 'ar' ? 'يلزم إبقاء جلسة Termux ومحرك llama.cpp يعملين على هذا الهاتف أثناء استخدام روح.' : 'Keep the Termux session and llama.cpp engine running on this phone while using Rooh.') : (language === 'ar' ? 'يلزم تثبيت Ollama والنموذج على جهاز الخادم. الهاتف واجهة تحكم ولا يشغّل النموذج الثقيل بنفسه.' : 'Ollama and a model must be installed on the server machine. The phone is a control interface and does not run the large model itself.')}</p>
        </div>
      </section>}
      {active === 'security' && <section className="content two-col">
        <div className="panel-card">
          <div className="section-heading">
            <div><h3>{language === 'ar' ? 'مركز الموافقات' : 'Approval center'}</h3><p>{language === 'ar' ? 'راجع الطلبات الحالية والقرارات السابقة' : 'Review pending requests and past decisions'}</p></div>
            <div className="approval-filter-tools">
              <span className="pill">{approvals.filter((item) => item.status === 'pending').length} {language === 'ar' ? 'معلّق' : 'pending'}</span>
              <select className="approval-filter" value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} aria-label={language === 'ar' ? 'تصفية طلبات الموافقة' : 'Filter approvals'}>
                <option value="pending">{language === 'ar' ? 'المعلّقة' : 'Pending'}</option>
                <option value="approved">{language === 'ar' ? 'الموافق عليها' : 'Approved'}</option>
                <option value="rejected">{language === 'ar' ? 'المرفوضة' : 'Rejected'}</option>
                <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
              </select>
            </div>
          </div>
          {approvals.filter((item) => approvalFilter === 'all' || item.status === approvalFilter).length
            ? approvals.filter((item) => approvalFilter === 'all' || item.status === approvalFilter).map((item) => <article className="approval" key={item.id}>
              <div className="approval-top"><strong>{item.title}</strong><div className="approval-meta">
                <span className={`risk risk-${item.risk}`}>{item.risk === 'high' ? (language === 'ar' ? 'مرتفع' : 'High') : item.risk === 'low' ? (language === 'ar' ? 'منخفض' : 'Low') : (language === 'ar' ? 'متوسط' : 'Medium')}</span>
                <span className="pill">{item.status === 'pending' ? (language === 'ar' ? 'معلّق' : 'Pending') : item.status === 'approved' ? (language === 'ar' ? 'موافق عليه' : 'Approved') : (language === 'ar' ? 'مرفوض' : 'Rejected')}</span>
              </div></div>
              <p>{item.description}</p>
              <small>{new Date(item.created_at).toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</small>
              {item.task_id && <small className="approval-task-link">{language === 'ar' ? 'المهمة المرتبطة' : 'Linked task'} #{item.task_id}</small>}
              {item.status === 'pending'
                ? <div className="approval-actions"><button className="button primary" disabled={busy} onClick={() => decide(item.id, 'approved')}>{language === 'ar' ? 'موافقة' : 'Approve'}</button><button className="button danger" disabled={busy} onClick={() => decide(item.id, 'rejected')}>{language === 'ar' ? 'رفض' : 'Reject'}</button></div>
                : item.decision_note && <small className="approval-decision-note">{language === 'ar' ? 'ملاحظة القرار: ' : 'Decision note: '}{item.decision_note}</small>}
            </article>)
            : <Empty text={approvalFilter === 'pending' ? (language === 'ar' ? 'لا توجد طلبات معلّقة حالياً.' : 'No pending requests.') : (language === 'ar' ? 'لا توجد طلبات ضمن هذا التصنيف.' : 'No requests in this filter.')}/>}
        </div>
        <div className="panel-card"><h3>{language === 'ar' ? 'تسجيل طلب جديد' : 'Create a request'}</h3><p className="muted">{language === 'ar' ? 'سجّل الإجراء المقترح ليظهر في قائمة المراجعة. لا ينفذ النظام أي تغيير من هذه الخطوة.' : 'Submit a proposed action for review. This step does not execute any change.'}</p><form className="proposal-form" onSubmit={createProposal}><label>{language === 'ar' ? 'عنوان الإجراء' : 'Action title'}<input value={proposal.title} onChange={(e) => setProposal({...proposal, title:e.target.value})} required maxLength="120" placeholder="مثال: ربط مزود نموذج محلي"/></label><label>{language === 'ar' ? 'التفاصيل' : 'Details'}<textarea value={proposal.description} onChange={(e) => setProposal({...proposal, description:e.target.value})} required rows="4" maxLength="2000" placeholder={language === 'ar' ? 'ما الذي سيتغير؟ ولماذا؟' : 'What will change, and why?'} /></label><label>{language === 'ar' ? 'مستوى المخاطر' : 'Risk level'}<select value={proposal.risk} onChange={(e) => setProposal({...proposal, risk:e.target.value})}><option value="low">{language === 'ar' ? 'منخفض' : 'Low'}</option><option value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</option><option value="high">{language === 'ar' ? 'مرتفع' : 'High'}</option></select></label><button className="button primary" disabled={busy}>{language === 'ar' ? 'إرسال للمراجعة' : 'Submit for review'}</button></form></div>
        <div className="panel-card"><h3>{language === 'ar' ? 'مفتاح الوصول المحلي' : 'Local access token'}</h3><p className="muted">{language === 'ar' ? 'أدخل رمز API الذي ضبطته في الخادم. يُحفظ في جلسة المتصفح الحالية فقط.' : 'Enter the API token configured on the server. It is stored only for this browser session.'}</p><form onSubmit={(e) => {e.preventDefault();sessionStorage.setItem('st-api-token',apiToken);refresh();}}><label>{language === 'ar' ? 'رمز API' : 'API token'}<input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder={language === 'ar' ? 'اتركه فارغاً إذا لم تضبطه' : 'Leave blank if not configured'}/></label><button className="button secondary">{language === 'ar' ? 'حفظ للجلسة' : 'Save for session'}</button></form></div>
        <div className="panel-card">
          <div className="section-heading"><div><h3>{language === 'ar' ? 'حالة الحساب والوصول' : 'Account & access status'}</h3><p className="muted">{language === 'ar' ? 'قراءة مباشرة لوضع المصادقة الفعلي في الخادم.' : 'Live view of the backend authentication configuration.'}</p></div><button type="button" className="button secondary" onClick={loadSecurityStatus} disabled={securityStatusLoading}>{securityStatusLoading ? (language === 'ar' ? 'جارٍ الفحص…' : 'Checking…') : (language === 'ar' ? 'تحديث' : 'Refresh')}</button></div>
          {securityStatus ? <>
            <div className="roadmap-row"><span>{language === 'ar' ? 'بيئة الخادم' : 'Server environment'}</span><b>{securityStatus.environment}</b></div>
            <div className="roadmap-row"><span>{language === 'ar' ? 'مصادقة API' : 'API authentication'}</span><b className={securityStatus.token_configured ? 'good' : ''}>{securityStatus.token_configured ? (language === 'ar' ? 'رمز Bearer مضبوط' : 'Bearer token configured') : (language === 'ar' ? 'لا يوجد رمز مضبوط' : 'No token configured')}</b></div>
            <div className="roadmap-row"><span>{language === 'ar' ? 'نموذج الهوية' : 'Identity model'}</span><b>{language === 'ar' ? 'رمز وصول مشترك واحد' : 'Single shared access token'}</b></div>
            <div className="roadmap-row"><span>{language === 'ar' ? 'إدارة الحسابات' : 'Account management'}</span><b>{securityStatus.account_management ? (language === 'ar' ? 'متاحة' : 'Available') : (language === 'ar' ? 'غير مفعّلة بعد' : 'Not implemented yet')}</b></div>
            <div className="roadmap-row"><span>{language === 'ar' ? 'قفل جلسة المتصفح' : 'Browser session lock'}</span><b>{language === 'ar' ? 'اختياري من الإعدادات' : 'Optional in Settings'}</b></div>
            <p className="chat-footnote">{language === 'ar' ? 'تنبيه دقة: النسخة الحالية لا تحتوي على حسابات مستخدمين منفصلة أو ملفات شخصية أو إعادة تعيين كلمات مرور. الوصول إلى الخادم يعتمد على رمز API المشترك، ولا يُعرض الرمز هنا.' : 'Accuracy note: this build does not yet provide individual user accounts, profiles, or password resets. Backend access uses a shared API token; the token itself is never displayed here.'}</p>
          </> : <p className="muted">{language === 'ar' ? 'تعذر تحميل حالة الأمان. تحقق من اتصال الخادم ورمز الوصول.' : 'Security status unavailable. Check the backend connection and access token.'}</p>}
        </div>
        <div className="panel-card"><h3>{language === 'ar' ? 'مبادئ الحماية' : 'Security principles'}</h3><ul className="safety-list"><li>{language === 'ar' ? 'لا اتصال بمزود خارجي افتراضياً.' : 'No external provider connection by default.'}</li><li>{language === 'ar' ? 'لا تعديل أو حذف أو نشر دون موافقة منفصلة.' : 'No edits, deletion, or publishing without separate approval.'}</li><li>{language === 'ar' ? 'كل قرار يُسجل في سجل التدقيق.' : 'Every decision is recorded in the audit log.'}</li><li>{language === 'ar' ? 'لا توجد كلمات مرور تجريبية مضمنة في الواجهة.' : 'No demo passwords are embedded in the interface.'}</li><li>{language === 'ar' ? 'المهام الخطرة تتطلب مراجعة بشرية.' : 'High-risk tasks require human review.'}</li></ul></div>
        <div className="panel-card audit-panel"><div className="section-heading"><div><h3>{language === 'ar' ? 'سجل العمليات' : 'Audit log'}</h3><p>{language === 'ar' ? 'آخر الأحداث المسجلة في الخادم' : 'Latest events recorded by the server'}</p></div><button className="button secondary" onClick={refresh}>{language === 'ar' ? 'تحديث السجل ↻' : 'Refresh log ↻'}</button></div><AuditList events={events} language={language}/></div>
      </section>}




      {active === 'agents' && <section className="content">
        <div className="section-heading"><div><h2>{language==='ar'?'استوديو الوكلاء والأتمتة':'Agents & automation studio'}</h2><p className="muted">{language==='ar'?'خطط مهام متعددة الخطوات وأرسلها للموافقة قبل أي تنفيذ.':'Plan multi-step tasks and request approval before any execution.'}</p></div><span className="pill">{language==='ar'?'مراجعة إلزامية':'Approval required'}</span></div>
        <div className="two-col">
          <div className="panel-card"><h3>{language==='ar'?'إنشاء خطة وكيل':'Create an agent plan'}</h3><form className="proposal-form" onSubmit={submitAgentPlan}>
            <label>{language==='ar'?'عنوان المهمة':'Task title'}<input value={agentDraft.title} onChange={e=>setAgentDraft({...agentDraft,title:e.target.value})} maxLength="120" minLength="3" required placeholder={language==='ar'?'مثال: تجهيز ونشر موقع الشركة':'Example: Prepare and publish company website'}/></label>
            <label>{language==='ar'?'خطوات التنفيذ (كل خطوة في سطر)':'Execution steps (one per line)'}<textarea rows="8" value={agentDraft.steps} onChange={e=>setAgentDraft({...agentDraft,steps:e.target.value})} maxLength="1800" required placeholder={language==='ar'?'1. مراجعة الملفات\n2. بناء نسخة الإنتاج\n3. فحص الروابط':'1. Review project files\n2. Build production version\n3. Check links'}/></label>
            <button type="button" className="button secondary" onClick={generateAgentSteps} disabled={agentGenerating||!agentDraft.title.trim()}>{agentGenerating?(language==='ar'?'روح تكتب الخطوات…':'Rooh is drafting…'):(language==='ar'?'اقتراح خطوات بواسطة روح ✦':'Draft steps with Rooh ✦')}</button>
            <label>{language==='ar'?'مستوى المخاطر':'Risk level'}<select value={agentDraft.risk} onChange={e=>setAgentDraft({...agentDraft,risk:e.target.value})}><option value="low">{language==='ar'?'منخفض':'Low'}</option><option value="medium">{language==='ar'?'متوسط':'Medium'}</option><option value="high">{language==='ar'?'مرتفع':'High'}</option></select></label>
            <button className="button primary" disabled={agentSubmitting||!agentDraft.title.trim()||!agentDraft.steps.trim()}>{agentSubmitting?(language==='ar'?'جارٍ الإرسال…':'Submitting…'):(language==='ar'?'إرسال إلى الموافقات':'Submit for approval')}</button>
          </form></div>
          <div className="panel-card"><h3>{language==='ar'?'ضوابط التنفيذ':'Execution safeguards'}</h3><div className="roadmap-row"><span>{language==='ar'?'حفظ الخطة':'Plan storage'}</span><b className="good">{language==='ar'?'الخزنة المحلية':'Local vault'}</b></div><div className="roadmap-row"><span>{language==='ar'?'مراجعة بشرية':'Human review'}</span><b className="good">{language==='ar'?'مطلوبة':'Required'}</b></div><div className="roadmap-row"><span>{language==='ar'?'التنفيذ التلقائي':'Automatic execution'}</span><b>{language==='ar'?'معطل':'Disabled'}</b></div><p className="chat-footnote">{language==='ar'?'كل خطة تُسجل في طابور المهام وتُرسل أيضاً للموافقة البشرية. إنشاء المهمة أو الموافقة عليها لا يشغّل الأوامر؛ يلزم محرك تنفيذ مستقل ومراجعة أمان.':'Each plan is recorded in the task queue and separately submitted for human approval. Queueing or approving a task never executes commands; a separate execution engine and safety review are required.'}</p><button className="button secondary" onClick={()=>setActive('security')}>{language==='ar'?'فتح قائمة الموافقات':'Open approvals'}</button></div>
        </div>
        <div className="panel-card task-queue-panel">
          <div className="section-heading"><div><h3>{language==='ar'?'طابور المهام':'Task queue'}</h3><p className="muted">{language==='ar'?'المهام المحفوظة على الخادم. الإلغاء متاح قبل بدء أي تنفيذ.':'Tasks persisted on the server. Cancellation is available before execution starts.'}</p></div><div className="queue-tools"><span className="pill">{queuedTasks.length} {language==='ar'?'مهمة':'tasks'}</span><select className="task-filter" value={taskFilter} onChange={(event)=>setTaskFilter(event.target.value)} aria-label={language==='ar'?'تصفية المهام':'Filter tasks'}><option value="all">{language==='ar'?'كل الحالات':'All statuses'}</option><option value="waiting_approval">{language==='ar'?'بانتظار الموافقة':'Awaiting approval'}</option><option value="queued">{language==='ar'?'في الانتظار':'Queued'}</option><option value="planning">{language==='ar'?'قيد التخطيط':'Planning'}</option><option value="running">{language==='ar'?'قيد التنفيذ':'Running'}</option><option value="paused">{language==='ar'?'متوقفة مؤقتاً':'Paused'}</option><option value="completed">{language==='ar'?'مكتملة':'Completed'}</option><option value="failed">{language==='ar'?'فشلت':'Failed'}</option><option value="cancelled">{language==='ar'?'ملغاة':'Cancelled'}</option></select><button className="button secondary" onClick={loadTasks} disabled={loadingTasks}>{loadingTasks?(language==='ar'?'جارٍ التحديث…':'Refreshing…'):(language==='ar'?'تحديث ↻':'Refresh ↻')}</button></div></div>
          {loadingTasks && !queuedTasks.length ? <Empty text={language==='ar'?'جارٍ تحميل المهام…':'Loading tasks…'}/> : queuedTasks.filter((task)=>taskFilter==='all'||task.status===taskFilter).length ? <div className="task-queue-list">{queuedTasks.filter((task)=>taskFilter==='all'||task.status===taskFilter).map((task)=> <article className="approval task-queue-item" key={task.id}>
            <div className="approval-top"><strong>{task.title}</strong><span className="pill">{task.status==='queued'?(language==='ar'?'في الانتظار':'Queued'):task.status==='waiting_approval'?(language==='ar'?'بانتظار الموافقة':'Awaiting approval'):task.status==='running'?(language==='ar'?'قيد التنفيذ':'Running'):task.status==='completed'?(language==='ar'?'مكتملة':'Completed'):task.status==='cancelled'?(language==='ar'?'ملغاة':'Cancelled'):task.status==='failed'?(language==='ar'?'فشلت':'Failed'):task.status}</span></div>
            {task.description && <p>{task.description}</p>}
            {task.result && <div className="notice-inline task-result"><strong>{language==='ar'?'نتيجة التنفيذ المحلي':'Local execution result'}</strong><p>{task.result}</p></div>}
            <small>{new Date(task.created_at).toLocaleString(language==='ar'?'ar':'en-US')} · {language==='ar'?'الأولوية':'Priority'} {task.priority || 0}</small>
            <div className="approval-actions">
              <button className="button secondary" onClick={()=>toggleTaskHistory(task.id)}>{taskHistoryId===task.id?(language==='ar'?'إخفاء السجل':'Hide history'):(language==='ar'?'سجل المهمة':'Task history')}</button>
              {Capacitor.isNativePlatform() && task.status==='queued' && <button className="button secondary" disabled={taskActionId===task.id} onClick={()=>controlQueuedTask(task.id,'pause')}>{language==='ar'?'إيقاف مؤقت':'Pause'}</button>}
              {Capacitor.isNativePlatform() && task.status==='paused' && <button className="button secondary" disabled={taskActionId===task.id} onClick={()=>controlQueuedTask(task.id,'resume')}>{language==='ar'?'استئناف':'Resume'}</button>}
              {Capacitor.isNativePlatform() && ['queued','paused'].includes(task.status) && <button className="button secondary" disabled={taskActionId===task.id} onClick={()=>controlQueuedTask(task.id,'priority',10)}>{language==='ar'?'أولوية قصوى':'High priority'}</button>}
              {['queued','planning','waiting_approval','paused'].includes(task.status) && <button className="button danger" disabled={taskActionId===task.id} onClick={()=>cancelQueuedTask(task.id)}>{taskActionId===task.id?(language==='ar'?'جارٍ الإلغاء…':'Cancelling…'):(language==='ar'?'إلغاء المهمة':'Cancel task')}</button>}
            </div>
            {task.status==='queued' && !Capacitor.isNativePlatform() && <div className="task-execution-form">
              <strong>{language==='ar'?'إجراء آمن ضمن القائمة المسموحة':'Allowlisted safe action'}</strong>
              <label>{language==='ar'?'نوع الإجراء':'Action type'}<select value={executionInputs[task.id]?.action || executionActions[0]?.id || ''} disabled={loadingExecutionActions || !executionActions.length} onChange={event=>setExecutionInputs(current=>({...current,[task.id]:{...current[task.id],action:event.target.value,filename:event.target.value==='export_project_inventory'?'inventory.md':('task-'+task.id+'.md')}}))}>{executionActions.map(action=><option key={action.id} value={action.id}>{language==='ar'?action.title:action.title_en}</option>)}</select></label>
              <label>{language==='ar'?'مساحة المشروع':'Project workspace'}<select value={executionInputs[task.id]?.projectId || ''} onChange={event=>setExecutionInputs(current=>({...current,[task.id]:{...current[task.id],projectId:event.target.value}}))}><option value="">{language==='ar'?'اختر مشروعاً نشطاً':'Select an active project'}</option>{projects.filter(project=>project.status==='active').map(project=><option key={project.id} value={project.id}>{project.title} · #{project.id}</option>)}</select></label>
              {!projects.some(project=>project.status==='active') && <small>{language==='ar'?'لا توجد مساحة مشروع نشطة. أنشئ مشروعاً أولاً من قسم الملفات والمشاريع.':'No active project yet. Create one in Files & Projects first.'} <button type="button" className="text-button" onClick={()=>setActive('files')}>{language==='ar'?'فتح المشاريع':'Open projects'}</button></small>}
              <label>{language==='ar'?'اسم الملف الناتج':'Output filename'}<input value={executionInputs[task.id]?.filename ?? ((executionInputs[task.id]?.action === 'export_project_inventory') ? 'inventory.md' : 'task-'+task.id+'.md')} onChange={event=>setExecutionInputs(current=>({...current,[task.id]:{...current[task.id],filename:event.target.value}}))}/></label>
              {(executionInputs[task.id]?.action || 'write_project_note') === 'write_project_note' && <label>{language==='ar'?'محتوى الملف':'File content'}<textarea rows="3" value={executionInputs[task.id]?.content ?? task.description ?? ''} onChange={event=>setExecutionInputs(current=>({...current,[task.id]:{...current[task.id],content:event.target.value}}))} placeholder={language==='ar'?'اكتب المحتوى الذي تريد حفظه…':'Write the content to save…'}/></label>}
              {(executionInputs[task.id]?.action || executionActions[0]?.id) && <small>{language==='ar' ? executionActions.find(action=>action.id===(executionInputs[task.id]?.action || executionActions[0]?.id))?.description : executionActions.find(action=>action.id===(executionInputs[task.id]?.action || executionActions[0]?.id))?.description_en}</small>}
              <button className="button primary" disabled={taskActionId===task.id || !executionActions.length || loadingExecutionActions} onClick={()=>executeQueuedTask(task)}>{taskActionId===task.id?(language==='ar'?'جارٍ التنفيذ…':'Executing…'):(language==='ar'?'بدء التنفيذ اليدوي':'Start manual execution')}</button>
            </div>}
            {taskHistoryId===task.id && <div className="task-history">
              <strong>{language==='ar'?'تسلسل الحالة':'Status timeline'}</strong>
              {loadingTaskHistory ? <small>{language==='ar'?'جارٍ تحميل السجل…':'Loading history…'}</small> : taskHistory.length ? taskHistory.map((event)=><div className="task-history-row" key={event.id}><span>{event.from_status ? event.from_status+' → ' : ''}{event.to_status}</span><small>{event.details}</small><time>{new Date(event.created_at).toLocaleString(language==='ar'?'ar':'en-US')}</time></div>) : <small>{language==='ar'?'لا توجد أحداث مسجلة لهذه المهمة بعد.':'No recorded events for this task yet.'}</small>}
            </div>}
          </article>)}</div> : <Empty text={queuedTasks.length ? (language==='ar'?'لا توجد مهام بهذه الحالة.':'No tasks match this status.') : (language==='ar'?'لا توجد مهام في الطابور بعد. أرسل أول خطة من النموذج أعلاه.':'The queue is empty. Submit your first plan using the form above.')}/>}
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
        <div className="panel-card brand-ai-brief"><div className="section-heading"><div><h3>{language === 'ar' ? 'موجز الهوية بمساعدة روح' : 'AI-assisted brand brief'}</h3><p className="muted">{language === 'ar' ? 'تحليل استراتيجي نصي يحافظ على الشعار والألوان المعتمدة.' : 'A text strategy brief that preserves the approved logo and colors.'}</p></div><div className="module-action-list"><button type="button" className="button secondary" onClick={generateBrandBrief} disabled={brandBriefGenerating}>{brandBriefGenerating ? (language === 'ar' ? 'روح تحلل العلامة…' : 'Rooh is analyzing…') : (language === 'ar' ? 'إعداد موجز الهوية ✦' : 'Generate brand brief ✦')}</button><button type="button" className="button secondary" onClick={downloadBrandBrief} disabled={!brandBrief}>{language === 'ar' ? 'تصدير الموجز TXT' : 'Export brief TXT'}</button></div></div>
          {brandBrief ? <div className="brand-brief-grid"><article><strong>{language === 'ar' ? 'التموضع' : 'Positioning'}</strong><p>{brandBrief.positioning}</p></article><article><strong>{language === 'ar' ? 'الجمهور' : 'Audience'}</strong><p>{brandBrief.audience}</p></article><article><strong>{language === 'ar' ? 'نبرة العلامة' : 'Brand voice'}</strong><p>{brandBrief.voice}</p></article><article><strong>{language === 'ar' ? 'الاتجاه البصري' : 'Visual direction'}</strong><p>{brandBrief.visualDirection}</p></article><article><strong>{language === 'ar' ? 'تطبيقات الهوية' : 'Identity applications'}</strong><ul>{brandBrief.applications.map((item,index)=><li key={index}>{item}</li>)}</ul></article></div> : <Empty text={language === 'ar' ? 'اطلب من روح إعداد موجز للعلامة بعد ضبط بياناتها.' : 'Ask Rooh to prepare a brand brief after entering your identity details.'}/>}</div>
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
            <button type="button" className="button secondary" onClick={() => generateStudioDraft('app')} disabled={appGenerating}>{appGenerating ? (language === 'ar' ? 'روح تخطط الأقسام…' : 'Rooh is planning…') : (language === 'ar' ? 'اقتراح هيكل بواسطة روح ✦' : 'Suggest structure with Rooh ✦')}</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><div><h3>{language === 'ar' ? 'المعاينة والتصدير' : 'Preview & export'}</h3><p className="muted">{language === 'ar' ? 'واجهة أولية قابلة للتطوير وربطها بقاعدة بيانات.' : 'An interface starter ready for future backend integration.'}</p></div><button className="button secondary" onClick={downloadAppStarter} disabled={!appHtml}>{language === 'ar' ? 'تنزيل HTML' : 'Download HTML'}</button></div><div className="settings-inline"><select aria-label={language === 'ar' ? 'مشروع حفظ التطبيق' : 'Project to save app'} value={studioProjectId} onChange={(e) => setStudioProjectId(e.target.value)}><option value="">{language === 'ar' ? 'اختر مشروعاً لحفظ HTML' : 'Select project for HTML'}</option>{projects.filter((project) => project.status === 'active').map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button type="button" className="button secondary" onClick={() => saveStudioArtifact('app')} disabled={!appHtml || !studioProjectId || uploadingFile}>{uploadingFile ? (language === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : (language === 'ar' ? 'حفظ داخل المشروع' : 'Save to project')}</button></div>{appHtml ? <iframe title="Application preview" sandbox="" srcDoc={appHtml} style={{width:'100%',minHeight:'520px',border:'1px solid var(--line)',borderRadius:'14px',background:'#111'}}/> : <Empty text={language === 'ar' ? 'أدخل بيانات التطبيق ثم أنشئ المعاينة.' : 'Enter app details and generate a preview.'}/>}</div>
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
            <button type="button" className="button secondary" onClick={() => generateStudioDraft('website')} disabled={siteGenerating}>{siteGenerating ? (language === 'ar' ? 'روح تكتب المحتوى…' : 'Rooh is drafting…') : (language === 'ar' ? 'كتابة المحتوى بواسطة روح ✦' : 'Draft copy with Rooh ✦')}</button>
          </form></div>
          <div className="panel-card"><div className="section-heading"><div><h3>{language === 'ar' ? 'معاينة مباشرة' : 'Live preview'}</h3><p className="muted">{language === 'ar' ? 'صفحة ثابتة مستقلة دون مكتبات خارجية.' : 'Standalone static page with no external libraries.'}</p></div><button className="button secondary" onClick={downloadLandingPage} disabled={!siteHtml}>{language === 'ar' ? 'تنزيل HTML' : 'Download HTML'}</button></div>
            <div className="settings-inline"><select aria-label={language === 'ar' ? 'مشروع حفظ الموقع' : 'Project to save website'} value={studioProjectId} onChange={(e) => setStudioProjectId(e.target.value)}><option value="">{language === 'ar' ? 'اختر مشروعاً لحفظ HTML' : 'Select project for HTML'}</option>{projects.filter((project) => project.status === 'active').map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button type="button" className="button secondary" onClick={() => saveStudioArtifact('website')} disabled={!siteHtml || !studioProjectId || uploadingFile}>{uploadingFile ? (language === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : (language === 'ar' ? 'حفظ داخل المشروع' : 'Save to project')}</button></div>{siteHtml ? <iframe title="Website preview" sandbox="" srcDoc={siteHtml} style={{width:'100%',minHeight:'520px',border:'1px solid var(--line)',borderRadius:'14px',background:'#101014'}}/> : <Empty text={language === 'ar' ? 'أدخل المحتوى ثم اضغط إنشاء المعاينة.' : 'Enter your content and generate the preview.'}/>}
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
      {!['overview','security','files','assistant','media','web','design','apps','agents','domains','work','hub','root','settings','vault','terminal'].includes(active) && <section className="content">
        <div className="module-intro panel-card"><Icon>{current.icon}</Icon><h2>{current.title}</h2><p>{current.desc}</p><span className="pill">{language === 'ar' ? 'مساحة تجهيز العمل' : 'Work preparation space'}</span></div>
        <div className="module-workspace-grid">
          <div className="panel-card"><h3>{language === 'ar' ? 'إعداد مهمة جديدة' : 'Create a new task'}</h3><p className="muted">{language === 'ar' ? 'اكتب المطلوب واحفظه في الخزنة كتكليف قابل للمتابعة. لن ندّعي تنفيذ خدمة خارجية قبل ربط محركها فعلياً.' : 'Describe the task and save it to the vault for follow-up. External services will not be presented as active until their engines are connected.'}</p>
            <form className="proposal-form" onSubmit={(event) => { event.preventDefault(); if (!moduleDraft.title.trim() || !moduleDraft.details.trim()) return; setVaultItems((items) => [{ id: Date.now(), title: moduleDraft.title.trim(), content: current.title + '\n\n' + moduleDraft.details.trim(), category: 'task', createdAt: new Date().toISOString() }, ...items]); setModuleDraft({ title: '', details: '' }); setNotice(language === 'ar' ? 'تم حفظ التكليف في الخزنة المحلية.' : 'Assignment saved to the local vault.'); }}>
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
    <nav className="utility-dock" aria-label={language === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
      <button className={active === 'overview' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('overview')}><span>⌂</span>{language === 'ar' ? 'البداية' : 'Home'}</button>
      <button className={active === 'assistant' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('assistant')}><span>✦</span>{language === 'ar' ? 'روح' : 'Rooh'}</button>
      <button className={active === 'work' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('work')}><span>✧</span>{language === 'ar' ? 'العمل' : 'Work'}</button>
      <button className={active === 'hub' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('hub')}><span>⌘</span>{language === 'ar' ? 'هوب' : 'Hub'}</button>
      <button className={active === 'root' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('root')}><span>⬡</span>{language === 'ar' ? 'الجذر' : 'Root'}</button>
      <button className={active === 'settings' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('settings')}><span>⚙</span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</button>
      <button className={active === 'terminal' ? 'dock-item active' : 'dock-item'} onClick={() => setActive('terminal')}><span>⌘</span>{language === 'ar' ? 'الطرفية' : 'Terminal'}</button>
    </nav>      {appLocked && <div className="app-lock-backdrop" role="dialog" aria-modal="true" aria-labelledby="app-lock-title"><form className="app-lock-card" onSubmit={(event) => { event.preventDefault(); unlockApp(); }}><div className="brand-mark auth-mark">ST</div><p className="eyebrow">SOULARAB TECH / APP LOCK</p><h2 id="app-lock-title">{language === 'ar' ? 'التطبيق مقفل' : 'App locked'}</h2><p>{language === 'ar' ? 'أدخل رمز PIN المكوّن من ستة أرقام للمتابعة.' : 'Enter your six-digit PIN to continue.'}</p><input type="password" inputMode="numeric" autoComplete="current-password" maxLength="6" autoFocus value={appPin} onChange={(e) => setAppPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••"/>{appLockError && <small className="warn">{appLockError}</small>}{Capacitor.isNativePlatform() && <button type="button" className="button secondary" onClick={unlockWithBiometric}>{language === 'ar' ? 'فتح بالبصمة' : 'Unlock with biometrics'}</button>}<button className="button primary" disabled={appPin.length !== 6}>{language === 'ar' ? 'فتح التطبيق' : 'Unlock app'}</button></form></div>}
      {authRequired && <div className="auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <form className="auth-card" onSubmit={unlockWorkspace}>
          <div className="brand-mark auth-mark">ST</div>
          <p className="eyebrow">SOULARAB TECH / SECURE ACCESS</p>
          <h2 id="auth-title">{language === 'ar' ? 'مساحة العمل محمية' : 'Workspace protected'}</h2>
          <p>{language === 'ar' ? 'أدخل رمز الوصول الذي ضبطته في ملف إعدادات الخادم لفتح لوحة التحكم. يُحفظ الرمز في جلسة المتصفح الحالية فقط.' : 'Enter the access token configured on the server to unlock the workspace. It is stored only for this browser session.'}</p>
          <label>{language === 'ar' ? 'رمز الوصول' : 'Access token'}<input type="password" value={loginToken} onChange={(e) => setLoginToken(e.target.value)} autoComplete="current-password" required placeholder={language === 'ar' ? 'أدخل رمز API' : 'Enter API token'}/></label>
          <button className="button primary" disabled={!loginToken.trim()}>{language === 'ar' ? 'فتح مساحة العمل' : 'Unlock workspace'}</button>
        </form>
      </div>}
  </div>;
}


function MeshManager({ request, language }) {
  const [mesh, setMesh] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('A');
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const ar = language === 'ar';
  const roleNames = {
    A: ar ? 'النصوص والمحادثة' : 'Text & chat',
    B: ar ? 'الصور والتصميم' : 'Images & design',
    C: ar ? 'الصوت والفيديو' : 'Audio & video',
    D: ar ? 'البرمجة والتطبيقات' : 'Code & apps',
    E: ar ? 'الاحتياطي وتوزيع المهام' : 'Fallback & routing',
  };
  async function loadMesh() {
    setBusy(true); setError('');
    try { setMesh(await request('/api/mesh/status')); }
    catch (e) { setError(e.message || (ar ? 'تعذر تحميل حالة شبكة الخوادم.' : 'Could not load mesh status.')); }
    finally { setBusy(false); }
  }
  useEffect(() => { loadMesh(); }, []);
  async function discover(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await request('/api/mesh/discover', { method: 'POST', body: JSON.stringify({ name: name.trim(), role, base_url: baseUrl.trim() }) });
      setMessage(ar ? 'تم اكتشاف العقدة والتحقق من توافقها.' : 'Node discovered and compatibility verified.');
      setName(''); await loadMesh();
    } catch (e) { setError(e.message || (ar ? 'فشل اكتشاف الخادم.' : 'Node discovery failed.')); }
    finally { setBusy(false); }
  }
  async function removeNode(id) {
    setBusy(true); setError('');
    try { await request('/api/mesh/nodes/' + encodeURIComponent(id), { method: 'DELETE' }); await loadMesh(); }
    catch (e) { setError(e.message || (ar ? 'تعذر حذف العقدة.' : 'Could not remove node.')); }
    finally { setBusy(false); }
  }
  return <div className="panel-card" style={{marginTop:16}}>
    <div className="section-heading">
      <div><h2>{ar ? 'شبكة الخوادم الخمسة' : 'Five-server compute mesh'}</h2><p className="muted">{ar ? 'اكتشاف عقد موثوقة على جهازك أو شبكتك المحلية فقط.' : 'Discover trusted nodes on this device or your local network only.'}</p></div>
      <button className="button secondary" onClick={loadMesh} disabled={busy}>{busy ? '…' : (ar ? 'فحص الآن' : 'Check now')}</button>
    </div>
    <div className="diagnostic-grid">
      <article className="stat-card"><span>{ar ? 'العقد المسجلة' : 'Registered nodes'}</span><strong>{mesh?.registered_nodes ?? '—'}</strong></article>
      <article className="stat-card"><span>{ar ? 'العقد المتاحة' : 'Online nodes'}</span><strong className={mesh?.online_nodes ? 'good' : 'warn'}>{mesh?.online_nodes ?? '—'}</strong></article>
      <article className="stat-card"><span>{ar ? 'سياسة الاكتشاف' : 'Discovery policy'}</span><strong>{ar ? 'محلي موثوق' : 'Trusted local'}</strong></article>
    </div>
    <div className="module-grid" style={{marginTop:12}}>
      {['A','B','C','D','E'].map((key) => {
        const slot = mesh?.slots?.find((item) => item.role === key);
        return <article className="stat-card" key={key}>
          <span>{ar ? 'الخادم ' + key : 'Server ' + key}</span>
          <strong>{roleNames[key]}</strong>
          <small className={slot?.status === 'online' ? 'good' : 'warn'}>{slot?.status === 'online' ? (ar ? 'متصل' : 'Online') : (ar ? 'غير متصل' : 'Offline')}</small>
          {slot?.selected_node && <small>{slot.selected_node.name} · {slot.selected_node.latency_ms ?? '—'} ms</small>}
          {slot?.nodes?.filter((node) => node.status !== 'online').map((node) => <small key={node.id}>{node.name} · {ar ? 'غير مستجيب' : 'Unreachable'}</small>)}
          {slot?.nodes?.map((node) => <button className="text-button" key={node.id} onClick={() => removeNode(node.id)} disabled={busy}>{ar ? 'إزالة ' : 'Remove '}{node.name}</button>)}
        </article>;
      })}
    </div>
    <form className="proposal-form" onSubmit={discover} style={{marginTop:16}}>
      <h3>{ar ? 'البحث عن خادم محلي متاح' : 'Find an available local server'}</h3>
      <label>{ar ? 'اسم العقدة' : 'Node name'}<input value={name} onChange={(e) => setName(e.target.value)} required maxLength="80" placeholder={ar ? 'مثال: هاتف احتياطي' : 'Example: Spare phone'} /></label>
      <label>{ar ? 'وظيفة الخادم' : 'Server role'}<select value={role} onChange={(e) => setRole(e.target.value)}>{['A','B','C','D','E'].map((key) => <option value={key} key={key}>{'Server ' + key + ' — ' + roleNames[key]}</option>)}</select></label>
      <label>{ar ? 'عنوان الخادم داخل الشبكة المحلية' : 'Local network server address'}<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required type="url" placeholder="http://192.168.1.20:8000" /></label>
      <button className="button primary" disabled={busy || !name.trim() || !baseUrl.trim()}>{busy ? (ar ? 'جارٍ الفحص…' : 'Checking…') : (ar ? 'اكتشاف وفحص الخادم' : 'Discover and verify node')}</button>
    </form>
    {error && <p className="notice" role="alert">{error}</p>}
    {message && <p className="notice">{message}</p>}
    <p className="chat-footnote">{ar ? 'لا يجري مسح الإنترنت أو الاتصال بمزوّد خارجي. أضف عنوان جهاز تملكه أو تثق به على الشبكة المحلية؛ لا تُسجّل العقدة إلا بعد نجاح فحص الصحة وبروتوكول SOULARAB MESH. هذه المرحلة تسجّل العقد وتفحصها؛ توزيع تنفيذ المهام بين الأجهزة يحتاج محرك عامل متوافقاً على كل عقدة.' : 'No internet scanning or third-party provider is used. Add a device you own or trust on your local network. A node is registered only after health and SOULARAB MESH protocol checks. This stage registers and monitors nodes; task execution across devices requires a compatible worker engine on each node.'}</p>
  </div>;
}

function Empty({text}) { return <div className="empty">{text}</div>; }
function AuditList({events, language = 'ar'}) { return events.length ? <div className="audit-list">{events.map((event) => <div className="audit-row" key={event.id}><span className="audit-mark">•</span><div><strong>{event.action}</strong><small>{event.details}</small></div><time>{new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</time></div>)}</div> : <Empty text={language === 'ar' ? 'لا توجد عمليات مسجلة بعد.' : 'No operations recorded yet.'}/>; }
