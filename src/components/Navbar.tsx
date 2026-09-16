'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Key } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/list', label: 'List a Key' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E7EB] bg-white/90 backdrop-blur-xl transition-all font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left: Brand Robinhood Leaf/Key Icon and "RENT an API" */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full bg-[#CDFF00]/10 border border-[#CDFF00]/30 flex items-center justify-center text-[#CDFF00] group-hover:border-[#CDFF00] group-hover:bg-[#CDFF00]/20 transition-all shadow-[0_0_15px_-3px_rgba(205, 255, 0,0.25)]">
              <Key className="w-5 h-5 text-[#CDFF00]" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[#0D1117] group-hover:text-[#CDFF00] transition-colors">
              RENT an API
            </span>
          </Link>

          {/* Nav Links - Robinhood Capsule Pills */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-full text-xs font-semibold tracking-tight transition-all ${
                    isActive
                      ? 'bg-[#CDFF00]/15 text-[#000000] border border-[#CDFF00]/30'
                      : 'text-[#64748B] hover:text-[#0D1117] hover:bg-[#F3F4F6]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Wallet ConnectButton & Circular Logo */}
        <div className="flex items-center gap-3">
          <div className="rk-connect-container [&_button]:!rounded-full">
            <ConnectButton
              chainStatus="none"
              showBalance={false}
              accountStatus="address"
            />
          </div>

          {/* Circular Brand Logo */}
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#CDFF00]/50 shadow-[0_0_15px_-2px_rgba(205,255,0,0.35)] flex-shrink-0 flex items-center justify-center bg-[#CDFF00] transition-transform hover:scale-105">
            <img
              src="/logo.png"
              alt="Brand Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#E5E7EB] px-4 py-2.5 bg-white/95 overflow-x-auto">
        {navLinks.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-[#CDFF00]/15 text-[#000000] font-bold border border-[#CDFF00]/30' : 'text-[#64748B] hover:text-[#0D1117]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
