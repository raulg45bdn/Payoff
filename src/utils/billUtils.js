export const BILL_CATEGORIES = [
  'Auto',
  'Insurance',
  'Loans',
  'Utilities',
  'Subscriptions',
  'Health',
  'Other',
];

const CATEGORY_META = {
  Auto:          { icon: '🚗', color: '#007AFF' },
  Insurance:     { icon: '🛡️', color: '#5856D6' },
  Loans:         { icon: '🏦', color: '#FF9F0A' },
  Utilities:     { icon: '⚡', color: '#FFD60A' },
  Subscriptions: { icon: '📱', color: '#30D158' },
  Health:        { icon: '❤️', color: '#FF453A' },
  Other:         { icon: '📌', color: '#8E8E93' },
};

export function getCategoryIcon(category) {
  return CATEGORY_META[category]?.icon ?? '📌';
}

export function getCategoryColor(category) {
  return CATEGORY_META[category]?.color ?? '#8E8E93';
}

/** The amount that counts this month (variable override or base amount). */
export function effectiveAmount(bill) {
  return bill.variableAmountThisMonth ?? bill.amount;
}
