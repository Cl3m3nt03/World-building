import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import type { BookStyle, Cover } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { BookCover } from "../components/BookCover";
import { drawCover, drawFinish, drawPages, drawSpine } from "./coverArt";
import { dragged, eased, keyed, REST, type Turn } from "./turn";
import { coverFontReady, useCoverImage } from "./useCoverImage";

// The book, in scene units: a cover 2 × 3, boards and a block of pages.
const WIDTH = 2;
const HEIGHT = 3;
const DEPTH = 0.44;
const BOARD = 0.04;

/** How shiny each finish is (a lower roughness shines more). */
const ROUGHNESS: Record<BookStyle["finish"], number> = {
  cloth: 0.95,
  leather: 0.45,
  paper: 0.8,
};

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function textureOf(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Everything the scene draws on, kept to redraw it and to free it. */
type Book = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  group: Group;
  canvases: { cover: HTMLCanvasElement; spine: HTMLCanvasElement; finish: HTMLCanvasElement };
  textures: CanvasTexture[];
  materials: {
    cover: MeshStandardMaterial;
    spine: MeshStandardMaterial;
    finish: MeshStandardMaterial;
  };
  dispose: () => void;
};

function buildBook(host: HTMLElement): Book {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);
  scene.add(new AmbientLight(0xffffff, 1.4));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 6);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.6);
  fill.position.set(-4, -1, 3);
  scene.add(fill);

  const canvases = {
    cover: canvasOf(1024, 1536),
    spine: canvasOf(160, 1092),
    finish: canvasOf(256, 256),
  };
  const pagesSide = canvasOf(128, 512);
  drawPages(pagesSide.getContext("2d") as CanvasRenderingContext2D, 128, 512, true);
  const pagesTop = canvasOf(512, 128);
  drawPages(pagesTop.getContext("2d") as CanvasRenderingContext2D, 512, 128, false);
  const coverTexture = textureOf(canvases.cover);
  const spineTexture = textureOf(canvases.spine);
  const finishTexture = textureOf(canvases.finish);
  const sideTexture = textureOf(pagesSide);
  const topTexture = textureOf(pagesTop);
  // The first three are drawn again when the book changes.
  const textures = [coverTexture, spineTexture, finishTexture, sideTexture, topTexture];
  const materials = {
    cover: new MeshStandardMaterial({ map: coverTexture }),
    spine: new MeshStandardMaterial({ map: spineTexture }),
    finish: new MeshStandardMaterial({ map: finishTexture }),
  };
  const side = new MeshStandardMaterial({ map: sideTexture, roughness: 1 });
  const top = new MeshStandardMaterial({ map: topTexture, roughness: 1 });

  const group = new Group();
  const f = materials.finish;
  // Faces of a box: +x, -x, +y, -y, +z, -z.
  const front = new Mesh(new BoxGeometry(WIDTH, HEIGHT, BOARD), [f, f, f, f, materials.cover, f]);
  front.position.z = DEPTH / 2 - BOARD / 2;
  const back = new Mesh(new BoxGeometry(WIDTH, HEIGHT, BOARD), [f, f, f, f, f, f]);
  back.position.z = -DEPTH / 2 + BOARD / 2;
  const spine = new Mesh(new BoxGeometry(BOARD, HEIGHT, DEPTH), [f, materials.spine, f, f, f, f]);
  spine.position.x = -WIDTH / 2 + BOARD / 2;
  const pages = new Mesh(
    new BoxGeometry(WIDTH - BOARD * 2, HEIGHT - BOARD * 2, DEPTH - BOARD * 2),
    [side, side, top, top, side, side],
  );
  pages.position.x = BOARD / 2;
  group.add(front, back, spine, pages);
  scene.add(group);

  const meshes = [front, back, spine, pages];
  return {
    renderer,
    scene,
    camera,
    group,
    canvases,
    textures,
    materials,
    dispose: () => {
      for (const mesh of meshes) mesh.geometry.dispose();
      for (const material of [...Object.values(materials), side, top]) material.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

type Props = {
  title: string;
  bookStyle: BookStyle;
  cover: Cover;
  className?: string | undefined;
};

/**
 * The story's book in 3D (docs/features/08-quill.md, M10): its cover, its
 * spine with the title and its pages. It turns when dragged or with the
 * arrow keys (Home puts it back); without WebGL, the 2D cover stands in.
 */
export function Book3D({ title, bookStyle, cover, className }: Props) {
  const { t } = useTranslation();
  const hintId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const turnRef = useRef<{ current: Turn; target: Turn }>({ current: REST, target: REST });
  const frameRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const image = useCoverImage(cover.assetId);

  const render = () => {
    const book = bookRef.current;
    if (!book) return;
    const { current } = turnRef.current;
    book.group.rotation.set(current.tilt, current.yaw, 0);
    book.renderer.render(book.scene, book.camera);
  };

  // Moves the book toward its target turn, a frame at a time (at once when
  // the user reduces motion).
  const animate = () => {
    cancelAnimationFrame(frameRef.current);
    const turn = turnRef.current;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      turn.current = turn.target;
      render();
      return;
    }
    const step = () => {
      const next = eased(turn.current, turn.target);
      turn.current = next ?? turn.target;
      render();
      if (next) frameRef.current = requestAnimationFrame(step);
    };
    step();
  };

  // The scene, made once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: render reads refs only
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let book: Book;
    try {
      book = buildBook(host);
    } catch {
      setFailed(true);
      return;
    }
    bookRef.current = book;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      book.renderer.setSize(width, height, false);
      book.renderer.domElement.style.width = "100%";
      book.renderer.domElement.style.height = "100%";
      book.camera.aspect = width / height;
      book.camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      book.dispose();
      bookRef.current = null;
    };
  }, []);

  // The cover, the spine and the finish, drawn again when they change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: render reads refs only
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await coverFontReady();
      const book = bookRef.current;
      if (cancelled || !book) return;
      const { cover: coverCanvas, spine, finish } = book.canvases;
      drawCover(coverCanvas.getContext("2d") as CanvasRenderingContext2D, 1024, 1536, {
        title,
        bookStyle,
        cover,
        image,
      });
      drawSpine(spine.getContext("2d") as CanvasRenderingContext2D, 160, 1092, title, bookStyle);
      drawFinish(finish.getContext("2d") as CanvasRenderingContext2D, bookStyle, 256, 256);
      for (const texture of book.textures.slice(0, 3)) texture.needsUpdate = true;
      for (const material of Object.values(book.materials)) {
        material.roughness = ROUGHNESS[bookStyle.finish];
      }
      render();
    })();
    return () => {
      cancelled = true;
    };
  }, [title, bookStyle, cover, image, failed]);

  if (failed) {
    return (
      <BookCover title={title} bookStyle={bookStyle} cover={cover} large className={className} />
    );
  }

  const turnTo = (target: Turn) => {
    turnRef.current.target = target;
    animate();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const turn = turnRef.current;
    turn.target = dragged(turn.target, event.clientX - drag.x, event.clientY - drag.y);
    // Follows the pointer without easing.
    turn.current = turn.target;
    dragRef.current = { x: event.clientX, y: event.clientY };
    render();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyed(turnRef.current.target, event.key);
    if (!next) return;
    event.preventDefault();
    turnTo(next);
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        ref={hostRef}
        role="img"
        aria-label={t("quill.book3d.label", { title })}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: it turns with the arrow keys
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onDoubleClick={() => turnTo(REST)}
        onKeyDown={onKeyDown}
        className="aspect-[3/4] w-full cursor-grab touch-none rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      />
      <p id={hintId} className="text-center text-xs text-muted-foreground">
        {t("quill.book3d.hint")}
      </p>
    </div>
  );
}
