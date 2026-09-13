import React from 'react';

export default function BrandMark({ compact = false, inverse = true, className = '' }) {
  return (
    <div className={`select-none ${className}`} aria-label="Link Marketing Services CRM">
      <div className="flex items-end gap-2">
        <span className={`font-heading font-semibold leading-none tracking-[.08em] ${compact ? 'text-2xl' : 'text-[2rem]'} ${inverse ? 'text-[#f5efe2]' : 'text-[#071b1e]'}`}>
          LIN<span className="text-[#d4af37]">K</span>
        </span>
        {!compact && <span className={`pb-0.5 text-[9px] font-bold uppercase tracking-[.22em] ${inverse ? 'text-white/45' : 'text-[#607072]'}`}>CRM</span>}
      </div>
      {!compact && <div className="mt-1 h-px w-[132px] bg-gradient-to-r from-[#d4af37] via-[#00838f] to-transparent" />}
      {!compact && <p className={`mt-1 text-[7px] font-bold uppercase tracking-[.28em] ${inverse ? 'text-white/52' : 'text-[#607072]'}`}>Marketing Services</p>}
    </div>
  );
}
