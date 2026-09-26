import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { apiFetch, formatDate, getSecurityHeaders, type Post, type Comment } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { renderMarkdownToHtml, highlightCodeBlocks, attachFancybox } from '@/lib/markdown';
import { Heart, MessageSquare, ArrowLeft, Pin, Trash2, Smile, Paperclip, Bold, Italic, Heading, Quote, Code, FileCode, List, Link as LinkIcon, Image as ImageIcon, Send, Pencil, X, Save } from 'lucide-react';

const QUICK_EMOJIS = ['😂', '👍', '🔥', '🚀', '❤️', '🎉', '☕', '💎', '💡', '😎', '🫡', '🤝', '🍺', '🥳', '💯', '✨', '👏', '👀', '🤯', '💪'];

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

	const [editOpen, setEditOpen] = React.useState(false);
	const [editTitle, setEditTitle] = React.useState('');
	const [editContent, setEditContent] = React.useState('');
	const [editCategoryId, setEditCategoryId] = React.useState('1');
	const [editCategories, setEditCategories] = React.useState<
		Array<{ id: number; name: string }>
	>([]);
	const [editSaving, setEditSaving] = React.useState(false);

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

	React.useEffect(() => {
		if (!post) return;

		document.title = `${post.title} - 自由论坛`;

		const summary = String(post.content || '')
			.replace(/[#>*_`\[\]()!]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 150);

		let description = document.querySelector(
			'meta[name="description"]'
		) as HTMLMetaElement | null;

		if (!description) {
			description = document.createElement('meta');
			description.name = 'description';
			document.head.appendChild(description);
		}
		description.content = summary || '自由论坛公开主题内容';

		let robots = document.querySelector(
			'meta[name="robots"]'
		) as HTMLMetaElement | null;

		if (!robots) {
			robots = document.createElement('meta');
			robots.name = 'robots';
			document.head.appendChild(robots);
		}

		robots.content =
			Number(post.is_public || 0) === 1 &&
			Number(post.allow_index || 0) === 1
				? 'index,follow'
				: 'noindex,nofollow';

		let canonical = document.querySelector(
			'link[rel="canonical"]'
		) as HTMLLinkElement | null;

		if (!canonical) {
			canonical = document.createElement('link');
			canonical.rel = 'canonical';
			document.head.appendChild(canonical);
		}

		canonical.href =
			`https://blog.t20.de5.net/post?id=${post.id}`;
	}, [post]);

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

	async function openPostEditor() {
		if (!post || !user) return;

		const canEdit =
			user.role === 'admin' ||
			user.id === post.author_id;

		if (!canEdit) {
			alert('您没有权限编辑该帖子');
			return;
		}

		setEditTitle(post.title || '');
		setEditContent(post.content || '');
		setEditCategoryId(
			String(post.category_id || 1)
		);

		try {
			const categories = await apiFetch<
				Array<{ id: number; name: string }>
			>('/categories');

			setEditCategories(categories || []);
			setEditOpen(true);
		} catch (err: any) {
			alert(
				'读取板块失败：' +
					(err.message || '未知错误')
			);
		}
	}

	async function handleSavePostEdit(
		event: React.FormEvent
	) {
		event.preventDefault();

		if (!post || !user || editSaving) return;

		const title = editTitle.trim();
		const content = editContent.trim();
		const categoryId = Number(editCategoryId);

		if (!title) {
			alert('帖子标题不能为空');
			return;
		}

		if (!content) {
			alert('帖子正文不能为空');
			return;
		}

		if (title.length > 120) {
			alert('帖子标题不能超过 120 个字符');
			return;
		}

		if (!Number.isInteger(categoryId)) {
			alert('请选择有效的板块');
			return;
		}

		if (
			categoryId === 9 &&
			user.role !== 'admin'
		) {
			alert('公告板块仅限站长操作');
			return;
		}

		setEditSaving(true);

		try {
			await apiFetch(`/posts/${post.id}`, {
				method: 'PUT',
				headers: getSecurityHeaders('PUT'),
				body: JSON.stringify({
					title,
					content,
					category_id: categoryId
				})
			});

			setEditOpen(false);
			await loadPostData();
			alert('帖子修改成功');
		} catch (err: any) {
			alert(
				'修改失败：' +
					(err.message || '未知错误')
			);
		} finally {
			setEditSaving(false);
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
			<div className="max-w-4xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<Button asChild variant="ghost" size="sm" className="text-gray-400 hover:text-white -ml-2 text-xs">
						<a href="/"><ArrowLeft className="w-4 h-4 mr-1" /> 返回主题列表</a>
					</Button>
					<span className="text-xs text-gray-400 bg-[#161b22] px-3 py-1 rounded-full border border-[#30363d]">
						{post.category_name || '茶水间'}
					</span>
				</div>

				{/* 帖子正文区 */}
				<div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 sm:p-7 space-y-5 shadow-sm">
					<h1 className="text-2xl sm:text-3xl font-black text-white leading-snug tracking-tight">
						{post.title}
					</h1>

					<div className="flex items-center gap-3 border-b border-[#30363d] pb-4 text-xs text-gray-400 flex-wrap">
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 rounded-full bg-[#21262d] flex items-center justify-center font-bold text-gray-300 border border-[#30363d] overflow-hidden">
								{post.author_avatar ? (
									<img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
								) : (
									<span>{(post.author_name || 'U').slice(0, 1)}</span>
								)}
							</div>
							<span className="font-bold text-gray-200 text-sm">{post.author_name || '会员'}</span>
						</div>
						<span>•</span>
						<span>{formatDate(post.created_at)}</span>
						<span>•</span>
						<span>{post.view_count || 0} 次阅读</span>
					</div>

					<div
						ref={contentRef}
						className="prose prose-invert max-w-none text-gray-200 text-[15px] leading-relaxed"
						dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(post.content) }}
					/>

					{!user && (
						<div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
							您正在以游客只读模式浏览公开内容。登录后可以点赞、回复、发帖和私聊。
							<div className="mt-2 flex gap-3">
								<a href="/login" className="text-sky-300 font-bold hover:underline">登录</a>
								<a href="/register" className="text-emerald-300 font-bold hover:underline">免费注册</a>
							</div>
						</div>
					)}

					<div className="flex items-center justify-between border-t border-[#30363d] pt-4 gap-3 flex-wrap">
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={handleLike}
							disabled={!user}
							className={`text-xs h-8 border-[#30363d] ${liked ? 'text-rose-400 border-rose-500/50 bg-rose-500/10' : 'text-gray-300'}`}
						>
							<Heart className={`w-3.5 h-3.5 mr-1.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
							{liked ? '已点赞' : '点赞支持'} ({likeCount})
							</Button>

							{user &&
								(user.role === 'admin' ||
									user.id === post.author_id) && (
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={openPostEditor}
										className="text-xs h-8 border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
									>
										<Pencil className="w-3.5 h-3.5 mr-1.5" />
										编辑帖子
									</Button>
								)}
						</div>
					</div>
				</div>

				{/* 评论区交流 */}
				<div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm">
					<div className="p-4 sm:p-5 border-b border-[#30363d] flex items-center justify-between">
						<h3 className="font-bold text-base text-white flex items-center gap-2">
							<MessageSquare className="w-4 h-4 text-blue-400" />
							交流讨论 ({comments.length})
						</h3>
					</div>

					<div className="divide-y divide-[#21262d]">
						{comments.length === 0 ? (
							<div className="py-12 text-center text-xs text-gray-500">
								🕊️ 暂无回帖，快在下方发表第一条真知灼见吧！
							</div>
						) : (
							comments.map((cm, idx) => (
								<div key={cm.id} className="p-4 sm:p-5 space-y-2.5 hover:bg-[#1c2128]/50 transition-colors">
									<div className="flex items-center justify-between text-xs">
										<div className="flex items-center gap-2">
											<span className="font-bold text-gray-200 text-sm">{cm.username}</span>
											<span className="text-[11px] text-gray-500">#{idx + 1}楼</span>
											<span className="text-[11px] text-gray-500">• {formatDate(cm.created_at)}</span>
										</div>
										{(user?.role === 'admin' || user?.id === cm.author_id) && (
											<button
												onClick={() => handleDeleteComment(cm.id)}
												className="text-[11px] text-gray-500 hover:text-red-400 transition-colors"
											>
												删除
											</button>
										)}
									</div>
									<div
										className="text-[14px] text-gray-200 leading-relaxed pl-2.5 border-l-2 border-gray-700/60"
										dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(cm.content) }}
									/>
								</div>
							))
						)}
					</div>

					{/* 核心重构：大气宽敞、极具呼吸感的富文本回复框架 */}
					{user ? (
						<form onSubmit={handleSubmitReply} className="p-5 sm:p-6 bg-[#0d1117] border-t border-[#30363d] space-y-3.5">
							<div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#161b22] focus-within:border-blue-500/80 transition-colors shadow-inner">
								{/* 宽敞大气的顶层工具条 */}
								<div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#1c2128] border-b border-[#30363d] flex-wrap text-gray-300 text-xs select-none">
									<div className="relative">
										<button
											type="button"
											onClick={() => setShowEmojiPicker(!showEmojiPicker)}
											title="插入表情"
											className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-yellow-400 transition-all flex items-center gap-1"
										>
											<Smile className="w-4 h-4 text-yellow-500" />
											<span className="text-[11px] text-gray-400 hidden sm:inline">表情</span>
										</button>
										{showEmojiPicker && (
											<div className="absolute top-10 left-0 z-30 bg-[#161b22] border border-[#30363d] p-3 rounded-xl shadow-2xl grid grid-cols-5 gap-2 w-52 animate-in fade-in zoom-in-95 duration-150">
												{QUICK_EMOJIS.map((em, i) => (
													<button
														key={i}
														type="button"
														onClick={() => handleInsertEmoji(em)}
														className="text-lg p-1.5 hover:bg-[#21262d] rounded-lg text-center transition-all hover:scale-125"
													>
														{em}
													</button>
												))}
											</div>
										)}
									</div>

									<span className="w-[1px] h-4 bg-gray-700/80 mx-1" />

									<button
										type="button"
										onClick={() => insertMarkdownTag('**', '**', '加粗文字')}
										title="粗体 (Ctrl+B)"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all font-bold"
									>
										<Bold className="w-4 h-4" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('*', '*', '斜体文字')}
										title="斜体 (Ctrl+I)"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all italic"
									>
										<Italic className="w-4 h-4" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('### ', '', '小标题')}
										title="段落大标题"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all"
									>
										<Heading className="w-4 h-4" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('> ', '', '引用观点')}
										title="引用内容"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all"
									>
										<Quote className="w-4 h-4" />
									</button>

									<span className="w-[1px] h-4 bg-gray-700/80 mx-1" />

									<button
										type="button"
										onClick={() => insertMarkdownTag('`', '`', 'code')}
										title="行内代码"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all font-mono"
									>
										<Code className="w-4 h-4" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('\n```\n', '\n```\n', '// 粘贴多行代码')}
										title="插入代码块"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all"
									>
										<FileCode className="w-4 h-4" />
									</button>

									<button
										type="button"
										onClick={() => insertMarkdownTag('- ', '', '列表项')}
										title="无序列表"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all"
									>
										<List className="w-4 h-4" />
									</button>

									<span className="w-[1px] h-4 bg-gray-700/80 mx-1" />

									<button
										type="button"
										onClick={handleInsertLink}
										title="插入链接"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all"
									>
										<LinkIcon className="w-4 h-4" />
									</button>

									<button
										type="button"
										onClick={() => commentFileInputRef.current?.click()}
										title="上传图片/附件"
										className="p-1.5 rounded-md hover:bg-[#282e38] hover:text-white transition-all flex items-center gap-1"
									>
										<ImageIcon className="w-4 h-4 text-emerald-400" />
										<span className="text-[11px] text-gray-400 hidden sm:inline">传图</span>
									</button>
								</div>

								{/* 高度加深至 150px、字体 14px、从容舒适的输入区 */}
								<textarea
									ref={replyTextareaRef}
									rows={6}
									onPaste={handleReplyPaste}
									placeholder="在此写下您的真知灼见（支持上方工具栏排版、截图后直接 Ctrl + V 秒贴图片）..."
									value={replyContent}
									onChange={e => setNewContent ? undefined : setReplyContent(e.target.value)}
									className="w-full bg-[#161b22] text-gray-100 text-[14px] p-4 outline-none leading-relaxed font-sans border-0 resize-y min-h-[140px]"
								/>
							</div>

							<div className="flex items-center justify-between flex-wrap gap-3 pt-1">
								<div className="flex items-center gap-3">
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
										className="border-[#30363d] text-gray-300 hover:text-white text-xs h-8 px-3"
									>
										<Paperclip className="w-3.5 h-3.5 mr-1" />
										{uploading ? '上传中...' : '上传附件图片'}
									</Button>
									<span className="text-[11px] text-gray-500 hidden sm:inline">
										💡 极客技巧：截图后直接在输入框按 <strong>Ctrl + V</strong> 即可秒贴图片
									</span>
								</div>

								<Button
									type="submit"
									size="sm"
									disabled={replying || !replyContent.trim()}
									className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8 px-6 shadow-md transition-all active:scale-95"
								>
									<Send className="w-3.5 h-3.5 mr-1.5" />
									{replying ? '发送中...' : '发表精彩回复'}
								</Button>
							</div>
						</form>
					) : (
						<div className="p-8 text-center text-xs text-gray-400 border-t border-[#30363d] bg-[#0d1117]">
							请 <a href="/login" className="text-blue-400 hover:underline font-bold">登录</a> 或 <a href="/register" className="text-blue-400 hover:underline font-bold">注册</a> 后参与讨论
						</div>
					)}
				</div>
			</div>

			{editOpen && post && (
				<div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
					<form
						onSubmit={handleSavePostEdit}
						className="w-full max-w-3xl bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden my-6"
					>
						<div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
							<div>
								<h2 className="text-base font-bold text-white flex items-center gap-2">
									<Pencil className="w-4 h-4 text-sky-400" />
									编辑帖子
								</h2>
								<p className="text-[11px] text-gray-500 mt-1">
									修改标题、正文或所属板块
								</p>
							</div>

							<button
								type="button"
								onClick={() => setEditOpen(false)}
								className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#21262d]"
								title="关闭"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						<div className="p-5 space-y-4">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-gray-300">
									帖子标题
								</label>

								<input
									type="text"
									value={editTitle}
									maxLength={120}
									onChange={event =>
										setEditTitle(
											event.target.value
										)
									}
									className="w-full h-10 rounded-md bg-[#0d1117] border border-[#30363d] px-3 text-sm text-white outline-none focus:border-blue-500"
									placeholder="请输入帖子标题"
									required
								/>

								<div className="text-right text-[10px] text-gray-600">
									{editTitle.length}/120
								</div>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-medium text-gray-300">
									所属板块
								</label>

								<select
									value={editCategoryId}
									onChange={event =>
										setEditCategoryId(
											event.target.value
										)
									}
									className="w-full h-10 rounded-md bg-[#0d1117] border border-[#30363d] px-3 text-sm text-white outline-none focus:border-blue-500"
								>
									{editCategories
										.filter(category =>
											user.role === 'admin'
												? true
												: category.id !== 9
										)
										.map(category => (
											<option
												key={category.id}
												value={category.id}
											>
												{category.id === 9
													? '📢 公告（站长专属）'
													: category.name}
											</option>
										))}
								</select>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-medium text-gray-300">
									帖子正文
								</label>

								<textarea
									value={editContent}
									onChange={event =>
										setEditContent(
											event.target.value
										)
									}
									rows={15}
									className="w-full min-h-[320px] resize-y rounded-md bg-[#0d1117] border border-[#30363d] p-3 text-sm leading-relaxed text-white outline-none focus:border-blue-500 font-mono"
									placeholder="支持 Markdown 格式"
									required
								/>

								<p className="text-[11px] text-gray-500">
									支持 Markdown。保存后公开/私密与搜索引擎收录设置不会改变。
								</p>
							</div>
						</div>

						<div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#30363d] bg-[#0d1117]">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setEditOpen(false)}
								className="text-xs text-gray-400"
							>
								取消
							</Button>

							<Button
								type="submit"
								size="sm"
								disabled={
									editSaving ||
									!editTitle.trim() ||
									!editContent.trim()
								}
								className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5"
							>
								<Save className="w-3.5 h-3.5 mr-1.5" />
								{editSaving
									? '保存中...'
									: '保存修改'}
							</Button>
						</div>
					</form>
				</div>
			)}
		</PageShell>
	);
}
