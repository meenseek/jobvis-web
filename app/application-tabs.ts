export type OpenApplicationTab = {
  id: string;
  returnPath: string;
};

export function upsertOpenApplicationTab(
  tabs: OpenApplicationTab[],
  nextTab: OpenApplicationTab,
) {
  const existing = tabs.find((tab) => tab.id === nextTab.id);
  if (existing?.returnPath === nextTab.returnPath) return tabs;
  if (existing) {
    return tabs.map((tab) => (tab.id === nextTab.id ? nextTab : tab));
  }
  return [...tabs, nextTab];
}

export function closeOpenApplicationTab(
  tabs: OpenApplicationTab[],
  id: string,
) {
  const closedIndex = tabs.findIndex((tab) => tab.id === id);
  if (closedIndex < 0) {
    return { tabs, closedTab: undefined, nextTab: undefined };
  }

  const closedTab = tabs[closedIndex];
  const remainingTabs = tabs.filter((tab) => tab.id !== id);
  const nextIndex = Math.min(closedIndex, remainingTabs.length - 1);
  return {
    tabs: remainingTabs,
    closedTab,
    nextTab: nextIndex >= 0 ? remainingTabs[nextIndex] : undefined,
  };
}
