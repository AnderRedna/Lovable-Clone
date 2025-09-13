import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { Fragment } from "@/generated/prisma";
import { useTRPC } from "@/trpc/client";
import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { MessageLoading } from "./message-loading";
import { StepsCard } from "./steps-card";

interface MessagesContainerProps {
  projectId: string;
  activeFragment: Fragment | null;
  setActiveFragment: (activeFragment: Fragment | null) => void;
  isEditing?: boolean;
  setIsEditing?: (v: boolean) => void;
  getEdits?: () => Array<{ selector: string; oldText: string; newText: string }>;
}

const MessagesContainer = ({
  activeFragment,
  projectId,
  setActiveFragment,
  isEditing,
  setIsEditing,
  getEdits,
}: MessagesContainerProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  const trpc = useTRPC();
  const { data: messages } = useQuery(
    trpc.messages.getMany.queryOptions({ projectId }, { refetchInterval: 5000 })
  );

  useEffect(() => {
    const lastAssistantMessage = messages?.findLast(
      (message) => message.role === "ASSISTANT"
    );

    if (
      lastAssistantMessage?.fragment &&
      lastAssistantMessage.id !== lastAssistantMessageIdRef.current
    ) {
      setActiveFragment(lastAssistantMessage?.fragment);
      lastAssistantMessageIdRef.current = lastAssistantMessage.id;
    }
  }, [messages, setActiveFragment]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages?.length]);

  const lastMessage = messages?.[messages?.length - 1];
  const isLastMessageUser = lastMessage?.role === "USER";

  const stepsMessage = messages?.findLast(
    (message) => message.type === "STEPS"
  );
  let steps;
  try {
    if (stepsMessage) {
      steps = JSON.parse(stepsMessage.content);
    }
  } catch (e) {
    console.error("Failed to parse steps", e);
  }

  // Keep processing UI while we have steps and no final result/error after them
  const stepsIndex = stepsMessage && messages ? messages.findIndex((m) => m.id === stepsMessage.id) : -1;
  const hasFinalAfterSteps =
    stepsIndex !== -1 && messages
      ? messages.slice(stepsIndex + 1).some((m) => m.type === "RESULT" || m.type === "ERROR")
      : false;

  const isProcessing = isLastMessageUser || (!!stepsMessage && !hasFinalAfterSteps);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-sidebar">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="pt-2 pr-1">
          {messages?.map((message) => {
            if (message.type === "STEPS") {
              let parsed: string[] | undefined;
              try {
                parsed = JSON.parse(message.content);
              } catch {}
              const finalAfterThis = messages
                ? messages
                    .slice(messages.findIndex((m) => m.id === message.id) + 1)
                    .some((m) => m.type === "RESULT" || m.type === "ERROR")
                : false;
              return parsed ? (
                <StepsCard
                  key={message.id}
                  steps={parsed}
                  messageId={message.id}
                  forceComplete={finalAfterThis}
                />
              ) : null;
            }
            return (
              <MessageCard
                key={message.id}
                content={message.content}
                role={message.role}
                fragment={message.fragment}
                createdAt={message.createdAt}
                isActiveFragment={
                  activeFragment?.id === message.fragment?.id
                }
                onFragmentClick={() => setActiveFragment(message.fragment)}
                type={message.type}
              />
            );
          })}

          {/* Show loader only before steps are available */}
          {isProcessing && !stepsMessage && <MessageLoading steps={steps} />}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="relative p-3 pt-1">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <MessageForm
          projectId={projectId}
          isEditing={!!isEditing}
          onToggleEditing={() => setIsEditing?.(!isEditing)}
          getEdits={getEdits}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
};

export { MessagesContainer };
