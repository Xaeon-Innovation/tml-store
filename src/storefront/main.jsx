import { createRoot } from 'react-dom/client';
import config from '../config/store.config.js';
import StoreApp from './StoreApp.jsx';
import '../styles/store.css';

const meta = document.querySelector('meta[name="description"]');
if (meta) meta.setAttribute('content', config.brand.metaDescription);
createRoot(document.getElementById('root')).render(<StoreApp />);
