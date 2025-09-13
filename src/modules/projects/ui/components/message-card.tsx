import { format } from "date-fns";
import { useState } from "react";
import Image from "next/image";

import { Card } from "@/components/ui/card";
import { Fragment, MessageRole, MessageType } from "@/generated/prisma";
import { cn } from "@/lib/utils";

interface UserMessageProps {
  content: string;
}

const UserMessage = ({ content }: UserMessageProps) => {
  const edits = parseInlineEdits(content);
  if (edits) {
    return <InlineEditsMessage edits={edits} />;
  }
  return (
    <div className="flex justify-end pb-4 pr-2 pl-10">
      <Card className="rounded-lg bg-muted p-3 shadow-none border-none max-w-4/5 break-words">
        {content}
      </Card>
    </div>
  );
};

// Fragment preview button removed per request

interface AssistantMessageProps {
  content: string;
  fragment: Fragment | null;
  createdAt: Date;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
  type: MessageType;
}

const AssistantMessage = ({
  content,
  createdAt,
  fragment,
  isActiveFragment,
  onFragmentClick,
  type,
}: AssistantMessageProps) => {
  return (
    <div
      className={cn(
        "flex flex-col group px-2 pb-4",
        type === "ERROR" && "text-red-700 dark:text-red-500"
      )}
    >
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="lovable-clone"
          height={18}
          width={18}
          className="shrink-0"
        />
        <span className="text-sm font-medium">Landinfy</span>
        <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {format(createdAt, "HH:mm 'on' MMM dd, yyyy")}
        </span>
      </div>

      <div className="pl-8.5 flex flex-col gap-y-4">
        <span>{content}</span>
        {/* Preview button removed */}
      </div>
    </div>
  );
};

interface MessageCardProps {
  content: string;
  role: MessageRole;
  fragment: Fragment | null;
  createdAt: Date;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
  type: MessageType;
}

const MessageCard = ({
  content,
  createdAt,
  fragment,
  isActiveFragment,
  onFragmentClick,
  role,
  type,
}: MessageCardProps) => {
  if (role === "ASSISTANT") {
    return (
      <AssistantMessage
        content={content}
        fragment={fragment}
        createdAt={createdAt}
        isActiveFragment={isActiveFragment}
        onFragmentClick={onFragmentClick}
        type={type}
      />
    );
  }

  return <UserMessage content={content} />;
};

export { MessageCard };

// Helpers
type EditPair = { oldText: string; newText: string };

function parseInlineEdits(content: string): EditPair[] | null {
  if (!content) return null;
  const header = "Aplique as seguintes substituições de texto";
  if (!content.includes(header)) return null;
  const lines = content.split(/\n|\r/).map((s) => s.trim()).filter(Boolean);
  const pairs: EditPair[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*\d+\)\s*"([\s\S]*?)"\s*->\s*"([\s\S]*?)"/);
    if (m) {
      const [, oldText, newText] = m;
      pairs.push({ oldText, newText });
    }
  }
  return pairs.length ? pairs : null;
}

function InlineEditsMessage({ edits }: { edits: EditPair[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end pb-4 pr-2 pl-10">
      <Card className="rounded-lg bg-muted p-3 shadow-none border max-w-4/5 w-full">
        <button
          type="button"
          className="w-full text-left font-medium"
          onClick={() => setOpen((v) => !v)}
        >
          Alteração de textos {open ? "▲" : "▼"}
        </button>
        {open && (
          <div className="mt-3 space-y-2">
            {edits.map((e, idx) => (
              <div key={idx} className="text-sm">
                <span className="text-muted-foreground">De:</span> {e.oldText}
                <span className="mx-2">→</span>
                <span className="text-muted-foreground">Para:</span> {e.newText}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
