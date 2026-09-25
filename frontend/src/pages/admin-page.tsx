import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, getSecurityHeaders, type Category } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Coins, RefreshCw, Shield, Users, Medal, X, Check, Sparkles, Pencil } from 'lucide-react';

const PRESET_BADGES = [
	{ name: '🛡️ 白帽守护者', desc: '发现重大漏洞、守护社区安全', color: 'border-blue-500 bg-blue-500/10 text-blue-300' },
	{ name: '🎖️ 创站先驱', desc: '自由论坛前 100 位骨灰级元老', color: 'border-amber-500 bg-amber-500/10 text-amber-300' },
	{ name: '💎 贡献大佬', desc: '无私分享顶级干货技术与独家资源', color: 'border-purple-500 bg-purple-500/10 text-purple-300' },
	{ name: '🎯 签到达人', desc: '坚持每日打卡、社区全勤劳模', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
	{ name: '🥮 中秋月圆', desc: '八月十五中秋佳节专属绝版限定', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-300' },
	{ name: '🏮 新春纳福', desc: '农历新年新春专属节日荣誉', color: 'border-rose-500 bg-rose-500/10 text-rose-300' },
	{ name: '🛠️ 劳动模范', desc: '五一国际劳动节勤奋先锋专属', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-300' }
];

export function AdminPage() {
	const token = getToken();
	const user = React.useMemo(() => getUser(), [token]);
	const [error, setError] = React.useState('');
	const [loading, setLoading] = React.useState(false);

	const [stats, setStats] = React.useState<{ users: number; posts: number; comments: number } | null>(null);
	const [users, setUsers] = React.useState<
		Array<{ id: number; email: string; username: string; role: string; verified: number; created_at: string; points?: number; title?: string; badges?: string }>
	>([]);

	const [badgeModalOpen, setBadgeModalOpen] = React.useState(false);
	const [targetUser, setTargetUser] = React.useState<{ id: number; username: string } | null>(null);
	const [selectedBadges, setSelectedBadges] = React.useState<string[]>([]);
	const [customBadgeInput, setCustomBadgeInput] = React.useState('');

	const [batchModalOpen, setBatchModalOpen] = React.useState(false);
	const [batchBadge, setBatchBadge] = React.useState('🥮 中秋月圆');
	const [batchScope, setBatchScope] = React.useState<'all' | 'top100'>('all');
	const [batchLoading, setBatchLoading] = React.useState(false);

	React.useEffect(() => {
		if (!token) window.location.href = '/login';
	}, [token]);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [s, u] = await Promise.all([
				apiFetch<{ users: number; posts: number; comments: number }>('/admin/stats', {
					headers: getSecurityHeaders('GET')
				}),
				apiFetch<any[]>('/admin/users', {
					headers: getSecurityHeaders('GET')
				})
			]);
			setStats(s);
			setUsers(u || []);
		} catch (e: any) {
			setError(e.message || '加载后台数据失败');
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		refresh();
	}, [refresh]);

	// 核心亮点：站长强制修改违规用户的昵称！
	async function handleRenameUser(userId: number, currentName: string) {
		const input = prompt(
			`【站长强制修改用户名】\n当前用户名：${currentName}\n\n请输入新的合规用户名（例如：热心坛友${userId}）：`,
			`坛友_${userId}`
		);
		if (!input) return;
		const newName = input.trim();
		if (!newName || newName === currentName) return;

		try {
			const res = await apiFetch<{ success: boolean; username: string }>(`/admin/users/${userId}/rename`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ username: newName })
			});
			if (res.success) {
				alert(`🎉 修改成功！原用户【${currentName}】已被更名为：【${res.username}】`);
				refresh();
			}
		} catch (err: any) {
			alert('改名失败: ' + err.message);
		}
	}

	async function handleAdjustPoints(userId: number, username: string, currentPoints: number) {
		const input = prompt(
			`【站长调分中心】\n用户：${username}\n当前积分：${currentPoints || 0}\n\n请输入要调整的积分数值：\n（输入正数如 100 为充值；输入负数如 -50 为扣除）`,
			'100'
		);
		if (!input) return;
		const amount = parseInt(input.trim());
		if (isNaN(amount) || amount === 0) {
			alert('请输入有效的非零整数！');
			return;
		}

		try {
			const res = await apiFetch<{ success: boolean; points: number }>(`/admin/users/${userId}/points`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ amount })
			});
			if (res.success) {
				alert(`🎉 调整成功！用户【${username}】最新积分：${res.points}`);
				refresh();
			}
		} catch (err: any) {
			alert('调整失败: ' + err.message);
		}
	}

	function openBadgeModal(userId: number, username: string, currentBadgesStr?: string) {
		let list: string[] = [];
		try {
			list = currentBadgesStr ? JSON.parse(currentBadgesStr) : [];
		} catch (_) {}
		setTargetUser({ id: userId, username });
		setSelectedBadges(list);
		setCustomBadgeInput('');
		setBadgeModalOpen(true);
	}

	function toggleBadge(name: string) {
		setSelectedBadges(prev =>
			prev.includes(name) ? prev.filter(b => b !== name) : [...prev, name]
		);
	}

	function handleAddCustomBadge() {
		if (!customBadgeInput.trim()) return;
		const badge = customBadgeInput.trim();
		if (!selectedBadges.includes(badge)) {
			setSelectedBadges(prev => [...prev, badge]);
		}
		setCustomBadgeInput('');
	}

	async function saveBadges() {
		if (!targetUser) return;
		try {
			const res = await apiFetch<{ success: boolean; badges: string[] }>(`/admin/users/${targetUser.id}/badges`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ badges: selectedBadges })
			});
			if (res.success) {
				alert(`🎉 授勋成功！已为【${targetUser.username}】更新荣誉勋章！`);
				setBadgeModalOpen(false);
				refresh();
			}
		} catch (err: any) {
			alert('授勋失败: ' + err.message);
		}
	}

	async function handleExecuteBatchBadge() {
		if (!confirm(`确定要为【${batchScope === 'all' ? '全站所有注册会员' : '前 100 位创站元老'}】一键批量佩戴【${batchBadge}】勋章吗？`)) return;
		setBatchLoading(true);
		try {
			const res = await apiFetch<{ success: boolean; affected: number; badge: string }>('/admin/users/batch-badges', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					badge: batchBadge,
					scope: batchScope
				})
			});
			if (res.success) {
				alert(`👑 全员大授勋完成！已成功为 ${res.affected} 位会员一键佩戴【${res.badge}】专属荣誉！`);
				setBatchModalOpen(false);
				refresh();
			}
		} catch (err: any) {
			alert('批量授勋失败: ' + err.message);
		} finally {
			setBatchLoading(false);
		}
	}

	function parseUserBadges(badgesStr?: string): string[] {
		if (!badgesStr) return [];
		try {
			return JSON.parse(badgesStr);
		} catch (_) {
			return [];
		}
	}

	return (
		<PageShell>
			<div className="space-y-6">
				<div className="flex items-center justify-between border-b border-[#30363d] pb-4 flex-wrap gap-3">
					<div>
						<h1 className="text-xl font-bold text-white flex items-center gap-2">
							<Shield className="w-5 h-5 text-blue-500" />
							自由论坛 · 管理控制台
						</h1>
						<p className="text-xs text-gray-400 mt-1">站点统计、全站用户、改名封控、全员大授勋与快捷充值中心</p>
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="sm"
							onClick={() => setBatchModalOpen(true)}
							className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-black font-extrabold text-xs h-8 px-3 shadow-md"
						>
							<Sparkles className="w-3.5 h-3.5 mr-1" />
							👑 全员一键大授勋
						</Button>

						<Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="text-xs border-[#30363d] h-8">
							<RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> 刷新
						</Button>
					</div>
				</div>

				{error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 text-xs rounded">{error}</div>}

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card className="bg-[#161b22] border-[#30363d]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-xs text-gray-400 font-normal">注册会员总数</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="text-2xl font-bold text-white">{stats?.users ?? 0}</div>
						</CardContent>
					</Card>
					<Card className="bg-[#161b22] border-[#30363d]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-xs text-gray-400 font-normal">全站主题帖数</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="text-2xl font-bold text-white">{stats?.posts ?? 0}</div>
						</CardContent>
					</Card>
					<Card className="bg-[#161b22] border-[#30363d]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-xs text-gray-400 font-normal">交流回帖总数</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="text-2xl font-bold text-white">{stats?.comments ?? 0}</div>
						</CardContent>
					</Card>
				</div>

				{/* 会员列表 */}
				<Card className="bg-[#161b22] border-[#30363d]">
					<CardHeader className="py-3 px-4 border-b border-[#30363d]">
						<CardTitle className="text-sm text-white flex items-center gap-1.5">
							<Users className="w-4 h-4 text-blue-400" />
							会员管理、荣誉勋章、强制改名与积分充值
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0 overflow-x-auto">
						<table className="w-full text-xs text-left text-gray-300">
							<thead className="bg-[#0d1117] text-gray-400 border-b border-[#30363d]">
								<tr>
									<th className="py-2.5 px-4">ID</th>
									<th className="py-2.5 px-4">用户名</th>
									<th className="py-2.5 px-4">邮箱</th>
									<th className="py-2.5 px-4">称号与已佩戴勋章</th>
									<th className="py-2.5 px-4">当前积分</th>
									<th className="py-2.5 px-4">角色</th>
									<th className="py-2.5 px-4 text-right">操作管理</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#21262d]">
								{users.map(u => {
									const userBadges = parseUserBadges(u.badges);
									return (
										<tr key={u.id} className="hover:bg-[#1c2128]">
											<td className="py-3 px-4">{u.id}</td>
											<td className="py-3 px-4 font-bold text-white">{u.username}</td>
											<td className="py-3 px-4 text-gray-400">{u.email}</td>
											<td className="py-3 px-4 space-y-1.5">
												<div>
													<span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded text-[11px]">
														{u.title || '🌱 初来乍到'}
													</span>
												</div>
												{userBadges.length > 0 && (
													<div className="flex flex-wrap gap-1">
														{userBadges.map((b, bi) => (
															<span key={bi} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold">
																{b}
															</span>
														))}
													</div>
												)}
											</td>
											<td className="py-3 px-4 font-bold text-yellow-400">
												✨ {u.points ?? 0}
											</td>
											<td className="py-3 px-4">
												<span className={`px-1.5 py-0.5 rounded text-[10px] ${u.role === 'admin' ? 'bg-amber-900/40 text-amber-300 border border-amber-800' : 'bg-gray-800 text-gray-400'}`}>
													{u.role === 'admin' ? '站长管理员' : '普通会员'}
												</span>
											</td>
											<td className="py-3 px-4 text-right">
												<div className="flex items-center justify-end gap-1.5 flex-wrap">
													{/* 核心亮点：站长强制给违规用户改名！ */}
													{u.role !== 'admin' && (
														<Button
															size="sm"
															variant="outline"
															onClick={() => handleRenameUser(u.id, u.username)}
															className="border-sky-500/40 text-sky-300 hover:bg-sky-500/20 text-xs h-6 px-2"
														>
															<Pencil className="w-3 h-3 mr-1" />
															改名
														</Button>
													)}
													<Button
														size="sm"
														variant="outline"
														onClick={() => openBadgeModal(u.id, u.username, u.badges)}
														className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs h-6 px-2"
													>
														<Medal className="w-3 h-3 mr-1" />
														授勋
													</Button>
													<Button
														size="sm"
														onClick={() => handleAdjustPoints(u.id, u.username, u.points ?? 0)}
														className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-6 px-2"
													>
														<Coins className="w-3 h-3 mr-1" />
														调分
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</CardContent>
				</Card>
			</div>

			{/* 单人授勋弹窗 */}
			{badgeModalOpen && targetUser && (
				<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-white">
						<div className="flex items-center justify-between border-b border-[#30363d] pb-3">
							<div className="flex items-center gap-2">
								<Medal className="w-5 h-5 text-amber-400" />
								<h3 className="font-bold text-sm">站长授勋中心 · 为【{targetUser.username}】颁发荣誉</h3>
							</div>
							<button onClick={() => setBadgeModalOpen(false)} className="text-gray-400 hover:text-white p-1">
								<X className="w-4 h-4" />
							</button>
						</div>

						<div>
							<span className="text-xs text-gray-400 block mb-2 font-medium">点击勋章直接佩戴 / 摘下：</span>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{PRESET_BADGES.map((b, i) => {
									const isSelected = selectedBadges.includes(b.name);
									return (
										<div
											key={i}
											onClick={() => toggleBadge(b.name)}
											className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between select-none ${
												isSelected
													? `${b.color} border-2 shadow-md`
													: 'border-[#30363d] bg-[#0d1117]/60 hover:bg-[#0d1117] text-gray-400'
											}`}
										>
											<div>
												<span className="font-bold text-xs block text-white">{b.name}</span>
												<span className="text-[10px] text-gray-400 leading-tight block mt-0.5">{b.desc}</span>
											</div>
											<div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-emerald-600 border-emerald-400 text-white' : 'border-gray-600'}`}>
												{isSelected && <Check className="w-3 h-3 stroke-[3]" />}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div className="space-y-1.5 pt-1 border-t border-[#21262d]">
							<span className="text-xs text-gray-400">发明新的专属勋章（可带 Emoji 图标）：</span>
							<div className="flex gap-2">
								<input
									type="text"
									placeholder="如：🔥 活跃领袖、🚀 运维大佬"
									value={customBadgeInput}
									onChange={e => setCustomBadgeInput(e.target.value)}
									className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 text-white text-xs h-8 outline-none focus:border-blue-500"
								/>
								<Button type="button" size="sm" onClick={handleAddCustomBadge} className="bg-blue-600 hover:bg-blue-700 text-xs h-8 px-3">
									添加
								</Button>
							</div>
						</div>

						<div className="bg-[#0d1117] p-2.5 rounded-md border border-[#21262d]">
							<span className="text-[11px] text-gray-400 block mb-1.5">最终授予佩戴的勋章：</span>
							{selectedBadges.length === 0 ? (
								<span className="text-xs text-gray-500 italic">（未选择任何勋章，保存将收回该用户所有勋章）</span>
							) : (
								<div className="flex flex-wrap gap-1.5">
									{selectedBadges.map((b, i) => (
										<span key={i} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
											{b}
											<button type="button" onClick={() => toggleBadge(b)} className="text-amber-300/60 hover:text-red-400 ml-0.5">✕</button>
										</span>
									))}
								</div>
							)}
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
							<Button type="button" size="sm" variant="ghost" onClick={() => setBadgeModalOpen(false)} className="text-xs text-gray-400">
								取消
							</Button>
							<Button type="button" size="sm" onClick={saveBadges} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5">
								确认保存授勋
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* 全员一键大授勋弹窗 */}
			{batchModalOpen && (
				<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[#161b22] border border-amber-500/40 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-white">
						<div className="flex items-center justify-between border-b border-[#30363d] pb-3">
							<div className="flex items-center gap-2">
								<Sparkles className="w-5 h-5 text-amber-400" />
								<h3 className="font-bold text-sm text-amber-300">👑 全员一键大授勋 · 普天同庆</h3>
							</div>
							<button onClick={() => setBatchModalOpen(false)} className="text-gray-400 hover:text-white p-1">
								<X className="w-4 h-4" />
							</button>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<span className="text-gray-400 block mb-1.5 font-medium">1. 选择批量授予的专属荣誉勋章：</span>
								<select
									value={batchBadge}
									onChange={e => setBatchBadge(e.target.value)}
									className="w-full bg-[#0d1117] border border-[#30363d] text-white rounded p-2 text-xs outline-none focus:border-amber-500 font-bold"
								>
									{PRESET_BADGES.map((b, i) => (
										<option key={i} value={b.name}>{b.name}（{b.desc}）</option>
									))}
								</select>
							</div>

							<div>
								<span className="text-gray-400 block mb-1.5 font-medium">2. 授勋受众范围：</span>
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => setBatchScope('all')}
										className={`p-2.5 rounded border text-xs font-bold transition-all ${
											batchScope === 'all'
												? 'border-amber-500 bg-amber-500/20 text-amber-300'
												: 'border-[#30363d] bg-[#0d1117] text-gray-400'
										}`}
									>
										🎉 全站所有注册会员
									</button>
									<button
										type="button"
										onClick={() => setBatchScope('top100')}
										className={`p-2.5 rounded border text-xs font-bold transition-all ${
											batchScope === 'top100'
												? 'border-amber-500 bg-amber-500/20 text-amber-300'
												: 'border-[#30363d] bg-[#0d1117] text-gray-400'
										}`}
									>
										🎖️ 前 100 位创站元老
									</button>
								</div>
							</div>

							<div className="bg-[#0d1117] p-3 rounded border border-amber-500/20 text-[11px] text-gray-400 leading-relaxed">
								💡 <strong>使用场景说明：</strong><br />
								• 遇上中秋/春节/五一等重大节日，直接选对应勋章，点一下全员集体佩戴！<br />
								• 系统会自动跳过已经佩戴过的用户，绝不重复添加，高效优雅！
							</div>
						</div>

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
							<Button type="button" size="sm" variant="ghost" onClick={() => setBatchModalOpen(false)} className="text-xs text-gray-400">
								取消
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={batchLoading}
								onClick={handleExecuteBatchBadge}
								className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-black font-extrabold text-xs px-5 shadow-lg"
							>
								{batchLoading ? '正在全员大授勋...' : '立即一键全员佩戴'}
							</Button>
						</div>
					</div>
				</div>
			)}
		</PageShell>
	);
}
