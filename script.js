// تخطي شاشة الدخول مؤقتاً والفتح المباشر للرئيسية
window.onload = function() {
    // فتح الواجهة الرئيسية فوراً
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('security-setup-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    
    updateDate();
    logActivity('فتح التطبيق ودخول المملكة البرمجية بنجاح');
};

// 2. التنقل بين الصفحات والزر العائم
function openSection(sectionId) {
    document.querySelectorAll('.main-wrapper, .sub-page').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(sectionId);
    if(target) target.classList.remove('hidden');

    const floatingRouh = document.getElementById('floating-rouh-btn');
    if (floatingRouh) {
        if (sectionId === 'main-screen') {
            floatingRouh.classList.add('hidden');
        } else {
            floatingRouh.classList.remove('hidden');
        }
    }
    logActivity(`الانتقال إلى قسم: ${sectionId}`);
}

// 3. نظام الوضع الفاتح والغامق
function setTheme(mode) {
    if (mode === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
    logActivity(`تغيير المظهر إلى الوضع: ${mode}`);
}

// 4. استدعاء الذكاء الاصطناعي
function sendAiPrompt() {
    const prompt = document.getElementById('ai-prompt-input').value;
    if(!prompt) return;

    const terminal = document.getElementById('ai-terminal-messages');
    const userMsg = document.createElement('div');
    userMsg.className = 'user-msg';
    userMsg.style.color = '#d4af37';
    userMsg.style.marginTop = '10px';
    userMsg.innerText = `أنت: ${prompt}`;
    terminal.appendChild(userMsg);

    document.getElementById('ai-prompt-input').value = '';

    setTimeout(() => {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'ai-msg';
        aiMsg.innerText = `الذكاء الاصطناعي: جاري معالجة أمرك البرمجي لبناء المطلوب...`;
        terminal.appendChild(aiMsg);
        terminal.scrollTop = terminal.scrollHeight;
    }, 600);

    logActivity('إرسال أمر جديد لمحرك الذكاء الاصطناعي');
}

// 5. سجل الأنشطة والعمليات
function logActivity(action) {
    const logsList = document.getElementById('logs-list');
    if(logsList) {
        const item = document.createElement('li');
        item.innerText = `[${new Date().toLocaleTimeString()}] ${action}`;
        logsList.prepend(item);
    }
}

// Modals Controls
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('ar-EG', options);
    const dateEl = document.getElementById('current-date');
    if(dateEl) dateEl.innerText = dateStr;
}

function toggleLanguage() { alert('سيتم التحويل بين العربية والإنجليزي'); }
