import React from 'react';

export const PlaywrightContext = React.createContext<{
  contextId: string;
  pageId: string | null;
  setActivePage: (contextId: string, pageId: string | null) => void;
}>({
  contextId: 'opera',
  pageId: 'main',
  setActivePage: () => {},
}); 