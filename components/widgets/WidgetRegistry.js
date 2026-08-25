import RecentReportsWidget from './RecentReportsWidget';

export const WidgetRegistry = {
  recent_reports: {
    component: RecentReportsWidget,
    defaultWidth: 6,
    defaultHeight: 6,
    minWidth: 4,
    minHeight: 4,
    name: 'Recent Reports',
    description: 'A feed of the most recent campus incidents.'
  },
  quick_report: {
    component: RecentReportsWidget, // Re-use for now
    defaultWidth: 3,
    defaultHeight: 3,
    minWidth: 3,
    minHeight: 3,
    name: 'Quick Report',
    description: 'Shortcut to submit a new incident report.'
  },
  crisis_alert: {
    component: RecentReportsWidget, // Re-use for now
    defaultWidth: 6,
    defaultHeight: 3,
    minWidth: 6,
    minHeight: 3,
    name: 'Crisis Alert',
    description: 'Current campus crisis status.'
  },
  map: {
    component: RecentReportsWidget, // Re-use for now
    defaultWidth: 12,
    defaultHeight: 6,
    minWidth: 6,
    minHeight: 4,
    name: 'Campus Map',
    description: 'Live map of campus incidents.'
  }
};
