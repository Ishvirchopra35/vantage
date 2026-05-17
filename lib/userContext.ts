// SERVER-SIDE ONLY - never import this in client components.
// This file builds comprehensive user context for AI prompts, fetching from all relevant tables.

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getRemainingLimits } from './rateLimit';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
type ServiceClient = any;

function serviceClient(): any {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase service credentials');
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export interface UserContext {
  // Profile
  fullName?: string | null;
  email?: string | null;
  university?: string | null;
  graduationYear?: number | null;
  yearsExperience?: number | null;
  skills?: string[] | null;
  targetRoles?: string[] | null;
  linkedinUrl?: string | null;

  // Resume
  baseResume?: string | null;

  // Application history
  totalApplications?: number | null;
  responseRate?: number | null; // percentage, 1dp
  statusBreakdown?: {
    applied?: number;
    interviewing?: number;
    rejected?: number;
    offer?: number;
    ghosted?: number;
  } | null;
  mostAppliedRoles?: string[] | null; // top 3
  mostSuccessfulRoles?: string[] | null; // top 2

  // ATS performance
  avgOverallScore?: number | null;
  avgKeywordScore?: number | null;
  commonMissingKeywords?: string[] | null; // top 8
  avgImprovement?: number | null; // points

  // Subscription
  plan?: 'free' | 'pro' | null;
  remainingLimits?: Record<string, number> | null;
}

async function fetchProfile(svc: ServiceClient, userId: string) {
  try {
    const { data } = await svc.from('profiles').select('full_name, email, university, graduation_year, years_experience, skills, target_roles, linkedin_url').eq('id', userId).limit(1).single();
    return data;
  } catch {
    return null;
  }
}

async function fetchBaseResume(svc: ServiceClient, userId: string) {
  try {
    const { data } = await svc.from('resumes').select('raw_text').eq('user_id', userId).eq('is_base', true).order('created_at', { ascending: false }).limit(1).single();
    return data;
  } catch {
    return null;
  }
}

async function fetchApplicationHistory(svc: ServiceClient, userId: string) {
  try {
    const { count: total } = await svc.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('deleted', false);

    const { data: statusData } = await svc.from('applications').select('status').eq('user_id', userId).eq('deleted', false);
    const statuses = (statusData || []) as Array<{ status: string }>;
    const breakdown = {
      applied: statuses.filter((s) => s.status === 'applied').length,
      interviewing: statuses.filter((s) => s.status === 'interviewing').length,
      rejected: statuses.filter((s) => s.status === 'rejected').length,
      offer: statuses.filter((s) => s.status === 'offer').length,
      ghosted: statuses.filter((s) => s.status === 'ghosted').length,
    };
    const responseCount = breakdown.interviewing + breakdown.offer;
    const responseRate = total && total > 0 ? Math.round((responseCount / total) * 1000) / 10 : 0;

    const { data: rolesData } = await svc.from('applications').select('role').eq('user_id', userId).eq('deleted', false);
    const roles = (rolesData || []) as Array<{ role?: string }>;
    const roleCount: Record<string, number> = {};
    roles.forEach((r) => {
      const role = r.role || '';
      roleCount[role] = (roleCount[role] || 0) + 1;
    });
    const sortedRoles = Object.entries(roleCount).sort(([, a], [, b]) => b - a).map(([role]) => role);
    const mostApplied = sortedRoles.slice(0, 3);

    const { data: successData } = await svc.from('applications').select('role').eq('user_id', userId).eq('deleted', false).in('status', ['interviewing', 'offer']);
    const successRoles = (successData || []) as Array<{ role?: string }>;
    const successCount: Record<string, number> = {};
    successRoles.forEach((r) => {
      const role = r.role || '';
      successCount[role] = (successCount[role] || 0) + 1;
    });
    const sortedSuccess = Object.entries(successCount).sort(([, a], [, b]) => b - a).map(([role]) => role);
    const mostSuccess = sortedSuccess.slice(0, 2);

    return { total: total || 0, responseRate, breakdown, mostApplied, mostSuccess };
  } catch {
    return { total: 0, responseRate: 0, breakdown: {}, mostApplied: [], mostSuccess: [] };
  }
}

async function fetchAtsPerformance(svc: ServiceClient, userId: string) {
  try {
    const { data: scores } = await svc.from('ats_scores').select('overall_score, keyword_score, missing_keywords').eq('user_id', userId);
    const scoresData = (scores || []) as Array<{ overall_score?: number; keyword_score?: number; missing_keywords?: string[] }>;

    if (scoresData.length === 0) return { avgOverall: null, avgKeyword: null, missingKeywords: [], avgImprovement: null };

    const avgOverall = scoresData.length > 0 ? Math.round(scoresData.reduce((sum, s) => sum + (s.overall_score || 0), 0) / scoresData.length) : null;
    const avgKeyword = scoresData.length > 0 ? Math.round(scoresData.reduce((sum, s) => sum + (s.keyword_score || 0), 0) / scoresData.length) : null;

    const keywordMap: Record<string, number> = {};
    scoresData.forEach((s) => {
      (s.missing_keywords || []).forEach((kw) => {
        keywordMap[kw] = (keywordMap[kw] || 0) + 1;
      });
    });
    const topKeywords = Object.entries(keywordMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([kw]) => kw);

    const { data: allScores } = await svc.from('ats_scores').select('id, overall_score, is_tailored, job_id').eq('user_id', userId).order('job_id');
    const scoresList = (allScores || []) as Array<{ id?: string; overall_score?: number; is_tailored?: boolean; job_id?: string }>;
    const improvementPairs: number[] = [];
    const jobScores: Record<string, { base?: number; tailored?: number }> = {};
    scoresList.forEach((s) => {
      const jobId = s.job_id || '';
      if (!jobScores[jobId]) jobScores[jobId] = {};
      if (s.is_tailored) {
        jobScores[jobId].tailored = s.overall_score;
      } else {
        jobScores[jobId].base = s.overall_score;
      }
    });
    Object.values(jobScores).forEach((pair) => {
      if (pair.base !== undefined && pair.tailored !== undefined) {
        improvementPairs.push(pair.tailored - pair.base);
      }
    });
    const avgImprovement = improvementPairs.length > 0 ? Math.round(improvementPairs.reduce((a, b) => a + b, 0) / improvementPairs.length) : null;

    return { avgOverall, avgKeyword, missingKeywords: topKeywords, avgImprovement };
  } catch {
    return { avgOverall: null, avgKeyword: null, missingKeywords: [], avgImprovement: null };
  }
}

async function fetchSubscription(svc: ServiceClient, userId: string) {
  try {
    const { data } = await svc.from('subscriptions').select('plan').eq('user_id', userId).limit(1).single();
    return data;
  } catch {
    return null;
  }
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  const svc = serviceClient();

  console.log('[buildUserContext] Starting for userId:', userId);

  // Fetch all data with individual error handling
  let profile = null;
  try {
    console.log('[buildUserContext] Fetching profile...');
    profile = await fetchProfile(svc, userId);
    console.log('[buildUserContext] Profile fetched');
  } catch (e) {
    console.error('[buildUserContext] Profile fetch error:', e);
  }

  let resume = null;
  try {
    console.log('[buildUserContext] Fetching resume...');
    resume = await fetchBaseResume(svc, userId);
    console.log('[buildUserContext] Resume fetched');
  } catch (e) {
    console.error('[buildUserContext] Resume fetch error:', e);
  }

  let appHistory = null;
  try {
    console.log('[buildUserContext] Fetching app history...');
    appHistory = await fetchApplicationHistory(svc, userId);
    console.log('[buildUserContext] App history fetched');
  } catch (e) {
    console.error('[buildUserContext] App history fetch error:', e);
  }

  let ats = null;
  try {
    console.log('[buildUserContext] Fetching ATS performance...');
    ats = await fetchAtsPerformance(svc, userId);
    console.log('[buildUserContext] ATS performance fetched');
  } catch (e) {
    console.error('[buildUserContext] ATS performance fetch error:', e);
  }

  let subscription = null;
  try {
    console.log('[buildUserContext] Fetching subscription...');
    subscription = await fetchSubscription(svc, userId);
    console.log('[buildUserContext] Subscription fetched');
  } catch (e) {
    console.error('[buildUserContext] Subscription fetch error:', e);
  }

  let limits = {};
  try {
    console.log('[buildUserContext] Fetching limits...');
    limits = await getRemainingLimits(userId);
    console.log('[buildUserContext] Limits fetched');
  } catch (e) {
    console.error('[buildUserContext] Limits fetch error:', e);
    limits = {};
  }

  console.log('[buildUserContext] All data fetched successfully');

  return {
    fullName: profile?.full_name,
    email: profile?.email,
    university: profile?.university,
    graduationYear: profile?.graduation_year,
    yearsExperience: profile?.years_experience,
    skills: profile?.skills,
    targetRoles: profile?.target_roles,
    linkedinUrl: profile?.linkedin_url,

    baseResume: resume?.raw_text,

    totalApplications: appHistory?.total,
    responseRate: appHistory?.responseRate,
    statusBreakdown: appHistory?.breakdown,
    mostAppliedRoles: appHistory?.mostApplied,
    mostSuccessfulRoles: appHistory?.mostSuccess,

    avgOverallScore: ats?.avgOverall,
    avgKeywordScore: ats?.avgKeyword,
    commonMissingKeywords: ats?.missingKeywords,
    avgImprovement: ats?.avgImprovement,

    plan: subscription?.plan || 'free',
    remainingLimits: limits,
  };
}

export function formatContextForPrompt(ctx: UserContext): string {
  const resumeSnippet = ctx.baseResume ? ctx.baseResume.slice(0, 3000) : 'No resume uploaded yet';
  const skillsStr = (ctx.skills || []).join(', ') || 'None specified';
  const targetStr = (ctx.targetRoles || []).join(', ') || 'Not specified';
  const appliedRoles = (ctx.mostAppliedRoles || []).join(', ') || 'N/A';
  const successRoles = (ctx.mostSuccessfulRoles || []).join(', ') || 'N/A';
  const keywords = (ctx.commonMissingKeywords || []).join(', ') || 'None tracked';
  const breakdown = ctx.statusBreakdown || {};

  return `CANDIDATE PROFILE:
Name: ${ctx.fullName || 'Not provided'} | University: ${ctx.university || 'Not provided'}, graduating ${ctx.graduationYear || 'N/A'}
Experience: ${ctx.yearsExperience ?? 'Not provided'} years | Target roles: ${targetStr}
Skills: ${skillsStr}

APPLICATION HISTORY:
Total applications: ${ctx.totalApplications || 0} | Response rate: ${ctx.responseRate ?? 0}% | Active interviews: ${breakdown.interviewing || 0}
Most applied roles: ${appliedRoles} | Most successful roles: ${successRoles}
Status: Applied ${breakdown.applied || 0} / Interviewing ${breakdown.interviewing || 0} / Rejected ${breakdown.rejected || 0} / Offer ${breakdown.offer || 0} / Ghosted ${breakdown.ghosted || 0}

ATS PERFORMANCE:
Average ATS score: ${ctx.avgOverallScore ?? 'N/A'}/100 | Average improvement from tailoring: +${ctx.avgImprovement ?? 0} points
Most common missing keywords: ${keywords}

RESUME SUMMARY:
${resumeSnippet}`;
}

export default { buildUserContext, formatContextForPrompt };
