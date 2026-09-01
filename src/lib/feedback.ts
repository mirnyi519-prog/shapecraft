export type FeedbackRow = {
  id: string;
  name: string | null;
  contact: string | null;
  message: string;
  ipAddress: string | null;
  read: boolean;
  createdAt: string;
  productId: string | null;
  productName: string | null;
};

type FeedbackRecord = {
  id: string;
  name: string | null;
  contact: string | null;
  message: string;
  ipAddress: string | null;
  read: boolean;
  createdAt: Date;
  productId: string | null;
  product: { id: string; name: string } | null;
};

export function mapFeedbackMessage(item: FeedbackRecord): FeedbackRow {
  return {
    id: item.id,
    name: item.name,
    contact: item.contact,
    message: item.message,
    ipAddress: item.ipAddress,
    read: item.read,
    createdAt: item.createdAt.toISOString(),
    productId: item.productId,
    productName: item.product?.name ?? null,
  };
}

export function feedbackCardClass(read: boolean): string {
  return read
    ? "border-[var(--border)] bg-white"
    : "border-[var(--brand)] bg-[var(--brand-soft)]/40";
}
