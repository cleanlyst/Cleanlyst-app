export interface DashboardLinkItem {
  name: string
  label: string
  icon?: string
}

export const adminDashboardLinks: DashboardLinkItem[] = [
  { name: 'AdminDashboard', label: 'Overview', icon: 'dashboard' },
  { name: 'AdminApprovals', label: 'Cleaners', icon: 'person_check' },
  { name: 'AdminMembership', label: 'Membership', icon: 'card_membership' },
  { name: 'AdminPlatformFees', label: 'Platform Fees', icon: 'account_balance_wallet' },
  { name: 'AdminFinancials', label: 'Financials', icon: 'list_alt' },
  { name: 'AdminFinancialAudit', label: 'Financial Audit', icon: 'fact_check' },
  { name: 'AdminBookingAudit', label: 'Booking Audit', icon: 'history' },
  { name: 'BookingManagement', label: 'Bookings', icon: 'admin_panel_settings' },
  { name: 'OperationsConsole', label: 'Ops Console', icon: 'manage_search' },
  { name: 'FinancialCloseDashboard', label: 'Financial Close', icon: 'receipt_long' },
  { name: 'AdminMonitoring', label: 'Monitoring', icon: 'monitor_heart' },
]

export const customerDashboardLinks: DashboardLinkItem[] = [
  { name: 'CustomerDashboard', label: 'Dashboard', icon: 'dashboard' },
  { name: 'CustomerBookings', label: 'My Bookings', icon: 'event_note' },
  { name: 'CustomerPreferences', label: 'Preferences', icon: 'tune' },
  { name: 'CustomerSettings', label: 'Settings', icon: 'settings' },
]

export const cleanerDashboardLinks: DashboardLinkItem[] = [
  { name: 'CleanerDashboard', label: 'Dashboard', icon: 'dashboard' },
  { name: 'CleanerBookings', label: 'Bookings', icon: 'event' },
  { name: 'CleanerAvailability', label: 'Availability', icon: 'calendar_month' },
  { name: 'CleanerServicesPricing', label: 'Services & Pricing', icon: 'sell' },
  { name: 'CleanerFinancials', label: 'Financials', icon: 'payments' },
  { name: 'CleanerReviews', label: 'Reviews', icon: 'star' },
  { name: 'CleanerProfile', label: 'Profile', icon: 'person' },
]
