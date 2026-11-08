import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('SOULARAB TECH application error:', error, info);
  }
  render() {
    if (this.state.error) {
      return <main className="fatal-error" dir="rtl" lang="ar">
        <div className="fatal-error-card">
          <span className="fatal-error-mark">ST</span>
          <p className="eyebrow">SOULARAB TECH / RECOVERY</p>
          <h1>حدث خطأ أثناء تشغيل الواجهة</h1>
          <p>لم نترك الشاشة فارغة. أعد تحميل التطبيق، وإذا تكرر الخطأ فستظهر تفاصيله في سجل المتصفح.</p>
          <code>{this.state.error.message}</code>
          <button className="button primary" onClick={() => window.location.reload()}>إعادة تحميل التطبيق</button>
        </div>
      </main>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => console.error('Service worker:', error));
  });
}
