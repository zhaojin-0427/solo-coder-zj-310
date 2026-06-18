import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScheduleTask,
  ScheduleData,
  SCHEDULE_STAGE_LABELS,
  SCHEDULE_STAGE_COLORS,
  DELAY_RISK_COLORS,
  DELAY_RISK_LABELS,
  DesignerWorkload,
  CapacityData,
  ScheduleConflict,
} from '../types';
import { scheduleApi } from '../api';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function SchedulePage() {
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [selectedDesigner, setSelectedDesigner] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [draggingTask, setDraggingTask] = useState<ScheduleTask | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scheduleApi.getSchedule({
        designer: selectedDesigner || undefined,
        viewType,
      });
      setScheduleData(data.data);
    } catch (error) {
      console.error('加载排期失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDesigner, viewType]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const getDateRange = () => {
    const dates: Date[] = [];
    const start = new Date(currentDate);

    if (viewType === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date);
      }
    } else {
      const year = start.getFullYear();
      const month = start.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDay.getDay();
      const totalDays = lastDay.getDate();

      for (let i = -firstDayOfWeek; i < totalDays + (7 - lastDay.getDay() - 1); i++) {
        const date = new Date(year, month, 1 + i);
        dates.push(date);
      }
    }
    return dates;
  };

  const dateRange = getDateRange();

  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getTaskPosition = (task: ScheduleTask) => {
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    const viewStart = dateRange[0];
    const viewEnd = dateRange[dateRange.length - 1];

    const dayWidth = 100 / dateRange.length;

    let left = 0;
    let width = 0;

    for (let i = 0; i < dateRange.length; i++) {
      const dateStr = dateRange[i].toISOString().split('T')[0];
      if (dateStr >= task.startDate && left === 0) {
        left = i * dayWidth;
      }
      if (dateStr <= task.endDate) {
        width = (i + 1) * dayWidth - left;
      }
    }

    if (taskStart < viewStart) {
      left = 0;
    }
    if (taskEnd > viewEnd) {
      width = 100 - left;
    }

    return { left: `${left}%`, width: `${width}%` };
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isHoliday = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return scheduleData?.capacityNext7Days.find(c => c.date === dateStr)?.isHoliday;
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const handleDragStart = (e: React.MouseEvent, task: ScheduleTask) => {
    if (task.isLocked) return;
    setDraggingTask(task);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset(e.clientX - rect.left);
    e.preventDefault();
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!draggingTask || !ganttContainerRef.current) return;

    const containerRect = ganttContainerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left - dragOffset;
    const dayWidth = containerRect.width / dateRange.length;
    const dayIndex = Math.round(x / dayWidth);

    if (dayIndex >= 0 && dayIndex < dateRange.length) {
      const newStartDate = dateRange[dayIndex];
      const taskDuration = Math.ceil(
        (new Date(draggingTask.endDate).getTime() - new Date(draggingTask.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + taskDuration);

      setDraggingTask(prev => {
        if (!prev) return null;
        return {
          ...prev,
          startDate: newStartDate.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0],
        };
      });
    }
  }, [draggingTask, dragOffset, dateRange]);

  const handleDragEnd = useCallback(async () => {
    if (!draggingTask) return;

    try {
      const result = await scheduleApi.updateTask(draggingTask.id, {
        startDate: draggingTask.startDate,
        endDate: draggingTask.endDate,
      });
      setScheduleData(result.data.scheduleData);
    } catch (error) {
      console.error('更新排期失败:', error);
      loadSchedule();
    } finally {
      setDraggingTask(null);
    }
  }, [draggingTask, loadSchedule]);

  useEffect(() => {
    if (draggingTask) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [draggingTask, handleDragMove, handleDragEnd]);

  const handleToggleLock = async (taskId: string) => {
    try {
      const result = await scheduleApi.toggleTaskLock(taskId);
      setScheduleData(result.data.scheduleData);
    } catch (error) {
      console.error('锁定/解锁失败:', error);
    }
  };

  const handleRecalculate = async () => {
    if (!confirm('确定要重新计算所有排期吗？手动调整的排期将被覆盖。')) return;
    try {
      const data = await scheduleApi.recalculate();
      setScheduleData(data.data);
    } catch (error) {
      console.error('重新计算失败:', error);
    }
  };

  const getTasksByOrder = () => {
    const grouped: Record<string, ScheduleTask[]> = {};
    if (!scheduleData) return grouped;

    scheduleData.tasks.forEach(task => {
      if (!grouped[task.orderId]) {
        grouped[task.orderId] = [];
      }
      grouped[task.orderId].push(task);
    });

    Object.values(grouped).forEach(tasks => {
      tasks.sort((a, b) => {
        const order = ['pattern_making', 'fabric_cutting', 'fitting', 'shipping'];
        return order.indexOf(a.stage) - order.indexOf(b.stage);
      });
    });

    return grouped;
  };

  const tasksByOrder = getTasksByOrder();

  const getDesigners = () => {
    if (!scheduleData) return [];
    const designers = new Set(scheduleData.tasks.map(t => t.designer));
    return Array.from(designers);
  };

  const designers = getDesigners();

  const getSaturationColor = (saturation: number) => {
    if (saturation >= 100) return '#ef4444';
    if (saturation >= 80) return '#f59e0b';
    return '#22c55e';
  };

  const formatMonthHeader = () => {
    return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
  };

  const formatWeekHeader = () => {
    const start = dateRange[0];
    const end = dateRange[dateRange.length - 1];
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (loading && !scheduleData) {
    return (
      <div className="page-content">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>📅 订单排期甘特图</h2>
          <p>智能排期 · 产能预警 · 冲突检测</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleRecalculate}>
            🔄 重新计算
          </button>
        </div>
      </div>

      <div className="schedule-summary">
        <div className="summary-card">
          <div className="summary-value">{scheduleData?.tasks.length || 0}</div>
          <div className="summary-label">总排期任务</div>
        </div>
        <div className="summary-card urgent">
          <div className="summary-value">{scheduleData?.urgentOrdersCount || 0}</div>
          <div className="summary-label">加急订单</div>
        </div>
        <div className="summary-card risk">
          <div className="summary-value">{scheduleData?.atRiskOrdersCount || 0}</div>
          <div className="summary-label">延期风险订单</div>
        </div>
        <div className="summary-card cycle">
          <div className="summary-value">{scheduleData?.avgCycleDays.toFixed(1) || 0}</div>
          <div className="summary-label">平均周期(天)</div>
        </div>
      </div>

      <div className="schedule-toolbar">
        <div className="toolbar-left">
          <div className="view-toggle">
            <button
              className={'toggle-btn' + (viewType === 'week' ? ' active' : '')}
              onClick={() => setViewType('week')}
            >
              按周查看
            </button>
            <button
              className={'toggle-btn' + (viewType === 'month' ? ' active' : '')}
              onClick={() => setViewType('month')}
            >
              按月查看
            </button>
          </div>
          <div className="date-navigator">
            <button className="nav-btn" onClick={() => navigateDate(-1)}>‹</button>
            <span className="current-date">{viewType === 'week' ? formatWeekHeader() : formatMonthHeader()}</span>
            <button className="nav-btn" onClick={() => navigateDate(1)}>›</button>
            <button className="nav-btn today" onClick={goToToday}>今天</button>
          </div>
        </div>
        <div className="toolbar-right">
          <select
            className="filter-select"
            value={selectedDesigner}
            onChange={(e) => setSelectedDesigner(e.target.value)}
          >
            <option value="">全部设计师</option>
            {designers.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            className="btn btn-warning"
            onClick={() => setShowConflictModal(true)}
          >
            ⚠️ 冲突预警 ({scheduleData?.conflicts.length || 0})
          </button>
        </div>
      </div>

      <div className="capacity-bar">
        <div className="capacity-label">未来7天产能饱和度：</div>
        <div className="capacity-days">
          {scheduleData?.capacityNext7Days.slice(0, 7).map((cap: CapacityData) => (
            <div key={cap.date} className="capacity-day">
              <div className="capacity-date">{formatDate(new Date(cap.date))}</div>
              <div className="capacity-bar-container">
                <div
                  className="capacity-bar-fill"
                  style={{
                    width: `${Math.min(cap.saturation, 100)}%`,
                    backgroundColor: getSaturationColor(cap.saturation),
                  }}
                />
              </div>
              <div className="capacity-value" style={{ color: getSaturationColor(cap.saturation) }}>
                {cap.saturation.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gantt-container" ref={ganttContainerRef}>
        <div className="gantt-header">
          <div className="gantt-header-row1">
            <div className="gantt-order-col">订单 / 设计师</div>
            <div className="gantt-dates">
              {dateRange.map((date, idx) => (
                <div
                  key={idx}
                  className={'gantt-date-cell' + (isToday(date) ? ' today' : '') + (isHoliday(date) ? ' holiday' : '') + (isWeekend(date) ? ' weekend' : '')}
                  style={{ width: `${100 / dateRange.length}%` }}
                >
                  {viewType === 'month' && idx % 7 === 0 && (
                    <div className="week-number">第{Math.floor(idx / 7) + 1}周</div>
                  )}
                  <div className="date-label">{formatDate(date)}</div>
                  <div className="weekday-label">{WEEKDAYS[date.getDay()]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="gantt-body">
          {Object.entries(tasksByOrder).map(([orderId, tasks]) => {
            const firstTask = tasks[0];
            return (
              <div key={orderId} className="gantt-row">
                <div className="gantt-order-col">
                  <div className="order-info">
                    <div className="order-number">{firstTask.orderNumber}</div>
                    <div className="order-customer">{firstTask.customerName}</div>
                    <div className="order-designer">👤 {firstTask.designer}</div>
                  </div>
                </div>
                <div className="gantt-tasks-container">
                  <div className="gantt-timeline">
                    {dateRange.map((date, idx) => (
                      <div
                        key={idx}
                        className={'timeline-cell' + (isToday(date) ? ' today' : '') + (isHoliday(date) ? ' holiday' : '') + (isWeekend(date) ? ' weekend' : '')}
                        style={{ width: `${100 / dateRange.length}%` }}
                      />
                    ))}
                  </div>
                  <div className="gantt-tasks">
                    {tasks.map(task => {
                      const position = getTaskPosition(task);
                      const displayTask = draggingTask?.id === task.id ? draggingTask : task;
                      return (
                        <div
                          key={task.id}
                          className={'gantt-task' + (task.isLocked ? ' locked' : '') + (task.isUrgent ? ' urgent' : '') + (task.conflictIds.length > 0 ? ' conflict' : '') + (draggingTask?.id === task.id ? ' dragging' : '')}
                          style={{
                            left: position.left,
                            width: position.width,
                            backgroundColor: SCHEDULE_STAGE_COLORS[task.stage],
                            borderColor: DELAY_RISK_COLORS[task.delayRisk],
                          }}
                          onMouseDown={(e) => handleDragStart(e, displayTask)}
                          title={`${task.stageLabel} - ${task.customerName}\n${task.startDate} ~ ${task.endDate}\n风险: ${DELAY_RISK_LABELS[task.delayRisk]}\n${task.delayRiskDescription}`}
                        >
                          <div className="task-content">
                            <span className="task-stage">{task.stageLabel}</span>
                            {task.isUrgent && <span className="task-badge urgent">加急</span>}
                            {task.isLocked && (
                              <span className="task-lock" onClick={(e) => { e.stopPropagation(); handleToggleLock(task.id); }}>
                                🔒
                              </span>
                            )}
                            {task.conflictIds.length > 0 && <span className="task-badge conflict">⚠️</span>}
                            <div className="task-progress">
                              <div
                                className="task-progress-fill"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="schedule-legend">
        <div className="legend-group">
          <span className="legend-label">阶段：</span>
          {Object.entries(SCHEDULE_STAGE_LABELS).map(([stage, label]) => (
            <span key={stage} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: SCHEDULE_STAGE_COLORS[stage as keyof typeof SCHEDULE_STAGE_COLORS] }} />
              {label}
            </span>
          ))}
        </div>
        <div className="legend-group">
          <span className="legend-label">风险：</span>
          {Object.entries(DELAY_RISK_LABELS).map(([risk, label]) => (
            <span key={risk} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: DELAY_RISK_COLORS[risk] }} />
              {label}
            </span>
          ))}
        </div>
        <div className="legend-group">
          <span className="legend-label">标记：</span>
          <span className="legend-item">🔒 已锁定</span>
          <span className="legend-item">⚡ 加急</span>
          <span className="legend-item">⚠️ 冲突</span>
        </div>
      </div>

      <div className="workload-section">
        <h3>设计师负载排行</h3>
        <div className="workload-list">
          {scheduleData?.designerWorkloads
            .sort((a: DesignerWorkload, b: DesignerWorkload) => b.saturation - a.saturation)
            .map((workload: DesignerWorkload) => (
              <div key={workload.designer} className="workload-item">
                <div className="workload-info">
                  <span className="workload-name">👤 {workload.designer}</span>
                  <span className="workload-tasks">{workload.totalTasks} 个任务</span>
                </div>
                <div className="workload-bar-container">
                  <div
                    className="workload-bar-fill"
                    style={{
                      width: `${Math.min(workload.saturation, 100)}%`,
                      backgroundColor: getSaturationColor(workload.saturation),
                    }}
                  />
                </div>
                <span className="workload-value" style={{ color: getSaturationColor(workload.saturation) }}>
                  {workload.saturation.toFixed(0)}%
                </span>
              </div>
            ))}
        </div>
      </div>

      {showConflictModal && (
        <div className="modal-overlay" onClick={() => setShowConflictModal(false)}>
          <div className="modal-content conflict-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ 排期冲突与预警</h3>
              <button className="modal-close" onClick={() => setShowConflictModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {scheduleData?.conflicts.length === 0 ? (
                <div className="empty-state">🎉 当前没有排期冲突</div>
              ) : (
                <div className="conflict-list">
                  {scheduleData?.conflicts.map((conflict: ScheduleConflict) => (
                    <div key={conflict.id} className={'conflict-item ' + conflict.severity}>
                      <div className="conflict-header">
                        <span className={'conflict-type severity-' + conflict.severity}>
                          {conflict.typeLabel}
                        </span>
                        <span className="conflict-date">{conflict.date}</span>
                      </div>
                      <div className="conflict-description">{conflict.description}</div>
                      <div className="conflict-tasks">
                        涉及任务：{conflict.taskIds.length} 个
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .schedule-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .summary-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          text-align: center;
        }
        .summary-value {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
        }
        .summary-label {
          font-size: 14px;
          color: #6b7280;
          margin-top: 4px;
        }
        .summary-card.urgent .summary-value { color: #ef4444; }
        .summary-card.risk .summary-value { color: #f59e0b; }
        .summary-card.cycle .summary-value { color: #6366f1; }

        .schedule-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .view-toggle {
          display: flex;
          background: #f3f4f6;
          border-radius: 8px;
          padding: 4px;
        }
        .toggle-btn {
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
          transition: all 0.2s;
        }
        .toggle-btn.active {
          background: white;
          color: #1f2937;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .date-navigator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .nav-btn {
          width: 36px;
          height: 36px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
          color: #6b7280;
        }
        .nav-btn:hover { background: #f9fafb; }
        .nav-btn.today {
          width: auto;
          padding: 0 12px;
          font-size: 14px;
        }
        .current-date {
          font-weight: 600;
          min-width: 180px;
          text-align: center;
        }
        .filter-select {
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
        }

        .capacity-bar {
          background: white;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .capacity-label {
          font-weight: 600;
          color: #374151;
        }
        .capacity-days {
          display: flex;
          gap: 12px;
          flex: 1;
          min-width: 400px;
        }
        .capacity-day {
          flex: 1;
          text-align: center;
        }
        .capacity-date {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .capacity-bar-container {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .capacity-bar-fill {
          height: 100%;
          transition: width 0.3s;
          border-radius: 4px;
        }
        .capacity-value {
          font-size: 12px;
          font-weight: 600;
        }

        .gantt-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }
        .gantt-header {
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .gantt-header-row1 {
          display: flex;
          min-height: 60px;
        }
        .gantt-order-col {
          width: 200px;
          min-width: 200px;
          padding: 12px 16px;
          border-right: 1px solid #e5e7eb;
          font-weight: 600;
          color: #374151;
          background: #f9fafb;
        }
        .gantt-dates {
          flex: 1;
          display: flex;
        }
        .gantt-date-cell {
          padding: 8px 4px;
          text-align: center;
          border-right: 1px solid #e5e7eb;
          position: relative;
        }
        .gantt-date-cell.today {
          background: #dbeafe;
        }
        .gantt-date-cell.holiday, .gantt-date-cell.weekend {
          background: #fef2f2;
        }
        .week-number {
          font-size: 11px;
          color: #9ca3af;
          position: absolute;
          top: 2px;
          left: 4px;
        }
        .date-label {
          font-weight: 600;
          color: #1f2937;
        }
        .weekday-label {
          font-size: 12px;
          color: #6b7280;
        }
        .gantt-body {
          max-height: 500px;
          overflow-y: auto;
        }
        .gantt-row {
          display: flex;
          border-bottom: 1px solid #f3f4f6;
          min-height: 70px;
          position: relative;
        }
        .gantt-row:hover {
          background: #f9fafb;
        }
        .gantt-row .gantt-order-col {
          background: white;
          position: sticky;
          left: 0;
          z-index: 5;
        }
        .order-info {
          font-size: 13px;
        }
        .order-number {
          font-weight: 600;
          color: #1f2937;
        }
        .order-customer {
          color: #6b7280;
          margin: 2px 0;
        }
        .order-designer {
          color: #8b5cf6;
          font-size: 12px;
        }
        .gantt-tasks-container {
          flex: 1;
          position: relative;
        }
        .gantt-timeline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
        }
        .timeline-cell {
          border-right: 1px solid #f3f4f6;
        }
        .timeline-cell.today {
          background: rgba(219, 234, 254, 0.3);
        }
        .timeline-cell.holiday, .timeline-cell.weekend {
          background: rgba(254, 242, 242, 0.3);
        }
        .gantt-tasks {
          position: relative;
          height: 70px;
        }
        .gantt-task {
          position: absolute;
          top: 10px;
          height: 50px;
          border-radius: 6px;
          cursor: grab;
          color: white;
          font-size: 12px;
          overflow: hidden;
          border: 2px solid transparent;
          transition: transform 0.1s, box-shadow 0.2s;
          min-width: 40px;
        }
        .gantt-task:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .gantt-task.locked {
          cursor: not-allowed;
          opacity: 0.8;
        }
        .gantt-task.urgent {
          animation: pulse 2s infinite;
        }
        .gantt-task.conflict {
          box-shadow: 0 0 0 2px #ef4444;
        }
        .gantt-task.dragging {
          opacity: 0.8;
          cursor: grabbing;
          z-index: 100;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .task-content {
          padding: 6px 8px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .task-stage {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .task-badge {
          display: inline-block;
          padding: 1px 6px;
          background: rgba(255,255,255,0.3);
          border-radius: 10px;
          font-size: 11px;
        }
        .task-badge.urgent {
          background: #ef4444;
        }
        .task-badge.conflict {
          background: #f59e0b;
        }
        .task-lock {
          position: absolute;
          right: 4px;
          top: 4px;
          cursor: pointer;
        }
        .task-progress {
          margin-top: auto;
          height: 4px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          overflow: hidden;
        }
        .task-progress-fill {
          height: 100%;
          background: rgba(255,255,255,0.8);
          border-radius: 2px;
        }

        .schedule-legend {
          background: white;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
        .legend-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .legend-label {
          font-weight: 600;
          color: #374151;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #6b7280;
        }
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .workload-section {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .workload-section h3 {
          margin: 0 0 16px 0;
          color: #1f2937;
        }
        .workload-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .workload-item {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .workload-info {
          width: 180px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .workload-name {
          font-weight: 500;
          color: #1f2937;
        }
        .workload-tasks {
          font-size: 12px;
          color: #6b7280;
        }
        .workload-bar-container {
          flex: 1;
          height: 12px;
          background: #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }
        .workload-bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.3s;
        }
        .workload-value {
          width: 60px;
          text-align: right;
          font-weight: 600;
        }

        .conflict-modal {
          width: 500px;
          max-height: 70vh;
        }
        .conflict-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .conflict-item {
          padding: 12px;
          border-radius: 8px;
          border-left: 4px solid;
        }
        .conflict-item.high {
          background: #fef2f2;
          border-left-color: #ef4444;
        }
        .conflict-item.medium {
          background: #fffbeb;
          border-left-color: #f59e0b;
        }
        .conflict-item.low {
          background: #f0fdf4;
          border-left-color: #22c55e;
        }
        .conflict-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .conflict-type {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }
        .conflict-type.severity-high { background: #ef4444; }
        .conflict-type.severity-medium { background: #f59e0b; }
        .conflict-type.severity-low { background: #22c55e; }
        .conflict-date {
          font-size: 12px;
          color: #6b7280;
        }
        .conflict-description {
          color: #374151;
          margin-bottom: 4px;
        }
        .conflict-tasks {
          font-size: 12px;
          color: #6b7280;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .btn-warning {
          background: #f59e0b;
          color: white;
          border: none;
        }
        .btn-warning:hover {
          background: #d97706;
        }
      `}</style>
    </div>
  );
}
