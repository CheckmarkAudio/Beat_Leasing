// app.js

// ─── Firebase SDK Imports ─────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAnalytics }  from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js';
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

// Debug: confirm module load and leaseId
console.log(
  '✔️ app.js loaded, leaseId =',
  new URLSearchParams(window.location.search).get('leaseId') || 'default'
);

// ─── Instance Identifier ─────────────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const leaseId = params.get('leaseId') || 'default';  // e.g. "TigerBeatz"

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
const app       = initializeApp(firebaseConfig);
getAnalytics(app);
const db        = getFirestore(app);

// ─── Default Configuration Data ─────────────────────────────────────────────
const leaseMakerConfig = {
  banner: '',
  producerName: '',
  adminPassword: 'Checkmark Audio',
  tiers: [
    { id: 'mp3',       name: 'MP3 Lease',       usage: 'Up to 10,000 streams, 1 video, credit & non-exclusive', price: '$30'  },
    { id: 'wav',       name: 'WAV Lease',       usage: 'Up to 50,000 streams, 2 videos, stems unavailable',      price: '$60'  },
    { id: 'unlimited', name: 'Unlimited Lease', usage: 'Unlimited streams & sales, non-exclusive',              price: '$150' },
    { id: 'exclusive', name: 'Exclusive Rights', usage: 'Sole license, unlimited use',                            price: '$800' }
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
const secretEnc = 'MTMyNDM1NDY1NzY4Nzk=';  // Base64 for admin-password check

// ─── Firestore Helper Functions ─────────────────────────────────────────────
async function loadConfig() {
  // Path: leasing/{leaseId}
  const ref  = doc(db, 'leasing', leaseId);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  await setDoc(ref, leaseMakerConfig);
  return leaseMakerConfig;
}

async function saveConfig(cfg) {
  // Path: leasing/{leaseId}
  return setDoc(doc(db, 'leasing', leaseId), cfg);
}

async function loadOrders() {
  // Path: leasing/{leaseId}/orders/items
  const snap = await getDocs(collection(db, 'leasing', leaseId, 'orders', 'items'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addOrder(order) {
  return addDoc(collection(db, 'leasing', leaseId, 'orders', 'items'), order);
}

async function updateOrder(id, data) {
  return updateDoc(doc(db, 'leasing', leaseId, 'orders', 'items', id), data);
}

async function resetAll() {
  // Delete the config document itself
  await deleteDoc(doc(db, 'leasing', leaseId));
  // Then delete all order items
  const snaps = await getDocs(collection(db, 'leasing', leaseId, 'orders', 'items'));
  await Promise.all(snaps.docs.map(d => deleteDoc(d.ref)));
}

// ─── DOM References & App Initialization ────────────────────────────────────
const setupDiv  = document.getElementById('setup');
const widgetDiv = document.getElementById('widget');
let cfg;

document.addEventListener('DOMContentLoaded', async () => {
  cfg = await loadConfig();

  if (!cfg.producerName) {
    setupDiv.classList.remove('hidden');
    widgetDiv.classList.add('hidden');
    document.getElementById('saveSetup').onclick = async () => {
      cfg.banner       = document.getElementById('bannerURL').value;
      cfg.producerName = document.getElementById('producerName').value || leaseMakerConfig.producerName;
      await saveConfig(cfg);
      location.reload();
    };
  } else {
    setupDiv.classList.add('hidden');
    widgetDiv.classList.remove('hidden');
    initWidget();
  }
});

// ─── Notification & Order Rendering ─────────────────────────────────────────
async function renderNotification() {
  const pending = (await loadOrders()).filter(o => !o.completed).length;
  const n       = document.getElementById('notification');
  n.textContent   = pending ? `You have ${pending} pending orders` : '';
  n.style.display = pending ? 'block' : 'none';
}

async function renderOrders() {
  const pList = document.getElementById('pendingOrders');
  const cList = document.getElementById('completedOrders');
  pList.innerHTML = '';
  cList.innerHTML = '';

  (await loadOrders()).forEach(o => {
    const li = document.createElement('li');
    const paymentStatus = o.payment?.status || (o.completed ? 'fulfilled' : 'pending');
    const fulfillment   = o.fulfillment?.status || (o.completed ? 'delivered' : 'awaiting');
    li.innerHTML = `
      <div><strong>${o.beatMetadata?.title || o.beat}</strong> | ${o.tier} | ${o.email}</div>
      <div>${new Date(o.date).toLocaleString()}</div>
      <div>Payment: <strong>${paymentStatus}</strong> ${o.payment?.transactionId ? `(#${o.payment.transactionId})` : ''}</div>
      <div>Fulfillment: <strong>${fulfillment}</strong></div>
    `;
    if (!o.completed) {
      const paymentBtn = document.createElement('button');
      paymentBtn.textContent = 'Mark Payment Received';
      paymentBtn.className   = 'mark-btn';
      paymentBtn.onclick = async () => {
        const tx = prompt('Enter transaction ID (Stripe/PayPal):', o.payment?.transactionId || '');
        await updateOrder(o.id, { payment: { ...(o.payment || {}), status: 'succeeded', transactionId: tx || crypto.randomUUID() } });
        renderOrders();
        renderNotification();
      };

      const fulfillBtn = document.createElement('button');
      fulfillBtn.textContent = 'Mark Fulfilled';
      fulfillBtn.className   = 'mark-btn';
      fulfillBtn.onclick = async () => {
        await updateOrder(o.id, { fulfillment: { ...(o.fulfillment || {}), status: 'delivered' }, completed: true });
        renderOrders();
        renderNotification();
      };
      li.appendChild(paymentBtn);
      li.appendChild(fulfillBtn);
      pList.appendChild(li);
    } else {
      cList.appendChild(li);
    }
  });
}

// ─── PDF Generation ───────────────────────────────────────────────────────────
function generatePDF(id) {
  const { jsPDF } = window.jspdf;
  const doc       = new jsPDF();
  let y           = 20;

  doc.setFontSize(16);
  doc.text(`${cfg.tiers.find(t => t.id === id).name} Agreement`, 20, y);
  y += 10;
  doc.setFontSize(11);

  cfg.agreements[id].split('\n').forEach(line => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(line.replace(/{{producer}}/g, cfg.producerName), 20, y);
    y += 7;
  });

  doc.save(`${id}-agreement.pdf`);
}

// ─── UI Population ────────────────────────────────────────────────────────────
function populateTiers() {
  const c = document.getElementById('tiersContainer');
  c.innerHTML = '';

  cfg.tiers.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tier';
    div.innerHTML = `
      <label>
        <input type="radio" name="tier" value="${t.id}" />
        <strong>${t.name}</strong>
      </label>
      <div>${t.usage}</div>
      <div>Price: <strong>${t.price}</strong></div>
      <button class="download-btn" data-tier="${t.id}">Download Agreement</button>
    `;
    c.appendChild(div);
  });

  document.querySelectorAll('input[name="tier"]').forEach(r => {
    r.onchange = () => {
      document.querySelectorAll('.download-btn').forEach(b => b.style.display = 'none');
      const b = document.querySelector(`.download-btn[data-tier="${r.value}"]`);
      if (b) b.style.display = 'block';
    };
  });

  document.querySelectorAll('.download-btn').forEach(b => {
    b.onclick = () => generatePDF(b.dataset.tier);
  });
}

function populatePricingEditor() {
  const pc = document.getElementById('pricingContainer');
  pc.innerHTML = '';
  cfg.tiers.forEach(t => {
    const d = document.createElement('div');
    d.innerHTML = `<label>${t.name} Price:<input type="text" id="price_${t.id}" value="${t.price}" /></label>`;
    pc.appendChild(d);
  });
}

function populateAgreementEditor() {
  const sel = document.getElementById('editTierSelect');
  sel.innerHTML = '';
  cfg.tiers.forEach(t => sel.appendChild(new Option(t.name, t.id)));
  sel.onchange = () => {
    document.getElementById('agreementEditor').value = cfg.agreements[sel.value];
  };
  sel.dispatchEvent(new Event('change'));
}

// ─── Main Widget Initialization ───────────────────────────────────────────────
async function initWidget() {
  const img = document.getElementById('bannerImg');
  if (cfg.banner) {
    img.src           = cfg.banner;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }
  document.getElementById('bannerAdminURL').value = cfg.banner;
  document.getElementById('brandName').textContent  = cfg.producerName;

  populateTiers();
  await renderNotification();

  document.getElementById('continueBtn').onclick = async () => {
    const email = document.getElementById('emailInput').value.trim();
    const beat  = document.getElementById('beatTitle').value.trim();
    const isrc  = document.getElementById('isrcInput').value.trim();
    const upc   = document.getElementById('upcInput').value.trim();
    const fileLinks = document.getElementById('fileLinksInput').value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const sel   = document.querySelector('input[name="tier"]:checked');
    const secret= atob(secretEnc);

    // Admin login
    if (email === secret || email === cfg.adminPassword) {
      document.getElementById('adminPanel').style.display = 'block';
      await renderOrders();
      populateAgreementEditor();
      populatePricingEditor();
      return;
    }

    // New order
    if (!beat || !sel || !email) {
      return alert('Select tier, enter beat and email.');
    }

    const checkoutSessionId = `sess_${Math.random().toString(36).slice(2)}`;
    const transactionId     = `txn_${Math.random().toString(36).slice(2)}`;

    await addOrder({
      date: new Date().toISOString(),
      beat,
      beatMetadata: { title: beat, isrc, upc, fileLinks },
      tier: sel.value,
      email,
      payment: { processor: 'stripe', status: 'pending', checkoutSessionId, transactionId },
      fulfillment: { status: 'awaiting', secureLinks: fileLinks },
      completed: false
    });

    alert('Checkout session created! Complete payment via the processor to finalize delivery.');
    document.getElementById('beatTitle').value = '';
    document.getElementById('emailInput').value = '';
    document.getElementById('isrcInput').value = '';
    document.getElementById('upcInput').value  = '';
    document.getElementById('fileLinksInput').value = '';
    document.querySelectorAll('input[name="tier"]').forEach(i => i.checked = false);
    document.querySelectorAll('.download-btn').forEach(b => b.style.display = 'none');
    await renderNotification();
  };

  document.getElementById('viewHistoryBtn').onclick = async () => {
    const email = document.getElementById('historyEmail').value.trim();
    const list  = document.getElementById('orderHistoryList');
    list.innerHTML = '';
    if (!email) return;
    const orders = (await loadOrders()).filter(o => (o.email || '').toLowerCase() === email.toLowerCase());
    if (!orders.length) {
      list.innerHTML = '<li>No orders found for this email.</li>';
      return;
    }
    orders.forEach(o => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${o.beatMetadata?.title || o.beat}</strong> (${o.tier}) - Payment: ${o.payment?.status || 'pending'};
        Fulfillment: ${o.fulfillment?.status || (o.completed ? 'delivered' : 'pending')}
      `;
      list.appendChild(li);
    });
  };

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

  document.getElementById('toggleAgreementBtn').onclick = () => {
    const s = document.getElementById('agreementSection');
    s.style.display = s.style.display === 'block' ? 'none' : 'block';
  };
  document.getElementById('togglePricingBtn').onclick = () => {
    const s = document.getElementById('pricingSection');
    s.style.display = s.style.display === 'block' ? 'none' : 'block';
  };

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
      alert('Admin password updated.');
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
