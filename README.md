# Petualangan 7 Kebiasaan

Website mandiri Habit Tracker siswa SD. Frontend diterbitkan gratis melalui GitHub Pages dan tetap menggunakan Google Apps Script + Google Sheets sebagai backend/database.

## URL produksi

`https://sdngegerkedungadem.github.io/habit-tracker-sd/`

## Arsitektur

- GitHub Pages: HTML, CSS, JavaScript, dan PWA shell.
- GAS Web App: autentikasi, otorisasi, log jurnal, streak, CRUD, dan pembuatan PDF.
- Google Sheets: database yang sudah digunakan aplikasi sebelumnya.
- Komunikasi frontend-backend menggunakan iframe RPC dengan validasi origin, bukan membuka API publik tanpa pembatasan.

## Pengembangan lokal

Jalankan server statis lokal. Backend produksi hanya mengizinkan origin GitHub Pages; tambahkan origin lokal secara eksplisit di `BRIDGE_ALLOWED_ORIGINS` pada `Code.gs` bila diperlukan untuk pengembangan.

## Deployment

Push ke branch `main`. Workflow `.github/workflows/pages.yml` akan menerbitkan situs secara otomatis.
