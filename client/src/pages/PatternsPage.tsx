import { useState, useEffect } from 'react';
import {
  PatternTask,
  Order,
  DollTemplate,
  PATTERN_STATUS_LABELS,
  PATTERN_STATUS_COLORS,
} from '../types';
import { patternApi, orderApi, dollApi } from '../api';

export default function PatternsPage() {
  const [tasks, setTasks] = useState<PatternTask[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dolls, setDolls] = useState<DollTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchDesigner, setSearchDesigner] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailTask, setDetailTask] = useState<PatternTask | null>(null);
  const [formData, setFormData] = useState<any>({
    orderId: '',
    designer: '',
    status: 'pending',
    patternPieces: [{ name: '', quantity: 1, fabricType: '', size: '按尺寸' }],
    fabricUsage: [{ fabricName: '', width: 1.5, length: 1, unit: 'meter', color: '' }],
    notes: '',
    estimatedHours: 20,
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await patternApi.getAll({
        status: filterStatus || undefined,
        designer: searchDesigner || undefined,
      });
      setTasks(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
    orderApi.getAll().then(r => setOrders(r.data)).catch(console.error);
    dollApi.getAll().then(r => setDolls(r.data)).catch(console.error);
  }, [filterStatus, searchDesigner]);

  const pendingOrders = orders.filter(o => ['confirmed', 'pattern_making'].includes(o.status));

  const handleSubmit = async () => {
    if (!formData.orderId || !formData.designer) {
      alert('请选择订单和设计师');
      return;
    }
    try {
      const res = await patternApi.create(formData);
      setShowModal(false);
      fetchTasks();
      resetForm();
      if (res.data && res.data.stageInfo) {
        alert(`打版任务已创建，订单阶段已同步为：${res.data.stageInfo.stageLabel}`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '创建打版任务失败，请稍后重试';
      alert(msg);
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      orderId: '',
      designer: '',
      status: 'pending',
      patternPieces: [{ name: '', quantity: 1, fabricType: '', size: '按尺寸' }],
      fabricUsage: [{ fabricName: '', width: 1.5, length: 1, unit: 'meter', color: '' }],
      notes: '',
      estimatedHours: 20,
    });
  };

  const updatePiece = (idx: number, key: string, value: any) => {
    setFormData((prev: any) => {
      const p = [...prev.patternPieces];
      p[idx] = { ...p[idx], [key]: value };
      return { ...prev, patternPieces: p };
    });
  };

  const addPiece = () => {
    setFormData((prev: any) => ({
      ...prev,
      patternPieces: [...prev.patternPieces, { name: '', quantity: 1, fabricType: '', size: '按尺寸' }],
    }));
  };

  const removePiece = (idx: number) => {
    setFormData((prev: any) => ({
      ...prev,
      patternPieces: prev.patternPieces.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateFabric = (idx: number, key: string, value: any) => {
    setFormData((prev: any) => {
      const f = [...prev.fabricUsage];
      f[idx] = { ...f[idx], [key]: value };
      return { ...prev, fabricUsage: f };
    });
  };

  const addFabric = () => {
    setFormData((prev: any) => ({
      ...prev,
      fabricUsage: [...prev.fabricUsage, { fabricName: '', width: 1.5, length: 1, unit: 'meter', color: '' }],
    }));
  };

  const removeFabric = (idx: number) => {
    setFormData((prev: any) => ({
      ...prev,
      fabricUsage: prev.fabricUsage.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      const res = await patternApi.updateStatus(taskId, status);
      fetchTasks();
      if (res.data && res.data.stageInfo) {
        console.log('订单阶段已同步更新:', res.data.stageInfo.stageLabel);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '状态更新失败';
      alert(msg);
      console.error(e);
      fetchTasks();
    }
  };

  const handleRework = async (taskId: string) => {
    if (!confirm('确定标记为需要返工吗？订单状态将自动回退至打版阶段。')) return;
    try {
      const res = await patternApi.rework(taskId);
      fetchTasks();
      if (res.data && res.data.stageInfo) {
        alert(`打版已标记为返工，订单阶段已同步为：${res.data.stageInfo.stageLabel}`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '操作失败';
      alert(msg);
      console.error(e);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">✂️ 打版进度</h2>
          <p className="page-subtitle">设计师分配打版任务，记录版型部件和布料用量</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span>＋</span> 创建打版任务
        </button>
      </div>

      <div className="filters">
        <div className="filter-item">
          <label className="form-label">任务状态</label>
          <select
            className="form-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            {Object.entries(PATTERN_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label className="form-label">设计师</label>
          <input
            className="form-input"
            value={searchDesigner}
            onChange={e => setSearchDesigner(e.target.value)}
            placeholder="搜索设计师"
          />
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div>加载中...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>关联订单</th>
                <th>设计师</th>
                <th>版型部件</th>
                <th>布料种类</th>
                <th>工时</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="icon">✂️</div>
                      <div className="empty-state-title">暂无打版任务</div>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map(task => {
                  const order = orders.find(o => o.id === task.orderId);
                  return (
                    <tr key={task.id}>
                      <td>
                        {task.orderInfo ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{task.orderInfo.orderNumber}</div>
                            <div className="text-muted" style={{ fontSize: '12px' }}>
                              {task.orderInfo.customerName} · {task.orderInfo.dollName}
                            </div>
                            <div className="mt-2">
                              {task.orderInfo.styleTags.map(t => (
                                <span key={t} className="tag tag-purple">{t}</span>
                              ))}
                            </div>
                          </>
                        ) : (
                          order?.orderNumber || task.orderId
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{task.designer}</td>
                      <td>
                        <span style={{
                          background: '#ede9fe',
                          color: '#6d28d9',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '12.5px',
                        }}>
                          {task.patternPieces.length} 件
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '12.5px',
                        }}>
                          {task.fabricUsage.length} 种
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{task.actualHours || task.estimatedHours}h</div>
                        {task.reworkCount > 0 && (
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--danger)',
                            fontWeight: 600,
                            marginTop: '2px',
                          }}>
                            🔄 返工 × {task.reworkCount}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: PATTERN_STATUS_COLORS[task.status as keyof typeof PATTERN_STATUS_COLORS] + '20',
                            color: PATTERN_STATUS_COLORS[task.status as keyof typeof PATTERN_STATUS_COLORS],
                            fontWeight: 700,
                          }}
                        >
                          {PATTERN_STATUS_LABELS[task.status as keyof typeof PATTERN_STATUS_LABELS]}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setDetailTask(task)}
                          >
                            详情
                          </button>
                          <select
                            className="form-select"
                            style={{ padding: '5px 8px', fontSize: '12px', width: 'auto' }}
                            value={task.status}
                            onChange={e => updateStatus(task.id, e.target.value)}
                          >
                            {Object.entries(PATTERN_STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => handleRework(task.id)}
                          >
                            返工
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✂️ 创建打版任务</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">关联订单</label>
                  <select
                    className="form-select"
                    value={formData.orderId}
                    onChange={e => setFormData({ ...formData, orderId: e.target.value })}
                  >
                    <option value="">选择订单</option>
                    {pendingOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} - {o.customerName} ({o.dollName || o.dollTemplateId})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">设计师</label>
                  <input
                    className="form-input"
                    placeholder="例：张设计师"
                    value={formData.designer}
                    onChange={e => setFormData({ ...formData, designer: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">预计工时（小时）</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.estimatedHours}
                    onChange={e => setFormData({ ...formData, estimatedHours: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="card-title mt-4">版型部件清单</div>
              {formData.patternPieces.map((p: any, idx: number) => (
                <div key={idx} style={{
                  padding: '14px',
                  background: '#fafafa',
                  borderRadius: '10px',
                  marginBottom: '10px',
                }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>部件 #{idx + 1}</span>
                    {formData.patternPieces.length > 1 && (
                      <button className="btn btn-sm btn-danger" onClick={() => removePiece(idx)}>删除</button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">部件名称</label>
                      <input
                        className="form-input"
                        placeholder="如：上衣前片、裙摆、袖子"
                        value={p.name}
                        onChange={e => updatePiece(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">数量</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        value={p.quantity}
                        onChange={e => updatePiece(idx, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">布料类型</label>
                      <input
                        className="form-input"
                        placeholder="如：真丝缎面、棉麻"
                        value={p.fabricType}
                        onChange={e => updatePiece(idx, 'fabricType', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '20px' }} onClick={addPiece}>
                ＋ 添加版型部件
              </button>

              <div className="card-title">布料用量估算</div>
              {formData.fabricUsage.map((f: any, idx: number) => (
                <div key={idx} style={{
                  padding: '14px',
                  background: '#fafafa',
                  borderRadius: '10px',
                  marginBottom: '10px',
                }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>布料 #{idx + 1}</span>
                    {formData.fabricUsage.length > 1 && (
                      <button className="btn btn-sm btn-danger" onClick={() => removeFabric(idx)}>删除</button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">布料名称</label>
                      <input
                        className="form-input"
                        placeholder="如：真丝缎面酒红"
                        value={f.fabricName}
                        onChange={e => updateFabric(idx, 'fabricName', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">颜色</label>
                      <input
                        className="form-input"
                        placeholder="如：酒红色、米白"
                        value={f.color}
                        onChange={e => updateFabric(idx, 'color', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">门幅（米）</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={f.width}
                        onChange={e => updateFabric(idx, 'width', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">用量（米）</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={f.length}
                        onChange={e => updateFabric(idx, 'length', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '20px' }} onClick={addFabric}>
                ＋ 添加布料
              </button>

              <div className="form-group">
                <label className="form-label">打版备注</label>
                <textarea
                  className="form-textarea"
                  placeholder="版型说明、注意事项等"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>创建任务</button>
            </div>
          </div>
        </div>
      )}

      {detailTask && (
        <div className="modal-overlay" onClick={() => setDetailTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📐 打版任务详情</h3>
              <button className="modal-close" onClick={() => setDetailTask(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="order-info-grid mb-4">
                <div className="info-block">
                  <div className="info-label">设计师</div>
                  <div className="info-value">{detailTask.designer}</div>
                </div>
                <div className="info-block">
                  <div className="info-label">状态</div>
                  <div className="info-value" style={{
                    color: PATTERN_STATUS_COLORS[detailTask.status as keyof typeof PATTERN_STATUS_COLORS],
                  }}>
                    {PATTERN_STATUS_LABELS[detailTask.status as keyof typeof PATTERN_STATUS_LABELS]}
                  </div>
                </div>
                <div className="info-block">
                  <div className="info-label">预计工时</div>
                  <div className="info-value">{detailTask.estimatedHours} 小时</div>
                </div>
                <div className="info-block">
                  <div className="info-label">实际工时</div>
                  <div className="info-value">{detailTask.actualHours ? `${detailTask.actualHours} 小时` : '进行中'}</div>
                </div>
              </div>

              {detailTask.reworkCount > 0 && (
                <div style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  borderRadius: '10px',
                  marginBottom: '18px',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  🔄 已返工 {detailTask.reworkCount} 次
                </div>
              )}

              <div className="card-title">版型部件</div>
              <div className="pieces-list">
                {detailTask.patternPieces.map((p, idx) => (
                  <div key={idx} className="list-item">
                    <div>
                      <span className="list-item-name">{p.name}</span>
                      <span className="text-muted" style={{ marginLeft: '8px', fontSize: '12px' }}>
                        · {p.fabricType || '未指定'} · {p.size}
                      </span>
                    </div>
                    <span className="list-item-info" style={{ fontWeight: 700 }}>× {p.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="card-title mt-4">布料用量</div>
              <div className="fabric-list">
                {detailTask.fabricUsage.map((f, idx) => (
                  <div key={idx} className="list-item">
                    <div>
                      <span className="list-item-name">{f.fabricName}</span>
                      <span className="text-muted" style={{ marginLeft: '8px', fontSize: '12px' }}>
                        · 颜色: {f.color} · 门幅: {f.width}m
                      </span>
                    </div>
                    <span className="list-item-info" style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                      {f.length} {f.unit === 'meter' ? '米' : '码'}
                    </span>
                  </div>
                ))}
              </div>

              {detailTask.notes && (
                <>
                  <div className="card-title mt-4">备注</div>
                  <div style={{ padding: '14px', background: '#fafafa', borderRadius: '10px', fontSize: '13.5px' }}>
                    {detailTask.notes}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailTask(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
