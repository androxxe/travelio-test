declare global {
  namespace Express {
    interface Locals {
      visitorId: string;
      requestId: string;
    }
  }
}

export {};
