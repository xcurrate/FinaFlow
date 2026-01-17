// --- KONFIGURASI SUPABASE ---
const supabaseUrl = 'https://sbxtfqidotarniglzban.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --- STATE VARIABLES ---
let currentUser = null;
let transactions = [];
let myChart = null;

// --- DOM ELEMENTS ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const transForm = document.getElementById('transaction-form');

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    // Set default date to today
    document.getElementById('t-date').valueAsDate = new Date();
    
    // Check Session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        handleLoginSuccess(session.user);
    } else {
        showAuth();
    }
});

// --- AUTHENTICATION ---
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // Coba Login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert("Login Gagal: " + error.message);
    } else {
        handleLoginSuccess(data.user);
    }
});

document.getElementById('register-btn').addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if(!email || !password) return alert("Isi email dan password untuk daftar");

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) alert("Error: " + error.message);
    else alert("Cek email kamu untuk konfirmasi pendaftaran!");
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

function handleLoginSuccess(user) {
    currentUser = user;
    document.getElementById('user-email').textContent = user.email;
    showApp();
    fetchTransactions();
}

function showAuth() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showApp() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

// --- CRUD TRANSACTIONS ---

// 1. Fetch Data
async function fetchTransactions() {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false });

    if (error) console.error(error);
    else {
        transactions = data;
        updateUI();
    }
}

// 2. Add Data
transForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newTrans = {
        user_id: currentUser.id,
        description: document.getElementById('t-desc').value,
        amount: parseFloat(document.getElementById('t-amount').value),
        type: document.getElementById('t-type').value,
        date: document.getElementById('t-date').value
    };

    const { error } = await supabase.from('transactions').insert([newTrans]);

    if (error) {
        alert("Gagal menyimpan: " + error.message);
    } else {
        transForm.reset();
        document.getElementById('t-date').valueAsDate = new Date();
        fetchTransactions(); // Refresh data
    }
});

// 3. Delete Data
async function deleteTransaction(id) {
    if(!confirm("Hapus data ini?")) return;
    
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) fetchTransactions();
}

// --- UI UPDATES & LOGIC ---

function updateUI() {
    const listBody = document.getElementById('transaction-list');
    listBody.innerHTML = '';

    let totalInc = 0;
    let totalExp = 0;

    // Filter Logic (Simple implementation: Show all, but calculate totals)
    // Di real app, filter bisa dilakukan via query database
    
    transactions.forEach(t => {
        // Render List
        const row = document.createElement('tr');
        const isInc = t.type === 'income';
        const amountFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(t.amount);
        
        if (isInc) totalInc += t.amount;
        else totalExp += t.amount;

        row.innerHTML = `
            <td>${t.date}</td>
            <td>${t.description}</td>
            <td class="${isInc ? 'amount-inc' : 'amount-exp'}">${isInc ? '+ ' : '- '}${amountFmt}</td>
            <td>
                <button onclick="deleteTransaction(${t.id})" class="btn btn-sm btn-danger" style="padding:2px 8px;">&times;</button>
            </td>
        `;
        listBody.appendChild(row);
    });

    // Update Cards
    document.getElementById('total-balance').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalInc - totalExp);
    document.getElementById('total-income').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalInc);
    document.getElementById('total-expense').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalExp);

    // Update Advice Logic
    updateAdvice(totalInc, totalExp);

    // Update Chart
    updateChart(totalInc, totalExp);
}

function updateAdvice(inc, exp) {
    const adviceEl = document.getElementById('advice-section');
    const textEl = document.getElementById('advice-text');
    
    if (inc === 0) {
        textEl.textContent = "Belum ada pemasukan. Mulai catat keuanganmu!";
        adviceEl.style.borderLeftColor = "#ccc";
        return;
    }

    const ratio = (exp / inc) * 100;

    if (ratio > 80) {
        adviceEl.style.backgroundColor = "#ffe6e6"; // Light Red
        adviceEl.style.borderLeftColor = "#dc3545";
        textEl.textContent = `⚠️ Peringatan: Pengeluaranmu mencapai ${ratio.toFixed(1)}% dari pemasukan. Segera rem pengeluaran tidak penting!`;
    } else if (ratio < 50) {
        adviceEl.style.backgroundColor = "#e6fffa"; // Light Green
        adviceEl.style.borderLeftColor = "#28a745";
        textEl.textContent = `✅ Bagus! Pengeluaranmu terkendali (${ratio.toFixed(1)}%). Pertahankan dan tabung sisanya.`;
    } else {
        adviceEl.style.backgroundColor = "#fff3cd"; // Light Yellow
        adviceEl.style.borderLeftColor = "#ffc107";
        textEl.textContent = `ℹ️ Hati-hati. Kamu sudah menghabiskan ${ratio.toFixed(1)}% pemasukan.`;
    }
}

function updateChart(inc, exp) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pemasukan', 'Pengeluaran'],
            datasets: [{
                data: [inc, exp],
                backgroundColor: ['#28a745', '#dc3545'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
