import { useState, useEffect } from 'react';
import { DollTemplate } from '../types';
import { dollApi } from '../api';

const DEFAULT_DOLL: Omit<DollTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  brand: '',
  model: '',
  height: 0,
  bust: 0,
  waist: 0,
  hip: 0,
  shoulder: 0,
  neck: 0,
  armLength: 0,
  legLength: 0,
  footLength: 0,
  headCircumference: 0,
  description: '',
};

export default function DollsPage() {
  const [dolls, setDolls] = useState<DollTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDoll, setEditingDoll] = useState<DollTemplate | null>(null);
  const [formData, setFormData] = useState(DEFAULT_DOLL);

  const fetchDolls = async () => {
    setLoading(true);
    try {
      const res = await dollApi.getAll({ brand: filterBrand || undefined });
      setDolls(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDolls();
  }, [filterBrand]);

  const openCreate = () => {
    setEditingDoll(null);
    setFormData(DEFAULT_DOLL);
    setShowModal(true);
  };

  const openEdit = (doll: DollTemplate) => {
    setEditingDoll(doll);
    setFormData({
      brand: doll.brand,
      model: doll.model,
      height: doll.height,
      bust: doll.bust,
      waist: doll.waist,
      hip: doll.hip,
      shoulder: doll.shoulder,
      neck: doll.neck,
      armLength: doll.armLength,
      legLength: doll.legLength,
      footLength: doll.footLength,
      headCircumference: doll.headCircumference,
      description: doll.description || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingDoll) {
        await dollApi.update(editingDoll.id, formData);
      } else {
        await dollApi.create(formData);
      }
      setShowModal(false);
      fetchDolls();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个娃体模板吗？')) return;
    try {
      await dollApi.remove(id);
      fetchDolls();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '删除失败';
      alert(msg);
      console.error(e);
    }
  };

  const specs = [
    { key: 'height', label: '身高', unit: 'cm' },
    { key: 'bust', label: '胸围', unit: 'cm' },
    { key: 'waist', label: '腰围', unit: 'cm' },
    { key: 'hip', label: '臀围', unit: 'cm' },
    { key: 'shoulder', label: '肩宽', unit: 'cm' },
    { key: 'neck', label: '颈围', unit: 'cm' },
    { key: 'armLength', label: '臂长', unit: 'cm' },
    { key: 'legLength', label: '腿长', unit: 'cm' },
    { key: 'footLength', label: '脚长', unit: 'cm' },
    { key: 'headCircumference', label: '头围', unit: 'cm' },
  ];

  const brands = Array.from(new Set(dolls.map(d => d.brand)));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📐 娃体尺寸库</h2>
          <p className="page-subtitle">维护各娃社不同型号的版型参数模板，打版时直接引用</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <span>＋</span> 新增娃体模板
        </button>
      </div>

      <div className="filters">
        <div className="filter-item">
          <label className="form-label">娃社筛选</label>
          <select
            className="form-select"
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
          >
            <option value="">全部娃社</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="filter-item flex items-center" style={{ alignSelf: 'flex-end' }}>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            共 <strong style={{ color: 'var(--text)' }}>{dolls.length}</strong> 个娃体模板
          </span>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="icon">⏳</div>加载中...</div>
      ) : dolls.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📐</div>
          <div className="empty-state-title">暂无娃体模板</div>
          <div className="empty-state-desc">点击右上角按钮新增第一个娃体模板</div>
        </div>
      ) : (
        <div className="doll-grid">
          {dolls.map(doll => (
            <div key={doll.id} className="doll-card">
              <div className="doll-card-header">
                <div className="doll-brand">{doll.brand}</div>
                <div className="doll-model">{doll.model}</div>
                {doll.description && (
                  <div className="doll-desc">{doll.description}</div>
                )}
              </div>
              <div className="doll-specs">
                {specs.map(s => (
                  <div key={s.key} className="spec-row">
                    <span className="spec-label">{s.label}</span>
                    <span className="spec-value">
                      {(doll as any)[s.key]} {s.unit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="doll-card-footer">
                <button className="btn btn-sm btn-outline flex-1" onClick={() => openEdit(doll)}>
                  ✏️ 编辑
                </button>
                <button className="btn btn-sm btn-danger flex-1" onClick={() => handleDelete(doll.id)}>
                  🗑 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingDoll ? '编辑娃体模板' : '新增娃体模板'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required">娃社品牌</label>
                  <input
                    className="form-input"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="例：Volks、龙魂、DollZone"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">型号名称</label>
                  <input
                    className="form-input"
                    value={formData.model}
                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                    placeholder="例：SD17男、73叔体"
                  />
                </div>
              </div>
              <div className="form-row">
                {specs.map(s => (
                  <div className="form-group" key={s.key}>
                    <label className="form-label">{s.label}（{s.unit}）</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={(formData as any)[s.key]}
                      onChange={e =>
                        setFormData({ ...formData, [s.key]: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">备注说明</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="特殊体型说明、适配建议等"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingDoll ? '保存修改' : '创建模板'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
