// ================= CONFIGURASI =================
// GANTI DENGAN URL & KEY SUPABASE MILIKMU SENDIRI
const SUPABASE_URL = "https://sbxtfqidotarniglzban.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ";

// Inisialisasi Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Global
let currentUser = null;
let financeChart = null;

// ================= EVENT LISTENER (Saat Halaman Dimuat) =================
window.addEventListener('DOMContentLoaded', async () => {
    // Cek apakah user sudah login sebelumnya
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        initApp();
    }
});

// ================= AUTHENTICATION =================
async function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("auth-message");

    if(!email || !password) return alert("Isi email dan password!");

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        msg.style.display = "block";
        msg.innerText = "Error: " + error.message;
    } else {
        alert("Pendaftaran berhasil! Cek email untuk konfirmasi atau coba login.");
    }
}

async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("auth-message");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        msg.style.display = "block";
        msg.innerText = "Gagal Masuk: " + error.message;
    } else {
        currentUser = data.user;
        initApp();
    }
}

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// ================= INITIALIZATION =================
function initApp() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
    document.getElementById("user-email-display").innerText = currentUser.email;

    // Set tanggal default ke hari ini
    document.getElementById("date").valueAsDate = new Date();

    loadTransactions("month"); // Default load data bulan ini
}

// ================= CRUD (DATABASE) =================
async function addTransaction() {
    const desc = document.getElementById("desc").value;
    const amount = Number(document.getElementById("amount").value);
    const date = document.getElementById("date").value;
    const type = document.getElementById("type").value;

    if(!desc || !amount || !date) return alert("Mohon lengkapi semua data!");

    const { error } = await supabase.from("transactions").insert({
        user_id: currentUser.id,
        description: desc, // Pastikan kolom di supabase namanya 'description'
        amount: amount,
        date: date,
        type: type
    });

    if (error) alert("Gagal simpan: " + error.message);
    else {
        // Reset form input
        document.getElementById("desc").value = "";
        document.getElementById("amount").value = "";
        loadTransactions("month"); // Refresh data
    }
}

async function deleteTransaction(id) {
    if(!confirm("Yakin hapus data ini?")) return;
    
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    
    if(error) alert("Gagal hapus: " + error.message);
    else loadTransactions("month");
}

// ================= LOAD & FILTER DATA =================
async function loadTransactions(filterType) {
    // Logika Filter Tanggal
    const startDate = new Date();
    if (filterType === 'day') startDate.setDate(startDate.getDate() - 1);
    else if (filterType === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (filterType === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else if (filterType === 'all') startDate.setFullYear(2000); // Ambil semua data

    let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("date", { ascending: false });

    // Terapkan filter jika bukan 'all'
    if (filterType !== 'all') {
        query = query.gte("date", startDate.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if(error) console.error("Error load data:", error);
    else {
        renderTable(data);
        renderSummary(data);
        renderChart(data);
        renderAdvice(data);
    }
}

// ================= RENDER UI =================
function renderTable(data) {
    const tbody = document.querySelector("#transaction-table tbody");
    tbody.innerHTML = "";

    if(data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Belum ada data.</td></tr>";
        return;
    }

    data.forEach(t => {
        const row = `
            <tr>
                <td>${t.date}</td>
                <td>${t.description}</td> 
                <td style="color:${t.type === 'income' ? 'green' : 'red'}">${t.type.toUpperCase()}</td>
                <td>Rp ${t.amount.toLocaleString()}</td>
                <td class="no-print">
                    <button class="danger" style="padding:5px 10px;" onclick="deleteTransaction(${t.id})">Hapus</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function renderSummary(data) {
    let income = 0;
    let expense = 0;

    data.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    document.getElementById("saldo").innerText = `Rp ${(income - expense).toLocaleString()}`;
    document.getElementById("total-income").innerText = `Rp ${income.toLocaleString()}`;
    document.getElementById("total-expense").innerText = `Rp ${expense.toLocaleString()}`;
}

function renderChart(data) {
    let income = 0;
    let expense = 0;

    data.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    // Hapus chart lama jika ada agar tidak menumpuk (bug chart.js umum)
    if (financeChart) financeChart.destroy();

    const ctx = document.getElementById("financeChart").getContext('2d');
    financeChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Pemasukan", "Pengeluaran"],
            datasets: [{
                data: [income, expense],
                backgroundColor: ["#22c55e", "#ef4444"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderAdvice(data) {
    let income = 0;
    let expense = 0;

    data.forEach(t => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
    });

    const card = document.getElementById("advice-card");
    card.className = "advice"; // Reset class

    if (income === 0 && expense === 0) {
        card.style.display = "none";
        return;
    }

    card.style.display = "block";

    if (expense > income * 0.8) {
        card.classList.add("red");
        card.innerHTML = "⚠️ <b>PERINGATAN:</b> Pengeluaranmu boros (>80% Pemasukan). Segera berhemat!";
    } else if (expense < income * 0.5 && income > 0) {
        card.classList.add("green");
        card.innerHTML = "✅ <b>BAGUS:</b> Keuanganmu sangat sehat. Terus menabung!";
    } else {
        card.style.background = "#e2e8f0";
        card.style.color = "#334155";
        card.innerHTML = "ℹ️ <b>INFO:</b> Keuanganmu stabil, tapi tetap hati-hati.";
    }
}