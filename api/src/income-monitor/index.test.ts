import { IncomeMonitor, Transaction, Alert } from "./index";

describe("IncomeMonitor", () => {
  let monitor: IncomeMonitor;

  beforeEach(() => {
    monitor = new IncomeMonitor({
      alertThresholdAmount: 10,
      alertThresholdPercent: 0.02,
      caregiverMode: false,
    });
  });

  test("learns income sources from transactions", () => {
    const txs: Transaction[] = [
      { id: "1", date: "2026-07-01", amount: 1000, payer: "SSA" },
      { id: "2", date: "2026-08-01", amount: 1000, payer: "SSA" },
      { id: "3", date: "2026-09-01", amount: 1000, payer: "SSA" },
      { id: "4", date: "2026-07-15", amount: 500, payer: "PensionCo" },
      { id: "5", date: "2026-08-15", amount: 500, payer: "PensionCo" },
      { id: "6", date: "2026-09-15", amount: 500, payer: "PensionCo" },
    ];

    monitor.ingestTransactions(txs);

    const sources = monitor.getIncomeSources();
    expect(sources).toHaveLength(2);

    const ssaSource = sources.find((s) => s.payer === "SSA");
    expect(ssaSource).toBeDefined();
    expect(ssaSource?.expectedAmount).toBeCloseTo(1000);
    expect(ssaSource?.expectedDayOfMonth).toBe(1);

    const pensionSource = sources.find((s) => s.payer === "PensionCo");
    expect(pensionSource).toBeDefined();
    expect(pensionSource?.expectedAmount).toBeCloseTo(500);
    expect(pensionSource?.expectedDayOfMonth).toBe(15);
  });

  test("emits alert when payment deviates beyond thresholds", () => {
    const txs: Transaction[] = [
      { id: "1", date: "2026-07-01", amount: 1000, payer: "SSA" },
      { id: "2", date: "2026-08-01", amount: 900, payer: "SSA" }, // 10% less
      { id: "3", date: "2026-09-01", amount: 1000, payer: "SSA" },
    ];

    const alerts: Alert[] = [];
    monitor.on("alert", (alert) => {
      alerts.push(alert);
    });

    monitor.ingestTransactions(txs);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].payer).toBe("SSA");
    expect(alerts[0].delta).toBeCloseTo(-100);
  });

  test("emits caregiver alert when caregiverMode is true", () => {
    monitor = new IncomeMonitor({
      alertThresholdAmount: 10,
      alertThresholdPercent: 0.02,
      caregiverMode: true,
    });

    const txs: Transaction[] = [
      { id: "1", date: "2026-07-01", amount: 1000, payer: "SSA" },
      { id: "2", date: "2026-08-01", amount: 900, payer: "SSA" }, // 10% less
      { id: "3", date: "2026-09-01", amount: 1000, payer: "SSA" },
    ];

    const alerts: Alert[] = [];
    const caregiverAlerts: Alert[] = [];
    monitor.on("alert", (alert) => {
      alerts.push(alert);
    });
    monitor.on("caregiverAlert", (alert) => {
      caregiverAlerts.push(alert);
    });

    monitor.ingestTransactions(txs);

    expect(alerts).toHaveLength(1);
    expect(caregiverAlerts).toHaveLength(1);
    expect(alerts[0]).toEqual(caregiverAlerts[0]);
  });

  test("does not alert for small deviations", () => {
    const txs: Transaction[] = [
      { id: "1", date: "2026-07-01", amount: 1000, payer: "SSA" },
      { id: "2", date: "2026-08-01", amount: 995, payer: "SSA" }, // 0.5% less
      { id: "3", date: "2026-09-01", amount: 1000, payer: "SSA" },
    ];

    const alerts: Alert[] = [];
    monitor.on("alert", (alert) => {
      alerts.push(alert);
    });

    monitor.ingestTransactions(txs);

    expect(alerts).toHaveLength(0);
  });
});
