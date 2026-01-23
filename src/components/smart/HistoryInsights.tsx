import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, Target, Users, AlertTriangle, Award, Clock } from 'lucide-react';
import { useActionAnalytics, ActionAnalytics } from '@/hooks/useActionAnalytics';
import { HistoryItem } from '@/hooks/useSmartStorage';
import { cn } from '@/lib/utils';

interface HistoryInsightsProps {
  history: HistoryItem[];
  className?: string;
}

const SCORE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981'];
const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))'];

function StatCard({ icon: Icon, label, value, subtext, className }: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  subtext?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("p-4 rounded-xl border bg-card", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export function HistoryInsights({ history, className }: HistoryInsightsProps) {
  const analytics = useActionAnalytics(history);

  if (history.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <TrendingUp className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-muted-foreground">No data yet</h3>
        <p className="text-sm text-muted-foreground">Save some actions to see analytics</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Total Actions" value={analytics.totalActions} />
        <StatCard icon={Target} label="Avg Score" value={`${analytics.averageScore}/5`} />
        <StatCard icon={Award} label="Perfect Scores" value={analytics.perfectScoreCount} />
        <StatCard icon={AlertTriangle} label="Needs Work" value={analytics.needsWorkCount} />
      </div>

      {/* Score Distribution */}
      <motion.div
        className="p-4 rounded-xl border bg-card space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h4 className="font-medium text-sm">Score Distribution</h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.scoreDistribution}>
              <XAxis dataKey="score" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {analytics.scoreDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SCORE_COLORS[entry.score]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Mode Breakdown & Weekly Trend */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Mode Breakdown */}
        <motion.div
          className="p-4 rounded-xl border bg-card space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h4 className="font-medium text-sm">Mode Breakdown</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.modeBreakdown.filter(m => m.count > 0)}
                  dataKey="count"
                  nameKey="mode"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={2}
                >
                  {analytics.modeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value, name) => [value, name === 'now' ? 'Barrier Actions' : 'Task-based']}
                />
                <Legend
                  formatter={(value) => value === 'now' ? 'Barrier Actions' : 'Task-based'}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Weekly Trend */}
        {analytics.weeklyTrend.length > 1 && (
          <motion.div
            className="p-4 rounded-xl border bg-card space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="font-medium text-sm">Weekly Trend</h4>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.weeklyTrend}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 5]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Avg Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>

      {/* Barriers & Weak Language */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Barriers */}
        {analytics.barrierDistribution.length > 0 && (
          <motion.div
            className="p-4 rounded-xl border bg-card space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h4 className="font-medium text-sm">Top Barriers</h4>
            <div className="space-y-2">
              {analytics.barrierDistribution.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / analytics.totalActions) * 100}%` }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 w-16 truncate" title={item.barrier}>
                    {item.barrier}
                  </span>
                  <span className="text-xs font-medium w-6 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Weak Language */}
        {analytics.commonWeakLanguage.length > 0 && (
          <motion.div
            className="p-4 rounded-xl border bg-card space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h4 className="font-medium text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Common Weak Language
            </h4>
            <div className="flex flex-wrap gap-2">
              {analytics.commonWeakLanguage.map((item, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-700"
                >
                  "{item.word}" ({item.count}×)
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Replace these with stronger commitment words
            </p>
          </motion.div>
        )}
      </div>

      {/* Top Participants */}
      {analytics.topParticipants.length > 0 && (
        <motion.div
          className="p-4 rounded-xl border bg-card space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Top Participants
          </h4>
          <div className="flex flex-wrap gap-2">
            {analytics.topParticipants.map((p, i) => (
              <span key={i} className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {p.name} ({p.count})
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
