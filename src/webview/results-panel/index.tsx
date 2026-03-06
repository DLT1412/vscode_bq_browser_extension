import React from 'react';
import { createRoot } from 'react-dom/client';

function App(): React.ReactElement {
  return <div>Query results will appear here.</div>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
