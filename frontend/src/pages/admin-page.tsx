import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, getSecurityHeaders, type Category } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Coins, RefreshCw, Shield, Users, Medal } from 'lucide-react';

export function AdminPage() {
	const token = getToken();
	const user = React.useMemo(() => getUser(), [token]);
	const isAdmin = user?.role === 'admin';
	const [error, setError] = React.useState('');
	const [loading, setLoading] = React.useState(false);

	const [stats, setStats] = React.useState<{ users: number; posts: number; comments: number } | null>(null);
	const [users, setUsers] = React.useState<
		Array<{ id: number; email: string; username: string; role: string; verified: number; created_at: string; points?: number; title?: string; badges?: string }>
	>([]);
	const [categories, setCategories] = React.useState<Category[]>([]);

	React.useEffect(() => {
		if (!token) window.location.href = '/login';
	}, [token]);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [s, u, c] = await Promise.all([
				apiFetch<{ users: number; posts: number; comments: number }>('/admin/stats', {
					headers: getSecurityHeaders('GET')
				}),
				apiFetch<any[]>('/admin/users', {
					headers: getSecurityHeaders('GET')
				}),
				apiFetch<Category[]>('/categories')
			]);
			setStats(s);
			setUsers(u || []);
			setCategories(c || []);
		} catch (e: any) {
			setError(e.message || '加载后台数据失败');
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		refresh();
	}, [refresh]);

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

	// 站长专属：授予 / 修改勋章弹窗
	async function handleManageBadges(userId: number, username: string, currentBadgesStr?: string) {
		let currentBadges: string[] = [];
		try {
			currentBadges = currentBadgesStr ? JSON.parse(currentBadgesStr) : [];
		} catch (_) {}

		const sampleBadges = ['🛡️ 白帽守护者', '🎖️ 创站先驱', '🏮 新春纳福', '🥮 中秋月圆', '🛠️ 劳动模范', '🎯 签到达人', '💎 贡献大佬'];
		const input = prompt(
			`【站长授勋中心】\n用户：${username}\n当前拥有勋章：${currentBadges.join('、') || '无'}\n\n推荐专属勋章清单：\n${sampleBadges.join('、')}\n\n请输入要授予的勋章（多个勋章用英文逗号或空格隔开；清空输入即收回所有勋章）：`,
			currentBadges.join(', ') || '🛡️ 白帽守护者'
		);
		if (input === null) return;

		const badges = input.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);

		try {
			const res = await apiFetch<{ success: boolean; badges: string[] }>(`/admin/users/${userId}/badges`, {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({ badges })
			});
			if (res.success) {
				alert(`🎉 授勋成功！用户【${username}】当前佩戴勋章：\n${badges.join('、') || '已收回所有勋章'}`);
				refresh();
			}
		} catch (err: any) {
			alert('授勋失败: ' + err.message);
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
				<div className="flex items-center justify-between border-b border-[#30363d] pb-4">
					<div>
						<h1 className="text-xl font-bold text-white flex items-center gap-2">
							<Shield className="w-5 h-5 text-blue-500" />
							自由论坛 · 管理控制台
						</h1>
						<p className="text-xs text-gray-400 mt-1">站点统计、全站用户、荣誉授勋与快捷充值中心</p>
					</div>
					<Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="text-xs border-[#30363d]">
						<RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> 刷新
					</Button>
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

				<Card className="bg-[#161b22] border-[#30363d]">
					<CardHeader className="py-3 px-4 border-b border-[#30363d]">
						<CardTitle className="text-sm text-white flex items-center gap-1.5">
							<Users className="w-4 h-4 text-blue-400" />
							会员管理、荣誉勋章与积分充值
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0 overflow-x-auto">
						<table className="w-full text-xs text-left text-gray-300">
							<thead className="bg-[#0d1117] text-gray-400 border-b border-[#30363d]">
								<tr>
									<th className="py-2.5 px-4">ID</th>
									<th className="py-2.5 px-4">用户名</th>
									<th className="py-2.5 px-4">邮箱</th>
									<th className="py-2.5 px-4">称号与勋章</th>
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
											<td className="py-3 px-4 space-y-1">
												<div>
													<span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded text-[11px]">
														{u.title || '🌱 初来乍到'}
													</span>
												</div>
												{userBadges.length > 0 && (
													<div className="flex flex-wrap gap-1">
														{userBadges.map((b, bi) => (
															<span key={bi} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-medium">
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
												<div className="flex items-center justify-end gap-1.5">
													{/* 站长专属：授予勋章 */}
													<Button
														size="sm"
														variant="outline"
														onClick={() => handleManageBadges(u.id, u.username, u.badges)}
														className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs h-6 px-2"
													>
														<Medal className="w-3 h-3 mr-1" />
														授勋
													</Button>
													{/* 站长专属：积分充值/扣除 */}
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
		</PageShell>
	);
}
