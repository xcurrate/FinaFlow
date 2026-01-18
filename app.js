// ================= CONFIG & VARIABLES =================
let sb = null; 
let currentUser = null;
let expenseChart = null;

const categories = { 
    income: ["Gaji", "Bonus", "Bisnis"], 
    expense: ["Makan", "Transport", "Belanja", "Tagihan", "Hiburan"] 
};

// ================= INIT & AUTH CHECK =================
window.addEventListener('DOMContentLoaded', async () => {
    feather.replace();
    
    try {
        // 1. Ambil Kunci dari Vercel / API
        const response = await fetch('/api/config');
        const config = await response.json();

        // 2. Inisialisasi Supabase
        sb = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

        // 3. Setup Default Tanggal
        setupDefaults();
        
        // 4. Cek Sesi User
        const { data: { session } } = await sb.auth.getSession();
        if (session) { 
            currentUser = session.user; 
            initApp(); 
        }

    } catch (error) {
        console.error("Config Error:", error);
        showToast("Gagal terhubung ke server. Coba refresh.", "error");
    }
});

function setupDefaults() {
    const today = new Date();
    document.getElementById("date").valueAsDate = today;
    
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById("filter-start").valueAsDate = firstDay;
    document.getElementById("filter-end").valueAsDate = today;
}

// ================= CORE FUNCTIONS =================

// Fungsi Utama Memulai Aplikasi
function initApp() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-display").innerText = currentUser.email;
    
    // Set history awal agar tombol Back HP berfungsi normal
    history.replaceState({ tab: 'dashboard' }, "", "#dashboard");
    
    updateCategories();
    loadTransactions('custom');
    loadPlans();
}

// Navigation Logic
function toggleSidebar() {
    document.getElementById("sidebar").classList.add("active");
    document.getElementById("overlay").classList.add("active");
}
function closeSidebar() {
    document.getElementById("sidebar").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
}

function switchTab(tab, avoidPush = false) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    
    const targetTab = document.getElementById(`view-${tab}`);
    if (targetTab) targetTab.classList.remove("hidden");
    
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`nav-${tab}`);
    if (activeBtn) activeBtn.classList.add("active");

    if (!avoidPush) {
        history.pushState({ tab: tab }, "", `#${tab}`);
    }
    closeSidebar();
}

// History API Listener (Back Button Handler)
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.tab) {
        switchTab(event.state.tab, true);
    } else {
        switchTab('dashboard', true);
    }
});

