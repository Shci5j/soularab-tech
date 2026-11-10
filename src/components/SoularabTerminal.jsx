import { useMemo, useRef, useState } from 'react';
import './soularab-terminal.css';

const initialLines = [
  { type: 'system', text: 'SOULARAB TERMINAL · SAFE PREVIEW' },
  { type: 'info', text: 'هذه واجهة معاينة آمنة. الأوامر هنا لا تُنفّذ على نظام Android بعد.' },
  { type: 'success', text: 'اكتب help لعرض الأوامر المتاحة.' },
];

const helpText = [
  'الأوامر المتاحة في وضع المعاينة:',
  'help       عرض المساعدة',
  'clear      مسح الشاشة',
  'pwd        عرض مسار مساحة العمل التجريبية',
  'ls         عرض ملفات تجريبية',
  'whoami     عرض هوية جلسة المعاينة',
  'date       عرض الوقت المحلي',
  'uname      معلومات بيئة المعاينة',
  'version    إصدار واجهة SOULARAB TERMINAL',
  'status     حالة وحدات الطرفية',
  'echo TEXT  إعادة عرض النص',
  '',
  'ملاحظة: لا يتم تنفيذ أوامر Linux أو الوصول إلى ملفات الهاتف في هذه المرحلة.',
];

const demoFiles = [
  { name: 'projects/', detail: 'مجلد مشاريع تجريبي', kind: 'folder' },
  { name: 'scripts/', detail: 'مجلد سكربتات تجريبي', kind: 'folder' },
  { name: 'README.md', detail: 'ملف تعريفي', kind: 'file' },
  { name: 'hello.py', detail: 'مثال Python', kind: 'file' },
];

const tools = [
  { name: 'Python', detail: 'بيئة تشغيل Python', state: 'قيد التخطيط' },
  { name: 'Node.js', detail: 'تشغيل JavaScript وأدوات الويب', state: 'قيد التخطيط' },
  { name: 'Git', detail: 'إدارة المستودعات والإصدارات', state: 'قيد التخطيط' },
  { name: 'llama.cpp', detail: 'محرك روح المحلي', state: 'موجود في بيئة المشروع الحالية' },
];

function runPreviewCommand(raw) {
  const command = raw.trim();
  if (!command) return [];
  const [name, ...args] = command.split(/\s+/);
  switch (name.toLowerCase()) {
    case 'help': return helpText.map((text) => ({ type: 'info', text }));
    case 'pwd': return [{ type: 'success', text: '/soularab/workspace' }];
    case 'ls': return [{ type: 'success', text: 'projects/  scripts/  README.md  hello.py' }];
    case 'whoami': return [{ type: 'success', text: 'soularab-user (preview session)' }];
    case 'date': return [{ type: 'success', text: new Date().toLocaleString() }];
    case 'uname': return [{ type: 'success', text: 'SOULARAB Mobile Environment · Android host · preview only' }];
    case 'version': return [{ type: 'success', text: 'SOULARAB TERMINAL UI 0.1.0' }];
    case 'status': return [
      { type: 'info', text: 'Terminal UI: ready' },
      { type: 'warning', text: 'Native command runner: not connected' },
      { type: 'warning', text: 'Filesystem access: not connected' },
    ];
    case 'echo': return [{ type: 'success', text: args.join(' ') }];
    default: return [{ type: 'error', text: `الأمر "${name}" غير متاح في وضع المعاينة. اكتب help.` }];
  }
}

