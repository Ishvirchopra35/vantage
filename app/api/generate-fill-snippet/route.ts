import { requireAuth } from '@/lib/requireAuth'
import { ok, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  let jobId: string | undefined
  try {
    const body = await request.json()
    jobId = body?.jobId
  } catch {
    // jobId is optional - proceed without it
  }

  try {
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone, linkedin_url, portfolio_url, github_url')
      .eq('id', user.id)
      .single()

    if (!profile) {
      await logRoute('generate-fill-snippet', user.id, Date.now() - start, 404)
      return ok({ snippet: null })
    }

    const fullName = (profile.full_name as string | null) ?? ''
    const nameParts = fullName.trim().split(/\s+/)
    const firstName = nameParts[0] ?? ''
    const lastName = nameParts.slice(1).join(' ')

    let coverLetter: string | null = null
    let answers: Record<string, string> = {}

    if (jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single()

      if (job) {
        const [docResult, questionsResult] = await Promise.all([
          supabase
            .from('documents')
            .select('content')
            .eq('user_id', user.id)
            .eq('job_id', job.id)
            .eq('type', 'cover_letter')
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('application_questions')
            .select('question, user_edited_answer, generated_answer')
            .eq('user_id', user.id)
            .eq('job_id', job.id),
        ])

        if (docResult.data?.content) coverLetter = docResult.data.content as string

        if (questionsResult.data) {
          for (const q of questionsResult.data as Array<{
            question: string
            user_edited_answer: string | null
            generated_answer: string | null
          }>) {
            const answer = q.user_edited_answer ?? q.generated_answer ?? ''
            if (answer) answers[q.question] = answer
          }
        }
      }
    }

    const kit = {
      firstName,
      lastName,
      fullName,
      email: profile.email as string | null,
      phone: profile.phone as string | null,
      linkedin: profile.linkedin_url as string | null,
      portfolio: (profile.portfolio_url as string | null) ?? '',
      github: (profile.github_url as string | null) ?? '',
      coverLetter,
      answers,
    }

    const kitJson = JSON.stringify(kit)

    // Self-contained IIFE - uses nativeSetter pattern, never submits
    const snippet = `(function(){const kit=${kitJson};const nS=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;const tS=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;function fill(el,v){if(!el||!v)return;if(el.tagName==='TEXTAREA'){if(tS)tS.call(el,v);else el.value=v;}else{if(nS)nS.call(el,v);else el.value=v;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}function lbl(el){const id=el.id||'';const forLbl=id?document.querySelector('label[for="'+id+'"]')?.textContent||'':'';return(forLbl+' '+el.getAttribute('aria-label')+''+el.placeholder+' '+el.name+' '+id).toLowerCase();}const map={'first name':kit.firstName,'last name':kit.lastName,'full name':kit.fullName,'email':kit.email,'phone':kit.phone,'linkedin':kit.linkedin,'portfolio':kit.portfolio,'github':kit.github,'cover letter':kit.coverLetter};let n=0;document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=file]):not([type=checkbox]):not([type=radio]),textarea').forEach(el=>{if(el.disabled||el.readOnly||el.value)return;const l=lbl(el);for(const[k,v]of Object.entries(map)){if(v&&l.includes(k)){fill(el,v);n++;return;}}if(el.type==='email'&&kit.email){fill(el,kit.email);n++;return;}if(el.type==='tel'&&kit.phone){fill(el,kit.phone);n++;return;}for(const[q,a]of Object.entries(kit.answers||{})){const ws=q.toLowerCase().split(/\\s+/).filter(w=>w.length>3);if(ws.length&&ws.filter(w=>l.includes(w)).length/ws.length>=0.4){fill(el,a);n++;return;}}});console.log('[Vantage] Filled '+n+' fields. Review and submit manually.');})();`

    await logRoute('generate-fill-snippet', user.id, Date.now() - start, 200)
    return ok({ snippet })
  } catch (e) {
    await logRoute('generate-fill-snippet', user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
