import React, { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Table, Key, LogOut, FileText, ChevronDown, ChevronRight, Minimize2, Maximize2, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import { apiService } from '../services/apiService';
import LogoBlue from '../assets/logo-blue.svg';
interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTablesExpanded, setIsTablesExpanded] = useState(true);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const isTableActive = (tableName: string) => {
    return location.pathname === `/tables/${tableName}`;
  };

  useEffect(() => {
    const loadTables = async () => {
      try {
        const tables = await apiService.getTables();
        setAvailableTables(Array.isArray(tables) ? tables : []);
      } catch (error) {
        console.error('Failed to load tables:', error);
        setAvailableTables([]);
      }
    };
    loadTables();
  }, []);

  // Auto-expand tables section when on tables page
  useEffect(() => {
    if (location.pathname.startsWith('/tables')) {
      setIsTablesExpanded(true);
    }
  }, [location.pathname]);

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <div className={cn(
        "sidebar-fixed sidebar-sticky",
        isCollapsed ? "sidebar-collapsed" : "sidebar-expanded"
      )}>
        <div className="p-4 border-b  flex items-center justify-between">
          <h1 className={cn(
            "flex items-center gap-2 text-xl font-bold text-primary transition-all duration-300",
            isCollapsed ? "opacity-0 w-0" : "opacity-100"
          )}>
            <img src={LogoBlue} alt="Phantom API Logo" className="h-8 w-8" />
            {!isCollapsed && "Phantom API"}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0"
          >
            {isCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {!isCollapsed && (
            <div>
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Overview
              </h3>
              <Link
                to="/dashboard"
                className={cn(
                  "sidebar-nav-item",
                  isActive('/dashboard') || isActive('/') ? "active" : ""
                )}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
            </div>
          )}

          {isCollapsed && (
            <div className="space-y-2">
              <Link
                to="/dashboard"
                className={cn(
                  "sidebar-nav-item justify-center",
                  isActive('/dashboard') || isActive('/') ? "active" : ""
                )}
                title="Dashboard"
              >
                <LayoutDashboard size={18} />
              </Link>
            </div>
          )}

          <div>
            {!isCollapsed && (
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data
              </h3>
            )}

            {/* Tables Section with Expandable Submenu */}
            <div>
              <button
                onClick={() => !isCollapsed && setIsTablesExpanded(!isTablesExpanded)}
                className={cn(
                  "sidebar-nav-item w-full justify-between",
                  isActive('/tables') ? "active" : ""
                )}
                disabled={isCollapsed}
              >
                <div className="flex items-center gap-3">
                  <Table size={18} />
                  {!isCollapsed && "Tables"}
                </div>
                {!isCollapsed && (
                  isTablesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Tables Submenu */}
              {!isCollapsed && isTablesExpanded && (
                <div className="ml-6 mt-2 space-y-1">
                  {Array.isArray(availableTables) && availableTables.length > 0 ? (
                    availableTables.map((tableName) => (
                      <Link
                        key={tableName}
                        to={`/tables/${tableName}`}
                        className={cn(
                          "sidebar-nav-item text-xs",
                          isTableActive(tableName) ? "active" : ""
                        )}
                      >
                        <div className="w-2 h-2 rounded-full bg-current opacity-50" />
                        {tableName}
                      </Link>
                    ))
                  ) : (
                    <div className="sidebar-nav-item text-xs text-muted-foreground cursor-default">
                      {Array.isArray(availableTables) ? 'No tables found' : 'Loading tables...'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsed Tables Icon */}
            {isCollapsed && (
              <Link
                to="/tables"
                className={cn(
                  "sidebar-nav-item justify-center",
                  isActive('/tables') ? "active" : ""
                )}
                title="Tables"
              >
                <Table size={18} />
              </Link>
            )}
          </div>

          <div>
            {!isCollapsed && (
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tools
              </h3>
            )}
            <div className={cn("sidebar-nav", isCollapsed && "space-y-2")}>
              <Link
                to="/policies"
                className={cn(
                  "sidebar-nav-item",
                  isActive('/policies') ? "active" : "",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? "Policies" : undefined}
              >
                <Shield size={18} />
                {!isCollapsed && "Policies"}
              </Link>
              <Link
                to="/system-users"
                className={cn(
                  "sidebar-nav-item",
                  isActive('/system-users') ? "active" : "",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? "System Users" : undefined}
              >
                <Users size={18} />
                {!isCollapsed && "System Users"}
              </Link>
              <Link
                to="/tokens"
                className={cn(
                  "sidebar-nav-item",
                  isActive('/tokens') ? "active" : "",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? "API Tokens" : undefined}
              >
                <Key size={18} />
                {!isCollapsed && "API Tokens"}
              </Link>
              <Link
                to="/logs"
                className={cn(
                  "sidebar-nav-item",
                  isActive('/logs') ? "active" : "",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? "Logs" : undefined}
              >
                <FileText size={18} />
                {!isCollapsed && "Logs"}
              </Link>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-border">
          {!isCollapsed && (
            <div className="mb-3 text-sm text-muted-foreground">
              Signed in as: <span className="font-medium text-foreground">{user?.email}</span>
            </div>
          )}
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className={cn("w-full", isCollapsed && "px-2")}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut size={16} />
            {!isCollapsed && "Logout"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content-fixed">
        <header className="header-sticky bg-card border-b border-border px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">
              Admin Dashboard
            </h2>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="main-content-area">
          <div className="content-scroll-container fixed-padding">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;