export default function SoularabTerminal({ language = 'ar' }) {
  const ar = language === 'ar';
  const [tab, setTab] = useState('terminal');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState(initialLines);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);
  const tabs = useMemo(() => [
    { id: 'terminal', ar: 'الطرفية', en: 'Terminal', icon: '›_' },
    { id: 'files', ar: 'الملفات', en: 'Files', icon: '▰' },
    { id: 'packages', ar: 'الحزم', en: 'Packages', icon: '▦' },
    { id: 'services', ar: 'الخدمات', en: 'Services', icon: '◉' },
  ], []);

  function submit(event) {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    setHistory((items) => [...items, value].slice(-50));
    if (value.toLowerCase() === 'clear') {
      setLines([]);
      setCommand('');
      return;
    }
    const output = runPreviewCommand(value);
    setLines((items) => [...items, { type: 'command', text: value }, ...output].slice(-120));
    setCommand('');
  }

  return <section className="content st-terminal-page">
    <div className="st-terminal-heading">
      <div>
        <p className="st-terminal-eyebrow">SOULARAB TECH / DEVELOPER TOOLS</p>
        <h2>SOULARAB TERMINAL</h2>
        <p>{ar ? 'بيئة تطوير محلية موحّدة لإدارة الأوامر والملفات والأدوات.' : 'A unified local development workspace for commands, files, and tools.'}</p>
      </div>
      <span className="st-terminal-version">v0.1.0</span>
    </div>

    <div className="st-terminal-notice" role="status">
      <span className="st-terminal-notice-dot" />
      <div><strong>{ar ? 'وضع المعاينة الآمن' : 'Safe preview mode'}</strong><small>{ar ? 'واجهة الطرفية جاهزة. تنفيذ أوامر النظام وربط ملفات Android سيأتيان في مرحلة التكامل الأصلي.' : 'The terminal interface is ready. System command execution and Android filesystem integration will be added in the native integration phase.'}</small></div>
    </div>

    <div className="st-terminal-tabs" role="tablist" aria-label={ar ? 'أدوات الطرفية' : 'Terminal tools'}>
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span>{item.icon}</span>{ar ? item.ar : item.en}</button>)}
    </div>

    {tab === 'terminal' && <div className="st-terminal-window">
      <div className="st-terminal-bar"><span /><span /><span /><b>soularab@mobile: ~</b><button type="button" onClick={() => setLines([])}>{ar ? 'مسح الشاشة' : 'Clear screen'}</button></div>
      <div className="st-terminal-output" aria-live="polite">
        {lines.map((line, index) => <div className={`st-terminal-line ${line.type}`} key={index}>{line.type === 'command' ? <><span className="st-terminal-prompt">soularab@mobile:~$</span> {line.text}</> : line.text}</div>)}
      </div>
      <form className="st-terminal-input" onSubmit={submit}>
        <label htmlFor="st-terminal-command"><span>soularab@mobile:~$</span></label>
        <input id="st-terminal-command" ref={inputRef} value={command} onChange={(event) => setCommand(event.target.value)} autoComplete="off" spellCheck="false" placeholder={ar ? 'اكتب help لعرض الأوامر...' : 'Type help to see commands...'} />
        <button type="submit" disabled={!command.trim()} aria-label={ar ? 'تنفيذ أمر المعاينة' : 'Run preview command'}>↵</button>
      </form>
      <div className="st-terminal-foot">{ar ? `الأوامر السابقة: ${history.length} · تنفيذ تجريبي فقط` : `Commands entered: ${history.length} · preview only`}</div>
    </div>}

    {tab === 'files' && <div className="st-terminal-panel">
      <div className="st-terminal-panel-title"><div><h3>{ar ? 'مساحة الملفات التجريبية' : 'Preview file workspace'}</h3><p>{ar ? 'هذه عناصر توضيحية وليست ملفات هاتفك الفعلية.' : 'These are sample entries, not your actual phone files.'}</p></div><span className="st-terminal-chip">{ar ? 'معاينة' : 'Preview'}</span></div>
      {demoFiles.map((file) => <div className="st-terminal-file" key={file.name}><span>{file.kind === 'folder' ? '▰' : '▤'}</span><div><strong>{file.name}</strong><small>{file.detail}</small></div><b>{file.kind === 'folder' ? (ar ? 'مجلد' : 'Folder') : (ar ? 'ملف' : 'File')}</b></div>)}
    </div>}

    {tab === 'packages' && <div className="st-terminal-panel">
      <div className="st-terminal-panel-title"><div><h3>{ar ? 'مدير الحزم والأدوات' : 'Packages & tools'}</h3><p>{ar ? 'كتالوج الأدوات المقترح لبيئة التطوير.' : 'Planned tool catalog for the development environment.'}</p></div><span className="st-terminal-chip">{ar ? 'غير متصل' : 'Not connected'}</span></div>
      {tools.map((tool) => <div className="st-terminal-tool" key={tool.name}><div><strong>{tool.name}</strong><small>{tool.detail}</small></div><span>{tool.state}</span></div>)}
    </div>}

    {tab === 'services' && <div className="st-terminal-panel">
      <div className="st-terminal-panel-title"><div><h3>{ar ? 'الخدمات المحلية' : 'Local services'}</h3><p>{ar ? 'ستظهر هنا حالة الخدمات بعد ربط مدير العمليات الأصلي.' : 'Service health will appear here after native process integration.'}</p></div><span className="st-terminal-chip">{ar ? 'بانتظار الربط' : 'Awaiting integration'}</span></div>
      <div className="st-terminal-service"><span className="st-terminal-service-mark">AI</span><div><strong>ROOH AI · llama.cpp</strong><small>{ar ? 'محرك الذكاء الاصطناعي المحلي' : 'Local AI inference engine'}</small></div><b>{ar ? 'يعمل ضمن بيئة المشروع' : 'Available in project environment'}</b></div>
      <div className="st-terminal-service"><span className="st-terminal-service-mark">API</span><div><strong>SOULARAB Backend</strong><small>{ar ? 'خدمات API المحلية' : 'Local API services'}</small></div><b>{ar ? 'بانتظار الربط' : 'Awaiting integration'}</b></div>
    </div>}

    <div className="st-terminal-safety"><strong>{ar ? 'ضوابط الأمان' : 'Safety controls'}</strong><span>{ar ? 'لن تُنفّذ أوامر حقيقية أو عمليات حذف أو تثبيت أو وصول إلى ملفات الجهاز قبل بناء محرك تنفيذ أصلي بصلاحيات محدودة وسجل تدقيق.' : 'No real commands, installs, deletions, or device-file access will run until a permission-scoped native execution engine and audit log are implemented.'}</span></div>
  </section>;
}
