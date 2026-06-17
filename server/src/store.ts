import { DollTemplate, Order, PatternTask, FittingRecord, CommunicationRecord, ChangeOrder } from './types';
import { mockDollTemplates, mockOrders, mockPatternTasks, mockFittingRecords, mockCommunications, mockChangeOrders } from './data';

class DataStore {
  private static instance: DataStore;
  public dolls: DollTemplate[];
  public orders: Order[];
  public patternTasks: PatternTask[];
  public fittingRecords: FittingRecord[];
  public communications: CommunicationRecord[];
  public changeOrders: ChangeOrder[];
  private deletedDolls: Map<string, DollTemplate> = new Map();

  private constructor() {
    this.dolls = [...mockDollTemplates];
    this.orders = [...mockOrders];
    this.patternTasks = [...mockPatternTasks];
    this.fittingRecords = [...mockFittingRecords];
    this.communications = [...mockCommunications];
    this.changeOrders = [...mockChangeOrders];
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
}

export const store = DataStore.getInstance();
