// js/tabs.js
import { $,$$ } from './utils.js';
import { fetchAndRenderOrders } from './orders.js';
import { fetchAndRenderTransactionsSplit } from './transactions.js';
import { loadMenuItems } from './menu.js';
import { loadSupplements } from './supplements.js';

export function initTabs() {
  const mainTabs = $('.main-tabs');
  const tabContents = $$('.tab-content');

  mainTabs.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;

    mainTabs.querySelector('.active')?.classList.remove('active');
    e.target.classList.add('active');

    tabContents.forEach(c => c.classList.remove('active'));
    const toShow = document.getElementById(`${e.target.dataset.tab}-section`);
    toShow?.classList.add('active');

    const tab = e.target.dataset.tab;
    if (tab === 'orders') fetchAndRenderOrders();
    if (tab === 'transactions') fetchAndRenderTransactionsSplit();
    if (tab === 'menu') loadMenuItems();
    if (tab === 'supplements') loadSupplements();
  });
}

export function startAutoRefresh() {
  setInterval(async () => {
    const activeTab = document.querySelector('.main-tab-btn.active')?.dataset.tab;
    if (activeTab === 'orders') await fetchAndRenderOrders();
    if (activeTab === 'transactions') await fetchAndRenderTransactionsSplit();
  }, 10000);
}
