import {
  createSerialAsyncQueue,
  type SerialAsyncQueue,
} from "@/lib/inventory/serial-async-queue";

/** Serialisiert Display-Bestell-PATCHes — verhindert Last-write-wins beim Server-Replace. */
export type DisplayInventoryOrderSaveQueue = SerialAsyncQueue;

export const createDisplayInventoryOrderSaveQueue = createSerialAsyncQueue;
