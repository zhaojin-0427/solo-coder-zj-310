import { DollTemplate, Order, PatternTask, FittingRecord, CommunicationRecord, ChangeOrder, FabricInventory, FabricPreoccupyRecord, FabricAdjustRecord, PurchaseSuggestion, FabricPreoccupyStatus, ScheduleTask, ScheduleData, ScheduleCardData, ScheduleStage, STAGE_ORDER, STAGE_ESTIMATED_DAYS, HOLIDAYS, DESIGNERS, SCHEDULE_STAGE_LABELS } from './types';
import { mockDollTemplates, mockOrders, mockPatternTasks, mockFittingRecords, mockCommunications, mockChangeOrders, mockFabricInventories, mockFabricPreoccupyRecords, mockFabricAdjustRecords, mockPurchaseSuggestions, mockScheduleTasks } from './data';

class DataStore {
  private static instance: DataStore;
  public dolls: DollTemplate[];
  public orders: Order[];
  public patternTasks: PatternTask[];
  public fittingRecords: FittingRecord[];
  public communications: CommunicationRecord[];
  public changeOrders: ChangeOrder[];
  public fabricInventories: FabricInventory[];
  public fabricPreoccupyRecords: FabricPreoccupyRecord[];
  public fabricAdjustRecords: FabricAdjustRecord[];
  public purchaseSuggestions: PurchaseSuggestion[];
  public scheduleTasks: ScheduleTask[];
  private deletedDolls: Map<string, DollTemplate> = new Map();

