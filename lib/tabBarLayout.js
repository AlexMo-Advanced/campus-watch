/** Shared layout constants for the floating liquid tab bar. */
export const TAB_BAR_HEIGHT = 70;
export const TAB_BAR_BOTTOM_GAP = 16;
export const TAB_BAR_EXTRA_CLEARANCE = 12;

/** Total vertical space the floating tab bar occupies above the screen edge. */
export function getTabBarClearance(insets) {
  const bottomOffset = Math.max(insets.bottom + TAB_BAR_BOTTOM_GAP, TAB_BAR_BOTTOM_GAP);
  return TAB_BAR_HEIGHT + bottomOffset + TAB_BAR_EXTRA_CLEARANCE;
}
