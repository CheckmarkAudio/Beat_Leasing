// app.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// ─── Firebase Configuration & Initialization ─────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyCarCLcVjERgmn0hOAoh3iN3poOIo9Zxsg",
  authDomain: "beat-leasing.firebaseapp.com",
  projectId: "beat-leasing",
  storageBucket: "beat-leasing.appspot.com",
  messagingSenderId: "881274422822",
  appId: "1:881274422822:web:3d3913844fd839962048e7",
  measurementId: "G-GY4Y2HWY4J"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getFirestore(app);

// ─── Default Configuration ────────────────────────────────────────────────────

const leaseMakerConfig = {
  banner: '',
  producerName: '',
  adminPassword: 'Checkmark Audio',
  tiers: [
    { id: 'mp3', name: 'MP3 Lease', usage: 'Up to 10,000 streams, 1 video, credit & non-exclusive', price: '$30' },
    { id: 'wav', name: 'WAV Lease', usage: 'Up to 50,000 streams, 2 videos, stems unavailable', price: '$60' },
    { id: 'unlimited', name: 'Unlimited Lease', usage: 'Unlimited streams & sales, non-exclusive', price: '$150' },
    { id: 'exclusive', name: 'Exclusive Rights', usage: 'Sole license, unlimited use', price: '$800' }
  ],
  agreements: {
    mp3: `MP3 Lease Agreement

1. Grant of License: Non-exclusive, personal use license...
2. Up to 10,000 streams, one video.
3. Non-exclusive rights.`,
    wav: `WAV Lease Agreement

1. Grant of License: Non-exclusive, high-quality audio...
2. Up to 50,000 streams, two videos.
3. Stems not included.`,
    unlimited: `Unlimited Lease Agreement

1. Grant of License: Non-exclusive, unlimited use...
2. Includes stems.
3. Producer retains publishing rights.`,
    exclusive: `Exclusive Rights Agreement

1. Grant of License: Exclusive, worldwide rights...
2. All media uses.
3. No further licenses.`
  }
};

// simple obfuscation for admin password check
const secretEnc = 'MTMyNDM1NDY1NzY4Nzk=';

// ─── Firestore Helpers ────────────────────────────────────────────────────────

async function loadConfig() {
  const ref = doc(db, 'leasing', 'config');
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  await setDoc(ref, leaseMakerConfig);
  return leaseMakerConfig;
}

async function saveConfig(cfg) {
  return setDoc(doc(db, 'leasing', 'config'), cfg);
}

async function loadOrders() {
  const snap = await getDocs(collection(db, 'leasing', 'orders', 'items'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addOrder(order) {
  return addDoc(collection(db, 'leasing', 'orders', 'items'), order);
}

async function updateOrder(id, data) {
  return updateDoc(doc(db, 'leasing', 'orders', 'items', id), data);
}

async function resetAll() {
  await deleteDoc(doc(db, 'leasing', 'config'));
  const snaps = await getDocs(collection(db, 'leasing', 'orders', 'items'));
  await Promise.all(snaps.docs.map(d => deleteDoc(d.ref)));
}

// ─── DOM References ───────────────────────────────────────────────────────────

const setupDiv  = document.getElementById('setup');
const widgetDiv = document.getElementById('widget');
let cfg;  // will hold the loaded configuration

// ─── Initialization ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  cfg = await loadConfig();

  if (!cfg.producerName) {
    // Show setup screen
    setupDiv.classList.remove('hidden');
    widgetDiv.classList.add('hidden');

    document.getElementById('saveSetup').onclick = async () => {
      cfg.banner       = document.getElementById('bannerURL').value;
      cfg.producerName = document.getElementById('producerName').value || leaseMakerConfig.producerName;
      await saveConfig(cfg);
      location.reload();
    };

  } else {
    // Show main widget
    setupDiv.classList.add('hidden');
    widgetDiv.classList.remove('hidden');
    initWidget();
  }
});

// ─── Render Helpers ────────────────────────────────────────────────────────────

async function renderNotification() {
  const pending = (await loadOrders()).filter(o => !o.completed).length;
  const n = document.getElementById('notification');
  if (pending) {
    n.textContent = `You have ${pending} pending orders`;
    n.style.display = 'block';
  } else {
    n.style.display = 'none';
  }
}

async function renderOrders() {
  const pendingList   = document.getElementById('pendingOrders');
  const completedList = document.getElementById('completedOrders');
  pendingList.innerHTML   = '';
  completedList.innerHTML = '';

  (await loadOrders()).forEach(o => {
    const li = document.createElement('li');
    li.textContent = `${new Date(o.date).toLocaleString()} | ${o.beat} | ${o.tier} | ${o.email}`;

    if (!o.completed) {
      const btn = document.createElement('button');
      btn.textContent = 'Mark Complete';
      btn.className   = 'mark-btn';
      btn.onclick = async () => {
        await updateOrder(o.id, { completed: true });
        renderOrders();
        renderNotification();
      };
      li.appendChild(btn);
      pendingList.appendChild(li);
    } else {
      completedList.appendChild(li);
    }
  });
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

function generatePDF(id) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  const tier = cfg.tiers.find(t => t.id === id);

  doc.setFontSize(16);
  doc.text(`${tier.name} Agreement`, 20, y);
  y += 10;

  doc.setFontSize(11);
  const text = cfg.agreements[id]
    .replace(/{{producer}}/g, cfg.producerName);
  const lines = doc.splitTextToSize(text, 170);

  lines.forEach(line => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 7;
  });

  doc.save(`${id}-agreement.pdf`);
}

