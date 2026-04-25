import React from 'react';

export default function NmkLogo({ size = 185, color = "var(--color-primary-dark, #1b5e20)", textColor = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 250 250" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="250" height="250" rx="24" fill={color} />
      <path d="M30 80V40L60 65L90 40V80" stroke={textColor} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 40L30 80" stroke={textColor} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

