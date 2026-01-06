/**
 * About Page
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { APP_VERSION } from '@/utils/constants';
import { User, Github, ExternalLink } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

export function AboutPage() {
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
          <Badge variant="secondary" className="text-sm">v{APP_VERSION}</Badge>
        </div>
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
