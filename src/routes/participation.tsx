import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { meta, PageHeader } from '@/components/site-chrome';
import { wordingQuery } from '@/components/research-workspace';
import { manageParticipation } from '@/lib/research.functions';
import { updateProblems } from '@/lib/research-rules';
import { consentSchema, EMPTY_CONSENT, type Consent } from '@/lib/contribution-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
export const Route=createFileRoute('/participation')({
 head:()=>meta('Manage participation — The Human Perspective Project','Use your private reference to withdraw or change each research permission.'),
 loader:({context})=>context.queryClient.ensureQueryData(wordingQuery),component:Participation,
 errorComponent:({error})=> <ParticipationError message={error instanceof Error ? error.message : 'The participation page could not be loaded.'}/>,notFoundComponent:()=> <p className="p-10">Participation page unavailable.</p>,
});
function ParticipationError({message}:{message:string}) { const router=useRouter();return <div className="p-10"><p role="alert">{message}</p><Button onClick={()=>router.invalidate()}>Try again</Button></div>; }
const labels:Record<keyof Consent,string>={research_analysis:'Research analysis',audio:'Private audio',transcription:'Transcription',ai_evaluation:'AI evaluation',ai_training:'AI training or fine-tuning',public_excerpts:'Public de-identified excerpts'};
function Participation(){
 const {data:wording}=useSuspenseQuery(wordingQuery);const manage=useServerFn(manageParticipation);
 const [reference,setReference]=useState('');const [loaded,setLoaded]=useState(false);const [hasAudio,setHasAudio]=useState(false);const [consent,setConsent]=useState<Consent>(EMPTY_CONSENT);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [confirm,setConfirm]=useState(false);const [withdrawConfirm,setWithdrawConfirm]=useState(false);const [failed,setFailed]=useState(false);
 async function act(action:'read'|'withdraw'|'update') {setBusy(true);setMessage('');setFailed(false);try{
  if(action==='update'){const p=updateProblems(consent,hasAudio);if(p.length)throw new Error(p.join(' '));}
  const result=await manage({data:{reference,action,...(action==='update'?{version:wording.id,consent}:{})}});
  if(action==='read'){const v=z.object({hasAudio:z.boolean(),consent:consentSchema}).parse(result);setHasAudio(v.hasAudio);setConsent(v.consent);setLoaded(true);setConfirm(false);}else{const v=z.object({status:z.string()}).parse(result);setMessage(v.status==='withdrawn'?'Your contribution has been withdrawn. Future research use is blocked.':'Your updated permissions have been saved. Earlier choices remain in your history.');setLoaded(false);setReference('');setWithdrawConfirm(false);}
 }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:'The request could not be completed.');}finally{setBusy(false);}}
 return <><PageHeader eyebrow="Your choices" title="Manage participation">Your private reference is all you need. No account required.</PageHeader><div className="mx-auto max-w-2xl space-y-6 px-5 py-12"><form onSubmit={(e)=>{e.preventDefault();void act('read');}} className="space-y-3"><Label htmlFor="private-reference">Private reference</Label><Input id="private-reference" autoComplete="off" value={reference} onChange={(e)=>{setReference(e.target.value);setLoaded(false);setConfirm(false);setWithdrawConfirm(false);}} required placeholder="HPP-XXXX-XXXX-XXXX-XXXX"/><Button disabled={busy}>View my permissions</Button></form>{message&&<p role={failed?'alert':'status'}>{message}</p>}
 {loaded&&<><form className="space-y-5 border-t border-border pt-6" onSubmit={(e)=>{e.preventDefault();void act('update');}}><h2 className="text-2xl text-primary">Your permissions</h2><p className="text-sm text-muted-foreground">Wording version {wording.version_label}. Turning off research analysis withdraws your contribution.</p>{(Object.keys(labels) as (keyof Consent)[]).filter((k)=>hasAudio||(k!=='audio'&&k!=='transcription')).map((k)=><label key={k} className="flex items-start gap-3"><Checkbox checked={consent[k]} onCheckedChange={(v)=>{setConsent((c)=>({...c,[k]:v===true,...(k==='audio'&&v!==true?{transcription:false}:{})}));setConfirm(false);}}/><span className="text-sm"><strong>{labels[k]}.</strong> {wording[`${k}_text`]}</span></label>)}<label className="flex items-start gap-3"><Checkbox checked={confirm} onCheckedChange={(v)=>setConfirm(v===true)}/><span>I have read this wording and confirm these permission choices.</span></label><Button disabled={busy||!confirm}>Save permissions</Button></form><section className="space-y-4 border-t border-border pt-6"><h2 className="text-2xl text-primary">Withdraw my contribution</h2><p>Withdrawal stops future use immediately. Copies already downloaded or published need research-team follow-up and cannot be recalled automatically.</p><label className="flex items-start gap-3"><Checkbox checked={withdrawConfirm} onCheckedChange={(v)=>setWithdrawConfirm(v===true)}/>I want to withdraw this contribution.</label><Button variant="destructive" disabled={busy||!withdrawConfirm} onClick={()=>act('withdraw')}>Confirm withdrawal</Button></section></>}
 </div></>;
}
