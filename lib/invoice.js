// lib/invoice.js - F14 Invoice / Expense Tracking
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const STORAGE = join(import.meta.dirname, '..', 'labos', 'invoices.json');

function load() {
  if (!existsSync(STORAGE)) return { invoices: [], next_id: 1 };
  return JSON.parse(readFileSync(STORAGE, 'utf-8'));
}

function save(data) {
  writeFileSync(STORAGE, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadInvoices() {
  const data = load();
  return data.invoices.sort((a, b) => b.date.localeCompare(a.date));
}

export function addInvoice({ date, amount, category, description, vendor = '' }) {
  const data = load();
  const inv = {
    id: 'INV-' + String(data.next_id).padStart(3, '0'),
    date, amount: parseFloat(amount), category, description, vendor,
    created_at: new Date().toISOString(),
  };
  data.invoices.push(inv);
  data.next_id++;
  save(data);
  return inv;
}

export function updateInvoice(id, patch) {
  const data = load();
  const inv = data.invoices.find(i => i.id === id);
  if (!inv) return null;
  Object.assign(inv, patch);
  save(data);
  return inv;
}

export function deleteInvoice(id) {
  const data = load();
  const idx = data.invoices.findIndex(i => i.id === id);
  if (idx === -1) return false;
  data.invoices.splice(idx, 1);
  save(data);
  return true;
}

export function getInvoiceStats() {
  const invoices = loadInvoices();
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const byCategory = {};
  const byMonth = {};
  for (const i of invoices) {
    byCategory[i.category] = (byCategory[i.category] || 0) + i.amount;
    const month = i.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + i.amount;
  }
  return { total: total.toFixed(2), count: invoices.length, by_category: byCategory, by_month: byMonth };
}

export function apply(ctx, config) {
  ctx.invoice = { loadInvoices, addInvoice, updateInvoice, deleteInvoice, getInvoiceStats };
}