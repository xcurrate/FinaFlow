// CONFIG (Ganti URL & KEY Supabase Anda)
const SUPABASE_URL = "https://sbxtfqidotarniglzban.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let expenseChart = null;

// INIT
window.addEventListener('DOMContentLoaded', async () => {
    feather.replace();
    document.getElementById("date").valueAsDate = new Date();
    
    // Default Filter (1 Bulan)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById("filter-start").valueAsDate = firstDay;
    document.getElementById("filter-end").valueAsDate = today;

    const { data: { session } } = await sb.auth.getSession();
    if (session) { currentUser = session.user; initApp(); }
});

// NAVIGATION
function toggleSidebar() {
    document.getElementById("sidebar").classList.add("active");
    document.getElementById("overlay").classList.add("active");
}
function closeSidebar() {
    document.getElementById("sidebar").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
}

function switchTab(tab) {
    // 1. Hide all tabs
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    // 2. Show selected tab
    document.getElementById(`view-${tab}`).classList.remove("hidden");
    
    // 3. Set Active State on Sidebar Buttons
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`nav-${tab}`);
    if(activeBtn) activeBtn.classList.add("active");

    closeSidebar();
}

function initApp() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-display").innerText = currentUser.email;
    updateCategories();
    loadTransactions('custom');
    loadPlans();
}

// LOGIKA RESET DATA (FIXED)
async function autoCleanData() {
    if(!confirm("Hapus data transaksi yang lebih lama dari 30 hari?")) return;

    const d = new Date();
    d.setDate(d.getDate() - 30);
    
    const { error } = await sb.from("transactions").delete().lt("date", d.toISOString()).eq("user_id", currentUser.id);
    
    if(error) alert("Gagal: " + error.message);
    else {
        alert("Data lama berhasil dibersihkan!");
        loadTransactions('custom');
    }
}

async function deleteAllData() {
    const confirmText = prompt("Ketik 'RESET' untuk menghapus SEMUA data Transaksi & Rencana.");
    if(confirmText !== 'RESET') return;

    // Hapus dari Transaksi
    const { error: err1 } = await sb.from("transactions").delete().neq("id", 0).eq("user_id", currentUser.id);
    // Hapus dari Rencana
    const { error: err2 } = await sb.from("shopping_list").delete().neq("id", 0).eq("user_id", currentUser.id);

    if(err1 || err2) alert("Terjadi kesalahan penghapusan.");
    else {
        alert("Factory Reset Berhasil. Data bersih.");
        location.reload();
    }
}

// EXPORT JPG (FIXED: Includes Table)
function exportJPG() {
    window.scrollTo(0,0);
    const element = document.getElementById("export-content"); // Capture Wrapper

    // Force background color for capture
    html2canvas(element, { 
        backgroundColor: "#1e293b", 
        scale: 2,
        ignoreElements: (el) => el.classList.contains('no-print') // Ignore buttons
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `FinaFlow-Report-${Date.now()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.9);
        link.click();
    });
}

// CRUD TRANSAKSI
async function addTransaction() {
    const type = document.getElementById("type").value;
    const category = document.getElementById("category").value;
    const amount = Number(document.getElementById("amount").value);
    const date = document.getElementById("date").value;
    const desc = document.getElementById("desc").value || "-";

    if(!amount) return alert("Nominal wajib diisi");

    await sb.from("transactions").insert({ user_id: currentUser.id, type, category, amount, date, description: desc });
    
    document.getElementById("amount").value = "";
    document.getElementById("desc").value = "";
    loadTransactions('custom');
}

async function loadTransactions(mode) {
    let query = sb.from("transactions").select("*").eq("user_id", currentUser.id).order("date", {ascending: false});

    if(mode === 'custom') {
        const s = document.getElementById("filter-start").value;
        const e = document.getElementById("filter-end").value;
        if(s) query = query.gte("date", s);
        if(e) query = query.lte("date", e);
    }

    const { data } = await query;
    renderDashboard(data);
}

function renderDashboard(data) {
    const tbody = document.querySelector("#transaction-table tbody");
    tbody.innerHTML = "";
    
    let inc = 0, exp = 0;
    let catData = {};

    data.forEach(t => {
        if(t.type === 'income') inc += t.amount;
        else {
            exp += t.amount;
            catData[t.category] = (catData[t.category] || 0) + t.amount;
        }

        const dateStr = t.date.slice(5);
        tbody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td>
                    <div style="font-weight:600">${t.category}</div>
                    <small class="text-muted">${t.description}</small>
                </td>
                <td style="color:${t.type==='income'?'var(--success)':'var(--danger)'}">
                    Rp ${t.amount.toLocaleString()}
                </td>
                <td class="no-print"><button class="btn-del-icon" onclick="delTrans(${t.id})"><i data-feather="trash-2" style="width:14px"></i></button></td>
            </tr>
        `;
    });
    
    feather.replace();

    // Stats
    document.getElementById("saldo").innerText = "Rp " + (inc - exp).toLocaleString();
    document.getElementById("total-income").innerText = "Rp " + inc.toLocaleString();
    document.getElementById("total-expense").innerText = "Rp " + exp.toLocaleString();

    // Chart
    const ctx = document.getElementById("expenseChart").getContext('2d');
    if(expenseChart) expenseChart.destroy();
    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#ec4899'],
                borderColor: '#1e293b'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } } }
    });
}

