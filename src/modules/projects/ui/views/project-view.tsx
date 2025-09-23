"use client";

import { useAuth } from "@clerk/nextjs";
import { CodeIcon, CrownIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, useRef, useState } from "react";

import { FileExplorer } from "@/components/file-explorer";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserControl } from "@/components/user-control";
import { Fragment } from "@/generated/prisma";
import { FileCollection } from "@/types";
import { FragmentWeb } from "../components/fragment-web";
import { MessagesContainer } from "../components/messages-container";
import { ProjectHeader } from "../components/project-header";
import FeedbackForm from "../components/feedback-form";
import TechFeedbackForm from "../components/tech-feedback-form";
import { ErrorBoundary } from "react-error-boundary";

interface ProjectViewProps {
  projectId: string;
}

const ProjectView = ({ projectId }: ProjectViewProps) => {
  const { has } = useAuth();
  const hasProAccess = has?.({ plan: "pro" });

  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  const [isEditing, setIsEditing] = useState(false);
  const collectorRef = useRef<() => Array<{ selector: string; oldText: string; newText: string }>>(() => []);

  const registerCollector = (
    collector: () => Array<{ selector: string; oldText: string; newText: string; type?: string; url?: string }>
  ) => {
    collectorRef.current = collector;
  };

  async function handleSaveEdits() {
    try {
      const edits = collectorRef.current?.() || [];
      setIsEditing(false);
      if (!edits.length) return;
      // Create a user message instructing the agent to apply textual replacements
      const instructions = [
        "Aplique as seguintes substituições de texto nos arquivos do projeto (apenas literais de texto em TSX/JSX/HTML/MD/JSON). Não altere lógica ou estrutura de componentes.",
        ...edits.map((e, i) => `${i + 1}) \"${e.oldText}\" -> \"${e.newText}\" (selector: ${e.selector})`),
      ].join("\n");

      // Lazy import to avoid client/server split issues
      const { useTRPC } = await import("@/trpc/client");
      // useTRPC is a hook; but we are in a component function scope.
      // Instead of calling here, forward save to MessageForm via props and let it send.
      // noop here; MessageForm will handle sending when onSaveEdits is invoked.
      return instructions as unknown as void;
    } finally {
      // no-op
    }
  }

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={35}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <ErrorBoundary fallback={<p>Error...</p>}>
            <Suspense fallback={<FeedbackForm />}>
              <ProjectHeader projectId={projectId} />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary fallback={<p>Error...</p>}>
            <Suspense fallback={<FeedbackForm />}>
              <MessagesContainer
                projectId={projectId}
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                getEdits={() => collectorRef.current?.() || []}
              />
            </Suspense>
          </ErrorBoundary>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-primary transition-colors" />
        <ResizablePanel defaultSize={65} minSize={50}>
          <Tabs
            className="h-full gap-y-0"
            defaultValue="preview"
            value={tabState}
            onValueChange={(newValue) =>
              setTabState(newValue as "preview" | "code")
            }
          >
            <div className="w-full flex items-center p-2 border-b gap-x-2">
              <TabsList className="h-8 p-0 border rounded-md">
                <TabsTrigger value="code" className="rounded-md">
                  <CodeIcon />
                  <span>Código</span>
                </TabsTrigger>
                <TabsTrigger value="preview" className="rounded-md">
                  <EyeIcon />
                  <span>Prévia</span>
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-x-2">
                {/* {!hasProAccess && (
                  <Button asChild size="sm" variant="tertiary">
                    <Link href="/pricing">
                      <CrownIcon />
                      Upgrade
                    </Link>
                  </Button>
                )} */}
                <UserControl />
              </div>
            </div>
            <TabsContent value="preview">
              {activeFragment ? (
                <FragmentWeb
                  data={activeFragment}
                  isEditing={isEditing}
                  registerCollector={(c) => registerCollector(c)}
                />
              ) : (
                <FeedbackForm />
              )}
            </TabsContent>
            <TabsContent value="code" className="min-h-0">
              {!activeFragment?.files && <TechFeedbackForm />}
              {activeFragment?.files ? (
                <FileExplorer files={activeFragment.files as FileCollection} projectId={projectId} />
              ) : null}
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export { ProjectView };
