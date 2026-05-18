import type { ImgHTMLAttributes } from 'react';
import { APP_TITLE_SHORT } from '@/lib/app-branding';

const LOGO_SRC = '/logo-mrv-oficial.png';

/** Logo institucional PNEI / PAI — MSPBS (PNG en /public). */
export function MrvAppLogo({ className, alt = APP_TITLE_SHORT, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={className}
      decoding="async"
      {...props}
    />
  );
}
