import { createFileRoute, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { z } from 'zod';
import { meta } from '@/components/site-chrome';
import { Button } from '@/components/ui/button';
import { ResearchWorkspace, workspaceQuery, wordingQuery } from '@/components/research-workspace';

export const Route = createFileRoute('/_authenticated/admin/')({
  validateSearch: z.object({ tab: z.enum(['review','exports','withdrawals','tests','audit']).optional() }),
  head: () => ({ meta: [...meta('Research workspace — The Human Perspective Project', 'Private human review, consent-gated exports, and withdrawal processing.').meta, { name: 'robots', content: 'noindex' }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(workspaceQuery), context.queryClient.ensureQueryData(wordingQuery)]); },
  component: AdminPage,
  errorComponent: AdminError,
  notFoundComponent: () => <p className="p-10">Research workspace not found.</p>,
});
function AdminError({ error }: ErrorComponentProps) { const router=useRouter(); return <div className="mx-auto max-w-xl space-y-4 px-5 py-16"><p role="alert">{error instanceof Error ? error.message : 'The workspace could not be loaded.'}</p><Button onClick={()=>router.invalidate()}>Try again</Button><Button variant="outline" onClick={()=>router.navigate({to:'/auth'})}>Team sign in</Button></div>; }
function AdminPage() { const {tab}=Route.useSearch(); const navigate=Route.useNavigate(); return <ResearchWorkspace tab={tab??'review'} setTab={(value)=>{void navigate({search:{tab:value}});}}/>; }
