const { ipcRenderer } = require('electron');

// State
let customers = [];
let transactions = [];
let soilData = [];
let tractorData = {};
let editingCustomerId = null;

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabContents.forEach(tc => tc.classList.remove('active'));
    document.getElementById(tab.dataset.tab).classList.add('active');
    loadData();
  });
});

// Load all data
async function loadData() {
  customers = await ipcRenderer.invoke('get-customers');
  transactions = await ipcRenderer.invoke('get-transactions');
  soilData = await ipcRenderer.invoke('get-soil-data');
  tractorData = await ipcRenderer.invoke('get-tractor-data');
  
  updateDashboard();
  renderCustomers();
  renderTransactions();
  renderSoilRecords();
  renderTractors();
  populateDropdowns();
  updateTractorRateDisplay();
}

// Dashboard
function updateDashboard() {
  document.getElementById('total-customers').textContent = customers.length;
  
  let totalDue = 0;
  customers.forEach(c => {
    if (c.balance > 0) totalDue += c.balance;
  });
  document.getElementById('total-due').textContent = `₹${totalDue}`;
  
  const today = new Date().toDateString();
  const todayTx = transactions.filter(t => new Date(t.date).toDateString() === today);
  document.getElementById('today-transactions').textContent = todayTx.length;
  
  let totalSoil = 0;
  soilData.forEach(s => totalSoil += s.tons);
  document.getElementById('soil-remaining').textContent = totalSoil;
  
  // Recent activity
  const recent = transactions.slice(-5).reverse();
  const recentList = document.getElementById('recent-list');
  recentList.innerHTML = recent.map(t => `
    <div class="transaction-item">
      <span>${t.customerName || 'Unknown'} - ${t.type}</span>
      <span class="amount ${t.amount >= 0 ? 'credit' : 'debit'}">₹${t.amount}</span>
    </div>
  `).join('');
}

// Customers
function renderCustomers(filter = '') {
  const container = document.getElementById('customer-list');
  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(filter.toLowerCase())
  );
  
  container.innerHTML = filtered.map(c => `
    <div class="customer-card" onclick="openCustomer('${c.id}')">
      ${c.photo ? `<img src="${c.photo}" alt="${c.name}">` : `<div style="width:60px;height:60px;border-radius:50%;background:#e8eaf6;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">👤</div>`}
      <div class="info">
        <div class="name">${c.name}</div>
        <div>${c.village || ''} | ${c.phone || ''}</div>
        <div class="balance ${c.balance > 0 ? '' : 'positive'}">Due: ₹${c.balance || 0}</div>
      </div>
    </div>
  `).join('');
}

function filterCustomers() {
  const search = document.getElementById('customer-search').value;
  renderCustomers(search);
}

function showAddCustomer() {
  editingCustomerId = null;
  document.getElementById('modal-title').textContent = 'Add Customer';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-village').value = '';
  document.getElementById('photo-preview').innerHTML = '';
  document.getElementById('customer-modal').style.display = 'flex';
}

function openCustomer(id) {
  const c = customers.find(c => c.id === id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById('modal-title').textContent = 'Edit Customer';
  document.getElementById('cust-name').value = c.name;
  document.getElementById('cust-phone').value = c.phone || '';
  document.getElementById('cust-village').value = c.village || '';
  if (c.photo) {
    document.getElementById('photo-preview').innerHTML = `<img src="${c.photo}">`;
  }
  document.getElementById('customer-modal').style.display = 'flex';
}

async function saveCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) return alert('Please enter name');
  
  const photoInput = document.getElementById('cust-photo');
  let photo = '';
  if (photoInput.files && photoInput.files[0]) {
    const reader = new FileReader();
    photo = await new Promise((resolve) => {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(photoInput.files[0]);
    });
  }
  
  const customer = {
    id: editingCustomerId || Date.now().toString(),
    name,
    phone: document.getElementById('cust-phone').value.trim(),
    village: document.getElementById('cust-village').value.trim(),
    photo,
    balance: 0
  };
  
  if (editingCustomerId) {
    const existing = customers.find(c => c.id === editingCustomerId);
    customer.balance = existing.balance;
    await ipcRenderer.invoke('update-customer', customer);
  } else {
    await ipcRenderer.invoke('save-customer', customer);
  }
  
  closeModal('customer-modal');
  loadData();
}

