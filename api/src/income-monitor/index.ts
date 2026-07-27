/**
 * PensionWatch Income Monitor
 *
 * This module provides functionality to monitor incoming bank transactions for pension,
 * annuity, and social security payments, detect deviations from expected amounts,
 * and generate alerts for seniors or their caregivers.
 *
 * Features:
 * - Connects to bank transaction data (mocked for MVP).
 * - Learns expected payment amounts and timing from historical data.
 * - Detects deviations beyond configurable thresholds.
 * - Generates alerts with payer name, expected vs actual amount, and contact templates.
 * - Supports caregiver oversight mode.
 *
 * MVP Scope:
 * - Read-only bank transaction ingestion (mocked).
 * - Auto-detection of recurring income sources.
 * - Alerting via console logs (replaceable with SMS/email).
 * - Simple configuration for thresholds.
 */

import EventEmitter from "events";

export type Transaction = {
  id: string;
  date: string; // ISO date string
  amount: number; // positive for incoming payments
  payer: string;
};

export type IncomeSource = {
  payer: string;
  expectedAmount: number;
  expectedDayOfMonth: number;
};

export type Alert = {
  payer: string;
  expectedAmount: number;
  actualAmount: number;
  delta: number;
  date: string;
  contactTemplate: string;
};

export interface IncomeMonitorOptions {
  alertThresholdAmount?: number; // absolute amount threshold, default $10
  alertThresholdPercent?: number; // relative percent threshold, default 2%
  caregiverMode?: boolean; // if true, alerts are also sent to caregiver
}

export class IncomeMonitor extends EventEmitter {
  private transactions: Transaction[] = [];
  private incomeSources: Map<string, IncomeSource> = new Map();
  private options: IncomeMonitorOptions;

  constructor(options?: IncomeMonitorOptions) {
    super();
    this.options = {
      alertThresholdAmount: 10,
      alertThresholdPercent: 0.02,
      caregiverMode: false,
      ...options,
    };
  }

  /**
   * Ingest new transactions.
   * @param txs Array of transactions to add.
   */
  ingestTransactions(txs: Transaction[]) {
    this.transactions.push(...txs);
    this.learnIncomeSources();
    this.checkForAlerts(txs);
  }

  /**
   * Learn expected income sources from historical transactions.
   * For MVP, uses simple heuristics:
   * - Groups by payer.
   * - Calculates average amount and modal day of month.
   */
  private learnIncomeSources() {
    const payerGroups: Map<string, Transaction[]> = new Map();

    for (const tx of this.transactions) {
      if (tx.amount <= 0) continue; // only incoming payments
      if (!payerGroups.has(tx.payer)) {
        payerGroups.set(tx.payer, []);
      }
      payerGroups.get(tx.payer)!.push(tx);
    }

    this.incomeSources.clear();

    for (const [payer, txs] of payerGroups.entries()) {
      if (txs.length < 3) continue; // require at least 3 payments to learn

      // Calculate average amount
      const avgAmount =
        txs.reduce((sum, t) => sum + t.amount, 0) / txs.length;

      // Calculate modal day of month
      const dayCounts: Map<number, number> = new Map();
      for (const t of txs) {
        const day = new Date(t.date).getUTCDate();
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }
      let modalDay = 1;
      let maxCount = 0;
      for (const [day, count] of dayCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          modalDay = day;
        }
      }

      this.incomeSources.set(payer, {
        payer,
        expectedAmount: avgAmount,
        expectedDayOfMonth: modalDay,
      });
    }
  }

  /**
   * Check new transactions for deviations from expected income.
   * Emits 'alert' events for detected anomalies.
   * @param newTxs Array of new transactions to check.
   */
  private checkForAlerts(newTxs: Transaction[]) {
    for (const tx of newTxs) {
      if (tx.amount <= 0) continue;
      const source = this.incomeSources.get(tx.payer);
      if (!source) continue;

      const delta = tx.amount - source.expectedAmount;
      const absDelta = Math.abs(delta);
      const relDelta = absDelta / source.expectedAmount;

      if (
        absDelta >= (this.options.alertThresholdAmount ?? 10) &&
        relDelta >= (this.options.alertThresholdPercent ?? 0.02)
      ) {
        const alert: Alert = {
          payer: tx.payer,
          expectedAmount: source.expectedAmount,
          actualAmount: tx.amount,
          delta,
          date: tx.date,
          contactTemplate: this.generateContactTemplate(tx.payer, source.expectedAmount, tx.amount),
        };
        this.emit("alert", alert);
        if (this.options.caregiverMode) {
          this.emit("caregiverAlert", alert);
        }
      }
    }
  }

  /**
   * Generate a contact template message for the alert.
   * @param payer Payer name
   * @param expected Expected amount
   * @param actual Actual amount
   */
  private generateContactTemplate(payer: string, expected: number, actual: number): string {
    const diff = expected - actual;
    return `Dear ${payer} provider, I noticed my recent payment was $${actual.toFixed(2)}, which is $${diff.toFixed(2)} less than the expected $${expected.toFixed(2)}. Please advise.`;
  }

  /**
   * Get learned income sources.
   */
  getIncomeSources(): IncomeSource[] {
    return Array.from(this.incomeSources.values());
  }
}
