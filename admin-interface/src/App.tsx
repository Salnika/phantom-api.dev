import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TableManager from './pages/TableManager';
import TokenManagement from './pages/TokenManagement';
import Logs from './pages/Logs';
import { PoliciesPage } from './pages/PoliciesPage';
import Layout from './components/Layout';
import { SystemUsers } from './pages/SystemUsers';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="phantom-admin-theme">
      <AuthProvider>
        <Router basename="/admin">
          <div className="min-h-screen bg-background text-foreground theme-transition">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/tables" element={
                <ProtectedRoute>
                  <Layout>
                    <TableManager />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/tables/:tableName" element={
                <ProtectedRoute>
                  <Layout>
                    <TableManager />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/policies" element={
                <ProtectedRoute>
                  <Layout>
                    <PoliciesPage />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/tokens" element={
                <ProtectedRoute>
                  <Layout>
                    <TokenManagement />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/logs" element={
                <ProtectedRoute>
                  <Layout>
                    <Logs />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/system-users" element={
                <ProtectedRoute>
                  <Layout>
                    <SystemUsers />
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;