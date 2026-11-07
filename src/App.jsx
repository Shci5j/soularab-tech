import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
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
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `تعذر إكمال الطلب (${response.status})`);
    }
    return response.json();
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
  </div>;
}

function Empty({text}) { return <div className="empty">{text}</div>; }
function AuditList({events}) { return events.length ? <div className="audit-list">{events.map((event) => <div className="audit-row" key={event.id}><span className="audit-mark">•</span><div><strong>{event.action}</strong><small>{event.details}</small></div><time>{new Date(event.created_at).toLocaleString('ar')}</time></div>)}</div> : <Empty text="لا توجد عمليات مسجلة بعد."/>; }
