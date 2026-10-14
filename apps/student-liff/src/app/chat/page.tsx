"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, SearchX } from "lucide-react";
import { toast } from "sonner";
import {
  AppBar,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRowSkeleton,
  Notice,
  Screen,
  SearchField,
  SectionHeader,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { enrolledClassesResourceKey, type EnrolledClassesResponse } from "@/lib/schedule";
import { ChatListSkeleton } from "./_components/ChatListSkeleton";
import { ClassChatGroup } from "./_components/ClassChatGroup";
import { ConversationRow } from "./_components/ConversationRow";
import {
  conversationsResourceKey,
  filterClasses,
  filterConversations,
  initiateKey,
  type Conversation,
  type ConversationsResponse,
  type EnrolledChatClass,
} from "./_lib/conversations";
import { useConversationListPolling } from "./_lib/useConversationListPolling";

const EMPTY_CONVERSATIONS: Conversation[] = [];
const EMPTY_CLASSES: EnrolledChatClass[] = [];

export default function ChatListPage() {
  const router = useRouter();
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;

  const conversationsRes = useCachedResource<ConversationsResponse>(
    userId ? conversationsResourceKey(userId) : null,
    () => studentApi.getConversations(),
    { enabled: isReady },
  );
  // Enrolled classes rarely change while the screen is open: loaded once (and on
  // focus when stale), not on every poll. Shared cache entry with /schedule.
  const classesRes = useCachedResource<EnrolledClassesResponse>(
    userId ? enrolledClassesResourceKey(userId) : null,
    () => studentApi.getEnrolledClasses(),
    { enabled: isReady },
  );

  // Conversations only, every 15s; paused while LINE is in the background.
  // Chimes when the unread total goes up (never on opening the screen).
  useConversationListPolling(conversationsRes.refetch, { enabled: isReady && Boolean(userId) });

  const conversations = conversationsRes.data?.conversations ?? EMPTY_CONVERSATIONS;
  const classes = (classesRes.data?.classes as EnrolledChatClass[] | null | undefined) ?? EMPTY_CLASSES;

  const [searchTerm, setSearchTerm] = useState("");
  const [initiating, setInitiating] = useState<string | null>(null);

  const filteredConversations = useMemo(
    () => filterConversations(conversations, searchTerm),
    [conversations, searchTerm],
  );
  const filteredClasses = useMemo(() => filterClasses(classes, searchTerm), [classes, searchTerm]);

  const handleStartChat = async (type: "DIRECT" | "GROUP", classId: string, tutorUserId?: string) => {
    if (initiating) return;
    setInitiating(initiateKey(type, classId));
    try {
      const res = await studentApi.initiateChat({ type, classId, targetUserId: tutorUserId });
      if (res && res.conversationId) {
        router.push(`/chat/${res.conversationId}`);
      } else {
        throw new Error("Failed to get ID");
      }
    } catch (err: unknown) {
      console.warn("Failed to initiate:", err);
      toast.error(t("chat.openFailed"));
      setInitiating(null);
    }
  };

  if (!isReady || conversationsRes.isLoading) return <ChatListSkeleton />;

  const searchBar = (
    <SearchField value={searchTerm} onChange={setSearchTerm} placeholder={t("chat.searchPlaceholder")} />
  );

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("chat.title")} back fallbackHref="/dashboard" />
        <LiffErrorState />
      </Screen>
    );
  }

  const retryAll = () => {
    void conversationsRes.refetch();
    if (!classesRes.data) void classesRes.refetch();
  };

  if (conversationsRes.error && !conversationsRes.data) {
    return (
      <Screen>
        <AppBar title={t("chat.title")} back fallbackHref="/dashboard" />
        <ErrorState
          description={t("chat.loadConversationsFailed")}
          onRetry={retryAll}
          retrying={conversationsRes.isValidating}
        />
      </Screen>
    );
  }

  const searching = searchTerm.trim().length > 0;
  const classesLoading = classesRes.isLoading;
  const classesFailed = Boolean(classesRes.error) && !classesRes.data;
  const hasAnything = conversations.length > 0 || classes.length > 0;
  const showEmpty = !classesLoading && !classesFailed && !hasAnything;
  const showNoResults =
    searching && !classesLoading && filteredConversations.length === 0 && filteredClasses.length === 0 && hasAnything;
  const now = new Date();

  return (
    <Screen>
      <AppBar title={t("chat.title")} back fallbackHref="/dashboard" bottom={showEmpty ? undefined : searchBar} />

      <div className="flex flex-col gap-6 px-4 pt-3 pb-[calc(24px+var(--safe-bottom))]">
        {conversationsRes.error ? (
          <p role="status" className="px-1 text-[13px] leading-[1.5] text-fg-muted">
            {t("chat.reconnecting")}
          </p>
        ) : null}

        {showEmpty ? (
          <EmptyState
            icon={MessageCircle}
            title={t("chat.emptyTitle")}
            description={t("chat.emptyDescription")}
            action={
              <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
                {t("chat.findClass")}
              </Link>
            }
          />
        ) : null}

        {showNoResults ? (
          <EmptyState
            icon={SearchX}
            tone="neutral"
            title={t("common.noResultsTitle")}
            description={t("common.noResultsDescription")}
          />
        ) : null}

        {filteredConversations.length > 0 ? (
          <section className="flex flex-col gap-1">
            <SectionHeader title={t("chat.recentSection")} className="px-1" />
            <ListGroup>
              {filteredConversations.map((conversation) => (
                <ConversationRow key={conversation.id} conversation={conversation} now={now} />
              ))}
            </ListGroup>
          </section>
        ) : null}

        {classesLoading ? (
          <section className="flex flex-col gap-1">
            <SectionHeader title={t("chat.startSection")} className="px-1" />
            <ListGroup>
              <ListRowSkeleton count={2} />
            </ListGroup>
          </section>
        ) : classesFailed ? (
          <Notice
            tone="warning"
            title={t("chat.startLoadFailed")}
            action={
              <Button
                variant="brandSoft"
                size="touch"
                onClick={() => void classesRes.refetch()}
                loading={classesRes.isValidating}
              >
                {t("common.retry")}
              </Button>
            }
          />
        ) : filteredClasses.length > 0 ? (
          <section className="flex flex-col gap-4">
            <SectionHeader title={t("chat.startSection")} className="-mb-3 px-1" />
            {filteredClasses.map((cls) => (
              <ClassChatGroup key={cls.id} cls={cls} initiating={initiating} onStart={handleStartChat} />
            ))}
          </section>
        ) : null}
      </div>
    </Screen>
  );
}
