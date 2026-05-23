import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { navItems } from '../config/nav.js';

const moduleCards = navItems.filter((i) => i.module);

export default function Dashboard() {
  const { profile, user } = useAuth();
  const role = profile?.role;

  const cards = moduleCards.filter(
    (c) => !c.roles || (role && c.roles.includes(role))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          สวัสดี, {profile?.full_name || user?.email}
        </h1>
        <p className="mt-1 text-slate-500">
          ภาพรวมระบบบริหารงานบุคคลและการอนุมัติเอกสารอิเล็กทรอนิกส์
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card transition hover:border-brand hover:shadow-md"
          >
            <div className="mb-3 text-3xl" aria-hidden>
              {c.icon}
            </div>
            <div className="font-semibold text-slate-800">{c.label}</div>
            <div className="mt-1 text-sm text-slate-500">โมดูลที่ {c.module}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
