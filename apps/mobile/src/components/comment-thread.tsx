import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { ErrorText } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { apiFetch } from '@/lib/api';

/**
 * Replies to a post, as pieces a screen can arrange.
 *
 * Threading is one level deep: a reply to a reply joins the same thread and
 * @-mentions the pet it answers rather than nesting, so the UI only ever draws
 * two levels. The server normalises that.
 *
 * Split into a hook, a list and a composer because the thread lives on a screen
 * now, where the composer should stay pinned to the bottom rather than scrolling
 * away with the conversation. Keeping them separate lets the screen decide,
 * without two copies of the state that both need.
 */

export type Comment = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  authoredByAgent: boolean;
  petId: string;
  petName: string;
  species: string;
  petAvatar: string | null;
  ownerName: string | null;
  ownerImage: string | null;
  replyToName: string | null;
  likeCount: number;
  likedByMe: boolean;
};

type Thread = Comment & { replies: Comment[] };
type ReplyTarget = { parentId: string; petId: string; petName: string } | null;

const liked = (c: Comment, next: boolean) => ({
  likedByMe: next,
  likeCount: Math.max(0, c.likeCount + (next ? 1 : -1)),
});

export function useCommentThread(postId: string | null, onCountChange?: (postId: string, total: number) => void) {
  const { t } = useT();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const r = await apiFetch<{ comments: Thread[]; total: number }>(`/api/posts/${postId}/comments`);
      setThreads(r.comments);
      onCountChange?.(postId, r.total);
    } catch {
      setError(t('post.reply.error.load'));
    }
  }, [postId, onCountChange]);

  useEffect(() => {
    if (!postId) return;
    setThreads(null);
    setError(null);
    setReplyTo(null);
    setDraft('');
    load();
  }, [postId, load]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !postId || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          ...(replyTo ? { parentId: replyTo.parentId, replyToPetId: replyTo.petId } : {}),
        }),
      });
      setDraft('');
      setReplyTo(null);
      await load();
    } catch {
      setError(t('post.reply.error.send'));
    }
    setSending(false);
  };

  const toggleLike = async (comment: Comment) => {
    // Optimistic: a like is cheap to undo and the wait is what makes it feel dead.
    const next = !comment.likedByMe;
    setThreads((prev) =>
      (prev ?? []).map((t) => ({
        ...t,
        ...(t.id === comment.id ? liked(t, next) : {}),
        replies: t.replies.map((r) => (r.id === comment.id ? { ...r, ...liked(r, next) } : r)),
      })),
    );
    try {
      await apiFetch(`/api/comments/${comment.id}/like`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      load();
    }
  };

  const total = threads?.reduce((n, t) => n + 1 + t.replies.length, 0) ?? 0;

  return { threads, error, draft, setDraft, replyTo, setReplyTo, sending, send, toggleLike, total, reload: load };
}

export type CommentThreadState = ReturnType<typeof useCommentThread>;

/** The conversation itself. */
export function CommentList({ state }: { state: CommentThreadState }) {
  const theme = useTheme();
  const { t } = useT();
  const { threads, error, toggleLike, setReplyTo } = state;

  return (
    <>
      <ErrorText message={error} />
      {!threads && !error && <ActivityIndicator color={theme.primaryPress} />}
      {threads?.length === 0 && (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {t('post.noReplies')}
        </ThemedText>
      )}
      {threads?.map((thread) => (
        <View key={thread.id} style={styles.thread}>
          <CommentRow
            comment={thread}
            onLike={toggleLike}
            onReply={() => setReplyTo({ parentId: thread.id, petId: thread.petId, petName: thread.petName })}
          />
          {thread.replies.map((reply) => (
            <View key={reply.id} style={styles.replyIndent}>
              <CommentRow
                comment={reply}
                onLike={toggleLike}
                onReply={() => setReplyTo({ parentId: thread.id, petId: reply.petId, petName: reply.petName })}
              />
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

/** The input. Pinned by the screen, so it doesn't scroll away mid-reply. */
export function CommentComposer({ state }: { state: CommentThreadState }) {
  const theme = useTheme();
  const { t } = useT();
  const { draft, setDraft, replyTo, setReplyTo, sending, send } = state;

  return (
    <View style={[styles.composer, { borderTopColor: theme.line, backgroundColor: theme.surface }]}>
      {replyTo && (
        <View style={styles.replyingTo}>
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {t('post.reply.replyingTo', { name: replyTo.petName })}
          </ThemedText>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel={t('post.a11y.cancelReply')}>
            <Icon name="close" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}
      <View style={styles.composerRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={
            replyTo ? t('post.reply.placeholderTo', { name: replyTo.petName }) : t('post.reply.placeholder')
          }
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={500}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={t('post.a11y.sendReply')}
          style={[
            styles.send,
            { backgroundColor: draft.trim() ? theme.primary : theme.backgroundElement, opacity: sending ? 0.6 : 1 },
          ]}>
          <Icon name="chevron" size={18} color={draft.trim() ? theme.onPrimary : theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function CommentRow({
  comment,
  onLike,
  onReply,
}: {
  comment: Comment;
  onLike: (c: Comment) => void;
  onReply: () => void;
}) {
  const theme = useTheme();
  const { t, timeAgo } = useT();
  const author = comment.authoredByAgent ? comment.petName : (comment.ownerName?.trim() || comment.petName);

  return (
    <View style={styles.row}>
      {comment.ownerImage && !comment.authoredByAgent ? (
        <Image source={{ uri: comment.ownerImage }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
          <CompanionArt species={comment.species} size={26} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.rowHead}>
          <ThemedText type="smallBold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {author}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {timeAgo(comment.createdAt)}
          </ThemedText>
        </View>
        <ThemedText>
          {comment.replyToName && (
            <ThemedText style={{ color: theme.primaryInk, fontFamily: FontFamily.bodyBold }}>
              @{comment.replyToName}{' '}
            </ThemedText>
          )}
          {comment.content}
        </ThemedText>
        <View style={styles.rowActions}>
          <Pressable onPress={() => onLike(comment)} hitSlop={8} style={styles.action} accessibilityLabel={t('post.a11y.likeReply')}>
            <Icon name="heart" size={15} color={comment.likedByMe ? theme.red : theme.textSecondary} />
            {comment.likeCount > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {comment.likeCount}
              </ThemedText>
            )}
          </Pressable>
          <Pressable onPress={onReply} hitSlop={8} accessibilityLabel={t('post.reply.action')}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('post.reply.action')}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: Spacing.xs },
  empty: { paddingVertical: Spacing.lg, textAlign: 'center' },
  thread: { gap: Spacing.md, marginBottom: Spacing.lg },
  replyIndent: { paddingLeft: Spacing.xl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm, gap: Spacing.xs },
  replyingTo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: FontFamily.body,
    fontSize: 15,
  },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
