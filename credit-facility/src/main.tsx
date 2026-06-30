import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: the verbatim app boots once and installs global listeners /
// observers; double-invocation would double-bind them.
const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(<App />);
