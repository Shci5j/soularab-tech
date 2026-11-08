import { useMemo, useState } from 'react';

const aiSections = [
  ['web', 'إنشاء المواقع الإلكترونية', 'تصميم وبرمجة واختبار المواقع', '⌘'],
  ['stores', 'المتاجر الإلكترونية', 'بناء المتاجر وتجارب التسوق', '▣'],
  ['logos', 'تصميم الشعارات', 'الشعارات والهويات البصرية', '◇'],
  ['images', 'توليد الصور', 'إنشاء الصور وتحريرها ومعالجتها', '▧'],
  ['video', 'إنشاء الفيديو', 'توليد الفيديو والمونتاج والمشاهد', '▷'],
  ['apps', 'إنشاء التطبيقات', 'تطبيقات الهاتف والبرامج', '▦'],
  ['graphic', 'التصميم الجرافيكي', 'الإعلانات والمطبوعات والتصاميم', '✳'],
  ['docs', 'المستندات والملفات', 'إنشاء وقراءة وتحويل الملفات', '▤'],
  ['agents', 'الوكلاء الذكيون', 'إنشاء مساعدين متخصصين', '✧'],
  ['automation', 'الأتمتة والمهام', 'سير العمل وتنفيذ المهام المصرح بها', '⟳'],
];

const mainSections = [
  { id: 'work', title: 'العمل مع الذكاء', subtitle: '10 أقسام متخصصة بإدارة روح', icon: '✦', detail: 'ابدأ مهمة إبداعية أو تقنية مع الأقسام المتخصصة.' },
  { id: 'hub', title: 'SOULARAB HUB', subtitle: 'المستودعات وإدارة المشاريع البرمجية', icon: '⌘', detail: 'مركزك الخاص للأكواد والإصدارات والاختبارات.' },
  { id: 'jathr', title: 'الجذر · AL JATHR', subtitle: 'الأجهزة الذكية والتشخيص والصيانة', icon: '⌬', detail: 'اكتشاف الأجهزة وقراءة معلوماتها وتشخيصها.' },
  { id: 'vault', title: 'الخزنة', subtitle: 'مستودعاتك الخاصة وبياناتك المحمية', icon: '▣', detail: 'مساحة مستقلة لحفظ أعمالك وبياناتك.' },
];

