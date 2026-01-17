// CONFIG (GANTI DENGAN KUNCI SUPABASE MILIKMU)
const SUPABASE_URL = "https://sbxtfqidotarniglzban.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let expenseChart = null;
const categories = {
    income: ["Gaji", "Bonus", "Usaha", "Lainnya"],
    expense: ["Makan", "Transport", "Tagihan", "Belanja", "Hiburan", "Kesehatan"]
};

// --- INIT ---
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById("date").valueAsDate = new Date();
    document.getElementById("current-date").innerText = "Laporan per: " + new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    updateCategories();

    // Default Filter (1 Bulan)
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById("filter-start").valueAsDate = start;
    document.getElementById("filter-end").valueAsDate = today;

    const { data: { session } } = await sb.auth.getSession();
    if (session) { currentUser = session.user; initApp(); }
});

// --- MENU TOGGLE ---
function toggleMenu() {
    document.getElementById("sidebar").classList.add("active");
    document.getElementById("overlay").classList.add("active");
}
function closeMenu() {
    document.getElementById("sidebar").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
}
function switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.getElementById(`view-${tab}`).classList.remove("hidden");
    closeMenu();
}

// --- APP LOGIC ---
function initApp() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-display").innerText = currentUser.email;
    loadTransactions('custom');
    loadPlans();
}

// --- EXPORT JPG ---
function exportJPG() {
    // Scroll ke atas agar capture rapi
    window.scrollTo(0,0);
    const element = document.getElementById("export-area");
    
    // Siapkan tabel khusus cetak (karena tabel utama ada pagination/scroll)
    const printTable = document.getElementById("print-table");
    const originalTable = document.querySelector("#transaction-table tbody").innerHTML;
    printTable.innerHTML = `<thead><tr><th>Tgl</th><th>Ket</th><th>Nominal</th></tr></thead><tbody>${originalTable}</tbody>`;
    document.querySelector(".print-only-table").style.display = "block"; // Munculkan sebentar

    html2canvas(element, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Laporan-FinaFlow-${Date.now()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.9);
        link.click();
        document.querySelector(".print-only-table").style.display = "none"; // Sembunyikan lagi
    });
}

// --- CRUD TRANSAKSI ---
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

        tbody.innerHTML += `
            <tr>
                <td>${t.date.slice(5)}</td>
                <td><b>${t.category}</b><br><small>${t.description}</small></td>
                <td style="color:${t.type==='income'?'green':'red'}">${t.amount.toLocaleString()}</td>
                <td class="no-print"><button class="danger" style="padding:4px 8px" onclick="delItem('transactions', ${t.id})">X</button></td>
            </tr>
        `;
    });

    document.getElementById("saldo").innerText = "Rp " + (inc - exp).toLocaleString();
    document.getElementById("total-income").innerText = "Rp " + inc.toLocaleString();
    document.getElementById("total-expense").innerText = "Rp " + exp.toLocaleString();

    renderChart(catData);
}

function renderChart(data) {
    const ctx = document.getElementById("expenseChart").getContext('2d');
    if(expenseChart) expenseChart.destroy();
    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ['#003366', '#dc3545', '#28a745', '#ffc107', '#17a2b8', '#6c757d']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- RENCANA PENGELUARAN (PLANNING) ---
async function addPlan() {
    const item = document.getElementById("plan-item").value;
    const amount = document.getElementById("plan-amount").value || 0;
    
    if(!item) return alert("Nama rencana harus diisi");

    await sb.from("shopping_list").insert({ 
        user_id: currentUser.id, 
        item_name: item,
        amount: amount, // Pastikan kolom amount sudah dibuat di database
        is_bought: false 
    });
    
    document.getElementById("plan-item").value = "";
    document.getElementById("plan-amount").value = "";
    loadPlans();
}

async function loadPlans() {
    const { data } = await sb.from("shopping_list").select("*").eq("user_id", currentUser.id).order("created_at", {ascending: false});
    const container = document.getElementById("planning-list");
    container.innerHTML = "";

    if(data.length === 0) container.innerHTML = "<p style='text-align:center; color:#888'>Tidak ada rencana pengeluaran.</p>";

    data.forEach(p => {
        const status = p.is_bought ? "Terealisasi" : "Belum";
        const style = p.is_bought ? "done" : "";
        
        container.innerHTML += `
            <div class="plan-item ${style}">
                <div style="display:flex; align-items:center;">
                    <input type="checkbox" class="plan-check" 
                        ${p.is_bought ? 'checked' : ''} 
                        onchange="togglePlan(${p.id}, this.checked)">
                    <div class="plan-details">
                        <span style="font-weight:bold; ${p.is_bought ? 'text-decoration:line-through' : ''}">${p.item_name}</span>
                        <small style="color:#666">Est: Rp ${Number(p.amount).toLocaleString()} • ${status}</small>
                    </div>
                </div>
                <button class="danger" style="width:auto; padding:5px 10px;" onclick="delItem('shopping_list', ${p.id})">Hapus</button>
            </div>
        `;
    });
}

async function togglePlan(id, status) {
    await sb.from("shopping_list").update({ is_bought: status }).eq("id", id);
    loadPlans();
}

// --- GENERAL UTILS ---
async function delItem(table, id) {
    if(confirm("Hapus data ini?")) {
        await sb.from(table).delete().eq("id", id);
        if(table === 'transactions') loadTransactions('custom');
        else loadPlans();
    }
}

// AUTH (Login/Reg/Logout) sama seperti sebelumnya...
async function login() {
    const e = document.getElementById("email").value;
    const p = document.getElementById("password").value;
    const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p });
    if(error) alert(error.message); else { currentUser = data.user; initApp(); }
}
async function register() {
    const e = document.getElementById("email").value;
    const p = document.getElementById("password").value;
    const { error } = await sb.auth.signUp({ email: e, password: p });
    if(error) alert(error.message); else alert("Cek Email!");
}
async function logout() { await sb.auth.signOut(); location.reload(); }
function updateCategories() {
    const t = document.getElementById("type").value;
    const s = document.getElementById("category"); s.innerHTML = "";
    categories[t].forEach(c => s.innerHTML += `<option>${c}</option>`);
}