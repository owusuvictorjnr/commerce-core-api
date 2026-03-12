export const EVENTS = {
  USER_CREATED: "user.created",
  ORDER_CREATED: "order.created",
  PAYMENT_SUCCESS: "payment.success",
} as const;

export interface EventPayloadMap {
  [EVENTS.USER_CREATED]: {
    email: string;
  };
  [EVENTS.ORDER_CREATED]: {
    orderId: number;
    tenantId: string;
  };
  [EVENTS.PAYMENT_SUCCESS]: {
    paymentId: string;
    orderId: number;
    tenantId: string;
  };
}
