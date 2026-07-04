import KAR_CONFIG from '../config.js';

export let store = null;
export let sb = null;

export const cfg = KAR_CONFIG || {};
export const cloudConfigured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
export const app = document.getElementById('app');

export function setStore(s) { store = s; }
export function setSb(s) { sb = s; }
