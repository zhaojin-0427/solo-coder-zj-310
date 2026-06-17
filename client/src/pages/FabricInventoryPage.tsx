import { useState, useEffect } from 'react';
import {
  FabricInventory,
  FabricPreoccupyRecord,
  FabricAdjustRecord,
  PurchaseSuggestion,
  FABRIC_PREOCCUPY_STATUS_LABELS,
  FABRIC_PREOCCUPY_STATUS_COLORS,
  FABRIC_ADJUST_TYPE_LABELS,
  PURCHASE_SUGGESTION_STATUS_LABELS,
  PURCHASE_SUGGESTION_STATUS_COLORS,
} from '../types';
import { fabricInventoryApi } from '../api';

type TabType = 'inventory' | 'purchase' | 'preoccupy' | 'adjust';

export default function FabricInventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [fabrics, setFabrics] = useState<FabricInventory[]>([]);
  const [purchaseSuggestions, setPurchaseSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'stockIn' | 'adjust' | 'release' | 'detail' | 'purchase'>('create');
  const [selectedFabric, setSelectedFabric] = useState<FabricInventory | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseSuggestion | null>(null);
  const [preoccupyRecords, setPreoccupyRecords] = useState<FabricPreoccupyRecord[]>([]);
  const [adjustRecords, setAdjustRecords] = useState<FabricAdjustRecord[]>([]);

  const [formData, setFormData] = useState<any>({
    fabricName: '',
    color: '',
    width: 1.5,
    widthUnit: '米',
    stockLength: 0,
    unit: '米',
    safetyStock: 5,
    supplier: '',
    purchaseCycle: 7,
    purchaseCycleUnit: '天',
    unitPrice: 0,
    currency: '元',
    remark: '',
  });

  const [actionForm, setActionForm] = useState<any>({
    length: 0,
    operator: '',
    remark: '',
    preoccupyRecordId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fabricRes, purchaseRes] = await Promise.all([
        fabricInventoryApi.getAll({
          lowStock: filterLowStock ? true : undefined,
        }),
        fabricInventoryApi.getPurchaseSuggestions(),
      ]);
      setFabrics(fabricRes.data);
      setPurchaseSuggestions(purchaseRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterLowStock]);

  const filteredFabrics = fabrics.filter(f => {
    if (!searchKeyword) return true;
    const keyword = searchKeyword.toLowerCase();
    return (
      f.fabricName.toLowerCase().includes(keyword) ||
      f.color.toLowerCase().includes(keyword) ||
      f.supplier.toLowerCase().includes(keyword)
    );
  });

  const openCreateModal = () => {
    setModalType('create');
    setShowModal(true);
  };

  const openStockInModal = (fabric: FabricInventory) => {
    setSelectedFabric(fabric);
    setModalType('stockIn');
    setActionForm({ length: 0, operator: '', remark: '' });
    setShowModal(true);
  };

  const openAdjustModal = (fabric: FabricInventory) => {
    setSelectedFabric(fabric);
    setModalType('adjust');
    setActionForm({ length: 0, operator: '', remark: '' });
    setShowModal(true);
  };

  const openReleaseModal = async (fabric: FabricInventory) => {
    setSelectedFabric(fabric);
    setModalType('release');
    setActionForm({ preoccupyRecordId: '', operator: '', remark: '' });
    try {
      const res = await fabricInventoryApi.getById(fabric.id);
      setPreoccupyRecords(
        (res.data as any).preoccupyRecords?.filter((r: FabricPreoccupyRecord) =>
          ['preoccupied', 'pending_purchase'].includes(r.status)
        ) || []
      );
    } catch (e) {
      console.error(e);
    }
    setShowModal(true);
  };

  const openDetailModal = async (fabric: FabricInventory) => {
    setSelectedFabric(fabric);
    setModalType('detail');
    try {
      const [preRes, adjRes] = await Promise.all([
        fabricInventoryApi.getByPattern(''),
        fabricInventoryApi.getAdjustRecords(fabric.id),
      ]);
      setPreoccupyRecords(preRes.data.filter(r => r.fabricInventoryId === fabric.id));
      setAdjustRecords(adjRes.data);
    } catch (e) {
      console.error(e);
    }
    setShowModal(true);
  };

  const openPurchaseDetailModal = (purchase: PurchaseSuggestion) => {
    setSelectedPurchase(purchase);
    setModalType('purchase');
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!formData.fabricName || !formData.color || !formData.supplier) {
      alert('请填写布料名称、颜色和供应商');
      return;
    }
    try {
      await fabricInventoryApi.create(formData);
      setShowModal(false);
      fetchData();
      alert('布料库存档案已创建');
    } catch (e: any) {
      const msg = e?.response?.data?.message || '创建失败，请稍后重试';
      alert(msg);
    }
  };

  const handleStockIn = async () => {
    if (!selectedFabric || !actionForm.length || !actionForm.operator) {
      alert('请填写入库数量和操作人');
      return;
    }
    try {
      await fabricInventoryApi.stockIn(selectedFabric.id, {
        length: actionForm.length,
        operator: actionForm.operator,
        remark: actionForm.remark,
      });
      setShowModal(false);
      fetchData();
      alert('入库成功');
    } catch (e: any) {
      const msg = e?.response?.data?.message || '入库失败，请稍后重试';
      alert(msg);
    }
  };

  const handleAdjust = async () => {
    if (!selectedFabric || !actionForm.operator) {
      alert('请填写操作人');
      return;
    }
    try {
      await fabricInventoryApi.manualAdjust(selectedFabric.id, {
        adjustLength: actionForm.length,
        operator: actionForm.operator,
        remark: actionForm.remark,
      });
      setShowModal(false);
      fetchData();
      alert('调整成功');
    } catch (e: any) {
      const msg = e?.response?.data?.message || '调整失败，请稍后重试';
      alert(msg);
    }
  };

  const handleRelease = async () => {
    if (!selectedFabric || !actionForm.preoccupyRecordId || !actionForm.operator) {
      alert('请选择要释放的预占记录和操作人');
      return;
    }
    try {
      await fabricInventoryApi.releasePreoccupy(selectedFabric.id, {
        preoccupyRecordId: actionForm.preoccupyRecordId,
        operator: actionForm.operator,
        remark: actionForm.remark,
      });
      setShowModal(false);
      fetchData();
      alert('释放预占成功');
    } catch (e: any) {
      const msg = e?.response?.data?.message || '释放失败，请稍后重试';
      alert(msg);
    }
  };

  const handleSubmit = () => {
    if (modalType === 'create') handleCreate();
    else if (modalType === 'stockIn') handleStockIn();
    else if (modalType === 'adjust') handleAdjust();
    else if (modalType === 'release') handleRelease();
  };

  const pendingPurchaseCount = purchaseSuggestions.filter(p => p.status === 'pending').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>布料库存管理</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openCreateModal}>
            + 新增布料档案
          </button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          库存列表 {fabrics.length > 0 && <span className="tab-count">{fabrics.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'purchase' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchase')}
        >
          采购建议 {pendingPurchaseCount > 0 && <span className="tab-count danger">{pendingPurchaseCount}</span>}
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div>
          <div className="filter-bar">
            <input
              type="text"
              placeholder="搜索布料名称、颜色、供应商..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="search-input"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filterLowStock}
                onChange={e => setFilterLowStock(e.target.checked)}
              />
              仅显示库存不足
            </label>
          </div>

          {loading ? (
            <div className="loading">加载中...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>布料名称</th>
                    <th>颜色</th>
                    <th>幅宽</th>
                    <th>当前库存</th>
                    <th>已预占</th>
                    <th>可用库存</th>
                    <th>安全库存</th>
                    <th>单价</th>
                    <th>供应商</th>
                    <th>采购周期</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFabrics.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="empty-cell">
                        暂无布料库存数据
                      </td>
                    </tr>
                  ) : (
                    filteredFabrics.map(fabric => (
                      <tr key={fabric.id} className={fabric.isLowStock ? 'warning-row' : ''}>
                        <td className="font-medium">{fabric.fabricName}</td>
                        <td>
                          <span className="color-dot" style={{ backgroundColor: fabric.color }}></span>
                          {fabric.color}
                        </td>
                        <td>{fabric.width}米</td>
                        <td>{fabric.stockLength}{fabric.unit === 'meter' ? '米' : '码'}</td>
                        <td className="text-warning">{(fabric.preoccupiedLength || 0).toFixed(2)}{fabric.unit === 'meter' ? '米' : '码'}</td>
                        <td className={(fabric.availableStock || 0) < fabric.safetyStock ? 'text-danger font-medium' : 'text-success font-medium'}>
                          {(fabric.availableStock || 0).toFixed(2)}{fabric.unit === 'meter' ? '米' : '码'}
                        </td>
                        <td>{fabric.safetyStock}{fabric.unit === 'meter' ? '米' : '码'}</td>
                        <td>¥{(fabric.unitPrice || 0).toFixed(2)}/{fabric.unit === 'meter' ? '米' : '码'}</td>
                        <td>{fabric.supplier}</td>
                        <td>{fabric.purchaseCycle}天</td>
                        <td>
                          {fabric.isLowStock && (
                            <span className="badge badge-danger">库存不足</span>
                          )}
                          {!fabric.isLowStock && (
                            <span className="badge badge-success">正常</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-link" onClick={() => openDetailModal(fabric)}>详情</button>
                            <button className="btn-link" onClick={() => openStockInModal(fabric)}>入库</button>
                            <button className="btn-link" onClick={() => openAdjustModal(fabric)}>调整</button>
                            <button className="btn-link text-warning" onClick={() => openReleaseModal(fabric)}>释放预占</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'purchase' && (
        <div>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>布料名称</th>
                    <th>颜色</th>
                    <th>当前库存</th>
                    <th>已预占</th>
                    <th>安全库存</th>
                    <th>缺口数量</th>
                    <th>建议采购</th>
                    <th>预计成本</th>
                    <th>最晚下单</th>
                    <th>受影响订单</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseSuggestions.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="empty-cell">
                        暂无采购建议
                      </td>
                    </tr>
                  ) : (
                    purchaseSuggestions.map(suggestion => (
                      <tr key={suggestion.id}>
                        <td className="font-medium">{suggestion.fabricName}</td>
                        <td>
                          <span className="color-dot" style={{ backgroundColor: suggestion.color }}></span>
                          {suggestion.color}
                        </td>
                        <td>{suggestion.currentStock}{suggestion.unit === 'meter' ? '米' : '码'}</td>
                        <td>{suggestion.preoccupiedLength}{suggestion.unit === 'meter' ? '米' : '码'}</td>
                        <td>{suggestion.safetyStock}{suggestion.unit === 'meter' ? '米' : '码'}</td>
                        <td className="text-danger font-medium">{(suggestion.gapLength || 0).toFixed(2)}{suggestion.unit === 'meter' ? '米' : '码'}</td>
                        <td className="font-medium">{(suggestion.suggestedPurchaseLength || 0).toFixed(2)}{suggestion.unit === 'meter' ? '米' : '码'}</td>
                        <td className="text-warning font-medium">¥{(suggestion.estimatedCost || 0).toFixed(2)}</td>
                        <td className={new Date(suggestion.latestOrderDate) < new Date() ? 'text-danger' : ''}>
                          {suggestion.latestOrderDate.split('T')[0]}
                        </td>
                        <td>
                          <span className="badge badge-warning">{suggestion.affectedOrders.length} 单</span>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: PURCHASE_SUGGESTION_STATUS_COLORS[suggestion.status],
                              color: '#fff',
                            }}
                          >
                            {PURCHASE_SUGGESTION_STATUS_LABELS[suggestion.status]}
                          </span>
                        </td>
                        <td>
                          <button className="btn-link" onClick={() => openPurchaseDetailModal(suggestion)}>
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalType === 'create' && '新增布料档案'}
                {modalType === 'stockIn' && `入库 - ${selectedFabric?.fabricName} (${selectedFabric?.color})`}
                {modalType === 'adjust' && `手动调整 - ${selectedFabric?.fabricName} (${selectedFabric?.color})`}
                {modalType === 'release' && `释放预占 - ${selectedFabric?.fabricName} (${selectedFabric?.color})`}
                {modalType === 'detail' && `库存详情 - ${selectedFabric?.fabricName} (${selectedFabric?.color})`}
                {modalType === 'purchase' && `采购建议详情 - ${selectedPurchase?.fabricName} (${selectedPurchase?.color})`}
              </h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {modalType === 'create' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>布料名称 *</label>
                    <input
                      type="text"
                      value={formData.fabricName}
                      onChange={e => setFormData({ ...formData, fabricName: e.target.value })}
                      placeholder="如：纯棉、丝绸"
                    />
                  </div>
                  <div className="form-group">
                    <label>颜色 *</label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      placeholder="如：米白色、藏蓝色"
                    />
                  </div>
                  <div className="form-group">
                    <label>幅宽</label>
                    <div className="input-group">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.width}
                        onChange={e => setFormData({ ...formData, width: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="input-suffix">{formData.widthUnit}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>初始库存</label>
                    <div className="input-group">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.stockLength}
                        onChange={e => setFormData({ ...formData, stockLength: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="input-suffix">{formData.unit}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>安全库存</label>
                    <div className="input-group">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.safetyStock}
                        onChange={e => setFormData({ ...formData, safetyStock: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="input-suffix">{formData.unit}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>单价</label>
                    <div className="input-group">
                      <span className="input-prefix">¥</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.unitPrice}
                        onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="input-suffix">/{formData.unit}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>供应商 *</label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                      placeholder="供应商名称"
                    />
                  </div>
                  <div className="form-group">
                    <label>采购周期</label>
                    <div className="input-group">
                      <input
                        type="number"
                        value={formData.purchaseCycle}
                        onChange={e => setFormData({ ...formData, purchaseCycle: parseInt(e.target.value) || 0 })}
                      />
                      <span className="input-suffix">{formData.purchaseCycleUnit}</span>
                    </div>
                  </div>
                  <div className="form-group form-group-full">
                    <label>备注</label>
                    <textarea
                      value={formData.remark}
                      onChange={e => setFormData({ ...formData, remark: e.target.value })}
                      placeholder="可选"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {modalType === 'stockIn' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>当前库存</label>
                    <div className="readonly-value">
                      {selectedFabric?.stockLength} {selectedFabric?.unit}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>可用库存</label>
                    <div className="readonly-value text-success">
                      {selectedFabric?.availableStock?.toFixed(2)} {selectedFabric?.unit}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>入库数量 *</label>
                    <div className="input-group">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={actionForm.length}
                        onChange={e => setActionForm({ ...actionForm, length: parseFloat(e.target.value) || 0 })}
                        placeholder="请输入入库数量"
                      />
                      <span className="input-suffix">{selectedFabric?.unit}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>操作人 *</label>
                    <input
                      type="text"
                      value={actionForm.operator}
                      onChange={e => setActionForm({ ...actionForm, operator: e.target.value })}
                      placeholder="请输入操作人姓名"
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label>备注</label>
                    <textarea
                      value={actionForm.remark}
                      onChange={e => setActionForm({ ...actionForm, remark: e.target.value })}
                      placeholder="可选，填写入库原因等"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {modalType === 'adjust' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>当前库存</label>
                    <div className="readonly-value">
                      {selectedFabric?.stockLength} {selectedFabric?.unit}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>调整数量 *</label>
                    <div className="input-group">
                      <span className="input-prefix">+/-</span>
                      <input
                        type="number"
                        step="0.01"
                        value={actionForm.length}
                        onChange={e => setActionForm({ ...actionForm, length: parseFloat(e.target.value) || 0 })}
                        placeholder="正数增加，负数减少"
                      />
                      <span className="input-suffix">{selectedFabric?.unit}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>操作人 *</label>
                    <input
                      type="text"
                      value={actionForm.operator}
                      onChange={e => setActionForm({ ...actionForm, operator: e.target.value })}
                      placeholder="请输入操作人姓名"
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label>调整原因 *</label>
                    <textarea
                      value={actionForm.remark}
                      onChange={e => setActionForm({ ...actionForm, remark: e.target.value })}
                      placeholder="请说明调整原因"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {modalType === 'release' && (
                <div className="form-grid">
                  <div className="form-group form-group-full">
                    <label>选择要释放的预占记录 *</label>
                    {preoccupyRecords.length === 0 ? (
                      <div className="empty-tip">暂无可用的预占记录</div>
                    ) : (
                      <div className="select-list">
                        {preoccupyRecords.map(record => (
                          <label key={record.id} className="select-item">
                            <input
                              type="radio"
                              name="preoccupy"
                              value={record.id}
                              checked={actionForm.preoccupyRecordId === record.id}
                              onChange={e => setActionForm({ ...actionForm, preoccupyRecordId: e.target.value })}
                            />
                            <div className="select-item-content">
                              <div className="select-item-title">
                                {record.orderNumber && <span className="order-no">订单 {record.orderNumber}</span>}
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: FABRIC_PREOCCUPY_STATUS_COLORS[record.status],
                                    color: '#fff',
                                  }}
                                >
                                  {FABRIC_PREOCCUPY_STATUS_LABELS[record.status]}
                                </span>
                              </div>
                              <div className="select-item-desc">
                                预占数量：{record.preoccupyLength} {record.unit}
                                {record.remark && <span className="text-muted"> · {record.remark}</span>}
                              </div>
                              <div className="select-item-time">
                                {new Date(record.createdAt).toLocaleString('zh-CN')}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>操作人 *</label>
                    <input
                      type="text"
                      value={actionForm.operator}
                      onChange={e => setActionForm({ ...actionForm, operator: e.target.value })}
                      placeholder="请输入操作人姓名"
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label>释放原因</label>
                    <textarea
                      value={actionForm.remark}
                      onChange={e => setActionForm({ ...actionForm, remark: e.target.value })}
                      placeholder="可选，说明释放原因"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {modalType === 'detail' && selectedFabric && (
                <div>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>布料名称</label>
                      <span>{selectedFabric.fabricName}</span>
                    </div>
                    <div className="info-item">
                      <label>颜色</label>
                      <span>
                        <span className="color-dot" style={{ backgroundColor: selectedFabric.color }}></span>
                        {selectedFabric.color}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>幅宽</label>
                      <span>{selectedFabric.width}米</span>
                    </div>
                    <div className="info-item">
                      <label>当前库存</label>
                      <span>{selectedFabric.stockLength}{selectedFabric.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>已预占</label>
                      <span className="text-warning">{(selectedFabric.preoccupiedLength || 0).toFixed(2)}{selectedFabric.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>可用库存</label>
                      <span className={(selectedFabric.availableStock || 0) < selectedFabric.safetyStock ? 'text-danger' : 'text-success'}>
                        {(selectedFabric.availableStock || 0).toFixed(2)}{selectedFabric.unit === 'meter' ? '米' : '码'}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>安全库存</label>
                      <span>{selectedFabric.safetyStock}{selectedFabric.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>单价</label>
                      <span>¥{(selectedFabric.unitPrice || 0).toFixed(2)}/{selectedFabric.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>供应商</label>
                      <span>{selectedFabric.supplier}</span>
                    </div>
                    <div className="info-item">
                      <label>采购周期</label>
                      <span>{selectedFabric.purchaseCycle}天</span>
                    </div>
                  </div>

                  <h4 className="section-title">预占记录</h4>
                  {preoccupyRecords.length === 0 ? (
                    <div className="empty-tip">暂无预占记录</div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table small">
                        <thead>
                          <tr>
                            <th>关联订单</th>
                            <th>预占数量</th>
                            <th>状态</th>
                            <th>备注</th>
                            <th>时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preoccupyRecords.map(record => (
                            <tr key={record.id}>
                              <td>{record.orderNumber || '-'}</td>
                              <td>{record.preoccupyLength} {record.unit}</td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: FABRIC_PREOCCUPY_STATUS_COLORS[record.status],
                                    color: '#fff',
                                  }}
                                >
                                  {FABRIC_PREOCCUPY_STATUS_LABELS[record.status]}
                                </span>
                              </td>
                              <td>{record.remark || '-'}</td>
                              <td>{new Date(record.createdAt).toLocaleString('zh-CN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <h4 className="section-title">调整记录</h4>
                  {adjustRecords.length === 0 ? (
                    <div className="empty-tip">暂无调整记录</div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table small">
                        <thead>
                          <tr>
                            <th>类型</th>
                            <th>调整数量</th>
                            <th>调整前</th>
                            <th>调整后</th>
                            <th>操作人</th>
                            <th>备注</th>
                            <th>时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adjustRecords.map(record => (
                            <tr key={record.id}>
                              <td>
                                <span className="badge badge-info">
                                  {FABRIC_ADJUST_TYPE_LABELS[record.adjustType]}
                                </span>
                              </td>
                              <td className={record.adjustLength >= 0 ? 'text-success' : 'text-danger'}>
                                {record.adjustLength >= 0 ? '+' : ''}{record.adjustLength}
                              </td>
                              <td>{record.beforeStock}</td>
                              <td>{record.afterStock}</td>
                              <td>{record.operator}</td>
                              <td>{record.remark || '-'}</td>
                              <td>{new Date(record.createdAt).toLocaleString('zh-CN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {modalType === 'purchase' && selectedPurchase && (
                <div>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>布料名称</label>
                      <span>{selectedPurchase.fabricName}</span>
                    </div>
                    <div className="info-item">
                      <label>颜色</label>
                      <span>
                        <span className="color-dot" style={{ backgroundColor: selectedPurchase.color }}></span>
                        {selectedPurchase.color}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>当前库存</label>
                      <span>{selectedPurchase.currentStock}{selectedPurchase.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>已预占</label>
                      <span className="text-warning">{selectedPurchase.preoccupiedLength}{selectedPurchase.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>安全库存</label>
                      <span>{selectedPurchase.safetyStock}{selectedPurchase.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>缺口数量</label>
                      <span className="text-danger font-medium">{(selectedPurchase.gapLength || 0).toFixed(2)}{selectedPurchase.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>建议采购量</label>
                      <span className="font-medium">{(selectedPurchase.suggestedPurchaseLength || 0).toFixed(2)}{selectedPurchase.unit === 'meter' ? '米' : '码'}</span>
                    </div>
                    <div className="info-item">
                      <label>预计成本</label>
                      <span className="text-warning font-medium">¥{(selectedPurchase.estimatedCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="info-item">
                      <label>最晚下单日期</label>
                      <span className={new Date(selectedPurchase.latestOrderDate) < new Date() ? 'text-danger' : ''}>
                        {selectedPurchase.latestOrderDate.split('T')[0]}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>供应商</label>
                      <span>{selectedPurchase.supplier}</span>
                    </div>
                    <div className="info-item">
                      <label>采购周期</label>
                      <span>{selectedPurchase.purchaseCycle} 天</span>
                    </div>
                    <div className="info-item">
                      <label>状态</label>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: PURCHASE_SUGGESTION_STATUS_COLORS[selectedPurchase.status],
                          color: '#fff',
                        }}
                      >
                        {PURCHASE_SUGGESTION_STATUS_LABELS[selectedPurchase.status]}
                      </span>
                    </div>
                  </div>

                  <h4 className="section-title">受影响订单 ({selectedPurchase.affectedOrders.length} 单)</h4>
                  {selectedPurchase.affectedOrders.length === 0 ? (
                    <div className="empty-tip">暂无受影响订单</div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table small">
                        <thead>
                          <tr>
                            <th>订单号</th>
                            <th>客户</th>
                            <th>交货日期</th>
                            <th>需求数量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPurchase.affectedOrders.map((order, idx) => (
                            <tr key={idx}>
                              <td className="font-medium">{order.orderNumber}</td>
                              <td>{order.customerName}</td>
                              <td className={new Date(order.deliveryDate) < new Date() ? 'text-danger' : ''}>
                                {order.deliveryDate.split('T')[0]}
                              </td>
                              <td>{order.requiredLength} {selectedPurchase.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            {modalType !== 'detail' && modalType !== 'purchase' && (
              <div className="modal-footer">
                <button className="btn btn-default" onClick={() => setShowModal(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleSubmit}>
                  {modalType === 'create' && '创建'}
                  {modalType === 'stockIn' && '确认入库'}
                  {modalType === 'adjust' && '确认调整'}
                  {modalType === 'release' && '确认释放'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
