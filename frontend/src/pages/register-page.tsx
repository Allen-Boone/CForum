import * as React from 'react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, getSecurityHeaders } from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import { TurnstileWidget } from '@/components/turnstile';
import { Mail, Lock, User, CheckCircle2, ShieldCheck, Info } from 'lucide-react';

export function RegisterPage() {
	const [email, setEmail] = React.useState('');
	const [username, setUsername] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [code, setCode] = React.useState('');
	const [error, setError] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [turnstileEnabled, setTurnstileEnabled] = React.useState(false);
	const [turnstileSiteKey, setTurnstileSiteKey] = React.useState('');
	const [turnstileToken, setTurnstileToken] = React.useState('');
	const [turnstileResetKey, setTurnstileResetKey] = React.useState(0);

	// 发送验证码与 60s 倒计时
	const [sendingCode, setSendingCode] = React.useState(false);
	const [countdown, setCountdown] = React.useState(0);
	const [codeSentNotice, setCodeSentNotice] = React.useState('');

	React.useEffect(() => {
		apiFetch<{ turnstile_enabled: boolean; turnstile_site_key: string }>('/config')
			.then(config => {
				setTurnstileEnabled(Boolean(config.turnstile_enabled));
				setTurnstileSiteKey(config.turnstile_site_key || '');
			})
			.catch(() => setTurnstileEnabled(false));
	}, []);

	React.useEffect(() => {
		if (countdown > 0) {
			const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [countdown]);

	async function handleSendCode() {
		if (!email.trim()) {
			setError('请先填写注册邮箱！');
			return;
		}
		if (turnstileEnabled && !turnstileToken) {
			setError('请先完成人机验证！');
			return;
		}
		setError('');
		setSendingCode(true);
		setCodeSentNotice('');

		try {
			const res = await apiFetch<{ success: boolean; message: string }>('/auth/send-code', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					email: email.trim(),
					turnstile_token: turnstileToken
				})
			});
			if (res.success) {
				setCodeSentNotice('✅ 验证码已发送至您的邮箱，请前往查收并填入！');
				setCountdown(60);
			}
		} catch (err: any) {
			setError(err.message || '发送验证码失败');
		} finally {
			setSendingCode(false);
			setTurnstileToken('');
			setTurnstileResetKey(value => value + 1);
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError('');

		if (!code.trim()) {
			setError('请先获取并输入邮箱 6 位验证码！');
			return;
		}

		setLoading(true);
		try {
			const res = await apiFetch<{ token: string; user: any }>('/register', {
				method: 'POST',
				headers: getSecurityHeaders('POST'),
				body: JSON.stringify({
					email: email.trim(),
					username: username.trim(),
					password: password.trim(),
					code: code.trim()
				})
			});
			setToken(res.token);
			setUser(res.user);
			alert('🎉 注册成功！欢迎加入自由论坛！');
			window.location.href = '/';
		} catch (err: any) {
			setError(err.message || '注册失败，请检查输入');
		} finally {
			setLoading(false);
		}
	}

	return (
		<PageShell>
			<div className="max-w-md mx-auto my-8 bg-[#161b22] border border-[#30363d] rounded-2xl p-7 shadow-2xl space-y-6">
				<div className="text-center space-y-2">
					<div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
						<ShieldCheck className="w-6 h-6" />
					</div>
					<h1 className="text-xl font-bold text-white tracking-tight">注册自由论坛账号</h1>
					<p className="text-xs text-gray-400">为营造纯粹的极客交流秩序，本站采用真实邮箱验证机制</p>
				</div>

				{error && (
					<div className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-lg animate-in fade-in">
						{error}
					</div>
				)}

				{codeSentNotice && (
					<div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-lg animate-in fade-in flex items-center gap-1.5">
						<CheckCircle2 className="w-4 h-4 flex-shrink-0" />
						<span>{codeSentNotice}</span>
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4 text-xs">
					{/* 邮箱输入 + 获取验证码按钮 */}
					<div className="space-y-1.5">
						<Label className="text-gray-300">注册邮箱：</Label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
								<Input
									type="email"
									placeholder="your_name@qq.com"
									value={email}
									onChange={e => setEmail(e.target.value)}
									className="bg-[#0d1117] border-[#30363d] text-white pl-9 text-xs h-9"
									required
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={handleSendCode}
								disabled={sendingCode || countdown > 0 || !email.trim()}
								className="border-[#30363d] text-sky-400 hover:text-sky-300 hover:bg-[#21262d] text-xs h-9 px-3 whitespace-nowrap"
							>
								{sendingCode ? '正在发送...' : countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
							</Button>
						</div>

						{/* 贴心引导提示栏 */}
						<div className="flex items-start gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-md leading-relaxed mt-1">
							<Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
							<span>
								<strong>推荐使用 QQ、163、Foxmail 邮箱</strong>，验证码秒级送达；Gmail 首次接收可能会有少许延迟或进入垃圾箱。
							</span>
						</div>
					</div>

					{turnstileEnabled && turnstileSiteKey && (
						<div className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 overflow-hidden">
							<div className="text-[11px] text-gray-400 mb-1">安全验证：完成后才能获取邮箱验证码</div>
							<TurnstileWidget
								enabled={turnstileEnabled}
								siteKey={turnstileSiteKey}
								onToken={setTurnstileToken}
								resetKey={turnstileResetKey}
							/>
						</div>
					)}

					{/* 6位验证码输入框 */}
					<div className="space-y-1.5">
						<Label className="text-gray-300">邮件 6 位验证码：</Label>
						<Input
							type="text"
							placeholder="请输入您在邮箱中收到的 6 位数字"
							value={code}
							maxLength={6}
							onChange={e => setCode(e.target.value.trim())}
							className="bg-[#0d1117] border-[#30363d] text-white text-xs h-9 tracking-widest font-mono font-bold"
							required
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-gray-300">个性用户名（2 ~ 16 个字符）：</Label>
						<div className="relative">
							<User className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
							<Input
								type="text"
								placeholder="如：极客阿强、CodeMaster"
								value={username}
								maxLength={16}
								onChange={e => setUsername(e.target.value)}
								className="bg-[#0d1117] border-[#30363d] text-white pl-9 text-xs h-9"
								required
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label className="text-gray-300">登录密码（至少 6 位）：</Label>
						<div className="relative">
							<Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
							<Input
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={e => setPassword(e.target.value)}
								className="bg-[#0d1117] border-[#30363d] text-white pl-9 text-xs h-9"
								required
							/>
						</div>
					</div>

					<Button
						type="submit"
						disabled={loading}
						className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 shadow-lg mt-2"
					>
						{loading ? '正在验证注册...' : '立即验证并注册'}
					</Button>
				</form>

				<div className="text-center text-xs text-gray-500 pt-1">
					已有自由论坛账号？{' '}
					<a href="/login" className="text-blue-400 hover:underline font-bold">
						直接登录
					</a>
				</div>
			</div>
		</PageShell>
	);
}
