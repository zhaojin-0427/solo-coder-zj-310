import { DollTemplate, Order, PatternTask, FittingRecord } from './types';
import { mockDollTemplates, mockOrders, mockPatternTasks, mockFittingRecords } from './data';

class DataStore {
  private static instance: DataStore;
  public dolls: DollTemplate[];
  public orders: Order[];
  public patternTasks: PatternTask[];
  public fittingRecords: FittingRecord[];

  private constructor() {
    this.dolls = [...mockDollTemplates];
    this.orders = [...mockOrders];
    this.patternTasks = [...mockPatternTasks];
    this.fittingRecords = [...mockFittingRecords];
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public getDollById(id: string): DollTemplate | undefined {
    return this.dolls.find(d => d.id === id);
  }

  public getDollName(id: string): string {
    const d = this.dolls.find(x => x.id === id);
    return d ? `${d.brand} ${d.model}` : id;
  }

  public getOrderById(id: string): Order | undefined {
    return this.orders.find(o => o.id === id);
  }

  public getOrderInfo(orderId: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;
    const doll = this.dolls.find(d => d.id === order.dollTemplateId);
    return {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      dollName: doll ? `${doll.brand} ${doll.model}` : order.dollTemplateId,
      styleTags: order.styleTags,
      deliveryDate: order.deliveryDate,
    };
  }
}

export const store = DataStore.getInstance();