  private constructor() {
    this.dolls = [...mockDollTemplates];
    this.orders = [...mockOrders];
    this.patternTasks = [...mockPatternTasks];
    this.fittingRecords = [...mockFittingRecords];
    this.communications = [...mockCommunications];
    this.changeOrders = [...mockChangeOrders];
    this.fabricInventories = [...mockFabricInventories];
    this.fabricPreoccupyRecords = [...mockFabricPreoccupyRecords];
    this.fabricAdjustRecords = [...mockFabricAdjustRecords];
    this.purchaseSuggestions = [...mockPurchaseSuggestions];
    this.scheduleTasks = [...mockScheduleTasks];
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public getDollById(id: string): DollTemplate | undefined {
    return this.dolls.find(d => d.id === id) || this.deletedDolls.get(id);
  }

  public getDollName(id: string): string {
    const d = this.dolls.find(x => x.id === id) || this.deletedDolls.get(id);
    if (d) return `${d.brand} ${d.model}`;
    return '未知娃体';
  }

  public checkDollReferences(id: string): { hasReferences: boolean; references: { type: string; id: string; name: string }[] } {
    const references: { type: string; id: string; name: string }[] = [];
    const relatedOrders = this.orders.filter(o => o.dollTemplateId === id);
    relatedOrders.forEach(o => {
      references.push({ type: '订单', id: o.id, name: o.orderNumber });
    });
    return { hasReferences: references.length > 0, references };
  }

  public removeDoll(id: string): boolean {
    const idx = this.dolls.findIndex(d => d.id === id);
    if (idx === -1) return false;
    const doll = this.dolls[idx];
    this.deletedDolls.set(id, doll);
    this.dolls.splice(idx, 1);
    return true;
  }

  public getOrderById(id: string): Order | undefined {
    return this.orders.find(o => o.id === id);
  }

  public getOrderInfo(orderId: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;
    const doll = this.dolls.find(d => d.id === order.dollTemplateId) || this.deletedDolls.get(order.dollTemplateId);
    return {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      dollName: doll ? `${doll.brand} ${doll.model}` : '未知娃体',
      styleTags: order.styleTags,
      deliveryDate: order.deliveryDate,
      orderStatus: order.status,
    };
  }

  public canCreatePattern(orderId: string): { allowed: boolean; reason?: string } {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return { allowed: false, reason: '订单不存在' };
    const notAllowed: string[] = ['pending', 'cancelled', 'completed', 'shipping'];
    if (notAllowed.includes(order.status)) {
      if (order.status === 'pending') {
        return { allowed: false, reason: '订单尚未确认，请先完成设计师确认' };
      }
      if (order.status === 'cancelled') {
        return { allowed: false, reason: '订单已取消，无法创建打版任务' };
      }
      if (order.status === 'completed' || order.status === 'shipping') {
        return { allowed: false, reason: '订单已进入发货/完成阶段，无需新建打版' };
      }
    }
    return { allowed: true };
  }

  public findFabricInventory(fabricName: string, color: string): FabricInventory | undefined {
    return this.fabricInventories.find(
      f => f.fabricName === fabricName && f.color === color
    );
  }

  public getFabricPreoccupiedLength(fabricInventoryId: string): number {
    return this.fabricPreoccupyRecords
      .filter(r => r.fabricInventoryId === fabricInventoryId && r.status === 'preoccupied')
      .reduce((sum, r) => sum + r.preoccupyLength, 0);
  }

  public getAvailableStock(fabricInventoryId: string): number {
    const fabric = this.fabricInventories.find(f => f.id === fabricInventoryId);
    if (!fabric) return 0;
    const preoccupied = this.getFabricPreoccupiedLength(fabricInventoryId);
    return Number((fabric.stockLength - preoccupied).toFixed(2));
  }

  public getPreoccupyRecordsByPattern(patternTaskId: string): FabricPreoccupyRecord[] {
    return this.fabricPreoccupyRecords.filter(r => r.patternTaskId === patternTaskId);
  }

  public getPreoccupyRecordsByOrder(orderId: string): FabricPreoccupyRecord[] {
    return this.fabricPreoccupyRecords.filter(r => r.orderId === orderId);
  }

  public addFabricAdjustRecord(
    fabricInventoryId: string,
    adjustType: string,
    changeLength: number,
    beforeStock: number,
    afterStock: number,
    operator: string,
    remark?: string,
    relatedOrderId?: string,
    relatedPatternTaskId?: string
  ): FabricAdjustRecord {
    const fabric = this.fabricInventories.find(f => f.id === fabricInventoryId);
    const record: FabricAdjustRecord = {
      id: `adjust-${Date.now().toString(36)}`,
      fabricInventoryId,
      fabricName: fabric?.fabricName || '',
      color: fabric?.color || '',
      adjustType: adjustType as any,
      changeLength,
      beforeStock,
      afterStock,
      unit: fabric?.unit || 'meter',
      operator,
      remark,
      relatedOrderId,
      relatedPatternTaskId,
      createdAt: new Date().toISOString(),
    };
    this.fabricAdjustRecords.unshift(record);
    return record;
  }

  public generatePurchaseSuggestions(): PurchaseSuggestion[] {
    const suggestions: PurchaseSuggestion[] = [];
    
    for (const fabric of this.fabricInventories) {
      const availableStock = this.getAvailableStock(fabric.id);
      const preoccupiedLength = this.getFabricPreoccupiedLength(fabric.id);
      
      if (availableStock < fabric.safetyStock) {
        const gapLength = Number((fabric.safetyStock - availableStock + 2).toFixed(2));
        
        const affectedOrders: { orderId: string; orderNumber: string; deliveryDate: string; customerName: string; requiredLength: number }[] = [];
        const preoccupyRecords = this.fabricPreoccupyRecords.filter(
          r => r.fabricInventoryId === fabric.id && r.status === 'preoccupied'
        );
        for (const record of preoccupyRecords) {
          const order = this.orders.find(o => o.id === record.orderId);
          if (order && order.status !== 'cancelled' && order.status !== 'completed') {
            affectedOrders.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              deliveryDate: order.deliveryDate,
              customerName: order.customerName,
              requiredLength: record.preoccupyLength,
            });
          }
        }
        
        const purchaseDate = new Date();
        purchaseDate.setDate(purchaseDate.getDate() + fabric.purchaseCycle);
        const latestOrderDate = new Date();
        latestOrderDate.setDate(latestOrderDate.getDate() + 1);
        
        const existing = this.purchaseSuggestions.find(
          s => s.fabricInventoryId === fabric.id && s.status === 'pending'
        );
        
        const suggestion: PurchaseSuggestion = existing || {
          id: `purchase-${Date.now().toString(36)}-${fabric.id}`,
          fabricInventoryId: fabric.id,
          fabricName: fabric.fabricName,
          color: fabric.color,
          width: fabric.width,
          currentStock: fabric.stockLength,
          safetyStock: fabric.safetyStock,
          preoccupiedLength,
          gapLength,
          suggestedPurchaseLength: gapLength,
          unit: fabric.unit,
          estimatedCost: Number((gapLength * fabric.unitPrice).toFixed(2)),
          unitPrice: fabric.unitPrice,
          supplier: fabric.supplier,
          purchaseCycle: fabric.purchaseCycle,
          latestOrderDate: latestOrderDate.toISOString().split('T')[0],
          affectedOrders,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        if (!existing) {
          this.purchaseSuggestions.unshift(suggestion);
        } else {
          existing.currentStock = fabric.stockLength;
          existing.preoccupiedLength = preoccupiedLength;
          existing.gapLength = gapLength;
          existing.suggestedPurchaseLength = gapLength;
          existing.estimatedCost = Number((gapLength * fabric.unitPrice).toFixed(2));
          existing.affectedOrders = affectedOrders;
          existing.updatedAt = new Date().toISOString();
        }
        
        suggestions.push(existing || suggestion);
      }
    }
    
    return suggestions.sort((a, b) => b.gapLength - a.gapLength);
  }