// Category Logic
function updateCategories() {
    const typeDashboard = document.getElementById("type").value;
    const selectDashboard = document.getElementById("category");
    const selectPlanning = document.getElementById("plan-category");

    selectDashboard.innerHTML = "";
    if (selectPlanning) selectPlanning.innerHTML = "";

    categories[typeDashboard].forEach(cat => {
        selectDashboard.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    if (selectPlanning) {
        categories.expense.forEach(cat => {
            selectPlanning.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
}

// ================= TRANSACTION CRUD =================

async function addTransaction() {
    const type = document.getElementById("type").value;
    const category = document.getElementById("category").value;
    const amount = Number(document.getElementById("amount").value);
    const date = document.getElementById("date").value;
    const desc = document.getElementById("desc").value || "-";

    if(!amount) return showToast("Nominal wajib diisi", "error");

    await sb.from("transactions").insert({ user_id: currentUser.id, type, category, amount, date, description: desc });
    
    document.getElementById("amount").value = "";
    document.getElementById("desc").value = "";
    showToast("Transaksi disimpan!");
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

    document.getElementById("saldo").innerText = "Rp " + (inc - exp).toLocaleString();
    document.getElementById("total-income").innerText = "Rp " + inc.toLocaleString();
    document.getElementById("total-expense").innerText = "Rp " + exp.toLocaleString();

    // Chart Update
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

// ================= PLANNING / RENCANA =================

async function addPlan() {
    const item = document.getElementById("plan-item").value;
    const amount = document.getElementById("plan-amount").value || 0;
    const category = document.getElementById("plan-category").value; 
    
    if(!item) return showToast("Isi nama barang!", "error");

    await sb.from("shopping_list").insert({ 
        user_id: currentUser.id, 
        item_name: item, 
        amount, 
        category, 
        is_bought: false 
    });

    document.getElementById("plan-item").value = "";
    document.getElementById("plan-amount").value = "";
    showToast("Rencana ditambahkan");
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
                <button class="btn-del-icon" onclick="deletePlan(${p.id})"><i data-feather="trash-2" style="width:14px"></i></button>
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
            category: cat || 'Belanja', 
            description: `[Realisasi] ${name}`, 
            amount: amt, 
            date: new Date().toISOString().split('T')[0] 
        });
        await sb.from("shopping_list").update({ is_bought: true }).eq("id", id);
        showToast("Tercatat di Pengeluaran!");
    } else if (!status) {
        await sb.from("shopping_list").update({ is_bought: false }).eq("id", id);
    }
    loadPlans(); 
    loadTransactions('custom');
}

async function deletePlan(id) { 
    if(confirm("Hapus rencana ini?")) { 
        await sb.from("shopping_list").delete().eq("id", id); 
        showToast("Rencana dihapus");
        loadPlans(); 
    } 
}

async function delTrans(id) { 
    if(confirm("Hapus transaksi ini?")) { 
        await sb.from("transactions").delete().eq("id", id); 
        showToast("Transaksi dihapus");
        loadTransactions('custom'); 
    } 
}

// ================= DATA MANAGEMENT & EXPORT =================

async function autoCleanData() {
    if(!confirm("Hapus data transaksi yang lebih lama dari 30 hari?")) return;

    const d = new Date();
    d.setDate(d.getDate() - 30);
    
    const { error } = await sb.from("transactions").delete().lt("date", d.toISOString()).eq("user_id", currentUser.id);
    
    if(error) showToast("Gagal: " + error.message, "error");
    else {
        showToast("Data lama berhasil dibersihkan!");
        loadTransactions('custom');
    }
}

async function deleteAllData() {
    const confirmText = prompt("Ketik 'RESET' untuk menghapus SEMUA data Transaksi & Rencana.");
    if(confirmText !== 'RESET') return;

    const { error: err1 } = await sb.from("transactions").delete().neq("id", 0).eq("user_id", currentUser.id);
    const { error: err2 } = await sb.from("shopping_list").delete().neq("id", 0).eq("user_id", currentUser.id);

    if(err1 || err2) showToast("Terjadi kesalahan penghapusan.", "error");
    else {
        showToast("Factory Reset Berhasil.");
        location.reload();
    }
}

function exportJPG() {
    window.scrollTo(0,0);
    const element = document.getElementById("export-content"); 

    html2canvas(element, { 
        backgroundColor: "#1e293b", 
        scale: 2,
        ignoreElements: (el) => el.classList.contains('no-print')
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `FinaFlow-Report-${Date.now()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.9);
        link.click();
    });
}

// ================= AUTHENTICATION =================

async function login() { 
    let e = document.getElementById("email").value;
    const p = document.getElementById("password").value;

    // Logic Username: Tambahkan domain formalitas jika tidak ada @
    if (!e.includes("@")) {
        e = e.trim().toLowerCase() + "@fina.com";
    }

    const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p });
    
    if(error) {
        showToast("Gagal Masuk: Username/Sandi salah.", "error");
    } else { 
        showToast("Berhasil Masuk!");
        currentUser = data.user; 
        initApp(); 
    }
}

async function register() {
    const e = document.getElementById("email").value, p = document.getElementById("password").value;
    const { error } = await sb.auth.signUp({ email: e, password: p });
    if(error) showToast(error.message, "error"); else showToast("Cek Email Anda!");
}

async function logout() {
    await sb.auth.signOut(); 
    currentUser = null;
    window.location.reload(); 
}

// ================= UI HELPERS =================

function showToast(message, type = 'success') {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i data-feather="${icon}" style="width:18px; height:18px;"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    feather.replace(); 

    setTimeout(() => {
        toast.classList.add("fade-out");
        toast.addEventListener("animationend", () => toast.remove());
    }, 3000);
}
