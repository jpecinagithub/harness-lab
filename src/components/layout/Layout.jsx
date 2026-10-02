import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main">
        <Header onMenu={() => setOpen((v) => !v)} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
