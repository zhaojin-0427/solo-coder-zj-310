import { useState, useEffect } from 'react';
import {
  FittingRecord,
  Order,
  PatternTask,
  FittingStatus,
  FITTING_STATUS_LABELS,
  FITTING_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from '../types';
import { fittingApi, orderApi, patternApi } from '../api';

export default function FittingsPage() {
  const [fittings, setFittings] = useState<FittingRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [patterns, setPatterns] = useState<PatternTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailRecord, setDetailRecord] = useState<FittingRecord | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [formData, setFormData] = useState<any>({
    orderId: '',
    patternTaskId: '',
    photos: [
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=BJD%20doll%20clothes%20fitting%20front%20view%20professional%20photo&image_size=square_hd',
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=BJD%20doll%20clothes%20fitting%20side%20view%20professional%20photo&image_size=square_hd',
    ],
    designerNotes: '',
  });

  const fetchFittings = async () => {
    setLoading(true);
    try {
      const res = await fittingApi.getAll({ status: filterStatus || undefined });
      setFittings(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFittings();
    orderApi.getAll().then(r => setOrders(r.data)).catch(console.error);
    patternApi.getAll({ status: 'completed' }).then(r => setPatterns(r.data)).catch(console.error);
  }, [filterStatus]);

  const availableOrders = orders.filter(o =>
    ['fitting', 'sewing'].includes(o.status)
  );

  const handleSubmit = async () => {
    if (!formData.orderId) {
      alert('请选择订单');
      return;
    }
    try {
      const res = await fittingApi.create({
        ...formData,
        status: 'photo_taken',
      });
      setShowModal(false);
      fetchFittings();
      if (res.data && res.data.stageInfo) {
        alert(`试穿记录已创建，订单阶段已同步为：${res.data.stageInfo.stageLabel}`);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '创建失败，请稍后重试';
      alert(msg);
      console.error(e);
    }
  };

  const handleApprove = async (record: FittingRecord, feedback?: string) => {
    if (!confirm('确定通过此次试穿？确认后订单将自动进入客户确认阶段。')) return;
    try {
      const res = await fittingApi.updateStatus(record.id, {
        status: 'approved',
        customerFeedback: feedback || feedbackText || '客户确认满意',
      });
      setFeedbackText('');
      fetchFittings();
      if (res.data && res.data.stageInfo) {
        alert(`试穿已通过，订单阶段已同步为：${res.data.stageInfo.stageLabel}`);
      }
      if (detailRecord && detailRecord.id === record.id) {
        setDetailRecord(null);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '操作失败';
      alert(msg);
      console.error(e);
    }
  };

  const handleRework = async (record: FittingRecord, reason?: string) => {
    const text = reason || feedbackText;
    if (!text.trim()) {
      alert('请填写返工说明');
      return;
    }
    if (!confirm('确定标记为需要返工？订单将回退至打版阶段，打版任务返工次数将+1。')) return;
    try {
      const res = await fittingApi.updateStatus(record.id, {
        status: 'rework_needed',
        customerFeedback: text,
        reworkSuggestions: text.split(/[。,，\n]/).filter(Boolean).slice(0, 5),
      });
      setFeedbackText('');
      fetchFittings();
      if (res.data && res.data.stageInfo) {
        alert(`已标记为返工，订单阶段已同步为：${res.data.stageInfo.stageLabel}`);
      }
      if (detailRecord && detailRecord.id === record.id) {
        setDetailRecord(null);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '操作失败';
      alert(msg);
      console.error(e);
    }
  };

  const submitToReview = async (id: string) => {
    try {
      const res = await fittingApi.updateStatus(id, { status: 'customer_review' });
      fetchFittings();
      if (res.data && res.data.stageInfo) {
        console.log('订单阶段已同步更新:', res.data.stageInfo.stageLabel);
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
          <h2 className="page-title">📸 试穿确认</h2>
          <p className="page-subtitle">样衣试穿照片上传、客户分阶段反馈确认</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span>＋</span> 上传试穿记录
        </button>
      </div>

      <div className="filters">
        <div className="filter-item">
          <label className="form-label">确认状态</label>
          <select
            className="form-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            {Object.entries(FITTING_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
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
                <th>照片</th>
                <th>轮次</th>
                <th>状态</th>
                <th>设计师备注</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {fittings.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="icon">📸</div>
                      <div className="empty-state-title">暂无试穿记录</div>
                    </div>
                  </td>
                </tr>
              ) : (
                fittings.map(record => (
                  <tr key={record.id}>
                    <td>
                      {record.orderInfo ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{record.orderInfo.orderNumber}</div>
                          <div className="text-muted" style={{ fontSize: '12px' }}>
                            {record.orderInfo.customerName} · {record.orderInfo.dollName}
                          </div>
                          <div className="text-muted" style={{ fontSize: '11px', marginTop: '3px' }}>
                            交付: {record.orderInfo.deliveryDate}
                          </div>
                          <div className="mt-2">
                            {record.orderInfo.styleTags.map(t => (
                              <span key={t} className="tag tag-blue">{t}</span>
                            ))}
                          </div>
                        </>
                      ) : record.orderId}
                    </td>
                    <td>
                      <div className="flex gap-2" style={{ maxWidth: '180px', flexWrap: 'wrap' }}>
                        {record.photos.length === 0 ? (
                          <div
                            className="fitting-photo-placeholder"
                            style={{ width: '56px', height: '56px', aspectRatio: 'unset' }}
                          >
                            <span className="icon" style={{ fontSize: '20px' }}>📷</span>
                          </div>
                        ) : (
                          record.photos.slice(0, 3).map((p, idx) => (
                            <div
                              key={idx}
                              className="fitting-photo"
                              style={{ width: '56px', height: '56px', cursor: 'pointer' }}
                              onClick={() => setDetailRecord(record)}
                            >
                              <img src={p} alt={`试穿${idx + 1}`} />
                            </div>
                          ))
                        )}
                        {record.photos.length > 3 && (
                          <div style={{
                            width: '56px',
                            height: '56px',
                            background: '#f1f5f9',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            fontSize: '14px',
                            cursor: 'pointer',
                          }} onClick={() => setDetailRecord(record)}>
                            +{record.photos.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: '#ede9fe',
                        color: '#6d28d9',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                      }}>
                        第 {record.fittingRound} 轮
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: FITTING_STATUS_COLORS[record.status] + '20',
                          color: FITTING_STATUS_COLORS[record.status],
                          fontWeight: 700,
                        }}
                      >
                        {FITTING_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', maxWidth: '200px' }}>
                      {record.designerNotes ? (
                        <div className="text-muted" style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {record.designerNotes}
                        </div>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td style={{ fontSize: '12.5px' }}>
                      {new Date(record.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setDetailRecord(record)}
                        >
                          查看
                        </button>
                        {record.status === 'photo_taken' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => submitToReview(record.id)}
                          >
                            提交审核
                          </button>
                        )}
                        {record.status === 'customer_review' && (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => {
                                handleApprove(record, '');
                              }}
                            >
                              通过
                            </button>
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => {
                                const reason = prompt('请填写返工原因：');
                                if (reason && reason.trim()) {
                                  handleRework(record, reason);
                                }
                              }}
                            >
                              返工
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📸 上传试穿记录</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">关联订单</label>
                <select
                  className="form-select"
                  value={formData.orderId}
                  onChange={e => {
                    const orderId = e.target.value;
                    const pattern = patterns.find(p => p.orderId === orderId);
                    setFormData({
                      ...formData,
                      orderId,
                      patternTaskId: pattern?.id || '',
                    });
                  }}
                >
                  <option value="">选择订单</option>
                  {availableOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} - {o.customerName} ({o.dollName || o.dollTemplateId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="card-title">试穿照片（占位图自动生成）</div>
              <div className="fitting-photos">
                {formData.photos.map((p: string, idx: number) => (
                  <div key={idx} className="fitting-photo">
                    <img src={p} alt={`试穿${idx + 1}`} />
                  </div>
                ))}
                <div
                  className="fitting-photo-placeholder"
                  onClick={() => {
                    const prompts = [
                      'BJD%20doll%20clothes%20back%20view%20professional%20photo',
                      'BJD%20doll%20clothes%20detail%20shot%20accessory',
                      'BJD%20doll%20clothes%20full%20body%20elegant%20pose',
                    ];
                    const url = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${prompts[formData.photos.length % 3]}&image_size=square_hd`;
                    setFormData({
                      ...formData,
                      photos: [...formData.photos, url],
                    });
                  }}
                >
                  <span className="icon">📷</span>
                  <span>点击添加照片</span>
                </div>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">设计师试穿备注</label>
                <textarea
                  className="form-textarea"
                  placeholder="描述版型尺寸情况、试穿效果说明、需要调整的地方等"
                  value={formData.designerNotes}
                  onChange={e => setFormData({ ...formData, designerNotes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>提交试穿记录</button>
            </div>
          </div>
        </div>
      )}

      {detailRecord && (
        <div className="modal-overlay" onClick={() => setDetailRecord(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                📸 试穿详情 - 第{detailRecord.fittingRound}轮
              </h3>
              <button className="modal-close" onClick={() => setDetailRecord(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="order-info-grid mb-4">
                <div className="info-block">
                  <div className="info-label">订单号</div>
                  <div className="info-value">
                    {detailRecord.orderInfo?.orderNumber || detailRecord.orderId}
                  </div>
                </div>
                <div className="info-block">
                  <div className="info-label">状态</div>
                  <div className="info-value" style={{
                    color: FITTING_STATUS_COLORS[detailRecord.status],
                  }}>
                    {FITTING_STATUS_LABELS[detailRecord.status]}
                  </div>
                </div>
                <div className="info-block">
                  <div className="info-label">创建时间</div>
                  <div className="info-value" style={{ fontSize: '13px' }}>
                    {new Date(detailRecord.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="info-block">
                  <div className="info-label">更新时间</div>
                  <div className="info-value" style={{ fontSize: '13px' }}>
                    {new Date(detailRecord.updatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              <div className="card-title">试穿照片</div>
              <div className="fitting-photos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {detailRecord.photos.map((p, idx) => (
                  <div key={idx} className="fitting-photo">
                    <img src={p} alt={`试穿${idx + 1}`} style={{ cursor: 'zoom-in' }} />
                  </div>
                ))}
              </div>

              {detailRecord.designerNotes && (
                <>
                  <div className="card-title mt-4">设计师说明</div>
                  <div style={{
                    padding: '14px 16px',
                    background: '#eff6ff',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    borderLeft: '3px solid #3b82f6',
                  }}>
                    {detailRecord.designerNotes}
                  </div>
                </>
              )}

              {detailRecord.customerFeedback && (
                <>
                  <div className="card-title mt-4">客户反馈</div>
                  <div style={{
                    padding: '14px 16px',
                    background: detailRecord.status === 'rework_needed' ? '#fef2f2' : '#f0fdf4',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    borderLeft: `3px solid ${detailRecord.status === 'rework_needed' ? '#ef4444' : '#22c55e'}`,
                  }}>
                    {detailRecord.customerFeedback}
                  </div>
                </>
              )}

              {detailRecord.reworkSuggestions && detailRecord.reworkSuggestions.length > 0 && (
                <>
                  <div className="card-title mt-4">返工修改点</div>
                  <ul style={{ paddingLeft: '20px', fontSize: '13.5px' }}>
                    {detailRecord.reworkSuggestions.map((s, idx) => (
                      <li key={idx} style={{ padding: '4px 0' }}>{s}</li>
                    ))}
                  </ul>
                </>
              )}

              {detailRecord.status === 'customer_review' && (
                <>
                  <div className="card-title mt-4">💬 客户确认操作</div>
                  <div className="form-group">
                    <textarea
                      className="form-textarea"
                      placeholder="请填写反馈意见（返工需详细说明修改点）..."
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="btn btn-success flex-1"
                      onClick={() => handleApprove(detailRecord)}
                    >
                      ✅ 确认满意，通过试穿
                    </button>
                    <button
                      className="btn btn-warning flex-1"
                      onClick={() => handleRework(detailRecord)}
                    >
                      🔄 需要返工修改
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailRecord(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
