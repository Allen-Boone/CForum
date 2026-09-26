import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { apiFetch, formatDate, getSecurityHeaders } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import {
	ArrowLeft,
	Inbox,
	MessageCircle,
	RefreshCw,
	Send,
	User
} from 'lucide-react';

type ChatUser = {
	id: number;
	username: string;
	avatar_url?: string | null;
	role?: string;
	title?: string | null;
};

type Conversation = {
	user: ChatUser;
	last_message: string;
	last_message_at: string;
	unread: number;
};

type DirectMessage = {
	id: number;
	sender_id: number;
	recipient_id: number;
	content: string;
	is_read: number;
	created_at: string;
};

type MessageHistory = {
	user: ChatUser;
	messages: DirectMessage[];
};

function UserAvatar({
	user,
	size = 'normal'
}: {
	user: ChatUser;
	size?: 'small' | 'normal';
}) {
	const sizeClass =
		size === 'small' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';

	return (
		<div
			className={`${sizeClass} rounded-full overflow-hidden border border-[#30363d] bg-blue-600/20 text-blue-300 flex items-center justify-center font-bold flex-shrink-0`}
		>
			{user.avatar_url ? (
				<img
					src={user.avatar_url}
					alt={user.username}
					className="w-full h-full object-cover"
				/>
			) : (
				<span>{user.username.slice(0, 1).toUpperCase()}</span>
			)}
		</div>
	);
}

