import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Percent, 
  Repeat, 
  UserCheck 
} from "lucide-react";

interface StatsData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    totalOrders: number;
    totalRevenue: number;
    avgOrder: number;
    conversionRate: number;
    repeatCustomers: number;
    repeatRate: number;
  };
  dailyOrders: Array<{
    date: string;
    orderCount: number;
    revenue: number;
  }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  loyaltyDistribution: Array<{
    level: string;
    count: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  discounts: {
    firstOrderUsed: number;
    customDiscountGranted: number;
    loyaltyEligible: number;
  };
}

interface AdminStatsProps {
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted))",
  destructive: "hsl(var(--destructive))",
};

const PIE_COLORS = [
  "#8B4513", // brown
  "#059669", // green
  "#7C3AED", // purple
  "#DC2626", // red
  "#6B7280", // gray
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#6B7280",
  paid: "#059669",
  completed: "#7C3AED",
  cancelled: "#DC2626",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  paid: "Оплачен",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export default function AdminStats({ adminFetch }: AdminStatsProps) {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => adminFetch("/api/admin/stats"),
  });

  if (isLoading || !stats) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Загрузка статистики...
      </div>
    );
  }

  const { overview } = stats;

  return (
    <div className="space-y-6 p-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Пользователи</p>
              <p className="text-2xl font-bold">{overview.totalUsers}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Активных: {overview.activeUsers}
              </p>
            </div>
            <Users className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Заказы (30д)</p>
              <p className="text-2xl font-bold">{overview.totalOrders}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Выручка: {overview.totalRevenue.toLocaleString()}₽
              </p>
            </div>
            <ShoppingCart className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Средний чек</p>
              <p className="text-2xl font-bold">{overview.avgOrder.toLocaleString()}₽</p>
              <p className="text-xs text-muted-foreground mt-1">
                За последний месяц
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Конверсия</p>
              <p className="text-2xl font-bold">{overview.conversionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Регистрация → Заказ
              </p>
            </div>
            <Percent className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Повторные покупки</p>
              <p className="text-2xl font-bold">{overview.repeatCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rate: {overview.repeatRate}%
              </p>
            </div>
            <Repeat className="w-8 h-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Верифицированные</p>
              <p className="text-2xl font-bold">{overview.verifiedUsers}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Доступна программа лояльности
              </p>
            </div>
            <UserCheck className="w-8 h-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Daily Orders Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Заказы и выручка по дням (30 дней)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats.dailyOrders}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
              formatter={(value: number, name: string) => {
                if (name === 'orderCount') return [value, 'Заказов'];
                return [value.toLocaleString() + '₽', 'Выручка'];
              }}
            />
            <Legend 
              formatter={(value) => value === 'orderCount' ? 'Заказов' : 'Выручка'}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="orderCount" 
              stroke={COLORS.primary} 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="revenue" 
              stroke={COLORS.accent} 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Топ-5 товаров (по количеству)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'quantity') return [value + 'г', 'Продано'];
                  return [value.toLocaleString() + '₽', 'Выручка'];
                }}
              />
              <Legend 
                formatter={(value) => value === 'quantity' ? 'Продано (г)' : 'Выручка'}
              />
              <Bar dataKey="quantity" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Loyalty Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Распределение по уровням лояльности</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.loyaltyDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ level, count }) => `${level}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.loyaltyDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Status Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Статусы заказов (30 дней)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count }) => `${STATUS_LABELS[status] || status}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.statusDistribution.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.status] || PIE_COLORS[index % PIE_COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => {
                  const status = props.payload.status;
                  return [value, STATUS_LABELS[status] || status];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Discount Statistics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Статистика скидок (30 дней)</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm">Использовано скидок первого заказа (20%)</span>
              <span className="font-bold text-lg">{stats.discounts.firstOrderUsed}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm">Выдано индивидуальных скидок</span>
              <span className="font-bold text-lg">{stats.discounts.customDiscountGranted}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm">Пользователей с доступом к программе лояльности</span>
              <span className="font-bold text-lg">{stats.discounts.loyaltyEligible}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
