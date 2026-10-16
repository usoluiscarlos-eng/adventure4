// Pure data operations shared by the application and regression tests.
const DEFAULT_ACCOUNTS = [
  { id: 'nubank', name: 'NuBank', type: 'banco', description: 'Ahorro', color: 'purple', yieldRate: 9.25 },
  { id: 'nequi', name: 'Nequi', type: 'billetera', description: 'Gastos digitales', color: 'pink', yieldRate: 0 },
  { id: 'efectivo', name: 'Efectivo', type: 'efectivo', description: 'Gastos diarios', color: 'emerald', yieldRate: 0 }
];
const DEFAULT_BALANCES = { nubank: 2360000, nequi: 0, efectivo: 0 };
const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const numberOrZero = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const newId = () => globalThis.crypto.randomUUID();
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function accountsFor(data) {
  // An explicit catalog is authoritative, including an empty one. Only legacy
  // documents without a catalog need recovery from balances and transactions.
  const source = Array.isArray(data.financeAccounts) ? data.financeAccounts : [...DEFAULT_ACCOUNTS];
  const accounts = new Map();
  source.forEach(a => { if (a && a.id && !accounts.has(a.id)) accounts.set(a.id, { type: 'banco', color: 'blue', yieldRate: 0, description: '', ...a }); });
  if (!Array.isArray(data.financeAccounts)) {
    const used = [...Object.keys(data.baseBalances || {}), ...(data.finances || []).flatMap(t => [t.account, t.toAccount])];
    used.filter(Boolean).forEach(id => { if (!accounts.has(id)) accounts.set(id, { id, name: id, type: 'banco', color: 'blue', yieldRate: 0, description: 'Cuenta recuperada' }); });
  }
  return [...accounts.values()];
}

function financeState(data) {
  return { financeAccounts: accountsFor(data), baseBalances: data.baseBalances ?? DEFAULT_BALANCES,
    finances: data.finances || [], debts: data.debts || [] };
}

function assertAccount(state, id) {
  if (!state.financeAccounts.some(a => a.id === id)) throw new Error('La cuenta ya no existe. Selecciona una cuenta vigente.');
}

function validateTransaction(state, item) {
  if (!['ingreso', 'egreso', 'transferencia'].includes(item.type)) throw new Error('Tipo de movimiento inválido.');
  if (!Number.isFinite(Number(item.amount)) || money(item.amount) <= 0) throw new Error('El importe debe ser un número mayor que cero.');
  if (!item.description?.trim() || !validDate(item.date)) throw new Error('Completa la descripción y una fecha válida.');
  assertAccount(state, item.account);
  if (item.type === 'transferencia') {
    assertAccount(state, item.toAccount);
    if (item.account === item.toAccount) throw new Error('La cuenta de origen y destino deben ser diferentes.');
  }
}

function saveTransaction(data, item) {
  const state = financeState(data);
  validateTransaction(state, item);
  const old = state.finances.find(t => t.id === item.id);
  if (old?.debtId || item.debtId) throw new Error('Para corregir un pago de deuda, elimina el movimiento y registra el pago nuevamente.');
  const saved = { ...item, amount: money(item.amount), description: item.description.trim(), toAccount: item.type === 'transferencia' ? item.toAccount : null };
  return { finances: old ? state.finances.map(t => t.id === item.id ? saved : t) : [saved, ...state.finances] };
}

