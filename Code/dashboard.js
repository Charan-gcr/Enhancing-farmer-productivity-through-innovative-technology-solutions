 // ─── EMAILJS CONFIG ──────────────────────────────────────────────────────────
// 1. Sign up free at https://www.emailjs.com
// 2. Create a Service (Gmail/Outlook) → copy Service ID below
// 3. Create an Email Template → copy Template ID below
//    Template variables to use in EmailJS template:
//      {{to_email}}  {{to_name}}  {{crop}}  {{symptom_label}}
//      {{soil}}  {{yield_tip}}  {{disease}}  {{treatment}}  {{report_date}}
// 4. Copy your Public Key from Account → API Keys
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';   // ← replace
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // ← replace
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';   // ← replace

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function setChip(el, label, tone = 'neutral') {
  el.textContent = label; el.dataset.tone = tone;
}

function requireAuth() {
  try {
    const raw = localStorage.getItem('agrivision_user');
    if (!raw) { window.location.href = 'index.html'; return null; }
    return JSON.parse(raw);
  } catch { window.location.href = 'index.html'; return null; }
}

// ─── AGRI DATABASE ───────────────────────────────────────────────────────────
const agriDB = {
  "Rice": {
    soil: "Heavy clay or clay loam. Requires soil with high water-holding capacity. Ideal pH: 5.5 to 6.5.",
    yieldTip: "Adopt SRI (System of Rice Intensification) method. Apply Nitrogen in 3 splits. Maintain 5cm standing water during reproductive stages.",
    diseases: {
      "spots":     { name: "Rice Blast",           treatment: "Spray Tricyclazole 75 WP @ 120g/acre.", danger: "danger" },
      "yellowing": { name: "Bacterial Leaf Blight", treatment: "Spray Streptocycline + Copper Oxychloride.", danger: "warn" }
    }
  },
  "Wheat": {
    soil: "Well-drained fertile loamy and clayey loam soils. Ideal pH: 6.0 to 7.0.",
    yieldTip: "Ensure timely sowing (Nov 1-15 in North India). The Crown Root Initiation (CRI) stage at 21 days is critical for irrigation.",
    diseases: {
      "yellowing": { name: "Yellow Rust",  treatment: "Spray Propiconazole 25 EC @ 200ml/acre.", danger: "danger" },
      "spots":     { name: "Leaf Blight",  treatment: "Spray Mancozeb 75 WP @ 2g/liter.", danger: "warn" }
    }
  },
  "Cotton": {
    soil: "Black cotton soil (Regur), deep and well-drained. Highly sensitive to waterlogging.",
    yieldTip: "Maintain optimal spacing (90x60 cm for Bt Cotton). Nip the terminal growing point at 80-90 days to increase boll size.",
    diseases: {
      "holes":   { name: "Pink Bollworm",   treatment: "Use Pheromone traps; spray Spinosad 45 SC.", danger: "danger" },
      "wilting": { name: "Fusarium Wilt",   treatment: "Drench soil with Copper Oxychloride.", danger: "warn" }
    }
  },
  "Sugarcane": {
    soil: "Deep, rich loamy soils with good drainage. Ideal pH: 6.5 to 7.5.",
    yieldTip: "Use the trench method for planting. Apply adequate FYM and practice earthing-up at 120 days to prevent lodging.",
    diseases: {
      "spots":     { name: "Red Rot",      treatment: "Uproot infected clumps. Use healthy setts treated with Carbendazim.", danger: "danger" },
      "yellowing": { name: "Grassy Shoot", treatment: "Treat setts with hot water (50 degrees C for 2 hours) before planting.", danger: "warn" }
    }
  },
  "Tomato": {
    soil: "Well-drained sandy loam to clay loam. Highly responsive to organic matter.",
    yieldTip: "Stake the plants to prevent soil contact. Use mulching to conserve moisture and reduce weed growth.",
    diseases: {
      "spots":   { name: "Early Blight",    treatment: "Spray Mancozeb or Chlorothalonil.", danger: "warn" },
      "wilting": { name: "Bacterial Wilt",  treatment: "Remove infected plants; practice crop rotation.", danger: "danger" }
    }
  },
  "Maize": {
    soil: "Deep, fertile, well-drained loamy soils rich in organic matter. Cannot tolerate waterlogging.",
    yieldTip: "Keep field weed-free for the first 30-45 days. Apply split doses of Nitrogen at knee-high and tasseling stages.",
    diseases: {
      "spots": { name: "Maydis Leaf Blight", treatment: "Spray Mancozeb @ 2.5g/liter.", danger: "warn" },
      "holes": { name: "Fall Armyworm",       treatment: "Spray Emamectin Benzoate 5 SG.", danger: "danger" }
    }
  }
};

