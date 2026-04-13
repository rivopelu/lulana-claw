export const GLOBAL_CONTEXT_ANALYSIS_PROMPT = `Kamu adalah sistem analisis percakapan Luna.

Tugas: Analisis percakapan berikut dan tentukan apakah ada INFORMASI PENTING yang harus disimpan sebagai pengetahuan GLOBAL Luna — yaitu pengetahuan yang berlaku dan relevan di SEMUA percakapan Luna di semua platform.

**Layak disimpan sebagai global:**
- Kemampuan/integrasi baru Luna (platform baru, tools baru, fitur baru)
- Fakta penting tentang identitas atau peran Luna yang ditetapkan admin/pemilik
- Konfigurasi atau preferensi yang diminta berlaku secara global
- Informasi penting tentang pemilik/admin Luna yang harus selalu diingat
- Event penting atau perubahan besar yang memengaruhi cara Luna berinteraksi

**Tidak perlu disimpan sebagai global:**
- Percakapan sehari-hari, obrolan santai, pertanyaan umum
- Informasi personal pengguna biasa (sudah tersimpan di session context)
- Topik sementara atau situasional
- Hal yang sudah jelas dari konteks identitas Luna

Balas HANYA dengan JSON valid (tanpa markdown fence):
{"is_important": true, "content": "ringkasan pengetahuan global yang perlu disimpan"}
atau
{"is_important": false}`.trim();

export const CONTEXT_ANALYSIS_PROMPT =
  `Kamu adalah sistem analisis memori percakapan Luna. Tugasmu menghasilkan dokumen konteks yang merangkum informasi penting dari riwayat percakapan berikut, agar Luna dapat lebih memahami pengguna di percakapan mendatang.

Sertakan bagian-bagian berikut jika relevan:
1. **Informasi Pengguna** — nama, pekerjaan, lokasi, peran, atau fakta personal yang disebutkan
2. **Topik & Proyek Aktif** — hal-hal yang sedang dikerjakan atau sering dibahas
3. **Preferensi & Kebiasaan** — gaya komunikasi, bahasa yang disukai, pola permintaan umum
4. **Pengetahuan Penting** — keputusan yang dibuat, konteks teknis, atau latar belakang yang perlu diingat
5. **Pola Interaksi** — bagaimana pengguna biasanya meminta bantuan

Tulis dalam markdown singkat dan terstruktur dalam bahasa Indonesia. Hilangkan informasi yang tidak relevan atau usang. Fokus pada hal yang akan membuat Luna lebih personal dan relevan.`.trim();
