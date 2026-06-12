const API_URL = "http://localhost:8001/api";

// --- VARIABEL & FUNGSI LOGIKA CAROUSEL ---
let currentSlide = 0;
let totalSlides = 0;

function nextSlide() {
    if (currentSlide < totalSlides - 1) {
        currentSlide++;
        updateCarousel();
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        currentSlide--;
        updateCarousel();
    }
}

function updateCarousel() {
    const track = document.getElementById("katalog-parfum");
    if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;

    // Matikan tombol jika mentok
    const prevBtn = document.querySelector(".prev-btn");
    const nextBtn = document.querySelector(".next-btn");
    if (prevBtn) prevBtn.disabled = currentSlide === 0;
    if (nextBtn) nextBtn.disabled = currentSlide === totalSlides - 1;
}


// --- FUNGSI CUSTOM POP-UP MODAL ---
function showModal(message, type = "success") {
    // Hapus modal lama jika ada agar tidak menumpuk
    const existingModal = document.getElementById("custom-modal");
    if (existingModal) existingModal.remove();

    // Tentukan icon dan warna aksen atas berdasarkan tipe
    let icon = "🔔";
    let borderColor = "#d4af37";
    if (type === "success") {
        icon = "✅";
        borderColor = "#2ed573";
    }
    if (type === "error") {
        icon = "❌";
        borderColor = "#ff4757";
    }
    if (type === "warning") {
        icon = "⚠️";
        borderColor = "#ffa502";
    }

    // Buat struktur HTML Modalnya
    const modalHTML = `
        <div id="custom-modal" class="modal-overlay">
            <div class="modal-box" style="border-top: 5px solid ${borderColor};">
                <div class="modal-icon">${icon}</div>
                <div class="modal-text">${message}</div>
                <button class="modal-btn" onclick="closeModal()">OK, MENGERTI</button>
            </div>
        </div>
    `;

    // Sisipkan ke dalam body web
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Trigger animasi muncul (sedikit delay agar transisi CSS terbaca browser)
    setTimeout(() => {
        document.getElementById("custom-modal").classList.add("show");
    }, 10);
}

// Fungsi untuk menutup modal
function closeModal() {
    const modal = document.getElementById("custom-modal");
    if (modal) {
        modal.classList.remove("show"); // Hilangkan dengan animasi
        setTimeout(() => modal.remove(), 400); // Hapus elemen dari HTML setelah animasi selesai
    }
}

// --- 1. AMBIL DATA PARFUM DARI REST API ---
async function loadParfum() {
    try {
        const response = await fetch(`${API_URL}/parfum`);
        const result = await response.json();

        if (result.success) {
            const katalogDiv = document.getElementById("katalog-parfum");
            katalogDiv.innerHTML = "";

            // Set data untuk Carousel
            totalSlides = result.data.length;
            currentSlide = 0; // Reset ke awal tiap kali data di-load

            result.data.forEach((p) => {
                katalogDiv.innerHTML += `
                    <div class="card">
                        <span class="brand">${p.brand}</span>
                        <h3>${p.nama_produk}</h3>
                        <p class="desc">${p.deskripsi}</p>
                        <div class="price">Rp ${Number(p.harga).toLocaleString("id-ID")}</div>
                        <div class="stock">Sisa Stok: <strong>${p.stok}</strong></div>
                        
                        <div class="form-group">
                            <label>Jumlah Beli:</label>
                            <input type="number" id="qty-${p.id}" placeholder="0" min="1" max="${p.stok}">
                        </div>
                        <div class="form-group">
                            <label>Nomor Rekening Bank:</label>
                            <input type="text" id="rek-${p.id}" placeholder="Masukkan nomor rekening">
                        </div>
                        <button id="btn-${p.id}" onclick="prosesCheckout(${p.id})">Beli via SOAP Gateway</button>
                    </div>
                `;
            });

            // Aktifkan animasi dan tombol pertama kali
            updateCarousel();
        }
    } catch (error) {
        showModal(
            "Gagal mengambil data dari Server A. Pastikan Server REST API berjalan!",
            "error",
        );
    }
}

// 2. KIRIM REQUEST CHECKOUT KE SERVER A ---
async function prosesCheckout(parfumId) {
    const jumlahBeli = document.getElementById(`qty-${parfumId}`).value;
    const noRekening = document.getElementById(`rek-${parfumId}`).value;
    const btn = document.getElementById(`btn-${parfumId}`);

    // Validasi Frontend
    if (!jumlahBeli || jumlahBeli <= 0) {
        showModal("Harap masukkan jumlah beli yang valid.", "warning");
        return;
    }
    if (!noRekening) {
        showModal(
            "Isi nomor rekening simulasi perbankan terlebih dahulu!",
            "warning",
        );
        return;
    }

    const payload = {
        parfum_id: parseInt(parfumId),
        jumlah_beli: parseInt(jumlahBeli),
        nomor_rekening_pembeli: noRekening,
    };

    try {
        btn.disabled = true;
        btn.innerHTML = "⏳ Memproses SOAP...";

        const logContainer = document.getElementById("log-container");
        const logContent = document.getElementById("log-content");
        logContainer.style.display = "block";
        logContent.innerHTML =
            "Mengirim data JSON ke Server A...\nMenunggu respon dari Server B (SOAP)...";
        logContent.classList.remove("success-text");

        // menampilkan log request yang dikirim ke Server A
        const response = await fetch(`${API_URL}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        logContent.innerHTML = JSON.stringify(result, null, 2);

        if (result.success) {
            logContent.classList.add("success-text");
            // Tampilkan Modal Sukses!
            showModal(result.message, "success");

            document.getElementById(`qty-${parfumId}`).value = "";
            document.getElementById(`rek-${parfumId}`).value = "";
            loadParfum();
            loadHistory();
        } else {
            // Tampilkan Modal Gagal!
            showModal(`Transaksi Gagal: ${result.message}`, "error");
        }
    } catch (error) {
        showModal(
            "Terjadi kesalahan jaringan atau SOAP Server B mati.",
            "error",
        );
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "Beli via SOAP Gateway";
        }
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/transaksi`);
        const result = await response.json();
        if (result.success) {
            const tbody = document.getElementById('history-body');
            tbody.innerHTML = result.data.map(t => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 15px;">${t.invoice_no}</td>
                    <td style="padding: 15px;">${t.nama_produk}</td>
                    <td style="padding: 15px; color: #2ed573;">${t.status_pembayaran}</td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error("Gagal memuat history"); }
}

// Jalankan saat web pertama kali dibuka
document.addEventListener("DOMContentLoaded", () => {
    loadParfum();
    loadHistory();
});


