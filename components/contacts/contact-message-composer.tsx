"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setWahaTypingClient } from "@/lib/contact-messages/waha-typing-client";
import { CONTACT_MESSAGE_ATTACHMENT_MAX_FILES } from "@/lib/constants/contact-message-attachments";
import { Mail, Paperclip, Send, X } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WHATSAPP_TYPING_DEBOUNCE_MS = 400;

export function ContactMessageComposer({
  disabled,
  sending,
  hasPhone,
  hasEmail,
  whatsappEnabled,
  emailEnabled,
  defaultSendWhatsapp,
  defaultSendEmail,
  onSend,
  placeholder = "Nachricht schreiben …",
  variant = "unified",
  showGuestNotify,
  gwadaSendEnabled = true,
  whatsappTyping,
  stickyFooter = false,
  emailViaPlatformFallback = false,
}: {
  disabled?: boolean;
  sending?: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  defaultSendWhatsapp?: boolean;
  defaultSendEmail?: boolean;
  onSend: (params: {
    body: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
    notifyWhatsapp?: boolean;
    notifyEmail?: boolean;
    files?: File[];
  }) => void | Promise<void>;
  placeholder?: string;
  /** `whatsapp-only` / `email-only` / `gwada-only` / `inbox-reply` (ein Kanal). */
  variant?: "unified" | "whatsapp-only" | "email-only" | "gwada-only" | "inbox-reply";
  /** Gwada: Gast per Link auf Chat hinweisen (Benachrichtigung). */
  showGuestNotify?: boolean;
  /** Gwada-only: Senden erlaubt (verknüpfter Kontakt). */
  gwadaSendEnabled?: boolean;
  /** WAHA: „tippt …“ an den Chat senden. */
  whatsappTyping?: { restaurantId: string; chatId: string } | null;
  /** Posteingang: ohne oberen Rand — Footer bringt die Trennlinie. */
  stickyFooter?: boolean;
  /** E-Mail ohne Restaurant-Postfach — Versand über Plattform-SMTP. */
  emailViaPlatformFallback?: boolean;
}) {
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const typingActiveRef = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sendWhatsapp, setSendWhatsapp] = useState(
    defaultSendWhatsapp ?? false,
  );
  const [sendEmail, setSendEmail] = useState(defaultSendEmail ?? false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);

  const isWhatsappOnly = variant === "whatsapp-only";
  const isEmailOnly = variant === "email-only";
  const isGwadaOnly = variant === "gwada-only";
  const isInboxReply = variant === "inbox-reply";
  const showNotify = showGuestNotify ?? isGwadaOnly;
  const canWhatsapp = isWhatsappOnly
    ? whatsappEnabled
    : whatsappEnabled && hasPhone;
  const canEmail = isEmailOnly ? emailEnabled : emailEnabled && hasEmail;

  useEffect(() => {
    if (!isInboxReply) return;
    setSendWhatsapp(defaultSendWhatsapp ?? false);
    setSendEmail(defaultSendEmail ?? false);
  }, [isInboxReply, defaultSendWhatsapp, defaultSendEmail]);

  useEffect(() => {
    if (!isInboxReply) return;
    if (canWhatsapp && !canEmail) setSendWhatsapp(true);
    if (canEmail && !canWhatsapp) setSendEmail(true);
  }, [isInboxReply, canWhatsapp, canEmail]);

  const onlyInboxWhatsapp = isInboxReply && canWhatsapp && !canEmail;
  const onlyInboxEmail = isInboxReply && canEmail && !canWhatsapp;

  const setReplyWhatsapp = (on: boolean) => {
    if (onlyInboxWhatsapp) return;
    if (!on && !sendEmail && canEmail) setSendEmail(true);
    setSendWhatsapp(on);
  };

  const setReplyEmail = (on: boolean) => {
    if (onlyInboxEmail) return;
    setSendEmail(on);
    if (!on && !sendWhatsapp && canWhatsapp) setSendWhatsapp(true);
  };

  const canSubmit =
    body.trim().length > 0 || pendingFiles.length > 0;

  const stopWhatsappTyping = useCallback(() => {
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
    if (!whatsappTyping || !typingActiveRef.current) return;
    typingActiveRef.current = false;
    void setWahaTypingClient({
      restaurantId: whatsappTyping.restaurantId,
      chatId: whatsappTyping.chatId,
      action: "stop",
    });
  }, [whatsappTyping]);

  useEffect(() => {
    typingActiveRef.current = false;
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
  }, [whatsappTyping?.restaurantId, whatsappTyping?.chatId]);

  useEffect(() => () => stopWhatsappTyping(), [stopWhatsappTyping]);

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (!whatsappTyping) return;
    if (!value.trim()) {
      stopWhatsappTyping();
      return;
    }
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    typingDebounceRef.current = setTimeout(() => {
      typingDebounceRef.current = null;
      if (typingActiveRef.current) return;
      typingActiveRef.current = true;
      void setWahaTypingClient({
        restaurantId: whatsappTyping.restaurantId,
        chatId: whatsappTyping.chatId,
        action: "start",
      });
    }, WHATSAPP_TYPING_DEBOUNCE_MS);
  };

  const addFiles = useCallback((list: FileList | File[] | null) => {
    if (!list?.length) return;
    const items = Array.from(list);
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const file of items) {
        if (next.length >= CONTACT_MESSAGE_ATTACHMENT_MAX_FILES) break;
        next.push(file);
      }
      return next;
    });
  }, []);

  const canAttach = !disabled && !sending;

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!canAttach) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragOver(true);
      }
    },
    [canAttach],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canAttach) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    [canAttach],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (!canAttach) return;
      addFiles(e.dataTransfer.files);
    },
    [addFiles, canAttach],
  );

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = () => {
    const text = body.trim();
    if (!text && pendingFiles.length === 0) return;
    if (isInboxReply && !sendWhatsapp && !sendEmail) return;
    stopWhatsappTyping();
    void onSend({
      body: text,
      sendWhatsapp: isWhatsappOnly
        ? true
        : isInboxReply
          ? sendWhatsapp && canWhatsapp
          : sendWhatsapp && canWhatsapp,
      sendEmail: isEmailOnly
        ? true
        : isInboxReply
          ? sendEmail && canEmail
          : sendEmail && canEmail,
      notifyWhatsapp: showNotify ? notifyWhatsapp && canWhatsapp : false,
      notifyEmail: showNotify ? notifyEmail && canEmail : false,
      files: pendingFiles.length > 0 ? pendingFiles : undefined,
    });
    setBody("");
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const showInboxChannelToggles =
    isInboxReply && (canWhatsapp || canEmail);

  return (
    <div
      className={cn(
        "min-w-0 space-y-2 overflow-x-hidden",
        !stickyFooter && "border-t border-border/50 pt-3",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        disabled={disabled || sending}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        data-vaul-no-drag
        className={cn(
          "relative rounded-xl transition-[box-shadow,border-color]",
          isDragOver && "ring-2 ring-accent/80 ring-offset-2 ring-offset-background",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/10 px-3 text-center text-xs font-medium text-accent"
            aria-hidden
          >
            Bilder oder Dateien loslassen …
          </div>
        ) : null}
        <Textarea
          value={body}
          disabled={disabled || sending}
          onChange={(e) => handleBodyChange(e.target.value)}
          onBlur={() => stopWhatsappTyping()}
          placeholder={placeholder}
          rows={stickyFooter ? 2 : 3}
          className={cn(
            "resize-y rounded-xl",
            stickyFooter ? "min-h-[3.25rem]" : "min-h-[4.5rem]",
            isDragOver && "border-accent/50",
          )}
        />
      </div>
      {pendingFiles.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {pendingFiles.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-lg border border-border/50 bg-muted/20 px-2 py-1 text-xs"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label={`${file.name} entfernen`}
                onClick={() => removeFile(index)}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showNotify ? (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Gast benachrichtigen (Chat-Link)
          </p>
          <div
            className={cn(
              "flex items-center justify-between gap-3",
              !canWhatsapp && "opacity-50",
            )}
          >
            <Label
              htmlFor="msg-notify-wa"
              className="flex items-center gap-2 text-sm font-normal"
            >
              <WhatsAppGlyph className="text-[#25D366]" />
              WhatsApp
            </Label>
            <Switch
              id="msg-notify-wa"
              size="sm"
              checked={notifyWhatsapp}
              disabled={!canWhatsapp || disabled || sending}
              onCheckedChange={(v) => setNotifyWhatsapp(v === true)}
            />
          </div>
          <div
            className={cn(
              "flex items-center justify-between gap-3",
              !canEmail && "opacity-50",
            )}
          >
            <Label
              htmlFor="msg-notify-email"
              className="flex items-center gap-2 text-sm font-normal"
            >
              <Mail className="size-4" aria-hidden />
              E-Mail
            </Label>
            <Switch
              id="msg-notify-email"
              size="sm"
              checked={notifyEmail}
              disabled={!canEmail || disabled || sending}
              onCheckedChange={(v) => setNotifyEmail(v === true)}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Der Gast erhält einen Link mit PIN zum Gwada-Chat im Browser.
          </p>
        </div>
      ) : null}
      {showInboxChannelToggles ? (
        <div className="flex flex-wrap items-center gap-y-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2">
          <span className="mr-3 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Senden über
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {canWhatsapp ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="reply-wa"
                  size="sm"
                  checked={sendWhatsapp}
                  disabled={disabled || sending || onlyInboxWhatsapp}
                  onCheckedChange={(v) => setReplyWhatsapp(v === true)}
                />
                <Label
                  htmlFor="reply-wa"
                  className="flex cursor-pointer items-center gap-1.5 text-sm font-normal"
                >
                  <WhatsAppGlyph className="text-[#25D366]" />
                  WhatsApp
                </Label>
              </div>
            ) : null}
            {canEmail ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="reply-email"
                  size="sm"
                  checked={sendEmail}
                  disabled={disabled || sending || onlyInboxEmail}
                  onCheckedChange={(v) => setReplyEmail(v === true)}
                />
                <Label
                  htmlFor="reply-email"
                  className="flex cursor-pointer items-center gap-1.5 text-sm font-normal"
                >
                  <Mail className="size-4" aria-hidden />
                  E-Mail
                  {emailViaPlatformFallback ? (
                    <span className="text-[10px] text-muted-foreground">
                      (Gwada)
                    </span>
                  ) : null}
                </Label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {!isWhatsappOnly && !isEmailOnly && !isInboxReply ? (
      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isGwadaOnly ? "Nachricht auch senden über" : "Zusätzlich senden über"}
        </p>
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            !canWhatsapp && "opacity-50",
          )}
        >
          <Label
            htmlFor="msg-send-wa"
            className="flex items-center gap-2 text-sm font-normal"
          >
            <WhatsAppGlyph className="text-[#25D366]" />
            WhatsApp
          </Label>
          <Switch
            id="msg-send-wa"
            size="sm"
            checked={sendWhatsapp}
            disabled={!canWhatsapp || disabled || sending}
            onCheckedChange={(v) => setSendWhatsapp(v === true)}
          />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            !canEmail && "opacity-50",
          )}
        >
          <Label
            htmlFor="msg-send-email"
            className="flex items-center gap-2 text-sm font-normal"
          >
            <Mail className="size-4" aria-hidden />
            E-Mail
          </Label>
          <Switch
            id="msg-send-email"
            size="sm"
            checked={sendEmail}
            disabled={!canEmail || disabled || sending}
            onCheckedChange={(v) => setSendEmail(v === true)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {isGwadaOnly
            ? "Die Nachricht wird in Gwada gespeichert. Über die Schalter wird der vollständige Text zusätzlich per WhatsApp oder E-Mail versendet."
            : isInboxReply
              ? "Antwort nur über die gewählten Kanäle."
              : "In Gwada wird die Nachricht immer gespeichert. Optional zusätzlich per WhatsApp oder E-Mail — mit Reservierungskontext."}
        </p>
      </div>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-xl"
          disabled={disabled || sending}
          aria-label="Datei anhängen"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        <Button
          type="button"
          className="h-11 min-w-0 flex-1 gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={
            disabled ||
            sending ||
            !canSubmit ||
            (isWhatsappOnly && !canWhatsapp) ||
            (isEmailOnly && !canEmail) ||
            (isGwadaOnly && !gwadaSendEnabled) ||
            (isInboxReply && sendWhatsapp && !canWhatsapp) ||
            (isInboxReply && sendEmail && !canEmail) ||
            (isInboxReply && !sendWhatsapp && !sendEmail)
          }
          onClick={submit}
        >
          {isEmailOnly || (isInboxReply && sendEmail && !sendWhatsapp) ? (
            <Mail className="size-4" aria-hidden />
          ) : isWhatsappOnly || (isInboxReply && sendWhatsapp && !sendEmail) ? (
            <WhatsAppGlyph className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {sending
            ? "Senden …"
            : isEmailOnly || (isInboxReply && sendEmail && !sendWhatsapp)
              ? "E-Mail senden"
              : isWhatsappOnly ||
                  (isInboxReply && sendWhatsapp && !sendEmail)
                ? "WhatsApp senden"
                : "Senden"}
        </Button>
      </div>
    </div>
  );
}
