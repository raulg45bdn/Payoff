const MAX_IMPORT_BYTES = 1_000_000; // 1 MB hard cap

const REQUIRED_CARD_FIELDS = ['id', 'name', 'balance', 'apr', 'monthlyPayment', 'dueDate'];
const REQUIRED_BILL_FIELDS = ['name', 'amount', 'dueDate'];
const REQUIRED_SETTINGS_FIELDS = ['monthlyIncome'];

/**
 * Validates a parsed backup object before it is applied to the app.
 * Returns { valid: boolean, error: string | null }
 */
export function validateImportData(raw) {
  // Size guard — check the serialized size before doing anything else
  const serialized = JSON.stringify(raw);
  if (serialized.length > MAX_IMPORT_BYTES) {
    return { valid: false, error: 'Backup file exceeds 1 MB. The file may be corrupt.' };
  }

  // Must be a plain object
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid backup format.' };
  }

  // Must have cards array
  if (!Array.isArray(raw.cards)) {
    return { valid: false, error: 'Backup is missing the cards list.' };
  }

  // Must have fixedBills array (top-level in v7+)
  if (!Array.isArray(raw.fixedBills)) {
    return { valid: false, error: 'Backup is missing the bills list.' };
  }

  // Each card must have required fields
  for (const card of raw.cards) {
    for (const field of REQUIRED_CARD_FIELDS) {
      if (card[field] === undefined) {
        return {
          valid: false,
          error: `Card "${card.name ?? 'unknown'}" is missing the field "${field}". The backup may be from an incompatible version.`,
        };
      }
    }
  }

  // Each bill must have minimum required fields
  for (const bill of raw.fixedBills) {
    for (const field of REQUIRED_BILL_FIELDS) {
      if (bill[field] === undefined || bill[field] === null) {
        return {
          valid: false,
          error: `Bill "${bill.name ?? 'unknown'}" is missing the field "${field}". The backup may be from an incompatible version.`,
        };
      }
    }
  }

  // Must have settings object
  if (!raw.settings || typeof raw.settings !== 'object') {
    return { valid: false, error: 'Backup is missing settings.' };
  }

  // Settings must have required fields
  for (const field of REQUIRED_SETTINGS_FIELDS) {
    if (raw.settings[field] === undefined) {
      return {
        valid: false,
        error: `Settings are missing the field "${field}". The backup may be from an incompatible version.`,
      };
    }
  }

  return { valid: true, error: null };
}
