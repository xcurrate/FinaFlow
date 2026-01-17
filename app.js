// --- DEBUGGING MODE APP.JS ---
console.log("1. Script app.js mulai dimuat...");

// --- 1. SETUP SUPABASE ---
// ⚠️ PASTIKAN INI SUDAH DIISI DENGAN BENAR
const supabaseUrl = 'https://sbxtfqidotarniglzban.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHRmcWlkb3Rhcm5pZ2x6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjgxODQsImV4cCI6MjA4MzgwNDE4NH0.MCiWNCcmQRBmAvAbsbcpdMbSOWAg7zPqJynpCLf1RKQ';

let supabase;

try {
    if (!supabaseUrl.includes("https") || !supabaseKey.includes("ey")) {
        console.error("❌ ERROR FATAL: URL atau Key Supabase belum diisi di app.js!");
        alert("ERROR: Buka file app.js dan isi supabaseUrl & supabaseKey dulu!");
    } else {
        supabase = supabase.createClient(supabaseUrl, supabaseKey);
        console.log("2. Supabase Client berhasil diinisialisasi ✅");
    }
} catch (err) {
    console.error("❌ Terjadi error saat inisialisasi Supabase:", err);
}

// --- DOM ELEMENTS ---
const authForm = document.getElementById('auth-form');
const registerBtn = document.getElementById('register-btn');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// --- 2. CEK ELEMENT HTML ---
if (!authForm || !registerBtn) {
    console.error("❌ ERROR: Elemen HTML tidak ditemukan. Cek id di index.html.");
} else {
    console.log("3. Elemen HTML ditemukan, siap memasang Event Listener.");
}

// --- 3. EVENT LISTENER (DAFTAR) ---
if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
        console.log("👉 Tombol DAFTAR diklik!");
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        console.log("Data input:", email, password);

        if(!email || !password) {
            alert("Email dan Password harus diisi!");
            return;
        }

        console.log("Mengirim request ke Supabase...");
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            console.error("❌ Gagal Daftar:", error.message);
            alert("Error: " + error.message);
        } else {
            console.log("✅ Berhasil Daftar:", data);
            alert("Pendaftaran Berhasil! Silakan Login.");
        }
    });
}

// --- 4. EVENT LISTENER (LOGIN) ---
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Mencegah refresh halaman
        console.log("👉 Tombol LOGIN diklik (Submit form)");

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            console.error("❌ Gagal Login:", error.message);
            alert("Login Gagal: " + error.message);
        } else {
            console.log("✅ Berhasil Login:", data.user);
            handleLoginSuccess(data.user);
        }
    });
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log("4. Halaman selesai dimuat (DOM Ready).");
    
    // Cek Session yang tersimpan
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            console.log("🔄 User sudah login sebelumnya.");
            handleLoginSuccess(session.user);
        } else {
            console.log("👤 User belum login.");
        }
    }
});

function handleLoginSuccess(user) {
    console.log("🚀 Masuk ke Dashboard...");
    document.getElementById('user-email').textContent = user.email;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    // fetchTransactions(); // (Nonaktifkan dulu biar fokus auth)
}
