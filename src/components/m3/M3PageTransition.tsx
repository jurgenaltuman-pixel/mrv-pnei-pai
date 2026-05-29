import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

const ease = [0.2, 0, 0, 1] as const;

interface Props {
  routeKey: string;
  children: ReactNode;
}

export default function M3PageTransition({ routeKey, children }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease }}
        className="flex flex-1 flex-col min-h-0 w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
