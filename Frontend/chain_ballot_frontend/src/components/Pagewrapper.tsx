import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { useEffect, useState } from "react";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 14,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(4px)",
  },
};

const pageTransition: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1], // premium cubic-bezier
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsReady(true);
    },1); // ⏱ loading delay (ms)

    return () => clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate={isReady ? "animate" : "initial"}
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
};

export default PageWrapper;
