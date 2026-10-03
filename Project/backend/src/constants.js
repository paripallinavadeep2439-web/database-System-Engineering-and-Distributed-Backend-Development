export const ROLES = Object.freeze({
  ADMIN: "Admin",
  INVENTORY_MANAGER: "Inventory Manager",
  PHARMACIST: "Pharmacist",
  SALES_STAFF: "Sales Staff",
  VIEWER: "Viewer",
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const SUPPLIER_STATUSES = Object.freeze(["Active", "On Hold", "Inactive"]);
export const USER_STATUSES = Object.freeze(["Active", "Inactive"]);
export const PURCHASE_STATUSES = Object.freeze(["Pending", "Partially Paid", "Paid"]);
export const SALE_STATUSES = Object.freeze(["Completed", "Refunded"]);
export const MEDICINE_CATEGORIES = Object.freeze([
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
]);

export const READ_ROLES = Object.freeze(ROLE_VALUES);
export const INVENTORY_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.PHARMACIST,
]);
export const TRANSACTION_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.PHARMACIST,
  ROLES.SALES_STAFF,
]);
export const ADMIN_ROLES = Object.freeze([ROLES.ADMIN]);