  public getFabricInventoryStats(): any {
    const totalFabricTypes = this.fabricInventories.length;
    
    let lowStockCount = 0;
    let totalPreoccupiedLength = 0;
    let inventoryValue = 0;
    
    for (const fabric of this.fabricInventories) {
      const available = this.getAvailableStock(fabric.id);
      if (available < fabric.safetyStock) {
        lowStockCount++;
      }
      totalPreoccupiedLength += this.getFabricPreoccupiedLength(fabric.id);
      inventoryValue += fabric.stockLength * fabric.unitPrice;
    }
    
    const pendingSuggestions = this.purchaseSuggestions.filter(s => s.status === 'pending');
    const totalEstimatedPurchaseCost = pendingSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0);
    
    const delayedOrderIds = new Set<string>();
    for (const suggestion of pendingSuggestions) {
      for (const order of suggestion.affectedOrders) {
        delayedOrderIds.add(order.orderId);
      }
    }
    
    const fabricMap = new Map<string, { fabricName: string; color: string; totalUsed: number; unit: string }>();
    this.patternTasks.forEach(task => {
      task.fabricUsage.forEach(item => {
        const key = `${item.fabricName}-${item.color}`;
        const existing = fabricMap.get(key);
        if (existing) {
          existing.totalUsed += item.length;
          existing.totalUsed = Number(existing.totalUsed.toFixed(2));
        } else {
          fabricMap.set(key, {
            fabricName: item.fabricName,
            color: item.color,
            totalUsed: Number(item.length.toFixed(2)),
            unit: item.unit === 'meter' ? '米' : '码',
          });
        }
      });
    });
    const topConsumedFabrics = Array.from(fabricMap.values())
      .sort((a, b) => b.totalUsed - a.totalUsed)
      .slice(0, 10);
    
    const totalConsumed = topConsumedFabrics.reduce((sum, f) => sum + f.totalUsed, 0);
    const avgStock = this.fabricInventories.reduce((sum, f) => sum + f.stockLength, 0) / Math.max(this.fabricInventories.length, 1);
    const turnoverRate = avgStock > 0 ? Number((totalConsumed / avgStock).toFixed(2)) : 0;
    