const genericAgri = {
  soil: "Generally requires well-drained, fertile loamy soil with neutral pH (6.0 - 7.0).",
  yieldTip: "Use certified seeds, apply balanced NPK fertilizers based on soil testing, and ensure timely weeding and irrigation.",
  diseases: {
    "spots":     { name: "Fungal Spotting",           treatment: "Apply broad-spectrum fungicide like Mancozeb.", danger: "warn" },
    "yellowing": { name: "Nutrient Deficiency / Virus", treatment: "Apply micronutrient spray; remove vector insects.", danger: "warn" },
    "wilting":   { name: "Root Rot / Wilt",            treatment: "Ensure proper drainage; drench roots with Trichoderma.", danger: "danger" },
    "holes":     { name: "Chewing Pests",               treatment: "Apply Neem oil (1500 ppm) or safe chemical insecticides.", danger: "warn" }
  }
};

const symptomLabels = {
  none:      'Healthy (no symptoms)',
  spots:     'Brown/Black Spots',
  yellowing: 'Yellowing Leaves',
  wilting:   'Drooping/Wilting',
  holes:     'Insect Bites/Holes'
};

function analyzeCrop(crop, symptom) {
  const data = agriDB[crop] || genericAgri;
  let diseaseInfo = null;
  if (symptom !== 'none') {
    diseaseInfo = data.diseases[symptom] || genericAgri.diseases[symptom];
  }
  return { soil: data.soil, yieldTip: data.yieldTip, diseaseInfo };
}

