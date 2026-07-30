"use client";

/* eslint-disable @next/next/no-img-element -- Git snapshots are data URLs with unknown dimensions until decoded. */

import Panzoom, {
  type PanzoomEventDetail,
  type PanzoomObject,
} from "@panzoom/panzoom";
import {
  ImageIcon,
  Maximize2,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getComparisonLabel } from "@/lib/comparison";
import type { Comparison, ImageSnapshot } from "@/lib/sem-types";
import { cn } from "@/lib/utils";

type ImageTransform = {
  x: number;
  y: number;
  scale: number;
};

type ImageViewportHandle = {
  actualSize: () => void;
  fit: () => void;
  getScale: () => number;
  setTransform: (transform: ImageTransform) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

function formatBytes(byteSize: number) {
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KiB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MiB`;
}

function ControlButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const ImageViewport = forwardRef<
  ImageViewportHandle,
  {
    filePath: string;
    label: string;
    snapshot: ImageSnapshot;
    tone: "added" | "deleted";
    onTransform: (transform: ImageTransform) => void;
  }
>(function ImageViewport(
  { filePath, label, snapshot, tone, onTransform },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const fitScaleRef = useRef(1);
  const isApplyingTransformRef = useRef(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const fitImage = useCallback((animate = true) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const panzoom = panzoomRef.current;

    if (!canvas || !image || !panzoom || !image.naturalWidth) return;

    const horizontalPadding = 48;
    const verticalPadding = 48;
    const fitScale = Math.min(
      Math.max(canvas.clientWidth - horizontalPadding, 1) /
        image.naturalWidth,
      Math.max(canvas.clientHeight - verticalPadding, 1) /
        image.naturalHeight,
      1,
    );
    fitScaleRef.current = fitScale;
    panzoom.zoom(fitScale, { animate });
    panzoom.pan(0, 0, { animate, force: true });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;

    if (!canvas || !image || !dimensions) return;

    const horizontalPadding = 48;
    const verticalPadding = 48;
    const fitScale = Math.min(
      Math.max(canvas.clientWidth - horizontalPadding, 1) /
        image.naturalWidth,
      Math.max(canvas.clientHeight - verticalPadding, 1) /
        image.naturalHeight,
      1,
    );
    fitScaleRef.current = fitScale;

    const panzoom = Panzoom(image, {
      canvas: true,
      cursor: "grab",
      maxScale: 8,
      minScale: Math.min(fitScale, 0.05),
      panOnlyWhenZoomed: false,
      startScale: fitScale,
      step: 0.2,
    });
    panzoomRef.current = panzoom;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      const currentScale = panzoom.getScale();
      const currentPan = panzoom.getPan();
      const options = panzoom.getOptions();
      const delta =
        event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
      const direction = delta < 0 ? 1 : -1;
      const nextScale = Math.min(
        Number(options.maxScale ?? 4),
        Math.max(
          Number(options.minScale ?? 0.125),
          currentScale *
            Math.exp((direction * Number(options.step ?? 0.3)) / 3),
        ),
      );

      if (nextScale === currentScale) return;

      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const cursorFromCenterX =
        event.clientX - (bounds.left + bounds.width / 2);
      const cursorFromCenterY =
        event.clientY - (bounds.top + bounds.height / 2);
      const nextPan = {
        x:
          currentPan.x +
          cursorFromCenterX * (1 / nextScale - 1 / currentScale),
        y:
          currentPan.y +
          cursorFromCenterY * (1 / nextScale - 1 / currentScale),
      };

      isApplyingTransformRef.current = true;
      panzoom.zoom(nextScale, { animate: false, silent: true });
      panzoom.pan(nextPan.x, nextPan.y, {
        animate: false,
        force: true,
        silent: true,
      });
      isApplyingTransformRef.current = false;
      onTransform({ ...nextPan, scale: nextScale });
    }

    function handleTransform(event: Event) {
      const detail = (event as CustomEvent<PanzoomEventDetail>).detail;

      if (isApplyingTransformRef.current || !detail.originalEvent) return;

      onTransform({ x: detail.x, y: detail.y, scale: detail.scale });
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    image.addEventListener("panzoomchange", handleTransform);

    const resizeObserver = new ResizeObserver(() => {
      const wasFitted =
        Math.abs(panzoom.getScale() - fitScaleRef.current) < 0.001;
      const nextFitScale = Math.min(
        Math.max(canvas.clientWidth - horizontalPadding, 1) /
          image.naturalWidth,
        Math.max(canvas.clientHeight - verticalPadding, 1) /
          image.naturalHeight,
        1,
      );
      fitScaleRef.current = nextFitScale;
      panzoom.setOptions({ minScale: Math.min(nextFitScale, 0.05) });

      if (wasFitted) {
        isApplyingTransformRef.current = true;
        panzoom.zoom(nextFitScale, { animate: false, silent: true });
        panzoom.pan(0, 0, {
          animate: false,
          force: true,
          silent: true,
        });
        isApplyingTransformRef.current = false;
      }
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", handleWheel);
      image.removeEventListener("panzoomchange", handleTransform);
      panzoom.destroy();
      panzoomRef.current = null;
    };
  }, [dimensions, onTransform]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      actualSize() {
        panzoomRef.current?.zoom(1);
        panzoomRef.current?.pan(0, 0, { force: true });
      },
      fit() {
        fitImage();
      },
      getScale() {
        return panzoomRef.current?.getScale() ?? fitScaleRef.current;
      },
      setTransform(transform) {
        const panzoom = panzoomRef.current;
        if (!panzoom) return;

        isApplyingTransformRef.current = true;
        panzoom.zoom(transform.scale, { animate: false, silent: true });
        panzoom.pan(transform.x, transform.y, {
          animate: false,
          force: true,
          silent: true,
        });
        isApplyingTransformRef.current = false;
      },
      zoomIn() {
        panzoomRef.current?.zoomIn();
      },
      zoomOut() {
        panzoomRef.current?.zoomOut();
      },
    }),
    [fitImage],
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              tone === "added" ? "bg-emerald-500" : "bg-rose-500",
            )}
            aria-hidden="true"
          />
          <span className="truncate text-xs font-semibold">{label}</span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {dimensions
            ? `${dimensions.width} × ${dimensions.height} · `
            : ""}
          {formatBytes(snapshot.byteSize)}
        </span>
      </div>
      <div
        ref={canvasRef}
        className="image-checkerboard relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
      >
        <img
          ref={imageRef}
          src={snapshot.dataUrl}
          alt={`${label} version of ${filePath}`}
          draggable={false}
          decoding="async"
          className="block max-w-none touch-none select-none shadow-[0_8px_28px_oklch(0_0_0/0.18)]"
          onLoad={(event) => {
            setDimensions({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
          }}
        />
      </div>
    </section>
  );
});

ImageViewport.displayName = "ImageViewport";

export function ImageDiffView({
  filePath,
  oldFilePath,
  before,
  after,
  comparison,
}: {
  filePath: string;
  oldFilePath: string;
  before: ImageSnapshot | null;
  after: ImageSnapshot | null;
  comparison: Comparison;
}) {
  const beforeRef = useRef<ImageViewportHandle>(null);
  const afterRef = useRef<ImageViewportHandle>(null);
  const isSynchronizingRef = useRef(false);
  const [zoomPercent, setZoomPercent] = useState<number | null>(null);
  const isModified = Boolean(before && after);

  const synchronizeTransform = useCallback(
    (source: "before" | "after", transform: ImageTransform) => {
      setZoomPercent(Math.round(transform.scale * 100));
      if (!isModified || isSynchronizingRef.current) return;

      isSynchronizingRef.current = true;
      (source === "before" ? afterRef : beforeRef).current?.setTransform(
        transform,
      );
      isSynchronizingRef.current = false;
    },
    [isModified],
  );
  const handleBeforeTransform = useCallback(
    (transform: ImageTransform) =>
      synchronizeTransform("before", transform),
    [synchronizeTransform],
  );
  const handleAfterTransform = useCallback(
    (transform: ImageTransform) =>
      synchronizeTransform("after", transform),
    [synchronizeTransform],
  );

  function runOnViewports(action: keyof Pick<
    ImageViewportHandle,
    "actualSize" | "fit" | "zoomIn" | "zoomOut"
  >) {
    isSynchronizingRef.current = true;
    beforeRef.current?.[action]();
    afterRef.current?.[action]();
    isSynchronizingRef.current = false;
    const primary = beforeRef.current ?? afterRef.current;
    setZoomPercent(
      action === "fit" ? null : Math.round((primary?.getScale() ?? 1) * 100),
    );
  }

  return (
    <main className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <ImageIcon className="size-5 shrink-0 text-foreground" />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {filePath}
              </h1>
              <Badge
                variant="outline"
                className="rounded-md font-mono text-[10px] tracking-wide uppercase"
              >
                Image {isModified ? "diff" : before ? "deleted" : "added"}
              </Badge>
            </div>
            <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
              {oldFilePath !== filePath
                ? `${oldFilePath} → ${filePath} · `
                : ""}
              {getComparisonLabel(comparison)}
            </p>
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5"
          aria-label="Image zoom controls"
        >
          <ControlButton
            label="Zoom out"
            onClick={() => runOnViewports("zoomOut")}
          >
            <ZoomOut />
          </ControlButton>
          <span className="w-11 text-center font-mono text-[10px] text-muted-foreground">
            {zoomPercent === null ? "Fit" : `${zoomPercent}%`}
          </span>
          <ControlButton
            label="Zoom in"
            onClick={() => runOnViewports("zoomIn")}
          >
            <ZoomIn />
          </ControlButton>
          <ControlButton
            label="Actual size"
            onClick={() => runOnViewports("actualSize")}
          >
            <Scan />
          </ControlButton>
          <ControlButton
            label="Fit to view"
            onClick={() => runOnViewports("fit")}
          >
            <Maximize2 />
          </ControlButton>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1",
          isModified && "divide-x",
        )}
      >
        {before ? (
          <ImageViewport
            ref={beforeRef}
            filePath={oldFilePath}
            label={after ? "Before" : "Deleted"}
            snapshot={before}
            tone="deleted"
            onTransform={handleBeforeTransform}
          />
        ) : null}
        {after ? (
          <ImageViewport
            ref={afterRef}
            filePath={filePath}
            label={before ? "After" : "Added"}
            snapshot={after}
            tone="added"
            onTransform={handleAfterTransform}
          />
        ) : null}
      </div>
    </main>
  );
}
