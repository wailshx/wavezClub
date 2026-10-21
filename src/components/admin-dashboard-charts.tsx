import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardStats } from "@/lib/admin-dashboard-api";

/**
 * Dashboard charts, split out of the console so recharts is a separate chunk.
 * The console shell paints first and these arrive when the dashboard renders;
 * before, the chart library was parsed before an admin could see anything.
 */

const CHART_COLORS = ["#2e6bff", "#38bdf8", "#818cf8", "#a78bfa", "#f59e0b"];
const axisTick = { fill: "#94a3c8", fontSize: 10 };
const gridStroke = "rgba(255, 255, 255, 0.08)";

/** Glass tooltip used by every dashboard chart (replaces recharts' white box). */
function GlassChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: { fill?: string };
  }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[9rem] rounded-xl border border-white/15 bg-[#0a1226]/95 px-3.5 py-2.5 shadow-[0_18px_40px_-16px_rgba(6,11,24,0.9)] backdrop-blur-md">
      {label != null && label !== "" && (
        <p className="mb-1.5 text-xs font-extrabold text-white">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey ?? entry.name ?? "")}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? entry.payload?.fill ?? "#2e6bff" }}
            />
            <span className="font-semibold text-[#94a3c8]">{entry.name}</span>
            <span className="ml-auto pl-4 font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MembersGrowthChart({
  data,
  reduced,
}: {
  data: DashboardStats["members"]["by_month"];
  reduced: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="memberGrowthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e6bff" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#2e6bff" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          tick={axisTick}
          stroke={gridStroke}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          width={28}
          tick={axisTick}
          stroke={gridStroke}
          tickLine={false}
          axisLine={false}
        />
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <Tooltip content={<GlassChartTooltip />} />
        <Area
          type="monotone"
          dataKey="cumulative"
          name="Members"
          stroke="#2e6bff"
          strokeWidth={2}
          fill="url(#memberGrowthFill)"
          dot={{ r: 3, fill: "#2e6bff" }}
          activeDot={{ r: 5 }}
          isAnimationActive={!reduced}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MembersLevelDonut({
  data,
  reduced,
}: {
  data: DashboardStats["members"]["by_level"];
  reduced: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="level"
          innerRadius={46}
          outerRadius={72}
          paddingAngle={3}
          cornerRadius={5}
          isAnimationActive={!reduced}
          animationDuration={700}
          animationEasing="ease-out"
          animationBegin={120}
        >
          {data.map((entry, i) => (
            <Cell key={entry.level} fill={CHART_COLORS[i % CHART_COLORS.length] ?? "#2e6bff"} />
          ))}
        </Pie>
        <Tooltip content={<GlassChartTooltip />} />
        <Legend wrapperStyle={{ color: "#c7d2fe", fontSize: 12, fontWeight: 600 }} iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MembersDepartmentBar({
  data,
  reduced,
}: {
  data: DashboardStats["members"]["by_department"];
  reduced: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="deptBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e6bff" />
            <stop offset="100%" stopColor="#2e6bff" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="department"
          tick={axisTick}
          interval={0}
          stroke={gridStroke}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          width={28}
          tick={axisTick}
          stroke={gridStroke}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<GlassChartTooltip />} cursor={{ fill: "rgba(46,107,255,0.15)" }} />
        <Bar
          dataKey="value"
          fill="url(#deptBarFill)"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!reduced}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubmissionsGrowthChart({
  data,
  reduced,
}: {
  data: DashboardStats["events"]["by_month"];
  reduced: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="eventFreqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          tick={axisTick}
          stroke={gridStroke}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          width={28}
          tick={axisTick}
          stroke={gridStroke}
          tickLine={false}
          axisLine={false}
        />
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <Tooltip content={<GlassChartTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          name="Submissions"
          stroke="#38bdf8"
          strokeWidth={2}
          fill="url(#eventFreqFill)"
          dot={{ r: 3, fill: "#38bdf8" }}
          activeDot={{ r: 5 }}
          isAnimationActive={!reduced}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
