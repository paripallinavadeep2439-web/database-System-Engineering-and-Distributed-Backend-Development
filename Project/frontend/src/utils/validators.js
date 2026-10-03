export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+]?[\d\s-]{10,15}$/;

export function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== ""
    ? null
    : "This field is required";
}

export function email(value) {
  if (!value) return null;
  return EMAIL_RE.test(value) ? null : "Enter a valid email address";
}

export function phone(value) {
  if (!value) return null;
  return PHONE_RE.test(value) ? null : "Enter a valid phone number";
}

export function minLen(len) {
  return (value) =>
    !value || String(value).length >= len ? null : `Must be at least ${len} characters`;
}

export function nonNegative(value) {
  if (!value && value !== 0) return null;
  const num = Number(value);
  return num >= 0 ? null : "Cannot be negative";
}

export function positive(value) {
  if (!value && value !== 0) return null;
  const num = Number(value);
  return num > 0 ? null : "Must be greater than zero";
}

export function validate(rules, values) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = values[field];
    for (const rule of fieldRules) {
      const err = rule(value);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  }
  return errors;
}
