import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useSettings } from "./lib/hooks";
import { EASE_OUT } from "./lib/motion";
import { Overview } from "./pages/Overview";
import { ItemDetail } from "./pages/ItemDetail";
import { Settings } from "./pages/Settings";

export function App() {
  const location = useLocation();
  const settings = useSettings();

  return (
    <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>
      <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo({ top: 0 })}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <Routes location={location}>
            <Route path="/" element={<Overview />} />
            <Route path="/item/:id" element={<ItemDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      <ReducedMotionClass on={settings.reduceMotion} />
    </MotionConfig>
  );
}

/** Lets CSS transitions respect the in-app "Reduce motion" setting too. */
function ReducedMotionClass({ on }: { on: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", on);
  }, [on]);
  return null;
}
