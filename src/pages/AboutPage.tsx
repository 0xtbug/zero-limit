/**
 * About Page
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUpdateStore } from '@/stores';
import { useAppVersion } from '@/hooks';
import { User, Github, ExternalLink, RefreshCw, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

export function AboutPage() {
  const { status, updateInfo, downloadProgress, error, checkForUpdates, downloadAndInstall } = useUpdateStore();
  const version = useAppVersion();

  const openGitHub = async () => {
    await open('https://github.com/0xtbug/zero-limit');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
      {/* App Icon & Title */}
      <div className="flex flex-col items-center space-y-4">
        <img
          src="/icon.png"
          alt="ZeroLimit"
          className="h-24 w-24 rounded-2xl shadow-lg"
        />
        <h1 className="text-3xl font-bold">ZeroLimit</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">v{version}</Badge>
        </div>
      </div>

      {/* Update Section */}
      <div className="flex flex-col items-center space-y-3 w-full max-w-sm">
        {/* Check for Updates Button */}
        {status !== 'available' && status !== 'downloading' && (
          <Button
            variant="outline"
            size="sm"
            onClick={checkForUpdates}
            disabled={status === 'checking'}
          >
            {status === 'checking' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check for Updates
              </>
            )}
          </Button>
        )}

        {/* Up to date message */}
        {status === 'uptodate' && (
          <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-500 animate-in fade-in slide-in-from-top-1 duration-300 py-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">You are using the latest version.</span>
          </div>
        )}

        {/* Update Available */}
        {status === 'available' && updateInfo && (
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Update Available: v{updateInfo.version}
            </p>
            <Button size="sm" onClick={downloadAndInstall}>
              <Download className="mr-2 h-4 w-4" />
              Download & Install
            </Button>
          </div>
        )}

        {/* Downloading */}
        {status === 'downloading' && (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Downloading...</span>
              <span>{downloadProgress}%</span>
            </div>
            <Progress value={downloadProgress} />
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Info Cards */}
      <div className="flex gap-4">
        <Card className="flex flex-col items-center p-6 min-w-[140px]">
          <User className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Author</span>
          <span className="font-semibold">0xtbug</span>
        </Card>

        <Card
          className="flex flex-col items-center p-6 min-w-[140px] cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={openGitHub}
        >
          <Github className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">GitHub</span>
          <span className="font-semibold flex items-center gap-1">
            View Code <ExternalLink className="h-3 w-3" />
          </span>
        </Card>
      </div>

      {/* Tech Stack Badges */}
      <div className="flex items-center gap-3">
        <Badge variant="outline">Tauri v2</Badge>
        <Badge variant="outline">React 19</Badge>
        <Badge variant="outline">TypeScript</Badge>
      </div>

      {/* Copyright */}
      <p className="text-xs text-muted-foreground/50">
        Copyright © 2025 0xtbug. All rights reserved.
      </p>
    </div>
  );
}
