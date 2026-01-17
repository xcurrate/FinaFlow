// ================= CONFIG =================
// ⚠️ GANTI DENGAN URL & KEY SUPABASE MILIKMU
const SUPABASE_URL = "https://sbxtfqidotarniglzban.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ";

// ✅ FIXED: Gunakan 'sb' agar tidak bentrok
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let expenseChart = null;

// Kategori List
const categories = {
    income: ["Gaji Bulanan", "Bonus/THR", "Hasil Usaha", "Investasi", "Lainnya"],
    expense: ["Makan & Minum", "Transportasi", "Tempat Tinggal", "Belanja", "Tagihan (Listrik/Air)", "Hiburan", "Kesehatan", "Lainnya"]
};

// ================= INIT =================
window.addEventListener('DOMContentLoaded', async () => {
    // Set default date
    document.getElementById("date").valueAsDate = new Date();
    // Set default categories
    updateCategoryOptions('income');
    
    // Check Session
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    }
});

// ================= AUTH LOGIC =================
async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("auth-msg");
    
    msg.innerText = "Loading...";
    
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    
    if(error) msg.innerText = "Error: " + error.message;
    else {
        currentUser = data.user;
        showApp();
    }
}

async function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("auth-msg");

    const { error } = await sb.auth.signUp({ email, password });
    if(error) msg.innerText = "Error: " + error.message;
    else alert("Sukses! Cek email untuk verifikasi.");
}

async function logout() {
    await sb.auth.signOut();
    location.reload();
}

function showApp() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-display").innerText = currentUser.email;
    loadTransactions("month");
}

// ================= UI LOGIC =================
function setFormType(type) {
    document.getElementById("type").value = type;
    
    // Update Button Style
    const btnInc = document.getElementById("btn-inc");
    const btnExp = document.getElementById("btn-exp");
    
    if(type === 'income') {
        btnInc.classList.add("active");
        btnExp.classList.remove("active");
    } else {
        btnExp.classList.add("active");
        btnInc.classList.remove("active");
    }

    updateCategoryOptions(type);
}

function updateCategoryOptions(type) {
    const select = document.getElementById("category");
    select.innerHTML = "";
    categories[type].forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.innerText = cat;
        select.appendChild(opt);
    });
}

// ================= CRUD =================
async function addTransaction() {
    const type = document.getElementById("type").value;
    const category = document.getElementById("category").value;
    const desc = document.getElementById("desc").value || "-";
    const amount = Number(document.getElementById("amount").value);
    const date = document.getElementById("date").value;

    if(!amount || !date) return alert("Nominal & Tanggal wajib diisi!");

    const { error } = await sb.from("transactions").insert({
        user_id: currentUser.id,
        type: type,
        category: category, // Kolom baru
        description: desc,
        amount: amount,
        date: date
    });

    if(error) alert("Gagal simpan: " + error.message);
    else {
        document.getElementById("desc").value = "";
        document.getElementById("amount").value = "";
        loadTransactions("month");
    }
}

async function deleteTransaction(id) {
    if(!confirm("Hapus data ini?")) return;
    const { error } = await sb.from("transactions").delete().eq("id", id);
    if(!error) loadTransactions("month");
}

// ================= LOAD DATA & CHART =================
async function loadTransactions(filter) {
    let query = sb.from("transactions")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });

    // Filter Logic
    if(filter === 'month') {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        query = query.gte("date", firstDay);
    }

    const { data, error } = await query;
    if(error) return console.error(error);

    renderTable(data);
    renderStats(data);
}

function renderTable(data) {
    const tbody = document.querySelector("#transaction-table tbody");
    tbody.innerHTML = "";

    data.forEach(t => {
        const color = t.type === 'income' ? 'green' : 'red';
        const sign = t.type === 'income' ? '+' : '-';
        
        tbody.innerHTML += `
            <tr>
                <td>${t.date}</td>
                <td><span style="font-weight:bold; color:#555">${t.category || 'Umum'}</span></td>
                <td style="color:#888">${t.description}</td>
                <td class="${color}">${sign} Rp ${t.amount.toLocaleString()}</td>
                <td class="no-print">
                    <button class="danger" style="padding:4px 8px" onclick="deleteTransaction(${t.id})">&times;</button>
                </td>
            </tr>
        `;
    });
}

function renderStats(data) {
    let inc = 0, exp = 0;
    const expenseCategories = {};

    data.forEach(t => {
        if(t.type === 'income') {
            inc += t.amount;
        } else {
            exp += t.amount;
            // Grouping data untuk Chart
            const cat = t.category || "Lainnya";
            if(!expenseCategories[cat]) expenseCategories[cat] = 0;
            expenseCategories[cat] += t.amount;
        }
    });

    // Update Kartu Atas
    document.getElementById("saldo").innerText = "Rp " + (inc - exp).toLocaleString();
    document.getElementById("total-income").innerText = "Rp " + inc.toLocaleString();
    document.getElementById("total-expense").innerText = "Rp " + exp.toLocaleString();

    // Update Chart
    renderChart(expenseCategories);
}

function renderChart(categoryData) {
    const ctx = document.getElementById("expenseChart").getContext('2d');
    const labels = Object.keys(categoryData);
    const values = Object.values(categoryData);

    // Toggle Empty State
    if(labels.length === 0) {
        document.getElementById("empty-chart-msg").classList.remove("hidden");
        document.querySelector(".chart-wrapper canvas").classList.add("hidden");
        return;
    } else {
        document.getElementById("empty-chart-msg").classList.add("hidden");
        document.querySelector(".chart-wrapper canvas").classList.remove("hidden");
    }

    if(expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
                    '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });
}