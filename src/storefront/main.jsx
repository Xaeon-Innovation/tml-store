import { createRoot } from 'react-dom/client';
import { setRouterMode } from '../lib/router.js';
import StoreApp from './StoreApp.jsx';
import '../styles/store.css';

setRouterMode('path');
createRoot(document.getElementById('root')).render(<StoreApp />);
