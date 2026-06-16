import { Outlet } from 'react-router-dom';

/**
 * Authenticated shell. The sidebar was removed in favour of the Portal landing
 * page (pages/Portal.jsx) + per-module ModuleShell headers. This just renders
 * the matched route; each page/shell provides its own header.
 */
export default function AppLayout() {
  return (
    <div className="min-h-full">
      <Outlet />
    </div>
  );
}
