const express = require("express");
const mysql = require("mysql2/promise");
const soap = require("soap");
const bodyParser = require("body-parser");
const cors = require("cors");

// 1. DEFINISIKAN 'app' DI SINI (Sebelum digunakan di middleware)
const app = express();
const port = 8001;

// 2. BARU GUNAKAN 'app' DI SINI (Setelah didefinisikan)
app.use(cors());
app.use(bodyParser.json());

const dbConfig = {
    host: "localhost",
    user: "root",
    password: "",
    database: "db_minyakku", // <-- Diubah ke database saya
};

const soapServerUrl = "http://localhost:8002/wsdl?wsdl";

// 1. ENDPOINT REST: Ambil Koleksi Parfum (Format: JSON)
app.get("/api/parfum", async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute("SELECT * FROM produk");
        await connection.end();
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint untuk mengambil riwayat transaksi
app.get("/api/transaksi", async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            "SELECT t.*, p.nama_produk FROM transaksi t JOIN produk p ON t.produk_id = p.id ORDER BY t.id DESC LIMIT 5",
        );
        await connection.end();
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. ENDPOINT REST: Checkout & Trigger Interoperabilitas SOAP
app.post("/api/checkout", async (req, res) => {
    const { parfum_id, jumlah_beli, nomor_rekening_pembeli } = req.body;

    // --- TAMBAHKAN VALIDASI INI ---
    if (!parfum_id || !jumlah_beli || !nomor_rekening_pembeli) {
        return res.status(400).json({
            success: false,
            message:
                "Gagal memproses! Pastikan 'parfum_id', 'jumlah_beli', dan 'nomor_rekening_pembeli' sudah terisi di Body JSON.",
        });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Pengecekan stok parfum
        const [produk] = await connection.execute(
            "SELECT * FROM produk WHERE id = ?",
            [parfum_id],
        );
        if (produk.length === 0) {
            await connection.end();
            return res
                .status(404)
                .json({ success: false, message: "Parfum tidak ditemukan" });
        }

        const dataParfum = produk[0];
        if (dataParfum.stok < jumlah_beli) {
            await connection.end();
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Stok parfum habis atau tidak mencukupi",
                });
        }

        const totalBayar = dataParfum.harga * jumlah_beli;
        const invoiceNo = "INV-PFM-" + Date.now();

        // Jembatan Interoperabilitas ke Server B (SOAP)
        soap.createClient(soapServerUrl, async function (err, soapClient) {
            if (err) {
                await connection.end();
                return res
                    .status(500)
                    .json({
                        success: false,
                        message: "Gagal terhubung ke SOAP Server Bank",
                    });
            }

            // Memastikan semua value diconvert ke String agar aman di XML SOAP
            const soapArgs = {
                invoiceNo: String(invoiceNo),
                noRekening: String(nomor_rekening_pembeli),
                nominal: String(totalBayar),
                produkId: String(parfum_id),
                jumlahBeli: String(jumlah_beli),
            };

            // Tembak RPC Legacy Bank
            soapClient.prosesPembayaran(
                soapArgs,
                async function (err, soapResponse) {
                    if (
                        err ||
                        !soapResponse ||
                        soapResponse.status !== "SUCCESS"
                    ) {
                        await connection.end();
                        return res.status(400).json({
                            success: false,
                            message:
                                "Transaksi ditolak oleh Bank Simulator atau Server B Mati",
                        });
                    }

                    // Jika SOAP sukses, Server A memotong stok di tabel parfum
                    await connection.execute(
                        "UPDATE produk SET stok = stok - ? WHERE id = ?",
                        [jumlah_beli, parfum_id],
                    );
                    await connection.end();

                    res.json({
                        success: true,
                        message: `Berhasil membeli ${jumlah_beli} botol ${dataParfum.nama_produk}!`,
                        detail: {
                            invoice: invoiceNo,
                            total_harga: totalBayar,
                            bank_reference: soapResponse.referensiSoap,
                            bank_message: soapResponse.pesan,
                        },
                    });
                },
            );
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, () => {
    console.log(
        `[Server A] E-Commerce Parfum REST API berjalan di http://localhost:${port}`,
    );
});

// TAMBAHKAN CODE INI DI SERVER A
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept",
    );
    next();
});
