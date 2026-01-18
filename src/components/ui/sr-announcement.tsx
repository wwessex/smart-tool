import * as React from "react";

interface SRAnnouncementProps {
  /** The message to announce to screen readers */
  message: string;
  /** Politeness level: 'polite' waits for user to stop, 'assertive' interrupts */
  politeness?: "polite" | "assertive";
  /** Optional unique key to force re-announcement of same message */
  announceKey?: string | number;
}

/**
 * Visually hidden component that announces messages to screen readers.
 * Uses aria-live regions to announce dynamic content changes.
 * 
 * Usage:
 * <SRAnnouncement message={announcement} politeness="polite" />
 */
export function SRAnnouncement({ 
  message, 
  politeness = "polite",
  announceKey 
}: SRAnnouncementProps) {
  const [announcement, setAnnouncement] = React.useState("");
  
  React.useEffect(() => {
    if (message) {
      // Clear first to ensure re-announcement of same message
      setAnnouncement("");
      // Use requestAnimationFrame to ensure DOM update triggers announcement
      requestAnimationFrame(() => {
        setAnnouncement(message);
      });
    }
  }, [message, announceKey]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Hook to manage screen reader announcements.
 * Returns a function to trigger announcements and the announcement element.
 * 
 * Usage:
 * const { announce, AnnouncementRegion } = useSRAnnouncement();
 * 
 * announce("Action generated successfully");
 * 
 * // Render the region somewhere in your component
 * <AnnouncementRegion />
 */
export function useSRAnnouncement(politeness: "polite" | "assertive" = "polite") {
  const [message, setMessage] = React.useState("");
  const [key, setKey] = React.useState(0);

  const announce = React.useCallback((msg: string) => {
    setMessage(msg);
    setKey(k => k + 1);
  }, []);

  const clear = React.useCallback(() => {
    setMessage("");
  }, []);

  const AnnouncementRegion = React.useCallback(() => (
    <SRAnnouncement message={message} politeness={politeness} announceKey={key} />
  ), [message, politeness, key]);

  return { announce, clear, AnnouncementRegion };
}
