// --- Supabase Client Setup ---
const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';


const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM Elements ---
// ... (other selectors like expenseForm, expenseList, etc.)

const exportBtn = document.getElementById('export-btn'); // <-- ADD THIS LINE
const loading = document.getElementById('loading');
const analyticsContent = document.getElementById('analytics-content');
const noDataMsg = document.getElementById('no-data-msg');
const filterBtns = document.querySelectorAll('.filter-btn');
const totalRevenueEl = document.getElementById('total-revenue');
const totalOrdersEl = document.getElementById('total-orders');
const netProfitEl = document.getElementById('net-profit');
const mostSoldList = document.getElementById('most-sold-list');
const leastSoldList = document.getElementById('least-sold-list');
const dateRangePickerEl = document.getElementById('date-range-picker');
const expenseForm = document.getElementById('expense-form');
const expenseList = document.getElementById('expense-list');
const noExpensesMsg = document.getElementById('no-expenses-msg');

// --- Date Picker Initialization ---
const datePicker = flatpickr(dateRangePickerEl, {
    mode: "range",
    dateFormat: "Y-m-d",
    onChange: function(selectedDates) {
        if (selectedDates.length === 2) {
            filterBtns.forEach(btn => btn.classList.remove('active'));
            fetchAndDisplayAnalytics(selectedDates[0], selectedDates[1]);
        }
    }
});

/**
 * Main function to fetch and process all analytics data.
 */
