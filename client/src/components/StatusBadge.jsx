const LABELS = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }) {
  return <span className={`status status-${status}`}>{LABELS[status] ?? status}</span>;
}