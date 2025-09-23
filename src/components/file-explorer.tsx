import { CopyCheckIcon, CopyIcon, DownloadIcon, Loader2 } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { MAX_SEGMENTS } from "@/constants";
import { convertFilesToTreeItems } from "@/lib/utils";
import { FileCollection } from "@/types";
import { CodeView } from "./code-view";
import { Hint } from "./hint";
import { TreeView } from "./tree-view";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";

function getLanguageFromExtension(filename: string): string {
  const extension = filename.split(".")?.pop()?.toLowerCase();
  return extension || "text";
}

interface FileBreadcrumbProps {
  filePath: string;
}

const FileBreadcrumb = ({ filePath }: FileBreadcrumbProps) => {
  const pathSegments = filePath.split("/");

  const renderBreadcrumItems = () => {
    if (pathSegments.length <= MAX_SEGMENTS) {
      return pathSegments.map((segment, index) => {
        const isLast = index === pathSegments.length - 1;

        return (
          <Fragment key={index}>
            <BreadcrumbItem>
              {isLast ? (
                <BreadcrumbPage className="font-medium">
                  {segment}
                </BreadcrumbPage>
              ) : (
                <span className="text-muted-foreground">{segment}</span>
              )}
            </BreadcrumbItem>
            {!isLast && <BreadcrumbSeparator />}
          </Fragment>
        );
      });
    } else {
      const firstSegment = pathSegments[0];
      const lastSegment = pathSegments[pathSegments.length - 1];

      return (
        <>
          <BreadcrumbItem>
            <span className="text-muted-foreground">{firstSegment}</span>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">
                {lastSegment}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbItem>
        </>
      );
    }
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>{renderBreadcrumItems()}</BreadcrumbList>
    </Breadcrumb>
  );
};

interface FileExplorerProps {
  files: FileCollection;
  projectId: string;
}

const FileExplorer = ({ files, projectId }: FileExplorerProps) => {
  // Only show actual generated files
  const allFiles: FileCollection = { ...files };

  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
  const fileKeys = Object.keys(allFiles);
    return fileKeys.length > 0 ? fileKeys[0] : null;
  });
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const treeData = useMemo(() => {
    return convertFilesToTreeItems(allFiles);
  }, [allFiles]);

  const handleFileSelect = useCallback(
    (filePath: string) => {
      if (allFiles[filePath]) {
        setSelectedFile(filePath);
      }
    },
    [allFiles]
  );

  const handleCopy = () => {
    if (selectedFile && allFiles[selectedFile]) {
      navigator.clipboard
        .writeText(allFiles[selectedFile])
        .then(() => {
          setCopied(true);
          toast.success("Copiado para a área de transferência");
          setTimeout(() => {
            setCopied(false);
          }, 2000);
        })
        .catch(() => {
          toast.error("Algo deu errado. Por favor, tente novamente.");
        });
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return; // Evita múltiplos downloads simultâneos
    
    setIsDownloading(true);
    try {
      // Primeiro, tentar download direto do sandbox
      toast.info("Realizando download do projeto...");
      
      const sandboxResponse = await fetch(`/api/projects/${projectId}/download-from-sandbox`);
      
      if (sandboxResponse.ok) {
        // Download do sandbox bem-sucedido
        const blob = await sandboxResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-${projectId}-sandbox.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Download do sandbox concluído!");
        return;
      }
      
      // Se falhou, verificar se é erro de sandbox indisponível
      const sandboxError = await sandboxResponse.json().catch(() => ({}));
      if (sandboxError.fallback || sandboxResponse.status === 503) {
        toast.info("Sandbox indisponível. Usando geração manual...");
      } else {
        console.warn("Erro no download do sandbox:", sandboxError);
        toast.info("Erro no sandbox. Usando geração manual...");
      }
      
      // Fallback: usar geração manual
      const response = await fetch(`/api/projects/${projectId}/download-zip`);
      if (!response.ok) {
        throw new Error('Failed to download ZIP');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Download manual concluído!");
      
    } catch (error) {
      console.error("Erro no download:", error);
      toast.error("Falha no download. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={30} minSize={30} className="bg-sidebar">
        <TreeView
          data={treeData}
          value={selectedFile}
          onSelect={handleFileSelect}
        />
      </ResizablePanel>
      <ResizableHandle className="hover:bg-primary transition-colors" />
  <ResizablePanel defaultSize={70} minSize={50} className="min-h-0">
        {selectedFile && allFiles[selectedFile] ? (
          <div className="h-full w-full min-h-0 flex flex-col">
            <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center gap-x-2">
              <FileBreadcrumb filePath={selectedFile} />
              <div className="flex gap-x-2">
                <Hint text="Baixar projeto como ZIP" side="bottom">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? <Loader2 className="animate-spin" /> : <DownloadIcon />}
                  </Button>
                </Hint>
                <Hint text="Copiar para a área de transferência" side="bottom">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    disabled={copied}
                  >
                    {copied ? <CopyCheckIcon /> : <CopyIcon />}
                  </Button>
                </Hint>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <CodeView
                code={allFiles[selectedFile]}
                lang={getLanguageFromExtension(selectedFile)}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a file to view its content
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export { FileExplorer };
