import * as React from "react";

/** Tailwind `xl` — embedded Copilot side panel at this width and above. */
const XL_BREAKPOINT = 1280;

export function useIsXLargeScreen() {
  const [isXLargeScreen, setIsXLargeScreen] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`);
    const onChange = () => {
      setIsXLargeScreen(window.innerWidth >= XL_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsXLargeScreen(window.innerWidth >= XL_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isXLargeScreen ?? false;
}
