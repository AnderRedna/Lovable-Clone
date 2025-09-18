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
import { useEffect, useMemo, useRef, useState } from "react";

interface FragmentWebProps {
  data: Fragment;
  isEditing?: boolean;
  registerCollector?: (collector: () => Array<{ selector: string; oldText: string; newText: string }>) => void;
}

const FragmentWeb = ({ data, isEditing, registerCollector }: FragmentWebProps) => {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editsRef = useRef<Array<{ selector: string; oldText: string; newText: string }>>([]);

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

  const proxiedUrl = useMemo(() => {
    const base = "/api/preview-proxy";
    const u = new URL(base, window.location.origin);
    u.searchParams.set("url", data.sandboxUrl || "");
    if (isEditing) u.searchParams.set("edit", "1");
    return u.toString();
  }, [data.sandboxUrl, isEditing]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = (ev && ev.data) || {};
      if (d && d.type === "proxy-ready") {
        // once proxy is ready, send current editing state
        const iframe = iframeRef.current;
        if (iframe) {
          setTimeout(() => {
            try {
              iframe.contentWindow?.postMessage(
                { type: isEditing ? "enable-editing" : "disable-editing" },
                "*"
              );
            } catch {}
          }, 100);
        }
      }
      if (d && d.type === "inline-edits" && Array.isArray(d.edits)) {
        editsRef.current = d.edits.map((e: any) => ({ selector: e.selector, oldText: e.oldText, newText: e.newText }));
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!registerCollector) return;
    registerCollector(() => editsRef.current.filter(e => e.oldText !== e.newText));
  }, [registerCollector]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = (msg: any) => {
      try {
        iframe.contentWindow?.postMessage(msg, "*");
      } catch {}
    };
    const onLoad = () => {
      // small delay avoids hydration races inside the sandbox
      setTimeout(() => {
        if (isEditing) send({ type: "enable-editing" });
        else send({ type: "disable-editing" });
      }, 150);
    };
    iframe.addEventListener("load", onLoad);
    // Also send immediately in case of bfcache
    // but defer a tick to avoid running before contentWindow is ready
    setTimeout(onLoad, 50);
    return () => {
      try { iframe.removeEventListener("load", onLoad); } catch {}
    };
  }, [isEditing, proxiedUrl]);

  return (
    <div className="flex flex-col w-full h-full">
  <div className="p-2 border-b bg-sidebar flex items-center gap-x-2 relative">
        <Hint text="Clique para atualizar" side="bottom" align="start">
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
            data-preview-iframe
            ref={iframeRef}
            key={fragmentKey}
            className="h-full w-full"
            loading="lazy"
            src={isEditing ? proxiedUrl : data.sandboxUrl}
          />
        </div>
      </div>
    </div>
  );
};

export { FragmentWeb };
