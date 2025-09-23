import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Fragment } from "@/generated/prisma";
import {
  ExternalLinkIcon,
  RefreshCcwIcon,
  MonitorIcon,
  TabletIcon,
  SmartphoneIcon,
  LoaderIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface EditPair {
  selector: string;
  oldText: string;
  newText: string;
  type?: string;
  url?: string;
}

interface FragmentWebProps {
  data: Fragment;
  isEditing?: boolean;
  registerCollector?: (collector: () => Array<EditPair>) => void;
  isTransitioning?: boolean;
}

const FragmentWeb = ({ data, isEditing, registerCollector, isTransitioning }: FragmentWebProps) => {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editsRef = useRef<Array<EditPair>>([]);

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
      console.log('DEBUG: Mensagem recebida do iframe:', d);
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
        console.log('DEBUG: Edições recebidas do iframe:', d.edits);
        editsRef.current = d.edits.map((e: any) => ({ 
          selector: e.selector, 
          oldText: e.oldText, 
          newText: e.newText,
          type: e.type,
          url: e.url
        }));
        console.log('DEBUG: Edições armazenadas no editsRef:', editsRef.current);
        console.log('DEBUG: Tipos de edições:', editsRef.current.map(e => ({ type: e.type, oldText: e.oldText, newText: e.newText })));
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!registerCollector) return;
    console.log('DEBUG: Registrando collector...');
    registerCollector(() => {
      // Coletamos todas as edições válidas:
      // 1. Edições de texto onde o conteúdo mudou
      // 2. Hyperlinks (sempre válidos, mesmo se o texto não mudou)
      // 3. Qualquer edição que tenha um tipo específico
      const filteredEdits = editsRef.current.filter(e => {
        // Se tem tipo específico (como hyperlink), sempre incluir
        if (e.type) return true;
        // Se não tem tipo, incluir apenas se o texto mudou
        return e.oldText !== e.newText;
      });
      console.log('DEBUG: Collector chamado, edições filtradas:', filteredEdits);
      console.log('DEBUG: Edições originais:', editsRef.current);
      return filteredEdits;
    });
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
    <div className="flex flex-col w-full h-full relative">
      {/* Overlay de transição com fade in para preto e spinner */}
      {isTransitioning && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center animate-in fade-in-0 duration-300">
          <div className="flex flex-col items-center gap-4 text-white">
            <LoaderIcon className="h-8 w-8 animate-spin" />
            <p className="text-sm font-medium">
              {isEditing ? "Carregando edição..." : "Carregando preview..."}
            </p>
          </div>
        </div>
      )}
      
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