const copy = {
  ar: {
    home: 'الرئيسية', start: 'الشروع بالعمل', greeting: 'مرحباً بك في', intro: 'مساحة عملك الذكية، تحت سيطرتك الكاملة.',
    assistant: 'روح · المساعد المركزي', assistantHint: 'اكتب ما تريد إنجازه أو ابحث داخل SOULARAB TECH',
    search: 'ابحث داخل التطبيق أو اكتب أمرك هنا...', send: 'إرسال', work: 'العمل مع الذكاء', hub: 'SOULARAB HUB',
    jathr: 'الجذر · AL JATHR', vault: 'الخزنة', back: 'رجوع', theme: 'المظهر', language: 'اللغة',
    dark: 'غامق', light: 'فاتح', sections: 'مساحات العمل', explore: 'اختر القسم الذي تريد العمل فيه',
    aiTitle: 'الأقسام الذكية المتخصصة', aiDesc: 'عشرة أقسام مستقلة، تدير روح التنسيق بينها ولا تنفذ أي أمر دون إذنك.',
    hubDesc: 'مستودعات خاصة لإدارة المشاريع والأكواد والفروع والإصدارات والاختبارات.',
    jathrDesc: 'مكتبة أجهزة مسبقة التعريف، واستكشاف وقراءة وتشخيص وصيانة بموافقتك.',
    vaultDesc: 'الخزنة مستقلة عن روح. لا يمكن الوصول إلى محتوياتها إلا بعد مصادقتك.',
    lockTitle: 'الخزنة محمية', lockDesc: 'أدخل رمزك المكوّن من أربعة أرقام لعرض المستودعات المحفوظة.',
    pin: 'الرمز السري · 4 أرقام', unlock: 'فتح الخزنة', notes: 'الملاحظات', active: 'الأعمال القائمة',
    deferred: 'الأعمال المؤجلة', savedCode: 'الأكواد المحفوظة', review: 'المراجعة والاحتفاظ المؤقت',
    addNote: 'إضافة ملاحظة', notePlaceholder: 'اكتب الملاحظة أو الكود أو رابط المستودع...',
    save: 'حفظ', cancel: 'إلغاء', approval: 'أوافق على تسجيل هذه الملاحظة في مساحة الملاحظات',
    assistantBubble: 'فتح روح', translate: 'ترجمة', translateHint: 'سيتم ربط محرك الترجمة في مرحلة المحركات.',
    coming: 'واجهة القسم الأولية جاهزة للربط بمحركه المتخصص.', status: 'تصميم أولي · بانتظار ربط المحركات',
    noItems: 'لا توجد عناصر محفوظة في هذا القسم بعد.', close: 'إغلاق', noteOnly: 'صلاحية روح تقتصر على إيداع ملاحظة بعد موافقتك؛ لا تستطيع قراءة محتويات الخزنة.',
    operations: 'مركز العمليات', projects: 'مشاريعي', approvals: 'الموافقات', settings: 'الإعدادات',
  },
  en: {
    home: 'Home', start: 'Workspace', greeting: 'Welcome to', intro: 'Your intelligent workspace, under your control.',
    assistant: 'ROOH · Central Assistant', assistantHint: 'Tell ROOH what to do or search SOULARAB TECH',
    search: 'Search the app or write your command...', send: 'Send', work: 'Work with AI', hub: 'SOULARAB HUB',
    jathr: 'AL JATHR', vault: 'Vault', back: 'Back', theme: 'Theme', language: 'Language',
    dark: 'Dark', light: 'Light', sections: 'Workspaces', explore: 'Choose where you want to work',
    aiTitle: 'Specialized AI departments', aiDesc: 'Ten independent departments coordinated by ROOH. No task runs without your permission.',
    hubDesc: 'Private repositories for projects, code, branches, releases and tests.',
    jathrDesc: 'Predefined device library, discovery, reading, diagnostics and authorized maintenance.',
    vaultDesc: 'The vault is independent from ROOH. Its contents stay locked until you authenticate.',
    lockTitle: 'Vault protected', lockDesc: 'Enter your four-digit PIN to view your saved repositories.',
    pin: '4-digit PIN', unlock: 'Unlock vault', notes: 'Notes', active: 'Active work',
    deferred: 'Deferred work', savedCode: 'Saved code', review: 'Review & temporary storage',
    addNote: 'Add note', notePlaceholder: 'Write a note, code snippet or repository link...',
    save: 'Save', cancel: 'Cancel', approval: 'I approve depositing this note in Notes',
    assistantBubble: 'Open ROOH', translate: 'Translate', translateHint: 'The translation engine will be connected in the engine phase.',
    coming: 'The initial department interface is ready for its specialized engine.', status: 'Initial design · engines not connected',
    noItems: 'No saved items in this section yet.', close: 'Close', noteOnly: 'ROOH may deposit a note only after your approval; it cannot read vault contents.',
    operations: 'Operations', projects: 'My projects', approvals: 'Approvals', settings: 'Settings',
  }
};

function Mark() {
  return <div className="brand-lockup">
    <img src="/icon.svg" alt="SOULARAB TECH emblem" />
    <div><strong>SOULARAB TECH</strong><small>IDEAS INTO DIGITAL REALITY</small></div>
  </div>;
}