// PLANNING
async function addPlan() {
    const item = document.getElementById("plan-item").value;
    const amount = document.getElementById("plan-amount").value || 0;
    const category = document.getElementById("plan-category").value; // Ambil kategori
    
    if(!item) return alert("Isi nama barang!");

    await sb.from("shopping_list").insert({ 
        user_id: currentUser.id, 
        item_name: item, 
        amount, 
        category, // Simpan kategori ke DB
        is_bought: false 
    });

    document.getElementById("plan-item").value = "";
    document.getElementById("plan-amount").value = "";
    loadPlans();
}

async function loadPlans() {
    const { data } = await sb.from("shopping_list").select("*").eq("user_id", currentUser.id).order("is_bought", {ascending: true});
    const container = document.getElementById("planning-list");
    container.innerHTML = "";

    data.forEach(p => {
        const checked = p.is_bought ? "checked" : "";
        const doneClass = p.is_bought ? "done" : "";
        
        container.innerHTML += `
            <div class="plan-item ${doneClass}">
                <div class="checkbox-wrapper" onclick="realizePlan(${p.id}, ${!p.is_bought}, '${p.item_name}', ${p.amount}, '${p.category}')">
                    <div class="custom-checkbox ${checked}"><i data-feather="${p.is_bought ? 'check' : ''}" style="width:14px"></i></div>
                    <div>
                        <div style="font-weight:600">${p.item_name}</div>
                        <small class="text-muted">${p.category} • Est: Rp ${Number(p.amount).toLocaleString()}</small>
                    </div>
                </div>
                <button class="btn-icon danger" onclick="deletePlan(${p.id})"><i data-feather="trash-2" style="width:14px"></i></button>
            </div>
        `;
    });
    feather.replace();
}

async function realizePlan(id, status, name, amt, cat) {
    if(status && confirm(`Barang "${name}" sudah dibeli? Catat ke pengeluaran?`)) {
        await sb.from("transactions").insert({ 
            user_id: currentUser.id, 
            type: 'expense', 
            category: cat || 'Belanja', // Gunakan kategori dari rencana
            description: `[Realisasi] ${name}`, 
            amount: amt, 
            date: new Date().toISOString().split('T')[0] 
        });
        await sb.from("shopping_list").update({ is_bought: true }).eq("id", id);
    } else if (!status) {
        await sb.from("shopping_list").update({ is_bought: false }).eq("id", id);
    }
    loadPlans(); 
    loadTransactions('custom');
}

async function deletePlan(id) { if(confirm("Hapus?")) { await sb.from("shopping_list").delete().eq("id", id); loadPlans(); } }
async function delTrans(id) { if(confirm("Hapus?")) { await sb.from("transactions").delete().eq("id", id); loadTransactions('custom'); } }

// CATEGORIES & AUTH
const categories = { income: ["Gaji", "Bonus", "Bisnis"], expense: ["Makan", "Transport", "Belanja", "Tagihan", "Hiburan"] };
function updateCategories() {
    const t = document.getElementById("type").value; // Tipe di Dashboard
    const s = document.getElementById("category"); // Dropdown Dashboard
    const p = document.getElementById("plan-category"); // Dropdown di Tab Rencana
    
    // Bersihkan dropdown lama
    s.innerHTML = "";
    if(p) p.innerHTML = "";

    // Isi kategori Dashboard (Income/Expense)
    categories[t].forEach(c => s.innerHTML += `<option>${c}</option>`);
    
    // Isi kategori Rencana (Hanya Expense)
    if(p) {
        categories.expense.forEach(c => p.innerHTML += `<option>${c}</option>`);
    }
}

async function login() { 
    const e = document.getElementById("email").value, p = document.getElementById("password").value;
    const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p });
    if(error) alert(error.message); else { currentUser = data.user; initApp(); }
}
async function register() {
    const e = document.getElementById("email").value, p = document.getElementById("password").value;
    const { error } = await sb.auth.signUp({ email: e, password: p });
    if(error) alert(error.message); else alert("Cek Email!");
}
async function logout() { await sb.auth.signOut(); location.reload(); }