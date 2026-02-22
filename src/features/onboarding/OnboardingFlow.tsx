import { useState } from 'react';
import { useCliProxyStore } from '@/features/settings/cliProxy.store';
import { useAuthStore } from '@/features/auth/auth.store';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Download, FolderOpen, Zap, ShieldCheck, ArrowRight, Loader2, Key } from 'lucide-react';
import { toast } from 'sonner';
import { type } from '@tauri-apps/plugin-os';
import { homeDir, dirname, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Input } from '@/shared/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';

const pageVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.96 }),
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
};

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="fixed top-6 left-1/2 z-50 flex -translate-x-1/2 gap-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="h-2 rounded-full"
          animate={{
            width: i + 1 === current ? 32 : 8,
            backgroundColor: i + 1 <= current
              ? 'var(--color-primary)'
              : 'var(--color-muted)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        />
      ))}
    </div>
  );
}

export function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [selectedMode, setSelectedMode] = useState<'auto_download' | 'manual' | null>(null);
  const [isFetchingVersion, setIsFetchingVersion] = useState(false);
  const [managementKey, setManagementKey] = useState('');
  const [isSettingKey, setIsSettingKey] = useState(false);

  const { setCliProxyMode, setCliProxyVersion, setHasCompletedOnboarding, setCliProxyLatestVersion, browseForExe, startServer, checkApiHealth } = useCliProxyStore();

  const goTo = (s: number) => { setDirection(s > step ? 1 : -1); setStep(s); };

  const handleNextMode = async (mode: 'auto_download' | 'manual') => {
    if (mode === 'manual') {
      const path = await browseForExe();
      if (path) { setCliProxyMode(mode); setCliProxyVersion(null); goTo(4); }
      return;
    }
    setSelectedMode(mode);
    goTo(3);
  };

  const handleFinish = async (version: 'standard' | 'plus') => {
    setIsFetchingVersion(true);
    try {
      if (selectedMode === 'auto_download') {
        const repo = version === 'plus' ? 'CLIProxyAPIPlus' : 'CLIProxyAPI';
        const res = await fetch(`https://api.github.com/repos/router-for-me/${repo}/releases/latest`, {
          headers: { 'User-Agent': 'CLIProxyAPI' }
        });
        if (res.ok) {
          const data = await res.json();
          setCliProxyLatestVersion(data.tag_name || data.name);
          const osType = await type();
          let osName = 'windows';
          if (osType === 'macos') osName = 'darwin';
          if (osType === 'linux') osName = 'linux';
          const searchString = `${osName}_`;
          const asset = data.assets?.find((a: any) =>
            a.name.toLowerCase().includes(searchString) &&
            (a.name.endsWith('.zip') || a.name.endsWith('.tar.gz') || a.name.endsWith('.tgz'))
          );
          if (asset?.browser_download_url) {
            toast.info('Downloading Proxy...');
            try {
              const exePath = await invoke<string>('download_and_extract_proxy', { url: asset.browser_download_url });
              if (exePath) { useCliProxyStore.getState().setExePath(exePath); toast.success('Proxy downloaded!'); }
            } catch (e) { console.error(e); toast.error('Extraction failed.'); }
          } else { toast.error('No compatible package found.'); }
        } else { toast.error('Failed to fetch version info.'); }
      }
      setCliProxyMode(selectedMode);
      setCliProxyVersion(version);
      await new Promise(r => setTimeout(r, 600));
      goTo(4);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch version info.');
      goTo(4);
    } finally { setIsFetchingVersion(false); }
  };

  const handleSetupKey = async () => {
    if (!managementKey.trim()) { toast.error('Please enter a management key.'); return; }
    setIsSettingKey(true);
    toast.info('Starting proxy server...');
    try {
      const { exePath } = useCliProxyStore.getState();
      if (!exePath) throw new Error('No proxy executable path found.');
      const proxyDir = await dirname(exePath);
      const configPath = await join(proxyDir, 'config.yaml');
      const exampleConfigPath = await join(proxyDir, 'config.example.yaml');
      let configContent = '';
      try { configContent = await readTextFile(configPath); } catch { configContent = await readTextFile(exampleConfigPath); }
      configContent = configContent.replace(/secret-key:\s*["'][^"']*["']/, `secret-key: "${managementKey}"`);
      configContent = configContent.replace(/secret-key:\s*$/m, `secret-key: "${managementKey}"`);
      const homePath = await homeDir();
      const authDir = `${homePath}\\.cli-proxy-api`.replace(/\\\\/g, '\\');
      configContent = configContent.replace(/auth-dir:\s*.*$/, `auth-dir: "${authDir}"`);
      await writeTextFile(configPath, configContent);
      const started = await startServer();
      if (!started) {
        const healthy = await checkApiHealth();
        if (!healthy) { toast.error('Proxy failed to start.'); }
        else { toast.success('CLI Proxy configuration complete!'); }
      } else {
        // Give server a moment to boot
        await new Promise(r => setTimeout(r, 1500));
        toast.success('CLI Proxy configuration complete!');
      }

      // Auto-login with the management key just entered
      try {
        await useAuthStore.getState().login({
          apiBase: 'http://localhost:8317',
          managementKey,
          rememberPassword: true,
        });
      } catch (loginErr) {
        console.warn('Auto-login after onboarding failed:', loginErr);
      }
    } catch (err) { console.error(err); toast.error('Failed to update config.'); }
    finally { setIsSettingKey(false); setHasCompletedOnboarding(true); }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-6">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/3 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-green-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      <StepIndicator current={step} total={4} />

      <AnimatePresence custom={direction} mode="wait">
        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <motion.div
            key="step1"
            custom={direction}
            variants={pageVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-10 flex max-w-lg flex-col items-center space-y-8"
          >
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center space-y-6">
              {/* Logo */}
              <motion.div variants={fadeUp}>
                <motion.img
                  src="/icon.png"
                  alt="ZeroLimit"
                  className="h-36 w-36 drop-shadow-2xl"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                />
              </motion.div>

              {/* Title */}
              <motion.h1
                variants={fadeUp}
                className="bg-gradient-to-r from-primary via-green-500 to-emerald-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent"
              >
                ZeroLimit
              </motion.h1>

              {/* Subtitle */}
              <motion.p variants={fadeUp} className="text-center text-lg text-muted-foreground">
                Let's get your proxy environment set up before we securely log you in.
              </motion.p>

              {/* CTA */}
              <motion.div variants={fadeUp} className="w-full space-y-3 pt-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="w-full text-base" onClick={() => goTo(2)}>
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setHasCompletedOnboarding(true)}>
                    Skip For Now
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ── Step 2: Mode Selection ── */}
        {step === 2 && (
          <motion.div
            key="step2"
            custom={direction}
            variants={pageVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-10 flex w-full max-w-3xl flex-col items-center space-y-8"
          >
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex w-full flex-col items-center space-y-8">
              <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center">
                How would you like to set up CLIProxyApi?
              </motion.h2>

              <div className="grid w-full gap-6 md:grid-cols-2">
                {/* Auto Download Card */}
                <motion.div variants={fadeUp} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className="group cursor-pointer border border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-blue-500/60 hover:bg-card hover:shadow-xl hover:shadow-blue-500/5"
                    onClick={() => handleNextMode('auto_download')}
                  >
                    <CardContent className="flex flex-col items-center p-8 space-y-6">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                        <Download className="h-10 w-10" />
                      </div>
                      <h3 className="text-2xl font-semibold">Auto Download</h3>
                      <p className="text-center text-muted-foreground text-sm">
                        Automatically fetch and configure the latest CLI Proxy executable.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Manual Card */}
                <motion.div variants={fadeUp} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className="group cursor-pointer border border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-amber-500/60 hover:bg-card hover:shadow-xl hover:shadow-amber-500/5"
                    onClick={() => handleNextMode('manual')}
                  >
                    <CardContent className="flex flex-col items-center p-8 space-y-6">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                        <FolderOpen className="h-10 w-10" />
                      </div>
                      <h3 className="text-2xl font-semibold">Manual Location</h3>
                      <p className="text-center text-muted-foreground text-sm">
                        Select your own downloaded CLI Proxy executable.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div variants={fadeUp}>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button variant="ghost" onClick={() => goTo(1)}>
                    Back
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ── Step 3: Version Selection ── */}
        {step === 3 && (
          <motion.div
            key="step3"
            custom={direction}
            variants={pageVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-10 flex w-full max-w-3xl flex-col items-center space-y-8"
          >
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex w-full flex-col items-center space-y-8">
              <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center">
                Which version do you want?
              </motion.h2>

              <div className="grid w-full gap-6 md:grid-cols-2">
                {/* Standard */}
                <motion.div
                  variants={fadeUp}
                  whileHover={isFetchingVersion ? {} : { scale: 1.03, y: -4 }}
                  whileTap={isFetchingVersion ? {} : { scale: 0.98 }}
                >
                  <Card
                    className={`group cursor-pointer border border-border/50 bg-card/50 backdrop-blur-sm transition-all ${isFetchingVersion ? 'opacity-50 pointer-events-none' : 'hover:border-slate-400/60 hover:bg-card hover:shadow-xl hover:shadow-slate-500/5'}`}
                    onClick={() => handleFinish('standard')}
                  >
                    <CardContent className="flex flex-col items-center p-8 space-y-6">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-500 group-hover:bg-slate-500 group-hover:text-white transition-all duration-300">
                        <ShieldCheck className="h-10 w-10" />
                      </div>
                      <h3 className="text-2xl font-semibold">Standard</h3>
                      <p className="text-center text-muted-foreground text-sm">
                        The original CLI Proxy API.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Plus */}
                <motion.div
                  variants={fadeUp}
                  whileHover={isFetchingVersion ? {} : { scale: 1.03, y: -4 }}
                  whileTap={isFetchingVersion ? {} : { scale: 0.98 }}
                >
                  <Card
                    className={`group cursor-pointer border border-border/50 bg-card/50 backdrop-blur-sm transition-all ${isFetchingVersion ? 'opacity-50 pointer-events-none' : 'hover:border-green-500/60 hover:bg-card hover:shadow-xl hover:shadow-green-500/5'}`}
                    onClick={() => handleFinish('plus')}
                  >
                    <CardContent className="flex flex-col items-center p-8 space-y-6">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-green-500/10 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-green-400/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Zap className="h-10 w-10 relative z-10" />
                      </div>
                      <h3 className="text-2xl font-semibold">Plus</h3>
                      <p className="text-center text-muted-foreground text-sm">
                        The enhanced CLI Proxy API with premium features, enable Github Copilot and Kiro Login.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <motion.div variants={fadeUp} className="flex h-12 items-center justify-center">
                {isFetchingVersion ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Downloading and Extracting...
                  </div>
                ) : (
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button variant="ghost" onClick={() => goTo(2)}>
                      Back
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* ── Step 4: Management Key ── */}
        {step === 4 && (
          <motion.div
            key="step4"
            custom={direction}
            variants={pageVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative z-10 flex max-w-lg flex-col items-center space-y-8"
          >
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center space-y-6 w-full">
              {/* Key icon */}
              <motion.div
                variants={fadeUp}
                className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/10"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 0] }}
                  transition={{ duration: 1.2, delay: 0.4, ease: 'easeInOut' }}
                >
                  <Key className="h-14 w-14 text-primary" />
                </motion.div>
              </motion.div>

              <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center">
                Set Management Key
              </motion.h2>

              <motion.p variants={fadeUp} className="text-center text-muted-foreground">
                Protect your CLIProxy remote management API with a secret key.
              </motion.p>

              <motion.div variants={fadeUp} className="w-full space-y-4 pt-2">
                <Input
                  type="password"
                  placeholder="Enter secret key (e.g. 123456)"
                  value={managementKey}
                  onChange={(e) => setManagementKey(e.target.value)}
                  autoComplete="off"
                  disabled={isSettingKey}
                  className="text-lg py-6"
                />

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="w-full" onClick={handleSetupKey} disabled={isSettingKey}>
                    {isSettingKey ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Finalizing setup...</>
                    ) : (
                      <>Finish Setup<ArrowRight className="ml-2 h-5 w-5" /></>
                    )}
                  </Button>
                </motion.div>

                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setHasCompletedOnboarding(true)}
                    disabled={isSettingKey}
                  >
                    Skip For Now
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
