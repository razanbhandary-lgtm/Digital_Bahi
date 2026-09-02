const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('index.html');
  mainWindow.setTitle('Digital Bahi');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Data file paths
const dataPath = path.join(__dirname, 'data');
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);

const CUSTOMERS_FILE = path.join(dataPath, 'customers.json');
const TRANSACTIONS_FILE = path.join(dataPath, 'transactions.json');
const SOIL_FILE = path.join(dataPath, 'soil-data.json');
const TRACTOR_FILE = path.join(dataPath, 'tractor-data.json');

// Initialize default data
function initData() {
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(SOIL_FILE)) {
    fs.writeFileSync(SOIL_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(TRACTOR_FILE)) {
    fs.writeFileSync(TRACTOR_FILE, JSON.stringify({
      ratePerHour: 800,
      name: 'My Tractor',
      owner: 'Owner Name'
    }));
  }
}
initData();

// IPC Handlers
ipcMain.handle('get-customers', () => {
  return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
});

ipcMain.handle('save-customer', (event, customer) => {
  const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
  customers.push(customer);
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
  return { success: true };
});

ipcMain.handle('update-customer', (event, updatedCustomer) => {
  let customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
  const index = customers.findIndex(c => c.id === updatedCustomer.id);
  if (index !== -1) {
    customers[index] = updatedCustomer;
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('get-transactions', () => {
  return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
});

ipcMain.handle('save-transaction', (event, transaction) => {
  const transactions = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
  transactions.push(transaction);
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  
  // Update customer balance
  const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
  const customer = customers.find(c => c.id === transaction.customerId);
  if (customer) {
    customer.balance = (customer.balance || 0) + transaction.amount;
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
  }
  return { success: true };
});

ipcMain.handle('get-soil-data', () => {
  return JSON.parse(fs.readFileSync(SOIL_FILE, 'utf8'));
});

ipcMain.handle('save-soil-entry', (event, entry) => {
  const data = JSON.parse(fs.readFileSync(SOIL_FILE, 'utf8'));
  data.push(entry);
  fs.writeFileSync(SOIL_FILE, JSON.stringify(data, null, 2));
  return { success: true };
});

ipcMain.handle('get-tractor-data', () => {
  return JSON.parse(fs.readFileSync(TRACTOR_FILE, 'utf8'));
});

ipcMain.handle('update-tractor-rate', (event, rate) => {
  const data = JSON.parse(fs.readFileSync(TRACTOR_FILE, 'utf8'));
  data.ratePerHour = rate;
  fs.writeFileSync(TRACTOR_FILE, JSON.stringify(data, null, 2));
  return { success: true };
});
