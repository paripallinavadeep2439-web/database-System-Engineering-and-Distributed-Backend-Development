export const MEDICINE_CATEGORIES = [
  "Antibiotics",
  "Analgesics",
  "Cardiovascular",
  "Diabetes",
  "Gastrointestinal",
  "Respiratory",
  "Vitamins & Supplements",
  "Dermatological",
  "Neurology",
  "Antihistamine",
  "Other",
];

export const ROLES = ["Admin", "Inventory Manager", "Pharmacist", "Sales Staff", "Viewer"];

export const PAYMENT_STATUS = ["Paid", "Pending", "Partially Paid"];

export const REPORT_TYPES = {
  INVENTORY: "Inventory Report",
  SALES: "Sales Report",
  PURCHASE: "Purchase Report",
  EXPIRY: "Expiry Report",
  LOW_STOCK: "Low Stock Report",
  SUPPLIER: "Supplier Report",
};

export const CURRENCIES = ["INR ₹", "USD $", "EUR €"];

// Reasons offered for an inventory adjustment. Kept as a fixed list so the value
// recorded in the ledger is comparable across adjustments rather than free text.
export const REASONS = [
  "Expired stock write-off",
  "Damaged in storage",
  "Breakage reported during audit",
  "Short count correction",
  "Found stock during physical audit",
  "Returned to supplier",
  "Stock take reconciliation",
];

export const DATE_FORMATS = [
  { value: "en-IN", label: "DD MMM YYYY" },
  { value: "en-US", label: "MM/DD/YYYY" },
  { value: "en-GB", label: "DD/MM/YYYY" },
];

export const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export const DEFAULT_SETTINGS = {
  theme: "system",
  notifications: {
    lowStock: true,
    expiry: true,
    purchases: true,
    sales: true,
  },
  currency: "INR ₹",
  dateFormat: "en-IN",
  itemsPerPage: 10,
};

export const DATE_RANGES = [
  { value: "7D", label: "7D", days: 7 },
  { value: "30D", label: "30D", days: 30 },
  { value: "90D", label: "90D", days: 90 },
  { value: "6M", label: "6M", days: 182 },
  { value: "1Y", label: "1Y", days: 365 },
];
