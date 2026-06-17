import { useState, useEffect } from 'react';
import { StatsData, SummaryData } from '../types';
import { statsApi } from '../api';

const PIE_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#f97316'];

function DonutChart({
  data,
}: {
  data: { style: string; count: number; percentage: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const radius = 70;
  const innerRadius = 44;
  const strokeWidth = radius - innerRadius;
  const circumference = 2 * Math.PI * ((radius + innerRadius) / 2);

  let offset = 0;

  return (
    <div className="donut-chart-container">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle
          cx="90"
          cy="90"
          r={(radius + innerRadius) / 2}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {data.map((d, idx) => {
          const percent = d.count / total;
          const dashArray = `${percent * circumference} ${circumference}`;
          const dashOffset = -offset * circumference;
          offset += percent;
          return (
            <circle
              key={idx}
              cx="90"
              cy="90"
              r={(radius + innerRadius) / 2}
              fill="none"
              stroke={PIE_COLORS[idx % PIE_COLORS.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 90 90)"
              style={{ transition: 'all 0.6s ease' }}
            />
          );
        })}
        <text
          x="90"
          y="82"
          textAnchor="middle"
          style={{ fontSize: '26px', fontWeight: 700, fill: '#0f172a' }}
        >
          {total}
        </text>
        <text
          x="90"
          y="102"
          textAnchor="middle"
          style={{ fontSize: '11px', fill: '#64748b', fontWeight: 500 }}
        >
          风格标签总数
        </text>
      </svg>
      <div className="donut-legend">
        {data.slice(0, 8).map((d, idx) => (
          <div key={idx} className="donut-legend-item">
            <div
              className="donut-legend-color"
              style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
            />
            <span className="donut-legend-text">{d.style}</span>
            <span className="donut-legend-percent">{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s1, s2] = await Promise.all([statsApi.getStats(), statsApi.getSummary()]);
      setStats(s1.data);
      setSummary(s2.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const maxRework = stats ? Math.max(...stats.reworkRate.map(r => r.rate), 10) : 10;
  const maxFabric = stats ? Math.max(...stats.fabricConsumption.map(f => f.totalUsed), 1) : 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📊 数据统计</h2>
          <p className="page-subtitle">各娃体返工率、布料消耗、排单周期、热门风格分析</p>
        </div>
        <button className="btn btn-outline" onClick={fetchAll}>
          🔄 刷新数据
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div>加载中...</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">总订单数</div>
              <div className="stat-value">{summary?.totalOrders || 0}</div>
              <div className="stat-trend">
                待处理 <strong style={{ color: 'var(--warning)' }}>{summary?.pendingOrders || 0}</strong>
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">进行中订单</div>
              <div className="stat-value">{summary?.inProgressOrders || 0}</div>
              <div className="stat-trend">
                已完成 <strong style={{ color: 'var(--success)' }}>{summary?.completedOrders || 0}</strong>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">累计营收（元）</div>
              <div className="stat-value" style={{ fontSize: '26px' }}>
                ¥{(summary?.totalRevenue || 0).toLocaleString()}
              </div>
              <div className="stat-trend">
                平均单价 ¥{summary?.totalOrders ? Math.round(summary.totalRevenue / summary.totalOrders) : 0}
              </div>
            </div>
            <div className="stat-card orange">
              <div className="stat-label">平均排单周期</div>
              <div className="stat-value">
                {stats?.avgCycleTime || 0}
                <span style={{ fontSize: '18px', marginLeft: '4px', fontWeight: 500 }}>天</span>
              </div>
              <div className="stat-trend">
                从下单到交付平均时长
              </div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">版型模板数</div>
              <div className="stat-value">{summary?.totalDollTemplates || 0}</div>
              <div className="stat-trend">
                活跃打版 <strong style={{ color: 'var(--accent)' }}>{summary?.activePatterns || 0}</strong>
              </div>
            </div>
            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fdf4ff 0%, #faf5ff 100%)' }}>
              <div className="stat-label">待试穿确认</div>
              <div className="stat-value" style={{ color: 'var(--primary-dark)' }}>
                {summary?.pendingFittings || 0}
              </div>
              <div className="stat-trend">
                样衣等待客户反馈
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">👗 热门风格占比</h3>
            {stats && stats.styleDistribution.length > 0 ? (
              <DonutChart data={stats.styleDistribution} />
            ) : (
              <div className="empty-state">暂无数据</div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">📐 各娃体返工率分析</h3>
            {stats && stats.reworkRate.length > 0 ? (
              <div className="bar-chart">
                {stats.reworkRate.map((item, idx) => (
                  <div key={idx} className="bar-chart-item">
                    <div className="bar-chart-label">{item.dollName}</div>
                    <div className="bar-chart-track">
                      <div
                        className={
                          'bar-chart-fill ' +
                          (item.rate >= 50 ? '' : item.rate >= 30 ? 'orange' : item.rate >= 15 ? 'blue' : 'green')
                        }
                        style={{ width: `${Math.max((item.rate / maxRework) * 100, item.rate > 0 ? 8 : 0)}%` }}
                      >
                        {item.rate > 0 ? `${item.rate}%` : ''}
                      </div>
                    </div>
                    <div className="bar-chart-value">
                      {item.reworkOrders}/{item.totalOrders} 单
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无数据</div>
            )}
            <div className="mt-4 text-muted" style={{ fontSize: '12px' }}>
              💡 <strong>说明：</strong>返工率高的娃体建议优化版型基础模板，降低反复修改工作量
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">🧵 布料消耗排行</h3>
            {stats && stats.fabricConsumption.length > 0 ? (
              <div className="bar-chart">
                {stats.fabricConsumption.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="bar-chart-item">
                    <div className="bar-chart-label" style={{ minWidth: '160px' }}>
                      <div>{item.fabricName}</div>
                      <div className="text-muted" style={{ fontSize: '11px', fontWeight: 400 }}>
                        {item.color}
                      </div>
                    </div>
                    <div className="bar-chart-track">
                      <div
                        className={
                          'bar-chart-fill ' +
                          (idx === 0 ? '' : idx === 1 ? 'blue' : idx === 2 ? 'green' : 'orange')
                        }
                        style={{
                          width: `${Math.max((item.totalUsed / maxFabric) * 100, 5)}%`,
                        }}
                      >
                        {item.totalUsed} {item.unit}
                      </div>
                    </div>
                    <div className="bar-chart-value">
                      {item.totalUsed} {item.unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无数据</div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">💡 智能经营建议</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px',
            }}>
              <div style={{
                padding: '18px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: '12px',
                borderLeft: '4px solid #3b82f6',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>📅</div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>排单周期优化</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  当前平均排单 <strong>{stats?.avgCycleTime || 0}天</strong>，建议对加急订单单独开辟快速通道，承诺周期控制在15天内。
                </div>
              </div>
              <div style={{
                padding: '18px',
                background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
                borderRadius: '12px',
                borderLeft: '4px solid var(--primary)',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>🎨</div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>热门风格备货</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {stats && stats.styleDistribution.length > 0 && (
                    <>
                      <strong>{stats.styleDistribution[0].style}</strong>（{stats.styleDistribution[0].percentage}%）为最热门风格，可常备基础布料。
                    </>
                  )}
                </div>
              </div>
              <div style={{
                padding: '18px',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                borderRadius: '12px',
                borderLeft: '4px solid #ef4444',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>高返工娃体提醒</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {stats && (() => {
                    const high = stats.reworkRate.filter(r => r.rate >= 30);
                    return high.length > 0
                      ? <>娃体 <strong>{high.map(h => h.dollName).join('、')}</strong> 返工率较高，建议重新校准基础版型。</>
                      : '目前各娃体返工率均在合理范围内（<30%），继续保持。';
                  })()}
                </div>
              </div>
              <div style={{
                padding: '18px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '12px',
                borderLeft: '4px solid #22c55e',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '8px' }}>💰</div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>营收分析</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  累计营收 <strong>¥{(summary?.totalRevenue || 0).toLocaleString()}</strong>，平均客单价
                  <strong> ¥{summary?.totalOrders ? Math.round(summary.totalRevenue / summary.totalOrders) : 0}</strong>，可推出高端套餐提升单价。
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