// Transactions
function populateDropdowns() {
  const customerSelect = document.getElementById('trans-customer');
  customerSelect.innerHTML = '<option value="">Select Customer</option>' + 
    customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  const soilOwnerSelect = document.getElementById('soil-owner');
  soilOwnerSelect.innerHTML = '<option value="">Select Tractor Owner</option>' + 
    customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function renderTransactions() {
  const container = document.getElementById('transaction-list');
  const reversed = [...transactions].reverse();
  container.innerHTML = reversed.map(t => `
    <div class="transaction-item">
      <div>
        <strong>${t.customerName || 'Unknown'}</strong>
        <span style="font-size:0.8rem;color:#666;"> - ${t.type} | ${t.date}</span>
        <div style="font-size:0.8rem;color:#888;">${t.notes || ''}</div>
      </div>
      <div>
        <span class="amount ${t.amount >= 0 ? 'credit' : 'debit'}">₹${t.amount}</span>
        <span style="font-size:0.8rem;color:#666;">Paid: ₹${t.paid || 0}</span>
      </div>
    </div>
  `).join('');
}

// Auto-calculate transaction amount
document.getElementById('trans-hours').addEventListener('input', calculateTransaction);
document.getElementById('trans-minutes').addEventListener('input', calculateTransaction);
document.getElementById('trans-type').addEventListener('change', calculateTransaction);

function calculateTransaction() {
  const hours = parseFloat(document.getElementById('trans-hours').value) || 0;
  const minutes = parseFloat(document.getElementById('trans-minutes').value) || 0;
  const totalHours = hours + (minutes / 60);
  const rate = parseFloat(document.getElementById('trans-rate').value) || tractorData.ratePerHour || 800;
  const amount = totalHours * rate;
  document.getElementById('trans-amount').value = Math.round(amount);
}

async function saveTransaction() {
  const customerId = document.getElementById('trans-customer').value;
  if (!customerId) return alert('Please select a customer');
  
  const type = document.getElementById('trans-type').value;
  const hours = parseFloat(document.getElementById('trans-hours').value) || 0;
  const minutes = parseFloat(document.getElementById('trans-minutes').value) || 0;
  const totalHours = hours + (minutes / 60);
  const rate = parseFloat(document.getElementById('trans-rate').value) || tractorData.ratePerHour || 800;
  const amount = totalHours * rate;
  const paid = parseFloat(document.getElementById('trans-paid').value) || 0;
  const notes = document.getElementById('trans-notes').value.trim();
  
  if (amount === 0) return alert('Please enter hours worked');
  
  const customer = customers.find(c => c.id === customerId);
  
  const transaction = {
    id: Date.now().toString(),
    customerId,
    customerName: customer.name,
    type,
    hours: totalHours,
    rate,
    amount: Math.round(amount),
    paid,
    balance: Math.round(amount - paid),
    notes,
    date: new Date().toISOString()
  };
  
  await ipcRenderer.invoke('save-transaction', transaction);
  
  // Clear form
  document.getElementById('trans-hours').value = '';
  document.getElementById('trans-minutes').value = '0';
  document.getElementById('trans-paid').value = '';
  document.getElementById('trans-notes').value = '';
  document.getElementById('trans-amount').value = '';
  
  loadData();
}

// Soil Records
async function saveSoilRecord() {
  const ownerId = document.getElementById('soil-owner').value;
  if (!ownerId) return alert('Please select tractor owner');
  
  const tons = parseFloat(document.getElementById('soil-tons').value);
  const rate = parseFloat(document.getElementById('soil-rate').value);
  const buyer = document.getElementById('soil-buyer').value.trim();
  const date = document.getElementById('soil-date').value || new Date().toISOString().split('T')[0];
  
  if (!tons || !rate) return alert('Please enter tons and rate');
  
  const entry = {
    id: Date.now().toString(),
    ownerId,
    ownerName: customers.find(c => c.id === ownerId)?.name || 'Unknown',
    tons,
    rate,
    total: tons * rate,
    buyer,
    date
  };
  
  await ipcRenderer.invoke('save-soil-entry', entry);
  document.getElementById('soil-tons').value = '';
  document.getElementById('soil-rate').value = '';
  document.getElementById('soil-buyer').value = '';
  loadData();
}

function renderSoilRecords() {
  const container = document.getElementById('soil-list');
  const reversed = [...soilData].reverse();
  container.innerHTML = reversed.map(s => `
    <div class="transaction-item">
      <div>
        <strong>${s.ownerName || 'Unknown'}</strong>
        <span style="font-size:0.8rem;color:#666;"> - ${s.tons} tons @ ₹${s.rate}/ton</span>
        <div style="font-size:0.8rem;color:#888;">Buyer: ${s.buyer || 'N/A'} | ${s.date}</div>
      </div>
      <span class="amount credit">₹${s.total}</span>
    </div>
  `).join('');
}

// Tractors
function renderTractors() {
  const container = document.getElementById('tractor-list');
  // Show all customers who have tractor data
  const tractorOwners = customers.filter(c => c.tractorRate);
  container.innerHTML = tractorOwners.map(c => `
    <div class="transaction-item">
      <div>
        <strong>${c.name}</strong>
        <span style="font-size:0.8rem;color:#666;"> - Rate: ₹${c.tractorRate}/hr</span>
        <div style="font-size:0.8rem;color:#888;">Soil: ${soilData.filter(s => s.ownerId === c.id).reduce((sum, s) => sum + s.tons, 0)} tons</div>
      </div>
    </div>
  `).join('');
}

async function saveTractor() {
  const name = document.getElementById('tractor-name').value.trim();
  const rate = parseFloat(document.getElementById('tractor-rate').value);
  if (!name || !rate) return alert('Please enter name and rate');
  
  // Find or create customer as tractor owner
  let owner = customers.find(c => c.name === name);
  if (!owner) {
    owner = {
      id: Date.now().toString(),
      name,
      phone: '',
      village: '',
      photo: '',
      balance: 0,
      tractorRate: rate
    };
    await ipcRenderer.invoke('save-customer', owner);
  } else {
    owner.tractorRate = rate;
    await ipcRenderer.invoke('update-customer', owner);
  }
  
  document.getElementById('tractor-name').value = '';
  document.getElementById('tractor-rate').value = '';
  loadData();
}

// Tractor Settings
function showTractorSettings() {
  document.getElementById('settings-rate').value = tractorData.ratePerHour || 800;
  document.getElementById('tractor-settings-modal').style.display = 'flex';
}

async function updateTractorSettings() {
  const rate = parseFloat(document.getElementById('settings-rate').value);
  if (!rate) return alert('Please enter valid rate');
  await ipcRenderer.invoke('update-tractor-rate', rate);
  closeModal('tractor-settings-modal');
  loadData();
}

function updateTractorRateDisplay() {
  document.getElementById('tractor-rate').textContent = `🚜 Rate: ₹${tractorData.ratePerHour || 800}/hr`;
}

// Modal helpers
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Close modal on outside clickwindow.onclick = (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
};

// Auto-set rate in transaction
document.getElementById('trans-type').addEventListener('change', () => {
  const type = document.getElementById('trans-type').value;
  if (type === 'tractor') {
    document.getElementById('trans-rate').value = tractorData.ratePerHour || 800;
  } else if (type === 'jcb') {
    document.getElementById('trans-rate').value = (tractorData.ratePerHour || 800) * 1.5; // JCB more expensive
  } else {
    document.getElementById('trans-rate').value = 0; // Soil handled separately
  }
  calculateTransaction();
});

// Initialize
loadData();
