// Yüksek performanslı 60 FPS doğrudan Canvas doku motoru
// html2canvas gecikmelerini ve donmalarını ortadan kaldırır, gerçek zamanlı normal saat ve ECG çizer.

export function createTerminalTexture(onPaint) {
  const canvas = document.createElement('canvas');
  canvas.width = 1152;
  canvas.height = 710;
  const ctx = canvas.getContext('2d');

  let disposed = false;
  let missionData = {
    resources: { energy: 100, water: 85, oxygen: 96, food: 70 },
    mission: 'ARES-1 // İLK KOLONİ',
    objective: 'Bilek terminali ve yaşam destek kontrolü'
  };

  let ecgPhase = 0;
  let commsPhase = 0;
  let ecgHistory = new Array(80).fill(25);

  // SVG astronot telkafesi için çizim fonksiyonu
  function drawSuitWireframe(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 8;

    // Kask
    ctx.beginPath();
    ctx.ellipse(34, 16, 12, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Vizör parlama çizgisi
    ctx.beginPath();
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 1.2;
    ctx.arc(34, 15, 8, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    // Gövde zırhı
    ctx.beginPath();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.moveTo(22, 28);
    ctx.lineTo(46, 28);
    ctx.lineTo(42, 60);
    ctx.lineTo(26, 60);
    ctx.closePath();
    ctx.stroke();

    // Göğüs çekirdeği
    ctx.strokeRect(30, 36, 8, 12);

    // Kollar
    // Sol kol
    ctx.beginPath();
    ctx.moveTo(21, 30);
    ctx.lineTo(11, 48);
    ctx.lineTo(8, 62);
    ctx.lineTo(13, 64);
    ctx.lineTo(17, 52);
    ctx.lineTo(23, 38);
    ctx.stroke();

    // Sağ kol (Aktif bilek ekranı)
    ctx.beginPath();
    ctx.moveTo(47, 30);
    ctx.lineTo(57, 48);
    ctx.lineTo(60, 62);
    ctx.lineTo(55, 64);
    ctx.lineTo(51, 52);
    ctx.lineTo(45, 38);
    ctx.stroke();

    // Bilekteki parlayan saat/ekran göstergesi
    const blink = Math.sin(Date.now() * 0.006) > 0;
    ctx.fillStyle = blink ? '#ffedd5' : '#ea580c';
    ctx.fillRect(55, 52, 7, 9);

    // Bacaklar
    ctx.beginPath();
    ctx.moveTo(26, 61);
    ctx.lineTo(24, 88);
    ctx.lineTo(19, 105);
    ctx.lineTo(29, 105);
    ctx.lineTo(31, 88);
    ctx.lineTo(33, 61);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(42, 61);
    ctx.lineTo(44, 88);
    ctx.lineTo(49, 105);
    ctx.lineTo(39, 105);
    ctx.lineTo(37, 88);
    ctx.lineTo(35, 61);
    ctx.stroke();

    ctx.restore();
  }

  function render() {
    if (disposed) return;

    const w = canvas.width;
    const h = canvas.height;

    // Arka plan: Koyu uzay giysisi ekran tonu
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, w, h);

    // Dış koruyucu çerçeve & pahlar
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(249, 115, 22, 0.6)';
    ctx.shadowBlur = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Köşe vurguları
    ctx.lineWidth = 6;
    const corner = 30;
    // Sol üst
    ctx.beginPath(); ctx.moveTo(10, 10 + corner); ctx.lineTo(10, 10); ctx.lineTo(10 + corner, 10); ctx.stroke();
    // Sağ üst
    ctx.beginPath(); ctx.moveTo(w - 10 - corner, 10); ctx.lineTo(w - 10, 10); ctx.lineTo(w - 10, 10 + corner); ctx.stroke();
    // Sol alt
    ctx.beginPath(); ctx.moveTo(10, h - 10 - corner); ctx.lineTo(10, h - 10); ctx.lineTo(10 + corner, h - 10); ctx.stroke();
    // Sağ alt
    ctx.beginPath(); ctx.moveTo(w - 10 - corner, h - 10); ctx.lineTo(w - 10, h - 10); ctx.lineTo(w - 10, h - 10 - corner); ctx.stroke();

    ctx.shadowBlur = 0;

    // Scanline efekti (hafif yatay çizgiler)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let y = 10; y < h - 10; y += 4) {
      ctx.fillRect(10, y, w - 20, 1.5);
    }

    // 1. ÜST BAŞLIK (Header)
    ctx.fillStyle = 'rgba(28, 34, 48, 0.7)';
    ctx.fillRect(20, 20, w - 40, 48);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, w - 40, 48);

    // Sol: Durum LED ve Sistem Adı
    const pingBlink = Math.sin(Date.now() * 0.005) > 0;
    ctx.fillStyle = pingBlink ? '#22c55e' : '#15803d';
    ctx.beginPath();
    ctx.arc(42, 44, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = '#fdba74';
    ctx.fillText('ARES MARK-IV // EVA WRIST TERMINAL', 60, 50);

    // Sağ: Sol / Mars Günü
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#ea580c';
    ctx.fillText('SOL: 418.6', w - 180, 50);

    // ==========================================
    // 2. ORTA BÖLÜM: BÜYÜK DİJİTAL SAAT & DÜNYA ZAMANI
    // ==========================================
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const millis = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
    const colonBlink = Math.floor(Date.now() / 500) % 2 === 0;

    // Saat Kutusu (Geniş sol/orta panel)
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.fillRect(20, 80, 420, 220);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 80, 420, 220);

    // Saat Başlık
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('● CANLI NORMAL SAAT // LOCAL TIME', 35, 110);

    // BÜYÜK SAYISAL SAAT RAKAMLARI
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.fillStyle = '#ffedd5';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 18;
    const timeStr = `${hours}${colonBlink ? ':' : ' '}${minutes}:${seconds}`;
    ctx.fillText(timeStr, 35, 185);

    // Salise (küçük)
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = '#fb923c';
    ctx.shadowBlur = 8;
    ctx.fillText(`.${millis}`, 355, 185);
    ctx.shadowBlur = 0;

    // Tarih ve Gün Bilgisi
    const months = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
    const days = ['PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} // ${days[now.getDay()]}`;

    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillStyle = '#fdba74';
    ctx.fillText(dateStr, 35, 230);

    // UTC Zamanı
    const utcStr = `UTC: ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} ZULU`;
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(utcStr, 35, 265);

    // ==========================================
    // 3. ASTRONOT GİYSİ BÜTÜNLÜĞÜ (ORTA SÜTUN)
    // ==========================================
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.fillRect(455, 80, 240, 220);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
    ctx.strokeRect(455, 80, 240, 220);

    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('GİYSİ SIZDIRMAZLIK', 485, 108);

    // Telkafe çizimi
    drawSuitWireframe(ctx, 535, 118, 1.25);

    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(475, 260, 200, 26);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.strokeRect(475, 260, 200, 26);
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('✔ 100% NOMİNAL BASINÇ', 490, 278);

    // ==========================================
    // 4. YAŞAM DESTEK VE KAYNAKLAR (SAĞ SÜTUN)
    // ==========================================
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.fillRect(710, 80, 420, 220);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
    ctx.strokeRect(710, 80, 420, 220);

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('YAŞAM DESTEK VERİLERİ', 730, 108);

    // Oksijen Çubuğu
    const o2 = missionData.resources.oxygen;
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('OKSİJEN (O₂)', 730, 140);
    ctx.fillStyle = '#fed7aa';
    ctx.fillText(`${o2}%`, 1070, 140);

    ctx.fillStyle = '#1c2230';
    ctx.fillRect(730, 150, 380, 16);
    ctx.fillStyle = o2 > 30 ? '#f97316' : '#ef4444';
    ctx.fillRect(730, 150, (380 * o2) / 100, 16);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(730, 150, 380, 16);

    // Su ve Yiyecek
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('SU REZERVİ:', 730, 200);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${missionData.resources.water} BR`, 860, 200);

    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('YİYECEK:', 950, 200);
    ctx.fillStyle = '#eab308';
    ctx.fillText(`${missionData.resources.food} BR`, 1050, 200);

    // Batarya / Güç
    const bat = missionData.resources.energy;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('BATARYA:', 730, 245);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`${bat}% [28.4V]`, 860, 245);

    // Segmentli Batarya Çubukları
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = (i / 8) * 100 < bat ? '#22c55e' : '#334155';
      ctx.fillRect(960 + i * 18, 235, 14, 16);
    }

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('SICAKLIK: 21.4°C  |  KABİN: 101.3 kPa', 730, 280);

    // ==========================================
    // 5. ALT BÖLÜM: BİYOMETRİK ECG VE TELSİZ SESİ
    // ==========================================
    // Sol Alt: Canlı Kalp Ritmi (ECG)
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.fillRect(20, 315, 540, 180);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
    ctx.strokeRect(20, 315, 540, 180);

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('BİYOMETRİK // CANLI KALP RİTMİ (ECG)', 35, 345);
    ctx.fillStyle = '#ffedd5';
    ctx.fillText('76 BPM (STABİL)', 430, 345);

    // ECG Çizimi
    ecgPhase++;
    let nextVal = 50;
    const p = ecgPhase % 30;
    if (p === 8) nextVal = 35;
    else if (p === 9) nextVal = 10;
    else if (p === 10) nextVal = 90;
    else if (p === 11) nextVal = 50;
    else if (p === 14) nextVal = 58;

    ecgHistory.push(nextVal + (Math.random() * 3 - 1.5));
    ecgHistory.shift();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < ecgHistory.length; i++) {
      const px = 35 + (i / (ecgHistory.length - 1)) * 510;
      const py = 370 + (ecgHistory[i] * 100) / 100;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Sağ Alt: Telsiz ve İletişim Dalgası
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.fillRect(580, 315, 550, 180);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
    ctx.strokeRect(580, 315, 550, 180);

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#fb923c';
    ctx.fillText('SİNYAL & TELSİZ // KANAL 07', 595, 345);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('ŞİFRELİ [SECURE]', 1000, 345);

    // Ses Dalgası Çizimi
    commsPhase += 0.12;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let x = 0; x < 520; x += 4) {
      const wave = Math.sin(x * 0.08 + commsPhase) * Math.cos(x * 0.03 + commsPhase * 0.5) * 28;
      const py = 425 + wave;
      if (x === 0) ctx.moveTo(595 + x, py);
      else ctx.lineTo(595 + x, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('İLETİŞİM HATTI: ROCINANTE // YER KONTROL FREKANSI', 595, 475);

    // ==========================================
    // 6. EN ALT BANT: AKTİF GÖREV VE ALT TUŞU BİLGİSİ
    // ==========================================
    ctx.fillStyle = 'rgba(28, 34, 48, 0.9)';
    ctx.fillRect(20, 510, w - 40, 180);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.strokeRect(20, 510, w - 40, 180);

    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillStyle = '#ea580c';
    ctx.fillText('AKTİF GÖREV: ' + missionData.mission, 40, 545);

    ctx.font = '15px "Courier New", monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('HEDEF: ' + missionData.objective, 40, 580);

    // Alt tuşu ipucu kutusu
    ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
    ctx.fillRect(40, 610, w - 80, 55);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 610, w - 80, 55);

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#ffedd5';
    ctx.fillText('⌨  [ALT] TUŞUNA BASARAK KOLUNUZU KALDIRIP SAATE BAKABİLİRSİNİZ', 60, 644);

    // Üst katmana gönder
    onPaint(canvas);
  }

  // 60 FPS canlı döngü
  let animId;
  function loop() {
    if (disposed) return;
    render();
    animId = requestAnimationFrame(loop);
  }
  loop();

  return {
    update(data) {
      if (!data) return;
      if (data.resources) Object.assign(missionData.resources, data.resources);
      if (data.mission) missionData.mission = data.mission;
      if (data.objective) missionData.objective = data.objective;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
    }
  };
}