// ─── PDF GENERATION ──────────────────────────────────────────────────────────
function generatePDF(user, crop, symptom, result) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, margin = 18, col = W - margin * 2;
  const green      = [31, 143, 95];
  const darkGreen  = [10, 61, 37];
  const teal       = [14, 123, 141];
  const lightGreen = [240, 255, 247];
  const lightGray  = [248, 249, 252];
  const textDark   = [28, 39, 52];
  const textMuted  = [74, 93, 112];
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  // Header bar
  doc.setFillColor(...green);
  doc.rect(0, 0, W, 34, 'F');

  doc.setFillColor(...teal);
  doc.circle(margin + 6, 17, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text('AV', margin + 6, 19.5, { align: 'center' });

  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('AGRI VISION INDIA', margin + 16, 15);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Intelligence Crop Report', margin + 16, 21);

  doc.setFontSize(8);
  doc.text('Date: ' + today, W - margin, 12, { align: 'right' });
  doc.text('Farmer: ' + (user.fullName || user.username || 'N/A'), W - margin, 18, { align: 'right' });
  doc.text('Email: ' + (user.email || user.username || 'N/A'), W - margin, 24, { align: 'right' });

  let y = 44;

  // Summary pills
  const pills = [
    { label: 'Crop', value: crop },
    {
      label: 'Season',
      value: ['Rice','Cotton','Maize','Sugarcane','Groundnut'].includes(crop) ? 'Kharif'
           : ['Wheat','Mustard','Chickpea'].includes(crop) ? 'Rabi' : 'Perennial'
    },
    { label: 'Symptoms', value: symptomLabels[symptom] || symptom }
  ];
  const pillW = col / pills.length - 4;
  pills.forEach((p, i) => {
    const x = margin + i * (pillW + 6);
    doc.setFillColor(...lightGreen);
    doc.roundedRect(x, y, pillW, 16, 3, 3, 'F');
    doc.setTextColor(...textMuted); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(p.label.toUpperCase(), x + pillW / 2, y + 5.5, { align: 'center' });
    doc.setTextColor(...darkGreen); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(p.value, x + pillW / 2, y + 12, { align: 'center' });
  });
  y += 24;

  // Section renderer
  function section(title, chipText, chipColor, bodyLines, accent) {
    const lineH = 5.5, pad = 10, headH = 18;
    const totalH = headH + pad + bodyLines.length * lineH + pad;

    doc.setFillColor(...(accent ? lightGreen : lightGray));
    doc.roundedRect(margin, y, col, totalH, 4, 4, 'F');
    if (accent) {
      doc.setDrawColor(...green); doc.setLineWidth(0.4);
      doc.roundedRect(margin, y, col, totalH, 4, 4, 'S');
    }

    doc.setFillColor(...(accent ? [209, 250, 229] : [235, 238, 244]));
    doc.roundedRect(margin, y, col, headH, 4, 4, 'F');
    doc.rect(margin, y + headH - 4, col, 4, 'F');

    doc.setTextColor(...darkGreen); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(title, margin + pad, y + 11.5);

    const cw = doc.getTextWidth(chipText) + 8;
    doc.setFillColor(...chipColor);
    doc.roundedRect(W - margin - cw - 2, y + 5, cw, 8, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(chipText, W - margin - cw / 2 - 2, y + 10.5, { align: 'center' });

    y += headH + pad;
    doc.setTextColor(...textDark); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    bodyLines.forEach(line => { doc.text(line, margin + pad, y); y += lineH; });
    y += pad + 6;
  }

  section('Ideal Soil & Climate', 'IDEAL', green,
    doc.splitTextToSize(result.soil, col - 20), true);

  section('Yield Optimization', 'PRO TIP', teal,
    doc.splitTextToSize(result.yieldTip, col - 20), true);

  if (result.diseaseInfo) {
    const dColor = result.diseaseInfo.danger === 'danger' ? [220, 38, 38] : [217, 119, 6];
    section('Disease Status', 'ALERT', dColor,
      ['Detected: ' + result.diseaseInfo.name], false);
    section('Treatment & Prevention', 'ACTION REQUIRED', dColor,
      doc.splitTextToSize('Remedy: ' + result.diseaseInfo.treatment, col - 20), false);
  } else {
    section('Disease Status', 'HEALTHY', green,
      ['No active diseases identified based on your inputs.'], false);
    section('Treatment & Prevention', 'SAFE', teal,
      ['Monitor crop regularly and follow yield optimization tips above.'], false);
  }

  // Footer
  doc.setFillColor(...green);
  doc.rect(0, 285, W, 12, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text('Agri Vision India  |  support@agrivisionindia.com  |  +91 123456789  |  Bengaluru, Karnataka',
    W / 2, 292.5, { align: 'center' });
  doc.text('© ' + new Date().getFullYear() + ' Agri Vision India. All Rights Reserved.',
    W / 2, 297, { align: 'center' });

  return doc;
}

// ─── EMAIL VIA EMAILJS ────────────────────────────────────────────────────────
async function sendReportEmail(user, crop, symptom, result) {
  const name  = user.fullName || user.username || 'Farmer';
  const email = user.email || user.username || '';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const templateParams = {
    to_name:       name,
    to_email:      email,
    crop:          crop,
    symptom_label: symptomLabels[symptom] || symptom,
    soil:          result.soil,
    yield_tip:     result.yieldTip,
    disease:       result.diseaseInfo ? result.diseaseInfo.name : 'None — Healthy crop',
    treatment:     result.diseaseInfo ? result.diseaseInfo.treatment : 'Keep up good agricultural practices.',
    report_date:   today
  };

  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function main() {
  const user = requireAuth();
  if (!user) return;
  $('#userPill').textContent = user.fullName || user.username || 'Farmer';

  $('#logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('agrivision_user');
    window.location.href = 'index.html';
  });

  $('#imageFile').addEventListener('change', () => {
    if ($('#imageFile').files.length > 0) {
      alert('Visual Upload Received. AI scanning simulated. Please select your crop below to see results.');
    }
  });

  $('#resetBtn').addEventListener('click', () => {
    $('#inputsForm').reset();
    $('#soilResult').textContent      = 'Select a crop to see soil requirements.';
    $('#yieldResult').textContent     = 'Select a crop for yield-boosting tips.';
    $('#diseaseResult').textContent   = 'No symptoms reported.';
    $('#treatmentResult').textContent = 'Keep maintaining good agricultural practices.';
    setChip($('#soilChip'), 'Waiting');
    setChip($('#yieldChip'), 'Waiting');
    setChip($('#diseaseChip'), 'Healthy', 'ok');
    setChip($('#treatmentChip'), '-');
    const bar = $('#reportBar');
    if (bar) bar.style.display = 'none';
    window._lastReport = null;
  });

  $('#inputsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const crop    = $('#inputsForm').elements.crop.value;
    const symptom = $('#inputsForm').elements.symptom.value;
    if (!crop) { alert('Please select a Crop.'); return; }

    const result = analyzeCrop(crop, symptom);

    setChip($('#soilChip'), 'Ideal', 'ok');
    $('#soilResult').innerHTML = '<strong>Terrain & Soil:</strong> ' + result.soil;

    setChip($('#yieldChip'), 'Pro Tip', 'ok');
    $('#yieldResult').innerHTML = '<strong>Maximize Output:</strong> ' + result.yieldTip;

    if (result.diseaseInfo) {
      setChip($('#diseaseChip'), 'Alert', result.diseaseInfo.danger);
      $('#diseaseResult').innerHTML = '<strong>Detected:</strong> ' + result.diseaseInfo.name;
      setChip($('#treatmentChip'), 'Action Required', result.diseaseInfo.danger);
      $('#treatmentResult').innerHTML = '<strong>Remedy:</strong> ' + result.diseaseInfo.treatment;
    } else {
      setChip($('#diseaseChip'), 'Healthy', 'ok');
      $('#diseaseResult').innerHTML = 'No active diseases identified based on inputs.';
      setChip($('#treatmentChip'), 'Safe', 'ok');
      $('#treatmentResult').innerHTML = 'Monitor crop regularly and follow yield optimization tips.';
    }

    window._lastReport = { user, crop, symptom, result };
    const bar = $('#reportBar');
    if (bar) bar.style.display = 'flex';
  });

  // Download PDF
  $('#downloadPdfBtn').addEventListener('click', () => {
    const r = window._lastReport;
    if (!r) return;
    const doc = generatePDF(r.user, r.crop, r.symptom, r.result);
    doc.save('AgriVision_Report_' + r.crop + '_' + Date.now() + '.pdf');
  });

  // Email PDF summary
  $('#emailPdfBtn').addEventListener('click', async () => {
    const r = window._lastReport;
    if (!r) return;

    const email = r.user.email || r.user.username || '';
    if (!email.includes('@')) {
      alert('No valid email found in your account. Please re-register with an email address.');
      return;
    }

    const btn = $('#emailPdfBtn');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      await sendReportEmail(r.user, r.crop, r.symptom, r.result);
      btn.textContent = '✓ Sent to ' + email;
      setTimeout(() => { btn.textContent = 'Email Report'; btn.disabled = false; }, 4000);
    } catch (err) {
      console.error('EmailJS error:', err);
      btn.textContent = 'Email Report';
      btn.disabled = false;
      alert('Could not send email.\n\nMake sure you have replaced the EmailJS keys in dashboard.js.\n\n' + (err.text || err.message || JSON.stringify(err)));
    }
  });
}

main();