import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

/** Friendly Thai 404 — shown for any unknown URL instead of a silent redirect. */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
        <Icon name="search" className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800">ไม่พบหน้านี้ (404)</h1>
        <p className="text-sm text-slate-500">ลิงก์อาจไม่ถูกต้องหรือถูกย้ายไปแล้ว</p>
      </div>
      <button
        onClick={() => navigate('/')}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        กลับหน้าหลัก
      </button>
    </div>
  );
}
