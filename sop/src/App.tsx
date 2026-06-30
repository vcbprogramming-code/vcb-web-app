/**
 * Root of the SOP React port. Holds the store and assembles the three-pane
 * layout (sidebar · list · detail) plus the edit/settings modals — a faithful
 * mirror of the <body> structure in the canonical index.html. Body / <html>
 * classes (dark, is-mobile, reports-mode, m-list/m-detail) are driven by effects
 * inside useStore(), matching the imperative original.
 */
import { useStore } from './store';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ListPane from './components/ListPane';
import DetailPane from './components/DetailPane';
import EditModal from './components/EditModal';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const s = useStore();
  return (
    <>
      <div className="app">
        <TopBar s={s} />
        <div className="body">
          <Sidebar s={s} />
          <ListPane s={s} />
          <DetailPane s={s} />
        </div>
      </div>

      {s.editNo != null && <EditModal s={s} />}
      <SettingsModal s={s} />
    </>
  );
}
