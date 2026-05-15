import type { ImgHTMLAttributes } from 'react';

const LOGO_SRC = '/logo-mrv.png';

/** Logo institucional MRV (PNG en /public). */
export function MrvAppLogo({ className, alt = 'MRV 2026', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
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
