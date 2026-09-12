import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ShieldAlert, RefreshCw, Inbox } from 'lucide-react';

export function AuthError({ error, onRetry }) {
  const is401 = error?.status === 401;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 ${is401 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
        {is401 ? <ShieldAlert className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
      </div>
      <p className="font-medium">{is401 ? 'Session expired' : 'Access denied'}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {error?.message || (is401 ? 'Please sign in again to continue.' : 'You do not have permission to access this resource.')}
      </p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="font-medium">Failed to load</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error?.message || 'An unexpected error occurred.'}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>}
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-3">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{message || 'Nothing here yet.'}</p>
    </div>
  );
}

export function BrandChip({ brand }) {
  if (!brand) return null;
  return <Badge className="bg-primary text-primary-foreground border-0">{brand.display_name}</Badge>;
}

export function ContextChips({ brand, campaign, extra = [] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {brand && <BrandChip brand={brand} />}
      {campaign && <Badge variant="outline">{campaign.name}</Badge>}
      {extra.map((e, i) => <Badge key={i} variant="outline">{e}</Badge>)}
    </div>
  );
}

export function TenantBadge({ tenant }) {
  if (!tenant) return null;
  const brandLabel = tenant.brand_ids === 'all' ? 'All brands' : `${(tenant.brand_ids || []).length} brand(s)`;
  return (
    <div className="text-xs text-muted-foreground">
      Tenant: {brandLabel} · role: {tenant.role}
    </div>
  );
}