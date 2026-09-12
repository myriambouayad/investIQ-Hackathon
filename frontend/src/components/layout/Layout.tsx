import React from 'react';
import { Navbar } from './Navbar';
import { useAuth } from '../../hooks/useAuth';

export function Layout({
  children,
  tape,
}: {
  children: React.ReactNode;
  /** Optional full-bleed strip below the nav — the market tape. */
  tape?: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      {tape}
      {user?.is_guest && (
        <div role="status" className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-1.5">
          <p className="max-w-[92rem] mx-auto text-[0.6875rem] text-gray-500">
            <span className="font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)]">
              Demo
            </span>{' '}
            <span className="mx-1.5 text-gray-700">|</span>
            Sample session, discarded at logout. Figures are real calculations on
            historical prices, not a record of anyone's account.
          </p>
        </div>
      )}
      <main className="max-w-[92rem] mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
