import { Badge } from './Feedback';
import { stockStatus, STOCK_STATUS_LABELS } from '../../lib/format';

export { Button } from './Button';
export { Field, Input, Textarea, Select } from './Field';
export { Modal } from './Modal';
export { ConfirmDialog, useConfirm } from './ConfirmDialog';
export { Badge, Spinner, PageLoader, Card, EmptyState, PageHeader } from './Feedback';
export { Pagination, StatCard } from './Pagination';

/** Badge coloré reflétant l'état de stock d'un article. */
export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const status = stockStatus(stock, minStock);
  const color = status === 'out' ? 'red' : status === 'low' ? 'amber' : 'green';
  return <Badge color={color}>{STOCK_STATUS_LABELS[status]}</Badge>;
}
