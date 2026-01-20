import { useMemo } from 'react';
import { HistoryItem } from './useSmartStorage';
import { checkSmart } from '@/lib/smart-checker';

export interface ScoreDistribution {
  score: number;
  count: number;
}

export interface BarrierDistribution {
  barrier: string;
  count: number;
}

export interface WeeklyTrend {
  week: string;
  count: number;
  avgScore: number;
}

export interface ModeBreakdown {
  mode: 'now' | 'future';
  count: number;
}

export interface WeakLanguageItem {
  word: string;
  count: number;
}

export interface ActionAnalytics {
  totalActions: number;
  averageScore: number;
  scoreDistribution: ScoreDistribution[];
  barrierDistribution: BarrierDistribution[];
  weeklyTrend: WeeklyTrend[];
  modeBreakdown: ModeBreakdown[];
  commonWeakLanguage: WeakLanguageItem[];
  topParticipants: { name: string; count: number }[];
  perfectScoreCount: number;
  needsWorkCount: number;
}

const WEAK_WORDS = ['try', 'maybe', 'might', 'possibly', 'consider', 'hope', 'attempt', 'think about', 'look into', 'explore', 'should be', 'could be', 'would be', 'if possible', 'when possible', 'eventually'];

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function formatWeekLabel(weekKey: string): string {
  const [year, week] = weekKey.split('-W');
  return `W${week} '${year.slice(2)}`;
}

export function useActionAnalytics(history: HistoryItem[]): ActionAnalytics {
  return useMemo(() => {
    if (history.length === 0) {
      return {
        totalActions: 0,
        averageScore: 0,
        scoreDistribution: [0, 1, 2, 3, 4, 5].map(score => ({ score, count: 0 })),
        barrierDistribution: [],
        weeklyTrend: [],
        modeBreakdown: [
          { mode: 'now', count: 0 },
          { mode: 'future', count: 0 },
        ],
        commonWeakLanguage: [],
        topParticipants: [],
        perfectScoreCount: 0,
        needsWorkCount: 0,
      };
    }

    // Calculate scores for each item
    const scores: number[] = [];
    const scoreCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const barrierCount: Record<string, number> = {};
    const weeklyData: Record<string, { count: number; totalScore: number }> = {};
    const modeCount: Record<string, number> = { now: 0, future: 0 };
    const weakWordCount: Record<string, number> = {};
    const participantCount: Record<string, number> = {};

    for (const item of history) {
      // Calculate SMART score
      const check = checkSmart(item.text, {
        forename: item.meta.forename,
        barrier: item.meta.barrier,
        timescale: item.meta.timescale,
        date: item.meta.date,
      });
      const score = check.overallScore;
      scores.push(score);
      scoreCount[score] = (scoreCount[score] || 0) + 1;

      // Mode breakdown
      modeCount[item.mode] = (modeCount[item.mode] || 0) + 1;

      // Barrier distribution
      const barrier = item.meta.barrier?.slice(0, 30) || 'Unknown';
      barrierCount[barrier] = (barrierCount[barrier] || 0) + 1;

      // Weekly trend
      const createdDate = new Date(item.createdAt);
      const weekKey = getWeekKey(createdDate);
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { count: 0, totalScore: 0 };
      }
      weeklyData[weekKey].count++;
      weeklyData[weekKey].totalScore += score;

      // Weak language detection
      const textLower = item.text.toLowerCase();
      for (const word of WEAK_WORDS) {
        if (textLower.includes(word)) {
          weakWordCount[word] = (weakWordCount[word] || 0) + 1;
        }
      }

      // Participant tracking
      const forename = item.meta.forename?.trim();
      if (forename) {
        participantCount[forename] = (participantCount[forename] || 0) + 1;
      }
    }

    // Calculate averages and distributions
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const scoreDistribution: ScoreDistribution[] = [0, 1, 2, 3, 4, 5].map(score => ({
      score,
      count: scoreCount[score] || 0,
    }));

    const barrierDistribution: BarrierDistribution[] = Object.entries(barrierCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([barrier, count]) => ({ barrier, count }));

    const weeklyTrend: WeeklyTrend[] = Object.entries(weeklyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([week, data]) => ({
        week: formatWeekLabel(week),
        count: data.count,
        avgScore: Math.round((data.totalScore / data.count) * 10) / 10,
      }));

    const modeBreakdown: ModeBreakdown[] = [
      { mode: 'now', count: modeCount.now || 0 },
      { mode: 'future', count: modeCount.future || 0 },
    ];

    const commonWeakLanguage: WeakLanguageItem[] = Object.entries(weakWordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    const topParticipants = Object.entries(participantCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const perfectScoreCount = scoreCount[5] || 0;
    const needsWorkCount = (scoreCount[0] || 0) + (scoreCount[1] || 0) + (scoreCount[2] || 0);

    return {
      totalActions: history.length,
      averageScore: Math.round(averageScore * 10) / 10,
      scoreDistribution,
      barrierDistribution,
      weeklyTrend,
      modeBreakdown,
      commonWeakLanguage,
      topParticipants,
      perfectScoreCount,
      needsWorkCount,
    };
  }, [history]);
}
