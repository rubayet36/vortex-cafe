// js/transactions.js
import { supabase } from './supabaseClient.js';
import { $, fmtBDT } from './utils.js';

const transactionsList = $('#transactions-list');
const transactionsSummary = $('#transactions-summary');
const loadingTransactions = $('#loading-transactions');
const noTransactionsMsg = $('#no-transactions-msg');

export async function fetchAndRenderTransactionsSplit() {
  loadingTransactions.classList.remove('hidden');
  transactionsList.innerHTML = '';
  noTransactionsMsg.classList.add('hidden');

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const fromISO = dayStart.toISOString();

  const { data: cafeTx, error: cafeErr } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Delivery Complete')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

  const { data: suppTx, error: suppErr } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Completed')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

  if (cafeErr) console.error('Cafe transactions error:', cafeErr);
  if (suppErr) console.error('Supp transactions error:', suppErr);

  const cafe = cafeTx || [];
  const supp = suppTx || [];

  const totalRevenue = [...cafe, ...supp].reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const completedCount = cafe.length + supp.length;

  transactionsSummary.innerHTML = `
    <div class="summary-item"><h4>Total Revenue (Today)</h4><p>${fmtBDT(totalRevenue)}</p></div>
    <div class="summary-item"><h4>Completed Orders (Today)</h4><p>${completedCount}</p></div>
  `;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = '1fr 1fr';
  wrapper.style.gap = '16px';

  const cafeCol = document.createElement('div');
  cafeCol.innerHTML = `<h3 class="tx-title">Cafe Menu Sales (Today)</h3>`;
  if (!cafe.length) {
    cafeCol.innerHTML += `<p class="empty-message">No cafe transactions yet.</p>`;
  } else {
    cafe.forEach(tx => {
      const el = document.createElement('div');
      el.className = 'transaction-item';
      el.innerHTML = `
        <div class="transaction-details">
          <p><strong>${tx.customer_name}</strong> – Order #${tx.id.slice(0,6).toUpperCase()}</p>
          <p class="order-time">${new Date(tx.created_at).toLocaleString()}</p>
        </div>
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
      `;
      cafeCol.appendChild(el);
    });
  }

  const suppCol = document.createElement('div');
  suppCol.innerHTML = `<h3 class="tx-title">Supplements Sales (Today)</h3>`;
  if (!supp.length) {
    suppCol.innerHTML += `<p class="empty-message">No supplements transactions yet.</p>`;
  } else {
    supp.forEach(tx => {
      const el = document.createElement('div');
      el.className = 'transaction-item';
      el.innerHTML = `
        <div class="transaction-details">
          <p><strong>${tx.customer_name || 'Walk-in'}</strong> – Supp #${tx.id.slice(0,6).toUpperCase()}</p>
          <p class="order-time">${new Date(tx.created_at).toLocaleString()}</p>
        </div>
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
      `;
      suppCol.appendChild(el);
    });
  }

  wrapper.appendChild(cafeCol);
  wrapper.appendChild(suppCol);

  transactionsList.appendChild(wrapper);
  loadingTransactions.classList.add('hidden');

  if (!cafe.length && !supp.length) {
    noTransactionsMsg.classList.remove('hidden');
  }
}