// ─── UI Population ────────────────────────────────────────────────────────────

function populateTiers() {
  const container = document.getElementById('tiersContainer');
  container.innerHTML = '';

  cfg.tiers.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tier';
    div.innerHTML = `
      <label>
        <input type="radio" name="tier" value="${t.id}"/>
        <strong>${t.name}</strong>
      </label>
      <div>${t.usage}</div>
      <div>Price: <strong>${t.price}</strong></div>
      <button class="download-btn" data-tier="${t.id}">Download Agreement</button>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll('input[name="tier"]').forEach(radio => {
    radio.onchange = () => {
      document.querySelectorAll('.download-btn').forEach(b => b.style.display = 'none');
      const btn = document.querySelector(`.download-btn[data-tier="${radio.value}"]`);
      if (btn) btn.style.display = 'block';
    };
  });

  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.onclick = () => generatePDF(btn.dataset.tier);
  });
}

function populatePricingEditor() {
  const pc = document.getElementById('pricingContainer');
  pc.innerHTML = '';
  cfg.tiers.forEach(t => {
    const d = document.createElement('div');
    d.innerHTML = `
      <label>
        ${t.name} Price:
        <input type="text" id="price_${t.id}" value="${t.price}"/>
      </label>
    `;
    pc.appendChild(d);
  });
}

function populateAgreementEditor() {
  const sel = document.getElementById('editTierSelect');
  sel.innerHTML = '';
  cfg.tiers.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    document.getElementById('agreementEditor').value = cfg.agreements[sel.value];
  };
  sel.dispatchEvent(new Event('change'));
}

// ─── Main Widget Setup ────────────────────────────────────────────────────────

async function initWidget() {
  // Banner
  const img = document.getElementById('bannerImg');
  if (cfg.banner) {
    img.src           = cfg.banner;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }
  document.getElementById('bannerAdminURL').value = cfg.banner;
  document.getElementById('brandName').textContent  = cfg.producerName;

  // Render tiers & notifications
  populateTiers();
  await renderNotification();

  // Submit / Continue button
  document.getElementById('continueBtn').onclick = async () => {
    const email = document.getElementById('emailInput').value;
    const beat  = document.getElementById('beatTitle').value;
    const sel   = document.querySelector('input[name="tier"]:checked');
    const secret = atob(secretEnc);

    // Admin login
    if (email === secret || email === cfg.adminPassword) {
      document.getElementById('adminPanel').style.display = 'block';
      await renderOrders();
      populateAgreementEditor();
      populatePricingEditor();
      return;
    }

    // New order
    if (!email || !beat || !sel) {
      return alert('Select tier, enter beat and email.');
    }
    await addOrder({
      date:     new Date().toISOString(),
      beat,
      tier:     sel.value,
      email,
      completed: false
    });
    alert('Order received!');
    document.getElementById('beatTitle').value = '';
    document.getElementById('emailInput').value = '';
    document.querySelectorAll('input[name="tier"]').forEach(i => i.checked = false);
    document.querySelectorAll('.download-btn').forEach(b => b.style.display = 'none');
    await renderNotification();
  };

  // Pending / Completed toggles
  document.getElementById('viewPendingBtn').onclick = () => {
    const p = document.getElementById('pendingOrders');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
    document.getElementById('completedOrders').style.display = 'none';
  };
  document.getElementById('viewCompletedBtn').onclick = () => {
    const c = document.getElementById('completedOrders');
    c.style.display = c.style.display === 'block' ? 'none' : 'block';
    document.getElementById('pendingOrders').style.display = 'none';
  };

  // Toggle editors
  document.getElementById('toggleAgreementBtn').onclick = () => {
    const s = document.getElementById('agreementSection');
    s.style.display = s.style.display === 'block' ? 'none' : 'block';
  };
  document.getElementById('togglePricingBtn').onclick = () => {
    const s = document.getElementById('pricingSection');
    s.style.display = s.style.display === 'block' ? 'none' : 'block';
  };

  // Save actions
  document.getElementById('saveAgreementBtn').onclick = async () => {
    const id = document.getElementById('editTierSelect').value;
    cfg.agreements[id] = document.getElementById('agreementEditor').value;
    await saveConfig(cfg);
    alert('Agreement updated.');
  };

  document.getElementById('savePricingBtn').onclick = async () => {
    cfg.tiers.forEach(t => {
      t.price = document.getElementById(`price_${t.id}`).value;
    });
    await saveConfig(cfg);
    alert('Pricing updated.');
    populateTiers();
  };

  document.getElementById('saveBannerBtn').onclick = async () => {
    cfg.banner = document.getElementById('bannerAdminURL').value;
    document.getElementById('bannerImg').src = cfg.banner;
    await saveConfig(cfg);
    alert('Banner updated.');
  };

  document.getElementById('saveAdmin').onclick = async () => {
    const np = document.getElementById('newAdminPassword').value;
    if (np) {
      cfg.adminPassword = np;
      await saveConfig(cfg);
      alert('Password updated.');
      document.getElementById('newAdminPassword').value = '';
    }
  };

  document.getElementById('resetBtn').onclick = async () => {
    const pw = prompt('Enter admin password to reset:');
    if (pw === cfg.adminPassword) {
      await resetAll();
      location.reload();
    } else {
      alert('Incorrect password.');
    }
  };
}
