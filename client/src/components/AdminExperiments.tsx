import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, FlaskConical, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Experiment } from "@shared/schema";

interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, any>;
}

const defaultVariants: ExperimentVariant[] = [
  { id: "control", name: "Контрольная группа", weight: 50, config: { price_multy: 1.0 } },
  { id: "experiment", name: "Экспериментальная группа", weight: 50, config: { price_multy: 0.5 } },
];

interface AdminExperimentsProps {
  adminPassword: string;
}

export default function AdminExperiments({ adminPassword }: AdminExperimentsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Experiment | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    testId: "",
    name: "",
    description: "",
    status: "inactive" as "active" | "inactive",
    variants: defaultVariants,
  });

  const { data: experiments = [], isLoading } = useQuery<Experiment[]>({
    queryKey: ["/api/admin/experiments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/experiments", {
        headers: { "X-Admin-Password": adminPassword },
      });
      if (!res.ok) throw new Error("Failed to fetch experiments");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/experiments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify({
          testId: data.testId,
          name: data.name,
          description: data.description || null,
          status: data.status,
          variants: JSON.stringify(data.variants),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create experiment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/experiments"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: "Эксперимент создан" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          status: data.status,
          variants: JSON.stringify(data.variants),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update experiment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/experiments"] });
      setIsFormOpen(false);
      setEditingExperiment(null);
      resetForm();
      toast({ title: "Эксперимент обновлён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      if (!res.ok) throw new Error("Failed to delete experiment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/experiments"] });
      setDeleteConfirm(null);
      toast({ title: "Эксперимент удалён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить эксперимент", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: number; newStatus: "active" | "inactive" }) => {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/experiments"] });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось изменить статус", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      testId: "",
      name: "",
      description: "",
      status: "inactive",
      variants: defaultVariants,
    });
  };

  const openCreateForm = () => {
    resetForm();
    setEditingExperiment(null);
    setIsFormOpen(true);
  };

  const openEditForm = (experiment: Experiment) => {
    let variants: ExperimentVariant[] = defaultVariants;
    try {
      variants = JSON.parse(experiment.variants);
    } catch (e) {
      console.error("Failed to parse variants:", e);
    }

    setFormData({
      testId: experiment.testId,
      name: experiment.name,
      description: experiment.description || "",
      status: experiment.status as "active" | "inactive",
      variants,
    });
    setEditingExperiment(experiment);
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.testId || !formData.name || formData.variants.length < 2) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }

    const totalWeight = formData.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      toast({ title: "Ошибка", description: `Сумма весов должна быть 100, сейчас: ${totalWeight}`, variant: "destructive" });
      return;
    }

    if (editingExperiment) {
      updateMutation.mutate({ id: editingExperiment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const updateVariant = (index: number, field: keyof ExperimentVariant, value: any) => {
    const newVariants = [...formData.variants];
    if (field === "config") {
      newVariants[index] = { ...newVariants[index], config: value };
    } else {
      (newVariants[index] as any)[field] = value;
    }
    setFormData({ ...formData, variants: newVariants });
  };

  const addVariant = () => {
    setFormData({
      ...formData,
      variants: [
        ...formData.variants,
        { id: `variant_${Date.now()}`, name: "Новый вариант", weight: 0, config: { price_multy: 1.0 } },
      ],
    });
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length <= 2) {
      toast({ title: "Ошибка", description: "Минимум 2 варианта", variant: "destructive" });
      return;
    }
    const newVariants = formData.variants.filter((_, i) => i !== index);
    setFormData({ ...formData, variants: newVariants });
  };

  const filteredExperiments = experiments.filter(
    (exp) =>
      exp.testId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex justify-center p-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по ID или названию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-experiment-search"
          />
        </div>
        <Button onClick={openCreateForm} data-testid="button-create-experiment">
          <Plus className="w-4 h-4 mr-2" />
          Создать эксперимент
        </Button>
      </div>

      {filteredExperiments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm ? "Эксперименты не найдены" : "Нет экспериментов. Создайте первый!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredExperiments.map((experiment) => {
            let variants: ExperimentVariant[] = [];
            try {
              variants = JSON.parse(experiment.variants);
            } catch (e) {}

            return (
              <Card key={experiment.id} data-testid={`card-experiment-${experiment.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{experiment.name}</CardTitle>
                        <Badge
                          variant={experiment.status === "active" ? "default" : "secondary"}
                          data-testid={`badge-status-${experiment.id}`}
                        >
                          {experiment.status === "active" ? "Активен" : "Неактивен"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">{experiment.testId}</p>
                      {experiment.description && (
                        <p className="text-sm text-muted-foreground">{experiment.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: experiment.id,
                            newStatus: experiment.status === "active" ? "inactive" : "active",
                          })
                        }
                        title={experiment.status === "active" ? "Остановить" : "Запустить"}
                        data-testid={`button-toggle-${experiment.id}`}
                      >
                        {experiment.status === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditForm(experiment)}
                        data-testid={`button-edit-${experiment.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(experiment)}
                        data-testid={`button-delete-${experiment.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((variant) => (
                      <Badge key={variant.id} variant="outline" className="font-normal">
                        {variant.name}: {variant.weight}%
                        {variant.config.price_multy !== undefined && (
                          <span className="ml-1 text-muted-foreground">
                            (×{variant.config.price_multy})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExperiment ? "Редактировать эксперимент" : "Создать эксперимент"}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры A/B теста. Сумма весов должна равняться 100.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="testId">ID теста (kebab-case)</Label>
                <Input
                  id="testId"
                  value={formData.testId}
                  onChange={(e) => setFormData({ ...formData, testId: e.target.value })}
                  placeholder="price_jan_2026_v1"
                  disabled={!!editingExperiment}
                  data-testid="input-test-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Тест цены Январь 2026"
                  data-testid="input-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Что проверяем в этом эксперименте..."
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="status"
                checked={formData.status === "active"}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, status: checked ? "active" : "inactive" })
                }
                data-testid="switch-status"
              />
              <Label htmlFor="status">Активен</Label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Варианты</Label>
                <Button size="sm" variant="outline" onClick={addVariant} data-testid="button-add-variant">
                  <Plus className="w-4 h-4 mr-1" />
                  Добавить
                </Button>
              </div>

              {formData.variants.map((variant, index) => (
                <Card key={index} className="p-4">
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">ID варианта</Label>
                        <Input
                          value={variant.id}
                          onChange={(e) => updateVariant(index, "id", e.target.value)}
                          placeholder="control"
                          data-testid={`input-variant-id-${index}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Название</Label>
                        <Input
                          value={variant.name}
                          onChange={(e) => updateVariant(index, "name", e.target.value)}
                          placeholder="Контрольная группа"
                          data-testid={`input-variant-name-${index}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Вес (%)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={variant.weight}
                            onChange={(e) => updateVariant(index, "weight", parseInt(e.target.value) || 0)}
                            data-testid={`input-variant-weight-${index}`}
                          />
                          {formData.variants.length > 2 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeVariant(index)}
                              data-testid={`button-remove-variant-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">price_multy (множитель цены)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={0}
                        value={variant.config.price_multy ?? 1}
                        onChange={(e) =>
                          updateVariant(index, "config", {
                            ...variant.config,
                            price_multy: parseFloat(e.target.value) || 1,
                          })
                        }
                        data-testid={`input-variant-price-multy-${index}`}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              <p className="text-sm text-muted-foreground">
                Сумма весов: {formData.variants.reduce((sum, v) => sum + v.weight, 0)}%
                {formData.variants.reduce((sum, v) => sum + v.weight, 0) !== 100 && (
                  <span className="text-destructive ml-2">(должна быть 100%)</span>
                )}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-experiment"
            >
              {editingExperiment ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить эксперимент?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Эксперимент "{deleteConfirm?.name}" будет удалён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              data-testid="button-confirm-delete"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
