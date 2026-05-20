# NOTES — observații tehnice deschise

Listă de lucruri observate la audit, care nu sunt urgențe, dar merită discutate / decise.
Nu acționa pe niciuna fără confirmare explicită.

---

## TODO

- [ ] **Migrație profil incompletă (`*-new` vs versiuni vechi)**
  Există în paralel `profile-view.html` + `profile-view.js` și `profile-view-new.html` + `profile-view-new.js` (la fel pentru edit). De decis: migrația e completă și ștergem versiunile vechi, sau încă rulează ambele în paralel? Dacă e complet migrat, fișierele vechi sunt cod mort care creează confuzie la editări viitoare.

- [ ] **`terenuri-old.html` + `terenuri-old.js`**
  Sufixul `-old` sugerează cod legacy păstrat pentru fallback. De verificat dacă mai e linkat de undeva și dacă mai are sens să rămână în repo.

- [ ] **`grup-details.html` are 176.6 KB**
  Semnificativ mai mare decât celelalte pagini (a doua ca mărime, `index.html`, are 75 KB). Probabil conține mult JS/CSS inline. Candidat pentru extragere în fișiere separate dacă ajungem să-l atingem oricum pentru altă schimbare — nu refactor preventiv.

- [ ] **Videoclipuri mari servite direct din repo prin Render**
  `povestea_noastra/videos/timelapse-santier.mp4` (17 MB) și `tur-interior.mp4` (11 MB) — funcționează, dar la trafic real consumă bandă Render și încetinesc deploy-urile. De evaluat mutarea pe Supabase Storage sau un CDN când avem timp. Nu urgent.

- [ ] **Duplicare `terrain-card.js`**
  Există în două locuri: `frontend/js/terrain-card.js` (3.1 KB) și `frontend/js/components/terrain-card.js` (3.0 KB). De verificat care e cel folosit efectiv (grep prin HTML-uri după calea de `<script>`) și de șters cel orfan, ca să nu edităm pe viitor varianta greșită.

---

*Ultima actualizare: 2026-05-20*
