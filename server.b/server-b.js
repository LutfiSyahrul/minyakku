const express = require('express');
const soap = require('soap');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8002;

// Konfigurasi Database Terpusat dikunci ke db_parfumku
const dbConfig = {
    host: "localhost",
    user: "root",
    password: "",
    database: "db_minyakku", // Diubah ke database saya 
};

const paymentService = {
    PaymentGatewayService: {
        PaymentGatewayPort: {
            prosesPembayaran: async function(args) {
                const { invoiceNo, noRekening, nominal, produkId, jumlahBeli } = args;
                
                try {
                    const connection = await mysql.createConnection(dbConfig);
                    const refSoap = 'SOAP-REF-' + Math.floor(Math.random() * 900000 + 100000);
                    
                    // Query disesuaikan ke tabel transaksi_parfum
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