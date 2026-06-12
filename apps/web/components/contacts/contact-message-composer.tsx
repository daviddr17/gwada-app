"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setWahaTypingClient } from "@/lib/contact-messages/waha-typing-client";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { CONTACT_MESSAGE_ATTACHMENT_MAX_FILES } from "@/lib/constants/contact-message-attachments";
import {
  ContactMessageVoiceRecorderBar,
  useContactVoiceRecorder,
} from "@/lib/hooks/use-contact-voice-recorder";
import { Mail, Mic, Paperclip, Send, X } from "lucide-react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  reservationNotifyRowLabelClassName,
  reservationNotifyRowMailIconClassName,
  reservationNotifyRowWhatsAppIconClassName,
} from "@/components/reservations/reservation-notify-toggle-styles";
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
  hasFacebook = false,
  hasInstagram = false,
  whatsappEnabled,
  emailEnabled,
  facebookEnabled = false,
  instagramEnabled = false,
  defaultSendWhatsapp,
  defaultSendEmail,
  defaultSendFacebook = false,
  defaultSendInstagram = false,
  onSend,
  placeholder = "Nachricht schreiben …",
  variant = "unified",
  whatsappTyping,
  stickyFooter = false,
  emailViaPlatformFallback = false,
  editWhatsappMessage = null,
  onEditWhatsapp,
  onCancelEditWhatsapp,
}: {
  disabled?: boolean;
  sending?: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasFacebook?: boolean;
  hasInstagram?: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  facebookEnabled?: boolean;
  instagramEnabled?: boolean;
  defaultSendWhatsapp?: boolean;
  defaultSendEmail?: boolean;
  defaultSendFacebook?: boolean;
  defaultSendInstagram?: boolean;
  onSend: (params: {
    body: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
    sendFacebook: boolean;
    sendInstagram: boolean;
    files?: File[];
    voiceNote?: File;
  }) => void | Promise<void>;
  placeholder?: string;
  /** `whatsapp-only` / `email-only` / `meta-only` / `inbox-reply` (ein Kanal). */
  variant?: "unified" | "whatsapp-only" | "email-only" | "meta-only" | "inbox-reply";
  /** WAHA: „tippt …“ an den Chat senden. */
  whatsappTyping?: { restaurantId: string; chatId: string } | null;
  /** Posteingang: ohne oberen Rand — Footer bringt die Trennlinie. */
  stickyFooter?: boolean;
  /** E-Mail ohne Restaurant-Postfach — Versand über Plattform-SMTP. */
  emailViaPlatformFallback?: boolean;
  /** WAHA: bestehende WhatsApp-Nachricht bearbeiten. */
  editWhatsappMessage?: { messageId: string; initialBody: string } | null;
  onEditWhatsapp?: (params: {
    messageId: string;
    body: string;
  }) => void | Promise<void>;
  onCancelEditWhatsapp?: () => void;
}) {
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingVoiceNote, setPendingVoiceNote] = useState<File | null>(null);
  const [pendingVoiceDuration, setPendingVoiceDuration] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const typingActiveRef = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sendWhatsapp, setSendWhatsapp] = useState(
    defaultSendWhatsapp ?? false,
  );
  const [sendEmail, setSendEmail] = useState(defaultSendEmail ?? false);
  const [sendFacebook, setSendFacebook] = useState(
    defaultSendFacebook ?? false,
  );
  const [sendInstagram, setSendInstagram] = useState(
    defaultSendInstagram ?? false,
  );
  const isEditMode = Boolean(editWhatsappMessage);

  const isWhatsappOnly = variant === "whatsapp-only";
  const isEmailOnly = variant === "email-only";
  const isMetaOnly = variant === "meta-only";
  const isInboxReply = variant === "inbox-reply";
  const canWhatsapp = isWhatsappOnly
    ? whatsappEnabled
    : whatsappEnabled && hasPhone;
  const canEmail = isEmailOnly ? emailEnabled : emailEnabled && hasEmail;
  const canFacebook = facebookEnabled && hasFacebook;
  const canInstagram = instagramEnabled && hasInstagram;

  useEffect(() => {
    if (!isInboxReply) return;
    setSendWhatsapp(defaultSendWhatsapp ?? false);
    setSendEmail(defaultSendEmail ?? false);
    setSendFacebook(defaultSendFacebook ?? false);
    setSendInstagram(defaultSendInstagram ?? false);
  }, [
    isInboxReply,
    defaultSendWhatsapp,
    defaultSendEmail,
    defaultSendFacebook,
    defaultSendInstagram,
  ]);

  useEffect(() => {
    if (!isInboxReply) return;
    const available = [
      canWhatsapp,
      canEmail,
      canFacebook,
      canInstagram,
    ].filter(Boolean).length;
    if (available !== 1) return;
    if (canWhatsapp) setSendWhatsapp(true);
    if (canEmail) setSendEmail(true);
    if (canFacebook) setSendFacebook(true);
    if (canInstagram) setSendInstagram(true);
  }, [isInboxReply, canWhatsapp, canEmail, canFacebook, canInstagram]);

  useEffect(() => {
    if (!editWhatsappMessage) return;
    setBody(editWhatsappMessage.initialBody);
    setPendingFiles([]);
    setPendingVoiceNote(null);
    setPendingVoiceDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [editWhatsappMessage?.messageId, editWhatsappMessage?.initialBody]);

  const inboxChannelCount = [
    canWhatsapp,
    canEmail,
    canFacebook,
    canInstagram,
  ].filter(Boolean).length;
  const onlyInboxWhatsapp =
    isInboxReply && canWhatsapp && inboxChannelCount === 1;
  const onlyInboxEmail = isInboxReply && canEmail && inboxChannelCount === 1;
  const onlyInboxFacebook =
    isInboxReply && canFacebook && inboxChannelCount === 1;
  const onlyInboxInstagram =
    isInboxReply && canInstagram && inboxChannelCount === 1;

  const resolveSendWhatsapp = () =>
    isWhatsappOnly
      ? true
      : isInboxReply
        ? sendWhatsapp && canWhatsapp
        : sendWhatsapp && canWhatsapp;

  const resolveSendEmail = () =>
    isEmailOnly
      ? true
      : isInboxReply
        ? sendEmail && canEmail
        : sendEmail && canEmail;

  const showVoice =
    !isEditMode &&
    (isMetaOnly ||
      (isInboxReply && (sendFacebook || sendInstagram)) ||
      (canWhatsapp &&
        (isWhatsappOnly ||
          (isInboxReply && sendWhatsapp) ||
          (!isWhatsappOnly &&
            !isEmailOnly &&
            !isMetaOnly &&
            !isInboxReply &&
            sendWhatsapp))));

  const setReplyWhatsapp = (on: boolean) => {
    if (onlyInboxWhatsapp) return;
    if (!on && !sendEmail && !sendFacebook && !sendInstagram) {
      if (canEmail) setSendEmail(true);
      else if (canFacebook) setSendFacebook(true);
      else if (canInstagram) setSendInstagram(true);
    }
    setSendWhatsapp(on);
  };

  const setReplyEmail = (on: boolean) => {
    if (onlyInboxEmail) return;
    setSendEmail(on);
    if (!on && !sendWhatsapp && !sendFacebook && !sendInstagram) {
      if (canWhatsapp) setSendWhatsapp(true);
      else if (canFacebook) setSendFacebook(true);
      else if (canInstagram) setSendInstagram(true);
    }
  };

  const setReplyFacebook = (on: boolean) => {
    if (onlyInboxFacebook) return;
    setSendFacebook(on);
    if (!on && !sendWhatsapp && !sendEmail && !sendInstagram) {
      if (canWhatsapp) setSendWhatsapp(true);
      else if (canEmail) setSendEmail(true);
      else if (canInstagram) setSendInstagram(true);
    }
  };

  const setReplyInstagram = (on: boolean) => {
    if (onlyInboxInstagram) return;
    setSendInstagram(on);
    if (!on && !sendWhatsapp && !sendEmail && !sendFacebook) {
      if (canWhatsapp) setSendWhatsapp(true);
      else if (canEmail) setSendEmail(true);
      else if (canFacebook) setSendFacebook(true);
    }
  };

  const canSubmit = isEditMode
    ? body.trim().length > 0
    : body.trim().length > 0 ||
      pendingFiles.length > 0 ||
      pendingVoiceNote != null;

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

  const voiceRecorder = useContactVoiceRecorder({
    enabled: showVoice && !disabled && !sending && !pendingVoiceNote,
    whatsappPresence: whatsappTyping,
    onVoiceReady: (file, durationSeconds) => {
      setPendingVoiceNote(file);
      setPendingVoiceDuration(durationSeconds);
    },
  });

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (isEditMode || !whatsappTyping) return;
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

  const canAttach = !disabled && !sending && !isEditMode;

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

  const cancelEdit = () => {
    setBody("");
    setPendingFiles([]);
    setPendingVoiceNote(null);
    setPendingVoiceDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCancelEditWhatsapp?.();
  };

  const submit = () => {
    const text = body.trim();
    if (isEditMode) {
      if (!text || !editWhatsappMessage || !onEditWhatsapp) return;
      stopWhatsappTyping();
      void onEditWhatsapp({
        messageId: editWhatsappMessage.messageId,
        body: text,
      });
      return;
    }
    if (!text && pendingFiles.length === 0 && !pendingVoiceNote) return;
    if (
      isInboxReply &&
      !sendWhatsapp &&
      !sendEmail &&
      !sendFacebook &&
      !sendInstagram
    ) {
      return;
    }
    if (
      pendingVoiceNote &&
      !resolveSendWhatsapp() &&
      !sendFacebook &&
      !sendInstagram &&
      !isMetaOnly
    ) {
      return;
    }
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
      sendFacebook: isInboxReply ? sendFacebook && canFacebook : false,
      sendInstagram: isInboxReply ? sendInstagram && canInstagram : false,
      files: pendingFiles.length > 0 ? pendingFiles : undefined,
      voiceNote: pendingVoiceNote ?? undefined,
    });
    setBody("");
    setPendingFiles([]);
    setPendingVoiceNote(null);
    setPendingVoiceDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const showInboxChannelToggles =
    !isEditMode &&
    isInboxReply &&
    (canWhatsapp || canEmail || canFacebook || canInstagram);

  const showMicIcon =
    showVoice &&
    voiceRecorder.canRecord &&
    !voiceRecorder.recording &&
    !pendingVoiceNote;

  const showRecorderBar = voiceRecorder.recording;

  return (
    <div
      className={cn(
        "min-w-0 space-y-2",
        !stickyFooter && "border-t border-border/50 pt-3",
      )}
    >
      {!isEditMode ? (
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
      ) : null}
      {isEditMode ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Nachricht bearbeiten</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled || sending}
            onClick={cancelEdit}
          >
            Abbrechen
          </Button>
        </div>
      ) : null}
      <div
        data-vaul-no-drag
        className={cn(
          "relative rounded-xl p-0.5 transition-[box-shadow,border-color]",
          !isEditMode && isDragOver && "ring-2 ring-inset ring-accent/80",
        )}
        onDragEnter={isEditMode ? undefined : handleDragEnter}
        onDragLeave={isEditMode ? undefined : handleDragLeave}
        onDragOver={isEditMode ? undefined : handleDragOver}
        onDrop={isEditMode ? undefined : handleDrop}
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
          placeholder={
            isEditMode ? "Nachricht bearbeiten …" : placeholder
          }
          rows={stickyFooter ? (isEditMode ? 3 : 2) : isEditMode ? 4 : 3}
          className={cn(
            "resize-y rounded-xl focus-visible:ring-inset",
            stickyFooter ? "min-h-[3.25rem]" : "min-h-[4.5rem]",
            isDragOver && "border-accent/50",
          )}
        />
      </div>
      {(pendingFiles.length > 0 || pendingVoiceNote) ? (
        <ul className="flex flex-wrap gap-1.5">
          {pendingVoiceNote ? (
            <li className="flex max-w-full items-center gap-1 rounded-lg border border-border/50 bg-muted/20 px-2 py-1 text-xs">
              <Mic className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">
                Sprachnachricht
                {pendingVoiceDuration > 0
                  ? ` · ${voiceRecorder.formatDuration(pendingVoiceDuration)}`
                  : null}
              </span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Sprachnachricht entfernen"
                onClick={() => {
                  setPendingVoiceNote(null);
                  setPendingVoiceDuration(0);
                }}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ) : null}
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
      {showRecorderBar ? (
        <ContactMessageVoiceRecorderBar
          recording={voiceRecorder.recording}
          seconds={voiceRecorder.seconds}
          onStop={voiceRecorder.stopRecording}
          onCancel={voiceRecorder.cancelRecording}
          formatDuration={voiceRecorder.formatDuration}
        />
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
                  className={cn(
                    reservationNotifyRowLabelClassName,
                    "cursor-pointer font-normal",
                  )}
                >
                  <WhatsAppGlyph
                    className={reservationNotifyRowWhatsAppIconClassName}
                  />
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
                  className={cn(
                    reservationNotifyRowLabelClassName,
                    "cursor-pointer font-normal",
                  )}
                >
                  <Mail
                    className={reservationNotifyRowMailIconClassName}
                    aria-hidden
                  />
                  E-Mail
                  {emailViaPlatformFallback ? (
                    <span className="text-[10px] text-muted-foreground">
                      (Gwada)
                    </span>
                  ) : null}
                </Label>
              </div>
            ) : null}
            {canFacebook ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="reply-fb"
                  size="sm"
                  checked={sendFacebook}
                  disabled={disabled || sending || onlyInboxFacebook}
                  onCheckedChange={(v) => setReplyFacebook(v === true)}
                />
                <Label
                  htmlFor="reply-fb"
                  className={cn(
                    reservationNotifyRowLabelClassName,
                    "cursor-pointer font-normal",
                  )}
                >
                  <FacebookGlyph className="size-4 shrink-0" />
                  Messenger
                </Label>
              </div>
            ) : null}
            {canInstagram ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="reply-ig"
                  size="sm"
                  checked={sendInstagram}
                  disabled={disabled || sending || onlyInboxInstagram}
                  onCheckedChange={(v) => setReplyInstagram(v === true)}
                />
                <Label
                  htmlFor="reply-ig"
                  className={cn(
                    reservationNotifyRowLabelClassName,
                    "cursor-pointer font-normal",
                  )}
                >
                  <InstagramGlyph className="size-4 shrink-0" />
                  Instagram
                </Label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {!isEditMode &&
      !isWhatsappOnly &&
      !isEmailOnly &&
      !isMetaOnly &&
      !isInboxReply ? (
      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Zusätzlich senden über
        </p>
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            !canWhatsapp && "opacity-50",
          )}
        >
          <Label
            htmlFor="msg-send-wa"
            className={cn(reservationNotifyRowLabelClassName, "font-normal")}
          >
            <WhatsAppGlyph
              className={reservationNotifyRowWhatsAppIconClassName}
            />
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
            className={cn(reservationNotifyRowLabelClassName, "font-normal")}
          >
            <Mail
              className={reservationNotifyRowMailIconClassName}
              aria-hidden
            />
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
          In Gwada wird die Nachricht immer gespeichert. Optional zusätzlich per
          WhatsApp oder E-Mail — mit Reservierungskontext.
        </p>
      </div>
      ) : null}
      <div className="flex gap-2">
        {!isEditMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              disabled={disabled || sending || voiceRecorder.recording}
              aria-label="Datei anhängen"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            {showMicIcon ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 rounded-xl"
                disabled={disabled || sending}
                aria-label="Sprachnachricht aufnehmen"
                onClick={() => void voiceRecorder.startRecording()}
              >
                <Mic className="size-4" />
              </Button>
            ) : null}
          </>
        ) : null}
        <Button
          type="button"
          className={cn(
            "h-11 min-w-0 flex-1 gap-2 ",
            brandActionButtonRoundedClassName,
          )}
          disabled={
            disabled ||
            sending ||
            voiceRecorder.recording ||
            !canSubmit ||
            (isEditMode
              ? false
              : isMetaOnly
                ? false
                : (isWhatsappOnly && !canWhatsapp) ||
                  (isEmailOnly && !canEmail) ||
                  (isInboxReply && sendWhatsapp && !canWhatsapp) ||
                  (isInboxReply && sendEmail && !canEmail) ||
                  (isInboxReply &&
                    !sendWhatsapp &&
                    !sendEmail &&
                    !sendFacebook &&
                    !sendInstagram))
          }
          onClick={submit}
        >
          {isEditMode ||
          isWhatsappOnly ||
          (isInboxReply && sendWhatsapp && !sendEmail) ? (
            <WhatsAppGlyph
              className={reservationNotifyRowWhatsAppIconClassName}
            />
          ) : isEmailOnly || (isInboxReply && sendEmail && !sendWhatsapp) ? (
            <Mail className="size-4" aria-hidden />
          ) : (
            <Send className="size-4" />
          )}
          {sending
            ? isEditMode
              ? "Ändern …"
              : "Senden …"
            : isEditMode
              ? "WhatsApp ändern"
              : isEmailOnly || (isInboxReply && sendEmail && !sendWhatsapp)
                ? "E-Mail senden"
                : isWhatsappOnly ||
                    (isInboxReply && sendWhatsapp && !sendEmail)
                  ? "WhatsApp senden"
                  : isMetaOnly
                    ? "Senden"
                    : "Senden"}
        </Button>
      </div>
    </div>
  );
}
