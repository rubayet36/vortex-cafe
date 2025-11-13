// js/utils.js
export const SUPP_BUCKET = 'supplement-images';

export function slugifyName(filename) {
  const dot = filename.lastIndexOf('.');
  const base = (dot >= 0 ? filename.slice(0, dot) : filename)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const ext = (dot >= 0 ? filename.slice(dot + 1) : 'jpg').toLowerCase();
  return { base, ext };
}

// small helpers
export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
export const fmtBDT = (n) => `৳${Number(n||0).toFixed(2)}`;
