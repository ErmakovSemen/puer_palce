import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { InfoBanner, BannerWidthVariant, BannerHeightVariant } from "@shared/schema";
import { BANNER_SLOTS, BANNER_WIDTH_VARIANTS, BANNER_HEIGHT_VARIANTS } from "@shared/schema";
import { Monitor, Smartphone, GripVertical, Settings2, Pencil, Coffee, Package, Filter, LayoutGrid, Megaphone, X } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";

interface BannerLayoutPreviewProps {
  banners: InfoBanner[];
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
  onEditBanner: (banner: InfoBanner) => void;
}

const PRODUCT_ROWS = [
  { index: 0, label: "После ряда 1" },
  { index: 1, label: "После ряда 2" },
  { index: 2, label: "После ряда 3" },
  { index: 3, label: "После ряда 4" },
  { index: 4, label: "После ряда 5" },
];

interface DraggableBannerProps {
  banner: InfoBanner;
  deviceView: "desktop" | "mobile";
  onEdit: () => void;
  onSelect: () => void;
  isSelected: boolean;
}

function DraggableBanner({ banner, deviceView, onEdit, onSelect, isSelected }: DraggableBannerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: `banner-${banner.id}` });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const isHidden = deviceView === "desktop" ? banner.hideOnDesktop : banner.hideOnMobile;
  const widthLabel = BANNER_WIDTH_VARIANTS.find(w => w.id === banner.widthVariant)?.name || "100%";
  const heightLabel = BANNER_HEIGHT_VARIANTS.find(h => h.id === banner.heightVariant)?.name || "Стандартный";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
        isHidden ? "bg-muted/50 border-dashed opacity-60" : "bg-card border-border"
      } ${banner.theme === "dark" ? "border-l-4 border-l-primary" : "border-l-4 border-l-secondary"} ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      data-testid={`draggable-banner-${banner.id}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        data-testid={`drag-handle-${banner.id}`}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{banner.title}</span>
          {isHidden && <Badge variant="outline" className="text-xs">Скрыт</Badge>}
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          <Badge variant="secondary" className="text-xs">{widthLabel}</Badge>
          <Badge variant="secondary" className="text-xs">{heightLabel}</Badge>
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="shrink-0" data-testid={`edit-banner-${banner.id}`}>
        <Pencil className="w-3 h-3" />
      </Button>
    </div>
  );
}

interface DroppableSlotProps {
  slotId: string;
  slotName: string;
  icon: React.ReactNode;
  banners: InfoBanner[];
  deviceView: "desktop" | "mobile";
  onEditBanner: (banner: InfoBanner) => void;
  onSelectBanner: (banner: InfoBanner) => void;
  selectedBannerId: number | null;
  rowIndex?: number;
}

function DroppableSlot({ slotId, slotName, icon, banners, deviceView, onEditBanner, onSelectBanner, selectedBannerId, rowIndex }: DroppableSlotProps) {
  const uniqueSlotId = rowIndex !== undefined ? `${slotId}:${rowIndex}` : slotId;
  
  const { isOver, setNodeRef } = useDroppable({
    id: uniqueSlotId,
    data: { slotId, rowIndex },
  });

  const slotBanners = banners.filter(b => {
    const slot = deviceView === "desktop" ? b.desktopSlot : b.mobileSlot;
    if (slotId === "between_products") {
      const bannerRowIndex = deviceView === "desktop" ? b.betweenRowIndexDesktop : b.betweenRowIndexMobile;
      return slot === slotId && bannerRowIndex === rowIndex;
    }
    return slot === slotId;
  }).sort((a, b) => {
    const orderA = deviceView === "desktop" ? a.desktopOrder : a.mobileOrder;
    const orderB = deviceView === "desktop" ? b.desktopOrder : b.mobileOrder;
    return orderA - orderB;
  });

  const isEmpty = slotBanners.length === 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{slotName}</span>
        <Badge variant="outline" className="text-xs" data-testid={`slot-count-${uniqueSlotId}`}>{slotBanners.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[60px] p-2 rounded-lg border-2 border-dashed transition-colors ${
          isOver ? "border-primary bg-primary/10" : isEmpty ? "border-muted bg-muted/20" : "border-primary/30 bg-primary/5"
        }`}
        data-testid={`droppable-slot-${uniqueSlotId}`}
      >
        {isEmpty ? (
          <div className="flex items-center justify-center h-10 text-xs text-muted-foreground">
            Перетащите баннер сюда
          </div>
        ) : (
          <div className="space-y-2">
            {slotBanners.map(banner => (
              <DraggableBanner
                key={banner.id}
                banner={banner}
                deviceView={deviceView}
                onEdit={() => onEditBanner(banner)}
                onSelect={() => onSelectBanner(banner)}
                isSelected={selectedBannerId === banner.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BannerLayoutPreview({ banners, adminFetch, onEditBanner }: BannerLayoutPreviewProps) {
  const { toast } = useToast();
  const [deviceView, setDeviceView] = useState<"desktop" | "mobile">("desktop");
  const [activeBanner, setActiveBanner] = useState<InfoBanner | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<InfoBanner | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const updateBannerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return adminFetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const bannerId = parseInt(event.active.id.toString().replace("banner-", ""));
    const banner = banners.find(b => b.id === bannerId);
    if (banner) {
      setActiveBanner(banner);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveBanner(null);
    const { active, over } = event;

    if (!over) return;

    const bannerId = parseInt(active.id.toString().replace("banner-", ""));
    const banner = banners.find(b => b.id === bannerId);
    if (!banner) return;

    const overData = over.data?.current as { slotId?: string; rowIndex?: number } | undefined;
    const targetSlotId = overData?.slotId || over.id?.toString();
    const targetRowIndex = overData?.rowIndex ?? null;

    if (!targetSlotId) return;

    const slotIdPart = targetSlotId.includes(":") ? targetSlotId.split(":")[0] : targetSlotId;

    const currentSlot = deviceView === "desktop" ? banner.desktopSlot : banner.mobileSlot;
    const currentRowIndex = deviceView === "desktop" ? banner.betweenRowIndexDesktop : banner.betweenRowIndexMobile;
    
    if (currentSlot === slotIdPart && currentRowIndex === targetRowIndex) {
      return;
    }

    const updateData: any = {};
    if (deviceView === "desktop") {
      updateData.desktopSlot = slotIdPart;
      if (slotIdPart === "between_products") {
        updateData.betweenRowIndexDesktop = targetRowIndex;
      } else {
        updateData.betweenRowIndexDesktop = null;
      }
    } else {
      updateData.mobileSlot = slotIdPart;
      if (slotIdPart === "between_products") {
        updateData.betweenRowIndexMobile = targetRowIndex;
      } else {
        updateData.betweenRowIndexMobile = null;
      }
    }

    updateBannerMutation.mutate({ id: bannerId, data: updateData });
    toast({
      title: "Позиция обновлена",
      description: `Баннер перемещён в "${BANNER_SLOTS.find(s => s.id === slotIdPart)?.name || slotIdPart}"`,
    });
  };

  const handleSizeChange = (bannerId: number, field: "widthVariant" | "heightVariant", value: string) => {
    updateBannerMutation.mutate({ 
      id: bannerId, 
      data: { [field]: value } 
    });
    setSelectedBanner(prev => prev ? { ...prev, [field]: value } : null);
    toast({ title: "Размер обновлён" });
  };

  const handleSelectBanner = (banner: InfoBanner) => {
    setSelectedBanner(prev => prev?.id === banner.id ? null : banner);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold">Визуальный редактор позиций</h3>
        <div className="flex gap-2">
          <Button
            variant={deviceView === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => setDeviceView("desktop")}
            data-testid="button-preview-desktop"
          >
            <Monitor className="w-4 h-4 mr-2" />
            Десктоп
          </Button>
          <Button
            variant={deviceView === "mobile" ? "default" : "outline"}
            size="sm"
            onClick={() => setDeviceView("mobile")}
            data-testid="button-preview-mobile"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Мобильный
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Card className={`flex-1 p-4 ${deviceView === "mobile" ? "max-w-[400px] mx-auto" : ""}`}>
            <div className="text-xs text-muted-foreground text-center mb-4 pb-2 border-b">
              {deviceView === "desktop" ? "Превью десктопа" : "Превью мобильного"}
            </div>

            <div className="space-y-4">
              <DroppableSlot
                slotId="after_header"
                slotName="После шапки"
                icon={<Megaphone className="w-4 h-4 text-primary" />}
                banners={banners}
                deviceView={deviceView}
                onEditBanner={onEditBanner}
                onSelectBanner={handleSelectBanner}
                selectedBannerId={selectedBanner?.id || null}
              />

              <DroppableSlot
                slotId="after_filters"
                slotName="После фильтров"
                icon={<Filter className="w-4 h-4 text-blue-500" />}
                banners={banners}
                deviceView={deviceView}
                onEditBanner={onEditBanner}
                onSelectBanner={handleSelectBanner}
                selectedBannerId={selectedBanner?.id || null}
              />

              <DroppableSlot
                slotId="before_products"
                slotName="Перед товарами"
                icon={<Package className="w-4 h-4 text-green-500" />}
                banners={banners}
                deviceView={deviceView}
                onEditBanner={onEditBanner}
                onSelectBanner={handleSelectBanner}
                selectedBannerId={selectedBanner?.id || null}
              />

              <div className="border rounded-lg p-3 bg-muted/20">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">Сетка товаров</span>
                </div>

                <div className={`grid gap-2 mb-3 ${deviceView === "desktop" ? "grid-cols-4" : "grid-cols-2"}`}>
                  {Array.from({ length: deviceView === "desktop" ? 4 : 2 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-muted rounded flex items-center justify-center">
                      <Coffee className="w-6 h-6 text-muted-foreground" />
                    </div>
                  ))}
                </div>

                {PRODUCT_ROWS.map((row) => (
                  <div key={row.index} className="mb-3">
                    <DroppableSlot
                      slotId="between_products"
                      slotName={row.label}
                      icon={<LayoutGrid className="w-3 h-3 text-orange-400" />}
                      banners={banners}
                      deviceView={deviceView}
                      onEditBanner={onEditBanner}
                      onSelectBanner={handleSelectBanner}
                      selectedBannerId={selectedBanner?.id || null}
                      rowIndex={row.index}
                    />
                    <div className={`grid gap-2 mt-2 ${deviceView === "desktop" ? "grid-cols-4" : "grid-cols-2"}`}>
                      {Array.from({ length: deviceView === "desktop" ? 4 : 2 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-muted rounded flex items-center justify-center">
                          <Coffee className="w-6 h-6 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <DroppableSlot
                slotId="after_products"
                slotName="После товаров"
                icon={<Package className="w-4 h-4 text-purple-500" />}
                banners={banners}
                deviceView={deviceView}
                onEditBanner={onEditBanner}
                onSelectBanner={handleSelectBanner}
                selectedBannerId={selectedBanner?.id || null}
              />

              <DroppableSlot
                slotId="before_footer"
                slotName="Перед подвалом"
                icon={<Megaphone className="w-4 h-4 text-gray-500" />}
                banners={banners}
                deviceView={deviceView}
                onEditBanner={onEditBanner}
                onSelectBanner={handleSelectBanner}
                selectedBannerId={selectedBanner?.id || null}
              />
            </div>
          </Card>

          <DragOverlay>
            {activeBanner ? (
              <div className="p-3 bg-card border rounded-lg shadow-lg">
                <span className="font-medium">{activeBanner.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {selectedBanner && (
          <Card className="w-80 p-4 shrink-0 h-fit" data-testid="banner-settings-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span className="font-medium">Настройки баннера</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelectedBanner(null)} data-testid="close-settings-panel">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-4 truncate">{selectedBanner.title}</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Ширина</label>
                <Select
                  value={selectedBanner.widthVariant}
                  onValueChange={(value) => handleSizeChange(selectedBanner.id, "widthVariant", value)}
                >
                  <SelectTrigger data-testid="select-panel-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_WIDTH_VARIANTS.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Высота</label>
                <Select
                  value={selectedBanner.heightVariant}
                  onValueChange={(value) => handleSizeChange(selectedBanner.id, "heightVariant", value)}
                >
                  <SelectTrigger data-testid="select-panel-height">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_HEIGHT_VARIANTS.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => onEditBanner(selectedBanner)}
                data-testid="button-edit-selected-banner"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Редактировать
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
