"use client";

import { useParams } from "next/navigation";
import { TicketRoom } from "../_components/TicketRoom";

export default function SupportTicketPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = String(params?.ticketId ?? "");
  // Keyed so opening another ticket starts with a fresh draft and scroll state.
  return <TicketRoom key={ticketId} ticketId={ticketId} />;
}
