/**
 * closeExporter — generates CSV and JSON exports of a financial close report.
 *
 * Triggers a browser download. No server required.
 * PDF summary is a formatted HTML print view (browser native).
 */

import type { FinancialCloseReport, StoredFinancialClose } from './types'
import { formatPence } from '@/utils/format'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function periodLabel(report: FinancialCloseReport): string {
  const start = new Date(report.periodStart)
  const end   = new Date(report.periodEnd)
  return `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCloseAsCSV(close: StoredFinancialClose): void {
  const report = close.report
  if (!report) throw new Error('Close has no report data')

  const rows: string[][] = [
    ['Field', 'Value'],
    ['Period Type', report.periodType],
    ['Period Start', report.periodStart],
    ['Period End',   report.periodEnd],
    ['Generated At', report.generatedAt],
    [],
    ['Bookings Created',   String(report.bookingsCreated)],
    ['Bookings Completed', String(report.bookingsCompleted)],
    ['Bookings Cancelled', String(report.bookingsCancelled)],
    [],
    ['Authorized Payments',    String(report.authorizedPayments)],
    ['Captured Payments',      String(report.capturedPayments)],
    ['Refunded Payments',      String(report.refundedPayments)],
    ['Partial Refunds',        String(report.partialRefunds)],
    ['Failed Payments',        String(report.failedPayments)],
    [],
    ['Gross Revenue',          formatPence(report.grossRevenueCents)],
    ['Platform Revenue',       formatPence(report.platformRevenueCents)],
    ['Cleaner Payouts (owed)', formatPence(report.cleanerPayoutsCents)],
    ['Total Refunds Issued',   formatPence(report.totalRefundsCents)],
    ['Net Revenue',            formatPence(report.netRevenueCents)],
    ['Est. Stripe Fees',       formatPence(report.estimatedStripeFeesCents)],
    [],
    ['Outstanding Authorizations', String(report.pendingAuthorizationCount)],
    ['Outstanding Payouts',        formatPence(report.outstandingPayoutsCents)],
    ['Completed Payouts',          formatPence(report.completedPayoutsCents)],
    [],
    ['Cash Received',    formatPence(report.totals.cashReceivedCents)],
    ['Cash Paid Out',    formatPence(report.totals.cashPaidOutCents)],
    ['Ledger Balance',   formatPence(report.totals.ledgerBalanceCents)],
    ['Refund Liability', formatPence(report.totals.refundLiabilityCents)],
    ['Pending Liability',formatPence(report.totals.pendingLiabilityCents)],
    [],
    ['Can Close', report.canClose ? 'YES' : 'NO — BLOCKED'],
    ['Blocking Issues', report.blockingIssues.join(' | ')],
    ['Warnings',        report.warnings.join(' | ')],
  ]

  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `financial_close_${periodLabel(report)}.csv`)
}

// Discrepancies export (separate CSV)
export function exportDiscrepanciesAsCSV(close: StoredFinancialClose): void {
  const report = close.report
  if (!report) throw new Error('Close has no report data')
  if (!report.discrepancies.length) return

  const rows: string[][] = [
    ['Booking ID', 'Type', 'Severity', 'Description'],
    ...report.discrepancies.map((d) => [d.bookingId, d.type, d.severity, d.description]),
  ]

  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `discrepancies_${periodLabel(report)}.csv`)
}

// ── JSON ──────────────────────────────────────────────────────────────────────

export function exportCloseAsJSON(close: StoredFinancialClose): void {
  if (!close.report) throw new Error('Close has no report data')
  const json = JSON.stringify(close, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `financial_close_${periodLabel(close.report)}.json`)
}

// ── PDF (print) ───────────────────────────────────────────────────────────────

export function printCloseAsPDF(close: StoredFinancialClose): void {
  const report = close.report
  if (!report) throw new Error('Close has no report data')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Financial Close — ${periodLabel(report)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; color: #1a1a1a; font-size: 13px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .meta { color: #555; margin-bottom: 20px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; font-weight: 600; padding: 4px 8px; background: #f5f5f5; }
    td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; }
    .badge-ok  { color: #1a7a2e; font-weight: 600; }
    .badge-err { color: #c0392b; font-weight: 600; }
    .warn { color: #b45309; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
<h1>Cleanlyst Financial Close Report</h1>
<div class="meta">
  Period: ${report.periodType} · ${report.periodStart.slice(0,10)} → ${report.periodEnd.slice(0,10)}<br>
  Generated: ${new Date(report.generatedAt).toLocaleString('en-GB')}<br>
  Status: <span class="${report.canClose ? 'badge-ok' : 'badge-err'}">${report.canClose ? '✓ CLOSED' : '✗ BLOCKED'}</span>
</div>

<h2>Booking Counts</h2>
<table>
  <tr><th>Metric</th><th>Count</th></tr>
  <tr><td>Created</td><td>${report.bookingsCreated}</td></tr>
  <tr><td>Completed</td><td>${report.bookingsCompleted}</td></tr>
  <tr><td>Cancelled</td><td>${report.bookingsCancelled}</td></tr>
</table>

<h2>Revenue</h2>
<table>
  <tr><th>Metric</th><th>Amount</th></tr>
  <tr><td>Gross Revenue</td><td>${formatPence(report.grossRevenueCents)}</td></tr>
  <tr><td>Platform Revenue</td><td>${formatPence(report.platformRevenueCents)}</td></tr>
  <tr><td>Cleaner Payouts (owed)</td><td>${formatPence(report.cleanerPayoutsCents)}</td></tr>
  <tr><td>Total Refunds</td><td>${formatPence(report.totalRefundsCents)}</td></tr>
  <tr><td><strong>Net Revenue</strong></td><td><strong>${formatPence(report.netRevenueCents)}</strong></td></tr>
  <tr><td>Est. Stripe Fees</td><td>${formatPence(report.estimatedStripeFeesCents)}</td></tr>
</table>

<h2>Cash Position</h2>
<table>
  <tr><th>Metric</th><th>Amount</th></tr>
  <tr><td>Cash Received</td><td>${formatPence(report.totals.cashReceivedCents)}</td></tr>
  <tr><td>Cash Paid Out</td><td>${formatPence(report.totals.cashPaidOutCents)}</td></tr>
  <tr><td>Ledger Balance</td><td>${formatPence(report.totals.ledgerBalanceCents)}</td></tr>
  <tr><td>Refund Liability</td><td>${formatPence(report.totals.refundLiabilityCents)}</td></tr>
  <tr><td>Pending Liability</td><td>${formatPence(report.totals.pendingLiabilityCents)}</td></tr>
</table>

${report.blockingIssues.length ? `
<h2>⚠ Blocking Issues</h2>
<ul>${report.blockingIssues.map((i) => `<li class="badge-err">${i}</li>`).join('')}</ul>
` : ''}

${report.warnings.length ? `
<h2>Warnings</h2>
<ul>${report.warnings.map((w) => `<li class="warn">${w}</li>`).join('')}</ul>
` : ''}

${report.discrepancies.length ? `
<h2>Discrepancies (${report.discrepancies.length})</h2>
<table>
  <tr><th>Booking</th><th>Type</th><th>Severity</th><th>Description</th></tr>
  ${report.discrepancies.map((d) => `
  <tr>
    <td style="font-family:monospace;font-size:11px">${d.bookingId.slice(0,8)}…</td>
    <td>${d.type}</td>
    <td class="${d.severity === 'violation' ? 'badge-err' : 'warn'}">${d.severity}</td>
    <td>${d.description}</td>
  </tr>`).join('')}
</table>
` : '<p>No discrepancies detected.</p>'}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}