async function fetchAndDisplayAnalytics(startDate, endDate) {
    loading.classList.remove('hidden');
    analyticsContent.classList.add('hidden');
    noDataMsg.classList.add('hidden');
    endDate.setHours(23, 59, 59, 999);

    try {
        const [ordersResponse, expensesResponse] = await Promise.all([
            supabase.from('orders').select('id, total_amount').eq('status', 'Delivery Complete').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
            supabase.from('expenses').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString())
        ]);
        
        const { data: orders, error: ordersError } = ordersResponse;
        const { data: expenses, error: expensesError } = expensesResponse;

        if (ordersError) throw ordersError;
        if (expensesError) throw expensesError;

        if (orders.length === 0 && expenses.length === 0) {
            noDataMsg.classList.remove('hidden');
            loading.classList.add('hidden');
            return;
        }

        const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const netProfit = totalRevenue - totalExpenses;
        const totalOrders = orders.length;

        totalRevenueEl.textContent = `৳${totalRevenue.toFixed(2)}`;
        totalOrdersEl.textContent = totalOrders;
        netProfitEl.textContent = `৳${netProfit.toFixed(2)}`;
        netProfitEl.classList.toggle('negative', netProfit < 0);
        
        renderExpenseList(expenses);
        
        const orderIds = orders.map(order => order.id);
        if (orderIds.length > 0) {
            const { data: items, error: itemsError } = await supabase.from('order_items').select('item_name, quantity').in('order_id', orderIds);
            if (itemsError) throw itemsError;

            const itemCounts = items.reduce((acc, item) => {
                acc[item.item_name] = (acc[item.item_name] || 0) + item.quantity;
                return acc;
            }, {});
            const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
            renderSalesLists(sortedItems);
        } else {
            renderSalesLists([]); // Render empty lists if no orders
        }

        analyticsContent.classList.remove('hidden');
    } catch (error) {
        console.error("Failed to fetch analytics:", error);
        noDataMsg.textContent = "Error loading data. Please try again.";
        noDataMsg.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

/**
 * Renders the lists of most and least sold items.
 */
function renderSalesLists(sortedItems) {
    mostSoldList.innerHTML = '';
    leastSoldList.innerHTML = '';
    if (sortedItems.length === 0) return;
    const mostSold = sortedItems.slice(0, 5);
    const leastSold = sortedItems.slice(-5).reverse();
    mostSold.forEach(([name, count]) => {
        mostSoldList.innerHTML += `<li><span>${name}</span> <span>${count} sold</span></li>`;
    });
    leastSold.forEach(([name, count]) => {
        leastSoldList.innerHTML += `<li><span>${name}</span> <span>${count} sold</span></li>`;
    });
}

/**
 * Renders the list of expenses for the selected period.
 */
function renderExpenseList(expenses) {
    expenseList.innerHTML = '';
    if (expenses.length === 0) {
        noExpensesMsg.classList.remove('hidden');
        return;
    }
    noExpensesMsg.classList.add('hidden');
    expenses.forEach(expense => {
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.innerHTML = `
            <div class="expense-details">
                <p class="description">${expense.description}</p>
                <span class="category">${expense.category}</span>
            </div>
            <span class="expense-amount">- ৳${expense.amount.toFixed(2)}</span>
        `;
        expenseList.appendChild(li);
    });
}
/**
 * Converts an array of objects into a CSV formatted string.
 */
function convertToCSV(data) {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.join(',');
    
    const rows = data.map(row => {
        return headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            cell = String(cell);
            if (cell.search(/("|,|\n)/g) >= 0) {
                cell = `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',');
    });

    return [headerRow, ...rows].join('\n');
}

/**
 * Triggers a browser download for the given CSV content.
 */
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// --- Event Listeners ---
function setupEventListeners() {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            datePicker.clear();
            const range = btn.dataset.range;
            const today = new Date();
            let startDate = new Date();
            
            if (range === 'today') {
                startDate.setHours(0, 0, 0, 0);
            } else if (range === 'week') {
                const dayOfWeek = today.getDay();
                startDate = new Date(today.setDate(today.getDate() - dayOfWeek));
                startDate.setHours(0, 0, 0, 0);
            } else if (range === 'month') {
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            }
            
            fetchAndDisplayAnalytics(startDate, new Date());
        });
    });

    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        const description = document.getElementById('expense-description').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const category = document.getElementById('expense-category').value;

        if (!description || !amount || amount <= 0) {
            alert('Please provide a valid description and amount.');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = 'Logging...';

        const { error } = await supabase
            .from('expenses')
            .insert([{ description, amount, category }]);
        
        if (error) {
            console.error('Error logging expense:', error);
            alert('Failed to log expense.');
        } else {
            expenseForm.reset();
            // Refresh the whole dashboard to reflect the new expense
            document.querySelector('.filter-btn.active').click();
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Log Expense';
    });

    exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Exporting...';
        lucide.createIcons(); // Re-render icon

        // 1. Determine the current date range
        let startDate, endDate = new Date();
        const activeFilterBtn = document.querySelector('.filter-btn.active');
        
        if (activeFilterBtn) {
            const range = activeFilterBtn.dataset.range;
            const today = new Date();
            startDate = new Date();
            if (range === 'today') startDate.setHours(0, 0, 0, 0);
            else if (range === 'week') startDate.setDate(today.getDate() - today.getDay());
            else if (range === 'month') startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        } else {
            const selectedDates = datePicker.selectedDates;
            if (selectedDates.length === 2) {
                startDate = selectedDates[0];
                endDate = selectedDates[1];
            } else {
                alert('Please select a date range first.');
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i data-lucide="download"></i> Export';
                lucide.createIcons();
                return;
            }
        }
        endDate.setHours(23, 59, 59, 999);

        try {
            // 2. Fetch all data for the range
            const [ordersResponse, expensesResponse] = await Promise.all([
                supabase.from('orders').select('created_at, total_amount, customer_name').eq('status', 'Delivery Complete').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
                supabase.from('expenses').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString())
            ]);
            
            const { data: orders, error: ordersError } = ordersResponse;
            const { data: expenses, error: expensesError } = expensesResponse;

            if (ordersError || expensesError) throw ordersError || expensesError;
            
            // 3. Format data into a unified structure
            const revenueData = orders.map(order => ({
                Date: new Date(order.created_at).toLocaleString(),
                Description: `Order from ${order.customer_name}`,
                Category: 'Revenue',
                Amount: order.total_amount,
                Type: 'Income'
            }));
            
            const expenseData = expenses.map(expense => ({
                Date: new Date(expense.created_at).toLocaleString(),
                Description: expense.description,
                Category: expense.category,
                Amount: -expense.amount, // Show expenses as negative numbers
                Type: 'Expense'
            }));
            
            const combinedData = [...revenueData, ...expenseData].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            
            // 4. Convert to CSV and download
            if (combinedData.length > 0) {
                const csvContent = convertToCSV(combinedData);
                const filename = `Vortex_Report_${new Date().toISOString().split('T')[0]}.csv`;
                downloadCSV(csvContent, filename);
            } else {
                alert('No data to export for the selected period.');
            }

        } catch (error) {
            console.error('Export failed:', error);
            alert('Could not export data. Please try again.');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i data-lucide="download"></i> Export';
            lucide.createIcons();
        }
    });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    document.querySelector('.filter-btn[data-range="today"]').click();
    if (window.lucide) {
        lucide.createIcons();
    }
});