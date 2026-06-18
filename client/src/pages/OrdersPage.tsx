import { useState, useEffect } from 'react';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DollTemplate,
  StageInfo,
  StageTimelineNode,
  KeyMilestone,
  PatternTask,
  FittingRecord,
  PATTERN_STATUS_LABELS,
  PATTERN_STATUS_COLORS,
  FITTING_STATUS_LABELS,
  FITTING_STATUS_COLORS,
  CommunicationRecord,
  ChangeOrder,
  ChangeType,
  ChangeOrderStatus,
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_CHANNEL_ICONS,
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_COLORS,
  CHANGE_ORDER_STATUS_LABELS,
  CHANGE_ORDER_STATUS_COLORS,
  FabricPreoccupyRecord,
  FABRIC_PREOCCUPY_STATUS_LABELS,
  FABRIC_PREOCCUPY_STATUS_COLORS,
  ScheduleCardData,
  DELAY_RISK_COLORS,
  DELAY_RISK_LABELS,
  SCHEDULE_STAGE_COLORS,
  SCHEDULE_STAGE_LABELS,
} from '../types';
import { orderApi, dollApi, communicationApi, changeOrderApi, scheduleApi } from '../api';

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
  const [detailStageInfo, setDetailStageInfo] = useState<StageInfo | null>(null);
  const [detailStageTimeline, setDetailStageTimeline] = useState<StageTimelineNode[]>([]);
  const [detailKeyMilestones, setDetailKeyMilestones] = useState<KeyMilestone[]>([]);
  const [detailPatterns, setDetailPatterns] = useState<PatternTask[]>([]);
  const [detailFittings, setDetailFittings] = useState<FittingRecord[]>([]);
  const [detailCommunications, setDetailCommunications] = useState<CommunicationRecord[]>([]);
  const [detailChangeOrders, setDetailChangeOrders] = useState<ChangeOrder[]>([]);
  const [detailPendingChangeCount, setDetailPendingChangeCount] = useState<number>(0);
  const [detailFabricRecords, setDetailFabricRecords] = useState<FabricPreoccupyRecord[]>([]);
  const [detailScheduleCard, setDetailScheduleCard] = useState<ScheduleCardData | null>(null);
  const [showCommunicationModal, setShowCommunicationModal] = useState<boolean>(false);
  const [showChangeOrderModal, setShowChangeOrderModal] = useState<boolean>(false);
  const [communicationFormData, setCommunicationFormData] = useState<any>({
    channel: 'wechat',
    content: '',
    imagePlaceholders: '',
    conclusion: '',
    follower: '张设计师',
  });
  const [changeOrderFormData, setChangeOrderFormData] = useState<any>({
    changeType: 'fabric',
    description: '',
    beforeValue: '',
    afterValue: '',
    priceDiff: 0,
    estimatedDelayDays: 0,
    refundNote: '',
    operator: '店主',
  });
  const [previewChangeOrder, setPreviewChangeOrder] = useState<ChangeOrder | null>(null);
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
      const ordersWithEnrich = await Promise.all(
        res.data.map(async (order) => {
          try {
            const detailRes = await orderApi.getById(order.id);
            const detailData = detailRes.data as any;
            return {
              ...order,
              pendingChangeCount: detailData.pendingChangeCount || 0,
            };
          } catch (e) {
            return {
              ...order,
              pendingChangeCount: 0,
            };
          }
        })
      );
      setOrders(ordersWithEnrich);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreateCommunication = async () => {
    if (!detailOrder || !communicationFormData.content) {
      alert('请填写沟通内容');
      return;
    }
    try {
      await communicationApi.create({
        orderId: detailOrder.id,
        channel: communicationFormData.channel,
        content: communicationFormData.content,
        imagePlaceholders: communicationFormData.imagePlaceholders
          ? communicationFormData.imagePlaceholders.split(',').map((s: string) => s.trim())
          : [],
        conclusion: communicationFormData.conclusion,
        follower: communicationFormData.follower,
      });
      alert('沟通记录添加成功');
      setShowCommunicationModal(false);
      setCommunicationFormData({
        channel: 'wechat',
        content: '',
        imagePlaceholders: '',
        conclusion: '',
        follower: '张设计师',
      });
      fetchOrderDetail(detailOrder);
    } catch (e) {
      console.error(e);
      alert('添加失败');
    }
  };

  const handlePreviewChangeOrder = async () => {
    if (!detailOrder || !changeOrderFormData.beforeValue || !changeOrderFormData.afterValue) {
      alert('请填写变更前值和变更后值');
      return;
    }
    try {
      const res = await changeOrderApi.preview({
        orderId: detailOrder.id,
        changeType: changeOrderFormData.changeType,
        beforeValue: changeOrderFormData.beforeValue,
        afterValue: changeOrderFormData.afterValue,
        description: changeOrderFormData.description,
        priceDiff: changeOrderFormData.priceDiff,
        estimatedDelayDays: changeOrderFormData.estimatedDelayDays,
      });
      setPreviewChangeOrder(res.data);
      alert('预览成功，系统已计算变更影响');
    } catch (e) {
      console.error(e);
      alert('预览失败');
    }
  };

  const handleCreateChangeOrder = async () => {
    if (!detailOrder || !changeOrderFormData.beforeValue || !changeOrderFormData.afterValue) {
      alert('请填写变更前值和变更后值');
      return;
    }
    if (changeOrderFormData.priceDiff < 0 && !changeOrderFormData.refundNote) {
      alert('价格差异为负时，退款说明为必填项');
      return;
    }
    try {
      await changeOrderApi.create({
        orderId: detailOrder.id,
        changeType: changeOrderFormData.changeType,
        description: changeOrderFormData.description,
        beforeValue: changeOrderFormData.beforeValue,
        afterValue: changeOrderFormData.afterValue,
        priceDiff: changeOrderFormData.priceDiff,
        estimatedDelayDays: changeOrderFormData.estimatedDelayDays,
        refundNote: changeOrderFormData.refundNote,
        operator: changeOrderFormData.operator,
      });
      alert('变更单创建成功');
      setShowChangeOrderModal(false);
      setChangeOrderFormData({
        changeType: 'fabric',
        description: '',
        beforeValue: '',
        afterValue: '',
        priceDiff: 0,
        estimatedDelayDays: 0,
        refundNote: '',
        operator: '店主',
      });
      setPreviewChangeOrder(null);
      fetchOrderDetail(detailOrder);
      fetchOrders();
    } catch (e) {
      console.error(e);
      alert('创建失败');
    }
  };

  const handleConfirmChangeOrder = async (changeOrderId: string) => {
    if (!detailOrder) return;
    if (!confirm('确定要通过此变更申请吗？确认后将更新订单金额和/或交付日期。')) {
      return;
    }
    try {
      const res = await changeOrderApi.confirm(changeOrderId, {
        confirmedBy: '店主',
      });
      alert('变更已确认');
      if (res.data.updatedOrder) {
        setDetailOrder(res.data.updatedOrder);
      }
      fetchOrderDetail(detailOrder);
      fetchOrders();
    } catch (e) {
      console.error(e);
      alert('确认失败');
    }
  };

  const handleRejectChangeOrder = async (changeOrderId: string) => {
    if (!detailOrder) return;
    const reason = prompt('请输入拒绝原因：');
    if (!reason) {
      alert('请填写拒绝原因');
      return;
    }
    try {
      await changeOrderApi.reject(changeOrderId, {
        rejectedBy: '店主',
        rejectedReason: reason,
      });
      alert('变更已拒绝');
      fetchOrderDetail(detailOrder);
      fetchOrders();
    } catch (e) {
      console.error(e);
      alert('拒绝失败');
    }
  };

  const openChangeOrderModal = (order?: Order) => {
    if (order && !detailOrder) {
      setDetailOrder(order);
    }
    setShowChangeOrderModal(true);
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
      const res = await orderApi.updateStatus(orderId, {
        status: newStatus,
        note,
        operator: '系统操作',
      });
      fetchOrders();
      if (detailOrder && detailOrder.id === orderId && res.data) {
        const data = res.data as any;
        setDetailStageInfo(data.stageInfo || null);
        setDetailStageTimeline(data.stageTimeline || []);
        setDetailKeyMilestones(data.keyMilestones || []);
        setDetailOrder(data);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '状态更新失败';
      alert(msg);
      console.error(e);
    }
  };

  const fetchOrderDetail = async (order: Order) => {
    try {
      const orderRes = await orderApi.getById(order.id);
      const data = orderRes.data as any;
      setDetailOrder(data);
      setDetailStageInfo(data.stageInfo || null);
      setDetailStageTimeline(data.stageTimeline || []);
      setDetailKeyMilestones(data.keyMilestones || []);
      setDetailPatterns(data.patternTasks || []);
      setDetailFittings(data.fittingRecords || []);
      setDetailCommunications(data.communications || []);
      setDetailChangeOrders(data.changeOrders || []);
      setDetailPendingChangeCount(data.pendingChangeCount || 0);
      setDetailFabricRecords(data.fabricPreoccupyRecords || []);

      try {
        const scheduleRes = await scheduleApi.getOrderSchedule(order.id);
        setDetailScheduleCard(scheduleRes.data);
      } catch (scheduleError) {
        console.error('获取排期卡片失败:', scheduleError);
        setDetailScheduleCard(null);
      }
    } catch (e) {
      console.error(e);
      setDetailOrder(order);
      setDetailStageInfo(null);
      setDetailStageTimeline([]);
      setDetailKeyMilestones([]);
      setDetailPatterns([]);
      setDetailFittings([]);
      setDetailCommunications([]);
      setDetailChangeOrders([]);
      setDetailPendingChangeCount(0);
      setDetailFabricRecords([]);
      setDetailScheduleCard(null);
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
                      <div className="flex items-center gap-2">
                        <div className="font-bold" style={{ fontSize: '13px' }}>{order.orderNumber}</div>
                        {(order as any).pendingChangeCount > 0 && (
                          <span
                            className="badge badge-urgent"
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              animation: 'pulse 2s infinite',
                            }}
                            title={`有 ${(order as any).pendingChangeCount} 个待确认变更`}
                          >
                            ● {(order as any).pendingChangeCount}
                          </span>
                        )}
                      </div>
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
                          onClick={() => {
                            fetchOrderDetail(order);
                          }}
                        >
                          查看
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => {
                            openChangeOrderModal(order);
                          }}
                          style={{ background: '#f59e0b', color: 'white', border: 'none' }}
                        >
                          需求变更
                        </button>
                        {nextStatusFlow[order.status] && (
                          <>
                            {order.stageInfo && !order.stageInfo.canDirectAdvance ? (
                              <button
                                className="btn btn-sm btn-primary"
                                disabled
                                title={order.stageInfo.advanceBlockReason || '当前状态无法直接推进'}
                                style={{ opacity: 0.6, cursor: 'not-allowed' }}
                              >
                                {nextActionLabel[order.status]}
                              </button>
                            ) : (
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
          <div className="modal" style={{ maxWidth: '820px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📄 订单详情 - {detailOrder.orderNumber}</h3>
              <button className="modal-close" onClick={() => setDetailOrder(null)}>×</button>
            </div>
            <div className="modal-body">
              {detailStageInfo && (
                <div style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, #fdf4ff 0%, #ede9fe 100%)',
                  borderRadius: '14px',
                  marginBottom: '20px',
                  border: '1px solid #ddd6fe',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: '-30px', right: '-30px', fontSize: '100px', opacity: 0.05 }}>
                    📍
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', position: 'relative' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 600, marginBottom: '6px' }}>📍 当前业务阶段</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#5b21b6' }}>
                        {detailStageInfo.stageLabel}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {detailStageInfo.patternStatus && (
                        <div style={{
                          padding: '10px 14px',
                          background: 'white',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          minWidth: '90px',
                        }}>
                          <span className="text-muted" style={{ fontSize: '11px' }}>✂️ 打版状态</span>
                          <div style={{ fontWeight: 700, color: '#6d28d9', marginTop: '3px', fontSize: '13px' }}>
                            {detailStageInfo.patternStatus}
                          </div>
                        </div>
                      )}
                      {detailStageInfo.fittingStatus && (
                        <div style={{
                          padding: '10px 14px',
                          background: 'white',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          minWidth: '90px',
                        }}>
                          <span className="text-muted" style={{ fontSize: '11px' }}>📸 试穿状态</span>
                          <div style={{ fontWeight: 700, color: '#f97316', marginTop: '3px', fontSize: '13px' }}>
                            {detailStageInfo.fittingStatus}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {detailStageInfo.nextAction && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      borderRadius: '10px',
                      borderLeft: '4px solid #22c55e',
                      position: 'relative',
                    }}>
                      <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, marginBottom: '4px' }}>
                        ✅ 下一步建议动作
                      </div>
                      <div style={{ fontSize: '14px', color: '#15803d', fontWeight: 500, lineHeight: 1.5 }}>
                        {detailStageInfo.nextAction}
                      </div>
                    </div>
                  )}

                  {detailStageInfo.blockReason && (
                    <div style={{
                      marginTop: '10px',
                      padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '10px',
                      borderLeft: '4px solid #ef4444',
                    }}>
                      <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, marginBottom: '4px' }}>
                        ⚠️ 阻塞原因
                      </div>
                      <div style={{ fontSize: '14px', color: '#b91c1c', fontWeight: 500, lineHeight: 1.5 }}>
                        {detailStageInfo.blockReason}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailStageTimeline.length > 0 && (
                <div style={{ marginBottom: '22px' }}>
                  <div className="card-title" style={{ marginBottom: '14px' }}>
                    🔄 阶段进度
                  </div>
                  <div className="stage-progress-bar" style={{ marginBottom: '14px' }}>
                    {detailStageTimeline.map((node, idx) => {
                      return (
                        <div key={node.stage} className="stage-progress-item">
                          <div
                            className={`stage-progress-dot ${node.isCompleted ? 'active' : ''} ${node.isCurrent ? 'current' : ''}`}
                            title={node.timestamp ? new Date(node.timestamp).toLocaleString('zh-CN') : ''}
                          >
                            {node.isCompleted && !node.isCurrent ? '✓' : idx + 1}
                          </div>
                          <div className={`stage-progress-label ${node.isCurrent ? 'current' : ''}`}>
                            {node.stageLabel.replace('阶段', '')}
                          </div>
                          {idx < detailStageTimeline.length - 1 && (
                            <div className={`stage-progress-line ${node.isCompleted && idx < detailStageTimeline.findIndex(n => !n.isCompleted) ? 'active' : ''}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailKeyMilestones.length > 0 && (
                <div style={{ marginBottom: '22px' }}>
                  <div className="card-title" style={{ marginBottom: '12px' }}>
                    📅 关键时间节点
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '10px',
                  }}>
                    {detailKeyMilestones.filter(m => m.timestamp).map((milestone, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                      }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                          {milestone.label}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                          {new Date(milestone.timestamp!).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {new Date(milestone.timestamp!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}

              {detailScheduleCard && (
                <div style={{ marginBottom: '22px' }}>
                  <div className="card-title" style={{ marginBottom: '14px' }}>
                    📊 排期与交付预测
                  </div>
                  <div style={{
                    padding: '20px',
                    background: detailScheduleCard.delayRisk === 'high' 
                      ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                      : detailScheduleCard.delayRisk === 'medium'
                        ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                        : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: '14px',
                    border: `2px solid ${DELAY_RISK_COLORS[detailScheduleCard.delayRisk]}40`,
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span
                        className="badge"
                        style={{
                          background: DELAY_RISK_COLORS[detailScheduleCard.delayRisk],
                          color: 'white',
                          fontWeight: 700,
                        }}
                      >
                        {DELAY_RISK_LABELS[detailScheduleCard.delayRisk]}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>当前阶段</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{detailScheduleCard.currentStage}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>下一阶段</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: detailScheduleCard.nextStage ? '#6366f1' : '#9ca3af' }}>
                          {detailScheduleCard.nextStage || '无'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>预计完成日期</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{detailScheduleCard.estimatedCompletionDate}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>约定交付日期</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{detailScheduleCard.deliveryDate}</div>
                      </div>
                    </div>

                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}>
                      <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        {detailScheduleCard.delayRiskDescription}
                      </div>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>整体进度</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>{detailScheduleCard.progressPercent.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                            borderRadius: '5px',
                            width: `${detailScheduleCard.progressPercent}%`,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '8px',
                      marginTop: '16px',
                    }}>
                      {detailScheduleCard.tasks.map(task => (
                        <div
                          key={task.id}
                          style={{
                            padding: '10px',
                            background: 'rgba(255,255,255,0.7)',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${SCHEDULE_STAGE_COLORS[task.stage]}`,
                            opacity: task.progress >= 100 ? 0.6 : 1,
                          }}
                        >
                          <div style={{
                            fontSize: '11px',
                            color: 'white',
                            background: SCHEDULE_STAGE_COLORS[task.stage],
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginBottom: '4px',
                          }}>
                            {task.stageLabel}
                          </div>
                          <div style={{ fontSize: '12px', color: '#374151', marginBottom: '2px' }}>
                            {task.startDate} ~ {task.endDate}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            进度：{task.progress.toFixed(0)}%
                          </div>
                          {task.isLocked && (
                            <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '2px' }}>🔒 已锁定</div>
                          )}
                          {task.isUrgent && (
                            <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>⚡ 加急</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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

              <div className="card-title mt-4">🧵 布料占用清单</div>
              {detailFabricRecords.length > 0 ? (
                <div>
                  {detailFabricRecords.some(r => r.status === 'pending_purchase') && (
                    <div style={{
                      padding: '12px 16px',
                      background: '#fef2f2',
                      borderRadius: '10px',
                      marginBottom: '12px',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      ⚠️ 警告：部分布料库存不足，可能影响交付时间
                    </div>
                  )}
                  <div className="table-container">
                    <table className="table small">
                      <thead>
                        <tr>
                          <th>布料名称</th>
                          <th>颜色</th>
                          <th>占用数量</th>
                          <th>状态</th>
                          <th>关联打版</th>
                          <th>备注</th>
                          <th>时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailFabricRecords.map(record => (
                          <tr key={record.id}>
                            <td style={{ fontWeight: 600 }}>{record.fabricName}</td>
                            <td>{record.color}</td>
                            <td>{record.preoccupyLength} {record.unit}</td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: FABRIC_PREOCCUPY_STATUS_COLORS[record.status] + '20',
                                  color: FABRIC_PREOCCUPY_STATUS_COLORS[record.status],
                                  fontWeight: 700,
                                }}
                              >
                                {FABRIC_PREOCCUPY_STATUS_LABELS[record.status]}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px' }}>{record.patternTaskId ? record.patternTaskId.slice(0, 12) : '-'}</td>
                            <td style={{ fontSize: '12px', color: '#6b7280' }}>{record.remark || '-'}</td>
                            <td style={{ fontSize: '12px' }}>{new Date(record.createdAt).toLocaleString('zh-CN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ color: '#64748b' }}>
                      共占用 {detailFabricRecords.length} 种布料
                    </span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      合计：{detailFabricRecords.reduce((sum, r) => sum + r.preoccupyLength, 0).toFixed(2)} {detailFabricRecords[0]?.unit || '米'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '20px',
                  background: '#fafafa',
                  borderRadius: '10px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '13px',
                }}>
                  该订单暂无布料预占记录
                </div>
              )}

              {(detailPatterns.length > 0 || detailFittings.length > 0) && (
                <div className="card-title mt-4">关联任务概览</div>
              )}
              {detailPatterns.length > 0 && (
                <div style={{ padding: '12px 14px', background: '#f5f3ff', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6d28d9', marginBottom: '6px' }}>
                    ✂️ 打版任务（共 {detailPatterns.length} 个）
                  </div>
                  {detailPatterns.map(p => (
                    <div key={p.id} style={{ fontSize: '12.5px', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>设计师：{p.designer}</span>
                      <span style={{ color: PATTERN_STATUS_COLORS[p.status as keyof typeof PATTERN_STATUS_COLORS], fontWeight: 600 }}>
                        {PATTERN_STATUS_LABELS[p.status as keyof typeof PATTERN_STATUS_LABELS]}
                        {p.reworkCount > 0 && ` · 返工${p.reworkCount}次`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {detailFittings.length > 0 && (
                <div style={{ padding: '12px 14px', background: '#fff7ed', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#c2410c', marginBottom: '6px' }}>
                    📸 试穿记录（共 {detailFittings.length} 轮）
                  </div>
                  {detailFittings.map(f => (
                    <div key={f.id} style={{ fontSize: '12.5px', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>第 {f.fittingRound} 轮</span>
                      <span style={{ color: FITTING_STATUS_COLORS[f.status], fontWeight: 600 }}>
                        {FITTING_STATUS_LABELS[f.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {detailPendingChangeCount > 0 && (
                <div
                  style={{
                    padding: '16px 20px',
                    background: '#fef2f2',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: '1px solid #fecaca',
                    borderLeft: '4px solid #ef4444',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>
                    ⚠️ 当前有 {detailPendingChangeCount} 个需求变更待确认，请及时审核处理
                  </div>
                </div>
              )}

              <div className="card-title mt-4">💬 客户沟通记录</div>
              <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    共 {detailCommunications.length} 条沟通记录
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowCommunicationModal(true)}
                  >
                    ＋ 新增沟通记录
                  </button>
                </div>
                {detailCommunications.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px' }}>
                    <div className="icon">💬</div>
                    <div className="empty-state-title">暂无沟通记录</div>
                  </div>
                ) : (
                  <div className="timeline">
                    {[...detailCommunications]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((comm) => (
                        <div key={comm.id} className="timeline-item">
                          <div className="timeline-time">
                            {new Date(comm.createdAt).toLocaleString('zh-CN')}
                          </div>
                          <div className="timeline-status" style={{ color: '#3b82f6' }}>
                            {COMMUNICATION_CHANNEL_ICONS[comm.channel as keyof typeof COMMUNICATION_CHANNEL_ICONS]}{' '}
                            {COMMUNICATION_CHANNEL_LABELS[comm.channel as keyof typeof COMMUNICATION_CHANNEL_LABELS]}
                          </div>
                          <div className="timeline-note" style={{ fontSize: '13px', marginTop: '6px' }}>
                            {comm.content}
                          </div>
                          {comm.imagePlaceholders && comm.imagePlaceholders.length > 0 && (
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {comm.imagePlaceholders.map((img, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    width: '80px',
                                    height: '80px',
                                    background: '#f1f5f9',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    color: '#94a3b8',
                                    border: '1px dashed #cbd5e1',
                                  }}
                                >
                                  📷 {img.substring(0, 8)}...
                                </div>
                              ))}
                            </div>
                          )}
                          {comm.conclusion && (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '10px 12px',
                                background: '#f0fdf4',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>客户确认结论：</span>
                              {comm.conclusion}
                            </div>
                          )}
                          <div className="timeline-operator" style={{ marginTop: '6px' }}>
                            跟进人：{comm.follower}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="card-title mt-4">📝 需求变更单</div>
              <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    共 {detailChangeOrders.length} 条变更记录
                  </div>
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => setShowChangeOrderModal(true)}
                    style={{ background: '#f59e0b', color: 'white', border: 'none' }}
                  >
                    ＋ 新增变更单
                  </button>
                </div>
                {detailChangeOrders.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px' }}>
                    <div className="icon">📝</div>
                    <div className="empty-state-title">暂无变更记录</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[...detailChangeOrders]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((co) => (
                        <div
                          key={co.id}
                          style={{
                            padding: '16px',
                            background: '#fafafa',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span
                                className="tag"
                                style={{
                                  background: CHANGE_TYPE_COLORS[co.changeType as keyof typeof CHANGE_TYPE_COLORS] + '20',
                                  color: CHANGE_TYPE_COLORS[co.changeType as keyof typeof CHANGE_TYPE_COLORS],
                                  fontWeight: 600,
                                  fontSize: '12px',
                                }}
                              >
                                {CHANGE_TYPE_LABELS[co.changeType as keyof typeof CHANGE_TYPE_LABELS]}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  background: CHANGE_ORDER_STATUS_COLORS[co.status as keyof typeof CHANGE_ORDER_STATUS_COLORS] + '20',
                                  color: CHANGE_ORDER_STATUS_COLORS[co.status as keyof typeof CHANGE_ORDER_STATUS_COLORS],
                                  fontWeight: 600,
                                  fontSize: '11px',
                                }}
                              >
                                {CHANGE_ORDER_STATUS_LABELS[co.status as keyof typeof CHANGE_ORDER_STATUS_LABELS]}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              申请时间：{new Date(co.createdAt).toLocaleString('zh-CN')}
                            </div>
                          </div>

                          <div style={{ fontSize: '13.5px', marginBottom: '10px' }}>
                            {co.description}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <div className="text-muted" style={{ fontSize: '11px' }}>变更内容</div>
                              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                                <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{co.beforeValue}</span>
                                <span style={{ margin: '0 8px', color: '#94a3b8' }}>→</span>
                                <span style={{ color: '#22c55e', fontWeight: 600 }}>{co.afterValue}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-muted" style={{ fontSize: '11px' }}>价格变动</div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                                ¥{co.priceBefore.toLocaleString()} → ¥{co.priceAfter.toLocaleString()}
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    color: co.priceDiff >= 0 ? '#22c55e' : '#ef4444',
                                    fontSize: '12px',
                                  }}
                                >
                                  {co.priceDiff >= 0 ? '+' : ''}¥{co.priceDiff.toLocaleString()}
                                </span>
                              </div>
                              {co.supplementAmount > 0 && (
                                <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '2px' }}>
                                  补款金额：¥{co.supplementAmount.toLocaleString()}
                                </div>
                              )}
                            </div>
                            {co.estimatedDelayDays > 0 && (
                              <div>
                                <div className="text-muted" style={{ fontSize: '11px' }}>预计延期</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#f59e0b' }}>
                                  {co.estimatedDelayDays} 天
                                </div>
                              </div>
                            )}
                          </div>

                          {co.stageImpact && (
                            <div
                              style={{
                                padding: '10px 12px',
                                background: '#fefce8',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                color: '#854d0e',
                                marginBottom: '12px',
                                border: '1px solid #fef08a',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>制作阶段影响：</span>
                              {co.stageImpact}
                            </div>
                          )}

                          {co.status === 'rejected' && co.rejectedReason && (
                            <div
                              style={{
                                padding: '10px 12px',
                                background: '#fef2f2',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                color: '#991b1b',
                                marginBottom: '12px',
                                border: '1px solid #fecaca',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>拒绝原因：</span>
                              {co.rejectedReason}
                              {co.rejectedBy && <span>（{co.rejectedBy}）</span>}
                            </div>
                          )}

                          {co.status === 'confirmed' && co.confirmedBy && (
                            <div
                              style={{
                                padding: '10px 12px',
                                background: '#f0fdf4',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                color: '#166534',
                                marginBottom: '12px',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>确认人：</span>
                              {co.confirmedBy}
                              {co.confirmedAt && (
                                <span style={{ marginLeft: '10px' }}>
                                  {new Date(co.confirmedAt).toLocaleString('zh-CN')}
                                </span>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {co.status === 'pending' && (
                              <>
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleConfirmChangeOrder(co.id)}
                                  style={{ background: '#22c55e', color: 'white', border: 'none' }}
                                >
                                  确认通过
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleRejectChangeOrder(co.id)}
                                >
                                  拒绝
                                </button>
                              </>
                            )}
                            {co.status === 'confirmed' && (
                              <button
                                className="btn btn-sm"
                                disabled
                                style={{ background: '#e5e7eb', color: '#6b7280', cursor: 'not-allowed' }}
                              >
                                已确认
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

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

      {showCommunicationModal && detailOrder && (
        <div className="modal-overlay" onClick={() => setShowCommunicationModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">💬 新增沟通记录</h3>
              <button className="modal-close" onClick={() => setShowCommunicationModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">沟通渠道</label>
                  <select
                    className="form-select"
                    value={communicationFormData.channel}
                    onChange={e => setCommunicationFormData({ ...communicationFormData, channel: e.target.value })}
                  >
                    {Object.entries(COMMUNICATION_CHANNEL_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {COMMUNICATION_CHANNEL_ICONS[key as keyof typeof COMMUNICATION_CHANNEL_ICONS]} {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">跟进人</label>
                  <input
                    className="form-input"
                    value={communicationFormData.follower}
                    onChange={e => setCommunicationFormData({ ...communicationFormData, follower: e.target.value })}
                    placeholder="请输入跟进人姓名"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label required">沟通内容</label>
                <textarea
                  className="form-textarea"
                  value={communicationFormData.content}
                  onChange={e => setCommunicationFormData({ ...communicationFormData, content: e.target.value })}
                  placeholder="请详细记录沟通内容..."
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label className="form-label">关联图片占位</label>
                <input
                  className="form-input"
                  value={communicationFormData.imagePlaceholders}
                  onChange={e => setCommunicationFormData({ ...communicationFormData, imagePlaceholders: e.target.value })}
                  placeholder="多个图片占位用逗号分隔"
                />
              </div>

              <div className="form-group">
                <label className="form-label">客户确认结论</label>
                <textarea
                  className="form-textarea"
                  value={communicationFormData.conclusion}
                  onChange={e => setCommunicationFormData({ ...communicationFormData, conclusion: e.target.value })}
                  placeholder="客户确认的结论或达成的共识"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCommunicationModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreateCommunication}>提交</button>
            </div>
          </div>
        </div>
      )}

      {showChangeOrderModal && detailOrder && (
        <div className="modal-overlay" onClick={() => setShowChangeOrderModal(false)}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📝 新增需求变更单</h3>
              <button className="modal-close" onClick={() => {
                setShowChangeOrderModal(false);
                setPreviewChangeOrder(null);
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">变更类型</label>
                  <select
                    className="form-select"
                    value={changeOrderFormData.changeType}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, changeType: e.target.value })}
                  >
                    {Object.entries(CHANGE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">操作人</label>
                  <input
                    className="form-input"
                    value={changeOrderFormData.operator}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, operator: e.target.value })}
                    placeholder="请输入操作人姓名"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">变更描述</label>
                <textarea
                  className="form-textarea"
                  value={changeOrderFormData.description}
                  onChange={e => setChangeOrderFormData({ ...changeOrderFormData, description: e.target.value })}
                  placeholder="请详细描述变更原因和内容..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">变更前值</label>
                  <input
                    className="form-input"
                    value={changeOrderFormData.beforeValue}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, beforeValue: e.target.value })}
                    placeholder="例如：真丝缎面"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">变更后值</label>
                  <input
                    className="form-input"
                    value={changeOrderFormData.afterValue}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, afterValue: e.target.value })}
                    placeholder="例如：雪纺"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">价格差异（元）</label>
                  <input
                    type="number"
                    className="form-input"
                    value={changeOrderFormData.priceDiff}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, priceDiff: parseFloat(e.target.value) || 0 })}
                    placeholder="正数表示加价，负数表示减价"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">预计延期天数</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={changeOrderFormData.estimatedDelayDays}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, estimatedDelayDays: parseInt(e.target.value) || 0 })}
                    placeholder="预计延期的天数"
                  />
                </div>
              </div>

              {changeOrderFormData.priceDiff < 0 && (
                <div className="form-group">
                  <label className="form-label required" style={{ color: '#dc2626' }}>退款说明</label>
                  <textarea
                    className="form-textarea"
                    style={{ borderColor: '#ef4444', borderWidth: '2px' }}
                    value={changeOrderFormData.refundNote}
                    onChange={e => setChangeOrderFormData({ ...changeOrderFormData, refundNote: e.target.value })}
                    placeholder="请详细说明退款原因、退款方式和时间安排..."
                    rows={3}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={handlePreviewChangeOrder}
                >
                  🔍 预览变更影响
                </button>
              </div>

              {previewChangeOrder && (
                <div
                  style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    borderRadius: '10px',
                    marginBottom: '16px',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#166534', marginBottom: '10px' }}>
                    📊 变更影响预览
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                    <div>
                      <span className="text-muted">原价：</span>
                      <span style={{ fontWeight: 600 }}>¥{previewChangeOrder.priceBefore.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted">现价：</span>
                      <span style={{ fontWeight: 600 }}>¥{previewChangeOrder.priceAfter.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted">价格变动：</span>
                      <span style={{ fontWeight: 600, color: previewChangeOrder.priceDiff >= 0 ? '#22c55e' : '#ef4444' }}>
                        {previewChangeOrder.priceDiff >= 0 ? '+' : ''}¥{previewChangeOrder.priceDiff.toLocaleString()}
                      </span>
                    </div>
                    {previewChangeOrder.supplementAmount > 0 && (
                      <div>
                        <span className="text-muted">补款金额：</span>
                        <span style={{ fontWeight: 600, color: '#f59e0b' }}>¥{previewChangeOrder.supplementAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {previewChangeOrder.estimatedDelayDays > 0 && (
                      <div>
                        <span className="text-muted">预计延期：</span>
                        <span style={{ fontWeight: 600, color: '#f59e0b' }}>{previewChangeOrder.estimatedDelayDays} 天</span>
                      </div>
                    )}
                  </div>
                  {previewChangeOrder.stageImpact && (
                    <div style={{ marginTop: '10px', fontSize: '13px' }}>
                      <span className="text-muted">阶段影响：</span>
                      <span style={{ color: '#854d0e' }}>{previewChangeOrder.stageImpact}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => {
                setShowChangeOrderModal(false);
                setPreviewChangeOrder(null);
              }}>取消</button>
              <button className="btn btn-primary" onClick={handleCreateChangeOrder}>提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
