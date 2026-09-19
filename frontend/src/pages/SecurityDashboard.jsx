import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar.jsx';
import { securityAPI, usersAPI } from '../services/api.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (d) =>
  new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const severityBadge = (s) => {
  const map = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high:     'bg-orange-100 text-orange-700 border-orange-200',
    medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    low:      'bg-green-100 text-green-700 border-green-200',
  };
  return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[s] || map.low}`;
};

const riskColor = (score) => {
  if (score >= 80) return 'text-red-600';
  if (score >= 60) return 'text-orange-500';
  if (score >= 30) return 'text-yellow-500';
  return 'text-green-600';
};

const riskBar = (score) => {
  const color = score >= 80 ? 'bg-red-500' : score >= 60 ? 'bg-orange-400' : score >= 30 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${riskColor(score)}`}>{score}</span>
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
          active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
        }`}>{badge}</span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SecurityDashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats]           = useState(null);
  const [events, setEvents]         = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [users, setUsers]           = useState([]);
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [alertFilter, setAlertFilter] = useState('open');
  const [actionLoading, setActionLoading] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsR, eventsR, alertsR, assessR, usersR, logsR] = await Promise.allSettled([
        securityAPI.getStats(),
        securityAPI.getEvents(),
        securityAPI.getAlerts(alertFilter),
        securityAPI.getAssessments(),
        usersAPI.getAll(),
        securityAPI.getLogs(),
      ]);
      if (statsR.status === 'fulfilled') setStats(statsR.value.data.data);
      if (eventsR.status === 'fulfilled') setEvents(eventsR.value.data.data.events || []);
      if (alertsR.status === 'fulfilled') setAlerts(alertsR.value.data.data.alerts || []);
      if (assessR.status === 'fulfilled') setAssessments(assessR.value.data.data.assessments || []);
      if (usersR.status === 'fulfilled') setUsers(usersR.value.data.data.users || []);
      if (logsR.status === 'fulfilled') setLogs(logsR.value.data.data.logs || []);
    } catch {
      setError('Failed to load security data. Make sure the database is connected.');
    } finally {
      setLoading(false);
    }
  }, [alertFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const resolveAlert = async (id) => {
    setActionLoading(id);
    try {
      await securityAPI.updateAlert(id, { status: 'resolved', resolution_notes: 'Resolved by admin' });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
    finally { setActionLoading(''); }
  };

  const toggleBlock = async (user) => {
    setActionLoading(user.id);
    try {
      if (user.is_blocked) {
        await usersAPI.unblock(user.id);
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_blocked: false } : u));
      } else {
        await usersAPI.block(user.id);
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_blocked: true } : u));
      }
    } catch { /* ignore */ }
    finally { setActionLoading(''); }
  };

  // Derived stats
  const totalEvents = events.length;
  const criticalEvents = events.filter((e) => e.severity === 'critical').length;
  const openAlerts = alerts.filter((a) => a.status === 'open').length;
  const blockedUsers = users.filter((u) => u.is_blocked).length;
  const highRiskSessions = assessments.filter((a) => a.risk_score >= 60).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Security Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1">AI-powered threat detection & prevention</p>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm flex items-start gap-2">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error} &mdash; showing demo UI.
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Security Events" value={totalEvents} sub="Last 24 hrs"
            color="bg-blue-50"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
          <StatCard label="Critical Events" value={criticalEvents}
            color="bg-red-50"
            icon={<svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>} />
          <StatCard label="Open Alerts" value={openAlerts}
            color="bg-orange-50"
            icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} />
          <StatCard label="Blocked Users" value={blockedUsers}
            color="bg-purple-50"
            icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>} />
          <StatCard label="High-Risk Sessions" value={highRiskSessions}
            color="bg-yellow-50"
            icon={<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>} />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          <Tab active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Tab>
          <Tab active={tab === 'alerts'} onClick={() => setTab('alerts')} badge={openAlerts}>Alerts</Tab>
          <Tab active={tab === 'risk'} onClick={() => setTab('risk')}>AI Risk Scores</Tab>
          <Tab active={tab === 'events'} onClick={() => setTab('events')}>Events</Tab>
          <Tab active={tab === 'users'} onClick={() => setTab('users')}>Users</Tab>
          <Tab active={tab === 'logs'} onClick={() => setTab('logs')}>Access Logs</Tab>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
            <svg className="animate-spin w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* ── Overview tab ─────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Recent events */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Recent Security Events
                  </h3>
                  {events.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">No events yet</p>
                  ) : (
                    <div className="space-y-3">
                      {events.slice(0, 6).map((ev) => (
                        <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                          <span className={severityBadge(ev.severity)}>{ev.severity}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-medium truncate">{ev.event_type}</p>
                            <p className="text-xs text-slate-400">{ev.description || ev.email || '—'}</p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{fmtTime(ev.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent assessments */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                    </svg>
                    AI Risk Assessments
                  </h3>
                  {assessments.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">No assessments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {assessments.slice(0, 6).map((a) => (
                        <div key={a.id} className="py-2 border-b border-slate-50 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate">{a.email || a.user_id}</span>
                            <span className="text-xs text-slate-400">{fmtTime(a.created_at)}</span>
                          </div>
                          {riskBar(a.risk_score)}
                          <p className="text-xs text-slate-400 mt-0.5">{a.classification} · {a.recommended_action}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Alerts tab ───────────────────────────────────────────── */}
            {tab === 'alerts' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-700">Security Alerts</h3>
                  <div className="flex gap-2">
                    {['open', 'resolved', 'investigating'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setAlertFilter(s)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors capitalize ${
                          alertFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No {alertFilter} alerts</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {alerts.map((a) => (
                      <div key={a.id} className="px-5 py-4 flex items-start gap-4">
                        <span className={severityBadge(a.severity)}>{a.severity}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{a.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                          <p className="text-xs text-slate-400 mt-1">{a.user_email || a.user_id || 'Unknown user'} · {fmtTime(a.created_at)}</p>
                        </div>
                        {a.status === 'open' && (
                          <button
                            onClick={() => resolveAlert(a.id)}
                            disabled={actionLoading === a.id}
                            className="shrink-0 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === a.id ? '…' : 'Resolve'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── AI Risk Scores tab ───────────────────────────────────── */}
            {tab === 'risk' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-700">AI Risk Assessments</h3>
                </div>
                {assessments.length === 0 ? (
                  <p className="text-center py-16 text-slate-400">No assessments yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3 text-left">User</th>
                          <th className="px-5 py-3 text-left">Risk Score</th>
                          <th className="px-5 py-3 text-left">Classification</th>
                          <th className="px-5 py-3 text-left">Action</th>
                          <th className="px-5 py-3 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {assessments.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-700">{a.email || a.user_id}</td>
                            <td className="px-5 py-3 w-36">{riskBar(a.risk_score)}</td>
                            <td className="px-5 py-3 text-slate-600">{a.classification || '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                a.recommended_action === 'BLOCK_USER' ? 'bg-red-100 text-red-700' :
                                a.recommended_action === 'BLOCK_SESSION' ? 'bg-orange-100 text-orange-700' :
                                a.recommended_action === 'MONITOR' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>{a.recommended_action || '—'}</span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{fmtTime(a.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Events tab ───────────────────────────────────────────── */}
            {tab === 'events' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-700">Security Events <span className="text-slate-400 font-normal">({events.length})</span></h3>
                </div>
                {events.length === 0 ? (
                  <p className="text-center py-16 text-slate-400">No events yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3 text-left">Severity</th>
                          <th className="px-5 py-3 text-left">Type</th>
                          <th className="px-5 py-3 text-left">User</th>
                          <th className="px-5 py-3 text-left">Description</th>
                          <th className="px-5 py-3 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {events.map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3"><span className={severityBadge(ev.severity)}>{ev.severity}</span></td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">{ev.event_type}</td>
                            <td className="px-5 py-3 text-slate-600">{ev.email || ev.user_id || '—'}</td>
                            <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{ev.description || '—'}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{fmtTime(ev.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Users tab ────────────────────────────────────────────── */}
            {tab === 'users' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-700">All Users <span className="text-slate-400 font-normal">({users.length})</span></h3>
                </div>
                {users.length === 0 ? (
                  <p className="text-center py-16 text-slate-400">No users</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3 text-left">User</th>
                          <th className="px-5 py-3 text-left">Role</th>
                          <th className="px-5 py-3 text-left">Status</th>
                          <th className="px-5 py-3 text-left">Last login</th>
                          <th className="px-5 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs">
                                  {(u.full_name || u.email)[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-700">{u.full_name || '—'}</p>
                                  <p className="text-xs text-slate-400">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {u.is_blocked ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 text-xs">
                              {u.last_login ? fmtTime(u.last_login) : 'Never'}
                            </td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() => toggleBlock(u)}
                                disabled={actionLoading === u.id || u.role === 'admin'}
                                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                                  u.is_blocked
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                }`}
                              >
                                {actionLoading === u.id ? '…' : u.is_blocked ? 'Unblock' : 'Block'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Logs tab ─────────────────────────────────────────────── */}
            {tab === 'logs' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-700">Access Logs <span className="text-slate-400 font-normal">({logs.length})</span></h3>
                </div>
                {logs.length === 0 ? (
                  <p className="text-center py-16 text-slate-400">No access logs yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3 text-left">Event</th>
                          <th className="px-5 py-3 text-left">User</th>
                          <th className="px-5 py-3 text-left">IP Address</th>
                          <th className="px-5 py-3 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logs.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">{l.event_type}</td>
                            <td className="px-5 py-3 text-slate-600">{l.user_id || '—'}</td>
                            <td className="px-5 py-3 text-slate-400 font-mono text-xs">{l.ip_address || '—'}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{fmtTime(l.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
