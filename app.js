(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // ../../../../Desktop/COSAS PERSONALES/adventure-github-pages/data-model.js
  var require_data_model = __commonJS({
    "../../../../Desktop/COSAS PERSONALES/adventure-github-pages/data-model.js"(exports, module) {
      var DEFAULT_ACCOUNTS = [
        { id: "nubank", name: "NuBank", type: "banco", description: "Ahorro", color: "purple", yieldRate: 9.25 },
        { id: "nequi", name: "Nequi", type: "billetera", description: "Gastos digitales", color: "pink", yieldRate: 0 },
        { id: "efectivo", name: "Efectivo", type: "efectivo", description: "Gastos diarios", color: "emerald", yieldRate: 0 }
      ];
      var DEFAULT_BALANCES = { nubank: 236e4, nequi: 0, efectivo: 0 };
      var money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
      var numberOrZero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
      var newId = () => globalThis.crypto.randomUUID();
      var validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
      function accountsFor(data) {
        const source = Array.isArray(data.financeAccounts) ? data.financeAccounts : [...DEFAULT_ACCOUNTS];
        const accounts = /* @__PURE__ */ new Map();
        source.forEach((a) => {
          if (a && a.id && !accounts.has(a.id)) accounts.set(a.id, { type: "banco", color: "blue", yieldRate: 0, description: "", ...a });
        });
        if (!Array.isArray(data.financeAccounts)) {
          const used = [...Object.keys(data.baseBalances || {}), ...(data.finances || []).flatMap((t) => [t.account, t.toAccount])];
          used.filter(Boolean).forEach((id) => {
            if (!accounts.has(id)) accounts.set(id, { id, name: id, type: "banco", color: "blue", yieldRate: 0, description: "Cuenta recuperada" });
          });
        }
        return [...accounts.values()];
      }
      function financeState(data) {
        return {
          financeAccounts: accountsFor(data),
          baseBalances: data.baseBalances ?? DEFAULT_BALANCES,
          finances: data.finances || [],
          debts: data.debts || []
        };
      }
      function assertAccount(state, id) {
        if (!state.financeAccounts.some((a) => a.id === id)) throw new Error("La cuenta ya no existe. Selecciona una cuenta vigente.");
      }
      function validateTransaction(state, item) {
        if (!["ingreso", "egreso", "transferencia"].includes(item.type)) throw new Error("Tipo de movimiento inv\xE1lido.");
        if (!Number.isFinite(Number(item.amount)) || money(item.amount) <= 0) throw new Error("El importe debe ser un n\xFAmero mayor que cero.");
        if (!item.description?.trim() || !validDate(item.date)) throw new Error("Completa la descripci\xF3n y una fecha v\xE1lida.");
        assertAccount(state, item.account);
        if (item.type === "transferencia") {
          assertAccount(state, item.toAccount);
          if (item.account === item.toAccount) throw new Error("La cuenta de origen y destino deben ser diferentes.");
        }
      }
      function saveTransaction(data, item) {
        const state = financeState(data);
        validateTransaction(state, item);
        const old = state.finances.find((t) => t.id === item.id);
        if (old?.debtId || item.debtId) throw new Error("Para corregir un pago de deuda, elimina el movimiento y registra el pago nuevamente.");
        const saved = { ...item, amount: money(item.amount), description: item.description.trim(), toAccount: item.type === "transferencia" ? item.toAccount : null };
        return { finances: old ? state.finances.map((t) => t.id === item.id ? saved : t) : [saved, ...state.finances] };
      }
      function undoPayments(debts, removed, accountId) {
        return debts.map((debt) => {
          const related = removed.filter((t) => t.debtId === debt.id);
          const payments = debt.payments || [];
          const matched = /* @__PURE__ */ new Set();
          related.forEach((t) => {
            const index = payments.findIndex((p, i) => !matched.has(i) && (t.paymentId === p.id || t.id === p.transactionId || !t.paymentId && !p.transactionId && t.account === p.account && t.date === p.date && Number(t.amount) === Number(p.amount)));
            if (index !== -1) matched.add(index);
          });
          const removedPayments = payments.filter((p, i) => matched.has(i) || accountId !== void 0 && p.account === accountId);
          const amount = accountId ? Math.max(removedPayments.reduce((sum, p) => sum + numberOrZero(p.amount), 0), related.reduce((sum, t) => sum + numberOrZero(t.amount), 0)) : related.reduce((sum, t) => sum + numberOrZero(t.amount), 0);
          if (!amount && !removedPayments.length) return debt;
          const currentBalance = money(numberOrZero(debt.currentBalance) + amount);
          return {
            ...debt,
            currentBalance,
            status: currentBalance > 0 ? "activa" : "saldada",
            paidAt: currentBalance > 0 ? null : debt.paidAt || null,
            payments: payments.filter((p) => !removedPayments.includes(p))
          };
        });
      }
      function deleteTransaction(data, id) {
        const state = financeState(data);
        const removed = state.finances.filter((t) => t.id === id);
        return { finances: state.finances.filter((t) => t.id !== id), debts: undoPayments(state.debts, removed) };
      }
      function deleteAccount(data, id) {
        const state = financeState(data);
        if (state.financeAccounts.length <= 1 && state.financeAccounts.some((a) => a.id === id)) throw new Error("Debes conservar al menos una cuenta.");
        const removed = state.finances.filter((t) => t.account === id || t.toAccount === id);
        const baseBalances = { ...state.baseBalances };
        delete baseBalances[id];
        return {
          financeAccounts: state.financeAccounts.filter((a) => a.id !== id),
          baseBalances,
          finances: state.finances.filter((t) => t.account !== id && t.toAccount !== id),
          debts: undoPayments(state.debts, removed, id)
        };
      }
      function addAccount(data, account, initialBalance) {
        const state = financeState(data);
        if (!account.name.trim() || !Number.isFinite(Number(initialBalance)) || Number(initialBalance) < 0 || !Number.isFinite(Number(account.yieldRate)) || Number(account.yieldRate) < 0) throw new Error("Revisa el nombre, el saldo inicial y la tasa de la cuenta.");
        if (state.financeAccounts.some((a) => a.id === account.id)) throw new Error("La cuenta ya existe.");
        return { financeAccounts: [...state.financeAccounts, account], baseBalances: { ...state.baseBalances, [account.id]: money(initialBalance) } };
      }
      function payDebt(data, debtId, account, amount, id, date) {
        const state = financeState(data);
        assertAccount(state, account);
        const debt = state.debts.find((d) => d.id === debtId);
        if (!debt) throw new Error("Esta deuda ya no existe.");
        const applied = money(amount);
        if (!Number.isFinite(applied) || applied <= 0 || applied > numberOrZero(debt.currentBalance)) throw new Error("El pago debe ser mayor que cero y no superar el saldo pendiente.");
        const currentBalance = money(Number(debt.currentBalance) - applied);
        const payment = { id, transactionId: id, amount: applied, account, date };
        return {
          debts: state.debts.map((d) => d.id === debtId ? { ...d, currentBalance, status: currentBalance === 0 ? "saldada" : "activa", paidAt: currentBalance === 0 ? date : null, payments: [...d.payments || [], payment] } : d),
          finances: [{ id, paymentId: id, debtId, type: "egreso", amount: applied, description: `Pago deuda: ${debt.name}`, account, toAccount: null, category: "deuda", date }, ...state.finances]
        };
      }
      function resetFinances() {
        return { finances: [], debts: [], financeAccounts: DEFAULT_ACCOUNTS, baseBalances: { nubank: 0, nequi: 0, efectivo: 0 } };
      }
      module.exports = { DEFAULT_ACCOUNTS, DEFAULT_BALANCES, money, numberOrZero, newId, validDate, accountsFor, financeState, saveTransaction, deleteTransaction, deleteAccount, addAccount, payDebt, resetFinances };
    }
  });

  // ../../../../Desktop/COSAS PERSONALES/adventure-github-pages/cloud-store.js
  var require_cloud_store = __commonJS({
    "../../../../Desktop/COSAS PERSONALES/adventure-github-pages/cloud-store.js"(exports, module) {
      function createCloudStore2({ db: db2, docRef: docRef2, onData, onError, onPending }) {
        let base = {}, queue = [], busy = false, disposed = false, buffered = null;
        function render() {
          if (disposed) return;
          let view = base;
          for (const entry of queue) {
            try {
              view = { ...view, ...entry.update(view) };
            } catch (_) {
            }
          }
          onData(view);
          onPending(queue.length);
        }
        async function drain() {
          if (busy || disposed || !queue.length) return;
          busy = true;
          const entry = queue[0];
          buffered = null;
          let succeeded = false;
          try {
            const committed = await db2.runTransaction(async (tx) => {
              const snapshot = await tx.get(docRef2);
              if (disposed) throw new Error("La sesi\xF3n cambi\xF3 antes de guardar.");
              const current = snapshot.exists ? snapshot.data() : {};
              const patch = entry.update(current);
              tx.set(docRef2, patch, { mergeFields: Object.keys(patch) });
              return { ...current, ...patch };
            });
            base = committed;
            succeeded = true;
            try {
              const latest = await docRef2.get({ source: "server" });
              base = latest.exists ? latest.data() : {};
            } catch (_) {
            }
          } catch (error) {
            if (buffered) base = buffered;
            if (!disposed) onError(error);
          }
          queue.shift();
          busy = false;
          render();
          entry.resolve(succeeded);
          drain();
        }
        return {
          receive(data) {
            if (disposed) return;
            if (busy) {
              buffered = data;
            } else {
              base = data;
              render();
            }
          },
          commit(update) {
            if (disposed) return Promise.resolve(false);
            return new Promise((resolve) => {
              queue.push({ update, resolve });
              render();
              drain();
            });
          },
          dispose() {
            disposed = true;
            queue.forEach((entry) => entry.resolve(false));
            queue = [];
          }
        };
      }
      module.exports = { createCloudStore: createCloudStore2 };
    }
  });

  // ../../../../Desktop/COSAS PERSONALES/adventure-github-pages/app.jsx
  var { useState, useEffect, useMemo, useCallback, useRef } = React;
  var Data = require_data_model();
  var { createCloudStore } = require_cloud_store();
  var firebaseConfig = {
    apiKey: "AIzaSyCvUVDUuHfRfY0caqvKFHLK7l3OqaGgVoY",
    authDomain: "adventure-app-ecf2f.firebaseapp.com",
    databaseURL: "https://adventure-app-ecf2f-default-rtdb.firebaseio.com",
    projectId: "adventure-app-ecf2f",
    storageBucket: "adventure-app-ecf2f.firebasestorage.app",
    messagingSenderId: "900482922133",
    appId: "1:900482922133:web:fb4a1ab83ad71f5f968d9c"
  };
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  var db = firebase.firestore();
  var auth = firebase.auth();
  var docRef = db.collection("adventure_sync").doc("mi_dashboard_principal");
  var IconWrapper = ({ children, className = "", ...props }) => /* @__PURE__ */ React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: `lucide ${className}`, ...props }, children);
  var CheckCircle2 = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("path", { d: "m9 12 2 2 4-4" }));
  var Circle = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }));
  var Target = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "6" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "2" }));
  var DollarSign = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("line", { x1: "12", x2: "12", y1: "2", y2: "22" }), /* @__PURE__ */ React.createElement("path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" }));
  var Activity = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" }));
  var Dumbbell = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M14.4 14.4 9.6 9.6" }), /* @__PURE__ */ React.createElement("path", { d: "M18.65 21.35a2 2 0 0 1-2.83 0l-5.66-5.66a2 2 0 0 1 0-2.83l.06-.06a2 2 0 0 1 2.83 0l5.66 5.66a2 2 0 0 1 0 2.83Z" }), /* @__PURE__ */ React.createElement("path", { d: "m21.5 21.5-1.4-1.4" }), /* @__PURE__ */ React.createElement("path", { d: "M3.9 3.9 2.5 2.5" }), /* @__PURE__ */ React.createElement("path", { d: "M6.4 2.65a2 2 0 0 1 2.83 0l5.66 5.66a2 2 0 0 1 0 2.83l-.06.06a2 2 0 0 1-2.83 0L6.34 5.48a2 2 0 0 1 0-2.83Z" }));
  var Plus = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M5 12h14" }), /* @__PURE__ */ React.createElement("path", { d: "M12 5v14" }));
  var Trash2 = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M3 6h18" }), /* @__PURE__ */ React.createElement("path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }), /* @__PURE__ */ React.createElement("path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }), /* @__PURE__ */ React.createElement("line", { x1: "10", x2: "10", y1: "11", y2: "17" }), /* @__PURE__ */ React.createElement("line", { x1: "14", x2: "14", y1: "11", y2: "17" }));
  var TrendingUp = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17" }), /* @__PURE__ */ React.createElement("polyline", { points: "16 7 22 7 22 13" }));
  var TrendingDown = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("polyline", { points: "22 17 13.5 8.5 8.5 13.5 2 7" }), /* @__PURE__ */ React.createElement("polyline", { points: "16 17 22 17 22 11" }));
  var ListTodo = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "5", width: "6", height: "6", rx: "1" }), /* @__PURE__ */ React.createElement("path", { d: "m3 17 2 2 4-4" }), /* @__PURE__ */ React.createElement("path", { d: "M13 6h8" }), /* @__PURE__ */ React.createElement("path", { d: "M13 12h8" }), /* @__PURE__ */ React.createElement("path", { d: "M13 18h8" }));
  var Settings = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" }));
  var CalendarDays = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", ry: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "16", x2: "16", y1: "2", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", x2: "8", y1: "2", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "3", x2: "21", y1: "10", y2: "10" }), /* @__PURE__ */ React.createElement("path", { d: "M8 14h.01" }), /* @__PURE__ */ React.createElement("path", { d: "M12 14h.01" }), /* @__PURE__ */ React.createElement("path", { d: "M16 14h.01" }), /* @__PURE__ */ React.createElement("path", { d: "M8 18h.01" }), /* @__PURE__ */ React.createElement("path", { d: "M12 18h.01" }), /* @__PURE__ */ React.createElement("path", { d: "M16 18h.01" }));
  var ChevronDown = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "m6 9 6 6 6-6" }));
  var ChevronUp = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "m18 15-6-6-6 6" }));
  var Clock = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("polyline", { points: "12 6 12 12 16 14" }));
  var BarChart = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("line", { x1: "12", x2: "12", y1: "20", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "18", x2: "18", y1: "20", y2: "4" }), /* @__PURE__ */ React.createElement("line", { x1: "6", x2: "6", y1: "20", y2: "16" }));
  var Flame = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" }));
  var Trophy = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "8", r: "7" }), /* @__PURE__ */ React.createElement("polyline", { points: "8.21 13.89 7 23 12 20 17 23 15.79 13.88" }));
  var Zap = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }));
  var AlertTriangle = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
  var Edit2 = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" }));
  var Wallet = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M21 12V7H5a2 2 0 0 1 0-4h14v4" }), /* @__PURE__ */ React.createElement("path", { d: "M3 5v14a2 2 0 0 0 2 2h16v-5" }), /* @__PURE__ */ React.createElement("path", { d: "M18 12a2 2 0 0 0 0 4h4v-4Z" }));
  var CreditCard = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("rect", { width: "20", height: "14", x: "2", y: "5", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "2", x2: "22", y1: "10", y2: "10" }));
  var Landmark = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("line", { x1: "3", x2: "21", y1: "22", y2: "22" }), /* @__PURE__ */ React.createElement("line", { x1: "6", x2: "6", y1: "18", y2: "11" }), /* @__PURE__ */ React.createElement("line", { x1: "10", x2: "10", y1: "18", y2: "11" }), /* @__PURE__ */ React.createElement("line", { x1: "14", x2: "14", y1: "18", y2: "11" }), /* @__PURE__ */ React.createElement("line", { x1: "18", x2: "18", y1: "18", y2: "11" }), /* @__PURE__ */ React.createElement("polygon", { points: "12 2 20 7 4 7" }));
  var Smartphone = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M12 18h.01" }));
  var ArrowRightLeft = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "m21 16-4 4-4-4" }), /* @__PURE__ */ React.createElement("path", { d: "M17 20V4" }), /* @__PURE__ */ React.createElement("path", { d: "m3 8 4-4 4 4" }), /* @__PURE__ */ React.createElement("path", { d: "M7 4v16" }));
  var Heart = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" }));
  var Cloud = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }));
  var LogOut = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), /* @__PURE__ */ React.createElement("polyline", { points: "16 17 21 12 16 7" }), /* @__PURE__ */ React.createElement("line", { x1: "21", x2: "9", y1: "12", y2: "12" }));
  var Shield = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }));
  var Eye = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" }));
  var EyeOff = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("path", { d: "M9.88 9.88a3 3 0 1 0 4.24 4.24" }), /* @__PURE__ */ React.createElement("path", { d: "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" }), /* @__PURE__ */ React.createElement("path", { d: "M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" }), /* @__PURE__ */ React.createElement("line", { x1: "2", x2: "22", y1: "2", y2: "22" }));
  var XIcon = (p) => /* @__PURE__ */ React.createElement(IconWrapper, { ...p }, /* @__PURE__ */ React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }));
  var CATEGORIES = {
    "salud": { label: "Salud", color: "text-rose-400", bg: "bg-rose-500/20", bar: "bg-rose-500" },
    "alimentacion": { label: "Alimentaci\xF3n", color: "text-orange-400", bg: "bg-orange-500/20", bar: "bg-orange-500" },
    "rutina": { label: "Rutina", color: "text-slate-300", bg: "bg-slate-500/20", bar: "bg-slate-400" },
    "productividad": { label: "Productividad", color: "text-blue-400", bg: "bg-blue-500/20", bar: "bg-blue-500" },
    "gym": { label: "Gym", color: "text-indigo-400", bg: "bg-indigo-500/20", bar: "bg-indigo-500" },
    "desarrollo": { label: "Desarrollo", color: "text-purple-400", bg: "bg-purple-500/20", bar: "bg-purple-500" }
  };
  var FINANCE_CATEGORIES = {
    ingreso: [
      { id: "fijo", label: "Ingreso Fijo (Salario)" },
      { id: "variable", label: "Ingreso Variable (Clases/Extras)" },
      { id: "otro", label: "Otros Ingresos" }
    ],
    egreso: [
      { id: "fijo", label: "Gasto Fijo (Arriendo/Servicios)" },
      { id: "variable", label: "Gasto Variable (Diario/Salidas)" },
      { id: "ahorro", label: "Ahorro Destinado" }
    ]
  };
  var ACCOUNT_COLORS = {
    purple: { card: "from-purple-900/40 to-slate-800 border-purple-500/30", text: "text-purple-300", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30", focus: "focus:border-purple-500" },
    pink: { card: "from-pink-900/20 to-slate-800 border-pink-500/20", text: "text-pink-400", badge: "bg-pink-900/20 text-pink-400 border-pink-500/30", focus: "focus:border-pink-500" },
    emerald: { card: "from-emerald-900/20 to-slate-800 border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-900/20 text-emerald-400 border-emerald-500/30", focus: "focus:border-emerald-500" },
    blue: { card: "from-blue-900/30 to-slate-800 border-blue-500/25", text: "text-blue-400", badge: "bg-blue-900/20 text-blue-400 border-blue-500/30", focus: "focus:border-blue-500" },
    amber: { card: "from-amber-900/20 to-slate-800 border-amber-500/25", text: "text-amber-400", badge: "bg-amber-900/20 text-amber-400 border-amber-500/30", focus: "focus:border-amber-500" }
  };
  var DEFAULT_FINANCE_ACCOUNTS = Data.DEFAULT_ACCOUNTS;
  var DEBT_TYPES = {
    tarjeta: { label: "Tarjeta de cr\xE9dito", color: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/30" },
    prestamo: { label: "Pr\xE9stamo general", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
    otro: { label: "Otra deuda", color: "text-slate-300", bg: "bg-slate-700 border-slate-600" }
  };
  var INITIAL_HABITS_TEMPLATE = [
    { id: 1, startTime: "06:30", endTime: "06:50", text: "Despertarse y tomar agua", category: "salud" },
    { id: 2, startTime: "06:45", endTime: "07:00", text: "Estiramientos corporales", category: "salud" },
    { id: 3, startTime: "07:00", endTime: "07:20", text: "Desayunar sano", category: "alimentacion" },
    { id: 4, startTime: "07:20", endTime: "07:45", text: "Ba\xF1arme y alistarme", category: "rutina" },
    { id: 5, startTime: "08:00", endTime: "08:30", text: "Planificar el d\xEDa", category: "productividad" },
    { id: 6, startTime: "08:30", endTime: "10:00", text: "Trabajo profundo", category: "productividad" },
    { id: 7, startTime: "17:00", endTime: "19:00", text: "Rutina de pesas", category: "gym" },
    { id: 8, startTime: "21:00", endTime: "21:30", text: "Leer 10 p\xE1ginas", category: "desarrollo" }
  ];
  var WEEK_DAYS = ["Lunes", "Martes", "Mi\xE9rcoles", "Jueves", "Viernes", "S\xE1bado", "Domingo"];
  var STATUS_CONFIG = {
    "sin_empezar": { label: "Sin empezar", color: "bg-slate-700 text-slate-300 border-slate-600" },
    "en_curso": { label: "En curso", color: "bg-blue-900/40 text-blue-400 border-blue-700/50" },
    "realizado": { label: "Realizado", color: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50" }
  };
  var getLocalString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  var getTodayString = () => getLocalString(/* @__PURE__ */ new Date());
  var formatCurrency = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
  function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [loginError, setLoginError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loadingCloud, setLoadingCloud] = useState(true);
    const [globalData, setGlobalData] = useState({});
    const [cloudError, setCloudError] = useState("");
    const [pendingWrites, setPendingWrites] = useState(0);
    const cloudStore = useRef(null);
    const financeBusy = useRef(false);
    const [activeTab, setActiveTab] = useState("habits");
    const [selectedDate, setSelectedDate] = useState(getTodayString());
    const [newHabit, setNewHabit] = useState({ text: "", startTime: "", endTime: "", category: "rutina" });
    const [editingHabitId, setEditingHabitId] = useState(null);
    const [editHabitForm, setEditHabitForm] = useState({ text: "", category: "rutina", startTime: "", endTime: "" });
    const [expandedDay, setExpandedDay] = useState("Lunes");
    const [newTask, setNewTask] = useState({ text: "", time: "" });
    const [healthForm, setHealthForm] = useState({ meal: "", symptoms: "Ninguno", painLevel: 1 });
    const [financeFilter, setFinanceFilter] = useState("mes");
    const [financeForm, setFinanceForm] = useState({ id: null, type: "egreso", amount: "", description: "", account: "nequi", toAccount: "nubank", category: "variable", date: getTodayString() });
    const [accountForm, setAccountForm] = useState({ name: "", type: "banco", description: "", color: "blue", initialBalance: "", yieldRate: "" });
    const [debtForm, setDebtForm] = useState({ id: null, name: "", type: "tarjeta", originalAmount: "", currentBalance: "", dueDate: "", notes: "" });
    const [debtPayment, setDebtPayment] = useState({ isOpen: false, debtId: null, amount: "", account: "nequi" });
    const [isEditingGym, setIsEditingGym] = useState(false);
    const [newRoutine, setNewRoutine] = useState({ day: "Lunes", focus: "", duration: 60 });
    const [cardioPrompt, setCardioPrompt] = useState({ isOpen: false, routineId: null });
    const [isEditingBalances, setIsEditingBalances] = useState(false);
    const [tempBalances, setTempBalances] = useState({ nubank: 0, nequi: 0, efectivo: 0 });
    useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((u) => {
        setUser(u);
        setAuthLoading(false);
      });
      return () => unsubscribe();
    }, []);
    useEffect(() => {
      setGlobalData({});
      setCloudError("");
      setPendingWrites(0);
      setLoadingCloud(true);
      setFinanceForm({ id: null, type: "egreso", amount: "", description: "", account: "", toAccount: "", category: "variable", date: getTodayString() });
      setDebtForm({ id: null, name: "", type: "tarjeta", originalAmount: "", currentBalance: "", dueDate: "", notes: "" });
      setDebtPayment({ isOpen: false, debtId: null, amount: "", account: "" });
      setIsEditingBalances(false);
      if (!user) return;
      let active = true;
      const store = createCloudStore({
        db,
        docRef,
        onData: setGlobalData,
        onPending: setPendingWrites,
        onError: (err) => {
          console.error("Error guardando:", err);
          setCloudError(`No se guard\xF3 el cambio: ${err.message}. Revisa la conexi\xF3n y vuelve a intentarlo.`);
        }
      });
      cloudStore.current = store;
      const unsubscribe = docRef.onSnapshot((doc) => {
        if (!active) return;
        store.receive(doc.exists ? doc.data() : {});
        setLoadingCloud(false);
      }, (err) => {
        if (!active) return;
        console.error("Error conectando a Firebase:", err);
        setCloudError("No se pudieron cargar los datos. Revisa la conexi\xF3n y recarga la p\xE1gina.");
        setLoadingCloud(true);
      });
      return () => {
        active = false;
        unsubscribe();
        store.dispose();
        cloudStore.current = null;
      };
    }, [user]);
    useEffect(() => {
      if (!pendingWrites) return;
      const warn = (event) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", warn);
      return () => window.removeEventListener("beforeunload", warn);
    }, [pendingWrites]);
    const commitCloud = useCallback((update) => {
      if (!cloudStore.current || loadingCloud) return Promise.resolve(false);
      setCloudError("");
      return cloudStore.current.commit(update);
    }, [loadingCloud]);
    const commitFinance = async (update) => {
      if (financeBusy.current) return false;
      financeBusy.current = true;
      try {
        return await commitCloud(update);
      } finally {
        financeBusy.current = false;
      }
    };
    const handleLogin = async (e) => {
      e.preventDefault();
      setLoginError("");
      try {
        const emailTrimmed = loginForm.email.trim();
        await auth.signInWithEmailAndPassword(emailTrimmed, loginForm.password);
      } catch (error) {
        console.error("Detalle del error:", error);
        if (error.code === "auth/invalid-credential") setLoginError("El correo o la contrase\xF1a no coinciden.");
        else if (error.code === "auth/user-not-found") setLoginError("Este correo no est\xE1 registrado.");
        else if (error.code === "auth/wrong-password") setLoginError("Contrase\xF1a incorrecta.");
        else if (error.code === "auth/too-many-requests") setLoginError("Demasiados intentos fallidos. Intenta m\xE1s tarde.");
        else setLoginError(`Error del servidor: ${error.message}`);
      }
    };
    const handleLogout = () => {
      if (pendingWrites) {
        window.alert("Espera a que terminen de guardarse los cambios.");
        return;
      }
      auth.signOut().catch((err) => setCloudError(err.message));
    };
    const useCloudState = (key, initialValue) => {
      const value = globalData[key] !== void 0 ? globalData[key] : initialValue;
      const setValue = (updater) => commitCloud((current) => {
        const oldValue = current[key] !== void 0 ? current[key] : initialValue;
        return { [key]: typeof updater === "function" ? updater(oldValue) : updater };
      });
      return [value, setValue];
    };
    const [habitsList, setHabitsList] = useCloudState("habitsList", INITIAL_HABITS_TEMPLATE);
    const [habitCompletions, setHabitCompletions] = useCloudState("habitCompletions", {});
    const [finances, setFinances] = useCloudState("finances", []);
    const [financeAccounts, setFinanceAccounts] = useCloudState("financeAccounts", DEFAULT_FINANCE_ACCOUNTS);
    const [debts, setDebts] = useCloudState("debts", []);
    const [globalGoal, setGlobalGoal] = useCloudState("globalGoal", "Lanzar mi emprendimiento principal este mes");
    const [weeklyGoals, setWeeklyGoals] = useCloudState("weeklyGoals", WEEK_DAYS.map((day) => ({ day, dailyGoal: "", tasks: [] })));
    const [healthLogs, setHealthLogs] = useCloudState("healthLogs", []);
    const [gymRoutine, setGymRoutine] = useCloudState("gymRoutine", [
      { id: 1, day: "Lunes", focus: "Pecho y Tr\xEDceps", duration: 60, isCardioDone: false, completed: false },
      { id: 2, day: "Martes", focus: "Espalda y B\xEDceps", duration: 60, isCardioDone: false, completed: false },
      { id: 3, day: "Mi\xE9rcoles", focus: "Pierna (Cu\xE1driceps)", duration: 60, isCardioDone: false, completed: false },
      { id: 4, day: "Jueves", focus: "Hombros y Abdomen", duration: 45, isCardioDone: false, completed: false },
      { id: 5, day: "Viernes", focus: "Pierna (Femoral)", duration: 60, isCardioDone: false, completed: false },
      { id: 6, day: "S\xE1bado", focus: "Cardio HIIT", duration: 30, isCardioDone: false, completed: false },
      { id: 7, day: "Domingo", focus: "Descanso Total", duration: 0, isCardioDone: false, completed: false }
    ]);
    const [bodyMetrics, setBodyMetrics] = useCloudState("bodyMetrics", { weight: "", height: "" });
    const [baseBalances, setBaseBalances] = useCloudState("baseBalances", { nubank: 236e4, nequi: 0, efectivo: 0 });
    const validHabitIds = useMemo(() => new Set(habitsList.map((h) => h.id)), [habitsList]);
    const currentCompletedIds = useMemo(() => {
      return (habitCompletions[selectedDate] || []).filter((id) => validHabitIds.has(id));
    }, [habitCompletions, selectedDate, validHabitIds]);
    const habitAnalytics = useMemo(() => {
      const stats = { currentWeekScore: 0, previousWeekScore: 0, trend: 0, strongestHabit: null, weakestHabit: null, categoryCompliance: {}, streaks: {}, trendData: [] };
      if (habitsList.length === 0) return stats;
      const totalHabits = habitsList.length;
      const [year, month, day] = selectedDate.split("-").map(Number);
      const baseDate = new Date(year, month - 1, day);
      const habitCounts = {};
      habitsList.forEach((h) => habitCounts[h.id] = 0);
      for (let i = 0; i < 30; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dateStr = getLocalString(d);
        const completedToday = (habitCompletions[dateStr] || []).filter((id) => validHabitIds.has(id));
        completedToday.forEach((id) => {
          if (habitCounts[id] !== void 0) habitCounts[id]++;
        });
      }
      let maxCount = -1, minCount = 31;
      habitsList.forEach((h) => {
        const count = habitCounts[h.id];
        if (count > maxCount) {
          maxCount = count;
          stats.strongestHabit = h;
        }
        if (count < minCount) {
          minCount = count;
          stats.weakestHabit = h;
        }
      });
      let currentWeekHits = 0, previousWeekHits = 0;
      Object.keys(CATEGORIES).forEach((c) => stats.categoryCompliance[c] = { hits: 0, total: 0 });
      for (let i = 0; i < 14; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dateStr = getLocalString(d);
        const completedIds = (habitCompletions[dateStr] || []).filter((id) => validHabitIds.has(id));
        const hits = completedIds.length;
        if (i < 7) {
          currentWeekHits += hits;
          stats.trendData.unshift({
            date: dateStr,
            dayName: d.toLocaleDateString("es-ES", { weekday: "short" }),
            percentage: Math.round(hits / totalHabits * 100),
            isSelected: dateStr === selectedDate
          });
          habitsList.forEach((h) => {
            const catKey = h.category || "rutina";
            if (stats.categoryCompliance[catKey]) {
              stats.categoryCompliance[catKey].total++;
              if (completedIds.includes(h.id)) stats.categoryCompliance[catKey].hits++;
            }
          });
        } else {
          previousWeekHits += hits;
        }
      }
      const possiblePerWeek = totalHabits * 7;
      stats.currentWeekScore = Math.round(currentWeekHits / possiblePerWeek * 100) || 0;
      stats.previousWeekScore = Math.round(previousWeekHits / possiblePerWeek * 100) || 0;
      stats.trend = stats.currentWeekScore - stats.previousWeekScore;
      Object.keys(stats.categoryCompliance).forEach((c) => {
        const cat = stats.categoryCompliance[c];
        cat.percentage = cat.total > 0 ? Math.round(cat.hits / cat.total * 100) : 0;
      });
      habitsList.forEach((h) => {
        let streak = 0;
        let checkDate = new Date(baseDate);
        if (!(habitCompletions[selectedDate] || []).includes(h.id)) checkDate.setDate(checkDate.getDate() - 1);
        while (true) {
          if ((habitCompletions[getLocalString(checkDate)] || []).includes(h.id)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else break;
        }
        stats.streaks[h.id] = streak;
      });
      return stats;
    }, [habitsList, habitCompletions, selectedDate, validHabitIds]);
    const gymAnalytics = useMemo(() => {
      let vitalityPoints = 0;
      let completedCount = 0;
      const muscleCounts = {};
      gymRoutine.forEach((r) => {
        if (r.completed) {
          completedCount++;
          vitalityPoints += 10;
          if (r.isCardioDone) vitalityPoints += 5;
          const muscles = (r.focus || "").split(/ y |,| \/ | /).map((m) => m.trim().toLowerCase()).filter((m) => m.length > 3 && !["rutina", "descanso", "total", "hiit"].includes(m));
          muscles.forEach((m) => {
            muscleCounts[m] = (muscleCounts[m] || 0) + 1;
          });
        }
      });
      let topMuscle = "N/A";
      let maxCount = 0;
      Object.keys(muscleCounts).forEach((m) => {
        if (muscleCounts[m] > maxCount) {
          maxCount = muscleCounts[m];
          topMuscle = m.charAt(0).toUpperCase() + m.slice(1);
        }
      });
      const progress = gymRoutine.length > 0 ? Math.round(completedCount / gymRoutine.length * 100) : 0;
      let mic = 0;
      let micStatus = { text: "", color: "" };
      if (bodyMetrics.weight && bodyMetrics.height) {
        const w = parseFloat(bodyMetrics.weight);
        const h = parseFloat(bodyMetrics.height);
        if (h > 0) {
          mic = (w / (h * h)).toFixed(1);
          const micNum = parseFloat(mic);
          if (micNum < 18.5) {
            micStatus = { text: "Bajo peso", color: "text-blue-400" };
          } else if (micNum >= 18.5 && micNum <= 24.9) {
            micStatus = { text: "\xD3ptimo", color: "text-emerald-400" };
          } else if (micNum >= 25 && micNum <= 29.9) {
            micStatus = { text: "Leve sobrepeso", color: "text-yellow-400" };
          } else {
            micStatus = { text: "Sobrepeso / Obesidad", color: "text-red-400" };
          }
        }
      }
      return { vitalityPoints, topMuscle, progress, mic, micStatus };
    }, [gymRoutine, bodyMetrics]);
    const normalizedAccounts = useMemo(() => Data.accountsFor(globalData), [globalData]);
    useEffect(() => {
      const ids = normalizedAccounts.map((a) => a.id);
      setFinanceForm((form) => {
        const account = ids.includes(form.account) ? form.account : ids[0] || "";
        const toAccount = ids.includes(form.toAccount) && form.toAccount !== account ? form.toAccount : ids.find((id) => id !== account) || "";
        return form.account === account && form.toAccount === toAccount ? form : { ...form, account, toAccount };
      });
      setDebtPayment((form) => ids.includes(form.account) ? form : { ...form, account: ids[0] || "" });
    }, [normalizedAccounts]);
    const accountMap = useMemo(() => {
      return normalizedAccounts.reduce((map, account) => ({ ...map, [account.id]: account }), {});
    }, [normalizedAccounts]);
    const getAccountName = useCallback((accountId) => accountMap[accountId]?.name || accountId || "Cuenta", [accountMap]);
    const getAccountStyle = useCallback((accountId) => ACCOUNT_COLORS[accountMap[accountId]?.color] || ACCOUNT_COLORS.blue, [accountMap]);
    const getAccountIcon = useCallback((account) => {
      if (account?.type === "billetera") return Smartphone;
      if (account?.type === "efectivo") return Wallet;
      return Landmark;
    }, []);
    const financeData = useMemo(() => {
      const balances = /* @__PURE__ */ Object.create(null);
      normalizedAccounts.forEach((account) => {
        balances[account.id] = Data.numberOrZero(baseBalances?.[account.id]);
      });
      let totalIngresosFiltrados = 0;
      let totalEgresosFiltrados = 0;
      let ingresosFijos = 0, ingresosVariables = 0;
      let gastosFijos = 0, gastosVariables = 0, ahorroRegistrado = 0, pagosDeuda = 0;
      finances.forEach((t) => {
        const acc = t.account || "efectivo";
        const amount = Data.numberOrZero(t.amount);
        if (!Object.hasOwn(balances, acc) || t.type === "transferencia" && !Object.hasOwn(balances, t.toAccount)) return;
        if (t.type === "ingreso") {
          balances[acc] += amount;
        } else if (t.type === "egreso") {
          balances[acc] -= amount;
        } else if (t.type === "transferencia") {
          balances[acc] -= amount;
          if (t.toAccount) balances[t.toAccount] += amount;
        }
      });
      const today = /* @__PURE__ */ new Date();
      let limitDate = new Date(1970, 0, 1);
      if (financeFilter === "semana") limitDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      else if (financeFilter === "quincena") limitDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
      else if (financeFilter === "mes") {
        limitDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        limitDate.setDate(Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate()));
      }
      const firstDate = getLocalString(limitDate);
      const filteredList = finances.filter((t) => Data.validDate(t.date) && t.date >= firstDate && t.date <= getTodayString()).sort((a, b) => b.date.localeCompare(a.date));
      filteredList.forEach((t) => {
        const amount = Data.numberOrZero(t.amount);
        const cat = t.category || (t.type === "ingreso" ? "variable" : "variable");
        if (t.type === "ingreso") {
          totalIngresosFiltrados += amount;
          if (cat === "fijo") ingresosFijos += amount;
          else ingresosVariables += amount;
        } else if (t.type === "egreso") {
          totalEgresosFiltrados += amount;
          if (cat === "fijo") gastosFijos += amount;
          else if (cat === "ahorro") ahorroRegistrado += amount;
          else if (cat === "deuda") pagosDeuda += amount;
          else gastosVariables += amount;
        }
      });
      const activeDebts = debts.filter((debt) => Number(debt.currentBalance || 0) > 0);
      const totalDebt = activeDebts.reduce((sum, debt) => sum + Number(debt.currentBalance || 0), 0);
      const originalDebt = debts.reduce((sum, debt) => sum + Number(debt.originalAmount || debt.currentBalance || 0), 0);
      const totalPaidDebt = Math.max(0, originalDebt - debts.reduce((sum, debt) => sum + Number(debt.currentBalance || 0), 0));
      const totalBalance = Object.values(balances).reduce((sum, value) => sum + Number(value || 0), 0);
      const libreTotal = ingresosFijos + ingresosVariables - (gastosFijos + gastosVariables + ahorroRegistrado + pagosDeuda);
      const estimatedMonthlyYield = normalizedAccounts.reduce((sum, account) => {
        const rate = Number(account.yieldRate || 0);
        if (rate <= 0) return sum;
        const monthlyYieldRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
        return sum + Number(balances[account.id] || 0) * monthlyYieldRate;
      }, 0);
      return { balances, totalBalance, totalIngresos: totalIngresosFiltrados, totalEgresos: totalEgresosFiltrados, filteredList, estimatedMonthlyYield, ingresosFijos, ingresosVariables, gastosFijos, gastosVariables, ahorroRegistrado, pagosDeuda, libreTotal, totalDebt, activeDebts, originalDebt, totalPaidDebt };
    }, [finances, financeFilter, baseBalances, normalizedAccounts, debts]);
    const toggleHabitCompletion = (id) => {
      setHabitCompletions((prev) => {
        const dayCompletions = prev[selectedDate] || [];
        const isCompleted = dayCompletions.includes(id);
        return {
          ...prev,
          [selectedDate]: isCompleted ? dayCompletions.filter((habitId) => habitId !== id) : [...dayCompletions, id]
        };
      });
    };
    const handleAddHabit = async () => {
      if (!newHabit.text.trim()) return;
      const habit = { id: Data.newId(), ...newHabit };
      if (!await setHabitsList((prev) => [...prev, habit])) return;
      setNewHabit({ text: "", startTime: "", endTime: "", category: "rutina" });
    };
    const startEditingHabit = (habit) => {
      setEditingHabitId(habit.id);
      setEditHabitForm({ text: habit.text || "", category: habit.category || "rutina", startTime: habit.startTime || "", endTime: habit.endTime || "" });
    };
    const saveEditingHabit = async () => {
      if (!editHabitForm.text.trim()) return;
      if (await setHabitsList((prev) => prev.map((h) => h.id === editingHabitId ? { ...h, ...editHabitForm, text: editHabitForm.text.trim() } : h))) setEditingHabitId(null);
    };
    const handleDeleteHabit = (id) => {
      if (window.confirm("\xBFSeguro que deseas borrar este h\xE1bito por completo?")) {
        commitCloud((current) => ({ habitsList: (current.habitsList ?? INITIAL_HABITS_TEMPLATE).filter((h) => h.id !== id), habitCompletions: Object.fromEntries(Object.entries(current.habitCompletions || {}).map(([date, ids]) => [date, ids.filter((cId) => cId !== id)])) }));
      }
    };
    const clearFinanceForm = () => setFinanceForm({ id: null, type: "egreso", amount: "", description: "", account: normalizedAccounts[0]?.id || "", toAccount: normalizedAccounts[1]?.id || "", category: "variable", date: getTodayString() });
    const handleAddOrEditTransaction = async (e) => {
      e.preventDefault();
      const item = { ...financeForm, id: financeForm.id ?? Data.newId() };
      const saved = await commitFinance((current) => {
        if (financeForm.id && !(current.finances || []).some((t) => t.id === financeForm.id)) throw new Error("Este movimiento fue eliminado.");
        return Data.saveTransaction(current, item);
      });
      if (saved) clearFinanceForm();
    };
    const handleEditTransactionClick = (item) => {
      if (item.debtId) {
        window.alert("Para corregir este pago, elimina el movimiento y registra el pago nuevamente desde la deuda.");
        return;
      }
      setFinanceForm({ ...item, toAccount: item.toAccount || normalizedAccounts.find((a) => a.id !== item.account)?.id || "", category: item.category || "variable" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleDeleteTransaction = async (id) => {
      if (window.confirm("\xBFEliminar este movimiento? Si es un pago de deuda, se restaurar\xE1 el saldo pendiente.")) {
        if (await commitFinance((current) => Data.deleteTransaction(current, id))) {
          if (financeForm.id === id) clearFinanceForm();
        }
      }
    };
    const handleAddAccount = async (e) => {
      e.preventDefault();
      const account = {
        id: Data.newId(),
        name: accountForm.name.trim(),
        type: accountForm.type,
        description: accountForm.description.trim(),
        color: accountForm.color,
        yieldRate: Number(accountForm.yieldRate || 0)
      };
      if (await commitFinance((current) => Data.addAccount(current, account, Number(accountForm.initialBalance || 0)))) {
        setAccountForm({ name: "", type: "banco", description: "", color: "blue", initialBalance: "", yieldRate: "" });
      }
    };
    const handleDeleteAccount = async (accountId) => {
      if (normalizedAccounts.length <= 1) {
        window.alert("Debes conservar al menos una cuenta.");
        return;
      }
      const count = finances.filter((t) => t.account === accountId || t.toAccount === accountId).length;
      if (!window.confirm(`\xBFEliminar la cuenta \xAB${getAccountName(accountId)}\xBB, su saldo inicial y sus ${count} movimientos asociados? Las transferencias se eliminar\xE1n completas y se recalcular\xE1n las otras cuentas. Los pagos de deuda eliminados volver\xE1n a quedar pendientes.`)) return;
      if (await commitFinance((current) => Data.deleteAccount(current, accountId))) {
        clearFinanceForm();
        setDebtPayment({ isOpen: false, debtId: null, amount: "", account: "" });
        setIsEditingBalances(false);
        setTempBalances({});
      }
    };
    const handleAddOrEditDebt = async (e) => {
      e.preventDefault();
      const currentBalance = Number(debtForm.currentBalance === "" ? debtForm.originalAmount : debtForm.currentBalance);
      const originalAmount = Number(debtForm.originalAmount === "" ? debtForm.currentBalance : debtForm.originalAmount);
      if (!debtForm.name.trim() || !Number.isFinite(currentBalance) || !Number.isFinite(originalAmount) || originalAmount <= 0 || currentBalance < 0 || currentBalance > originalAmount) {
        window.alert("Revisa los importes: la deuda inicial debe ser positiva y el saldo pendiente debe estar entre cero y el importe inicial.");
        return;
      }
      const id = debtForm.id ?? Data.newId();
      if (await commitFinance((current) => {
        const debts2 = current.debts || [];
        const old = debts2.find((d) => d.id === id);
        if (debtForm.id && !old) throw new Error("Esta deuda fue eliminada.");
        if (old && Number(old.currentBalance) !== Number(debtForm.balanceAtEdit)) throw new Error("La deuda cambi\xF3 desde que empezaste a editar. Vuelve a abrirla.");
        const debt = { ...old, id, name: debtForm.name.trim(), type: debtForm.type, originalAmount: Data.money(originalAmount), currentBalance: Data.money(currentBalance), dueDate: debtForm.dueDate, notes: debtForm.notes.trim(), payments: old?.payments || [], createdAt: old?.createdAt || getTodayString(), status: currentBalance === 0 ? "saldada" : "activa", paidAt: currentBalance === 0 ? old?.paidAt || getTodayString() : null };
        return { debts: old ? debts2.map((d) => d.id === id ? debt : d) : [debt, ...debts2] };
      })) setDebtForm({ id: null, name: "", type: "tarjeta", originalAmount: "", currentBalance: "", dueDate: "", notes: "" });
    };
    const handleEditDebtClick = (debt) => {
      setDebtForm({
        ...debt,
        balanceAtEdit: debt.currentBalance,
        originalAmount: debt.originalAmount || "",
        currentBalance: debt.currentBalance ?? "",
        dueDate: debt.dueDate || "",
        notes: debt.notes || ""
      });
    };
    const handleDeleteDebt = async (debtId) => {
      if (window.confirm("\xBFEliminar esta deuda? Los pagos ya realizados permanecer\xE1n como egresos en el historial.")) {
        if (await commitFinance((current) => ({
          debts: (current.debts || []).filter((d) => d.id !== debtId),
          finances: (current.finances || []).map((t) => t.debtId === debtId ? { ...t, debtId: null, paymentId: null } : t)
        }))) {
          if (debtForm.id === debtId) setDebtForm({ id: null, name: "", type: "tarjeta", originalAmount: "", currentBalance: "", dueDate: "", notes: "" });
          if (debtPayment.debtId === debtId) setDebtPayment({ isOpen: false, debtId: null, amount: "", account: "" });
        }
      }
    };
    const openDebtPayment = (debt) => {
      const defaultAccount = normalizedAccounts[0]?.id || "nequi";
      setDebtPayment({ isOpen: true, debtId: debt.id, amount: debt.currentBalance || "", account: defaultAccount });
    };
    const handlePayDebt = async (e) => {
      e.preventDefault();
      const id = Data.newId();
      if (await commitFinance((current) => Data.payDebt(current, debtPayment.debtId, debtPayment.account, debtPayment.amount, id, getTodayString()))) {
        setDebtPayment({ isOpen: false, debtId: null, amount: "", account: normalizedAccounts[0]?.id || "" });
      }
    };
    const handleResetFinances = async () => {
      if (window.confirm("\u26A0\uFE0F Se eliminar\xE1n todas las cuentas personalizadas, movimientos, deudas y saldos iniciales. \xBFEmpezar de cero?")) {
        if (await commitFinance(() => Data.resetFinances())) {
          clearFinanceForm();
          setDebtForm({ id: null, name: "", type: "tarjeta", originalAmount: "", currentBalance: "", dueDate: "", notes: "" });
          setDebtPayment({ isOpen: false, debtId: null, amount: "", account: "" });
          setIsEditingBalances(false);
          setTempBalances({});
        }
      }
    };
    const saveBaseBalances = async () => {
      if (await commitFinance((current) => {
        const baseBalances2 = Object.fromEntries(Data.accountsFor(current).map((a) => {
          const value = Number(tempBalances[a.id] ?? current.baseBalances?.[a.id] ?? 0);
          if (!Number.isFinite(value) || value < 0) throw new Error("Los saldos iniciales deben ser n\xFAmeros mayores o iguales a cero.");
          return [a.id, Data.money(value)];
        }));
        return { baseBalances: baseBalances2 };
      })) setIsEditingBalances(false);
    };
    const handleResetHabits = () => {
      if (window.confirm("\u26A0\uFE0F ADVERTENCIA: Est\xE1s a punto de borrar TODOS tus h\xE1bitos y el historial de progreso. \xBFEst\xE1s seguro de empezar de cero?")) {
        commitCloud(() => ({ habitsList: [], habitCompletions: {} }));
      }
    };
    const addTaskToDay = async (dayIndex) => {
      if (!newTask.text.trim()) return;
      const task = { id: Data.newId(), text: newTask.text, time: newTask.time, status: "sin_empezar", is8020: true };
      const saved = await setWeeklyGoals((prev) => {
        const updated = [...prev];
        updated[dayIndex] = { ...updated[dayIndex], tasks: [...updated[dayIndex].tasks, task] };
        return updated;
      });
      if (saved) setNewTask({ text: "", time: "" });
    };
    const updateTaskStatus = (dayIndex, taskId, newStatus) => {
      setWeeklyGoals((prev) => {
        const updated = [...prev];
        updated[dayIndex] = { ...updated[dayIndex], tasks: updated[dayIndex].tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t) };
        return updated;
      });
    };
    const deleteTask = (dayIndex, taskId) => {
      setWeeklyGoals((prev) => {
        const updated = [...prev];
        updated[dayIndex] = { ...updated[dayIndex], tasks: updated[dayIndex].tasks.filter((t) => t.id !== taskId) };
        return updated;
      });
    };
    const updateDailyGoal = (dayIndex, text) => {
      setWeeklyGoals((prev) => {
        const updated = [...prev];
        updated[dayIndex] = { ...updated[dayIndex], dailyGoal: text };
        return updated;
      });
    };
    const addHealthLog = async (e) => {
      e.preventDefault();
      if (!healthForm.meal) return;
      const log = { id: Data.newId(), date: (/* @__PURE__ */ new Date()).toLocaleString(), ...healthForm };
      if (!await setHealthLogs((prev) => [log, ...prev])) return;
      setHealthForm({ meal: "", symptoms: "Ninguno", painLevel: 1 });
    };
    const toggleGymDay = (id) => {
      const routine = gymRoutine.find((g) => g.id === id);
      if (!routine) return;
      if (!routine.completed) {
        setCardioPrompt({ isOpen: true, routineId: id });
      } else {
        setGymRoutine((prev) => prev.map((g) => g.id === id ? { ...g, completed: false, isCardioDone: false } : g));
      }
    };
    const handleCardioResponse = (didCardio) => {
      setGymRoutine((prev) => prev.map(
        (g) => g.id === cardioPrompt.routineId ? { ...g, completed: true, isCardioDone: didCardio } : g
      ));
      setCardioPrompt({ isOpen: false, routineId: null });
    };
    const handleUpdateGymRoutine = (id, field, value) => {
      setGymRoutine((prev) => prev.map((g) => g.id === id ? { ...g, [field]: value } : g));
    };
    const handleAddRoutine = async () => {
      if (!newRoutine.focus.trim() || !Number.isFinite(Number(newRoutine.duration)) || Number(newRoutine.duration) < 0) return;
      const routine = { id: Data.newId(), ...newRoutine, isCardioDone: false, completed: false };
      if (!await setGymRoutine((prev) => [...prev, routine])) return;
      setNewRoutine({ day: "Lunes", focus: "", duration: 60 });
    };
    const handleDeleteRoutine = (id) => {
      setGymRoutine((prev) => prev.filter((g) => g.id !== id));
    };
    if (authLoading) {
      return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-500" }, "Comprobando seguridad...");
    }
    if (!user) {
      return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "absolute top-0 right-0 p-4 opacity-10" }, /* @__PURE__ */ React.createElement(Shield, { className: "w-32 h-32 text-emerald-500" })), /* @__PURE__ */ React.createElement("div", { className: "relative z-10" }, /* @__PURE__ */ React.createElement("div", { className: "w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 text-white font-bold text-xl" }, "A"), /* @__PURE__ */ React.createElement("h1", { className: "text-3xl font-extrabold text-white mb-2" }, "Adventure"), /* @__PURE__ */ React.createElement("p", { className: "text-slate-400 text-sm mb-8" }, "Base de datos protegida. Ingresa tu llave de acceso para continuar a tu panel de control."), /* @__PURE__ */ React.createElement("form", { onSubmit: handleLogin, className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block" }, "Correo de Administrador"), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "email",
          required: true,
          value: loginForm.email,
          onChange: (e) => setLoginForm({ ...loginForm, email: e.target.value }),
          className: "w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-emerald-500 transition-colors"
        }
      )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block" }, "Contrase\xF1a de Seguridad"), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: showPassword ? "text" : "password",
          required: true,
          value: loginForm.password,
          onChange: (e) => setLoginForm({ ...loginForm, password: e.target.value }),
          className: "w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-emerald-500 transition-colors pr-12"
        }
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: () => setShowPassword(!showPassword),
          className: "absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors p-1"
        },
        showPassword ? /* @__PURE__ */ React.createElement(EyeOff, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(Eye, { className: "w-5 h-5" })
      ))), loginError && /* @__PURE__ */ React.createElement("p", { className: "text-red-400 text-xs font-medium bg-red-500/10 border border-red-500/20 p-3 rounded leading-relaxed" }, loginError), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors mt-4 shadow-lg shadow-emerald-500/20" }, "Desbloquear Sistema")))), /* @__PURE__ */ React.createElement("p", { className: "text-slate-600 text-xs mt-6 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Shield, { className: "w-3 h-3" }), " Protegido con Firebase Auth 256-bit"));
    }
    const renderHabits = () => /* @__PURE__ */ React.createElement("div", { className: "space-y-6 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row justify-between items-center bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-700 gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement(CalendarDays, { className: "text-emerald-500 w-6 h-6" }), /* @__PURE__ */ React.createElement("input", { type: "date", value: selectedDate, onChange: (e) => setSelectedDate(e.target.value), className: "bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none focus:border-emerald-500 w-full sm:w-auto font-medium" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement("button", { onClick: handleResetHabits, className: "flex items-center gap-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors w-full sm:w-auto justify-center font-bold tracking-wide" }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" }), " Empezar de cero"))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider" }, "Score Bienestar"), /* @__PURE__ */ React.createElement(Zap, { className: `w-5 h-5 ${habitAnalytics.currentWeekScore >= 70 ? "text-yellow-400" : "text-slate-500"}` })), /* @__PURE__ */ React.createElement("div", { className: "flex items-end gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-3xl font-bold text-white" }, habitAnalytics.currentWeekScore, "%"), /* @__PURE__ */ React.createElement("span", { className: `text-xs font-medium mb-1 ${habitAnalytics.trend >= 0 ? "text-emerald-400" : "text-red-400"}` }, habitAnalytics.trend >= 0 ? "+" : "", habitAnalytics.trend, "% vs sem ant."))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider" }, "H\xE1bito Fuerte"), /* @__PURE__ */ React.createElement(Trophy, { className: "w-5 h-5 text-emerald-400" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-white leading-tight block truncate" }, habitAnalytics.strongestHabit ? habitAnalytics.strongestHabit.text : "---"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-500" }, "\xDAltimos 30 d\xEDas"))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider" }, "Por Mejorar"), /* @__PURE__ */ React.createElement(AlertTriangle, { className: "w-5 h-5 text-orange-400" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-white leading-tight block truncate" }, habitAnalytics.weakestHabit ? habitAnalytics.weakestHabit.text : "---"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-500" }, "\xDAltimos 30 d\xEDas"))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wider" }, "Progreso Hoy"), /* @__PURE__ */ React.createElement(Target, { className: "w-5 h-5 text-blue-400" })), /* @__PURE__ */ React.createElement("div", { className: "w-full bg-slate-900 rounded-full h-2.5 mb-1 mt-2" }, /* @__PURE__ */ React.createElement("div", { className: "bg-blue-500 h-2.5 rounded-full transition-all duration-1000", style: { width: `${Math.min(habitsList.length > 0 ? currentCompletedIds.length / habitsList.length * 100 : 0, 100)}%` } })), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-medium text-white text-right" }, currentCompletedIds.length, " / ", habitsList.length, " completados"))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "lg:col-span-2 bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden flex flex-col" }, /* @__PURE__ */ React.createElement("h3", { className: "font-semibold text-white p-5 border-b border-slate-700 flex items-center gap-2 bg-slate-800/80" }, /* @__PURE__ */ React.createElement(ListTodo, { className: "w-5 h-5 text-emerald-500" }), " Lista de H\xE1bitos"), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-x-auto w-full" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-left text-sm text-slate-300 min-w-[500px]" }, /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-slate-700/50" }, habitsList.length === 0 ? /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { colSpan: "5", className: "p-8 text-center text-slate-500 text-sm" }, "No tienes h\xE1bitos registrados.")) : habitsList.map((habit) => {
      const isCompleted = currentCompletedIds.includes(habit.id);
      const cat = CATEGORIES[habit.category || "rutina"];
      const streak = habitAnalytics.streaks[habit.id] || 0;
      const isEditing = editingHabitId === habit.id;
      if (isEditing) {
        return /* @__PURE__ */ React.createElement("tr", { key: habit.id, className: "bg-slate-700/30" }, /* @__PURE__ */ React.createElement("td", { colSpan: "5", className: "p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-2" }, /* @__PURE__ */ React.createElement("input", { value: editHabitForm.text, onChange: (e) => setEditHabitForm({ ...editHabitForm, text: e.target.value }), className: "bg-slate-900 text-sm text-white border border-slate-600 rounded p-2 outline-none focus:border-emerald-500 w-full sm:flex-1", placeholder: "H\xE1bito..." }), /* @__PURE__ */ React.createElement("select", { value: editHabitForm.category, onChange: (e) => setEditHabitForm({ ...editHabitForm, category: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none focus:border-emerald-500 w-full sm:w-auto" }, Object.entries(CATEGORIES).map(([key, cat2]) => /* @__PURE__ */ React.createElement("option", { key, value: key }, cat2.label))), /* @__PURE__ */ React.createElement("input", { type: "time", value: editHabitForm.startTime, onChange: (e) => setEditHabitForm({ ...editHabitForm, startTime: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-24 focus:border-emerald-500" }), /* @__PURE__ */ React.createElement("input", { type: "time", value: editHabitForm.endTime, onChange: (e) => setEditHabitForm({ ...editHabitForm, endTime: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-24 focus:border-emerald-500" }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 mt-2 sm:mt-0" }, /* @__PURE__ */ React.createElement("button", { onClick: saveEditingHabit, className: "bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded text-xs font-bold transition-colors" }, "Guardar"), /* @__PURE__ */ React.createElement("button", { onClick: () => setEditingHabitId(null), className: "bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded text-xs font-bold transition-colors" }, "Cancelar")))));
      }
      return /* @__PURE__ */ React.createElement("tr", { key: habit.id, className: "hover:bg-slate-700/30 transition-colors group" }, /* @__PURE__ */ React.createElement("td", { className: "px-4 py-3 text-center w-12" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleHabitCompletion(habit.id), className: "focus:outline-none translate-y-[2px]" }, isCompleted ? /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-6 h-6 text-emerald-500 mx-auto transition-transform scale-110" }) : /* @__PURE__ */ React.createElement(Circle, { className: "w-6 h-6 text-slate-500 mx-auto hover:text-slate-400" }))), /* @__PURE__ */ React.createElement("td", { className: "px-2 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: `font-medium transition-colors ${isCompleted ? "text-slate-500 line-through" : "text-slate-100"}` }, habit.text), streak >= 3 && /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-0.5 text-xs font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded", title: "Racha actual" }, /* @__PURE__ */ React.createElement(Flame, { className: "w-3 h-3" }), " ", streak))), /* @__PURE__ */ React.createElement("td", { className: "px-2 py-3 w-32" }, /* @__PURE__ */ React.createElement("span", { className: `text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${cat.bg} ${cat.color}` }, cat.label)), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-3 text-xs text-slate-400 whitespace-nowrap text-right w-32" }, habit.startTime || "--:--", " ", /* @__PURE__ */ React.createElement("span", { className: "opacity-50 mx-1" }, "-"), " ", habit.endTime || "--:--"), /* @__PURE__ */ React.createElement("td", { className: "px-2 py-3 w-16 text-right sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-end gap-1" }, /* @__PURE__ */ React.createElement("button", { onClick: () => startEditingHabit(habit), className: "p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded transition-colors", title: "Editar" }, /* @__PURE__ */ React.createElement(Edit2, { className: "w-3.5 h-3.5" })), /* @__PURE__ */ React.createElement("button", { onClick: () => handleDeleteHabit(habit.id), className: "p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors", title: "Eliminar" }, /* @__PURE__ */ React.createElement(XIcon, { className: "w-3.5 h-3.5" })))));
    })))), /* @__PURE__ */ React.createElement("div", { className: "border-t border-slate-700 p-4 bg-slate-800/50" }, /* @__PURE__ */ React.createElement("h4", { className: "text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Plus, { className: "w-4 h-4" }), " Agregar Nuevo H\xE1bito"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-2" }, /* @__PURE__ */ React.createElement("input", { value: newHabit.text, onChange: (e) => setNewHabit({ ...newHabit, text: e.target.value }), placeholder: "Descripci\xF3n...", onKeyDown: (e) => e.key === "Enter" && handleAddHabit(), className: "bg-slate-900 text-sm text-white border border-slate-600 rounded p-2 outline-none w-full sm:flex-1 focus:border-emerald-500" }), /* @__PURE__ */ React.createElement("select", { value: newHabit.category, onChange: (e) => setNewHabit({ ...newHabit, category: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-auto focus:border-emerald-500" }, Object.entries(CATEGORIES).map(([key, cat]) => /* @__PURE__ */ React.createElement("option", { key, value: key }, cat.label))), /* @__PURE__ */ React.createElement("input", { type: "time", value: newHabit.startTime, onChange: (e) => setNewHabit({ ...newHabit, startTime: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-24 focus:border-emerald-500" }), /* @__PURE__ */ React.createElement("input", { type: "time", value: newHabit.endTime, onChange: (e) => setNewHabit({ ...newHabit, endTime: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-24 focus:border-emerald-500" }), /* @__PURE__ */ React.createElement("button", { onClick: handleAddHabit, className: "bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-500 font-bold w-full sm:w-auto transition-colors" }, "A\xF1adir")))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-white mb-4 uppercase tracking-wider" }, "Cumplimiento por \xC1rea"), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, Object.entries(CATEGORIES).map(([key, cat]) => {
      const stats = habitAnalytics.categoryCompliance[key];
      if (!stats || stats.total === 0) return null;
      return /* @__PURE__ */ React.createElement("div", { key }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs mb-1" }, /* @__PURE__ */ React.createElement("span", { className: `${cat.color} font-medium` }, cat.label), /* @__PURE__ */ React.createElement("span", { className: "text-slate-400" }, stats.percentage, "%")), /* @__PURE__ */ React.createElement("div", { className: "w-full bg-slate-900 rounded-full h-1.5" }, /* @__PURE__ */ React.createElement("div", { className: `h-1.5 rounded-full ${cat.bar} transition-all duration-700`, style: { width: `${stats.percentage}%` } })));
    }))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-5 flex flex-col flex-1 min-h-[220px]" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-semibold text-white mb-4 flex items-center gap-2 uppercase tracking-wider" }, /* @__PURE__ */ React.createElement(BarChart, { className: "w-4 h-4 text-blue-500" }), "Semana Actual"), /* @__PURE__ */ React.createElement("div", { className: "relative flex-1 flex items-end justify-between gap-1 mt-auto pt-6" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 flex flex-col justify-between pointer-events-none z-0" }, [100, 50, 0].map((val) => /* @__PURE__ */ React.createElement("div", { key: val, className: "flex items-center w-full border-b border-slate-700/30 h-0" }))), habitAnalytics.trendData.map((data, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex flex-col items-center w-full group relative z-10 h-full justify-end" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-white mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 bg-slate-900 px-1 py-0.5 rounded z-20" }, data.percentage, "%"), /* @__PURE__ */ React.createElement("div", { className: `w-full max-w-[1.5rem] rounded-t-sm transition-all duration-700 relative ${data.isSelected ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-600 hover:bg-slate-500"}`, style: { height: `${data.percentage}%`, minHeight: data.percentage > 0 ? "4px" : "2px" } }), /* @__PURE__ */ React.createElement("span", { className: `text-[9px] mt-2 uppercase tracking-widest ${data.isSelected ? "text-emerald-400 font-bold" : "text-slate-500"}` }, data.dayName.charAt(0)))))))));
    const renderFinances = () => /* @__PURE__ */ React.createElement("fieldset", { disabled: pendingWrites > 0, style: { minWidth: 0 }, className: "space-y-6 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col md:flex-row justify-between items-center shadow-lg gap-6" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between mb-1" }, /* @__PURE__ */ React.createElement("p", { className: "text-slate-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2" }, "Balance Total (Capital Cuentas)"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setTempBalances(baseBalances);
      setIsEditingBalances(true);
    }, className: "md:hidden text-slate-500 hover:text-emerald-400 transition-colors", title: "Ajustar Saldos Base" }, /* @__PURE__ */ React.createElement(Settings, { className: "w-4 h-4" }))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("h2", { className: "text-4xl font-extrabold text-white" }, formatCurrency(financeData.totalBalance)), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setTempBalances(baseBalances);
      setIsEditingBalances(true);
    }, className: "hidden md:block text-slate-500 hover:text-emerald-400 transition-colors", title: "Ajustar Saldos Base" }, /* @__PURE__ */ React.createElement(Settings, { className: "w-5 h-5" })))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-center gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: handleResetFinances, className: "flex items-center gap-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors w-full sm:w-auto justify-center font-bold tracking-wide" }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" }), " Empezar de cero"), /* @__PURE__ */ React.createElement("div", { className: "flex bg-slate-900 p-1 rounded-lg border border-slate-700/50 w-full sm:w-auto" }, ["semana", "quincena", "mes", "todo"].map((period) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: period,
        onClick: () => setFinanceFilter(period),
        className: `px-3 sm:px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors flex-1 ${financeFilter === period ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`
      },
      period
    ))))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-md" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white flex items-center gap-2" }, /* @__PURE__ */ React.createElement(BarChart, { className: "w-5 h-5 text-blue-400" }), "Resumen Presupuestal (", financeFilter, ")")), /* @__PURE__ */ React.createElement("div", { className: "p-5 grid grid-cols-1 md:grid-cols-2 gap-8" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("h4", { className: "text-xs font-semibold text-emerald-400/80 uppercase border-b border-slate-700 pb-2 mb-3" }, "Flujo de Entrada"), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-300" }, "Fijos (Salario)"), /* @__PURE__ */ React.createElement("span", { className: "text-white font-medium" }, formatCurrency(financeData.ingresosFijos))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-300" }, "Variables (Clases/Extras)"), /* @__PURE__ */ React.createElement("span", { className: "text-white font-medium" }, formatCurrency(financeData.ingresosVariables))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm font-bold pt-3 border-t border-slate-700/50" }, /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400" }, "Total Ingresos"), /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400" }, formatCurrency(financeData.totalIngresos)))), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("h4", { className: "text-xs font-semibold text-red-400/80 uppercase border-b border-slate-700 pb-2 mb-3" }, "Flujo de Salida"), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-300" }, "Gastos Fijos (Casa/Servicios)"), /* @__PURE__ */ React.createElement("span", { className: "text-white font-medium" }, formatCurrency(financeData.gastosFijos))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-300" }, "Gastos Variables (Hormiga)"), /* @__PURE__ */ React.createElement("span", { className: "text-white font-medium" }, formatCurrency(financeData.gastosVariables))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", { className: "text-purple-300" }, "Ahorro Destinado"), /* @__PURE__ */ React.createElement("span", { className: "text-purple-300 font-medium" }, formatCurrency(financeData.ahorroRegistrado))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm" }, /* @__PURE__ */ React.createElement("span", { className: "text-amber-300" }, "Pagos de deuda"), /* @__PURE__ */ React.createElement("span", { className: "text-amber-300 font-medium" }, formatCurrency(financeData.pagosDeuda))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm font-bold pt-3 border-t border-slate-700/50" }, /* @__PURE__ */ React.createElement("span", { className: "text-red-400" }, "Total Salidas (Gastos, ahorro y deudas)"), /* @__PURE__ */ React.createElement("span", { className: "text-red-400" }, formatCurrency(financeData.totalEgresos))))), /* @__PURE__ */ React.createElement("div", { className: "bg-yellow-500/10 border-t border-yellow-500/20 p-5 flex justify-between items-center" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-yellow-500 font-bold uppercase tracking-wider text-sm block" }, "Balance del Periodo"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-yellow-500/60" }, "(Total Ingresos - Total Gastos)")), /* @__PURE__ */ React.createElement("span", { className: "text-3xl font-extrabold text-yellow-400" }, formatCurrency(financeData.libreTotal)))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" }, normalizedAccounts.map((account) => {
      const AccountIcon = getAccountIcon(account);
      const style = getAccountStyle(account.id);
      const estimatedYield = Number(account.yieldRate || 0) > 0 ? Number(financeData.balances[account.id] || 0) * (Math.pow(1 + Number(account.yieldRate) / 100, 1 / 12) - 1) : 0;
      return /* @__PURE__ */ React.createElement("div", { key: account.id, className: `bg-gradient-to-br ${style.card} p-5 rounded-2xl border relative overflow-hidden group shadow-md` }, /* @__PURE__ */ React.createElement("div", { className: "pointer-events-none absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity" }, /* @__PURE__ */ React.createElement(AccountIcon, { className: `w-16 h-16 ${style.text}` })), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-4 relative z-10 gap-3" }, /* @__PURE__ */ React.createElement("span", { className: `font-semibold ${style.text} flex items-center gap-2` }, /* @__PURE__ */ React.createElement(AccountIcon, { className: "w-4 h-4" }), " ", account.name), /* @__PURE__ */ React.createElement("button", { onClick: () => handleDeleteAccount(account.id), className: "text-slate-500 hover:text-red-400 transition-colors", title: "Eliminar cuenta", "aria-label": `Eliminar cuenta ${account.name}` }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" }))), /* @__PURE__ */ React.createElement("p", { className: "text-2xl font-bold text-white relative z-10" }, formatCurrency(financeData.balances[account.id] || 0)), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mt-2 relative z-10" }, account.description || account.type), Number(account.yieldRate || 0) > 0 && /* @__PURE__ */ React.createElement("p", { className: `text-xs ${style.text} mt-2 flex items-center gap-1 relative z-10` }, /* @__PURE__ */ React.createElement(TrendingUp, { className: "w-3 h-3" }), " +", formatCurrency(estimatedYield), " est. por mes"));
    })), /* @__PURE__ */ React.createElement("form", { onSubmit: handleAddAccount, className: "bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-md" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Plus, { className: "w-4 h-4 text-emerald-400" }), " Agregar cuenta"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-6 gap-3" }, /* @__PURE__ */ React.createElement("input", { value: accountForm.name, onChange: (e) => setAccountForm({ ...accountForm, name: e.target.value }), placeholder: "Nombre de cuenta", className: "md:col-span-2 bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm", required: true }), /* @__PURE__ */ React.createElement("select", { value: accountForm.type, onChange: (e) => setAccountForm({ ...accountForm, type: e.target.value }), className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }, /* @__PURE__ */ React.createElement("option", { value: "banco" }, "Banco"), /* @__PURE__ */ React.createElement("option", { value: "billetera" }, "Billetera"), /* @__PURE__ */ React.createElement("option", { value: "efectivo" }, "Efectivo")), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: accountForm.initialBalance, onChange: (e) => setAccountForm({ ...accountForm, initialBalance: e.target.value }), placeholder: "Saldo inicial", className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }), /* @__PURE__ */ React.createElement("select", { value: accountForm.color, onChange: (e) => setAccountForm({ ...accountForm, color: e.target.value }), className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }, /* @__PURE__ */ React.createElement("option", { value: "blue" }, "Azul"), /* @__PURE__ */ React.createElement("option", { value: "emerald" }, "Verde"), /* @__PURE__ */ React.createElement("option", { value: "purple" }, "Morado"), /* @__PURE__ */ React.createElement("option", { value: "pink" }, "Rosa"), /* @__PURE__ */ React.createElement("option", { value: "amber" }, "\xC1mbar")), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors" }, "Crear"), /* @__PURE__ */ React.createElement("input", { value: accountForm.description, onChange: (e) => setAccountForm({ ...accountForm, description: e.target.value }), placeholder: "Descripci\xF3n opcional", className: "md:col-span-4 bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: accountForm.yieldRate, onChange: (e) => setAccountForm({ ...accountForm, yieldRate: e.target.value }), placeholder: "% E.A opcional", className: "md:col-span-2 bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 xl:grid-cols-3 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-md" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(CreditCard, { className: "w-4 h-4 text-amber-400" }), " ", debtForm.id ? "Editar deuda" : "Nueva deuda"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleAddOrEditDebt, className: "space-y-3" }, /* @__PURE__ */ React.createElement("input", { value: debtForm.name, onChange: (e) => setDebtForm({ ...debtForm, name: e.target.value }), placeholder: "Nombre: Visa, pr\xE9stamo, familiar...", className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-amber-500 text-sm", required: true }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement("select", { value: debtForm.type, onChange: (e) => setDebtForm({ ...debtForm, type: e.target.value }), className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-amber-500 text-sm" }, Object.entries(DEBT_TYPES).map(([key, type]) => /* @__PURE__ */ React.createElement("option", { key, value: key }, type.label))), /* @__PURE__ */ React.createElement("input", { type: "date", value: debtForm.dueDate, onChange: (e) => setDebtForm({ ...debtForm, dueDate: e.target.value }), className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-amber-500 text-xs" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: debtForm.originalAmount, onChange: (e) => setDebtForm({ ...debtForm, originalAmount: e.target.value, currentBalance: debtForm.currentBalance === "" ? e.target.value : debtForm.currentBalance }), placeholder: "Deuda inicial", className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-amber-500 text-sm font-bold", required: true }), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: debtForm.currentBalance, onChange: (e) => setDebtForm({ ...debtForm, currentBalance: e.target.value }), placeholder: "Saldo pendiente", className: "bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-amber-500 text-sm font-bold" })), /* @__PURE__ */ React.createElement("input", { value: debtForm.notes, onChange: (e) => setDebtForm({ ...debtForm, notes: e.target.value }), placeholder: "Notas opcionales", className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-amber-500 text-sm" }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 pt-2" }, debtForm.id && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setDebtForm({ id: null, name: "", type: "tarjeta", originalAmount: "", currentBalance: "", dueDate: "", notes: "" }), className: "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors text-sm" }, "Cancelar"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-lg font-bold transition-colors text-sm" }, debtForm.id ? "Guardar deuda" : "Registrar deuda")))), /* @__PURE__ */ React.createElement("div", { className: "xl:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 shadow-md overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white flex items-center gap-2" }, /* @__PURE__ */ React.createElement(AlertTriangle, { className: "w-4 h-4 text-amber-400" }), " Deudas"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500" }, "Pendiente: ", formatCurrency(financeData.totalDebt), " \xB7 Pagado: ", formatCurrency(financeData.totalPaidDebt))), /* @__PURE__ */ React.createElement("span", { className: "text-xl font-extrabold text-amber-400" }, financeData.activeDebts.length, " activas")), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-700/50 max-h-[360px] overflow-y-auto" }, debts.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "p-10 text-center text-slate-500" }, "No tienes deudas registradas.") : debts.map((debt) => {
      const debtType = DEBT_TYPES[debt.type] || DEBT_TYPES.otro;
      const original = Number(debt.originalAmount || debt.currentBalance || 0);
      const current = Number(debt.currentBalance || 0);
      const paidPercent = original > 0 ? Math.round((original - current) / original * 100) : 100;
      return /* @__PURE__ */ React.createElement("div", { key: debt.id, className: `p-4 transition-colors ${current === 0 ? "bg-emerald-900/10" : "hover:bg-slate-700/30"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2 mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-white" }, debt.name), /* @__PURE__ */ React.createElement("span", { className: `text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${debtType.bg} ${debtType.color}` }, debtType.label), current === 0 && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }, "Saldada")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-4 text-xs text-slate-400" }, /* @__PURE__ */ React.createElement("span", null, "Pendiente: ", /* @__PURE__ */ React.createElement("strong", { className: "text-amber-300" }, formatCurrency(current))), /* @__PURE__ */ React.createElement("span", null, "Inicial: ", formatCurrency(original)), debt.dueDate && /* @__PURE__ */ React.createElement("span", null, "Vence: ", debt.dueDate)), /* @__PURE__ */ React.createElement("div", { className: "w-full bg-slate-900 rounded-full h-2 mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "bg-emerald-500 h-2 rounded-full transition-all duration-700", style: { width: `${Math.min(100, Math.max(0, paidPercent))}%` } })), debt.notes && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mt-2" }, debt.notes)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, current > 0 && /* @__PURE__ */ React.createElement("button", { onClick: () => openDebtPayment(debt), className: "bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors" }, "Saldar"), /* @__PURE__ */ React.createElement("button", { onClick: () => handleEditDebtClick(debt), "aria-label": `Editar deuda ${debt.name}`, className: "p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" }, /* @__PURE__ */ React.createElement(Edit2, { className: "w-4 h-4" })), /* @__PURE__ */ React.createElement("button", { onClick: () => handleDeleteDebt(debt.id), "aria-label": `Eliminar deuda ${debt.name}`, className: "p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" })))));
    })))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "lg:col-span-1 bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-col shadow-md" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white mb-4 flex items-center gap-2 pb-2 border-b border-slate-700" }, financeForm.id ? /* @__PURE__ */ React.createElement(Edit2, { className: "w-4 h-4 text-blue-400" }) : /* @__PURE__ */ React.createElement(Plus, { className: "w-4 h-4 text-emerald-400" }), financeForm.id ? "Editar Movimiento" : "Nuevo Movimiento"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleAddOrEditTransaction, className: "flex flex-col gap-4 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFinanceForm({ ...financeForm, type: "ingreso", category: "variable" }), className: `py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase transition-colors ${financeForm.type === "ingreso" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"}` }, "Ingreso"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFinanceForm({ ...financeForm, type: "egreso", category: "variable" }), className: `py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase transition-colors ${financeForm.type === "egreso" ? "bg-red-500/20 text-red-400" : "text-slate-500 hover:text-slate-300"}` }, "Egreso"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFinanceForm({ ...financeForm, type: "transferencia", category: "" }), className: `py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase transition-colors ${financeForm.type === "transferencia" ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}` }, "Transfer")), financeForm.type === "transferencia" ? /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Desde"), /* @__PURE__ */ React.createElement("select", { value: financeForm.account, onChange: (e) => setFinanceForm({ ...financeForm, account: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }, normalizedAccounts.map((account) => /* @__PURE__ */ React.createElement("option", { key: account.id, value: account.id }, account.name)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Hacia"), /* @__PURE__ */ React.createElement("select", { value: financeForm.toAccount, onChange: (e) => setFinanceForm({ ...financeForm, toAccount: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }, normalizedAccounts.map((account) => /* @__PURE__ */ React.createElement("option", { key: account.id, value: account.id }, account.name))))) : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Cuenta"), /* @__PURE__ */ React.createElement("select", { value: financeForm.account, onChange: (e) => setFinanceForm({ ...financeForm, account: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }, normalizedAccounts.map((account) => /* @__PURE__ */ React.createElement("option", { key: account.id, value: account.id }, account.name)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Clasificaci\xF3n"), /* @__PURE__ */ React.createElement("select", { value: financeForm.category, onChange: (e) => setFinanceForm({ ...financeForm, category: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" }, FINANCE_CATEGORIES[financeForm.type].map((c) => /* @__PURE__ */ React.createElement("option", { key: c.id, value: c.id }, c.label))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Monto (COP)"), /* @__PURE__ */ React.createElement("input", { type: "number", required: true, min: "0", step: "0.01", value: financeForm.amount, onChange: (e) => setFinanceForm({ ...financeForm, amount: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm font-bold", placeholder: "Ej. 50000" })), /* @__PURE__ */ React.createElement("div", { className: "w-2/5" }, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Fecha"), /* @__PURE__ */ React.createElement("input", { type: "date", required: true, value: financeForm.date, onChange: (e) => setFinanceForm({ ...financeForm, date: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-xs" }))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs text-slate-400 mb-1 block" }, "Detalle / Concepto"), /* @__PURE__ */ React.createElement("input", { type: "text", required: true, value: financeForm.description, onChange: (e) => setFinanceForm({ ...financeForm, description: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm", placeholder: "Ej. Almuerzo, Sueldo, Clases..." })), /* @__PURE__ */ React.createElement("div", { className: "mt-auto pt-4 flex gap-2" }, financeForm.id && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFinanceForm({ id: null, type: "egreso", amount: "", description: "", account: normalizedAccounts[0]?.id || "nequi", toAccount: normalizedAccounts[1]?.id || normalizedAccounts[0]?.id || "nubank", category: "variable", date: getTodayString() }), className: "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors text-sm" }, "Cancelar"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-bold transition-colors text-sm shadow-lg shadow-blue-500/20" }, financeForm.id ? "Guardar Cambios" : "Registrar Movimiento")))), /* @__PURE__ */ React.createElement("div", { className: "lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col shadow-md" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Activity, { className: "w-4 h-4 text-slate-400" }), " Libro de Transacciones")), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-700/50 flex-1 overflow-y-auto max-h-[500px]" }, financeData.filteredList.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "p-10 flex flex-col items-center text-slate-500" }, /* @__PURE__ */ React.createElement(Landmark, { className: "w-12 h-12 mb-3 opacity-20" }), /* @__PURE__ */ React.createElement("p", null, "No hay movimientos en este periodo.")) : financeData.filteredList.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.id, className: "flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 hover:bg-slate-700/30 group transition-colors gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: `p-2 rounded-xl ${item.type === "ingreso" ? "bg-emerald-500/20 text-emerald-400" : item.type === "egreso" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}` }, item.type === "ingreso" ? /* @__PURE__ */ React.createElement(TrendingUp, { className: "w-5 h-5" }) : item.type === "egreso" ? /* @__PURE__ */ React.createElement(TrendingDown, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(ArrowRightLeft, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-slate-200 font-bold text-sm" }, item.description), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2 mt-1" }, item.type === "transferencia" ? /* @__PURE__ */ React.createElement("span", { className: "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border bg-blue-900/20 text-blue-400 border-blue-500/30 flex items-center gap-1" }, getAccountName(item.account), " ", /* @__PURE__ */ React.createElement(ArrowRightLeft, { className: "w-2 h-2" }), " ", getAccountName(item.toAccount)) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: `text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getAccountStyle(item.account).badge}` }, getAccountName(item.account || "efectivo")), item.category && /* @__PURE__ */ React.createElement("span", { className: "text-[9px] uppercase tracking-wider text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded" }, item.category)), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-slate-500 opacity-80" }, item.date)))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-12 sm:pl-0" }, /* @__PURE__ */ React.createElement("span", { className: `font-extrabold tracking-wide ${item.type === "ingreso" ? "text-emerald-400" : item.type === "egreso" ? "text-red-400" : "text-blue-400"}` }, item.type === "ingreso" ? "+" : item.type === "egreso" ? "-" : "", formatCurrency(item.amount)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement("button", { onClick: () => handleEditTransactionClick(item), "aria-label": `Editar movimiento ${item.description}`, className: "p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" }, /* @__PURE__ */ React.createElement(Edit2, { className: "w-4 h-4" })), /* @__PURE__ */ React.createElement("button", { onClick: () => handleDeleteTransaction(item.id), "aria-label": `Eliminar movimiento ${item.description}`, className: "p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" }))))))))), isEditingBalances && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-center mb-4" }, /* @__PURE__ */ React.createElement(Landmark, { className: "w-12 h-12 text-emerald-400" })), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold text-white mb-2 text-center" }, "Ajustar Saldos Base"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mb-6 text-center" }, "Define el dinero exacto con el que est\xE1s empezando en cada cuenta. Esto evita tener n\xFAmeros negativos."), /* @__PURE__ */ React.createElement("div", { className: "space-y-4 max-h-[55vh] overflow-y-auto pr-1" }, normalizedAccounts.map((account) => {
      const style = getAccountStyle(account.id);
      return /* @__PURE__ */ React.createElement("div", { key: account.id }, /* @__PURE__ */ React.createElement("label", { className: `block mb-1 text-xs font-semibold ${style.text} uppercase tracking-wider` }, "Saldo en ", account.name), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: tempBalances[account.id] ?? 0, onChange: (e) => setTempBalances({ ...tempBalances, [account.id]: parseFloat(e.target.value) || 0 }), className: `w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none ${style.focus} font-bold` }));
    })), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setIsEditingBalances(false), className: "flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors" }, "Cancelar"), /* @__PURE__ */ React.createElement("button", { onClick: saveBaseBalances, className: "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-colors" }, "Guardar")))), debtPayment.isOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-slate-950/80 z-[110] flex items-center justify-center p-4 animate-in fade-in" }, /* @__PURE__ */ React.createElement("form", { onSubmit: handlePayDebt, className: "bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-center mb-4" }, /* @__PURE__ */ React.createElement(CreditCard, { className: "w-12 h-12 text-amber-400" })), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold text-white mb-2 text-center" }, "Saldar deuda"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mb-6 text-center" }, "Indica cu\xE1nto vas a pagar y de qu\xE9 cuenta saldr\xE1 el dinero."), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-1 text-xs font-semibold text-amber-400 uppercase tracking-wider" }, "Monto a pagar"), /* @__PURE__ */ React.createElement("input", { type: "number", min: "0", step: "0.01", value: debtPayment.amount, onChange: (e) => setDebtPayment({ ...debtPayment, amount: e.target.value }), className: "w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-amber-500 font-bold", required: true })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-1 text-xs font-semibold text-blue-400 uppercase tracking-wider" }, "Cuenta de salida"), /* @__PURE__ */ React.createElement("select", { value: debtPayment.account, onChange: (e) => setDebtPayment({ ...debtPayment, account: e.target.value }), className: "w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-blue-500" }, normalizedAccounts.map((account) => /* @__PURE__ */ React.createElement("option", { key: account.id, value: account.id }, account.name))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setDebtPayment({ isOpen: false, debtId: null, amount: "", account: normalizedAccounts[0]?.id || "nequi" }), className: "flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors" }, "Cancelar"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-colors" }, "Registrar pago")))));
    const renderGoals = () => /* @__PURE__ */ React.createElement("div", { className: "space-y-6 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "bg-gradient-to-r from-blue-900 to-slate-800 p-6 rounded-2xl shadow-lg border border-blue-800" }, /* @__PURE__ */ React.createElement("label", { className: "block text-blue-200 text-sm font-semibold mb-2" }, "META GLOBAL DE LA SEMANA"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: globalGoal,
        onChange: (e) => setGlobalGoal(e.target.value),
        className: "w-full bg-transparent text-xl md:text-2xl font-bold text-white border-b-2 border-blue-500 focus:outline-none focus:border-blue-300 pb-2",
        placeholder: "Escribe tu meta principal aqu\xED..."
      }
    ), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-blue-300 mt-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Target, { className: "w-4 h-4" }), " Principio 80/20: Enf\xF3cate en el 20% de acciones que dan el 80% de resultados.")), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, weeklyGoals.map((dayPlan, index) => {
      const isExpanded = expandedDay === dayPlan.day;
      return /* @__PURE__ */ React.createElement("div", { key: dayPlan.day, className: `bg-slate-800 rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? "border-emerald-500/50 shadow-lg" : "border-slate-700 hover:border-slate-600"}` }, /* @__PURE__ */ React.createElement("button", { onClick: () => setExpandedDay(isExpanded ? null : dayPlan.day), className: "w-full flex items-center justify-between p-4 bg-slate-800/80 focus:outline-none" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("h3", { className: `font-bold text-lg ${isExpanded ? "text-emerald-400" : "text-slate-200"}` }, dayPlan.day), !isExpanded && dayPlan.tasks.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full" }, dayPlan.tasks.length, " tareas")), isExpanded ? /* @__PURE__ */ React.createElement(ChevronUp, { className: "text-slate-400" }) : /* @__PURE__ */ React.createElement(ChevronDown, { className: "text-slate-400" })), isExpanded && /* @__PURE__ */ React.createElement("div", { className: "p-4 border-t border-slate-700/50 bg-slate-900/30" }, /* @__PURE__ */ React.createElement("div", { className: "mb-6" }, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-slate-400 uppercase mb-1 block" }, "Meta General del D\xEDa"), /* @__PURE__ */ React.createElement("input", { type: "text", placeholder: "Ej: Terminar m\xF3dulo 1 del curso...", value: dayPlan.dailyGoal, onChange: (e) => updateDailyGoal(index, e.target.value), className: "w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white focus:border-emerald-500 focus:outline-none" })), /* @__PURE__ */ React.createElement("div", { className: "space-y-3 mb-6" }, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-semibold text-slate-400 uppercase block" }, "Actividades Clave (20%)"), dayPlan.tasks.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 italic" }, "No hay actividades registradas a\xFAn.") : dayPlan.tasks.map((task) => /* @__PURE__ */ React.createElement("div", { key: task.id, className: `flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${STATUS_CONFIG[task.status].color}` }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-bold uppercase" }, "20%"), task.text), task.time && /* @__PURE__ */ React.createElement("span", { className: "text-xs mt-1 flex items-center gap-1 opacity-80" }, /* @__PURE__ */ React.createElement(Clock, { className: "w-3 h-3" }), " ", task.time)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-2 sm:mt-0" }, /* @__PURE__ */ React.createElement("select", { value: task.status, onChange: (e) => updateTaskStatus(index, task.id, e.target.value), className: "text-xs bg-black/20 border border-transparent rounded p-1.5 outline-none cursor-pointer hover:border-white/20 font-medium" }, /* @__PURE__ */ React.createElement("option", { value: "sin_empezar", className: "bg-slate-800 text-white" }, "Sin empezar"), /* @__PURE__ */ React.createElement("option", { value: "en_curso", className: "bg-slate-800 text-white" }, "En curso"), /* @__PURE__ */ React.createElement("option", { value: "realizado", className: "bg-slate-800 text-white" }, "Realizado")), /* @__PURE__ */ React.createElement("button", { onClick: () => deleteTask(index, task.id), className: "p-1.5 hover:bg-black/20 rounded transition-colors text-inherit opacity-70 hover:opacity-100" }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" })))))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-3 rounded-lg border border-slate-700" }, /* @__PURE__ */ React.createElement("h4", { className: "text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Plus, { className: "w-3 h-3" }), " Agregar Actividad"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-2" }, /* @__PURE__ */ React.createElement("input", { type: "text", placeholder: "Horario (Ej. 10:00am - 12:00pm)", value: newTask.time, onChange: (e) => setNewTask({ ...newTask, time: e.target.value }), className: "bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white focus:border-emerald-500 outline-none sm:w-1/3" }), /* @__PURE__ */ React.createElement("input", { type: "text", placeholder: "Describe la actividad clave...", value: newTask.text, onChange: (e) => setNewTask({ ...newTask, text: e.target.value }), onKeyDown: (e) => e.key === "Enter" && addTaskToDay(index), className: "flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none" }), /* @__PURE__ */ React.createElement("button", { onClick: () => addTaskToDay(index), className: "bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded transition-colors font-medium text-sm flex justify-center items-center gap-1" }, "A\xF1adir")))));
    })));
    const renderHealth = () => /* @__PURE__ */ React.createElement("div", { className: "space-y-6 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "bg-rose-900/30 p-6 rounded-2xl border border-rose-800/50 text-center" }, /* @__PURE__ */ React.createElement(Activity, { className: "w-12 h-12 text-rose-400 mx-auto mb-3" }), /* @__PURE__ */ React.createElement("h2", { className: "text-2xl font-bold text-white" }, "Control Colon Irritable"), /* @__PURE__ */ React.createElement("p", { className: "text-rose-200/70 text-sm mt-2" }, "Registra tus comidas y s\xEDntomas para encontrar patrones.")), /* @__PURE__ */ React.createElement("form", { onSubmit: addHealthLog, className: "bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block text-slate-400 text-sm mb-1" }, "\xBFQu\xE9 comiste?"), /* @__PURE__ */ React.createElement("input", { type: "text", placeholder: "Ej. Avena con leche de almendras", value: healthForm.meal, onChange: (e) => setHealthForm({ ...healthForm, meal: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-3 outline-none focus:border-rose-500" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block text-slate-400 text-sm mb-1" }, "S\xEDntomas presentados"), /* @__PURE__ */ React.createElement("select", { value: healthForm.symptoms, onChange: (e) => setHealthForm({ ...healthForm, symptoms: e.target.value }), className: "w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-3 outline-none focus:border-rose-500" }, /* @__PURE__ */ React.createElement("option", { value: "Ninguno" }, "Ninguno (Me siento bien)"), /* @__PURE__ */ React.createElement("option", { value: "Inflamaci\xF3n leve" }, "Inflamaci\xF3n leve"), /* @__PURE__ */ React.createElement("option", { value: "Inflamaci\xF3n severa" }, "Inflamaci\xF3n severa"), /* @__PURE__ */ React.createElement("option", { value: "Dolor abdominal" }, "Dolor abdominal"), /* @__PURE__ */ React.createElement("option", { value: "Gases" }, "Gases / Pesadez"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block text-slate-400 text-sm mb-1" }, "Nivel de molestia (1-5)"), /* @__PURE__ */ React.createElement("input", { type: "range", min: "1", max: "5", value: healthForm.painLevel, onChange: (e) => setHealthForm({ ...healthForm, painLevel: parseInt(e.target.value) }), className: "w-full mt-3 accent-rose-500" }), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-500 mt-1" }, /* @__PURE__ */ React.createElement("span", null, "1 (Nada)"), " ", /* @__PURE__ */ React.createElement("span", null, "5 (Mucho)")))), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "w-full bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-lg font-semibold transition-colors" }, "Guardar Registro")), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white px-1" }, "Diario de Alimentaci\xF3n"), healthLogs.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-center text-slate-500 py-4" }, "No hay registros recientes.") : healthLogs.map((log) => /* @__PURE__ */ React.createElement("div", { key: log.id, className: "bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row md:justify-between md:items-center gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-white font-medium" }, log.meal), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400" }, log.date)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: `text-xs px-2 py-1 rounded-full font-semibold ${log.symptoms === "Ninguno" ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"}` }, log.symptoms), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400 flex items-center gap-1" }, "Nivel: ", /* @__PURE__ */ React.createElement("strong", { className: log.painLevel > 3 ? "text-rose-400" : "text-slate-200" }, log.painLevel, "/5")))))));
    const renderGym = () => /* @__PURE__ */ React.createElement("div", { className: "space-y-6 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row justify-between items-center bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-700 gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(Dumbbell, { className: "w-6 h-6 text-indigo-500" }), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-white" }, "Panel de Entrenamiento")), /* @__PURE__ */ React.createElement("button", { onClick: () => setIsEditingGym((prev) => !prev), className: `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors w-full sm:w-auto justify-center ${isEditingGym ? "bg-indigo-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"}` }, isEditingGym ? /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-4 h-4" }) : /* @__PURE__ */ React.createElement(Settings, { className: "w-4 h-4" }), isEditingGym ? "Finalizar Edici\xF3n" : "Configurar Rutina")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-rose-400 uppercase tracking-wider" }, "Puntos Vitalidad"), /* @__PURE__ */ React.createElement(Heart, { className: "w-4 h-4 text-rose-500" })), /* @__PURE__ */ React.createElement("div", { className: "flex items-baseline gap-1 mt-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-3xl font-extrabold text-white" }, gymAnalytics.vitalityPoints), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400 mb-1" }, "pts")), /* @__PURE__ */ React.createElement("p", { className: "text-[9px] text-slate-500 mt-1" }, "+10 por rutina / +5 extra cardio")), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-indigo-400 uppercase tracking-wider" }, "M\xFAsculo Estrella"), /* @__PURE__ */ React.createElement(Flame, { className: "w-4 h-4 text-orange-500" })), /* @__PURE__ */ React.createElement("p", { className: "text-lg font-bold text-white leading-tight mt-2" }, gymAnalytics.topMuscle), /* @__PURE__ */ React.createElement("p", { className: "text-[9px] text-slate-500 mt-1" }, "Mayor frecuencia completada")), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between relative group" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-blue-400 uppercase tracking-wider" }, "Calculadora MIC/IMC"), /* @__PURE__ */ React.createElement(Activity, { className: "w-4 h-4 text-blue-500" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col mt-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-baseline gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-2xl font-extrabold text-white" }, gymAnalytics.mic > 0 ? gymAnalytics.mic : "--"), gymAnalytics.mic > 0 && /* @__PURE__ */ React.createElement("span", { className: `text-[10px] uppercase font-bold tracking-wider ${gymAnalytics.micStatus.color}` }, gymAnalytics.micStatus.text))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mt-2" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        placeholder: "Peso(Kg)",
        value: bodyMetrics.weight,
        onChange: (e) => {
          const value = e.target.value;
          setBodyMetrics((prev) => ({ ...prev, weight: value }));
        },
        className: "w-1/2 bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-white outline-none focus:border-blue-500"
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        placeholder: "Alt(m)",
        value: bodyMetrics.height,
        step: "0.01",
        onChange: (e) => {
          const value = e.target.value;
          setBodyMetrics((prev) => ({ ...prev, height: value }));
        },
        className: "w-1/2 bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-white outline-none focus:border-blue-500"
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-emerald-400 uppercase tracking-wider" }, "Progreso Semanal"), /* @__PURE__ */ React.createElement(Target, { className: "w-4 h-4 text-emerald-500" })), /* @__PURE__ */ React.createElement("div", { className: "flex items-baseline gap-1 mt-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-3xl font-extrabold text-white" }, gymAnalytics.progress, "%")), /* @__PURE__ */ React.createElement("div", { className: "w-full bg-slate-900 rounded-full h-1.5 mt-2" }, /* @__PURE__ */ React.createElement("div", { className: "bg-emerald-500 h-1.5 rounded-full transition-all duration-1000", style: { width: `${gymAnalytics.progress}%` } })))), /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden" }, isEditingGym ? /* @__PURE__ */ React.createElement("div", { className: "p-4 sm:p-5 overflow-x-auto w-full" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-left text-sm text-slate-300 min-w-[500px]" }, /* @__PURE__ */ React.createElement("thead", { className: "text-xs uppercase text-slate-400 border-b border-slate-700" }, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { className: "pb-3 px-2 w-32" }, "D\xEDa"), /* @__PURE__ */ React.createElement("th", { className: "pb-3 px-2" }, "Enfoque (M\xFAsculo/Actividad)"), /* @__PURE__ */ React.createElement("th", { className: "pb-3 px-2 w-24" }, "Minutos"), /* @__PURE__ */ React.createElement("th", { className: "pb-3 pl-2 w-10 text-center" }))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-slate-800" }, gymRoutine.map((routine) => /* @__PURE__ */ React.createElement("tr", { key: routine.id }, /* @__PURE__ */ React.createElement("td", { className: "py-2 px-2" }, /* @__PURE__ */ React.createElement("select", { value: routine.day, onChange: (e) => handleUpdateGymRoutine(routine.id, "day", e.target.value), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full" }, WEEK_DAYS.map((d) => /* @__PURE__ */ React.createElement("option", { key: d, value: d }, d)))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-2" }, /* @__PURE__ */ React.createElement("input", { type: "text", value: routine.focus || "", onChange: (e) => handleUpdateGymRoutine(routine.id, "focus", e.target.value), className: "bg-slate-900 text-sm text-white border border-slate-600 rounded p-2 outline-none w-full focus:border-indigo-500", placeholder: "Ej. Pecho y Tr\xEDceps" })), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-2" }, /* @__PURE__ */ React.createElement("input", { type: "number", value: routine.duration || 0, onChange: (e) => handleUpdateGymRoutine(routine.id, "duration", parseInt(e.target.value) || 0), className: "bg-slate-900 text-sm text-white border border-slate-600 rounded p-2 outline-none w-full focus:border-indigo-500 text-center" })), /* @__PURE__ */ React.createElement("td", { className: "py-2 pl-2" }, /* @__PURE__ */ React.createElement("button", { onClick: () => handleDeleteRoutine(routine.id), className: "bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded w-full flex justify-center" }, /* @__PURE__ */ React.createElement(Trash2, { className: "w-4 h-4" }))))))), /* @__PURE__ */ React.createElement("div", { className: "border-t border-slate-700 pt-4 mt-4" }, /* @__PURE__ */ React.createElement("h4", { className: "text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Plus, { className: "w-4 h-4" }), " Agregar D\xEDa de Entrenamiento"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-2 sm:items-center" }, /* @__PURE__ */ React.createElement("select", { value: newRoutine.day, onChange: (e) => setNewRoutine({ ...newRoutine, day: e.target.value }), className: "bg-slate-900 text-xs text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-32 focus:border-indigo-500" }, WEEK_DAYS.map((d) => /* @__PURE__ */ React.createElement("option", { key: d, value: d }, d))), /* @__PURE__ */ React.createElement("input", { type: "text", value: newRoutine.focus, onChange: (e) => setNewRoutine({ ...newRoutine, focus: e.target.value }), placeholder: "Enfoque muscular...", onKeyDown: (e) => e.key === "Enter" && handleAddRoutine(), className: "bg-slate-900 text-sm text-white border border-slate-600 rounded p-2 outline-none w-full sm:flex-1 focus:border-indigo-500" }), /* @__PURE__ */ React.createElement("input", { type: "number", value: newRoutine.duration, onChange: (e) => setNewRoutine({ ...newRoutine, duration: parseInt(e.target.value) || 0 }), placeholder: "Min", className: "bg-slate-900 text-sm text-white border border-slate-600 rounded p-2 outline-none w-full sm:w-20 sm:text-center focus:border-indigo-500" }), /* @__PURE__ */ React.createElement("button", { onClick: handleAddRoutine, className: "bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-500 font-medium w-full sm:w-auto" }, "A\xF1adir")))) : /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-700/50" }, gymRoutine.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "p-8 text-center text-slate-500" }, "No tienes rutinas configuradas.") : gymRoutine.map((routine) => /* @__PURE__ */ React.createElement("div", { key: routine.id, className: `p-4 transition-all duration-300 ${routine.completed ? "bg-indigo-900/10" : "hover:bg-slate-700/30"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4 flex-1" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleGymDay(routine.id), className: "focus:outline-none shrink-0" }, routine.completed ? /* @__PURE__ */ React.createElement(CheckCircle2, { className: "w-8 h-8 text-indigo-500 transition-transform scale-110" }) : /* @__PURE__ */ React.createElement(Circle, { className: "w-8 h-8 text-slate-600 hover:text-indigo-400" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: `font-bold text-lg ${routine.completed ? "text-slate-400 line-through" : "text-white"}` }, routine.day), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-indigo-300 font-medium" }, routine.focus))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-4 pl-12 md:pl-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300" }, /* @__PURE__ */ React.createElement(Clock, { className: "w-4 h-4 text-slate-400" }), " ", routine.duration, " min"), routine.isCardioDone && /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-rose-500/20 border-rose-500/50 text-rose-400" }, /* @__PURE__ */ React.createElement(Heart, { className: "w-4 h-4" }), " Cardio +5"))))))), cardioPrompt.isOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 animate-in fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4" }, /* @__PURE__ */ React.createElement(Heart, { className: "w-8 h-8 text-rose-500" })), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold text-white mb-2" }, "\xA1Rutina Completada!"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400 mb-6" }, "\xBFRealizaste el complemento de cardio? Esto sumar\xE1 +5 Puntos de Vitalidad a tu racha de hoy."), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => handleCardioResponse(false), className: "flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors" }, "No, solo pesas"), /* @__PURE__ */ React.createElement("button", { onClick: () => handleCardioResponse(true), className: "flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-rose-500/20 transition-colors" }, "\xA1S\xED, con toda!")))));
    const navItems = [
      { id: "habits", icon: CheckCircle2, label: "H\xE1bitos" },
      { id: "goals", icon: Target, label: "Metas" },
      { id: "finances", icon: DollarSign, label: "Finanzas" },
      { id: "health", icon: Activity, label: "Salud" },
      { id: "gym", icon: Dumbbell, label: "Gym" }
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-slate-900 text-slate-200 font-sans pb-20 md:pb-0 md:pl-24" }, /* @__PURE__ */ React.createElement("aside", { className: "hidden md:flex flex-col w-24 fixed h-full left-0 top-0 bg-slate-950 border-r border-slate-800 items-center py-8 z-50" }, /* @__PURE__ */ React.createElement("div", { className: "w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center mb-10 shadow-lg shadow-emerald-500/20 text-white font-bold text-xl" }, "A"), /* @__PURE__ */ React.createElement("nav", { className: "flex flex-col gap-6 w-full flex-1" }, navItems.map((item) => {
      const Icon = item.icon;
      const isActive = activeTab === item.id;
      return /* @__PURE__ */ React.createElement("button", { key: item.id, onClick: () => setActiveTab(item.id), className: `flex flex-col items-center justify-center w-full py-3 relative group transition-colors ${isActive ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}` }, isActive && /* @__PURE__ */ React.createElement("div", { className: "absolute left-0 w-1 h-full bg-emerald-500 rounded-r-full" }), /* @__PURE__ */ React.createElement(Icon, { className: "w-6 h-6 mb-1" }), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] uppercase font-bold tracking-wider" }, item.label));
    })), /* @__PURE__ */ React.createElement("button", { onClick: handleLogout, className: "mt-auto mb-8 p-3 text-slate-500 hover:text-red-400 transition-colors group relative" }, /* @__PURE__ */ React.createElement(LogOut, { className: "w-6 h-6" }), /* @__PURE__ */ React.createElement("span", { className: "absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none" }, "Cerrar Sesi\xF3n"))), /* @__PURE__ */ React.createElement("main", { className: "max-w-5xl mx-auto p-4 md:p-8" }, /* @__PURE__ */ React.createElement("header", { className: "mb-8 pt-4 md:pt-0 flex justify-between items-start" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500 mb-1" }, "Adventure"), /* @__PURE__ */ React.createElement("p", { className: "text-slate-400 text-sm md:text-base" }, "Tu centro de gesti\xF3n personal e implacable.")), /* @__PURE__ */ React.createElement("button", { onClick: handleLogout, className: "md:hidden flex items-center gap-1 text-xs text-slate-500 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700" }, /* @__PURE__ */ React.createElement(LogOut, { className: "w-3 h-3" }), " Salir")), cloudError && /* @__PURE__ */ React.createElement("div", { role: "alert", className: "bg-red-500/10 text-red-400 border border-red-500/20 p-4 rounded-xl mb-4" }, cloudError), pendingWrites > 0 && /* @__PURE__ */ React.createElement("div", { role: "status", className: "text-amber-300 text-sm mb-3" }, "Guardando cambios\u2026"), loadingCloud ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center text-emerald-400 mt-20 animate-in fade-in" }, /* @__PURE__ */ React.createElement(Cloud, { className: "w-16 h-16 mb-4 animate-pulse" }), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold tracking-widest uppercase" }, "Conectando a la Nube...")) : /* @__PURE__ */ React.createElement(React.Fragment, null, activeTab === "habits" && renderHabits(), activeTab === "goals" && renderGoals(), activeTab === "finances" && renderFinances(), activeTab === "health" && renderHealth(), activeTab === "gym" && renderGym())), /* @__PURE__ */ React.createElement("nav", { className: "md:hidden fixed bottom-0 w-full bg-slate-950 border-t border-slate-800 flex justify-around items-center h-16 px-2 z-50 pb-safe" }, navItems.map((item) => {
      const Icon = item.icon;
      const isActive = activeTab === item.id;
      return /* @__PURE__ */ React.createElement("button", { key: item.id, onClick: () => setActiveTab(item.id), className: `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? "text-emerald-400" : "text-slate-500"}` }, /* @__PURE__ */ React.createElement(Icon, { className: `w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform` }), /* @__PURE__ */ React.createElement("span", { className: "text-[9px] font-medium" }, item.label));
    })));
  }
  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(/* @__PURE__ */ React.createElement(App, null));
})();
