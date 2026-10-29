import { useEffect, useState } from 'preact/hooks';

export type PanelName = 'menu' | 'layouts' | 'editor';

/**
 * The menu and the full-screen panels (Layouts, sequence editor). Opening one adds a history entry
 * so the phone's Back gesture returns to the table instead of leaving the app.
 */
export function usePanel() {
  const [panel, setPanel] = useState<PanelName | null>(null);
  useEffect(() => {
    const onPop = () => setPanel(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const open = (name: PanelName) => {
    try {
      history.pushState({ panel: name }, '');
    } catch {
      // No history in this context; the Back button still works.
    }
    setPanel(name);
  };
  /** From the menu to a panel: reuses the menu's history entry, so Back still returns to the table. */
  const switchTo = (name: PanelName) => {
    try {
      if (history.state?.panel) history.replaceState({ panel: name }, '');
      else history.pushState({ panel: name }, '');
    } catch {
      // As above.
    }
    setPanel(name);
  };
  const close = () => {
    if (history.state?.panel) history.back();
    else setPanel(null);
  };
  return { panel, open, switchTo, close };
}
