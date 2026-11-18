import type { ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useSettings, useStatus } from "../lib/hooks";
import { EASE_OUT } from "../lib/motion";

/** Quiet notice when the tracker is down, or websites can't be recorded yet. */
export function StatusBanner() {
  const status = useStatus();
  const settings = useSettings();
  let content: ReactNode = null;
  let key = "";

  if (status.isError) {
    key = "offline";
    content = (
      <span className="t-body-s c-secondary banner-text">
        Tempo’s tracker isn’t running, so nothing is being recorded. Start it with <span className="t-data-s c-primary">npm start</span> in the
        tempo folder.
      </span>
    );
  } else if (status.data && settings.trackWebsites && !status.data.extension.connected) {
    key = "ext";
    content = (
      <span className="t-body-s c-secondary banner-text">
        Websites aren’t being recorded yet. <Link to="/settings#tracking">Connect the Chrome extension</Link> to see them here.
      </span>
    );
  }

  return (
    <AnimatePresence>
      {content && (
        <motion.div
          key={key}
          className="banner"
          role="status"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <span className="banner-dot" />
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
