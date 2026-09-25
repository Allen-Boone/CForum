import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { apiFetch, formatDate, getSecurityHeaders, type Post, type Comment } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { renderMarkdownToHtml, highlightCodeBlocks, attachFancybox } from '@/lib/markdown';
import { Heart, MessageSquare, ArrowLeft, Pin, Trash2, Edit3, Smile, Paperclip, Bold, Italic, Heading, Quote, Code, FileCode, List, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

const QUICK_EMOJIS = ['😂', '👍', '🔥', '🚀', '❤️', '🎉', '☕', '💎', '💡', '😎', '🫡', '🤝', '🍺', '🥳', '💯'];

export function PostPage() {
	const token = getToken();
	const user = getUser();
	const [post, setPost] = React.useState<Post | null>(null);
	const [comments, setComments] = React.useState<Comment[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [replyContent, setReplyContent] = React.useState('');
	const [replying, setReplying] = React.useState(false);
	const [liked, setLiked] = React.useState(false);
	const [likeCount, setLikeCount] = React.useState(0);
	const [uploading, setUploading] = React.useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

	const replyTextareaRef = React.useRef<HTMLTextAreaElement>(null);
	const commentFileInputRef = React.useRef<HTMLInputElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);

	const urlParams = new URLSearchParams(window.location.search);
	const postId = urlParams.get('id');

	const loadPostData = React.useCallback(async () => {
		if (!postId) return;
		try {
			const [p, c] = await Promise.all([
				apiFetch<Post>(`/posts/${postId}`),
				apiFetch<Comment[]>(`/posts/${postId}/comments`)
			]);
			setPost(p);
			setLiked(Boolean(p.liked));
			setLikeCount(p.like_count || 0);
			setComments(c || []);
		} catch (e: any) {
			alert(e.message || '加载帖子失败');
		} finally {
			setLoading(false);
		}
	}, [postId]);

	React.useEffect(() => {
		loadPostData();
	}, [loadPostData]);

	React.useEffect(() => {
		if (contentRef.current) {
			highlightCodeBlocks(contentRef.current);
			return attachFancybox(contentRef.current);
		}
	}, [post?.content]);

	function insertMarkdownTag(prefix: string, suffix: string = '', defaultPlaceholder: string = '') {
		const textarea = replyTextareaRef.current;
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selectedText = replyContent.substring(start, end) || defaultPlaceholder;
		const replacement = `${prefix}${selectedText}${suffix}`;

		const updated = replyContent.substring(0, start) + replacement + replyContent.substring(end);
		setReplyContent(updated);

		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
		}, 10);
	}

	function handleInsertLink() {
		const text = prompt('请输入链接显示的文字：', '网页链接');
		if (!text) return;
		const url = prompt('请输入链接目标网址：', 'https://');
		if (!url) return;
		insertMarkdownTag(`[${text}](`, ')', url);
	}

	function handleInsertEmoji(emoji: string) {
		insertMarkdownTag('', emoji, '');
		setShowEmojiPicker(false);
	}

	async function uploadReplyImage(file: File) {
		setUploading(true);
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
				const isImg = file.type.startsWith('image/');
				const markdownInsert = isImg
					? `\n\n![${file.name || '图片'}](${data.url})\n\n`
					: `\n\n📎 [下载附件: ${file.name || '文件'}](${data.url})\n\n`;
				setReplyContent(prev => prev + markdownInsert);
			} else {
				alert('上传失败: ' + (data.error || '未知错误'));
			}
		} catch (err: any) {
			alert('上传异常: ' + err.message);
		} finally {
			setUploading(false);
		}
	}

	function handleReplyPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.indexOf('image') !== -1) {
				const file = items[i].getAsFile();
				if (file) {
					e.preventDefault();
					uploadReplyImage(file);
					return;
				}
			}
		}
	}

	async function handleLike() {
		if (!postId || !token) return;
		try {
			const res = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, {
				method: 'POST',
				headers: getSecurityHeaders('POST')
			});
			setLiked(res.liked);
			setLikeCount(prev => res.liked ? prev + 1 : prev - 1);
		} catch (_) {}
	}

	async function handleSubmitReply(e: React.FormEvent) {
		e.preventDefault();
		if (!replyContent.trim() || !postId) return;
		setReplying(true);
		try {
			await apiFetch(`/posts/${postId}/comments`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ content: replyContent.trim() })
			});
			setReplyContent('');
			loadPostData();
		} catch (err: any) {
			alert(err.message || '回帖失败');
		} finally {
			setReplying(false);
		}
	}

	async function handleDeleteComment(commentId: number) {
		if (!confirm('确定要删除这条回复吗？')) return;
		try {
			await apiFetch(`/comments/${commentId}`, {
				method: 'DELETE',
				headers: getSecurityHeaders('DELETE')
			});
			loadPostData();
		} catch (err: any) {
			alert('删除失败: ' + err.message);
		}
	}

	if (loading) {
		return (
			<PageShell>
				<div className="py-16 text-center text-gray-500 text-sm">正在加载帖子内容...</div>
			</PageShell>
		);
	}

	if (!post) {
		return (
			<PageShell>
				<div className="py-16 text-center text-gray-400 space-y-3">
					<p className="text-base font-bold text-white">帖子不存在或已被作者删除</p>
					<Button asChild size="sm" variant="outline"><a href="/">返回论坛首页</a></Button>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<div className="max-w-4xl mx-auto space-y-5">
				<div className="flex items-center justify-between">
					<Button asChild variant="ghost" size="sm" className="text-gray-400 hover:text-white -ml-2 text-xs">
						<a href="/"><ArrowLeft className="w-4 h-4 mr-1" /> 返回主题列表</a>
					</Button>
					<span className="text-xs text-gray-400 bg-[#161b22] px-2.5 py-1 rounded-full border border-[#30363d]">
						{post.category_name || '茶水间'}
					</span>
				</div>

				<div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4 shadow-sm">
					<h1 className="text-xl sm:text-2xl font-black text-white leading-snug tracking-tight">
						{post.title}
					</h1>

					<div className="flex items-center gap-3 border-b border-[#30363d] pb-4 text-xs text-gray-400 flex-wrap">
						<div className="flex items-center gap-2">
							<div className="w-7 h-7 rounded-full bg-[#21262d] flex items-center justify-center font-bold text-gray-300 border border-[#30363d] overflow-hidden">
								{post.author_avatar ? (
									<img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
								) : (
									<span>{(post.author_name || 'U').slice(0, 1)}</span>
								)}
							</div>
							<span className="font-bold text-gray-200">{post.author_name || '会员'}</span>
						</div>
						<span>•</span>
						<span>{formatDate(post.created_at)}</span>
						<span>•</span>
						<span>{post.view_count || 0} 次阅读</span>
					</div>

					{/* 帖子正文 Markdown 渲染 */}
					<div
						ref={contentRef}
						className="prose prose-invert max-w-none text-gray-200 text-sm leading-relaxed"
						dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.content) }}
					/>

					<div className="flex items-center justify-between border-t border-[#30363d] pt-4">
						<Button
							size="sm"
							variant="outline"
							onClick={handleLike}
							className={`text-xs h-8 border-[#30363d] ${liked ? 'text-rose-400 border-rose-500/50 bg-rose-500/10' : 'text-gray-300'}`}
						>
							<Heart className={`w-3.5 h-3.5 mr-1.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
							{liked ? '已点赞' : '点赞支持'} ({likeCount})
						</Button>
					</div>
				</div>

				{/* 评论区交流 */}
				<div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm">
					<div className="p-4 border-b border-[#30363d] flex items-center justify-between">
						<h3 className="font-bold text-sm text-white flex items-center gap-2">
							<MessageSquare className="w-4 h-4 text-blue-400" />
							交流讨论 ({comments.length})
						</h3>
					</div>

					<div className="divide-y divide-[#21262d]">
						{comments.length === 0 ? (
							<div className="p-8 text-center text-xs text-gray-500">
								暂无回帖，快在下方发表第一条评论吧！
							</div>
						) : (
							comments.map((cm, idx) => (
								<div key={cm.id} className="p-4 space-y-2 hover:bg-[#1c2128]/50 transition-colors">
									<div className="flex items-center justify-between text-xs">
										<div className="flex items-center gap-2">
											<span className="font-bold text-gray-300">{cm.username}</span>
											<span className="text-[11px] text-gray-500">#{idx + 1}楼</span>
											<span className="text-[11px] text-gray-500">• {formatDate(cm.created_at)}</span>
										</div>
										{(user?.role === 'admin' || user?.id === cm.author_id) && (
											<button
												onClick={() => handleDeleteComment(cm.id)}
												className="text-[11px] text-gray-500 hover:text-red-400"
											>
												删除
											</button>
										)}
									</div>
									<div
										className="text-xs text-gray-200 leading-relaxed pl-2 border-l border-gray-700/50"
										dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(cm.content) }}
									/>
								</div>
							))
						)}
					</div>

					{/* 评论富文本输入框与编辑工具条 */}
					{user ? (
						<form onSubmit={handleSubmitReply} className="p-4 bg-[#0d1117] border-t border-[#30363d] space-y-3">
							<div className="border border-[#30363d] rounded-md overflow-hidden bg-[#161b22]">
								{/* 评论编辑工具条 */}
								<div className="flex items-center gap-1 p-1.5 bg-[#1c2128] border-b border-[#30363d] flex-wrap text-gray-300 text-xs select-none">
									<div className="relative">
										<button
											type="button"
											onClick={() => setShowEmojiPicker(!showEmojiPicker)}
											title="插入表情"
											className="p-1 rounded hover:bg-[#21262d] hover:text-yellow-400 transition-colors"
										>
											<Smile className="w-4 h-4" />
										</button>
										{showEmojiPicker && (
											<div className="absolute top-8 left-0 z-30 bg-[#161b22] border border-[#30363d] p-2 rounded-lg shadow-xl grid grid-cols-5 gap-1.5 w-44">
												{QUICK_EMOJIS.map((em, i) => (
													<button
														key={i}
														type="button"
														onClick={() => handleInsertEmoji(em)}
														className="text-base p-1 hover:bg-[#21262d] rounded text-center transition-all"
													>
														{em}
													</button>
												))}
											</div>
										)}
									</div>

									<span className="w-[1px] h-3 bg-gray-700 mx-0.5" />

									<button
										type="button"
										onClick={() => insertMarkdownTag('**', '**', '加粗文本')}
										title="粗体"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<Bold className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('*', '*', '斜体')}
										title="斜体"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<Italic className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('### ', '', '小标题')}
										title="标题"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<Heading className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('> ', '', '引用')}
										title="引用"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<Quote className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('`', '`', 'code')}
										title="行内代码"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<Code className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('\n```\n', '\n```\n', '// 代码块')}
										title="代码块"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<FileCode className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={handleInsertLink}
										title="超链接"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<LinkIcon className="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onClick={() => commentFileInputRef.current?.click()}
										title="上传图片"
										className="p-1 rounded hover:bg-[#21262d] hover:text-white"
									>
										<ImageIcon className="w-3.5 h-3.5" />
									</button>
								</div>

								<textarea
									ref={replyTextareaRef}
									rows={4}
									onPaste={handleReplyPaste}
									placeholder="支持直接点击上方工具栏排版、截图直接 Ctrl+V 贴图..."
									value={replyContent}
									onChange={e => setReplyContent(e.target.value)}
									className="w-full bg-[#161b22] text-white text-xs p-3 outline-none leading-relaxed font-sans border-0 resize-y"
								/>
							</div>

							<div className="flex items-center justify-between flex-wrap gap-2">
								<div className="flex items-center gap-2">
									<input
										type="file"
										ref={commentFileInputRef}
										onChange={e => {
											const f = e.target.files?.[0];
											if (f) uploadReplyImage(f);
										}}
										className="hidden"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => commentFileInputRef.current?.click()}
										disabled={uploading}
										className="border-[#30363d] text-gray-400 text-xs h-7"
									>
										<Paperclip className="w-3 h-3 mr-1" />
										{uploading ? '上传中...' : '传图片'}
									</Button>
								</div>
								<Button type="submit" size="sm" disabled={replying} className="bg-blue-600 hover:bg-blue-700 text-xs h-7 px-4">
									{replying ? '发送中...' : '发表回复'}
								</Button>
							</div>
						</form>
					) : (
						<div className="p-4 text-center text-xs text-gray-400 border-t border-[#30363d]">
							请 <a href="/login" className="text-blue-400 hover:underline">登录</a> 后参与讨论
						</div>
					)}
				</div>
			</div>
		</PageShell>
	);
}
