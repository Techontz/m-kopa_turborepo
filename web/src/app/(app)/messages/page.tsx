"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { BroadcastModal, GroupModal, NewMessageModal } from "@/components/messages/ComposeModals";
import type { ContactsResponse, ConversationSummary, ConversationThread } from "@/components/messages/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { notifyError } from "@/components/ui/notify";
import { api } from "@/lib/api";

import styles from "./messages.module.css";

const TYPE_LABEL: Record<ConversationSummary["type"], string> = { direct: "", group: "GROUP", branch: "BRANCH", zone: "ZONE", company: "ALL STAFF" };

export default function MessagesPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [modal, setModal] = useState<"new" | "group" | "broadcast" | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: () => api.get<{ data: ConversationSummary[] }>("messages/conversations").then((response) => response.data),
    refetchInterval: 10000,
  });

  const contacts = useQuery({
    queryKey: ["messages", "contacts"],
    queryFn: () => api.get<ContactsResponse>("messages/contacts"),
    staleTime: 60000,
  });

  const thread = useQuery({
    queryKey: ["messages", "thread", selected],
    queryFn: () => api.get<{ data: ConversationThread }>(`messages/conversations/${selected}`).then((response) => response.data),
    enabled: selected !== null,
    refetchInterval: 5000,
  });

  const lastMessageId = thread.data?.messages.at(-1)?.id;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [lastMessageId, selected]);

  useEffect(() => {
    if (thread.data) {
      void client.invalidateQueries({ queryKey: ["messages", "conversations"] });
    }
  }, [lastMessageId, client, thread.data]);

  const send = useMutation({
    mutationFn: (body: string) => api.post(`messages/conversations/${selected}/messages`, { body }),
    onSuccess: async () => {
      setDraft("");
      await client.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: notifyError,
  });

  const openConversation = async (id: number) => {
    setSelected(id);
    await client.invalidateQueries({ queryKey: ["messages"] });
  };

  const term = search.trim().toLowerCase();
  const list = (conversations.data ?? []).filter((conversation) => !term || conversation.title.toLowerCase().includes(term));
  const current = thread.data?.conversation;

  return (
    <>
      <PageHeader crumbs={["Messages"]} />

      <div className="row clearfix">
        <div className="col-lg-4 col-md-5">
          <Card
            title="Conversations"
            actions={
              <>
                <button type="button" className="btn btn-sm btn-primary mr-1" title="New Message" onClick={() => setModal("new")}><i className="icon-pencil" /></button>
                {contacts.data?.can_create_group && (
                  <>
                    <button type="button" className="btn btn-sm btn-info mr-1" title="Create Group" onClick={() => setModal("group")}><i className="icon-people" /></button>
                    <button type="button" className="btn btn-sm btn-warning" title="Broadcast" onClick={() => setModal("broadcast")}><i className="icon-volume-2" /></button>
                  </>
                )}
              </>
            }
          >
            <input type="search" className="form-control mb-2" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className={styles.list}>
              {conversations.isLoading && <div className="mf-loading">Loading...</div>}
              {!conversations.isLoading && list.length === 0 && <p className="text-center text-muted py-3 mb-0">No conversations yet</p>}
              {list.map((conversation) => (
                <button type="button" key={conversation.id} className={`${styles.item} ${selected === conversation.id ? styles.itemActive : ""}`} onClick={() => void openConversation(conversation.id)}>
                  <div className={styles.itemTitle}>
                    <span>
                      {conversation.title} {TYPE_LABEL[conversation.type] && <Badge tone="info">{TYPE_LABEL[conversation.type]}</Badge>}
                    </span>
                    {conversation.unread_count > 0 && <span className={styles.unread}>{conversation.unread_count}</span>}
                  </div>
                  <div className={styles.itemPreview}>
                    {conversation.last_message ? `${conversation.last_message.sender}: ${conversation.last_message.body}` : conversation.subtitle}
                  </div>
                  {conversation.last_message && <small className="text-muted">{conversation.last_message.created_at}</small>}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-lg-8 col-md-7">
          <Card title={current ? current.title : "Messages"}>
            {selected === null ? (
              <p className="text-center text-muted py-5 mb-0">Select a conversation or start a new message</p>
            ) : thread.isLoading || !thread.data ? (
              <div className="mf-loading">Loading...</div>
            ) : (
              <>
                <div className="mb-2">
                  <small className="text-muted">
                    {current?.type === "direct" ? current.subtitle : current?.members.map((member) => member.label).join(", ")}
                  </small>
                </div>
                <div className={styles.thread} ref={threadRef}>
                  {thread.data.messages.length === 0 && <p className="text-center text-muted">No messages yet</p>}
                  {thread.data.messages.map((message) => (
                    <div key={message.id} className={`${styles.bubbleRow} ${message.mine ? styles.bubbleRowMine : ""}`}>
                      <div className={`${styles.bubble} ${message.mine ? styles.bubbleMine : ""}`}>
                        <div className={styles.meta}>{message.mine ? "You" : message.sender} · {message.created_at}</div>
                        {message.body}
                      </div>
                    </div>
                  ))}
                </div>
                {current?.can_post ? (
                  <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { send.mutate(draft); } }}>
                    <textarea
                      className="form-control"
                      placeholder="Write message"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (draft.trim()) {
                            send.mutate(draft);
                          }
                        }
                      }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={send.isPending || !draft.trim()}><i className="icon-paper-plane" /> Send</button>
                  </form>
                ) : (
                  <p className="text-muted text-center mt-2 mb-0">Announcement channel — only heads can post.</p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      <NewMessageModal open={modal === "new"} onClose={() => setModal(null)} contacts={contacts.data} onCreated={(id) => void openConversation(id)} />
      <GroupModal open={modal === "group"} onClose={() => setModal(null)} contacts={contacts.data} onCreated={(id) => void openConversation(id)} />
      <BroadcastModal open={modal === "broadcast"} onClose={() => setModal(null)} contacts={contacts.data} onCreated={(id) => void openConversation(id)} />
    </>
  );
}
