import React from 'react';

/**
 * App-wide error boundary. Any uncaught render error would otherwise unmount the
 * whole tree to a blank white screen — here we catch it and show a Thai fallback
 * with a reload action so the user is never stranded.
 */
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
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
          <div className="max-w-md space-y-2">
            <h1 className="text-lg font-bold text-slate-800">เกิดข้อผิดพลาดบางอย่าง</h1>
            <p className="text-sm text-slate-500">
              ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาโหลดหน้าใหม่อีกครั้ง หากยังพบปัญหา โปรดติดต่อผู้ดูแลระบบ
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            โหลดหน้าใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
