import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { PROVIDERS } from '@/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Trash2,
  AlertCircle,
  Plus,
  Loader2,
  CheckCircle,
  ExternalLink,
  ClipboardCopy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Key,
  Download,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { maskEmail } from '@/shared/utils/privacy';
import {
  useProvidersPresenter,
  formatName,
  getProviderIconInfo,
} from '@/features/providers/useProvidersPresenter';

export function ProvidersPage() {
  const { t } = useTranslation();
  const {
    isAuthenticated,
    files,
    loadingFiles,
    filesError,
    groupedFiles,
    expandedProviders,
    toggleProviderExpanded,
    fileToDelete,
    setFileToDelete,
    executeDelete,
    providerStates,
    selectedProvider,
    setSelectedProvider,
    projectInput,
    setProjectInput,
    callbackUrl,
    setCallbackUrl,
    startAuth,
    cancelAuth,
    submitCallback,
    updateProviderState,
    copyToClipboard,
    downloadAuthFile,
    downloadAllAuthFiles,
    uploadAuthFile,
    isPrivacyMode,
    togglePrivacyMode,
    openInBrowser,
    isDeletingAll,
    executeDeleteAll,
    showDeleteAllConfirmation,
    setShowDeleteAllConfirmation,
    copyRefreshToken,

    // Copy All
    showCopyAllModal,
    setShowCopyAllModal,
    copyingAll,
    selectedProvidersForCopy,
    openCopyAllModal,
    toggleCopyProvider,
    executeCopyAll,
  } = useProvidersPresenter();

  if (!isAuthenticated) {
     return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold">{t('providers.title', 'Providers')}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('providers.connectPrompt')}</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
        <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent className="border-border/50">
          <AlertDialogHeader>
                    <AlertDialogTitle>{t('common.confirm', 'Are you sure?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('common.deleteWarning', 'This action cannot be undone. This will permanently delete your account connection.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-500 hover:bg-red-600 text-white">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAllConfirmation} onOpenChange={setShowDeleteAllConfirmation}>
        <AlertDialogContent className="border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm', 'Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('providers.deleteAllConfirm', 'This will permanently delete all connected accounts. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeDeleteAll();
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isDeletingAll}
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.deleting', 'Deleting...')}
                </>
              ) : (
                t('common.deleteAll', 'Delete All')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('providers.title')}</h1>

          {/* Privacy Toggle */}
           <Button
            variant="outline"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? "Show private info" : "Hide private info"}
          >
            {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {/* --- Section 1: Connected Accounts --- */}
        <section className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-5 w-5" />
                    {t('providers.connectedAccounts')} ({files.length})
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openCopyAllModal}
                    className="h-8 text-xs"
                    disabled={files.length === 0}
                  >
                    <Key className="mr-2 h-3.5 w-3.5" />
                    {t('common.copyAll', 'Copy All')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAllAuthFiles}
                    className="h-8 text-xs"
                    disabled={files.length === 0}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {t('providers.downloadAll', 'Download All')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={uploadAuthFile}
                    className="h-8 text-xs"
                  >
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    {t('providers.upload', 'Upload')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteAllConfirmation(true)}
                    className="h-8 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 shadow-none border border-red-500/20 disabled:opacity-50"
                    disabled={files.length === 0}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {t('common.deleteAll', 'Delete All')}
                  </Button>
                </div>
            </div>

            {filesError && (
                <div className="rounded-md bg-destructive/10 p-4 text-destructive">
                  {filesError}
                </div>
            )}

            {/* List of Connected Accounts */}
            {!loadingFiles && files.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    <p>{t('providers.noAccounts')}</p>
                </div>
            )}

            <div className="space-y-2">
                 {groupedFiles.map(([providerId, group]) => {
                   const isExpanded = expandedProviders[providerId] ?? true;

                   return (
                     <div key={providerId} className="border rounded-lg overflow-hidden">
                       {/* Provider Group Header */}
                       <button
                         onClick={() => toggleProviderExpanded(providerId)}
                         className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                       >
                         {isExpanded ? (
                           <ChevronDown className="h-4 w-4 text-muted-foreground" />
                         ) : (
                           <ChevronRight className="h-4 w-4 text-muted-foreground" />
                         )}
                         <img
                           src={group.iconInfo.path}
                           alt={group.displayName}
                           className={`h-5 w-5 object-contain ${group.iconInfo.needsInvert ? 'invert-on-dark' : ''}`}
                         />
                         <span className="font-medium text-sm">{group.displayName}</span>
                         <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                           {group.files.length}
                         </Badge>
                       </button>

                       {/* Expanded Files List */}
                       {isExpanded && (
                         <div className="border-t bg-muted/20">
                           {group.files.map((file) => {
                             const p = (file.provider || '').toLowerCase();

                             let rawName: string;
                             if (p.includes('kiro')) {
                               const topEmail = (file.email as string) || (file.account as string);
                               if (topEmail && topEmail.trim() !== '') {
                                 rawName = formatName(topEmail);
                               } else {
                                 const filename = file.filename || file.id || '';
                                 const match = filename.match(/kiro-(\w+)/i);
                                 if (match && match[1]) {
                                   const method = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                                   rawName = `Kiro (${method})`;
                                 } else {
                                   const metaEmail = (file.metadata?.email as string);
                                   const authMethod = (file.metadata?.provider as string) || (file.metadata?.auth_method as string);
                                   if (metaEmail && metaEmail.trim() !== '') {
                                     rawName = formatName(metaEmail);
                                   } else if (authMethod) {
                                     rawName = `Kiro (${authMethod})`;
                                   } else {
                                     rawName = 'Kiro';
                                   }
                                 }
                               }
                             } else {
                               rawName = formatName((file.metadata?.email as string) || (file.account as string) || file.filename);
                             }
                             const displayName = isPrivacyMode ? maskEmail(rawName) : rawName;

                             return (
                               <div
                                 key={file.id}
                                 className="group flex items-center justify-between pl-10 pr-3 py-2 hover:bg-muted/50 transition-colors"
                               >
                                 <div className="flex items-center gap-3">
                                   <img
                                     src={group.iconInfo.path}
                                     alt={file.provider}
                                     className={`h-5 w-5 object-contain ${group.iconInfo.needsInvert ? 'invert-on-dark' : ''}`}
                                   />
                                   <div>
                                     <div className="font-medium text-sm text-foreground">{displayName}</div>
                                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                       <span>{file.provider}</span>
                                       <span className="text-[10px]">•</span>
                                       <span>{t('providers.active')}</span>
                                     </div>
                                   </div>
                                 </div>

                                 <div className="flex items-center gap-1">
                                   <Button
                                     size="icon"
                                     variant="ghost"
                                     className="h-8 w-8 text-primary hover:bg-primary/10 opacity-80 group-hover:opacity-100"
                                     onClick={() => downloadAuthFile(file.name || file.filename || file.id)}
                                     title={t('providers.download', 'Download')}
                                   >
                                     <Download className="h-4 w-4" />
                                   </Button>
                                   <Button
                                     size="icon"
                                     variant="ghost"
                                     className="h-8 w-8 text-primary hover:bg-primary/10 opacity-80 group-hover:opacity-100"
                                     onClick={() => copyRefreshToken(file.name || file.filename || file.id)}
                                     title={t('common.copyRefreshToken', 'Copy Refresh Token')}
                                   >
                                     <Key className="h-4 w-4" />
                                   </Button>
                                   <Button
                                     size="icon"
                                     variant="ghost"
                                     className="h-8 w-8 text-destructive hover:bg-destructive/10 opacity-80 group-hover:opacity-100"
                                     onClick={() => setFileToDelete(file.id)}
                                     title={t('common.delete')}
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   );
                 })}

                 {loadingFiles && (
                   <div className="flex justify-center py-4">
                     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                   </div>
                 )}
            </div>
        </section>

        {/* --- Section 2: Add Provider --- */}
        <section className="space-y-4 pt-4 border-t">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5 text-muted-foreground" />
                {t('providers.addProvider')}
            </h2>

            <div className="grid gap-2">
                {PROVIDERS.map((provider) => {
                    const state = providerStates[provider.id] || { status: 'idle' };
                    const isWaiting = state.status === 'waiting' || state.status === 'polling';
                    const isSuccess = state.status === 'success';

                    const iconInfo = getProviderIconInfo(provider.id);

                    const isSelected = selectedProvider === provider.id;

                    if (isSelected) {
                        return (
                             <Card key={provider.id} className="border-primary/50 bg-accent/50">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{provider.name}</CardTitle>
                                        <Button variant="ghost" size="sm" onClick={() => cancelAuth(provider.id)}>{t('common.cancel')}</Button>
                                    </div>
                                    <CardDescription>
                                        {/* Show different message based on state */}
                                        {state.status === 'idle' && provider.requiresProjectId ? t('providers.enterConfig') :
                                         state.status === 'error' ? t('providers.connectionFailed') :
                                         isWaiting ? t('providers.waitingAuth') : t('providers.connecting')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {state.error && <p className="text-sm text-destructive">{state.error}</p>}

                                    {/* Input Project ID if needed and not yet started (or error) */}
                                    {provider.requiresProjectId && (state.status === 'idle' || state.status === 'error') && (
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">
                                                    {t('providers.googleProjectId')} <span className="text-xs font-normal text-muted-foreground">({t('providers.optional')})</span>
                                                </div>
                                                <Input
                                                    placeholder={t('providers.projectIdPlaceholder')}
                                                    value={projectInput}
                                                    onChange={(e) => setProjectInput(e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {t('providers.projectIdHelp')}
                                                </p>
                                            </div>
                                            <Button
                                                className="w-full"
                                                onClick={() => startAuth(provider.id, { projectId: projectInput || undefined })}
                                            >
                                                {state.status === 'error' ? t('providers.retryConnection') : (projectInput ? t('providers.connectWithProject') : t('providers.autoSelect'))}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Normal Auth Flow (Polling/Waiting) - Only if NOT Error and NOT Idle */}
                                    {state.status !== 'idle' && state.status !== 'error' && (
                                        <>
                                            {/* Copilot Device Code Display */}
                                            {provider.id === 'copilot' && state.userCode && (
                                              <div className="space-y-3">
                                                <p className="text-sm text-muted-foreground">
                                                  {t('providers.copilotInstructions', 'Enter the code below at GitHub:')}
                                                </p>
                                                <div className="flex items-center justify-center gap-3">
                                                  <code className="text-3xl font-mono font-bold tracking-widest bg-muted px-4 py-2 rounded-lg">
                                                    {state.userCode}
                                                  </code>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(state.userCode!)}
                                                    title={t('common.copy')}
                                                  >
                                                    <ClipboardCopy className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            )}

                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>{t('providers.completeLogin')}</span>
                                            </div>

                                            {state.url && (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => openInBrowser(state.url!)}>
                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                        {t('providers.openLink')}
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(state.url!)}>
                                                        <ClipboardCopy className="mr-2 h-4 w-4" />
                                                        {t('common.copy')}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                     {/* Callback fallback - Only show if polling started */}
                                     {state.status !== 'idle' && (
                                         <div className="pt-2 border-t">
                                            <p className="mb-2 text-xs text-muted-foreground">{t('providers.manualCallback')}</p>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={t('oauth.pasteCallback')}
                                                    value={callbackUrl}
                                                    onChange={(e) => setCallbackUrl(e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                                <Button size="sm" onClick={submitCallback} disabled={!callbackUrl}>
                                                    {t('providers.verify')}
                                                </Button>
                                            </div>
                                         </div>
                                     )}
                                </CardContent>
                             </Card>
                        );
                    }

                    /* Default List Item View */
                    return (
                        <div
                            key={provider.id}
                            className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 cursor-pointer"
                            onClick={() => {
                                if (provider.requiresProjectId) {
                                     setSelectedProvider(provider.id);
                                     setProjectInput('');
                                     updateProviderState(provider.id, { status: 'idle' });
                                } else {
                                     startAuth(provider.id);
                                }
                            }}
                        >
                             <div className="flex items-center gap-3">
                                 {/* Icon */}
                                 <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/50 p-1 overflow-hidden">
                                       <img
                                        src={iconInfo.path}
                                        alt={provider.name}
                                        className={`h-full w-full object-contain ${iconInfo.needsInvert ? 'invert-on-dark' : ''}`}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                       />
                                       <span className="hidden text-xs font-bold">{provider.id.slice(0,2).toUpperCase()}</span>
                                 </div>
                                 <span className="font-medium">{provider.name}</span>
                                 {provider.requiresProjectId && (
                                    <Badge variant="outline" className="text-[10px] h-5">Project ID</Badge>
                                 )}
                             </div>

                             <div className="flex items-center gap-2">
                                {isSuccess && <Badge className="bg-green-500">{t('auth.connected')}</Badge>}
                                <div
                                    className="h-8 w-8 rounded-full border p-0 flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
                                >
                                    <Plus className="h-4 w-4" />
                                </div>
                             </div>
                        </div>
                    );
                })}
            </div>
        </section>

        <Dialog open={showCopyAllModal} onOpenChange={setShowCopyAllModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('providers.copyAllTitle', 'Copy All Refresh Tokens')}</DialogTitle>
            <DialogDescription>
              {t('providers.selectProviders', 'Select the providers you want to include in the copy.')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <div className="space-y-4">
                {groupedFiles.map(([providerId, group]) => (
                  <div key={providerId} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`copy-${providerId}`}
                      checked={selectedProvidersForCopy.includes(providerId)}
                      onChange={() => toggleCopyProvider(providerId)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                    />
                    <label
                      htmlFor={`copy-${providerId}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer select-none"
                    >
                       <img
                            src={group.iconInfo.path}
                            alt={group.displayName}
                            className={`h-4 w-4 object-contain ${group.iconInfo.needsInvert ? 'invert-on-dark' : ''}`}
                          />
                      {group.displayName}
                      <span className="text-xs text-muted-foreground">({group.files.length})</span>
                    </label>
                  </div>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyAllModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={executeCopyAll} disabled={copyingAll || selectedProvidersForCopy.length === 0}>
              {copyingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.copying', 'Copying...')}
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  {t('common.copy', 'Copy')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