function App() {
  const [page, setPage] = useState('home');
  const [theme, setTheme] = useState(() => localStorage.getItem('st-theme') || 'dark');
  const [lang, setLang] = useState(() => localStorage.getItem('st-lang') || 'ar');
  const [bubble, setBubble] = useState(false);
  const [chat, setChat] = useState('');
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [vaultTab, setVaultTab] = useState('notes');
  const [note, setNote] = useState('');
  const [approved, setApproved] = useState(false);
  const [notes, setNotes] = useState([]);
  const [toast, setToast] = useState('');
  const t = copy[lang];
  const rtl = lang === 'ar';
  const current = useMemo(() => mainSections.find(x => x.id === page), [page]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function navigate(next) {
    setPage(next);
    setBubble(false);
    if (next !== 'vault') setUnlocked(false);
  }

  function back() {
    if (page === 'vault' && unlocked) { setUnlocked(false); return; }
    setPage(page === 'home' ? 'home' : page === 'work' || page === 'hub' || page === 'jathr' || page === 'vault' ? 'home' : 'work');
    setBubble(false);
  }

  function unlockVault(event) {
    event.preventDefault();
    if (/^\d{4}$/.test(pin)) {
      setUnlocked(true);
      setPin('');
    }
  }

  function saveNote(event) {
    event.preventDefault();
    if (!approved || !note.trim()) return;
    setNotes(items => [{ id: Date.now(), text: note.trim(), date: new Date().toLocaleString(rtl ? 'ar' : 'en') }, ...items]);
    setNote('');
    setApproved(false);
    notify(rtl ? 'تم إيداع الملاحظة في مساحة الملاحظات.' : 'Note deposited in Notes.');
  }

  function translateAction() {
    notify(t.translateHint);
  }

  return <div className="app-shell" data-theme={theme} dir={rtl ? 'rtl' : 'ltr'}>
    <header className="topbar">
      <button className="back-button" onClick={back} aria-label={t.back}><span>↩</span><span>{t.back}</span></button>
      <Mark />
      <div className="top-controls">
        <button className="control-button" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); localStorage.setItem('st-theme', next); }} title={t.theme}>{theme === 'dark' ? '☼' : '☾'}<span>{theme === 'dark' ? t.light : t.dark}</span></button>
        <button className="control-button language-button" onClick={() => { const next = lang === 'ar' ? 'en' : 'ar'; setLang(next); localStorage.setItem('st-lang', next); }} title={t.language}><span className="language-glyph">文</span><span>{lang === 'ar' ? 'EN' : 'عربي'}</span></button>
      </div>
    </header>

    <main className="page-wrap">
      {page === 'home' && <>
        <section className="welcome-panel">
          <div className="welcome-copy"><span className="eyebrow">YOUR PRIVATE CREATIVE INTELLIGENCE</span><h1>{t.greeting} <em>SOULARAB TECH</em></h1><p>{t.intro}</p></div>
          <div className="assistant-card">
            <div className="assistant-card-head"><div className="rooh-avatar">ر</div><div><strong>{t.assistant}</strong><small>{rtl ? 'جاهزة لتلقي توجيهاتك' : 'Ready for your instructions'}</small></div><span className="online-indicator" /></div>
            <p>{t.assistantHint}</p>
            <form className="assistant-input" onSubmit={e => { e.preventDefault(); if(query.trim()) { setChat(query); setQuery(''); notify(rtl ? 'واجهة المحادثة جاهزة للربط بمحرك روح.' : 'Chat interface is ready for the ROOH engine.'); } }}>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search} />
              <button type="button" className="translate-button" onClick={translateAction}>{t.translate}</button>
              <button className="send-button" type="submit" aria-label={t.send}>➤</button>
            </form>
            <div className="assistant-card-foot"><span>✦ {rtl ? 'تحليل وتنسيق بإذنك' : 'Analysis and coordination with your permission'}</span><button onClick={()=>setBubble(true)}>{rtl ? 'تحويل إلى فقاعة عائمة' : 'Pop out assistant'} ↗</button></div>
          </div>
        </section>

        <section className="section-block"><div className="section-title"><div><span className="eyebrow">CONTROL CENTER</span><h2>{t.sections}</h2><p>{t.explore}</p></div><span className="section-count">04</span></div>
          <div className="workspace-grid">{mainSections.map((item,index)=><button key={item.id} className={'workspace-card card-'+item.id} onClick={()=>navigate(item.id)}><span className="card-index">0{index+1}</span><span className="workspace-icon">{item.icon}</span><strong>{item.title}</strong><small>{item.subtitle}</small><span className="card-arrow">↗</span></button>)}</div>
        </section>

        <section className="quick-strip"><div><span className="eyebrow">SOULARAB SYSTEM</span><strong>{t.operations}</strong><small>{rtl ? 'المهام والموافقات وحالة المحركات في مكان واحد' : 'Tasks, approvals and engine status in one place'}</small></div><div className="quick-actions"><button onClick={()=>notify(t.status)}>{t.projects}</button><button onClick={()=>notify(t.status)}>{t.approvals}</button><button onClick={()=>notify(t.status)}>{t.settings}</button></div></section>
      </>}

      {page === 'work' && <section className="department-page"><div className="page-heading"><span className="eyebrow">ROOH · WORK ORCHESTRATION</span><h1>{t.aiTitle}</h1><p>{t.aiDesc}</p></div><div className="ai-grid">{aiSections.map((item,index)=><button className="ai-card" key={item[0]} onClick={()=>notify(t.coming)}><span className="ai-number">{String(index+1).padStart(2,'0')}</span><span className="ai-icon">{item[3]}</span><strong>{item[1]}</strong><small>{item[2]}</small><span className="card-arrow">↗</span></button>)}</div><div className="rooh-manager"><div className="rooh-avatar">ر</div><div><strong>{rtl ? 'روح تدير هذا القسم' : 'ROOH manages this workspace'}</strong><p>{rtl ? 'لا تظهر فقاعة عائمة هنا؛ روح هي المديرة المدمجة في هذا القسم.' : 'No floating assistant here; ROOH is embedded as the department manager.'}</p></div></div></section>}

      {page === 'hub' && <section className="department-page"><div className="page-heading"><span className="eyebrow">PRIVATE DEVELOPMENT HUB · 11</span><h1>SOULARAB HUB</h1><p>{t.hubDesc}</p></div><div className="feature-grid">{[['▱',rtl?'المستودعات الخاصة':'Private repositories'],['⑂',rtl?'الفروع والإصدارات':'Branches & releases'],['✓',rtl?'الاختبارات والبناء':'Tests & builds'],['⌕',rtl?'البحث داخل الأكواد':'Code search']].map(x=><article className="feature-card" key={x[1]}><span>{x[0]}</span><strong>{x[1]}</strong><small>{t.status}</small></article>)}</div></section>}

      {page === 'jathr' && <section className="department-page"><div className="page-heading"><span className="eyebrow">DEVICE INTELLIGENCE · 12</span><h1>{t.jathr}</h1><p>{t.jathrDesc}</p></div><div className="device-grid">{[['◉',rtl?'الكاميرات الحديثة':'Modern cameras'],['▣',rtl?'الشاشات':'Displays'],['⌁',rtl?'الإنترنت والاتصالات':'Internet & connectivity'],['▦',rtl?'الهواتف والأجهزة اللوحية':'Phones & tablets'],['⌂',rtl?'الأجهزة المنزلية الذكية':'Smart home devices'],['◇',rtl?'أنظمة التحكم والأمان':'Control & security systems']].map(x=><button className="device-card" key={x[1]} onClick={()=>notify(t.coming)}><span>{x[0]}</span><strong>{x[1]}</strong><small>{t.status}</small></button>)}</div></section>}

      {page === 'vault' && <section className="department-page vault-page"><div className="page-heading"><span className="eyebrow">PRIVATE · ENCRYPTED SPACE</span><h1>{t.vault}</h1><p>{t.vaultDesc}</p></div>{!unlocked ? <form className="vault-lock" onSubmit={unlockVault}><div className="vault-lock-icon">▣</div><h2>{t.lockTitle}</h2><p>{t.lockDesc}</p><label>{t.pin}<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength="4" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••" autoComplete="off" /></label><button className="gold-button" disabled={pin.length!==4}>{t.unlock}</button><small>{rtl?'واجهة القفل في هذه النسخة للعرض فقط؛ المصادقة والتشفير الفعليان ضمن مرحلة الأمان.':'Lock screen is visual in this build; real authentication and encryption belong to the security phase.'}</small></form> : <><div className="vault-tabs">{[['notes',t.notes],['active',t.active],['deferred',t.deferred],['code',t.savedCode],['review',t.review]].map(x=><button className={vaultTab===x[0]?'selected':''} onClick={()=>setVaultTab(x[0])} key={x[0]}>{x[1]}</button>)}</div>{vaultTab==='notes' ? <div className="notes-layout"><form className="note-editor" onSubmit={saveNote}><h2>{t.addNote}</h2><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={t.notePlaceholder} /><div className="editor-tools"><button type="button" className="translate-button" onClick={translateAction}>{t.translate}</button><label className="approval-check"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>{t.approval}</label></div><button className="gold-button" disabled={!approved||!note.trim()}>{t.save}</button><p>{t.noteOnly}</p></form><div className="notes-list">{notes.length ? notes.map(x=><article key={x.id}><p>{x.text}</p><small>{x.date}</small></article>) : <div className="empty-state">{t.noItems}</div>}</div></div> : <div className="empty-state">{t.noItems}</div>}</>}</section>}
    </main>

    {bubble && page !== 'work' && page !== 'vault' && <div className="assistant-bubble-panel"><div className="bubble-head"><div className="rooh-avatar">ر</div><strong>{t.assistant}</strong><button onClick={()=>setBubble(false)}>×</button></div><p>{t.assistantHint}</p><form onSubmit={e=>{e.preventDefault(); if(chat.trim()) notify(t.coming);}}><input value={chat} onChange={e=>setChat(e.target.value)} placeholder={t.search}/><button className="send-button">{'➤'}</button></form><small>{rtl?'روح لا تنفذ أي إجراء دون موافقتك.':'ROOH never executes an action without your approval.'}</small></div>}
    {page !== 'home' && page !== 'work' && page !== 'vault' && !bubble && <button className="floating-rooh" onClick={()=>setBubble(true)} aria-label={t.assistantBubble}><span>ر</span></button>}
    {toast && <div className="toast" role="status">{toast}</div>}
    <footer className="app-footer"><span>SOULARAB TECH</span><span>IDEAS INTO DIGITAL REALITY</span><span>© {new Date().getFullYear()}</span></footer>
  </div>;
}

export default App;
