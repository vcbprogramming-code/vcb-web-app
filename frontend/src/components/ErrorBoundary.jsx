import React from 'react';
import { useT } from '../lib/i18n.jsx';

/**
 * App-wide error boundary. Any uncaught render error would otherwise unmount the
 * whole tree to a blank white screen — here we catch it and show a Thai fallback
 * with a reload action so the user is never stranded.
 */
/**
 * The fallback lives in its own function component because a class cannot call a
 * hook — and this is the last screen standing when everything else has failed,
 * so it must not be the thing that throws.
 */
function Fallback({ onReload }) {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-bold text-slate-800">{t('เกิดข้อผิดพลาดบางอย่าง')}</h1>
        <p className="text-sm text-slate-500">
          {t('ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาโหลดหน้าใหม่อีกครั้ง หากยังพบปัญหา โปรดติดต่อผู้ดูแลระบบ')}
        </p>
      </div>
      <button
        onClick={onReload}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {t('โหลดหน้าใหม่')}
      </button>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Surface for debugging / future telemetry.
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) return <Fallback onReload={this.handleReload} />;
    return this.props.children;
  }
}
