import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import DollsPage from './pages/DollsPage';
import OrdersPage from './pages/OrdersPage';
import PatternsPage from './pages/PatternsPage';
import FittingsPage from './pages/FittingsPage';
import StatsPage from './pages/StatsPage';

export default function App() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo">👗</span>
          <div>
            <h1>BJD娃衣定制</h1>
            <p>排单与版型管理系统</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dolls" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="icon">📐</span>
            <span>娃体尺寸库</span>
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="icon">📋</span>
            <span>定制订单</span>
          </NavLink>
          <NavLink to="/patterns" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="icon">✂️</span>
            <span>打版进度</span>
          </NavLink>
          <NavLink to="/fittings" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="icon">📸</span>
            <span>试穿确认</span>
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="icon">📊</span>
            <span>数据统计</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          © 2026 BJD Custom Studio
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dolls" replace />} />
          <Route path="/dolls" element={<DollsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/fittings" element={<FittingsPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>
    </div>
  );
}
