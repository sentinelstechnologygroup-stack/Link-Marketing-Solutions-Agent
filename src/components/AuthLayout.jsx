import React from "react";
import { ShieldCheck, LockKeyhole, Users } from "lucide-react";
import BrandMark from "@/components/BrandMark";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen bg-[#071b1e] p-0 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-screen max-w-[1360px] overflow-hidden bg-[#fbfaf7] shadow-2xl sm:min-h-[calc(100vh-2.5rem)] sm:rounded-2xl lg:grid-cols-[.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[#082b2f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,transparent_45%,rgba(212,175,55,.12)_45%,rgba(212,175,55,.12)_46%,transparent_46%)] [background-size:42px_42px]" />
          <div className="relative"><BrandMark /></div>
          <div className="relative max-w-lg">
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#d4af37]">Authorized CRM workspace</p>
            <h2 className="mt-5 font-heading text-5xl leading-[1.02] text-white">Every conversation.<br /><span className="text-[#e3bf58]">One clear system.</span></h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/60">A secure operating workspace for lead response, qualification, appointment setting, live transfers and accountable sales handoff.</p>
          </div>
          <div className="relative grid gap-3 text-xs text-white/62 sm:grid-cols-3">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#d4af37]" /> Role controlled</span>
            <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#d4af37]" /> Protected access</span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#d4af37]" /> Tenant separated</span>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:min-h-0 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden"><BrandMark inverse={false} /></div>
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#00838f]/10 text-[#00747d]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#a0781d]">Link Marketing Services CRM</p>
              <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-[#071b1e]">{title}</h1>
              {subtitle && <p className="mt-3 text-sm leading-6 text-[#647274]">{subtitle}</p>}
            </div>
            <div className="rounded-2xl border border-[#071b1e]/10 bg-white p-6 shadow-[0_22px_60px_-38px_rgba(0,40,45,.52)] sm:p-8">
              {children}
            </div>
            {footer && <div className="mt-6 text-center text-sm text-[#6b7677]">{footer}</div>}
            <p className="mt-7 text-center text-[10px] leading-5 text-[#8a9495]">Authorized personnel only. Access attempts and workspace activity may be logged for security and quality assurance.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