    const highConsumptionFabrics = topConsumedFabrics.map((f, idx) => ({
      rank: idx + 1,
      fabricName: f.fabricName,
      color: f.color,
      totalConsumed: f.totalUsed,
      unit: f.unit,
    }));

    return {
      totalFabricTypes,
      lowStockWarningCount: lowStockCount,
      totalPreoccupiedLength: Number(totalPreoccupiedLength.toFixed(2)),
      totalPreoccupiedUnit: '米',
      estimatedPurchaseCost: Number(totalEstimatedPurchaseCost.toFixed(2)),
      delayedOrdersDueToFabric: delayedOrderIds.size,
      highConsumptionFabrics,
      inventoryValue: Number(inventoryValue.toFixed(2)),
      turnoverRate,
    };
  }

  public isHoliday(dateStr: string): boolean {
    return HOLIDAYS.some(h => h.date === dateStr);
  }

  public getHolidayName(dateStr: string): string | undefined {
    return HOLIDAYS.find(h => h.date === dateStr)?.name;
  }

  public isWeekend(dateStr: string): boolean {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6;
  }

  public addWorkingDays(startDate: Date, days: number): Date {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dateStr = result.toISOString().split('T')[0];
      if (!this.isHoliday(dateStr) && !this.isWeekend(dateStr)) {
        added++;
      }
    }
    return result;
  }

  public getOrderCurrentStage(orderId: string): ScheduleStage | null {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    const stageMap: Record<string, ScheduleStage> = {
      'pending': 'pattern_making',
      'confirmed': 'pattern_making',
      'pattern_making': 'pattern_making',
      'fabric_prep': 'fabric_cutting',
      'sewing': 'fitting',
      'fitting': 'fitting',
      'customer_approved': 'shipping',
      'shipping': 'shipping',
    };

    return stageMap[order.status] || null;
  }

  public getOrderProgress(orderId: string): number {
    const order = this.getOrderById(orderId);
    if (!order) return 0;

    const progressMap: Record<string, number> = {
      'pending': 0,
      'confirmed': 10,
      'pattern_making': 30,
      'fabric_prep': 50,
      'sewing': 65,
      'fitting': 80,
      'customer_approved': 90,
      'shipping': 95,
      'completed': 100,
      'cancelled': 0,
    };

    return progressMap[order.status] || 0;
  }

  public calculateScheduleTasks(): ScheduleTask[] {
    const now = new Date();
    const tasks: ScheduleTask[] = [];
    const activeOrders = this.orders.filter(o => !['completed', 'cancelled'].includes(o.status));

    for (const order of activeOrders) {
      const existingTasks = this.scheduleTasks.filter(t => t.orderId === order.id);
      const currentStage = this.getOrderCurrentStage(order.id);
      if (!currentStage) continue;

      const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
      const patternTask = this.patternTasks.find(p => p.orderId === order.id);
      const designer = patternTask?.designer || DESIGNERS[0].name;

      let lastEndDate = new Date();
      if (order.status === 'confirmed') {
        lastEndDate = new Date(order.updatedAt);
      } else if (patternTask) {
        if (patternTask.status === 'in_progress') {
          lastEndDate = new Date(patternTask.updatedAt);
        } else if (patternTask.status === 'completed' || patternTask.status === 'approved') {
          lastEndDate = new Date(patternTask.updatedAt);
        }
      }

      for (let i = currentStageIndex; i < STAGE_ORDER.length; i++) {
        const stage = STAGE_ORDER[i];
        const existingTask = existingTasks.find(t => t.stage === stage);

        let startDate: Date;
        let endDate: Date;

        if (existingTask && existingTask.isLocked) {
          startDate = new Date(existingTask.startDate);
          endDate = new Date(existingTask.endDate);
        } else {
          let estimatedDays = STAGE_ESTIMATED_DAYS[stage];
          if (order.priority === 'urgent') {
            estimatedDays = Math.max(1, Math.floor(estimatedDays * 0.7));
          }

          if (i === currentStageIndex) {
            const stageHistory = order.history.find(h => {
              const historyStage = this.getOrderCurrentStage(order.id);
              return historyStage === stage;
            });
            if (stageHistory) {
              startDate = new Date(stageHistory.timestamp);
            } else {
              startDate = new Date(lastEndDate);
            }
          } else {
            startDate = this.addWorkingDays(lastEndDate, 1);
          }

          endDate = this.addWorkingDays(startDate, estimatedDays - 1);
        }

        const deliveryDate = new Date(order.deliveryDate);
        const daysToDelivery = Math.ceil(
          (deliveryDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        let delayRisk: 'high' | 'medium' | 'low' = 'low';
        let delayRiskDescription = '排期正常';

        if (daysToDelivery < 0) {
          delayRisk = 'high';
          delayRiskDescription = `已逾期 ${Math.abs(daysToDelivery)} 天`;
        } else if (daysToDelivery <= 2) {
          delayRisk = 'high';
          delayRiskDescription = `距离交付仅剩 ${daysToDelivery} 天，存在延期风险`;
        } else if (daysToDelivery <= 5) {
          delayRisk = 'medium';
          delayRiskDescription = `距离交付 ${daysToDelivery} 天，请加快进度`;
        } else if (order.priority === 'urgent' && daysToDelivery <= 7) {
          delayRisk = 'medium';
          delayRiskDescription = `加急单，距离交付 ${daysToDelivery} 天`;
        }

        const progress = this.getOrderProgress(order.id);
        const stageProgress = i < currentStageIndex ? 100 :
          i === currentStageIndex ? Math.max(0, progress - (currentStageIndex * 25)) : 0;

        const task: ScheduleTask = {
          id: existingTask?.id || `schedule-${order.id}-${stage}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          stage,
          stageLabel: SCHEDULE_STAGE_LABELS[stage],
          designer,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          estimatedHours: STAGE_ESTIMATED_DAYS[stage] * 8,
          isLocked: existingTask?.isLocked || false,
          isUrgent: order.priority === 'urgent',
          conflictIds: [],
          delayRisk,
          delayRiskDescription,
          progress: Math.min(100, Math.max(0, stageProgress)),
          createdAt: existingTask?.createdAt || now.toISOString(),
          updatedAt: now.toISOString(),
        };

        tasks.push(task);
        lastEndDate = endDate;
      }
    }

    this.detectConflicts(tasks);
    return tasks;
  }

  public detectConflicts(tasks: ScheduleTask[]): void {
    for (const task of tasks) {
      task.conflictIds = [];

      const sameDesignerTasks = tasks.filter(
        t => t.designer === task.designer && t.id !== task.id
      );

      for (const other of sameDesignerTasks) {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        const otherStart = new Date(other.startDate);
        const otherEnd = new Date(other.endDate);

        if (!(taskEnd < otherStart || taskStart > otherEnd)) {
          if (!task.conflictIds.includes(other.id)) {
            task.conflictIds.push(other.id);
          }
        }
      }

      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);
      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        if (this.isHoliday(dateStr)) {
          task.delayRisk = 'high';
          task.delayRiskDescription = `排期包含节假日：${this.getHolidayName(dateStr)}，可能影响交付`;
          break;
        }
        current.setDate(current.getDate() + 1);
      }
    }
  }

  public getDesignerWorkloads(tasks: ScheduleTask[]) {
    const workloads = DESIGNERS.map(designer => {
      const designerTasks = tasks.filter(t => t.designer === designer.name);
      const totalHours = designerTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      const maxHours = designerTasks.length * 5 * 8;
      const saturation = maxHours > 0 ? Math.min(100, Math.round((totalHours / maxHours) * 100)) : 0;

      return {
        designer: designer.name,
        totalTasks: designerTasks.length,
        totalHours,
        maxHoursPerDay: designer.maxHoursPerDay,
        saturation,
        tasks: designerTasks.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
      };
    });

    return workloads.sort((a, b) => b.saturation - a.saturation);
  }

  public getCapacityNext7Days(tasks: ScheduleTask[]) {
    const capacity: any[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const isHoliday = this.isHoliday(dateStr);
      const isWeekend = this.isWeekend(dateStr);

      const dayTasks = tasks.filter(t => {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        return date >= start && date <= end;
      });

      const totalAvailableHours = isHoliday || isWeekend ? 0 : DESIGNERS.length * 8;
      let totalScheduledHours = 0;

      const designerCapacity = DESIGNERS.map(d => {
        const designerTasks = dayTasks.filter(t => t.designer === d.name);
        const scheduledHours = designerTasks.length * 8;
        const availableHours = isHoliday || isWeekend ? 0 : d.maxHoursPerDay;
        const saturation = availableHours > 0 ? Math.min(100, Math.round((scheduledHours / availableHours) * 100)) : 0;
        totalScheduledHours += scheduledHours;

        return {
          designer: d.name,
          availableHours,
          scheduledHours,
          saturation,
        };
      });

      const totalSaturation = totalAvailableHours > 0
        ? Math.min(100, Math.round((totalScheduledHours / totalAvailableHours) * 100))
        : 0;

      capacity.push({
        date: dateStr,
        dayOfWeek: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()],
        isHoliday,
        holidayName: this.getHolidayName(dateStr),
        isWeekend,
        totalAvailableHours,
        totalScheduledHours,
        saturation: totalSaturation,
        designers: designerCapacity,
      });
    }

    return capacity;
  }

  public getScheduleConflicts(tasks: ScheduleTask[]) {
    const conflicts: any[] = [];

    for (const task of tasks) {
      if (task.conflictIds.length > 0) {
        const conflictTask = tasks.find(t => t.id === task.conflictIds[0]);
        if (conflictTask) {
          conflicts.push({
            id: `conflict-${task.id}-${conflictTask.id}`,
            type: 'overload',
            typeLabel: '设计师负载冲突',
            severity: task.delayRisk === 'high' ? 'high' : 'medium',
            description: `设计师「${task.designer}」在「${task.startDate}」至「${task.endDate}」期间同时处理「${task.orderNumber}」和「${conflictTask.orderNumber}」，存在负载过载风险`,
            taskIds: [task.id, conflictTask.id],
            date: task.startDate,
          });
        }
      }

      if (task.delayRisk === 'high' && !task.conflictIds.length) {
        conflicts.push({
          id: `conflict-delivery-${task.id}`,
          type: 'delivery_risk',
          typeLabel: '交付风险',
          severity: 'high',
          description: `订单「${task.orderNumber}」${task.delayRiskDescription}`,
          taskIds: [task.id],
          date: task.endDate,
        });
      }

      const startDate = new Date(task.startDate);
      const endDate = new Date(task.endDate);
      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        if (this.isHoliday(dateStr)) {
          conflicts.push({
            id: `conflict-holiday-${task.id}-${dateStr}`,
            type: 'holiday',
            typeLabel: '节假日冲突',
            severity: 'medium',
            description: `订单「${task.orderNumber}」的「${task.stageLabel}」阶段包含节假日「${this.getHolidayName(dateStr)}」(${dateStr})`,
            taskIds: [task.id],
            date: dateStr,
          });
          break;
        }
        current.setDate(current.getDate() + 1);
      }
    }

    return conflicts;
  }

  public getScheduleData(): ScheduleData {
    const tasks = this.calculateScheduleTasks();
    const designerWorkloads = this.getDesignerWorkloads(tasks);
    const capacityNext7Days = this.getCapacityNext7Days(tasks);
    const conflicts = this.getScheduleConflicts(tasks);

    const activeOrders = this.orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    const urgentOrdersCount = activeOrders.filter(o => o.priority === 'urgent').length;
    const atRiskOrdersCount = new Set(tasks.filter(t => t.delayRisk === 'high').map(t => t.orderId)).size;

    const completedOrders = this.orders.filter(o => o.status === 'completed');
    let avgCycleDays = 0;
    if (completedOrders.length > 0) {
      const totalDays = completedOrders.reduce((sum, o) => {
        const created = new Date(o.createdAt);
        const completed = new Date(o.updatedAt);
        return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgCycleDays = Math.round(totalDays / completedOrders.length);
    }

    return {
      tasks,
      designerWorkloads,
      capacityNext7Days,
      conflicts,
      avgCycleDays,
      urgentOrdersCount,
      atRiskOrdersCount,
    };
  }

  public getScheduleCard(orderId: string): ScheduleCardData | null {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    const allTasks = this.calculateScheduleTasks();
    const orderTasks = allTasks.filter(t => t.orderId === orderId);

    if (orderTasks.length === 0) return null;

    const lastTask = orderTasks[orderTasks.length - 1];
    const highestRisk = orderTasks.reduce(
      (max, t) => {
        const riskLevel = { 'low': 0, 'medium': 1, 'high': 2 }[t.delayRisk];
        return riskLevel > { 'low': 0, 'medium': 1, 'high': 2 }[max] ? t.delayRisk : max;
      },
      'low' as 'high' | 'medium' | 'low'
    );

    const riskTask = orderTasks.find(t => t.delayRisk === highestRisk);

    const currentStage = this.getOrderCurrentStage(orderId);
    const currentStageLabel = currentStage ? SCHEDULE_STAGE_LABELS[currentStage] : '未知';
    const currentIndex = STAGE_ORDER.indexOf(currentStage || 'pattern_making');
    const nextStage = currentIndex < STAGE_ORDER.length - 1
      ? SCHEDULE_STAGE_LABELS[STAGE_ORDER[currentIndex + 1]]
      : undefined;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      deliveryDate: order.deliveryDate,
      currentStage: currentStageLabel,
      nextStage,
      estimatedCompletionDate: lastTask.endDate,
      delayRisk: highestRisk,
      delayRiskDescription: riskTask?.delayRiskDescription || '排期正常',
      progressPercent: this.getOrderProgress(orderId),
      tasks: orderTasks,
    };
  }

  public updateScheduleTask(taskId: string, updates: Partial<ScheduleTask>): ScheduleTask | null {
    const idx = this.scheduleTasks.findIndex(t => t.id === taskId);
    if (idx === -1) {
      const calculatedTasks = this.calculateScheduleTasks();
      const calculatedTask = calculatedTasks.find(t => t.id === taskId);
      if (calculatedTask) {
        const newTask = { ...calculatedTask, ...updates, updatedAt: new Date().toISOString() };
        this.scheduleTasks.push(newTask);
        return newTask;
      }
      return null;
    }

    this.scheduleTasks[idx] = {
      ...this.scheduleTasks[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return this.scheduleTasks[idx];
  }

  public toggleTaskLock(taskId: string): ScheduleTask | null {
    const task = this.scheduleTasks.find(t => t.id === taskId);
    if (task) {
      return this.updateScheduleTask(taskId, { isLocked: !task.isLocked });
    }

    const calculatedTasks = this.calculateScheduleTasks();
    const calculatedTask = calculatedTasks.find(t => t.id === taskId);
    if (calculatedTask) {
      const newTask = { ...calculatedTask, isLocked: true, updatedAt: new Date().toISOString() };
      this.scheduleTasks.push(newTask);
      return newTask;
    }

    return null;
  }
}

export const store = DataStore.getInstance();