function undoPayments(debts, removed, accountId) {
  return debts.map(debt => {
    const related = removed.filter(t => t.debtId === debt.id);
    const payments = debt.payments || [];
    const matched = new Set();
    related.forEach(t => {
      const index = payments.findIndex((p, i) => !matched.has(i) &&
        (t.paymentId === p.id || t.id === p.transactionId ||
        (!t.paymentId && !p.transactionId && t.account === p.account && t.date === p.date && Number(t.amount) === Number(p.amount))));
      if (index !== -1) matched.add(index);
    });
    const removedPayments = payments.filter((p, i) => matched.has(i) || (accountId !== undefined && p.account === accountId));
    // Legacy payments had independent IDs. Count each financial movement once;
    // for account deletion also include payments whose ledger entry was removed earlier.
    const amount = accountId
      ? Math.max(removedPayments.reduce((sum, p) => sum + numberOrZero(p.amount), 0), related.reduce((sum, t) => sum + numberOrZero(t.amount), 0))
      : related.reduce((sum, t) => sum + numberOrZero(t.amount), 0);
    if (!amount && !removedPayments.length) return debt;
    const currentBalance = money(numberOrZero(debt.currentBalance) + amount);
    return { ...debt, currentBalance, status: currentBalance > 0 ? 'activa' : 'saldada', paidAt: currentBalance > 0 ? null : debt.paidAt || null,
      payments: payments.filter(p => !removedPayments.includes(p)) };
  });
}

function deleteTransaction(data, id) {
  const state = financeState(data);
  const removed = state.finances.filter(t => t.id === id);
  return { finances: state.finances.filter(t => t.id !== id), debts: undoPayments(state.debts, removed) };
}

function deleteAccount(data, id) {
  const state = financeState(data);
  if (state.financeAccounts.length <= 1 && state.financeAccounts.some(a => a.id === id)) throw new Error('Debes conservar al menos una cuenta.');
  const removed = state.finances.filter(t => t.account === id || t.toAccount === id);
  const baseBalances = { ...state.baseBalances };
  delete baseBalances[id];
  return { financeAccounts: state.financeAccounts.filter(a => a.id !== id), baseBalances,
    finances: state.finances.filter(t => t.account !== id && t.toAccount !== id), debts: undoPayments(state.debts, removed, id) };
}

function addAccount(data, account, initialBalance) {
  const state = financeState(data);
  if (!account.name.trim() || !Number.isFinite(Number(initialBalance)) || Number(initialBalance) < 0 || !Number.isFinite(Number(account.yieldRate)) || Number(account.yieldRate) < 0) throw new Error('Revisa el nombre, el saldo inicial y la tasa de la cuenta.');
  if (state.financeAccounts.some(a => a.id === account.id)) throw new Error('La cuenta ya existe.');
  return { financeAccounts: [...state.financeAccounts, account], baseBalances: { ...state.baseBalances, [account.id]: money(initialBalance) } };
}

function payDebt(data, debtId, account, amount, id, date) {
  const state = financeState(data);
  assertAccount(state, account);
  const debt = state.debts.find(d => d.id === debtId);
  if (!debt) throw new Error('Esta deuda ya no existe.');
  const applied = money(amount);
  if (!Number.isFinite(applied) || applied <= 0 || applied > numberOrZero(debt.currentBalance)) throw new Error('El pago debe ser mayor que cero y no superar el saldo pendiente.');
  const currentBalance = money(Number(debt.currentBalance) - applied);
  const payment = { id, transactionId: id, amount: applied, account, date };
  return {
    debts: state.debts.map(d => d.id === debtId ? { ...d, currentBalance, status: currentBalance === 0 ? 'saldada' : 'activa', paidAt: currentBalance === 0 ? date : null, payments: [...(d.payments || []), payment] } : d),
    finances: [{ id, paymentId: id, debtId, type: 'egreso', amount: applied, description: `Pago deuda: ${debt.name}`, account, toAccount: null, category: 'deuda', date }, ...state.finances]
  };
}

function resetFinances() {
  return { finances: [], debts: [], financeAccounts: DEFAULT_ACCOUNTS, baseBalances: { nubank: 0, nequi: 0, efectivo: 0 } };
}

module.exports = { DEFAULT_ACCOUNTS, DEFAULT_BALANCES, money, numberOrZero, newId, validDate, accountsFor, financeState, saveTransaction, deleteTransaction, deleteAccount, addAccount, payDebt, resetFinances };
