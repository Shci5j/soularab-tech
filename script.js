function forceLogin() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    if (user === "aboarap" && pass === "aa1994") {
        // إخفاء شاشة تسجيل الدخول فوراً وإظهار الرئيسية
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-screen').style.display = 'block';
    } else {
        alert('البيانات غير صحيحة، ي استخدام: aboarap / aa1994');
    }
}
