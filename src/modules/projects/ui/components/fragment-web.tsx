import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Fragment } from "@/generated/prisma";
import {
  ExternalLinkIcon,
  RefreshCcwIcon,
  MonitorIcon,
  TabletIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

interface FragmentWebProps {
  data: Fragment;
}

const FragmentWeb = ({ data }: FragmentWebProps) => {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const previewWidth = useMemo(() => {
    switch (device) {
      case "tablet":
        return 768; // iPad portrait width
      case "mobile":
        return 390; // iPhone 12/13/14/15 width
      default:
        return undefined; // full width
    }
  }, [device]);

  return (
    <div className="flex flex-col w-full h-full">
  <div className="p-2 border-b bg-sidebar flex items-center gap-x-2 relative">
        <Hint text="Click to refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          <Hint text="Computador" side="bottom">
            <Button
              size="sm"
              variant={device === "desktop" ? "secondary" : "outline"}
              onClick={() => setDevice("desktop")}
            >
              <MonitorIcon className="h-4 w-4" />
            </Button>
          </Hint>
          <Hint text="Tablet" side="bottom">
            <Button
              size="sm"
              variant={device === "tablet" ? "secondary" : "outline"}
              onClick={() => setDevice("tablet")}
            >
              <TabletIcon className="h-4 w-4" />
            </Button>
          </Hint>
          <Hint text="Celular" side="bottom">
            <Button
              size="sm"
              variant={device === "mobile" ? "secondary" : "outline"}
              onClick={() => setDevice("mobile")}
            >
              <SmartphoneIcon className="h-4 w-4" />
            </Button>
          </Hint>
        </div>
        <Hint text="Abrir em uma nova aba" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!data.sandboxUrl}
            variant="outline"
            onClick={() => {
              if (!data.sandboxUrl) {
                return;
              }

              window.open(data.sandboxUrl, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      <div className="flex-1 w-full overflow-auto flex items-start justify-center p-4 bg-background">
        <div
          className={
            "h-full max-h-full bg-background border rounded-md shadow-sm overflow-hidden transition-all duration-300 ease-in-out"
          }
          style={{ width: previewWidth ?? "100%" }}
        >
          <iframe
            key={fragmentKey}
            className="h-full w-full"
            loading="lazy"
            src={data.sandboxUrl}
          />
        </div>
      </div>
    </div>
  );
};

export { FragmentWeb };
