import { DollTemplate, Order, PatternTask, FittingRecord, CommunicationRecord, ChangeOrder, FabricInventory, FabricPreoccupyRecord, FabricAdjustRecord, PurchaseSuggestion, FabricPreoccupyStatus } from './types';
import { mockDollTemplates, mockOrders, mockPatternTasks, mockFittingRecords, mockCommunications, mockChangeOrders, mockFabricInventories, mockFabricPreoccupyRecords, mockFabricAdjustRecords, mockPurchaseSuggestions } from './data';

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
}

export const store = DataStore.getInstance();
