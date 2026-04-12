import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "../_lib/adminData";
import ChartCard from "./ChartCard";
import styles from "../admin-v2.module.css";

const tooltipStyle = {
  background: "#111114",
  border: "1px solid #27272a",
  borderRadius: "10px",
  color: "#fafafa",
  fontSize: "12px",
};

export default function AnalyticsPanel({ analyticsData, filterTrack }) {
  return (
    <section className={styles.analyticsGrid} aria-label="Track analytics">
      <ChartCard
        title="Registrations over time"
        subtitle={`Track: ${String(filterTrack || "workshop").toUpperCase()}`}
        className={styles.chartCardWide}
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analyticsData.timeline} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(63,63,70,0.42)" />
            <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 12 }} stroke="#3f3f46" />
            <YAxis allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 12 }} stroke="#3f3f46" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(167,139,250,0.4)" }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3, fill: "#34d399" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Top colleges"
        subtitle={`Track: ${String(filterTrack || "workshop").toUpperCase()}`}
      >
        <ResponsiveContainer width="100%" height={290}>
          <BarChart
            data={analyticsData.topColleges}
            layout="vertical"
            margin={{ left: 12, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(63,63,70,0.42)" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" />
            <YAxis
              type="category"
              dataKey="college"
              width={130}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              stroke="#3f3f46"
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Entry size distribution">
        <ResponsiveContainer width="100%" height={290}>
          <PieChart>
            <Pie
              data={analyticsData.sizeDist}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={94}
              innerRadius={50}
              paddingAngle={2}
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {analyticsData.sizeDist.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              wrapperStyle={{ color: "#a1a1aa", fontSize: "12px" }}
              iconSize={10}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}
