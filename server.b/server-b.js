const express = require('express');
const soap = require('soap');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = process.env.PORT_B || 8002;

// Konfigurasi Database Terpusat dikunci ke db_parfumku
const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "db_minyakku", // Diubah ke database saya 
};

const paymentService = {
    PaymentGatewayService: {
        PaymentGatewayPort: {
            prosesPembayaran: async function(args) {
                const { invoiceNo, noRekening, nominal, produkId, jumlahBeli } = args;
                
                try {
                    const connection = await mysql.createConnection(dbConfig);
                    const refSoap = 'SOAP-REF-' + Math.floor(Math.random() * 900000 + 100000);
                    
                    // Query ke tabel transaksi_parfum
                    const query = `INSERT INTO transaksi 
                    (invoice_no, produk_id, jumlah_beli, total_bayar, status_pembayaran, nomor_rekening_pembeli, referensi_soap) 
                    VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?)`;
                    
                    await connection.execute(query, [invoiceNo, produkId, jumlahBeli, nominal, noRekening, refSoap]);
                    await connection.end();

                    return {
                        status: 'SUCCESS',
                        referensiSoap: refSoap,
                        pesan: `Pembayaran parfum sukses menggunakan rekening ${noRekening}`
                    };
                } catch (error) {
                    return {
                        status: 'FAILED',
                        referensiSoap: '',
                        pesan: 'Gagal memproses transaksi perbankan: ' + error.message
                    };
                }
            }
        }
    }
};

const wsdlXml = fs.readFileSync(path.join(__dirname, 'service-b.wsdl'), 'utf8');

app.listen(port, function() {
    soap.listen(app, '/wsdl', paymentService, wsdlXml, function() {
        console.log(`[Server B] SOAP Payment Gateway berjalan di http://localhost:${port}/wsdl?wsdl`);
    });
});