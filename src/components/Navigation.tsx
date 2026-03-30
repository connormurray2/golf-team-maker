import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <h1>Golf Team Maker</h1>
        </div>
        <div className="nav-links">
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Team Builder
          </Link>
          <Link
            to="/rankings"
            className={`nav-link ${location.pathname === '/rankings' ? 'active' : ''}`}
          >
            Rankings Editor
          </Link>
          <Link
            to="/sunday-pairings"
            className={`nav-link ${location.pathname === '/sunday-pairings' ? 'active' : ''}`}
          >
            Sunday Pairings
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
