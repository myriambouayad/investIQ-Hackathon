/** Formatting shared by the agent desk and the dashboard trading bot.
 *
 *  Kept in one place because the two views show the same numbers: a return
 *  rendered to two decimals on one screen and three on the other reads as two
 *  different figures.
 */

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money2 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const signed = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;

export const signedMoney = (n: number) => `${n >= 0 ? '+' : '−'}${money2(Math.abs(n))}`;

export const num = (n: number, d = 2) => n.toFixed(d);

export const REGIME_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  calm: 'green',
  volatile: 'yellow',
  bear: 'red',
  unknown: 'gray',
};
