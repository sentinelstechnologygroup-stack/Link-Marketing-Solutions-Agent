import React from 'react';

export default function BrandMark({ compact = false, inverse = true, className = '' }) {
  return (
    <div className={`inline-flex max-w-full items-center ${inverse ? '' : 'rounded-xl bg-[#071b1e] px-3 py-2'} ${className}`}>
      <img
        src="/link-crm-logo.svg"
        alt="Link Marketing Services CRM"
        className={`${compact ? 'h-9 w-[150px]' : 'h-auto w-[218px]'} max-w-full object-contain`}
        width="1400"
        height="466"
        decoding="async"
      />
    </div>
  );
}
