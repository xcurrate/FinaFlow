// ================= CONFIG =================
// HAPUS URL & KEY YANG HARDCODED DI SINI
// Kita akan mengambilnya secara dinamis saat aplikasi dimuat

// Buat variabel global kosong dulu
let sb = null; 
let currentUser = null;
let expenseChart = null;

// Kategori
const categories = { 
    income: ["Gaji", "Bonus", "Bisnis"], 
    expense: ["Makan", "Transport", "Belanja", "Tagihan", "Hiburan"] 
};

// ================= INIT =================
window.addEventListener('DOMContentLoaded', async () => {
    feather.replace();
    
    try {
        // 1. AMBIL KUNCI DARI VERCEL (SERVERLESS FUNCTION)
        const response = await fetch('/api/config');
        const config = await response.json();

        // 2. INISIALISASI SUPABASE SETELAH KUNCI DIDAPAT
        sb = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

        // 3. LANJUTKAN LOGIKA SEPERTI BIASA
        setupDefaults(); // Set tanggal default dll
        
        const { data: { session } } = await sb.auth.getSession();
        if (session) { 
            currentUser = session.user; 
            initApp(); 
        }

    } catch (error) {
        console.error("Gagal memuat konfigurasi:", error);
        alert("Gagal terhubung ke server. Coba refresh halaman.");
    }
});

// Fungsi bantuan untuk merapikan kode INIT
function setupDefaults() {
    document.getElementById("date").valueAsDate = new Date();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById("filter-start").valueAsDate = firstDay;
    document.getElementById("filter-end").valueAsDate = today;
}

// ... (SISANYA KE BAWAH TETAP SAMA: toggleSidebar, switchTab, dll) ...

// NAVIGATION
function toggleSidebar() {
    document.getElementById("sidebar").classList.add("active");
    document.getElementById("overlay").classList.add("active");
}
function closeSidebar() {
    document.getElementById("sidebar").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
}

function switchTab(tab, avoidPush = false) {
    // 1. Sembunyikan semua tab
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    
    // 2. Tampilkan tab yang dipilih
    const targetTab = document.getElementById(`view-${tab}`);
    if (targetTab) targetTab.classList.remove("hidden");
    
    // 3. Atur status tombol navigasi
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`nav-${tab}`);
    if (activeBtn) activeBtn.classList.add("active");

    // 4. CATAT RIWAYAT (Penting untuk tombol Back)
    if (!avoidPush) {
        history.pushState({ tab: tab }, "", `#${tab}`);
    }

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

function updateCategories() {
    const typeDashboard = document.getElementById("type").value; // Tipe di Dashboard (income/expense)
    const selectDashboard = document.getElementById("category"); // Dropdown Dashboard
    const selectPlanning = document.getElementById("plan-category"); // Dropdown di Tab Rencana

    // Bersihkan isi lama
    selectDashboard.innerHTML = "";
    if (selectPlanning) selectPlanning.innerHTML = "";

    // 1. Isi Kategori untuk Dashboard (Sesuai tipe yang dipilih)
    categories[typeDashboard].forEach(cat => {
        selectDashboard.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    // 2. Isi Kategori untuk Rencana Pengeluaran (Hanya kategori expense)
    if (selectPlanning) {
        categories.expense.forEach(cat => {
            selectPlanning.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
}

window.addEventListener('popstate', function(event) {
    if (event.state && event.state.tab) {
        // Kembali ke tab yang ada di history
        switchTab(event.state.tab, true);
    } else {
        // Jika tidak ada history lagi, default kembali ke dashboard
        switchTab('dashboard', true);
    }
});

// Tambahkan state awal saat aplikasi pertama kali dimuat (Dashboard)
async function initApp() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-display").innerText = currentUser.email;
    
    // Set state awal di history agar tombol back punya tujuan
    history.replaceState({ tab: 'dashboard' }, "", "#dashboard");
    
    updateCategories(); 
    loadTransactions('custom');
    loadPlans();
}


async function login() { 
    let e = document.getElementById("email").value;
    const p = document.getElementById("password").value;

    // Cek apakah input adalah username (tanpa @) atau email (dengan @)
    if (!e.includes("@")) {
        // Jika username, tambahkan domain "bayangan"
        e = e.trim().toLowerCase() + "@fina.com";
    }

    // Supabase menerima 'e' yang sudah diproses (tetap berformat email di sistem)
    const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p });
    
    if(error) {
        alert("Gagal Masuk: Periksa kembali Username/Email dan Sandi.");
    } else { 
        currentUser = data.user; 
        initApp(); 
    }
}

async function register() {
    const e = document.getElementById("email").value, p = document.getElementById("password").value;
    const { error } = await sb.auth.signUp({ email: e, password: p });
    if(error) alert(error.message); else alert("Cek Email!");
}
async function logout() { await sb.auth.signOut(); location.reload(); }