export function MessagesPage() {
	const token = getToken();
	const currentUser = getUser();

	const [conversations, setConversations] = React.useState<
		Conversation[]
	>([]);
	const [selectedUser, setSelectedUser] =
		React.useState<ChatUser | null>(null);
	const [messages, setMessages] = React.useState<DirectMessage[]>([]);
	const [content, setContent] = React.useState('');
	const [loadingList, setLoadingList] = React.useState(true);
	const [loadingMessages, setLoadingMessages] = React.useState(false);
	const [sending, setSending] = React.useState(false);
	const [error, setError] = React.useState('');

	const messagesEndRef = React.useRef<HTMLDivElement>(null);
	const selectedUserIdRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		if (!token || !currentUser) {
			window.location.href = '/login';
		}
	}, [token, currentUser]);

	React.useEffect(() => {
		selectedUserIdRef.current = selectedUser?.id || null;
	}, [selectedUser]);

	const scrollToBottom = React.useCallback(() => {
		setTimeout(() => {
			messagesEndRef.current?.scrollIntoView({
				behavior: 'smooth'
			});
		}, 60);
	}, []);

	const loadConversations = React.useCallback(
		async (silent = false) => {
			if (!token) return;

			if (!silent) setLoadingList(true);

			try {
				const result = await apiFetch<Conversation[]>(
					'/messages/conversations'
				);

				setConversations(result || []);
			} catch (err: any) {
				if (!silent) {
					setError(err.message || '读取会话列表失败');
				}
			} finally {
				if (!silent) setLoadingList(false);
			}
		},
		[token]
	);

	const loadMessages = React.useCallback(
		async (
			userId: number,
			silent = false,
			shouldScroll = false
		) => {
			if (!token || !Number.isInteger(userId)) return;

			if (!silent) setLoadingMessages(true);

			try {
				const result = await apiFetch<MessageHistory>(
					`/messages/${userId}`
				);

				setSelectedUser(result.user);
				setMessages(result.messages || []);

				if (shouldScroll) {
					scrollToBottom();
				}
			} catch (err: any) {
				if (!silent) {
					setError(err.message || '读取私信失败');
				}
			} finally {
				if (!silent) setLoadingMessages(false);
			}
		},
		[token, scrollToBottom]
	);

	React.useEffect(() => {
		if (!token) return;

		loadConversations();

		const params = new URLSearchParams(window.location.search);
		const requestedUserId = Number(params.get('userId'));

		if (
			Number.isInteger(requestedUserId) &&
			requestedUserId > 0 &&
			requestedUserId !== currentUser?.id
		) {
			loadMessages(requestedUserId, false, true);
		}
	}, [
		token,
		currentUser?.id,
		loadConversations,
		loadMessages
	]);

	React.useEffect(() => {
		if (!token) return;

		const timer = window.setInterval(() => {
			loadConversations(true);

			const activeId = selectedUserIdRef.current;
			if (activeId) {
				loadMessages(activeId, true, false);
			}
		}, 5000);

		return () => window.clearInterval(timer);
	}, [token, loadConversations, loadMessages]);

	React.useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages.length, scrollToBottom]);

	function selectConversation(conversation: Conversation) {
		setError('');
		setSelectedUser(conversation.user);
		setMessages([]);

		const nextUrl =
			`/messages?userId=${conversation.user.id}`;
		window.history.replaceState({}, '', nextUrl);

		loadMessages(conversation.user.id, false, true);
	}

	async function handleSend(e: React.FormEvent) {
		e.preventDefault();

		if (!selectedUser || !content.trim() || sending) return;

		setSending(true);
		setError('');

		try {
			await apiFetch<{ success: boolean; id: number }>(
				`/messages/${selectedUser.id}`,
				{
					method: 'POST',
					headers: getSecurityHeaders('POST'),
					body: JSON.stringify({
						content: content.trim()
					})
				}
			);

			setContent('');

			await Promise.all([
				loadMessages(selectedUser.id, true, true),
				loadConversations(true)
			]);
		} catch (err: any) {
			setError(err.message || '私信发送失败');
		} finally {
			setSending(false);
		}
	}

	if (!token || !currentUser) {
		return null;
	}

	return (
		<PageShell>
			<div className="max-w-6xl mx-auto space-y-4">
				<div className="flex items-center justify-between gap-3 flex-wrap">
					<div>
						<h1 className="text-xl font-bold text-white flex items-center gap-2">
							<MessageCircle className="w-5 h-5 text-blue-400" />
							站内私信
						</h1>
						<p className="text-xs text-gray-400 mt-1">
							仅参与会话的双方可查看私信内容
						</p>
					</div>

					<div className="flex items-center gap-2">
						<Button
							asChild
							size="sm"
							variant="outline"
							className="border-[#30363d] text-gray-300 text-xs"
						>
							<a href="/">
								<ArrowLeft className="w-3.5 h-3.5 mr-1" />
								返回首页
							</a>
						</Button>

						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								loadConversations();
								if (selectedUser) {
									loadMessages(
										selectedUser.id,
										false,
										false
									);
								}
							}}
							className="border-[#30363d] text-gray-300 text-xs"
						>
							<RefreshCw className="w-3.5 h-3.5 mr-1" />
							刷新
						</Button>
					</div>
				</div>

				{error && (
					<div className="p-3 rounded-lg border border-red-800 bg-red-950/50 text-red-200 text-xs">
						{error}
					</div>
				)}

				<div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] min-h-[620px] bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
					<aside className="border-b md:border-b-0 md:border-r border-[#30363d] bg-[#0d1117]">
						<div className="p-4 border-b border-[#30363d] flex items-center justify-between">
							<span className="text-sm font-bold text-white flex items-center gap-2">
								<Inbox className="w-4 h-4 text-sky-400" />
								最近会话
							</span>

							<span className="text-[11px] text-gray-500">
								{conversations.length} 个
							</span>
						</div>

						<div className="max-h-[260px] md:max-h-[620px] overflow-y-auto">
							{loadingList ? (
								<div className="p-8 text-center text-xs text-gray-500">
									正在读取私信...
								</div>
							) : conversations.length === 0 ? (
								<div className="p-8 text-center text-xs text-gray-500 leading-relaxed">
									暂无私信会话
									<br />
									点击首页用户头像即可发起私聊
								</div>
							) : (
								conversations.map(conversation => {
									const active =
										selectedUser?.id ===
										conversation.user.id;

									return (
										<button
											key={conversation.user.id}
											type="button"
											onClick={() =>
												selectConversation(
													conversation
												)
											}
											className={`w-full text-left p-3.5 border-b border-[#21262d] flex items-start gap-3 transition-colors ${
												active
													? 'bg-blue-950/40'
													: 'hover:bg-[#161b22]'
											}`}
										>
											<UserAvatar
												user={conversation.user}
												size="small"
											/>

											<div className="min-w-0 flex-1">
												<div className="flex items-center justify-between gap-2">
													<span className="text-xs font-bold text-white truncate">
														{
															conversation
																.user
																.username
														}
													</span>

													{conversation.unread >
														0 && (
														<span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
															{
																conversation.unread
															}
														</span>
													)}
												</div>

												<p className="text-[11px] text-gray-400 mt-1 truncate">
													{
														conversation.last_message
													}
												</p>

												<p className="text-[10px] text-gray-600 mt-1">
													{formatDate(
														conversation.last_message_at
													)}
												</p>
											</div>
										</button>
									);
								})
							)}
						</div>
					</aside>

					<section className="flex flex-col min-w-0 min-h-[520px]">
						{selectedUser ? (
							<>
								<header className="p-4 border-b border-[#30363d] flex items-center gap-3 bg-[#161b22]">
									<UserAvatar user={selectedUser} />

									<div className="min-w-0">
										<h2 className="font-bold text-white text-sm truncate">
											{selectedUser.username}
										</h2>
										<p className="text-[11px] text-gray-400">
											{selectedUser.role === 'admin'
												? '👑 站长'
												: selectedUser.title ||
													'🌱 初来乍到'}
										</p>
									</div>
								</header>

								<div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#0d1117] max-h-[500px]">
									{loadingMessages ? (
										<div className="py-16 text-center text-xs text-gray-500">
											正在读取聊天记录...
										</div>
									) : messages.length === 0 ? (
										<div className="py-16 text-center text-xs text-gray-500">
											暂无消息，发送第一句问候吧
										</div>
									) : (
										messages.map(message => {
											const mine =
												message.sender_id ===
												currentUser.id;

											return (
												<div
													key={message.id}
													className={`flex ${
														mine
															? 'justify-end'
															: 'justify-start'
													}`}
												>
													<div
														className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
															mine
																? 'bg-blue-600 text-white rounded-br-sm'
																: 'bg-[#21262d] border border-[#30363d] text-gray-100 rounded-bl-sm'
														}`}
													>
														<p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
															{
																message.content
															}
														</p>

														<p
															className={`text-[10px] mt-1.5 ${
																mine
																	? 'text-blue-100/70 text-right'
																	: 'text-gray-500'
															}`}
														>
															{formatDate(
																message.created_at
															)}
														</p>
													</div>
												</div>
											);
										})
									)}

									<div ref={messagesEndRef} />
								</div>

								<form
									onSubmit={handleSend}
									className="p-4 border-t border-[#30363d] bg-[#161b22] space-y-2"
								>
									<textarea
										value={content}
										onChange={e =>
											setContent(
												e.target.value.slice(
													0,
													1000
												)
											)
										}
										onKeyDown={e => {
											if (
												e.key === 'Enter' &&
												!e.shiftKey
											) {
												e.preventDefault();
												e.currentTarget.form?.requestSubmit();
											}
										}}
										rows={3}
										maxLength={1000}
										placeholder={`给 ${selectedUser.username} 发送私信，Enter 发送，Shift+Enter 换行`}
										className="w-full resize-none rounded-lg bg-[#0d1117] border border-[#30363d] text-white text-sm p-3 outline-none focus:border-blue-500"
									/>

									<div className="flex items-center justify-between gap-3">
										<span className="text-[10px] text-gray-500">
											{content.length}/1000
										</span>

										<Button
											type="submit"
											size="sm"
											disabled={
												sending ||
												!content.trim()
											}
											className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5"
										>
											<Send className="w-3.5 h-3.5 mr-1.5" />
											{sending
												? '发送中...'
												: '发送私信'}
										</Button>
									</div>
								</form>
							</>
						) : (
							<div className="flex-1 flex flex-col items-center justify-center text-center p-8">
								<div className="w-14 h-14 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
									<User className="w-7 h-7" />
								</div>

								<h2 className="text-base font-bold text-white mt-4">
									选择一个会话
								</h2>

								<p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
									在左侧选择已有会话，或者回到首页点击用户头像发起私聊
								</p>
							</div>
						)}
					</section>
				</div>
			</div>
		</PageShell>
	);
}
