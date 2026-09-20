import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EmptyDataTable({
  columns,
  title = 'Records',
  message = 'No records have been added yet. New records will appear here automatically.',
  rows = 3,
}) {
  const template = columns.map(() => 'minmax(8rem, 1fr)').join(' ');

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto" aria-label={title}>
          <div className="min-w-[44rem]">
            <div
              className="grid border-b border-border bg-muted/40 px-4 py-3"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((column) => (
                <span key={column} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {column}
                </span>
              ))}
            </div>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid min-h-14 items-center border-b border-border/70 px-4 py-3 last:border-b-0"
                style={{ gridTemplateColumns: template }}
              >
                {columns.map((column) => (
                  <span key={column} className="text-sm text-muted-foreground" aria-hidden="true">-</span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="border-t border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyRecordCard({
  title = 'Record',
  fields = [],
  message = 'Awaiting the first record.',
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{field}</p>
              <p className="mt-1 text-sm text-foreground">-</p>
            </div>
          ))}
        </div>
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
