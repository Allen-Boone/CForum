import * as React from 'react';
import { ArrowLeft, Eye, Heart, Pin, Pencil, Reply, Shield, Trash2, X, MessageSquare, Image as ImageIcon, Smile, Send } from 'lucide-react';

import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, formatDate, getSecurityHeaders, type Category, type Comment, type Post } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { attachFancybox, highlightCodeBlocks, renderMarkdownToHtml } from '@/lib/markdown';
import { validateText } from '@/lib/validators';

const QUICK_EMOJIS = ['😀', '😂', '🤣', '😍', '😎', '🤔', '👍', '🔥', '🚀', '☕', '🍺', '🎉', '💯', '🫡', '😭', '🙏'];

const FULL_EMOJIS = [
	'😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌',
	'😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞',
	'🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '🤫', '🥱', '😴', '🤤',
	'🤡', '💩', '👻', '💀', '👽', '🤖', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🤝', '🙏',
	'🫡', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '👀', '🔥', '🚀', '⚡', '💻', '☕',
	'🍺', '🍻', '🍿', '🎮', '🏆', '💎', '👑', '💯', '🎉', '🎁', '💡', '📌', '🎯', '💰', '💸'
];

export function PostPage() {
	const token = getToken();
	const user = React.useMemo(() => getUser(), [token]);

	const [post, setPost] = React.useState<Post | null>(null);
	const [comments, setComments] = React.useState<Comment[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState('');

	const [newComment, setNewComment] = React.useState('');
	const [replyTo, setReplyTo] = React.useState<Comment | null>(null);
	const [commentLoading, setCommentLoading] = React.useState(false);
	const [commentError, setCommentError] = React.useState('');

	const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
	const [uploadingImage, setUploadingImage] = React.useState(false);

	const [isEditing, setIsEditing] = React.useState(false);
	const [editTitle, setEditTitle] = React.useState('');
	const [editContent, setEditContent] = React.useState('');
	const [editLoading, setEditLoading] = React.useState(false);
	const [editError, setEditError] = React.useState('');

	const contentRef = React.useRef<HTMLDivElement | null>(null);
	const commentInputRef = React.useRef<HTMLTextAreaElement | null>(null);
	const fileInputRef = React.useRef<HTMLInputElement | null>(null);

	function getPostIdFromPath() {
		const params = new URLSearchParams(window.location.search);
		const q = params.get('id') || params.get('post_id');
		if (q && /^\d+$/.test(q)) return q;
		const m = window.location.pathname.match(/^\/posts\/(\d+)$/);
		if (m) return m[1];
		const m2 = window.location.pathname.match(/^\/post\/(\d+)$/);
		return m2 ? m2[1] : null;
	}

	const postId = getPostIdFromPath();

	const refresh = React.useCallback(async () => {
		if (!postId) {
			setError('帖子不存在');
			setLoading(false);
			return;
		}
		setLoading(true);
		setError('');
		try {
			const p = await apiFetch<Post>(`/posts/${postId}`);
			const cs = await apiFetch<Comment[]>(`/posts/${postId}/comments`);
			setPost(p);
			setComments(cs);
			setEditTitle(p.title);
			setEditContent(p.content);
		} catch (e: any) {
			setError(String(e?.message || e));
		} finally {
			setLoading(false);
		}
	}, [postId]);

	React.useEffect(() => {
		refresh();
	}, [refresh]);

	React.useEffect(() => {
		const el = contentRef.current;
		if (!el) return;
		highlightCodeBlocks(el);
		const cleanup = attachFancybox(el);
		return cleanup;
	}, [post, comments.length, isEditing]);

	// 一键插入表情至评论框光标处
	function insertEmoji(emoji: string) {
		const textarea = commentInputRef.current;
		if (textarea) {
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const text = newComment;
			const updated = text.substring(0, start) + emoji + text.substring(end);
			setNewComment(updated);
			setTimeout(() => {
				textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
				textarea.focus();
			}, 0);
		} else {
			setNewComment(prev => prev + emoji);
		}
	}

	// 评论框支持上传与粘贴表情包图片
	async function uploadCommentImage(file: File) {
		setUploadingImage(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('https://cforum.day86530.workers.dev/api/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			});
			const data = await res.json() as any;
			if (data.url) {
				const tag = `\n\n![表情包](${data.url})\n\n`;
				setNewComment(prev => prev + tag);
			} else {
				alert('图片上传失败：' + (data.error || '未知错误'));
			}
		} catch (e: any) {
			alert('上传异常: ' + e.message);
		} finally {
			setUploadingImage(false);
		}
	}

	function handleCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.indexOf('image') !== -1) {
				const file = items[i].getAsFile();
				if (file) {
					e.preventDefault();
					uploadCommentImage(file);
					return;
				}
			}
		}
	}

	async function toggleLike() {
		if (!post) return;
		if (!user) {
			window.location.href = '/login';
			return;
		}
		try {
			const data = await apiFetch<{ liked: boolean }>(`/posts/${post.id}/like`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({})
			});
			setPost(prev => prev ? {
				...prev,
				liked: data.liked,
				like_count: (prev.like_count || 0) + (data.liked ? 1 : -1)
			} : prev);
		} catch {
			return;
		}
	}

	async function submitComment(e: React.FormEvent) {
		e.preventDefault();
		if (!postId) return;
		if (!user) {
			window.location.href = '/login';
			return;
		}
		setCommentError('');
		const err = validateText(newComment, '评论');
		if (err) return setCommentError(err);

		setCommentLoading(true);
		try {
			await apiFetch(`/posts/${postId}/comments`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					content: newComment,
					parent_id: replyTo ? replyTo.id : null
				})
			});
			setNewComment('');
			setReplyTo(null);
			setShowEmojiPicker(false);
			await refresh();
		} catch (e: any) {
			setCommentError(String(e?.message || e));
		} finally {
			setCommentLoading(false);
		}
	}

	async function deleteComment(id: number) {
		if (!confirm('确定要删除此评论吗？')) return;
		try {
			await apiFetch(`/comments/${id}`, {
				method: 'DELETE',
				headers: getSecurityHeaders('DELETE')
			});
			await refresh();
		} catch (e: any) {
			alert(String(e?.message || e));
		}
	}

	async function deletePost() {
		if (!post) return;
		if (!confirm('确定要删除这个帖子吗？此操作无法撤销。')) return;
		try {
			await apiFetch(`/posts/${post.id}`, {
				method: 'DELETE',
				headers: getSecurityHeaders('DELETE')
			});
			window.location.href = '/';
		} catch (e: any) {
			alert(String(e?.message || e));
		}
	}

	async function togglePin() {
		if (!post) return;
		if (!user || user.role !== 'admin') return;
		try {
			await apiFetch(`/posts/${post.id}/pin`, {
				method: 'POST',
				headers: getSecurityHeaders('POST')
			});
			setPost(prev => prev ? { ...prev, is_pinned: prev.is_pinned ? 0 : 1 } : prev);
		} catch {
			return;
		}
	}

	async function saveEdit() {
		if (!post) return;
		setEditError('');
		const titleErr = validateText(editTitle, '标题');
		if (titleErr) return setEditError(titleErr);
		const contentErr = validateText(editContent, '内容');
		if (contentErr) return setEditError(contentErr);

		setEditLoading(true);
		try {
			await apiFetch(`/posts/${post.id}`, {
				method: 'PUT',
				headers: getSecurityHeaders('PUT'),
				body: JSON.stringify({ title: editTitle, content: editContent, category_id: post.category_id })
			});
			setIsEditing(false);
			await refresh();
		} catch (e: any) {
			setEditError(String(e?.message || e));
		} finally {
			setEditLoading(false);
		}
	}

	return (
		<PageShell>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Button asChild variant="ghost" size="sm" className="text-gray-400 hover:text-white">
						<a href="/" className="flex items-center gap-1.5 text-xs">
							<ArrowLeft className="h-4 w-4" />
							<span>返回自由论坛首页</span>
						</a>
					</Button>
				</div>

				{error ? <div className="rounded-md border border-red-800 bg-red-950/40 p-3 text-xs text-red-300">{error}</div> : null}

				{loading ? (
					<Card className="bg-[#161b22] border-[#30363d]"><CardContent className="py-12 text-center text-xs text-gray-400">正在载入讨论内容...</CardContent></Card>
				) : !post ? (
					<Card className="bg-[#161b22] border-[#30363d]"><CardContent className="py-12 text-center text-xs text-gray-400">帖子不存在或已被作者删除</CardContent></Card>
				) : (
					<>
						{/* 帖子主体卡片 */}
						<Card className="bg-[#161b22] border-[#30363d] text-white">
							<CardHeader className="border-b border-[#21262d] pb-4">
								<CardTitle className="space-y-2">
									<div className="flex items-center gap-2 flex-wrap text-xl font-bold">
										{post.is_pinned === 1 && <span className="bg-[#b35900] text-white text-xs font-bold px-2 py-0.5 rounded">置顶</span>}
										<span className={post.is_pinned === 1 ? 'text-[#ff7b72]' : 'text-white'}>{post.title}</span>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 font-normal">
										<span className="font-semibold text-gray-200">{post.author_name || '会员'}</span>
										<span>•</span>
										<span>{formatDate(post.created_at)}</span>
										<span>•</span>
										<span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {post.view_count || 1} 浏览</span>
									</div>
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-5 space-y-5">
								{isEditing ? (
									<div className="space-y-3">
										{editError && <div className="text-xs text-red-400">{editError}</div>}
										<Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-[#0d1117] border-[#30363d] text-white" />
										<Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={8} className="bg-[#0d1117] border-[#30363d] text-white font-mono text-xs" />
										<div className="flex gap-2">
											<Button size="sm" onClick={saveEdit} disabled={editLoading} className="bg-blue-600 text-xs">
												{editLoading ? '保存中...' : '保存修改'}
											</Button>
											<Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-xs text-gray-400">取消</Button>
										</div>
									</div>
								) : (
									<div
										ref={contentRef}
										className="prose prose-invert max-w-none text-sm text-gray-200 leading-relaxed font-sans"
										dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.content) }}
									/>
								)}

								{/* 底部操作条：点赞、编辑、置顶、删除 */}
								<div className="flex items-center justify-between pt-4 border-t border-[#21262d] text-xs">
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={toggleLike}
											className={`h-7 px-3 border-[#30363d] ${post.liked ? 'text-rose-400 border-rose-500/40 bg-rose-500/10' : 'text-gray-300'}`}
										>
											<Heart className={`w-3.5 h-3.5 mr-1 ${post.liked ? 'fill-current' : ''}`} />
											{post.like_count || 0} 点赞
										</Button>
									</div>

									<div className="flex items-center gap-3">
										{(user?.id === post.author_id || user?.role === 'admin') && !isEditing && (
											<button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-white flex items-center gap-1">
												<Pencil className="w-3.5 h-3.5" /> 编辑
											</button>
										)}
										{user?.role === 'admin' && (
											<button onClick={togglePin} className="text-amber-400 hover:underline flex items-center gap-1">
												<Pin className="w-3.5 h-3.5" /> {post.is_pinned === 1 ? '取消置顶' : '置顶'}
											</button>
										)}
										{(user?.id === post.author_id || user?.role === 'admin') && (
											<button onClick={deletePost} className="text-red-400 hover:underline flex items-center gap-1">
												<Trash2 className="w-3.5 h-3.5" /> 删除
											</button>
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* 评论交流列表 */}
						<Card className="bg-[#161b22] border-[#30363d] text-white">
							<CardHeader className="border-b border-[#21262d] py-3.5 px-4 flex flex-row items-center justify-between">
								<CardTitle className="text-sm font-bold flex items-center gap-2">
									<MessageSquare className="w-4 h-4 text-blue-400" />
									交流讨论 ({comments.length})
								</CardTitle>
							</CardHeader>
							<CardContent className="p-0 divide-y divide-[#21262d]">
								{comments.length === 0 ? (
									<div className="py-8 text-center text-xs text-gray-500">暂无评论，快来抢占一楼沙发！</div>
								) : (
									comments.map((c, idx) => (
										<div key={c.id} className="p-4 hover:bg-[#1a202c]/40 transition-colors space-y-2">
											<div className="flex items-center justify-between text-xs text-gray-400">
												<div className="flex items-center gap-2">
													<div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-[10px] overflow-hidden">
														{c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : c.username.slice(0, 1).toUpperCase()}
													</div>
													<span className="font-semibold text-gray-200">{c.username}</span>
													{c.role === 'admin' && <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 text-[10px] px-1 rounded">站长</span>}
													<span>•</span>
													<span>{formatDate(c.created_at)}</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-gray-500">#{idx + 1}</span>
													<button onClick={() => setReplyTo(c)} className="hover:text-blue-400 flex items-center gap-0.5">
														<Reply className="w-3 h-3" /> 回复
													</button>
													{(user?.id === c.author_id || user?.role === 'admin') && (
														<button onClick={() => deleteComment(c.id)} className="hover:text-red-400">
															<Trash2 className="w-3 h-3" />
														</button>
													)}
												</div>
											</div>
											<div
												className="prose prose-invert max-w-none text-xs text-gray-300 pl-8 leading-relaxed"
												dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(c.content) }}
											/>
										</div>
									))
								)}
							</CardContent>
						</Card>

						{/* 核心升级：带有高频表情栏 + 展开百款表情库 + 支持图片粘贴的回帖框 */}
						<Card className="bg-[#161b22] border-[#30363d] text-white">
							<CardHeader className="py-3 px-4 border-b border-[#21262d]">
								<CardTitle className="text-xs text-gray-300 flex items-center justify-between">
									<span>{replyTo ? `正在回复 @${replyTo.username}` : '参与讨论发表你的观点'}</span>
									{replyTo && (
										<button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white flex items-center gap-1">
											<X className="w-3 h-3" /> 取消回复
										</button>
									)}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 space-y-3">
								{commentError && <div className="text-xs text-red-400">{commentError}</div>}

								<form onSubmit={submitComment} className="space-y-2.5">
									<Textarea
										ref={commentInputRef}
										value={newComment}
										onChange={(e) => setNewComment(e.target.value)}
										onPaste={handleCommentPaste}
										rows={4}
										placeholder={replyTo ? `回复 @${replyTo.username}...` : '写下你的评论（支持表情、支持截图直接按 Ctrl+V 粘贴、支持 Markdown）...'}
										className="bg-[#0d1117] border-[#30363d] text-white text-xs leading-relaxed outline-none focus:border-blue-500"
									/>

									{/* 展开的百款全量表情选择器 */}
									{showEmojiPicker && (
										<div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 shadow-xl max-h-48 overflow-y-auto">
											<div className="text-[11px] text-gray-400 font-bold mb-1.5 flex items-center justify-between">
												<span>选择表情包直接插入：</span>
												<button type="button" onClick={() => setShowEmojiPicker(false)} className="text-gray-500 hover:text-white">✕</button>
											</div>
											<div className="grid grid-cols-8 sm:grid-cols-12 gap-1 text-lg">
												{FULL_EMOJIS.map((emoji, i) => (
													<button
														key={i}
														type="button"
														onClick={() => insertEmoji(emoji)}
														className="h-8 w-8 hover:bg-[#21262d] rounded flex items-center justify-center transition-colors"
													>
														{emoji}
													</button>
												))}
											</div>
										</div>
									)}

									{/* 回帖工具栏（精准填补你截图里的空白区域） */}
									<div className="flex flex-wrap items-center justify-between gap-2 pt-1">
										{/* 左侧：快捷常用表情 + 更多表情按钮 + 传图按钮 */}
										<div className="flex flex-wrap items-center gap-1 text-base">
											{QUICK_EMOJIS.slice(0, 10).map((emoji, i) => (
												<button
													key={i}
													type="button"
													onClick={() => insertEmoji(emoji)}
													className="hover:scale-125 transition-transform p-0.5 select-none"
													title={`点击插入 ${emoji}`}
												>
													{emoji}
												</button>
											))}

											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => setShowEmojiPicker(!showEmojiPicker)}
												className="text-xs text-sky-400 hover:text-sky-300 h-6 px-1.5 ml-1 font-semibold"
											>
												<Smile className="w-3.5 h-3.5 mr-1" />
												更多表情
											</Button>

											<input
												type="file"
												ref={fileInputRef}
												onChange={(e) => {
													const f = e.target.files?.[0];
													if (f) uploadCommentImage(f);
												}}
												accept="image/*"
												className="hidden"
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => fileInputRef.current?.click()}
												disabled={uploadingImage}
												className="text-xs text-gray-400 hover:text-white h-6 px-1.5"
											>
												<ImageIcon className="w-3.5 h-3.5 mr-1" />
												{uploadingImage ? '传图中' : '发图'}
											</Button>
										</div>

										{/* 右侧：提交按钮 */}
										<div className="flex items-center gap-2">
											<Button
												type="submit"
												size="sm"
												disabled={commentLoading}
												className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-7 px-4"
											>
												<Send className="w-3 h-3 mr-1" />
												{commentLoading ? '发布中...' : '发布评论'}
											</Button>
											{!user && (
												<Button type="button" size="sm" variant="outline" onClick={() => (window.location.href = '/login')} className="text-xs h-7 border-gray-700">
													登录后评论
												</Button>
											)}
										</div>
									</div>
								</form>
							</CardContent>
						</Card>
					</>
				)}
			</div>
		</PageShell>
	);
}
