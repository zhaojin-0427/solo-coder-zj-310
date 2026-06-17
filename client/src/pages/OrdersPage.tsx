import { useState, useEffect } from 'react';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DollTemplate,
} from '../types';
import { orderApi, dollApi } from '../api';

const STYLE_OPTIONS = [
  '宫廷风', '复古', '礼服', '汉服', '古风', '男装',
  '洛丽塔', '甜系', '可爱', '西装', '现代', '正装',
  'JK', '制服', '学院风', '和服', '和风', '传统',
  '日常', '休闲', '军装', '朋克', '哥特', '森系',
];

const FABRIC_OPTIONS = [
  '真丝缎面', '雪纺', '天丝亚麻', '棉麻', '印花棉布',
  '提花织锦', '精纺羊毛', '西装里布', '全棉', '正绢',
  '粘合衬', '蕾丝', '缎带',
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dolls, setDolls] = useState<DollTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDoll, setFilterDoll] = useState('');
  const [searchName, setSearchName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<any>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    dollTemplateId: '',
    items: [{ styleReference: '', fabricPreference: '', accessories: '', notes: '', quantity: 1 }],
    deliveryDate: '',
    priority: 'normal',
    styleTags: [] as string[],
    totalPrice: 0,
    deposit: 0,
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll({
        status: filterStatus || undefined,
        customerName: searchName || undefined,
        dollId: filterDoll || undefined,
      });
      setOrders(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchDolls = async () => {
    try {
      const res = await dollApi.getAll();
      setDolls(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDolls();
  }, [filterStatus, filterDoll, searchName]);

  const getDollName = (id: string) => {
    const d = dolls.find(x => x.id === id);
    return d ? `${d.brand} ${d.model}` : '-';
  };

  const handleSubmit = async () => {
    if (!formData.customerName || !formData.customerPhone || !formData.dollTemplateId || !formData.deliveryDate) {
      alert('请填写必填项：客户姓名、电话、娃体型号、交付日期');
      return;
    }
    try {
      await orderApi.create(formData);
      setShowModal(false);
      fetchOrders();
      resetForm();
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      dollTemplateId: '',
      items: [{ styleReference: '', fabricPreference: '', accessories: '', notes: '', quantity: 1 }],
      deliveryDate: '',
      priority: 'normal',
      styleTags: [],
      totalPrice: 0,
      deposit: 0,
    });
  };

  const toggleStyleTag = (tag: string) => {
    setFormData((prev: any) => ({
      ...prev,
      styleTags: prev.styleTags.includes(tag)
        ? prev.styleTags.filter((t: string) => t !== tag)
        : [...prev.styleTags, tag],
    }));
  };

  const updateItem = (idx: number, key: string, value: any) => {
    setFormData((prev: any) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      items: [...prev.items, { styleReference: '', fabricPreference: '', accessories: '', notes: '', quantity: 1 }],
    }));
  };

  const removeItem = (idx: number) => {
    setFormData((prev: any) => ({
      ...prev,
      items: prev.items.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    try {
      await orderApi.updateStatus(orderId, {
        status: newStatus,
        note,
        operator: '系统操作',
      });
      fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const nextStatusFlow: Record<string, OrderStatus> = {
    pending: 'confirmed',
    confirmed: 'pattern_making',
    pattern_making: 'fabric_prep',
    fabric_prep: 'sewing',
    sewing: 'fitting',
    fitting: 'customer_approved',
    customer_approved: 'shipping',
    shipping: 'completed',
  };

  const nextActionLabel: Record<string, string> = {
    pending: '确认接单',
    confirmed: '开始打版',
    pattern_making: '开始裁料',
    fabric_prep: '开始缝制',
    sewing: '进入试穿',
    fitting: '客户确认',
    customer_approved: '安排发货',
    shipping: '标记完成',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📋 定制订单</h2>
          <p className="page-subtitle">客户下单选择娃体、风格、布料，设计师分阶段推进订单</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span>＋</span> 新建订单
        </button>
      </div>

      <div className="filters">
        <div className="filter-item">
          <label className="form-label">订单状态</label>
          <select
            className="form-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">全部状态</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label className="form-label">娃体型号</label>
          <select
            className="form-select"
            value={filterDoll}
            onChange={e => setFilterDoll(e.target.value)}
          >
            <option value="">全部娃体</option>
            {dolls.map(d => (
              <option key={d.id} value={d.id}>{d.brand} {d.model}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label className="form-label">客户姓名</label>
          <input
            className="form-input"
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder="搜索客户姓名"
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
                <th>订单号</th>
                <th>客户信息</th>
                <th>娃体型号</th>
                <th>风格</th>
                <th>交付日期</th>
                <th>金额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="icon">📋</div>
                      <div className="empty-state-title">暂无订单</div>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <div className="font-bold" style={{ fontSize: '13px' }}>{order.orderNumber}</div>
                      <div className="text-muted" style={{ fontSize: '11px', marginTop: '3px' }}>
                        {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                      <div className="text-muted" style={{ fontSize: '11.5px' }}>{order.customerPhone}</div>
                    </td>
                    <td>{order.dollName || getDollName(order.dollTemplateId)}</td>
                    <td>
                      <div style={{ maxWidth: '180px' }}>
                        {order.styleTags.map(t => (
                          <span key={t} className="tag tag-purple">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.deliveryDate}</div>
                      <div className="mt-2">
                        <span className={order.priority === 'urgent' ? 'badge badge-urgent' : 'badge badge-normal'}>
                          {order.priority === 'urgent' ? '⚡ 加急' : '普通'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                        ¥{order.totalPrice.toLocaleString()}
                      </div>
                      <div className="text-muted" style={{ fontSize: '11.5px' }}>
                        定金 ¥{order.deposit}
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: ORDER_STATUS_COLORS[order.status] + '20',
                          color: ORDER_STATUS_COLORS[order.status],
                          fontWeight: 700,
                        }}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setDetailOrder(order)}
                        >
                          查看
                        </button>
                        {nextStatusFlow[order.status] && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              if (confirm(`确定要${nextActionLabel[order.status]}吗？`)) {
                                updateOrderStatus(order.id, nextStatusFlow[order.status], nextActionLabel[order.status]);
                              }
                            }}
                          >
                            {nextActionLabel[order.status]}
                          </button>
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
              <h3 className="modal-title">📝 新建定制订单</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="card-title">客户信息</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">客户姓名</label>
                  <input
                    className="form-input"
                    value={formData.customerName}
                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">联系电话</label>
                  <input
                    className="form-input"
                    value={formData.customerPhone}
                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">电子邮箱</label>
                  <input
                    className="form-input"
                    type="email"
                    value={formData.customerEmail}
                    onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="card-title mt-4">定制要求</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">娃体型号</label>
                  <select
                    className="form-select"
                    value={formData.dollTemplateId}
                    onChange={e => setFormData({ ...formData, dollTemplateId: e.target.value })}
                  >
                    <option value="">请选择娃体</option>
                    {dolls.map(d => (
                      <option key={d.id} value={d.id}>{d.brand} {d.model}（{d.height}cm）</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">交付日期</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.deliveryDate}
                    onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">优先级</label>
                  <select
                    className="form-select"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="normal">普通排单</option>
                    <option value="urgent">加急（+30%）</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">风格标签</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {STYLE_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleStyleTag(tag)}
                      className="btn btn-sm"
                      style={{
                        background: formData.styleTags.includes(tag)
                          ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                          : '#f1f5f9',
                        color: formData.styleTags.includes(tag) ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        padding: '5px 12px',
                        fontSize: '12px',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {formData.items.map((item: any, idx: number) => (
                <div key={idx} style={{ marginBottom: '20px', padding: '16px', background: '#fafafa', borderRadius: '10px' }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>服饰款式 #{idx + 1}</span>
                    {formData.items.length > 1 && (
                      <button className="btn btn-sm btn-danger" onClick={() => removeItem(idx)}>删除</button>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">风格参考</label>
                    <input
                      className="form-input"
                      placeholder="参考款式名称、图片链接或描述"
                      value={item.styleReference}
                      onChange={e => updateItem(idx, 'styleReference', e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label required">布料偏好</label>
                      <select
                        className="form-select"
                        value={item.fabricPreference}
                        onChange={e => updateItem(idx, 'fabricPreference', e.target.value)}
                      >
                        <option value="">选择布料</option>
                        {FABRIC_OPTIONS.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">配饰要求</label>
                      <input
                        className="form-input"
                        placeholder="如：珍珠、蕾丝、蝴蝶结、玉饰等"
                        value={item.accessories}
                        onChange={e => updateItem(idx, 'accessories', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">数量</label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">特殊备注</label>
                    <textarea
                      className="form-textarea"
                      placeholder="版型、颜色、细节等特殊要求"
                      value={item.notes}
                      onChange={e => updateItem(idx, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginBottom: '20px' }}
                onClick={addItem}
              >
                ＋ 添加服饰款式
              </button>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">总价（元）</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.totalPrice}
                    onChange={e => {
                      const total = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        totalPrice: total,
                        deposit: formData.deposit || Math.round(total * 0.3),
                      });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">定金（元）</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.deposit}
                    onChange={e => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>创建订单</button>
            </div>
          </div>
        </div>
      )}

      {detailOrder && (
        <div className="modal-overlay" onClick={() => setDetailOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📄 订单详情 - {detailOrder.orderNumber}</h3>
              <button className="modal-close" onClick={() => setDetailOrder(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="order-info-grid mb-4">
                <div className="info-block">
                  <div className="info-label">客户姓名</div>
                  <div className="info-value">{detailOrder.customerName}</div>
                </div>
                <div className="info-block">
                  <div className="info-label">联系电话</div>
                  <div className="info-value">{detailOrder.customerPhone}</div>
                </div>
                <div className="info-block">
                  <div className="info-label">娃体型号</div>
                  <div className="info-value">{detailOrder.dollName || getDollName(detailOrder.dollTemplateId)}</div>
                </div>
                <div className="info-block">
                  <div className="info-label">交付日期</div>
                  <div className="info-value">{detailOrder.deliveryDate}</div>
                </div>
              </div>

              <div className="card-title">服饰明细</div>
              {detailOrder.items.map((item, idx) => (
                <div key={idx} style={{ padding: '14px', background: '#fafafa', borderRadius: '10px', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>款式 #{idx + 1} × {item.quantity}</div>
                  <div className="form-row" style={{ gap: '10px' }}>
                    {item.styleReference && (
                      <div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>参考</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.styleReference}</div>
                      </div>
                    )}
                    {item.fabricPreference && (
                      <div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>布料</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.fabricPreference}</div>
                      </div>
                    )}
                    {item.accessories && (
                      <div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>配饰</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.accessories}</div>
                      </div>
                    )}
                  </div>
                  {item.notes && (
                    <div className="mt-2" style={{ fontSize: '12.5px' }}>
                      <span className="text-muted">备注：</span>{item.notes}
                    </div>
                  )}
                </div>
              ))}

              <div className="card-title mt-4">订单轨迹</div>
              <div className="timeline">
                {detailOrder.history.map((h, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-time">
                      {new Date(h.timestamp).toLocaleString('zh-CN')}
                    </div>
                    <div
                      className="timeline-status"
                      style={{ color: ORDER_STATUS_COLORS[h.status] }}
                    >
                      {ORDER_STATUS_LABELS[h.status]}
                    </div>
                    {h.note && <div className="timeline-note">{h.note}</div>}
                    <div className="timeline-operator">操作人：{h.operator}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailOrder(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
