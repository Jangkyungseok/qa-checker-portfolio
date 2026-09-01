import React from 'react';

export type UiIconName =
  | 'project'
  | 'tools'
  | 'shortcuts'
  | 'notices'
  | 'admin'
  | 'build'
  | 'history'
  | 'report'
  | 'issue'
  | 'test'
  | 'calendar'
  | 'files'
  | 'back';

export default function UiIcon({
  name,
  size = 20,
  strokeWidth = 1.9,
}: {
  name: UiIconName;
  size?: number;
  strokeWidth?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'project':
      return <svg {...common}><path d="M3 7.5h6l2 2h10v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 7.5V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1.5"/></svg>;
    case 'tools':
      return <svg {...common}><path d="M14.7 6.3a4 4 0 0 0-5.1 5.1L4 17l3 3 5.6-5.6a4 4 0 0 0 5.1-5.1l-2.6 2.6-3-3 2.6-2.6Z"/></svg>;
    case 'shortcuts':
      return <svg {...common}><path d="M14 5h5v5"/><path d="M10 14 19 5"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
    case 'notices':
      return <svg {...common}><path d="M4 11v2l12 5V6L4 11Z"/><path d="m7 14 1.5 6h3"/><path d="M19 9a4 4 0 0 1 0 6"/></svg>;
    case 'admin':
      return <svg {...common}><path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"/><path d="m9.5 12 1.7 1.7 3.5-3.7"/></svg>;
    case 'build':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="m8 12 2 2 5-5"/><path d="M8 18h8"/></svg>;
    case 'history':
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/></svg>;
    case 'report':
      return <svg {...common}><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/><path d="M3 20h18"/></svg>;
    case 'issue':
      return <svg {...common}><path d="M10.3 4.1 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
    case 'test':
      return <svg {...common}><path d="M9 5h10"/><path d="M9 12h10"/><path d="M9 19h10"/><path d="m4 5 1 1 2-2"/><path d="m4 12 1 1 2-2"/><path d="m4 19 1 1 2-2"/></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>;
    case 'files':
      return <svg {...common}><path d="M5 4h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 11h8"/><path d="M8 15h6"/></svg>;
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
    default:
      return null;
  }
}
